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
assert.equal(familyCalls,2,'Basic must enumerate screen and application-window families independently.');
assert.equal(familyAuthority.get('screen:one')?.id,'screen:one');
assert.equal(familyAuthority.get('window:one')?.id,'window:one');

// Permission authority: no desktop-source probe before the real capture request.
requireText(main,"systemPreferences.getMediaAccessStatus(kind)",'macOS TCC status authority is missing.');
requireText(main,"permissionStatus('screen')",'Screen Recording status must remain independently inspectable.');
requireText(main,'function activeScreenCaptureProbe()','Post-failure screen diagnostics are missing.');
requireText(main,'screenPermissionProbeInFlight','Post-failure screen diagnostics must remain single-flight.');
requireText(main,'capture-probe-timeout','Post-failure screen diagnostics must remain bounded.');
requireText(service,"const nativeSystemPicker=platform==='darwin'&&macMajor>=15",'Native macOS picker capability detection is missing.');
requireText(service,'function configureDisplayMediaHandler(useSystemPicker)','Dynamic native/custom display-media authority is missing.');
requireText(service,"if(nativeSystemPicker&&status!=='granted')",'Unknown/ungranted macOS sessions must retain native authorization.');
requireText(service,'configureDisplayMediaHandler(false)','Granted/proven sessions must switch to the DominionStar chooser.');
requireText(integration,"const SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'",'Successful screen-capture proof must persist across renderer relaunches.');
requireText(integration,'async function grantedScreenPermission()','Granted Screen Recording helper is missing.');
rejectText(integration,'bridge?.probeAccess?.()','Initial Share must not enumerate desktop sources as a permission probe.');
requireText(integration,"const permission=proven?'granted':'unknown';",'Initial Share must distinguish proven/granted from unknown permission.');
requireText(integration,'const result=await bridge.openPicker(permission);','Permission mode must be passed to the picker authority.');
requireText(integration,"if(result?.nativeSystemPicker)return {mode:'native'}",'Native first-authorization fallback is missing.');
const pickerCall=integration.indexOf('const result=await bridge.openPicker(permission);');
const diagnosticCall=integration.indexOf('desktop?.media?.requestScreen?.()');
assert.ok(pickerCall>=0&&diagnosticCall>pickerCall,'Deep Screen Recording diagnostics must run only after picker/capture failure.');

// Zoom-style pre-share chooser for already-proven/granted capture sessions.
requireText(service,"types:[kind]",'Source authority must enumerate the selected source class only.');
requireText(service,"thumbnailSize:{width:320,height:180}",'Source previews must remain bounded.');
requireText(service,"!/DominionStar Meet/i.test",'DominionStar windows must remain excluded from normal sharing.');
requireText(picker,"kind:'screen'",'Basic is missing real desktop sources.');
requireText(picker,"kind:'window'",'Basic is missing real application windows.');
requireText(picker,'basicSources=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]','Basic must merge screens and application windows.');
requireText(picker,"const firstScreen=basicSources.find",'Basic must prefer a desktop selection by default.');
requireText(picker,'source.thumbnail','Share chooser must render real source previews.');
requireText(pickerHtml,'data-tab="basic">Basic','Share chooser is missing Basic.');
requireText(pickerHtml,'data-tab="advanced">Advanced','Share chooser is missing Advanced.');
requireText(pickerHtml,'data-tab="files">Files','Share chooser is missing Files.');
requireText(pickerHtml,'Share sound','Share chooser is missing Share sound.');
requireText(pickerHtml,'Optimize for sharing video','Share chooser is missing video optimization.');
rejectText(pickerHtml,'Show DominionStar windows','Normal Share must not expose a recursion toggle.');
requireText(pickerCss,'grid-template-columns:repeat(4,minmax(0,1fr))','Basic must retain Zoom-density source tiles.');
requireText(pickerCss,'.tab.active{border-bottom-color:var(--blue)','Active share tab must retain the Zoom-style underline.');

