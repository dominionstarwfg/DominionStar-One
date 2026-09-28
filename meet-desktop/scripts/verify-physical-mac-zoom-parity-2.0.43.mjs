import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const panelStability=read('ui/participant-panel-stability.css');
const adaptive=read('ui/zoom-adaptive-parity.js');
const polish=read('ui/zoom-production-polish.js');
const polishCss=read('ui/zoom-production-polish.css');
const screenshotJs=read('ui/zoom-screenshot-reference-2.0.41.js');
const screenshotCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const physical=read('ui/zoom-physical-acceptance.js');
const features=read('ui/meeting-features.js');
const parity=read('ui/meeting-parity.js');
const personal=read('ui/personal-room.js');
const personalCss=read('ui/personal-room.css');
const app=read('ui/app.js');
const main=read('src/main.mjs');
assert(main.includes("appendSwitch('disable-renderer-backgrounding')")&&main.includes("appendSwitch('disable-background-timer-throttling')")&&main.includes("appendSwitch('disable-backgrounding-occluded-windows')"),'Mac presenter mode must disable Chromium occlusion/background scheduling so the meeting control renderer remains responsive during active share.');

const media=read('ui/media-controller.js');
const legacyParticipants=read('ui/participants-center-lock-2.0.41.js');
const participantsReference=read('ui/zoom-participants-reference-2.0.41.js');
const legacyHostTools=read('ui/host-tools-separation-lock-2.0.41.js');
const legacyHostToolsCss=read('ui/host-tools-size-lock-2.0.41.css');
const indexHtml=read('ui/index.html');
const featureReady=read('ui/meeting-feature-ready-2.0.41.js');
const profileFallback=read('ui/profile-photo-fallback.js');
const shareService=read('src/share-service.mjs');
const shareController=read('ui/share-controller.js');
const shareAnnotation=read('ui/share-annotation.js');
const captureWorker=read('ui/share-capture-worker.js');
const capturePreload=read('src/share-capture-preload.cjs');
const macPresenter=read('src/mac-share-presenter-overlay.mjs');
assert(shareService.includes("partition:'dominion-share-capture-v2044'"),'Dedicated Mac capture worker must retain its isolated storage partition.');
assert(macPresenter.includes("partition:'dominion-presenter-toolbar-v2044'")&&macPresenter.includes("partition:'dominion-presenter-video-v2044'"),'Floating Mac presenter toolbar and video surfaces must run in storage partitions isolated from the meeting renderer.');
assert(macPresenter.includes('QA_MAC_PRESENTER_PROCESS_BOUNDARY'),'Mac presenter runtime must expose process-boundary proof for physical QA.');
const bootstrap=read('src/bootstrap.mjs');
const preload=read('src/preload.cjs');
const presenterPreload=read('src/presenter-preload.cjs');
const integration=read('ui/share-integration.js');
const preferences=read('ui/preferences.js');
const macVideoJs=read('ui/mac-share-video.js');
const macVideoHtml=read('ui/mac-share-video.html');
const macVideoCss=read('ui/mac-share-video.css');
const macAnnotationHtml=read('ui/mac-annotation-toolbar.html');
const macAnnotationJs=read('ui/mac-annotation-toolbar.js');
const macAnnotationCss=read('ui/mac-annotation-toolbar.css');
const screenshotReference=read('ui/zoom-screenshot-reference-2.0.41.js');
const screenshotReferenceCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const shareCss=read('ui/share.css');
const parityCss=read('ui/meeting-parity.css');
const shareRuntimeAuthority=read('ui/share-runtime-authority-2.0.41.js');
const macToolbarHtml=read('ui/mac-presenter-toolbar.html');

for(const source of [runtime,adaptive,polish,screenshotJs,physical,features,parity,personal,app,media,featureReady,profileFallback,shareController,shareAnnotation,captureWorker,shareRuntimeAuthority,participantsReference,macVideoJs,macAnnotationJs,integration,screenshotReference])new Function(source);

