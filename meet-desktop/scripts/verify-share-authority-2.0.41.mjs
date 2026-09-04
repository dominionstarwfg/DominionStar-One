import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createShareSourceAuthority } from '../src/share-source-authority.mjs';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
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

// Permission + picker authority: the DominionStar thumbnail chooser is the
// only active source-selection surface. macOS system-picker capability may be
// detected for diagnostics, but it must not own getDisplayMedia.
requireText(main,"systemPreferences.getMediaAccessStatus(kind)",'macOS TCC status authority is missing.');
requireText(main,"permissionStatus('screen')",'Screen Recording status must remain independently inspectable.');
requireText(main,'function activeScreenCaptureProbe()','Post-failure screen diagnostics are missing.');
requireText(main,'screenPermissionProbeInFlight','Post-failure screen diagnostics must remain single-flight.');
requireText(main,'capture-probe-timeout','Post-failure screen diagnostics must remain bounded.');
requireText(service,"const systemPickerAvailable=platform==='darwin'&&macMajor>=15",'macOS picker capability diagnostics are missing.');
requireText(service,'const nativeSystemPicker=false','The rejected Apple system picker must be disabled in the active share path.');
requireText(service,'function configureDisplayMediaHandler(useSystemPicker)','Display-media handler authority is missing.');
requireText(service,'configureDisplayMediaHandler(false);','DominionStar chooser must initialize the custom display-media handler.');
requireText(service,"ipcMain.handle('share:list-sources',async(_event,options={})=>{configureDisplayMediaHandler(false);pendingSelection=null;",'Opening the approved chooser must reset stale selection and force custom capture mode.');
requireText(service,"ipcMain.handle('share:select-source',(_event,{sourceId,options={}}={})=>{configureDisplayMediaHandler(false);",'Committing a source must force custom capture mode before getDisplayMedia.');
requireText(service,"return {ok:true,nativeSystemPicker:false}",'Selected sources must explicitly remain on the DominionStar picker path.');
requireText(integration,"const SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'",'Successful screen-capture proof must remain session-scoped.');
requireText(integration,'async function grantedScreenPermission()','Granted Screen Recording helper is missing.');
rejectText(integration,'bridge?.probeAccess?.()','Initial Share must not enumerate desktop sources as a permission probe.');
requireText(integration,"const permission=proven?'granted':'unknown';",'Initial Share must distinguish proven/granted from unknown permission.');
requireText(integration,'const result=await bridge.openPicker(permission);','Permission mode must be passed to the picker authority.');
const pickerCall=integration.indexOf('const result=await bridge.openPicker(permission);');
const diagnosticCall=integration.indexOf('desktop?.media?.requestScreen?.()');
assert.ok(pickerCall>=0&&diagnosticCall>pickerCall,'Deep Screen Recording diagnostics must run only after picker/capture failure.');

// 2.0.41 Zoom-reference pre-share chooser.
requireText(service,"types:[kind]",'Source authority must enumerate the selected source class only.');
requireText(service,"thumbnailSize:{width:320,height:180}",'Source previews must remain bounded.');
requireText(service,"!/DominionStar Meet/i.test",'DominionStar windows must remain excluded from normal sharing.');
requireText(picker,"kind:'screen'",'Screens view is missing real desktop sources.');
requireText(picker,"kind:'window'",'Screens view is missing real application windows.');
requireText(picker,'const next=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]','Screens view must merge screens and application windows.');
requireText(picker,"const firstScreen=sources.find",'Screens view must prefer a desktop selection by default.');
requireText(picker,'source.thumbnail','Share chooser must render real source previews.');
requireText(picker,'selectedId=String(remembered?.id||firstScreen?.id||sources[0]?.id||\'\')','Preview refresh must preserve the selected source when possible.');
requireText(pickerHtml,'data-tab="screens">Screens','Share chooser is missing the approved Screens tab.');
requireText(pickerHtml,'data-tab="files" aria-disabled="true"','Files must remain visibly reserved but truthfully disabled until certified.');
requireText(pickerHtml,'data-tab="advanced">More','Share chooser is missing the approved More tab.');
requireText(pickerHtml,'Presenter layout','Share chooser is missing Presenter layout.');
requireText(pickerHtml,'Content only','Presenter layout is missing Content only.');
requireText(pickerHtml,'As background','Presenter layout is missing As background.');
requireText(pickerHtml,'Over the shoulder','Presenter layout is missing Over the shoulder.');
requireText(pickerHtml,'Side by side','Presenter layout is missing Side by side.');
requireText(pickerHtml,'Share sound','Share chooser is missing Share sound.');
requireText(pickerHtml,'Optimize for video sharing','Share chooser is missing video optimization.');
requireText(pickerHtml,'Share DominionStar Meet windows','More must expose the intentional meeting-window visibility setting.');
requireText(pickerHtml,'Refresh automatically','More must expose bounded live preview refresh.');
requireText(pickerCss,'.source-section-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr))','Screens view must retain the approved application-window tile grid.');
requireText(pickerCss,'.source-section.screen-section .source-section-grid{grid-template-columns:minmax(180px,210px)}','Entire-screen source must retain its dedicated first-row geometry.');
requireText(pickerCss,'.tab.active{background:#3e4b58;color:#fff}','Active share tab must retain the approved segmented selection state.');

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
rejectText(captureStarted,'scheduleToolbarForShare();','Capture start must not schedule presenter BrowserWindow creation.');
rejectText(captureStarted,'openToolbar(','Capture start must never create/load presenter BrowserWindow.');
rejectText(captureStarted,'hideMeetingWindowForShare()','Capture start must never hide the meeting.');
rejectText(captureStarted,'return {ok:','Capture start must not expose a response contract.');

requireText(service,'function scheduleToolbarForShare()','Presenter-control scheduler is missing.');
const scheduler=service.slice(
  service.indexOf('function scheduleToolbarForShare()'),
  service.indexOf('const displayMediaHandler')
);
requireText(scheduler,"if(platform==='darwin')",'macOS presenter scheduling must have a dedicated same-renderer path.');
requireText(scheduler,'toolbarReadyForShare=true','macOS same-renderer presenter controls must be marked ready without a second BrowserWindow.');
requireText(scheduler,'presenterCommitPending=false','macOS presenter commit must not wait on another renderer.');
requireText(scheduler,'toolbarOpenTimer=setTimeout(async()=>','Non-macOS presenter toolbar must remain deferred to a later main-process turn.');
requireText(scheduler,'const ready=await openToolbar();','Non-macOS scheduler must retain the existing presenter toolbar path.');
requireText(scheduler,'},75);','Non-macOS presenter toolbar deferral must remain explicit and bounded.');
requireText(scheduler,'toolbarReadyForShare=Boolean(ready)','Non-macOS toolbar readiness must still be recorded independently from capture start.');
requireText(scheduler,"void sendPresenterCommand('stop',0)",'Non-macOS toolbar failure must fail the share closed through presenter command authority.');
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

console.log('DOMINIONSTAR_SHARE_AUTHORITY_2_0_41_OK custom-only-preshare no-system-picker bounded-share-start zoom-screens-files-more presenter-layout real-desktop-window-grid single-owner-capture pause-freeze transactional-new-share idempotent-annotation-state one-way-capture-start share-companions first-click-presenter-controls direct-stop-share');