// Capture stays single-owner and preserves Pause/Resume semantics.
assert.ok((controller.match(/getDisplayMedia/g)||[]).length>=2,'ShareController must remain the only display-capture owner.');
const directDisplay=/\.getDisplayMedia\s*\(/;
assert.ok(!directDisplay.test(integration)&&!directDisplay.test(preload)&&!directDisplay.test(picker),'Integration/preload/picker must not acquire display media directly.');
requireText(controller,'context.drawImage(videoElement,0,0,width,height)','Pause must freeze the last visible shared frame.');
requireText(controller,'canvas.captureStream(1)','Pause must transmit a frozen frame rather than black video.');
requireText(controller,'stopTracks(state.liveStream)','Stop Share must release capture tracks.');
requireText(controller,'async function replaceSource','New Share must remain transactional.');
requireText(annotation,'setAnnotationCanvas','Annotation must remain connected to the single ShareController.');
requireText(annotation,'drawLaser','Laser pointer support is missing.');
rejectText(controller,'rendererCommitted:true','ShareController must not own meeting visibility or presenter commit.');

// Critical physical-Mac repair: the renderer-owned captureStarted invoke MUST
// return before any presenter BrowserWindow is created or loaded. Creating the
// toolbar inside that invoke froze the meeting renderer on a real packaged Mac.
const captureStarted=service.slice(
  service.indexOf("ipcMain.handle('share:capture-started'"),
  service.indexOf("ipcMain.handle('share:capture-state'")
);
requireText(captureStarted,'scheduleToolbarForShare();','captureStarted must schedule presenter chrome after returning.');
requireText(captureStarted,'toolbarPending:true','captureStarted must report deferred toolbar creation.');
requireText(captureStarted,'meetingHidden:false','captureStarted must leave the meeting visible.');
requireText(captureStarted,'awaitingPresenterCommit:true','captureStarted must await the later presenter commit.');
requireText(captureStarted,'keepMeetingRendererLive();','captureStarted must disable renderer throttling before presenter work begins.');
rejectText(captureStarted,'openToolbar(','captureStarted must never create/load presenter BrowserWindow synchronously.');
rejectText(captureStarted,'hideMeetingWindowForShare()','captureStarted must never hide the meeting.');

requireText(service,'function scheduleToolbarForShare()','Deferred presenter-toolbar scheduler is missing.');
const scheduler=service.slice(
  service.indexOf('function scheduleToolbarForShare()'),
  service.indexOf('const displayMediaHandler')
);
requireText(scheduler,'toolbarOpenTimer=setTimeout(async()=>','Presenter toolbar must be created on a later main-process turn.');
requireText(scheduler,'const ready=await openToolbar();','Deferred scheduler must load the real presenter toolbar.');
requireText(scheduler,'},75);','Presenter toolbar deferral must remain explicit and bounded.');
requireText(scheduler,'toolbarReadyForShare=Boolean(ready)','Toolbar readiness must be recorded independently from capture start.');
requireText(scheduler,'if(presenterCommitPending)','Early presenter commit must wait for toolbar readiness.');
requireText(scheduler,"sendMain('share:presenter-command','stop')",'Toolbar failure must fail the share closed.');

// Integration commits presenter mode only after the share promise returned and
// the actual shared stage has been mounted. One-way IPC prevents hide from
// stranding any renderer promise.
requireText(integration,'function commitPresenterMode()','Share Integration must own safe presenter commit.');
requireText(integration,'markCaptureProven();applyLayout();','Shared-stage layout must mount before presenter commit.');
requireText(integration,'commitPresenterMode();','Initial share must explicitly enter presenter mode after layout.');
requireText(preload,"presenterCommitted:state=>{ipcRenderer.send('share:presenter-committed',state||{});return true;}",'Presenter commit must use one-way IPC.');
requireText(service,"ipcMain.on('share:presenter-committed'",'Main process must receive the one-way presenter commit.');
requireText(service,'presenterCommitPending=true','Presenter commit must survive arriving before toolbar readiness.');
requireText(service,'if(!toolbarReadyForShare)','Presenter commit must be gated on toolbar readiness.');
requireText(service,'setImmediate(()=>','Meeting hide must happen on a later main-process turn.');
requireText(service,'hideMeetingWindowForShare();','Presenter state must eventually hide the normal meeting.');
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
requireText(service,"showMeetingWindow({focus:false});sendMain('share:presenter-command','stop')",'Stop Share retry must wake the meeting renderer.');
requireText(toolbar,'data-command="stop"','Presenter toolbar is missing Stop Share.');
requireText(toolbar,'Stop Share','Presenter toolbar Stop Share label is missing.');
requireText(toolbarCss,'min-width:104px','Stop Share target is too small.');
requireText(toolbarJs,"if(command==='stop')",'Presenter toolbar lacks direct Stop Share click handling.');
requireText(toolbarJs,"label.textContent='Stopping…'",'Stop Share must provide immediate click feedback.');

requireText(mediaController,"script.src='./share-integration.js'",'Share Integration must remain isolated and loaded once.');
rejectText(integration,'showModal','Meeting Share must never use a blocking in-meeting modal.');

console.log('DOMINIONSTAR_SHARE_AUTHORITY_OK permission-aware-initial-share granted-custom-chooser native-unproven-fallback no-source-probe persistent-capture-proof zoom-basic-advanced-files real-desktop-and-window-grid single-owner-capture pause-freeze transactional-new-share capture-start-returns-before-toolbar deferred-presenter-window integration-owned-one-way-presenter-commit renderer-live-before-toolbar toolbar-fail-closed share-companions first-click-presenter-controls direct-stop-share');