assert.equal(pkg.version,'2.0.44','Physical Mac runtime-control repair must ship as 2.0.44.');
assert(
  preferences.includes("const macLike=/Mac/i.test(String(navigator.platform||navigator.userAgent||''));") &&
  preferences.includes('if(macLike)return;') &&
  preferences.includes("window.DominionMeetingParity?.syncVideoDock?.();"),
  'Active Mac sharing must never let the periodic preference poller resync the legacy meeting video dock; the native presenter surface owns share-time video.'
);
assert(
  integration.includes('if(sameRendererPresenter&&replacing){') &&
  integration.includes("const entry=await resolveShareEntry('granted');") &&
  integration.includes("return entry.mode==='custom'||entry.mode==='native';"),
  'Active Mac New Share must open the dedicated source-picker window instead of re-entering the meeting-renderer picker authority.'
);
assert(
  shareService.includes("partition:'dominion-share-capture-v2044'") &&
  shareService.includes("getOSProcessId?.()") &&
  shareService.includes("capture_worker_process_not_isolated") &&
  shareService.includes("CAPTURE_PROCESS_BOUNDARY"),
  'The macOS capture worker must run in a separately verifiable renderer process and fail closed if Chromium coalesces it with the meeting renderer.'
);

assert(
  shareController.includes("const captureBridge=window.dominionDesktop?.shareCapture||null;") &&
  shareController.includes('return acquireMacWorkerDisplay(options,generation);') &&
  shareController.includes("throw new Error('Dedicated Mac screen-capture worker is unavailable.')") &&
  shareController.includes('macWorkerActive=true;') &&
  shareController.includes('if(macLike)return null;') &&
  !shareController.includes('const pc=new RTCPeerConnection({iceServers:[]});') &&
  captureWorker.includes('navigator.mediaDevices.getUserMedia({') &&
  captureWorker.includes("chromeMediaSource:'desktop'") &&
  captureWorker.includes('chromeMediaSourceId:sourceId') &&
  !captureWorker.includes('navigator.mediaDevices.getDisplayMedia(') &&
  !shareService.includes('win.webContents.session.setDisplayMediaRequestHandler') &&
  shareService.includes("sourceId:String(pendingSelection?.source?.id||payload?.sourceId||'')") &&
  !captureWorker.includes('RTCPeerConnection') &&
  !captureWorker.includes('createOffer(') &&
  !captureWorker.includes('addTrack(') &&
  captureWorker.includes("transport:'lifecycle-only'") &&
  preload.includes('shareCapture:Object.freeze({') &&
  preload.includes("ipcRenderer.send('share-capture:start-request'") &&
  preload.includes("ipcRenderer.on('share-capture:start-result'") &&
  preload.includes('start:payload=>startCaptureWorker(payload||{})') &&
  shareService.includes("ipcMain.on('share-capture:start-request'") &&
  shareService.includes("event.reply('share-capture:start-result'") &&
  !shareService.includes("ipcMain.handle('share-capture:start'"),
  'macOS display capture must remain owned by the dedicated capture renderer and use the event-driven start/result boundary without looping the live screen track back into the meeting/control renderer.'
);

