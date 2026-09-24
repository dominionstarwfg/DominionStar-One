import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createShareSourceAuthority } from '../src/share-source-authority.mjs';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const service=read('src/share-service.mjs');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const picker=read('ui/share-picker.js');
const pickerHtml=read('ui/share-picker.html');
const pickerCss=read('ui/share-picker.css');
const controller=read('ui/share-controller.js');
const integration=read('ui/share-integration.js');
const mediaController=read('ui/media-controller.js');
const toolbar=read('ui/presenter-toolbar.html');
const toolbarJs=read('ui/presenter-toolbar.js');
const toolbarCss=read('ui/presenter-toolbar.css');
const shareCss=read('ui/share.css');
const annotation=read('ui/share-annotation.js');

const requireText=(source,needle,message)=>assert.ok(source.includes(needle),message);
const rejectText=(source,needle,message)=>assert.ok(!source.includes(needle),message);
const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
const atLeast=(major,minor,patch)=>versionMajor>major||(versionMajor===major&&(versionMinor>minor||(versionMinor===minor&&versionPatch>=patch)));

// Source enumeration is single-flight per source family and remains bounded.
let enumerateCount=0;
let releaseFirst;
const firstEnumeration=new Promise(resolve=>{releaseFirst=resolve;});
const authority=createShareSourceAuthority({
  timeoutMs:20,
  enumerateSources:async()=>{
    enumerateCount+=1;
    if(enumerateCount===1)return firstEnumeration;
    return [{id:'screen:second'}];
  }
});
const [first,second]=await Promise.all([authority.list(),authority.list()]);
assert.equal(enumerateCount,1,'Overlapping source requests must share one native enumeration.');
assert.equal(first.timedOut,true);
assert.equal(second.timedOut,true);
assert.equal(authority.busy(),true,'A timed-out native enumeration must remain single-flight until it settles.');
releaseFirst([{id:'screen:first'}]);
await firstEnumeration;
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(authority.busy(),false);
const recovered=await authority.list();
assert.equal(enumerateCount,2);
assert.equal(recovered.ok,true);
assert.equal(authority.get('screen:second')?.id,'screen:second');

let familyCalls=0;
const familyAuthority=createShareSourceAuthority({
  timeoutMs:100,
  enumerateSources:async options=>{
    familyCalls+=1;
    return String(options?.kind||'screen')==='window'?[{id:'window:one'}]:[{id:'screen:one'}];
  }
});
await Promise.all([familyAuthority.list({kind:'screen'}),familyAuthority.list({kind:'window'})]);
assert.equal(familyCalls,2,'Chooser must enumerate screen and application-window families independently.');
assert.equal(familyAuthority.get('screen:one')?.id,'screen:one');
assert.equal(familyAuthority.get('window:one')?.id,'window:one');

