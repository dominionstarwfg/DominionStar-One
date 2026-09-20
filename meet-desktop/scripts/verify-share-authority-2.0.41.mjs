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
const webrtc=read('ui/webrtc-controller.js');
const integration=read('ui/share-integration.js');
const mediaController=read('ui/media-controller.js');
const toolbar=read('ui/presenter-toolbar.html');
const toolbarJs=read('ui/presenter-toolbar.js');
const toolbarCss=read('ui/presenter-toolbar.css');
const shareCss=read('ui/share.css');
const annotation=read('ui/share-annotation.js');
const meetingService=read('src/meeting-service.mjs');
const meetingParity=read('ui/meeting-parity.js');
const annotationPolicySql=read('sql/20260919_annotation_policy.sql');
const annotationNamesSql=read('sql/20260919_annotation_names.sql');
const remoteAnnotation=read('ui/remote-annotation.js');
const indexHtml=read('ui/index.html');
const preferences=read('ui/preferences.js');
const webrtcCss=read('ui/webrtc.css');
const runtimeAuthority=read('ui/share-runtime-authority-2.0.41.js');
const macOverlay=read('src/mac-share-presenter-overlay.mjs');

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
// only active source-selection surface. macOS TCC status is telemetry only:
// an explicit Share action must be allowed to test real source enumeration.
requireText(main,"systemPreferences.getMediaAccessStatus(kind)",'macOS TCC status telemetry is missing.');
const screenPermissionBody=main.match(/async function requestScreenPermission\(\)\{([\s\S]*?)\n\}/)?.[1]||'';
requireText(screenPermissionBody,"permissionStatus('screen')",'Screen Recording status must remain independently inspectable.');
requireText(screenPermissionBody,"detectedBy:reportedStatus==='granted'?'tcc-status':'tcc-advisory'",'Non-granted Screen Recording status must remain advisory.');
requireText(screenPermissionBody,'ok:true','Explicit Share must not be hard-blocked by a stale Screen Recording status.');
requireText(screenPermissionBody,'source enumeration is the authoritative test','Real desktop source enumeration must remain the permission authority.');
rejectText(screenPermissionBody,'ok:false','requestScreenPermission must not reject an explicit Share action from advisory TCC state alone.');
rejectText(main,'function activeScreenCaptureProbe()','Permission state checks must not run an active screen-capture probe.');
rejectText(main,'screenPermissionProbeInFlight','Permission state checks must not keep hidden screen-enumeration probe state.');
rejectText(main,'capture-probe-timeout','Permission state checks must not enumerate screens behind the permission gate.');
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
requireText(controller,'const previousFrozen=state.frozenStream;','Resume must preserve the frozen participant-facing stream during the handoff.');
requireText(controller,'await window.DominionWebRTCController?.syncLocalTracks?.()','Resume must wait for WebRTC sender replacement before ending the frozen frame.');
requireText(controller,'stopTracks(previousFrozen);','Resume must retire the frozen stream only after the live sender handoff.');
requireText(webrtc,"state.shareUnsub=window.DominionShareController?.onChange?.(()=>{void syncAllSenders();void announceShareState();})",'WebRTC must react to Pause/Resume share-stream changes and publish the authoritative share state.');
requireText(webrtc,'lanes[2]?.sender?.replaceTrack(screen)','WebRTC must replace the participant-facing screen sender when Pause/Resume changes the output stream.');
requireText(controller,'const previous={liveStream:state.liveStream,frozenStream:state.frozenStream,compositeStream:state.compositeStream};','Stop Share must retain the active participant-facing streams until sender detachment.');
requireText(controller,'await Promise.race([\n            syncSenders({strict:true})','Stop Share must detach participant screen senders with a bounded strict WebRTC sync.');
requireText(controller,'window.DominionWebRTCController?.announceShareStopped?.()','Stop Share must publish an explicit remote share-ended fallback.');
requireText(controller,'stopTracks(previous.compositeStream);stopTracks(previous.frozenStream);stopTracks(previous.liveStream);','Stop Share must physically release composite, frozen, and live capture tracks.');
const stopShareBlock=controller.slice(controller.indexOf('async function stop()'),controller.indexOf('const api=Object.freeze'));
assert.ok(stopShareBlock.indexOf('syncSenders({strict:true})')<stopShareBlock.indexOf('stopTracks(previous.compositeStream);stopTracks(previous.frozenStream);stopTracks(previous.liveStream);'),'Stop Share must detach participant screen senders before retiring old capture tracks.');
requireText(webrtc,"async function announceShareStopped(){return announceShareState(false);}",'Stop Share must signal remote viewers that screen sharing ended.');
requireText(webrtc,"if(signal.type==='share:state')",'Remote clients must consume explicit share-state fallback signalling.');
requireText(webrtc,'hideRemoteShare(remoteId);','Remote Stop Share handling must immediately leave the shared-content surface.');
requireText(integration,'window.DominionShareAnnotation?.resetForNewShare?.();clearCompanion();','Stop Share must clear persistent annotation overlays before returning to the meeting.');
requireText(controller,'async function replaceSource','New Share must remain transactional.');
requireText(controller,'const previous={','New Share must retain the complete old share state until replacement commit.');
requireText(controller,'compositeStream:state.compositeStream','New Share must retain the previous annotated/composited participant stream during replacement.');
requireText(controller,'let nextStream=null,transitionStarted=false,committed=false;','New Share must distinguish capture acquisition from an actual staged transition.');
requireText(controller,'transitionStarted=true;','New Share must not disturb the old share before replacement capture acquisition succeeds.');
requireText(controller,"if(typeof syncSenders!=='function')throw new Error('Screen-share transport is not ready to switch sources.')",'New Share must refuse to retire the old share without an authoritative WebRTC sender sync path.');
requireText(controller,'await syncSenders({strict:true});','New Share must commit the replacement track through strict WebRTC sender synchronization.');
requireText(controller,'stopTracks(previous.compositeStream);stopTracks(previous.frozenStream);stopTracks(previous.liveStream);','New Share may retire old participant-facing tracks only after replacement commit.');
requireText(controller,'if(!committed&&transitionStarted)','New Share rollback must only rebuild old state after replacement state was actually staged.');
requireText(controller,'else if(!committed){\n        stopTracks(nextStream);','Cancelled or denied New Share acquisition must leave the existing share untouched.');
requireText(webrtc,'async function syncAllSenders({strict=false}={})','WebRTC must support a strict sender-sync mode for transactional source switching.');
requireText(webrtc,'if(strict&&failures.length)throw failures[0];','Strict New Share synchronization must fail when any current sender cannot replace its track.');
requireText(webrtc,'syncLocalTracks:options=>syncAllSenders(options||{})','New Share must expose strict sender synchronization through the WebRTC controller.');
requireText(annotation,'function resetForNewShare()','A committed New Share must have an explicit annotation reset path.');
requireText(integration,"await share.replaceSource({name:selection?.name,options:selectionOptions});window.DominionShareAnnotation?.resetForNewShare?.();",'Annotations must clear only after the replacement source commits successfully.');
const newShareBlock=controller.slice(controller.indexOf('async function replaceSource'),controller.indexOf('async function captureFreezeFrame'));
assert.ok(newShareBlock.indexOf('await syncSenders({strict:true});')<newShareBlock.indexOf('stopTracks(previous.compositeStream);stopTracks(previous.frozenStream);stopTracks(previous.liveStream);'),'New Share must never stop the old participant-facing tracks before strict sender replacement completes.');