assert(runtime.includes("side.dataset.zoomPanelMode='runtime'")&&runtime.includes("panel.dataset.zoomPanelMode='runtime'"),'Participants and Chat must use one runtime panel authority.');
assert(legacyParticipants.includes("version:'2.0.43-compatibility-no-geometry'")&&!legacyParticipants.includes('setInterval(')&&!legacyParticipants.includes('function centerPanel('),'Legacy Participants compatibility must never re-center or poll the live panel.');
assert(legacyHostTools.includes("version:'2.0.43-compatibility-no-geometry'")&&!legacyHostTools.includes('centerParticipantsOnce')&&!legacyHostTools.includes("host.style.setProperty('width','248px'"),'Legacy Host Tools compatibility must not own Participants or Host Tools geometry.');
assert(!legacyHostToolsCss.includes('248px!important')&&!legacyHostToolsCss.includes('.room-side:has(.ds-ref-host-tools-panel)'),'Legacy Host Tools stylesheet must not shrink Host Tools or move Participants.');
assert(runtime.includes("panel.style.setProperty('right','24px','important')")&&runtime.includes("panel.style.setProperty('top','54px','important')")&&runtime.includes("panel.style.setProperty('left','auto','important')"),'Default side surfaces must open as inset floating windows rather than edge-attached sidebars.');
assert(runtime.includes('function ensurePanelClose(panel)')&&runtime.includes("aria-label','Close participants'")&&runtime.includes("aria-label','Close chat'"),'Participants and Chat must expose one explicit runtime-owned Close control.');
assert(runtime.includes("const height=Math.min(520,Math.max(320,bodyHeight-96));")&&runtime.includes("panel.style.setProperty('right','24px','important');")&&runtime.includes("panel.style.setProperty('top','54px','important');")&&runtime.includes("overlay.dataset.dsRuntimeSide='floating';"),'Floating Participants and Chat must open inset from the screen edge with enough travel to behave as independent surfaces.');
assert(runtime.includes("panel.style.setProperty('left',`${pr.left-br.left}px`,'important');")&&runtime.includes("panel.style.setProperty('right','auto','important');")&&runtime.includes("panel.style.setProperty('width',`${pr.width}px`,'important');"),'Final drag authority must capture explicit panel geometry before movement rather than depending on a legacy handler.');
assert(runtime.includes("document.addEventListener('pointerdown',begin,true);")&&runtime.includes("document.addEventListener('mousedown',begin,true);")&&runtime.includes("document.addEventListener('pointermove',move,true);")&&runtime.includes("document.addEventListener('mousemove',move,true);")&&runtime.includes("const liveHandle=()=>")&&!runtime.includes("surfaceDrag.source!==source"),'Final floating-panel drag authority must capture pointer/mouse input at the document level and resolve the live panel header dynamically.');
assert(runtime.includes("const columns=count<=2?1:count<=6?2:3;")&&runtime.includes("const desiredWidth=columns*tileWidth")&&runtime.includes("dock.dataset.dsRuntimeColumns=String(columns)")&&runtime.includes("body.style.setProperty('grid-template-columns',`repeat(${columns},176px)`,'important')"),'Participant video dock must grow rows/columns automatically as visible participant tiles increase.');
assert(runtimeCss.includes('#meetingOverlay .ds-panel-traffic{display:none!important}')&&runtimeCss.includes('button[aria-label="Close participants"]')&&runtimeCss.includes('#meetingChatPanel [data-chat-close]'),'Floating Participants/Chat must suppress duplicate traffic controls and package one visible Close control.');
assert(runtimeCss.includes('position:fixed!important;\n  z-index:2800!important;')&&!runtimeCss.includes('left:18px!important;\n  right:auto!important;\n  top:auto!important;\n  bottom:94px!important;')&&!polishCss.includes('.meeting-reaction-menu{left:18px!important'),'Reaction chooser position must belong to the runtime anchor calculation, not a hard-pinned stylesheet.');

assert(adaptive.includes("if(window.DominionRuntimeStability?.layoutSideSurface){\n      side.dataset.dsAdaptiveInitialized='1';\n      window.DominionRuntimeStability.layoutSideSurface();")&&adaptive.includes('return;\n    }\n    installParticipantPanelDrag();'),'Adaptive Participants must stop immediately when final runtime geometry authority is available.');
assert(polish.includes('if(window.DominionRuntimeStability?.layoutSideSurface){window.DominionRuntimeStability.layoutSideSurface();return;}')&&polish.includes("menu.dataset.dsAnchorStable='1'"),'Production polish must stop rewriting panel and reaction geometry.');
assert(polish.includes("mode==='runtime'?'runtime':'docked'")&&polish.includes("participantPanelMode(side)==='docked'&&!event.target.closest('button')"),'Legacy participant pointer interception must recognize runtime-owned panels and stand down before final drag authority.');
assert(participantsReference.includes("if(window.DominionRuntimeStability?.layoutSideSurface)return;")&&runtime.includes("'DominionZoomParticipantsReference2041'")&&runtime.includes('window.DominionZoomParticipantsReference2041?.sync?.();'),'Participant reference may prime visual structure once but must defer geometry and retire its background reconciliation under the final runtime.');