// 2.0.40 permission + picker authority: the DominionStar thumbnail chooser is
// the only active source-selection surface. macOS system-picker capability may
// be detected for diagnostics, but it must not own getDisplayMedia.
requireText(main,"systemPreferences.getMediaAccessStatus(kind)",'macOS TCC status authority is missing.');
requireText(main,"permissionStatus('screen')",'Screen Recording status must remain independently inspectable.');
if(atLeast(2,0,41)){
  const screenPermissionBody=main.match(/async function requestScreenPermission\(\)\{([\s\S]*?)\n\}/)?.[1]||'';
  requireText(screenPermissionBody,"detectedBy:reportedStatus==='granted'?'tcc-status':'tcc-advisory'",'Non-granted Screen Recording status must remain advisory.');
  requireText(screenPermissionBody,'ok:true','Explicit Share must not be hard-blocked by a stale Screen Recording status.');
  requireText(screenPermissionBody,'source enumeration is the authoritative test','Real desktop source enumeration must remain the permission authority.');
  rejectText(screenPermissionBody,'ok:false','requestScreenPermission must not reject an explicit Share action from advisory TCC state alone.');
  rejectText(main,'function activeScreenCaptureProbe()','Permission state checks must not run an active screen-capture probe.');
  rejectText(main,'screenPermissionProbeInFlight','Permission state checks must not keep hidden screen-enumeration probe state.');
  rejectText(main,'capture-probe-timeout','Permission state checks must not enumerate screens behind the permission gate.');
}else{
  requireText(main,'function activeScreenCaptureProbe()','Post-failure screen diagnostics are missing.');
  requireText(main,'screenPermissionProbeInFlight','Post-failure screen diagnostics must remain single-flight.');
  requireText(main,'capture-probe-timeout','Post-failure screen diagnostics must remain bounded.');
}
requireText(service,"const systemPickerAvailable=platform==='darwin'&&macMajor>=15",'macOS picker capability diagnostics are missing.');
requireText(service,'const nativeSystemPicker=false','The rejected Apple system picker must be disabled in the active share path.');
requireText(service,'function configureDisplayMediaHandler(useSystemPicker)','Display-media handler authority is missing.');
requireText(service,'configureDisplayMediaHandler(false);','DominionStar chooser must initialize the custom display-media handler.');
requireText(service,"ipcMain.handle('share:list-sources',async(_event,options={})=>{configureDisplayMediaHandler(false);pendingSelection=null;",'Opening the approved chooser must reset stale selection and force custom capture mode.');
requireText(service,"ipcMain.handle('share:select-source',(_event,{sourceId,options={}}={})=>{configureDisplayMediaHandler(false);",'Committing a source must force custom capture mode before getDisplayMedia.');
requireText(service,"return {ok:true,nativeSystemPicker:false,options:normalizedOptions}",'Selected sources must explicitly remain on the DominionStar picker path while returning the effective capture options.');
requireText(integration,"const SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'",'Successful screen-capture proof must remain session-scoped.');
requireText(integration,'async function grantedScreenPermission()','Granted Screen Recording helper is missing.');
rejectText(integration,'bridge?.probeAccess?.()','Initial Share must not enumerate desktop sources as a permission probe.');
requireText(integration,"const permission=proven?'granted':'unknown';",'Initial Share must distinguish proven/granted from unknown permission.');
requireText(integration,'const result=await bridge.openPicker(permission);','Permission mode must be passed to the picker authority.');
const pickerCall=integration.indexOf('const result=await bridge.openPicker(permission);');
const diagnosticCall=integration.indexOf('desktop?.media?.requestScreen?.()');
assert.ok(pickerCall>=0&&diagnosticCall>pickerCall,'Deep Screen Recording diagnostics must run only after picker/capture failure.');

// Zoom-familiar working-only pre-share chooser.
requireText(service,"types:[kind]",'Source authority must enumerate the selected source class only.');
requireText(service,"thumbnailSize:{width:320,height:180}",'Source previews must remain bounded.');
requireText(service,"!/DominionStar Meet/i.test",'DominionStar windows must remain excluded from normal sharing.');
requireText(picker,"kind:'screen'",'Screens view is missing real desktop sources.');
requireText(picker,"kind:'window'",'Screens view is missing real application windows.');
requireText(picker,'const next=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]','Screens view must merge screens and application windows.');
requireText(picker,"const firstScreen=sources.find",'Screens view must prefer a desktop selection by default.');
requireText(picker,'source.thumbnail','Share chooser must render real source previews.');
requireText(picker,'selectedId=String(remembered?.id||firstScreen?.id||sources[0]?.id||\'\')','Preview refresh must preserve the selected source when possible.');
if(atLeast(2,0,41)){
  // 2.0.41 is governed by the supplied screenshot reference. It supersedes
  // the earlier Basic / Advanced labels without weakening the actual source,
  // capture, or disabled-capability requirements above and below.
  requireText(pickerHtml,'data-tab="screens">Screens','2.0.41+ chooser is missing the approved Screens tab.');
  requireText(pickerHtml,'data-tab="files" aria-disabled="true"','2.0.41+ chooser must retain Files as a truthful disabled reference position.');
  requireText(pickerHtml,'data-tab="advanced">More','2.0.41+ chooser is missing the approved More tab.');
  requireText(pickerHtml,'Presenter layout','2.0.41+ chooser is missing Presenter layout.');
  requireText(pickerHtml,'Share DominionStar Meet windows','2.0.41+ More/share-options authority is missing meeting-window visibility.');
  requireText(pickerCss,'grid-template-columns:repeat(3,minmax(150px,1fr))','2.0.41+ source gallery must retain the approved three-column desktop geometry.');
  requireText(pickerCss,'.tab.active{background:#3e4b58;color:#fff}','2.0.41+ active share tab must retain the screenshot-reference selected state.');
}else{
  requireText(pickerHtml,'data-tab="screens">Basic','Share chooser is missing the Zoom-familiar Basic source tab.');
  requireText(pickerHtml,'data-tab="advanced">Advanced','Share chooser is missing Advanced.');
  rejectText(pickerHtml,'data-tab="files"','Share chooser must not expose dead Files/cloud controls before the 2.0.41 reference supersession.');
  requireText(pickerHtml,'Show DominionStar Meet windows','Advanced must expose the intentional meeting-window visibility setting.');
  requireText(pickerCss,'grid-template-columns:repeat(auto-fill,minmax(170px,1fr))','Screens view must retain dense responsive source tiles.');
  requireText(pickerCss,'.tab.active{color:#fff;border-bottom-color:var(--blue)','Active share tab must retain the Zoom-style underline.');
}
requireText(pickerHtml,'Share sound','Share chooser is missing Share sound.');
requireText(pickerHtml,'Optimize for video sharing','Share chooser is missing video optimization.');
requireText(pickerHtml,'Refresh automatically','Advanced/More must expose bounded live preview refresh.');