requireText(annotation,'setAnnotationCanvas','Annotation must remain connected to the single ShareController.');
requireText(annotation,'drawLaser','Laser pointer support is missing.');
requireText(annotation,'data-annotation-mode="text"','Annotation must expose a real Text tool.');
requireText(annotation,'data-annotation-redo disabled','Annotation must expose Redo alongside Undo.');
requireText(annotation,'data-annotation-mode="arrow"','Annotation must expose arrow and shape tools.');
requireText(annotation,'data-annotation-mode="rect"','Annotation must expose rectangle drawing.');
requireText(annotation,'data-annotation-mode="ellipse"','Annotation must expose ellipse drawing.');
requireText(annotation,'data-annotation-mode="check"','Annotation must expose stamp tools.');
requireText(annotation,'data-annotation-mode="star"','Annotation must expose stamp tools.');
requireText(annotation,'data-annotation-width','Annotation Format must control line width.');
requireText(annotation,'data-annotation-font-size','Annotation Format must control text size.');
requireText(annotation,'function drawShape(kind,start,end)','Annotation shape controls must render real canvas geometry.');
requireText(annotation,'function drawStamp(kind,at)','Annotation stamp controls must render real canvas marks.');
requireText(annotation,'data-annotation-mode="select">Select</button>','Presenter annotation toolbar must expose Select as a first-class tool.');
requireText(annotation,"localCanvas:null,localCtx:null,remoteCanvas:null,remoteCtx:null",'Presenter and participant annotations must live on separate canvas planes.');
requireText(annotation,'function beginSelectionTransform(event,handle)','Select must support moving and resizing presenter-owned annotations.');
requireText(annotation,"data-select-handle=\"nw\"",'Select must expose visible resize handles.');
requireText(annotation,"state.localCtx.clearRect(t.source.x,t.source.y,t.source.w,t.source.h)",'Selection transforms must move presenter annotation pixels rather than duplicating them.');
requireText(annotation,'drawSelectionBitmap(t.image,rect)','Selection resize must redraw the selected presenter annotation region at its new geometry.');
requireText(annotation,'if(state.mode===\'select\'&&(event.key===\'Backspace\'||event.key===\'Delete\'))','Select must support deleting the presenter\'s selected annotation region.');
requireText(annotation,'if(state.remoteCanvas)state.ctx.drawImage(state.remoteCanvas,0,0);','Participant annotations must remain separately composited while presenter selection changes only the local plane.');
requireText(controller,'async function exportImage()','Annotation save must export the participant-visible shared frame plus annotations.');
requireText(controller,"if(state.paused&&state.freezeCanvas)",'Annotation save during Pause must use the frozen participant-facing frame, not the presenter\'s private live screen.');
requireText(controller,"return output.toDataURL('image/png')",'Annotation export must produce a real PNG image payload.');
requireText(preload,"annotation:Object.freeze({save:payload=>invoke('annotation:save',payload||{})})",'Annotation saving must cross the isolated preload bridge.');
requireText(main,"ipcMain.handle('annotation:save'",'Main process must own native annotation file saving.');
requireText(main,"dialog.showSaveDialog",'Annotation save must use a native Save dialog.');
requireText(main,"printToPDF",'Annotation PDF export must render a real PDF instead of renaming PNG bytes.');
requireText(annotation,'data-annotation-save="png"','Annotation toolbar must expose PNG saving.');
requireText(annotation,'data-annotation-save="pdf"','Annotation toolbar must expose PDF saving.');
requireText(annotation,'controller.exportImage?.()','Annotation Save controls must invoke the real share-frame export path.');
requireText(annotationPolicySql,'annotation_enabled boolean not null default true','Database migration must persist meeting annotation enable policy.');
requireText(annotationPolicySql,'annotation_save_allowed boolean not null default true','Database migration must persist annotation-save policy.');
requireText(annotationPolicySql,'meet_v2_set_annotation_policy','Database migration must expose a host/co-host annotation policy RPC.');
requireText(annotationPolicySql,"'annotationEnabled',v_room.annotation_enabled",'Room snapshot must publish annotation enable state.');
requireText(annotationPolicySql,"'annotationSaveAllowed',v_room.annotation_save_allowed",'Room snapshot must publish annotation save state.');
requireText(meetingService,"meet_v2_set_annotation_policy",'Meeting service must call the annotation policy RPC.');
requireText(preload,"setAnnotationPolicy:(roomId,options)=>invoke('meeting:set-annotation-policy'",'Preload must expose annotation policy changes through isolated IPC.');
requireText(main,"ipcMain.handle('meeting:set-annotation-policy'",'Main process must route host annotation policy changes.');
requireText(meetingParity,'data-security-annotation','Security menu must expose annotation enable/disable control.');
requireText(meetingParity,'data-security-annotation-save','Security menu must expose annotation save permission control.');
requireText(meetingParity,'desktop.meeting.setAnnotationPolicy','Security menu controls must persist to the meeting service.');
rejectText(integration,"if(!policy.enabled){toast('Annotation is disabled for this meeting.'",'Participant annotation policy must not disable the presenter\'s own annotation tools.');
requireText(main,"if(policy?.annotationSaveAllowed===false)throw new Error('Saving annotations is disabled by the host.')",'Native annotation saving must enforce host save policy in the main process.');
requireText(annotationNamesSql,'annotation_names_visible boolean not null default true','Database migration must persist annotator-name visibility.');
requireText(annotationNamesSql,'meet_v2_set_annotation_names','Database migration must expose annotator-name host control.');
requireText(annotationNamesSql,"'annotationNamesVisible',v_room.annotation_names_visible",'Room snapshot must publish annotator-name visibility.');
requireText(meetingService,"meet_v2_set_annotation_names",'Meeting service must persist annotator-name visibility.');
requireText(preload,"setAnnotationNames:(roomId,showNames)=>invoke('meeting:set-annotation-names'",'Preload must expose annotator-name visibility through isolated IPC.');
requireText(main,"ipcMain.handle('meeting:set-annotation-names'",'Main process must route annotator-name visibility changes.');
requireText(meetingParity,'data-security-annotation-names','Security menu must expose Show names of annotators.');
requireText(meetingParity,'Allow participants to annotate','Security menu must describe participant annotation scope accurately.');
requireText(webrtc,"String(signal.type||'').startsWith('annotation:')",'WebRTC signalling must route collaborative annotation messages.');
requireText(indexHtml,'<script src="./remote-annotation.js"></script>','Meeting shell must load the viewer annotation runtime.');
requireText(remoteAnnotation,"meeting.sendSignal(target,type,payload)",'Viewer annotations must be sent to the active sharer over meeting signalling.');
requireText(remoteAnnotation,"'annotation:stroke'",'Viewer annotation runtime must transmit draw/highlight/erase strokes.');
requireText(remoteAnnotation,"'annotation:text'",'Viewer annotation runtime must transmit text annotations.');
requireText(remoteAnnotation,"snap?.annotationEnabled!==false",'Viewer annotation entry must honor the host participant-annotation policy.');
requireText(annotation,"type==='annotation:stroke'",'Sharer annotation engine must receive participant stroke events.');
requireText(annotation,"type==='annotation:text'",'Sharer annotation engine must receive participant text events.');
requireText(annotation,'snapshot?.annotationNamesVisible!==false','Sharer must honor Show names of annotators.');
requireText(annotation,'showAnnotatorName(fromName','Sharer must display participant identity beside collaborative annotations when enabled.');
requireText(annotation,'title="Spotlight / laser pointer">Spotlight</button>','Annotation must expose Zoom-familiar Spotlight naming for the laser pointer.');
requireText(annotation,'function beginText(event)','Text annotation must create an editable text entry surface.');
requireText(annotation,"if(event.shiftKey)redo();else undo();",'Annotation must support Zoom-style undo/redo keyboard shortcuts.');
rejectText(controller,'rendererCommitted:true','ShareController must not own meeting visibility or presenter commit.');