assert(screenshotCss.includes('#prejoinOverlay #prejoinAvatar[hidden]{display:none!important}'),'Live prejoin video must never have the profile avatar painted over it.');
assert(screenshotCss.includes('.meeting-head .ds-meeting-brand{display:flex!important')&&screenshotCss.includes('.meeting-view-button{display:inline-flex!important'),'Meeting chrome must expose DominionStar branding and a clear View control.');
assert(screenshotCss.includes('.ds-ref-meeting-head-icons{display:none!important}')&&screenshotJs.includes("head.querySelector('.ds-ref-meeting-head-icons')?.remove()"),'Obsolete unexplained meeting-head glyph controls must be removed.');
assert(
  runtime.includes("initialHandle.style.cursor='grab'") &&
  !runtime.includes("delete side.dataset.dsRuntimeUserPositioned") &&
  !runtime.includes("delete panel.dataset.dsRuntimeUserPositioned") &&
  runtimeCss.includes('.room-side[data-ds-runtime-mode="floating"]') &&
  runtimeCss.includes('#meetingChatPanel[data-ds-runtime-mode="floating"]') &&
  runtimeCss.includes('cursor:grab!important') &&
  panelStability.includes('right:24px!important') &&
  panelStability.includes('top:54px!important'),
  'Participants and Chat must remain visibly floating, draggable, closable, and preserve user-positioned geometry across reopen.'
);
assert(screenshotCss.includes('.ds-ref-host-tools-panel{position:fixed;right:0;top:86px;bottom:68px;width:360px;')&&screenshotCss.includes('.ds-ref-host-tools-panel label{height:42px;'),'Host Tools must use the approved readable DominionStar panel scale.');

assert(physical.includes('function normalizeParticipantIdentity(row,id)')&&physical.includes("copy.querySelector('small')?.remove()")&&physical.includes("querySelectorAll('[data-participant-more],[data-ds-self-more],.ds-host-row-more')"),'Participant rows must collapse duplicate role labels and duplicate ellipsis controls to one canonical representation.');
assert(physical.includes("className='ds-canonical-role'")&&physical.includes("className='ds-canonical-self'"),'Participant identity must render one role badge and one self marker.');
assert(
  parity.includes('reaction-emoji-glyph') &&
  parity.includes('😊') &&
  physical.includes('reaction-emoji-glyph') &&
  physical.includes('😊') &&
  featureReady.includes('reaction-emoji-glyph') &&
  featureReady.includes('😊') &&
  parityCss.includes('.reaction-emoji-glyph'),
  'Reactions must remain an obvious emoji-style control through base, physical-acceptance and final-handoff reconciliation.'
);
assert(features.includes('r.left+r.width/2-width/2')&&features.includes('const top=Math.max(10,r.top-height-10)'),'Reaction chooser must open directly above its toolbar button.');

assert(personal.includes("passInput.value=String(state.room.passcode||'')")&&personal.includes('passInput.disabled=personal'),'Personal Meeting ID mode must not show a stale unrelated passcode.');
assert(personalCss.includes('#newMeetingDialog label[hidden]{display:none!important}'),'Hidden personal-room passcode field must remain visually hidden.');
assert(app.includes('const operation=media.setCamera(target);\n    syncMediaLabels();\n    attachPreview();\n    try{\n      await operation;attachPreview();syncMediaLabels();'),'Video button state and camera fallback must react before waiting for device acquisition.');
assert(media.includes('warmVideoTimer=setTimeout(releaseWarmVideo,1800)'),'Camera warm handoff must remain bounded while immediate UI intent provides responsive control feedback.');