// Capture stays single-owner, cannot hang forever, and preserves Pause/Resume.
assert.ok((controller.match(/getDisplayMedia/g)||[]).length>=2,'ShareController must remain the only display-capture owner.');
const directDisplay=/\.getDisplayMedia\s*\(/;
assert.ok(!directDisplay.test(integration)&&!directDisplay.test(preload)&&!directDisplay.test(picker),'Integration/preload/picker must not acquire display media directly.');
requireText(controller,'let displayRequestGeneration=0','Display capture must own a cancellable generation authority.');
requireText(controller,"error.code='share_start_timeout'",'Share acquisition must fail visibly instead of loading forever.');
requireText(controller,'},5000);','Share-start timeout must be bounded to five seconds.');
requireText(controller,'void capturePromise.then(lateStream=>stopTracks(lateStream)).catch(()=>{})','Late capture completion after a timeout must be physically stopped.');
requireText(controller,'displayRequestGeneration+=1;const hadShare','Stop Share must cancel any in-flight display request generation.');
requireText(controller,'async function captureFreezeFrame(videoElement)','Pause must own direct capture-frame freezing.');
requireText(controller,"typeof ImageCapture==='function'",'Pause must prefer direct ImageCapture frame acquisition when no preview is attached.');
requireText(controller,"typeof MediaStreamTrackProcessor==='function'",'Pause must retain a direct track-processor fallback.');
requireText(controller,'context.drawImage(captured.source,0,0,captured.width,captured.height)','Pause must draw the captured display frame into the frozen stream.');
requireText(controller,'canvas.captureStream(1)','Pause must transmit a frozen frame rather than black video.');
requireText(controller,'stopTracks(state.liveStream)','Stop Share must release capture tracks.');
requireText(controller,'async function replaceSource','New Share must remain transactional.');
requireText(annotation,'setAnnotationCanvas','Annotation must remain connected to the single ShareController.');
requireText(annotation,'drawLaser','Laser pointer support is missing.');
rejectText(controller,'rendererCommitted:true','ShareController must not own meeting visibility or presenter commit.');

// Re-entrancy guard.
requireText(controller,'if(state.annotationCanvas===next)','ShareController must suppress unchanged annotation-canvas emissions.');
requireText(controller,'if(next&&state.liveStream&&!state.compositeStream)startComposite();','Idempotent annotation guard must still recover a missing active composite stream.');
requireText(annotation,'const controllerAnnotating=Boolean(controller?.snapshot?.().annotating);','Annotation teardown must inspect real controller annotation state.');
requireText(annotation,'if(controllerAnnotating)controller?.setAnnotationCanvas?.(null);','Annotation teardown must clear the controller only when annotation is actually attached.');
rejectText(annotation,'share()?.setAnnotationCanvas?.(null)','Annotation deactivate must not unconditionally feed an unchanged null canvas back into ShareController.');

// Critical physical-Mac repair: capture-start notification itself is one-way.
requireText(preload,"captureStarted:state=>{ipcRenderer.send('share:capture-started',state||{});return true;}",'Capture start must cross the preload bridge as one-way IPC.');
rejectText(preload,"captureStarted:state=>invoke('share:capture-started'",'Capture start must not use request/response IPC.');
const captureStarted=service.slice(
  service.indexOf("ipcMain.on('share:capture-started'"),
  service.indexOf("ipcMain.handle('share:capture-state'")
);
requireText(captureStarted,"ipcMain.on('share:capture-started'",'Main process must receive capture start as one-way IPC.');
requireText(captureStarted,'event.sender!==main.webContents','Capture start must accept only the main meeting renderer.');
requireText(captureStarted,'keepMeetingRendererLive();','Capture start must disable renderer throttling before presenter work begins.');
requireText(captureStarted,'showShareBorder(activeDisplayId);','macOS capture start must mount one full-display share perimeter.');
requireText(captureStarted,'scheduleToolbarForShare();','Capture start must schedule the real external presenter toolbar on macOS and other desktop platforms.');
rejectText(captureStarted,'openToolbar(','Capture start must defer presenter BrowserWindow creation through the scheduler rather than load it synchronously.');
rejectText(captureStarted,'hideMeetingWindowForShare()','Capture start must not synchronously hide/restore meeting chrome after capture begins.');
rejectText(captureStarted,'return {ok:','Capture start must not expose a response contract.');

requireText(service,'function scheduleToolbarForShare()','Presenter-control scheduler is missing.');
const scheduler=service.slice(
  service.indexOf('function scheduleToolbarForShare()'),
  service.indexOf('const displayMediaHandler')
);
rejectText(scheduler,"if(platform==='darwin'){toolbarReadyForShare=true",'macOS must not bypass the external presenter toolbar after physical toolbar failure.');
requireText(scheduler,'toolbarOpenTimer=setTimeout(async()=>','Presenter toolbar creation must remain deferred to a later main-process turn.');
requireText(scheduler,'const ready=await openToolbar();','Presenter scheduler must open the real interactive toolbar on macOS and other desktop platforms.');
requireText(scheduler,'},75);','Presenter toolbar deferral must remain explicit and bounded.');
requireText(scheduler,'toolbarReadyForShare=Boolean(ready)','Presenter toolbar readiness must be recorded independently from capture start.');
requireText(scheduler,"void sendPresenterCommand('stop',0)",'Toolbar creation failure must fail the share closed through presenter command authority.');
requireText(integration,"id='inlinePresenterToolbar'","macOS presenter controls must exist inside the share-owning renderer.");
requireText(integration,"data-inline-command=\"pause\"","Inline presenter controls must expose Pause/Resume.");
requireText(integration,"data-inline-command=\"stop\"","Inline presenter controls must expose Stop Share.");
requireText(integration,"window.dispatchEvent(new CustomEvent('dominion:presenter-command-dispatch'","Inline presenter actions must publish one observable command transaction.");

// Integration commits presenter mode only after the share promise returned and
// the actual shared stage has been mounted.
requireText(integration,'function commitPresenterMode()','Share Integration must own safe presenter commit.');
requireText(integration,'markCaptureProven();applyLayout();','Shared-stage layout must mount before presenter commit.');
requireText(integration,'commitPresenterMode();','Initial share must explicitly enter presenter mode after layout.');
requireText(integration,"const sameRendererPresenter=String(environment?.platform||'')==='darwin'",'macOS same-renderer presenter detection is missing.');
requireText(integration,"if(!sameRendererPresenter)bridge?.presenterCommitted?.(",'macOS presenter commit must stay inside the share-owning renderer while non-macOS keeps one-way main-process commit.');
requireText(preload,"presenterCommitted:state=>{ipcRenderer.send('share:presenter-committed',state||{});return true;}",'Non-macOS presenter commit bridge must remain one-way IPC.');
const presenterCommitted=service.slice(
  service.indexOf("ipcMain.on('share:presenter-committed'"),
  service.indexOf("ipcMain.handle('share:capture-stopped'")
);
requireText(presenterCommitted,'presenterCommitPending=true','Presenter commit must become the authority that unlocks presenter chrome.');
requireText(presenterCommitted,'if(!toolbarReadyForShare){scheduleToolbarForShare();return;}','Presenter toolbar creation must begin only after the renderer presenter commit arrives.');
requireText(presenterCommitted,'setImmediate(()=>','Meeting hide must happen on a later main-process turn once toolbar readiness is proven.');
requireText(presenterCommitted,'hideMeetingWindowForShare();','Committed presenter state must eventually hide the normal meeting.');
requireText(service,'function cancelToolbarOpen()','Deferred toolbar work must be cancellable on Stop Share.');
requireText(service,'cancelToolbarOpen();','Stop Share must cancel pending toolbar creation.');

// Toolbar window and companion controls must remain native/interactive.
requireText(service,'async function openToolbar()','Presenter toolbar loader is missing.');
requireText(service,"await created.loadFile(path.join(uiDir,'presenter-toolbar.html'))",'Presenter toolbar must load its real renderer.');
requireText(service,'acceptFirstMouse:true','Presenter toolbar must accept the first macOS click.');
requireText(service,'backgroundThrottling:false','Presenter toolbar must stay responsive.');
requireText(service,"setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true",'Presenter toolbar must remain visible across Spaces/full-screen apps.');
requireText(service,"setAlwaysOnTop(true,'floating')",'Presenter toolbar must remain above shared applications.');
requireText(toolbarJs,"const routedCommand=command=>String(command||'');",'Presenter toolbar must send exact working command names without dead toolbar-prefixed aliases.');
rejectText(toolbarJs,'toolbar:${command}','Presenter toolbar must not reintroduce dead toolbar-prefixed commands.');
requireText(service,"main.setBounds({x:-32000,y:-32000,width:saved.width,height:saved.height},false)",'macOS must park the protected DominionStar meeting window outside captured display content.');
requireText(service,"function showShareBorder(displayId='')",'macOS must own a native full-display share perimeter surface.');
requireText(service,'border:3px solid #31d074','Share perimeter must be one continuous green physical-display border.');
requireText(service,'closeShareBorder();','Stop Share must remove the physical-display perimeter.');
requireText(service,'restoreMainWindowAfterShare();','Stop Share must restore the same live meeting window directly.');
rejectText(service,"type:platform==='darwin'?'panel':undefined",'Unsupported macOS nonactivating panel type must not return.');
requireText(service,"['participants','chat','annotate'].includes(normalized)&&shareActive",'Share companions must be explicit presenter commands.');
requireText(service,'showCompanionWindow(normalized)','Chat/Participants/Annotation must use compact share companions.');
requireText(shareCss,'data-ds-share-companion="chat"','Chat share companion CSS is missing.');
requireText(shareCss,'data-ds-share-companion="participants"','Participants share companion CSS is missing.');
requireText(shareCss,'data-ds-share-companion="annotate"','Annotation share companion CSS is missing.');
requireText(service,"if(normalized==='stop'&&shareActive)",'Stop Share retry protection is missing.');
requireText(service,"showMeetingWindow({focus:false});void sendPresenterCommand('stop',0)",'Stop Share retry must wake the meeting renderer through the same presenter-command authority.');
requireText(toolbar,'data-command="stop"','Presenter toolbar is missing Stop Share.');
requireText(toolbar,'Stop Share','Presenter toolbar Stop Share label is missing.');
requireText(toolbarCss,'min-width:104px','Stop Share target is too small.');
requireText(toolbarJs,"if(command==='stop')",'Presenter toolbar lacks direct Stop Share click handling.');
requireText(toolbarJs,"label.textContent='Stopping…'",'Stop Share must provide immediate click feedback.');

requireText(mediaController,"script.src='./share-integration.js'",'Share Integration must remain isolated and loaded once.');
rejectText(integration,'showModal','Meeting Share must never use a blocking in-meeting modal.');

console.log('DOMINIONSTAR_SHARE_AUTHORITY_OK carried-forward-on='+pkg.version+' custom-only-preshare no-system-picker bounded-share-start zoom-screens-files-more real-desktop-window-grid single-owner-capture pause-freeze transactional-new-share idempotent-annotation-state one-way-capture-start share-companions first-click-presenter-controls direct-stop-share');