// Re-entrancy guard.
requireText(controller,'if(state.annotationCanvas===next)','ShareController must suppress unchanged annotation-canvas emissions.');
requireText(controller,'if(next&&state.liveStream&&!state.compositeStream)startComposite();','Idempotent annotation guard must still recover a missing active composite stream.');
requireText(annotation,'const controllerAnnotating=Boolean(controller?.snapshot?.().annotating);','Annotation teardown must inspect real controller annotation state.');
requireText(annotation,'const localAnnotations=hasLocalAnnotations(),persistent=localAnnotations||state.hasRemoteAnnotations;','Presenter annotation teardown must preserve both local and remote annotation content after the tool palette closes.');
requireText(annotation,'if(controllerAnnotating&&!persistent)controller?.setAnnotationCanvas?.(null);','Annotation canvas must detach only when no persistent annotation content remains.');
requireText(annotation,"state.overlay.classList.toggle('persist-visible',persistent)",'Closing annotation tools must leave existing annotation content visible instead of erasing it.');
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
requireText(integration,"try{bridge?.presenterCommitted?.(",'Presenter commit must notify native/main-process presenter authority on every platform after capture is live.');
rejectText(integration,"if(!sameRendererPresenter)bridge?.presenterCommitted?.(",'macOS must not suppress the native presenter handoff after live capture.');
requireText(integration,'inlinePresenter.hidden=!state.active||sameRendererPresenter','macOS must hide the in-meeting presenter toolbar once sharing is active so only protected native presenter chrome remains local.');
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
requireText(controller,'async function setOptimizeVideo(enabled)','Active-share Optimize for video must be a real controller operation.');
requireText(controller,"track.contentHint=next?'motion':'detail'",'Optimize for video must change capture content hint while sharing.');
requireText(controller,"track.applyConstraints?.(next",'Optimize for video must change active capture constraints while sharing.');
requireText(controller,'async function setShareAudioEnabled(enabled,{mode}={})','Share Sound must be independently toggleable while presenting.');
requireText(controller,"error.code='share_audio_recapture_required'",'Enabling Share Sound without an audio track must request a transactional recapture instead of faking success.');
requireText(controller,'async function setShareAudioMode(mode)','Share Sound Mono/Stereo must be an active controller setting.');
requireText(webrtc,"shareState.options?.shareAudio!==false?(share?.getAudioTracks?.()[0]||null):null",'Disabling Share Sound must detach the participant-facing system-audio sender.');
requireText(webrtc,"shareState.options?.shareAudioMode==='stereo'?192000:96000",'Mono/Stereo mode must change outgoing share-audio bitrate.');
requireText(integration,"if(command==='share-sound')",'Presenter toolbar Share Sound must execute in the live meeting renderer.');
requireText(integration,"if(command==='optimize-video')",'Presenter toolbar Optimize for video must execute in the live meeting renderer.');
requireText(integration,'pickerBridge.choose(sourceId,options)','Enabling Share Sound on a capture without system audio must reacquire the same source transactionally.');
requireText(integration,"sourceId:String(selection?.sourceId||selection?.options?.sourceId||'')",'Selected source identity must survive into active-share option changes.');
requireText(toolbar,'data-command="share-sound"','Presenter More menu must expose Share Sound.');
requireText(toolbar,'data-command="optimize-video"','Presenter More menu must expose Optimize for video sharing.');
requireText(controller,"width:{ideal:1920,max:1920},height:{ideal:1080,max:1080}",'Optimize for video must bound capture to 1080p while prioritizing motion.');
requireText(controller,"? {frameRate:{ideal:30,max:30},width:{ideal:1920,max:1920},height:{ideal:1080,max:1080}}",'Optimized capture must target 30fps at up to 1080p.');
requireText(preferences,"shareScaleToFit:'ds_pref_share_scale_to_fit'",'Share settings must persist Scale to fit content.');
requireText(preferences,"shareEnterFullScreen:'ds_pref_share_enter_fullscreen'",'Share settings must persist Enter full screen when viewing shared content.');
requireText(preferences,"shareGreenBorder:'ds_pref_share_green_border'",'Share settings must persist the presenter green-boundary preference.');
requireText(preferences,"'Scale shared content to fit my window'",'Sharing settings must expose Scale shared content to fit my window.');
requireText(preferences,"'Enter full screen when viewing shared content'",'Sharing settings must expose full-screen-on-share behavior.');
requireText(preferences,"'Show green border around my shared content'",'Sharing settings must expose the green sharing boundary.');
requireText(runtimeAuthority,"showGreenBorder:pref('ds_pref_share_green_border',true)",'The approved picker must carry the green-boundary preference into the selected capture.');
requireText(service,"showGreenBorder:options.showGreenBorder!==false",'Main-process source selection must preserve the green-boundary setting.');
requireText(macOverlay,"if(isDisplayShare()&&shareState.showGreenBorder!==false)showBorder();else hideBorder();",'macOS presenter chrome must honor the green-boundary preference only for full display sharing.');
requireText(webrtc,"const payload={active,sourceName:String(shareState.sourceName||''),optimizeVideo:Boolean(shareState.options?.optimizeVideo),shareAudio:Boolean(shareState.options?.shareAudio)}",'Sharers must publish active-share quality metadata to viewers.');
requireText(webrtc,"async function enterRemoteShareFullscreen()",'Viewer transport must support the full-screen-on-share preference.');
requireText(webrtc,"readPreference('shareScaleToFit',true)",'Viewer transport must apply Scale to fit content.');
requireText(webrtc,"const green=optimized;",'Receiver-side green boundary must be forced by optimized-video mode rather than the presenter-only green-border preference.');
requireText(webrtcCss,'.remote-share-active.ds-share-scale-fit #remoteShareVideo','Viewer CSS must provide Scale-to-fit shared content.');
requireText(webrtcCss,'.remote-share-active.ds-share-original-size #remoteShareVideo','Viewer CSS must preserve an original-size shared-content mode.');
requireText(webrtcCss,'.remote-share-active.ds-remote-share-optimized #remoteShareVideo','Optimized shares must expose the Zoom-style receiver green boundary.');
rejectText(webrtcCss,'.remote-share-active #remoteShareVideo{\n  outline:2px','Remote shares must not force a green border for every standard share.');

requireText(mediaController,"script.src='./share-integration.js'",'Share Integration must remain isolated and loaded once.');
rejectText(integration,'showModal','Meeting Share must never use a blocking in-meeting modal.');

console.log('DOMINIONSTAR_SHARE_AUTHORITY_2_0_41_OK custom-only-preshare advisory-tcc-permission-check explicit-share-real-source-authority no-system-picker bounded-share-start zoom-screens-files-more presenter-layout real-desktop-window-grid single-owner-capture pause-freeze transactional-new-share idempotent-annotation-state one-way-capture-start share-companions first-click-presenter-controls direct-stop-share');