assert(!indexHtml.includes('<script src="./share-integration.js"></script>')&&media.includes("script.src='./share-integration.js'")&&media.includes("script.dataset.dsShareIntegration='1'"),'Share integration must have one bootstrap authority owned by MediaController, with no competing static loader.');
assert(shareRuntimeAuthority.includes('async function waitForShareIntegration(timeoutMs=3000)')&&shareRuntimeAuthority.includes('if(!await waitForShareIntegration())'),'The final Share chooser must wait for the single Share integration bootstrap before source enumeration or commit.');
assert(featureReady.includes('#stageAvatar{width:196px!important;height:196px!important;border-radius:50%!important')&&read('ui/meeting-parity.css').includes('.stage-avatar{width:clamp(210px,20vmin,240px);height:clamp(210px,20vmin,240px);border-radius:50%}'),'Camera-off stage profile photos must remain prominently scaled after final reference handoff.');
assert(screenshotCss.includes('#prejoinOverlay #prejoinAvatar[hidden]{display:none!important}')&&read('ui/meeting-parity.css').includes('#prejoinAvatar.preview-avatar{width:196px;height:196px;border-radius:50%'),'Prejoin must hide its avatar over live video and use the enlarged camera-off profile scale.');
assert(screenshotCss.includes('#meetingOverlay .meeting-footer{height:64px!important;min-height:64px!important')&&screenshotCss.includes('#meetingOverlay .meeting-control{min-width:68px!important;height:58px!important')&&screenshotCss.includes('.meeting-control .ds-control-icon{width:24px!important;height:24px!important')&&screenshotCss.includes('.meeting-control .ds-control-label{font-size:11px!important'),'Final meeting toolbar must preserve readable control targets and icon/label scale instead of reverting to the undersized reference dimensions.');
assert(profileFallback.includes('width:88px;height:88px;border-radius:50%'),'Participant camera-off profile photos must no longer use the undersized 58px fallback.');
assert(featureReady.includes('box-shadow:none!important')&&read('ui/meeting-parity.css').includes('box-shadow:none!important'),'Mic/video off state must use one clean slash without the old doubled halo stripe.');
assert(!featureReady.includes('M18.8 3.1v3.6M17 4.9h3.6'),'Final meeting reconciliation must not restore the rejected legacy reaction glyph.');
assert(shareService.includes("return {ok:Boolean(sent),qaCommandId:Number(delivery?.qaCommandId||0),sent:Boolean(sent),direct:Boolean(delivery?.direct),handled:Boolean(delivery?.direct)}"),'Presenter command service must expose execution proof instead of a bare production ok response.');
const macToolbar=read('ui/mac-presenter-toolbar.js');
const macToolbarCss=read('ui/mac-presenter-toolbar.css');
assert(macToolbar.includes("if(nativeBridge?.command)return await sendNative(normalized);")&&macToolbar.includes("result.ok===true"),'Physical-Mac presenter controls must use the acknowledged native delivery path first, with renderer dispatch only as fallback.');
assert(
  shareService.includes('function closeLegacyMacPresenterWindows(){') &&
  shareService.includes("url.includes('/ui/presenter-toolbar.html')") &&
  shareService.includes("if(platform==='darwin'){closeLegacyMacPresenterWindows();closeToolbar();return true;}") &&
  shareService.includes('closeLegacyMacPresenterWindows();') &&
  read('ui/presenter-toolbar.js').includes("document.documentElement.style.display='none'"),
  'macOS must use exactly one presenter toolbar authority; every legacy presenter-toolbar window must be closed and the legacy renderer must self-disable on Mac.'
);
assert(
  integration.includes("inlinePresenter.hidden=true;") &&
  integration.includes("label.hidden=true;") &&
  integration.includes("sharedVideo.hidden=true;") &&
  integration.includes("cameraTile.hidden=true;") &&
  integration.includes("document.body.classList.add('ds-native-mac-presenter-share')") &&
  integration.includes("overlay.classList.remove('share-active','ds-ref-presenter-visible')"),
  'Active Mac sharing must hard-hide every renderer-owned share toolbar/status/video surface so only native presenter chrome is visible.'
);
assert(
  integration.includes("window.DominionShareAnnotation?.deactivate?.();") &&
  integration.includes("window.DominionRuntimeStability?.setParticipants?.(false);") &&
  integration.includes("window.DominionRuntimeStability?.setChat?.(false);"),
  'Participants, Chat and Annotate presenter commands must coordinate as mutually exclusive companion surfaces.'
);
assert(
  shareService.includes("includes('/ui/mac-share-video.html')") &&
  shareService.includes("includes('/ui/mac-presenter-toolbar.html')") &&
  shareService.includes("preferredRight=vb?Math.round(vb.x-width-gap)") &&
  shareService.includes("normalized==='annotate'"),
  'Mac companion geometry must avoid the presenter video/toolbar and Annotate must not resize the entire meeting BrowserWindow.'
);
assert(
  macVideoHtml.includes('id="videoMoreButton"') &&
  macVideoCss.includes('opacity:.88') &&
  macVideoHtml.includes('id="videoMoreMenu"') &&
  macVideoHtml.includes('id="videoMenuAudio"') &&
  macVideoHtml.includes('id="videoMenuCamera"') &&
  macVideoHtml.includes('id="videoMenuHide"') &&
  macVideoJs.includes("presenterCommand('audio')") &&
  macVideoJs.includes("presenterCommand('video')") &&
  macVideoJs.includes("presenterCommand('layout-hide')") &&
  macVideoCss.includes('.video-stage:hover .video-more-button'),
  'The floating presenter video must expose hover quick controls wired through acknowledged presenter commands.'
);
assert(
  main.includes("transparent:process.platform==='darwin'") &&
  main.includes("backgroundColor:process.platform==='darwin'?'#00000000':'#07111f'") &&
  integration.includes("document.body.classList.add('ds-native-mac-presenter-share')") &&
  screenshotReference.includes("const nativeMacPresenter=document.body.classList.contains('ds-native-mac-presenter-share')") &&
  screenshotReference.includes("q('.ds-ref-share-banner')?.remove()") &&
  shareCss.includes("body.ds-native-mac-presenter-share:not([data-ds-share-companion]):not(.ds-native-mac-show-meeting) #meetingOverlay>.meeting-shell") &&
  shareCss.includes('body.ds-native-mac-presenter-share #appShell') &&
  shareCss.includes('visibility:hidden!important;opacity:0!important;pointer-events:none!important') &&
  shareService.includes("const appShell=document.querySelector('#appShell')") &&
  shareService.includes("appShell.style.setProperty('visibility','hidden','important')") &&
  shareService.includes('setMacPresenterStealth(main,true)') &&
  shareService.includes('main.setWindowButtonVisibility?.(!enabled)') &&
  shareService.includes('main.setHasShadow?.(!enabled)'),
  'Native Mac sharing must keep the control renderer alive while making its meeting chrome, duplicate footer/banner, shadow and traffic lights physically disappear.'
);
assert(
  macAnnotationHtml.includes('data-command="annotate-pen"') &&
  macAnnotationHtml.includes('data-command="annotate-highlight"') &&
  macAnnotationHtml.includes('data-command="annotate-laser"') &&
  macAnnotationHtml.includes('data-command="annotate-erase"') &&
  macAnnotationHtml.includes('data-command="annotate-undo"') &&
  macAnnotationHtml.includes('data-command="annotate-clear"') &&
  macAnnotationHtml.includes('data-command="annotate-close"') &&
  macAnnotationHtml.includes('<svg viewBox="0 0 24 24"') &&
  macAnnotationCss.includes('background:linear-gradient(180deg') &&
  macAnnotationCss.includes('flex-direction:column') &&
  macAnnotationJs.includes("version:'2.0.44-left-vertical'") &&
  macPresenter.includes("partition:'dominion-presenter-annotation-v2044'") &&
  macPresenter.includes("path.join(uiDir,'mac-annotation-toolbar.html')") &&
  macPresenter.includes("String(shareState.companion||'')!=='annotate'") &&
  integration.includes("if(command.startsWith('annotate-'))"),
  'Annotate must use one independent vertical left-side native palette while the drawing engine remains authoritative in the meeting renderer.'
);
assert(
  screenshotReferenceCss.includes("#meetingOverlay:not(.ds-exec-lock) #roomMic.is-off>.ds-control-icon::after") &&
  screenshotReferenceCss.includes("body.ds-local-speaking #meetingOverlay:not(.ds-exec-lock) #roomMic:not(.is-off)>.ds-control-icon") &&
  featureReady.includes("#roomMic .ds-exec-icon::after") &&
  featureReady.includes("content:none!important;display:none!important") &&
  app.includes("node?.classList.toggle('is-off',!s.micOn)") &&
  app.includes("node?.classList.toggle('is-off',!s.cameraOn)"),
  'Local Audio/Video controls must have one authoritative off slash, no slash while live, and green microphone speaking feedback only from the real media state.'
);
assert(
  media.includes("voiceContext.state==='suspended'") &&
  media.includes("dominion:local-voice-level") &&
  preload.includes("voiceLevel:payload=>") &&
  preload.includes("ipcRenderer.send('mac-share:voice-level'") &&
  integration.includes("window.addEventListener('dominion:local-voice-level',forwardVoiceLevel)") &&
  integration.includes("bridge?.voiceLevel?.({level,speaking})") &&
  macPresenter.includes("ipcMain.on('mac-share:voice-level'") &&
  macPresenter.includes('voiceLevel:level,speaking') &&
  macToolbarHtml.includes('class="mic-live-meter"') &&
  macToolbar.includes("audioButton.dataset.voiceLevel=String(voiceBucket)") &&
  macToolbar.includes("audioButton?.classList.toggle('is-speaking',speaking)") &&
  macToolbarCss.includes('[data-command="audio"].is-speaking .mic-live-meter') &&
  macVideoHtml.includes('id="micState" class="mic-state"') &&
  macVideoJs.includes("mic.dataset.voiceLevel=String(voiceBucket)") &&
  macVideoJs.includes("mic.classList.toggle('speaking',speaking)") &&
  macVideoCss.includes('.mic-state[data-voice-level="3"]'),
  'Real microphone RMS must propagate from the authoritative meeting track into visible activity meters on both native Mac presenter surfaces.'
);
assert(preload.includes('const accepted=result?.handled===true;')&&!preload.includes('const accepted=result?.handled!==false;'),'Presenter preload must reject undefined/stale listener results instead of falsely acknowledging dead toolbar commands.');
assert(integration.includes("if(command==='stop'){clearCompanion();await share.stop();return {handled:true,command};}")&&!integration.includes("await share.stop();applyLayout();return {handled:true,command};"),'Stop Share must use one local-first state transition and rely on the synchronous share-state listener to restore meeting chrome.');
assert(
  integration.includes('if(sameRendererPresenter&&state.active){')&&
  integration.includes('return;')&&
  integration.includes('function publishMacPresenterState(){')&&
  integration.includes('if(sameRendererPresenter)publishMacPresenterState();else applyLayout();')&&
  integration.includes('media.onChange(()=>{if(!share.snapshot().active)return;if(sameRendererPresenter)return;applyLayout();});'),
  'Active Mac sharing must bypass meeting share-layout reconciliation and publish only command-specific presenter state.'
);
assert(!macToolbarHtml.includes('id="layoutButton"')&&!macToolbarHtml.includes('data-command="show-meeting"><span class="glyph"')&&macToolbarHtml.includes('<button type="button" data-command="show-meeting">Show meeting</button>'),'Presenter strip must expose only primary share controls while secondary layout/show-meeting actions live under More.');
assert(shareService.indexOf('closePicker();\n    if(platform===\'darwin\')parkMacMeetingWindow({preCapture:true});')>=0,'The share chooser must disappear before the Mac meeting window is parked for capture.');
assert(shareService.includes("displayId:String(source.display_id||'')")&&shareController.includes("displayId:String(state.options?.displayId||'')"),'The selected physical display identity must flow from source selection into presenter state.');
assert(
  macPresenter.includes('const BORDER_THICKNESS=4;')&&
  macPresenter.includes('const displayForSharedContent=()=>')&&
  macPresenter.includes('bordersReady=()=>borderWindows.length===1')&&
  macPresenter.includes('const display=displayForSharedContent(),bounds=display.bounds,win=borderWindows[0];')&&
  macPresenter.includes("backgroundColor:'#00000000'")&&
  macPresenter.includes('transparent:true')&&
  macPresenter.includes('body::before')&&
  macPresenter.includes('border:${BORDER_THICKNESS}px solid ${BORDER_COLOR}')&&
  macPresenter.includes("'screen-saver',2")&&
  macPresenter.includes("mac_share_perimeter_load")&&
  !macPresenter.includes("mac_share_border_edge_"),
  'The green presenter perimeter must be one continuous transparent full-display overlay so no segmented seams or inset edge windows remain.'
);
assert(
  shareAnnotation.includes('getCoalescedEvents')&&
  shareAnnotation.includes('quadraticCurveTo')&&
  shareAnnotation.includes('pointerrawupdate')&&
  shareAnnotation.includes('drawImage(state.canvas,0,0)')&&
  shareAnnotation.includes("version:'1.4.0-low-latency-smoothed-native-palette'")&&
  shareAnnotation.includes("state.canvas.style.touchAction='none'"),
  'Annotation pen input must use low-latency coalesced/raw pointer samples, lightweight history snapshots, and quadratic interpolation.'
);
assert(
  shareService.includes("const qaNoMacPark=qaPresenterTrace&&process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1';")&&
  shareService.includes('Do not perform any delayed')&&
  shareService.includes('cancelMacParkTimer();\n    const main=getMainWindow?.();keepMeetingRendererLive();setMacPresenterStealth(main,true);\n    return true;')&&
  shareService.includes('main.setWindowButtonVisibility?.(!enabled)')&&
  shareService.includes('main.setHasShadow?.(!enabled)')&&
  !shareService.includes('setTimeout(()=>{macParkTimer=null;if(shareActive)parkMacMeetingWindow({preCapture:false});')&&
  shareService.includes('main.setOpacity?.(1)')&&
  shareService.includes('try{main.blur?.();}catch{}')&&
  shareService.includes('Do not resize, move, minimize, hide or fade the meeting engine after')&&
  !shareService.includes('MAC_SENTINEL_WIDTH')&&
  !shareService.includes('MAC_SENTINEL_HEIGHT')&&
  !shareService.includes('MAC_PARK_COORDINATE=-32000')&&
  !shareService.includes('main.setOpacity?.(0.02)')&&
  !bootstrap.includes('originalSetOpacity.call(main,0.02)')&&
  !macPresenter.includes('main.setOpacity?.(0.02)'),
  'The meeting control renderer must keep stable on-display geometry after capture is isolated; resize, off-display, minimize and near-transparent parking are forbidden because they starve physical-Mac presenter commands.'
);

assert(app.includes("media.onChange?.(()=>{try{attachPreview();}catch{}});"),'All media mutations must repaint meeting AV state, including presenter-toolbar commands.');
assert(preload.includes("if(process.platform==='darwin')ipcRenderer.send('mac-share:state',state||{});return invoke('share:capture-state',state);"),'Mac share state must reach both native overlay and companion-window authorities.');
assert(presenterPreload.includes("environment:()=>invoke('app:get-environment')"),'Mac presenter surfaces must be able to detect certified QA runtime without loading the full meeting preload.');
assert(main.includes('qaPresenterFixtures:qaFixtureRequested')&&macVideoJs.includes('environment?.qaPresenterFixtures||environment?.qaInteractionFixtures'),'Packaged presenter QA must use an explicit fixture request without weakening production fixture gating.');
assert(
  integration.includes("cameraId:String(mediaState.cameraId||'')")&&
  integration.includes("mirror:mediaState.mirror!==false")&&
  integration.includes("const syncMacCameraFramePump=()=>{};")&&
  !integration.includes("canvas.toBlob(resolve,'image/jpeg'")&&
  !integration.includes("new Uint8Array(await blob.arrayBuffer())"),
  'The capture-owning renderer must publish camera state only; it must not encode presenter-preview frames while screen sharing.'
);
assert(
  macVideoHtml.includes('<video id="cameraPreview" class="camera-preview" autoplay muted playsinline hidden></video>')&&
  macVideoJs.includes("navigator.mediaDevices.getUserMedia({audio:false,video})")&&
  macVideoJs.includes("if(cameraId)video.deviceId={ideal:cameraId}")&&
  macVideoJs.includes("fallback.hidden=Boolean(cameraOn)")&&
  macVideoJs.includes("dock.dataset.videoOwner='presenter-device-preview'"),
  'The floating Mac presenter dock must own a low-rate live preview of the selected camera and reserve profile fallback strictly for camera-off state.'
);

console.log('DOMINIONSTAR_PHYSICAL_MAC_PARITY_2_0_44_OK detached-capture-worker acknowledged-presenter-dispatch hidden-meeting-renderer synchronized-media-ui dedicated-presenter-camera-preview continuous-full-display-perimeter low-latency-smoothed-annotation enlarged-profile-scale single-off-strike stable-right-panels mac-panel-controls canonical-participant-row');
