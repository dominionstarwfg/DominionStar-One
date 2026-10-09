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
const macToolbarHtml=read('ui/mac-presenter-toolbar.html');
const macToolbarCss=read('ui/mac-presenter-toolbar.css');
const macVideoCss=read('ui/mac-share-video.css');
assert(
  macPresenter.includes("function shouldShowVideoWindow(){return videoLayout!=='hide';}") &&
  macPresenter.includes('QA_MAC_PRESTART_STATE_CACHED participants=') &&
  macPresenter.includes('function raisePersistentPresenterSurfaces(){') &&
  macPresenter.includes("shareState={...shareState,...state};") &&
  screenshotJs.includes("const activeMacShare=()=>{") &&
  screenshotJs.includes("document.body.classList.contains('ds-native-mac-presenter-share')||activeMacShare()") &&
  screenshotJs.includes("if(nativeMacPresenter||activeMacShare()){toolbar.hidden=true"),
  'Approved Mac share behavior requires persistent presenter video from share start, cached pre-start media state, stable presenter z-order, and zero renderer share-layout fallback while the native share is active.'
);
assert(shareService.includes("partition:'dominion-share-capture-v2044'"),'Dedicated Mac capture worker must retain its isolated storage partition.');
const toolbarPartition=macPresenter.match(/partition:'(dominion-presenter-toolbar-[^']+)'/)?.[1],videoPartition=macPresenter.match(/partition:'(dominion-presenter-video-[^']+)'/)?.[1];
assert(toolbarPartition&&videoPartition&&toolbarPartition!==videoPartition,'Floating Mac presenter toolbar and video surfaces must run in distinct isolated storage partitions outside the meeting renderer.');
assert(macPresenter.includes('QA_MAC_PRESENTER_PROCESS_BOUNDARY'),'Mac presenter runtime must expose process-boundary proof for physical QA.');
assert(
  macPresenter.includes("function shouldShowVideoWindow(){return videoLayout!=='hide';}") &&
  macPresenter.includes("const participantCount=Math.max(1,Math.min(5,presenterParticipantCount()||1));") &&macPresenter.includes('const seen=new Set();')&&macPresenter.includes('return seen.size;') &&
  macPresenter.includes("if(videoLayout==='strip')height=Math.min(area.height-92,32+(participantCount*134)") &&
  macPresenter.includes("if(isAlive(videoWindow)&&shouldShowVideoWindow()){") &&
  !macPresenter.includes("function shouldShowVideoWindow(){return videoLayout!=='hide'&&presenterParticipantCount()>=1;}"),
  'Approved macOS share video must exist from share start unless explicitly hidden, use true one-person geometry, cap visible strip sizing at five participants, and remain independent of late roster publication.'
);
assert(
  macToolbarCss.includes('width:748px') &&
  macToolbarCss.includes('height:60px') &&
  macToolbarCss.includes('top:60px') &&
  macToolbarCss.includes('width:360px') &&
  macToolbarCss.includes('height:26px') &&
  macToolbarCss.includes('min-width:68px') &&
  macToolbarCss.includes('width:21px;height:21px') &&
  macToolbarCss.includes('background:#27c96b') &&
  macToolbarCss.includes('.toolbar.is-paused .share-strip{background:#f5b942') &&
  macToolbarCss.includes('.toolbar.auto-hidden .control-strip') &&
  macToolbarCss.includes('.toolbar.auto-hidden .share-strip{top:0') &&
  macToolbarHtml.includes('>Mute<') &&
  macToolbarHtml.includes('>Stop Video<') &&
  macToolbarHtml.includes('>Participants<') &&
  macToolbarHtml.includes('>Chat<') &&
  macToolbarHtml.includes('>Share<') &&
  macToolbarHtml.includes('>Pause Share<') &&
  macToolbarHtml.includes('>Layout<') &&
  macToolbarHtml.includes('>Annotate<') &&
  macToolbarHtml.includes('>Show meeting<') &&
  macToolbarHtml.includes('>More<') &&
  macToolbarHtml.includes('id="stopShareLabel">Stop Share<'),
  'Native presenter toolbar must preserve the Zoom-reference control order, longer toolbar geometry, shorter status strip below the controls, attached Stop Share, paused amber state and independent idle auto-hide.'
);
assert(
  parity.includes("const GEOMETRY_KEY='ds_zoom_video_dock_geometry_v3';")&&parity.includes("localStorage.removeItem('ds_zoom_video_dock_geometry_v2')")&&
  parity.includes("const PANEL_KEY='ds_zoom_participant_panel_geometry_v2';")&&
  runtime.includes("const centeredLeft=Math.max(12,(bodyWidth-width)/2);")&&
  runtime.includes("if(panel===participants){")&&
  macToolbarCss.includes('.more-menu{left:auto;right:-34px;transform:none;width:236px;padding:8px}'),
  'Physical layout defaults must reset stale dock/panel geometry, center Participants, keep the participant video dock right by default, and retain a readable presenter More menu.'
);
assert(
  participantsReference.includes('width:392px!important') &&
  participantsReference.includes('height:min(438px,calc(100% - 28px))!important') &&
  participantsReference.includes('height:48px!important') &&
  participantsReference.includes('font-size:14px!important') &&
  participantsReference.includes('flex:0 0 56px!important;height:56px!important') &&
  participantsReference.includes('grid-template-columns:1fr 1fr 1fr!important') &&
  macVideoCss.includes('height:132px') &&
  macVideoCss.includes('.video-stack.is-scrollable') &&
  macVideoCss.includes('grid-template-columns:repeat(2,minmax(0,1fr))') &&
  macVideoCss.includes('.video-tile:hover .video-tile-actions'),
  'Approved Participants and share-video surfaces must retain the 2.0.55 certified 392px / 48px / 14px participant geometry, fixed footer, five-tile scroll behavior, gallery geometry and hover intelligence.'
);
const bootstrap=read('src/bootstrap.mjs');
const preload=read('src/preload.cjs');
const presenterPreload=read('src/presenter-preload.cjs');
const integration=read('ui/share-integration.js');
const preferences=read('ui/preferences.js');
const macVideoJs=read('ui/mac-share-video.js');
const macVideoHtml=read('ui/mac-share-video.html');
const macAnnotationHtml=read('ui/mac-annotation-toolbar.html');
const macAnnotationJs=read('ui/mac-annotation-toolbar.js');
const macAnnotationCss=read('ui/mac-annotation-toolbar.css');
const macAnnotationCanvasHtml=read('ui/mac-annotation-canvas.html');
const macAnnotationCanvasJs=read('ui/mac-annotation-canvas.js');
const macAnnotationCanvasCss=read('ui/mac-annotation-canvas.css');
const screenshotReference=read('ui/zoom-screenshot-reference-2.0.41.js');
const screenshotReferenceCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const shareCss=read('ui/share.css');
const parityCss=read('ui/meeting-parity.css');
const webrtc=read('ui/webrtc-controller.js');
const shareRuntimeAuthority=read('ui/share-runtime-authority-2.0.41.js');
const activeShareHome=read('ui/active-share-home-parity-2.0.41.js');
const avSettings=read('ui/av-settings.js');

for(const source of [runtime,adaptive,polish,screenshotJs,physical,features,parity,personal,app,media,featureReady,profileFallback,shareController,shareAnnotation,captureWorker,shareRuntimeAuthority,activeShareHome,participantsReference,macVideoJs,macAnnotationJs,macAnnotationCanvasJs,integration,screenshotReference])new Function(source);

const [major,minor,patch]=String(pkg.version||'').split('.').map(Number); assert.ok(Number.isInteger(major)&&Number.isInteger(minor)&&Number.isInteger(patch)&&(major>2||(major===2&&(minor>0||(minor===0&&patch>=46)))),'Physical Mac runtime-control repair must remain certified for every 2.0.46+ candidate.');
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
  shareController.includes('const pc=new RTCPeerConnection({iceServers:[]}),stream=new MediaStream()') &&
  shareController.includes('captureBridge.onOffer?.(') &&
  shareController.includes('pc.ontrack=') &&
  shareController.includes('captureBridge.answer({generation:g,sdp:pc.localDescription})') &&
  shareController.includes('captureBridge.candidate({generation:macCaptureSignalGeneration,candidate:c})') &&
  captureWorker.includes('navigator.mediaDevices.getUserMedia({') &&
  captureWorker.includes("chromeMediaSource:'desktop'") &&
  captureWorker.includes('chromeMediaSourceId:sourceId') &&
  !captureWorker.includes('navigator.mediaDevices.getDisplayMedia(') &&
  captureWorker.includes('const pc=new RTCPeerConnection({iceServers:[]});') &&
  captureWorker.includes('for(const track of stream.getTracks())pc.addTrack(track,stream);') &&
  captureWorker.includes('const offer=await pc.createOffer();') &&
  captureWorker.includes("transport:'isolated-local-webrtc'") &&
  capturePreload.includes("offer:payload=>ipcRenderer.send('share-capture:offer'") &&
  capturePreload.includes("candidate:payload=>ipcRenderer.send('share-capture:worker-ice'") &&
  capturePreload.includes("onAnswer:callback=>listen('share-capture:answer'") &&
  capturePreload.includes("onCandidate:callback=>listen('share-capture:client-ice'") &&
  preload.includes('shareCapture:Object.freeze({') &&
  preload.includes("answer:payload=>invoke('share-capture:answer'") &&
  preload.includes("candidate:payload=>invoke('share-capture:client-ice'") &&
  preload.includes("onOffer:callback=>listen('share-capture:offer'") &&
  preload.includes("onCandidate:callback=>listen('share-capture:worker-ice'") &&
  shareService.includes("ipcMain.on('share-capture:start-request'") &&
  shareService.includes("event.reply('share-capture:start-result'") &&
  shareService.includes("ipcMain.on('share-capture:offer'") &&
  shareService.includes("ipcMain.handle('share-capture:answer'") &&
  !shareService.includes("ipcMain.handle('share-capture:start'"),
  'macOS display capture must remain owned by the isolated capture renderer while the meeting renderer receives only a local WebRTC copy for participant transport and responsive Pause/annotation controls.'
);

assert(runtime.includes("side.dataset.zoomPanelMode='runtime'")&&runtime.includes("panel.dataset.zoomPanelMode='runtime'"),'Participants and Chat must use one runtime panel authority.');
assert(legacyParticipants.includes("version:'2.0.54-one-shot-compatibility'")&&!legacyParticipants.includes('setInterval(')&&!legacyParticipants.includes('new MutationObserver(')&&!legacyParticipants.includes('function centerPanel('),'Legacy Participants compatibility must remain one-shot and must never poll, observe, or autonomously re-center the live panel.');
assert(legacyHostTools.includes("version:'2.0.43-compatibility-no-geometry'")&&!legacyHostTools.includes('centerParticipantsOnce')&&!legacyHostTools.includes("host.style.setProperty('width','248px'"),'Legacy Host Tools compatibility must not own Participants or Host Tools geometry.');
assert(!legacyHostToolsCss.includes('248px!important')&&!legacyHostToolsCss.includes('.room-side:has(.ds-ref-host-tools-panel)'),'Legacy Host Tools stylesheet must not shrink Host Tools or move Participants.');
assert(
  runtime.includes("const centeredLeft=Math.max(12,(bodyWidth-width)/2);") &&
  runtime.includes("if(panel===participants){") &&
  runtime.includes("panel.style.setProperty('left',`${centeredLeft}px`,'important');") &&
  runtime.includes("panel.style.setProperty('right','auto','important');") &&
  runtime.includes("panel.style.setProperty('top','18px','important');") &&
  runtime.includes("panel.style.setProperty('right','24px','important');") &&
  runtime.includes("panel.style.setProperty('top','46px','important');"),
  'Participants must open centered by default while Chat keeps an independent inset position, preserving the right-side lane for participant video.'
);
assert(runtime.includes('function ensurePanelClose(panel)')&&runtime.includes("aria-label','Close participants'")&&runtime.includes("aria-label','Close chat'"),'Participants and Chat must expose one explicit runtime-owned Close control.');
assert(
  runtime.includes("const candidates=footer?[...footer.querySelectorAll('.av-device-caret')]") &&
  runtime.includes("for(const node of candidates){if(node!==caret)node.remove();}") &&
  runtime.includes("caret.dataset.dsRuntimeCaretSlot='1';"),
  'Audio and Video must each collapse to one runtime-owned options caret with duplicate legacy carets removed.'
);
assert(
  runtime.includes('function canonicalizeParticipantRows(){') &&
  runtime.includes("const moreCandidates=[...row.querySelectorAll('.participant-more,.ds-participant-more,[data-participant-more]')];") &&
  runtime.includes("for(const node of moreCandidates){if(node!==more)node.remove();}"),
  'Each participant row must expose one canonical More action with orphan duplicate ellipsis controls removed.'
);
assert(
  runtime.includes('let meetingSignalTimer=0;') &&
  runtime.includes("meetingSignalTimer=setTimeout(()=>{meetingSignalTimer=0;schedule();},80);") &&
  runtime.includes("window.addEventListener('dominion:meeting-signal',scheduleMeetingSignal);"),
  'Generic meeting signaling must be coalesced before full UI reconciliation so signaling bursts cannot monopolize the renderer.'
);
assert(
  runtime.includes('data-ds-runtime-reference-primed') &&
  runtime.includes('window.DominionZoomScreenshotReference?.sync?.();'),
  'Heavy reference reconciliation must prime once per meeting instead of repainting on every generic runtime pass.'
);
assert(
  runtime.includes("const baseWidth=panel===chat?330:392;") &&
  runtime.includes("const participantCount=participantRows().length;") &&
  runtime.includes("const participantBaseHeight=Math.min(486,Math.max(438,112+(Math.max(1,participantCount)*48)+(participantCount>=7?40:0)));") &&
  runtime.includes("const minPanelHeight=panel===chat?300:438;") &&
  !runtime.includes("panel.classList.contains('ds-panel-wide')?430") &&
  runtime.includes("const centeredLeft=Math.max(12,(bodyWidth-width)/2);") &&
  runtime.includes("if(panel===participants){") &&
  runtime.includes("panel.style.setProperty('left',`${centeredLeft}px`,'important');") &&
  runtime.includes("panel.style.setProperty('right','24px','important');") &&
  runtime.includes("panel.style.setProperty('top','46px','important');") &&
  runtime.includes("Math.max(minPanelHeight,bodyHeight-28)") &&
  runtime.includes("overlay.dataset.dsRuntimeSide='floating';"),
  'Floating Participants must preserve the approved 392px / 438px geometry centered by default, while Chat remains independently movable with its header-safe inset.'
);
assert(runtime.includes("panel.style.setProperty('left',`${pr.left-br.left}px`,'important');")&&runtime.includes("panel.style.setProperty('right','auto','important');")&&runtime.includes("panel.style.setProperty('width',`${pr.width}px`,'important');"),'Final drag authority must capture explicit panel geometry before movement rather than depending on a legacy handler.');
assert(
  runtime.includes("document.addEventListener('pointerdown',begin,true);") &&
  runtime.includes("document.addEventListener('pointermove',move,true);") &&
  runtime.includes("document.addEventListener('pointerup',end,true);") &&
  !runtime.includes("document.addEventListener('mousedown',begin,true);") &&
  !runtime.includes("document.addEventListener('mousemove',move,true);") &&
  !runtime.includes("document.addEventListener('mouseup',end,true);") &&
  runtime.includes("const liveHandle=()=>") &&
  !runtime.includes("surfaceDrag.source!==source"),
  'Final floating-panel drag authority must use one Pointer Events pipeline only and resolve the live panel header dynamically.'
);
assert(runtime.includes("const panelMode=String(dock.dataset.panelMode||'strip');")&&runtime.includes("const columns=panelMode==='gallery'?2:1;")&&runtime.includes("const tileWidth=306,tileHeight=172,gap=7,padding=12,headerHeight=42;"),'Participant video dock must stay one vertical 306x172 stack by default and use two columns only in explicit gallery mode.');
assert(runtimeCss.includes('.ds-traffic-close')&&runtimeCss.includes('.ds-traffic-minimize')&&runtimeCss.includes('.ds-traffic-restore')&&runtime.includes("aria-label=\"Close participants\"")&&runtime.includes("aria-label=\"Minimize participants\"")&&runtime.includes("aria-label=\"Restore participants\"")&&runtimeCss.includes('#meetingChatPanel [data-chat-close]'),'Mac Participants must expose one runtime-owned close/minimize/restore traffic-light set, while Chat keeps its accessible close control.');
assert(runtimeCss.includes('position:fixed!important;\n  z-index:2800!important;')&&!runtimeCss.includes('left:18px!important;\n  right:auto!important;\n  top:auto!important;\n  bottom:94px!important;')&&!polishCss.includes('.meeting-reaction-menu{left:18px!important'),'Reaction chooser position must belong to the runtime anchor calculation, not a hard-pinned stylesheet.');

assert(adaptive.includes("if(window.dominionDesktop)return;")&&!adaptive.includes("search.hidden=count<=1")&&!adaptive.includes("side.querySelector('.zoom-participant-search')"),'Adaptive Participants must be completely read-only in the desktop app so it cannot compete with final participant geometry/search authority.');
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
  panelStability.includes('top:18px!important'),
  'Participants and Chat must remain visibly floating, draggable, closable, and preserve user-positioned geometry across reopen.'
);
assert(screenshotCss.includes('.ds-ref-host-tools-panel{position:fixed;right:0;top:70px;bottom:60px;width:330px;')&&screenshotCss.includes('.ds-ref-host-tools-panel label{height:42px;'),'Host Tools must use the approved readable DominionStar panel scale.');

assert(physical.includes('function normalizeParticipantIdentity(row,id)')&&physical.includes("if(nameNode.textContent!==name)nameNode.textContent=name;if(strong.title!==name)strong.title=name;")&&physical.includes("querySelectorAll('[data-participant-more],[data-ds-self-more],.ds-host-row-more')"),'Participant rows must preserve the full canonical name without rewriting unchanged text and must collapse duplicate ellipsis controls to one representation.');
assert(physical.includes("const inlineRole=role==='host'?(self?'(Host, me)':'(Host)')")&&physical.includes("role==='cohost'?(self?'(Co-host, me)':'(Co-host)'):(self?'(me)':'')")&&physical.includes("if(inline.textContent!==inlineRole)inline.textContent=inlineRole")&&physical.includes("inline.hidden=!inlineRole"),'Participant role and self identity must remain inline with the canonical name without unnecessary DOM rewrites.');
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
assert(profileFallback.includes('width:64px;height:64px;border-radius:50%')&&!profileFallback.includes('width:58px;height:58px'),'Participant camera-off profile photos must preserve the compact 64px filmstrip scale and must not regress to the undersized 58px fallback.');
assert(
  media.includes("echoCancellation:readPref('echoCancellation','true')!=='false'")&&
  media.includes("noiseSuppression:readPref('noiseSuppression','true')!=='false'")&&
  media.includes("autoGainControl:readPref('autoGainControl','false')!=='false'")&&
  media.includes("localStorage.setItem(KEYS.autoGainControl,'false')"),
  'Default microphone processing must use gentle echo/noise suppression without automatic gain pumping.'
);
assert(
  macPresenter.includes('function allowSystemCapture(win)')&&
  macPresenter.includes('win.setContentProtection(false)')&&
  macPresenter.includes('allowSystemCapture(toolbarWindow)')&&
  macPresenter.includes('allowSystemCapture(videoWindow)')&&
  macPresenter.includes("loadFile(path.join(uiDir,'mac-annotation-canvas.html'))")&&
  macPresenter.includes('allowSystemCapture(canvas)')&&
  macPresenter.includes('allowSystemCapture(palette)')&&
  shareService.includes("const protect=platform==='darwin'?false:Boolean(enabled);"),
  'Visible presenter surfaces must remain capturable in ordinary macOS screenshots throughout an active share.'
);
assert(featureReady.includes('box-shadow:none!important')&&read('ui/meeting-parity.css').includes('box-shadow:none!important'),'Mic/video off state must use one clean slash without the old doubled halo stripe.');
assert(!featureReady.includes('M18.8 3.1v3.6M17 4.9h3.6'),'Final meeting reconciliation must not restore the rejected legacy reaction glyph.');
assert(shareService.includes("return {ok:Boolean(sent),qaCommandId:Number(delivery?.qaCommandId||0),sent:Boolean(sent),direct:Boolean(delivery?.direct),handled:Boolean(delivery?.direct)}"),'Presenter command service must expose execution proof instead of a bare production ok response.');
const macToolbar=read('ui/mac-presenter-toolbar.js');
assert(
  macToolbar.includes("toolbar?.classList.toggle('is-paused',paused)")&&
  macToolbar.includes("pauseGlyph.innerHTML=paused?")&&
  macToolbar.includes("state?.paused")&&
  macToolbarCss.includes('.toolbar.is-paused .share-strip{background:#f5b942')&&
  macToolbarCss.includes('.toolbar.is-paused .toolbar-reveal{background:#f5b942'),
  'Paused native sharing must switch the presenter strip/reveal state to amber and change Pause into a true Resume/play control.'
);
assert(macToolbar.includes("if(nativeBridge?.command)return await sendNative(normalized);")&&macToolbar.includes("result.ok===true")&&macPresenter.includes('async function deliverPresenterCommandDirectFirst(main,command)')&&macPresenter.includes('window.__DominionPresenterDispatch'),'Physical-Mac presenter controls must route through direct renderer execution first inside the native bridge, with acknowledged queue delivery only as fallback.');
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
  integration.includes("cameraTile.hidden=true;") &&integration.includes('The participant video dock is the single visible camera authority') &&
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
  macVideoHtml.includes('id="videoStack"') &&
  macVideoHtml.includes('id="videoActionMenu"') &&
  macVideoHtml.includes('id="videoViewStrip"') &&
  macVideoCss.includes('.video-tile:hover .video-tile-actions') &&
  macVideoCss.includes('.video-primary-action') &&
  macVideoCss.includes('.video-more-action') &&
  macVideoJs.includes('async function runPrimary(person)') &&
  macVideoJs.includes('const participantCommand=(action,id)=>presenterCommand') &&
  macVideoJs.includes("person.micOn?'audio-off':'audio-on'") &&
  macVideoJs.includes("person.cameraOn?'video-off':'video-on'") &&
  macVideoJs.includes("presenterCommand('layout-speaker')") &&
  macVideoJs.includes("presenterCommand('layout-strip')") &&
  macVideoJs.includes("presenterCommand('layout-gallery')") &&
  macVideoJs.includes("presenterCommand('layout-hide')"),
  'The floating presenter video must expose approved per-tile hover mute/ellipsis controls wired through acknowledged presenter commands.'
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
/* PHYSICAL_MAC_AUDIO_VIDEO_SETTINGS_CARET_LOCK */
assert(
  runtime.includes("ensureRuntimeDeviceCaret(q('#roomMic'),'audio');")&&
  runtime.includes("ensureRuntimeDeviceCaret(q('#roomCamera'),'video');")&&
  runtime.includes("window.DominionAVSettings?.bindToolbar?.();")&&
  runtimeCss.includes('explicit Audio/Video device-caret visibility lock')&&
  runtimeCss.includes('[data-kind="audio"]')&&runtimeCss.includes('[data-kind="video"]')&&
  avSettings.includes("version:'1.1.0-full-hd-local-effects'")&&
  avSettings.includes("bindToolbar:()=>installMeetingQuickMenus(media)")&&
  avSettings.includes("settings.textContent=kind==='audio'?'Audio Settings…':'Video Settings…'")&&
  avSettings.includes("caret.setAttribute('aria-haspopup','menu')")&&
  avSettings.includes("caret.dataset.avQuickBound='1'"),
  'Audio and Video must each expose one visible, rebound device/settings caret with functional quick menus after every toolbar reconciliation.'
);

/* PHYSICAL_MAC_PARTICIPANT_FOOTER_ACTION_LOCK */
assert(
  screenshotReference.includes('function openParticipantInvite(anchor)')&&
  screenshotReference.includes("data-ref-participant-more aria-label=\"More participant controls\"")&&
  screenshotReference.includes("participants()?.sendAll?.('host:mute')")&&
  screenshotReferenceCss.includes('.ds-ref-invite-menu{position:absolute')&&
  participantsReference.includes("if(more)more.hidden=!manager;")&&
  participantsReference.includes("action.textContent='No one to mute'")&&
  read('ui/participant-controls.js').includes("return {ok:true,count:0,empty:true};")&&
  read('ui/participant-controls.js').includes("return {ok:sent>0,count:sent,requested:list.length};"),
  'Participants footer controls must remain functional: in-panel Invite, deterministic Mute-all feedback, and host-only More management.'
);

assert(
  macPresenter.includes("if(nativeAnnotationOpen){")&&
  macPresenter.includes("delete incoming.companion;delete incoming.companionOpen;")&&
  macPresenter.includes("else if(nativeCompanionBarrier){")&&
  macPresenter.includes("QA_MAC_ANNOTATION_BARRIER_DROP incoming=")&&
  macPresenter.includes("if(panelCommand)nativeCompanionBarrier=false;")&&
  macPresenter.includes("nativeAnnotationOpen=false;nativeCompanionBarrier=true;shareState={...shareState,companion:'',companionOpen:false}")&&
  macPresenter.includes("Explicit presenter panel commands close annotation before dispatch.")&&
  !macPresenter.includes("if(['participants','chat'].includes(incomingCompanion)){\n        nativeAnnotationOpen=false"),
  'Native annotation must remain authoritative over stale renderer companion publications, and closing it must not resurrect the prior Chat/Participants companion before an explicit new panel command.'
);

/* PHYSICAL_MAC_SHARE_COMPANION_AND_COMPACT_ANNOTATION_LOCK */
assert(
  macPresenter.includes("const panelCommand=['participants','chat'].includes(normalized)||/^participant:(?:chat|rename):/.test(normalized);")&&
  macPresenter.includes("const revealPanelMeeting=panelCommand&&!shareState.meetingVisible;")&&
  macPresenter.includes("if(revealPanelMeeting)showMeeting();")&&
  macPresenter.indexOf("if(revealPanelMeeting)showMeeting();")<
    macPresenter.indexOf("const delivered=await deliverPresenterCommandDirectFirst(main,normalized);")&&
  macPresenter.includes("if(panelCommand&&!delivered?.ok&&revealPanelMeeting)hideMeeting();")&&
  activeShareHome.includes('function restoreShareCompanion(){')&&
  activeShareHome.includes("if(shareActive()&&(kind==='participants'||kind==='chat'))restoreShareCompanion();")&&
  integration.includes("['participants','chat'].includes(previous)")&&
  integration.includes("desktop?.macShare?.showMeeting?.()")&&
  integration.includes("if(action==='chat')")&&
  integration.includes("if(action==='rename')")&&
  shareCss.includes('2.0.44+ native Mac floating Participants/Chat companion lock'),
  'Share-toolbar Participants/Chat and video-tile Chat/Rename must execute in the hidden renderer first, then reveal only the requested floating companion surface and hide it again when closed.'
);
assert(
  participantsReference.includes('width:392px!important;min-width:min(360px,calc(100% - 24px))!important')&&
  participantsReference.includes('.room-side-head:has(.ds-panel-traffic)>div:not(.ds-panel-traffic){padding-left:60px!important;padding-right:60px!important')&&
  screenshotReference.includes('data-ref-invite>Invite</button><button type="button" data-ref-mute-all>Mute all</button><button type="button" data-ref-participant-more')&&
  participantsReference.includes('if(more)more.hidden=!manager;')&&
  screenshotReference.includes('function openParticipantBulkMenu(anchor)')&&
  screenshotReference.includes('function openParticipantInvite(anchor)'),
  'Participants must preserve one readable fixed floating reference with centered title, runtime-owned traffic controls, canonical rows, functional Invite/Mute all actions, and host-aware More management.'
);

assert(
  macAnnotationHtml.includes('data-command="annotate-pen"') &&
  macAnnotationHtml.includes('data-command="annotate-highlight"') &&
  macAnnotationHtml.includes('data-command="annotate-laser"') &&
  macAnnotationHtml.includes('data-command="annotate-erase"') &&
  macAnnotationHtml.includes('data-command="annotate-width-thin"') &&
  macAnnotationHtml.includes('data-command="annotate-width-heavy"') &&
  macAnnotationHtml.includes('data-command="annotate-shape-line"') &&
  macAnnotationHtml.includes('data-command="annotate-shape-rect"') &&
  macAnnotationHtml.includes('data-command="annotate-shape-ellipse"') &&
  macAnnotationHtml.includes('data-command="annotate-shape-arrow"') &&
  macAnnotationHtml.includes('data-command="annotate-undo"') &&
  macAnnotationHtml.includes('data-command="annotate-clear"') &&
  macAnnotationHtml.includes('data-command="annotate-close"') &&
  macAnnotationHtml.includes('data-flyout="shapes"') &&
  macAnnotationHtml.includes('data-flyout="style"') &&
  macAnnotationCss.includes('.annotation-palette{') &&
  macAnnotationCss.includes('width:52px') &&
  macAnnotationCss.includes('.annotation-flyout{') &&
  macAnnotationCss.includes('left:58px') &&
  shareCss.includes('body.ds-native-mac-presenter-share .share-annotation-tools{display:none!important}') &&
  integration.includes('function lockNativeAnnotationRenderer(){') &&
  integration.includes("tools.style.setProperty('display','none','important')") &&
  macAnnotationHtml.includes('data-command="annotate-select"') &&
  macAnnotationJs.includes("version:'2.0.55-zoom-vertical-rail'") &&
  presenterPreload.includes("setAnnotationFlyout:open=>invoke('mac-share:annotation-flyout'") &&
  macPresenter.includes("const width=annotationFlyoutOpen?184:52") &&
  macPresenter.includes("width:52,height:500,minWidth:52,maxWidth:184,minHeight:430,maxHeight:526") &&
  macPresenter.includes("ipcMain.handle('mac-share:annotation-flyout'") &&
  macPresenter.includes("path.join(uiDir,'mac-annotation-toolbar.html')") &&
  macPresenter.includes("path.join(uiDir,'mac-annotation-canvas.html')") &&
  macAnnotationCanvasHtml.includes('id="annotationCanvas"') &&
  macAnnotationCanvasCss.includes('.mode-pen #annotationCanvas') &&
  macAnnotationCanvasCss.includes('.mode-laser #annotationCanvas{cursor:none') &&
  macAnnotationCanvasJs.includes("version:'2.0.47-native-display-canvas-select-default'") &&
  macAnnotationCanvasJs.includes("snapshot:()=>({mode:state.mode,width:state.width,color:state.color,historyDepth:state.history.length})") &&
  macAnnotationCanvasJs.includes("if(state.mode==='laser'){laser(p)") &&
  macAnnotationCanvasJs.includes("canvas.addEventListener('pointermove',move") &&
  presenterPreload.includes("onAnnotationCommand:callback=>listen('mac-annotation:command'") &&
  macPresenter.includes("canvas.webContents.send('mac-annotation:command'"),
  'Annotate must use a narrow Zoom-style left rail by default, expand only for Shapes/Style flyouts, expose an explicit Close control, and retain the full-display native drawing canvas for Pen, Highlighter, Laser, Shapes, Eraser, Undo, Clear, width and color.'
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
  macVideoJs.includes("const voiceLevel=Math.max(0,Math.min(1,Number(state?.voiceLevel)||0))") &&
  macVideoJs.includes("speaking=Boolean(micOn&&state?.speaking&&voiceLevel>0)") &&
  macVideoJs.includes("tile.classList.toggle('speaking',tile.dataset.self==='1'&&speaking)") &&
  !macVideoHtml.includes('id="micState"') &&
  !macVideoCss.includes('.video-mic-meter') &&
  macVideoCss.includes('.video-tile.speaking{border-color:#31d158'),
  'Real microphone RMS must propagate from the authoritative meeting track into the native toolbar meter and the approved green speaking border on the share-video tile without adding non-reference controls to the video header.'
);
assert(preload.includes('const accepted=result?.handled===true;')&&!preload.includes('const accepted=result?.handled!==false;'),'Presenter preload must reject undefined/stale listener results instead of falsely acknowledging dead toolbar commands.');
assert(macToolbar.includes("if(command==='audio')command=Boolean(lastState?.micOn)?'audio-off':'audio-on';")&&macToolbar.includes("if(command==='video')command=Boolean(lastState?.cameraOn)?'video-off':'video-on';")&&integration.includes("command==='audio-on'||command==='audio-off'")&&integration.includes("command==='video-on'||command==='video-off'"),'Presenter Audio/Video commands must be explicit idempotent targets so delivery retries cannot toggle state twice.');
assert(macToolbar.includes("if(command==='pause')command=Boolean(lastState?.paused)?'resume-share':'pause-share';")&&integration.includes("command==='pause'||command==='pause-share'||command==='resume-share'")&&integration.includes("if(target)await share.pause(sharedVideo);")&&integration.includes("else await share.resume();"),'Presenter Pause/Resume must use explicit idempotent targets so delivery fallback cannot pause and immediately resume.');
assert(presenterPreload.includes("setToolbarHidden:hidden=>invoke('mac-share:toolbar-hidden'")&&macPresenter.includes("ipcMain.handle('mac-share:toolbar-hidden'")&&macToolbar.includes("setNativeHidden(true)")&&macToolbar.includes("control.disabled=true")&&macToolbar.includes("applyAcknowledgedAvState")&&macToolbarCss.includes(".toolbar.auto-hidden .control-strip{transform:translateY(-66px);opacity:0;pointer-events:none}")&&macToolbarCss.includes(".toolbar.auto-hidden .share-strip{top:0;opacity:1;pointer-events:auto}")&&macPresenter.includes("toolbarAutoHidden?30:88")&&!macToolbarCss.includes(".toolbar:hover .control-strip"),'Idle presenter controls must collapse to the native status-strip zone while the green/amber sharing indicator remains visible; AV commands stay serialized and ordinary screen movement must not force the toolbar open.');
assert(macPresenter.includes('focusable:true,alwaysOnTop:true')&&macVideoJs.includes("window.addEventListener('blur',closeMenu)"),'Floating video options must close through normal focus loss instead of requiring the ellipsis button again.');
assert(integration.includes("if(command==='stop'){clearCompanion();await share.stop();return finish({handled:true,command});}")&&!integration.includes("await share.stop();applyLayout();"),'Stop Share must use one local-first state transition, record the command outcome, and rely on the synchronous share-state listener to restore meeting chrome.');
assert(
  integration.includes('if(sameRendererPresenter&&state.active){')&&
  integration.includes('return;')&&
  integration.includes('function publishMacPresenterState(){')&&
  integration.includes('if(sameRendererPresenter)publishMacPresenterState();else applyLayout();')&&
  integration.includes("if(sameRendererPresenter&&active){")&&
  integration.includes("publishMacPresenterState();")&&
  integration.includes("syncMacCameraFramePump();")&&
  integration.includes("media.onChange(()=>{if(!share.snapshot().active){if(localPresenterMirror.srcObject)localPresenterMirror.srcObject=null;return;}if(sameRendererPresenter){syncLocalPresenterMirror();publishMacPresenterState();syncMacCameraFramePump();return;}applyLayout();});"),
  'Active Mac sharing must bypass meeting share-layout reconciliation while publishing presenter state and bounded remote-tile mirror updates.'
);
assert(
  macToolbarCss.includes('.toolbar-drag-handle{')&&
  macToolbarCss.includes('pointer-events:none')&&
  macToolbarCss.includes('.control-strip{')&&
  macToolbarCss.includes('-webkit-app-region:drag')&&
  macToolbarCss.includes('.control-strip>button,.menu-wrap>button{')&&
  macToolbarCss.includes('-webkit-app-region:no-drag'),
  'Presenter drag chrome must remain draggable without intercepting control-button clicks.'
);

assert(
  macToolbarHtml.includes('data-command="audio"')&&
  macToolbarHtml.includes('data-command="video"')&&
  macToolbarHtml.includes('data-command="participants"')&&
  macToolbarHtml.includes('data-command="chat"')&&
  macToolbarHtml.includes('data-command="new-share"')&&
  macToolbarHtml.includes('data-command="pause"')&&
  macToolbarHtml.includes('id="layoutButton"')&&
  macToolbarHtml.includes('data-command="annotate"')&&
  macToolbarHtml.includes('data-command="show-meeting"')&&
  macToolbarHtml.includes('id="moreButton"')&&
  macToolbarHtml.indexOf('<section class="share-strip"')<macToolbarHtml.indexOf('id="stopShare"')&&
  macToolbarHtml.indexOf('id="stopShare"')<macToolbarHtml.indexOf('</section>',macToolbarHtml.indexOf('<section class="share-strip"')),
  'Presenter controls must match the Zoom-reference contract: Audio, Video, Participants, Chat, Share, Pause/Resume, Layout, Annotate, Show meeting, More, with Stop Share attached to the separate status strip.'
);
assert(
  macPresenter.includes("function shouldShowVideoWindow(){return videoLayout!=='hide';}")&&
  macPresenter.includes("if(shareActive&&!qaKeepPresenterHidden&&shouldShowVideoWindow())")&&
  macPresenter.includes("if(!shouldShowVideoWindow()){try{videoWindow.hide();}catch{}return {ok:true,layout:videoLayout,visible:false};")&&
  macPresenter.includes("if(isAlive(videoWindow)){if(shouldShowVideoWindow()&&shareActive)videoWindow.showInactive?.();else videoWindow.hide();}")&&
  shareCss.includes('body.ds-native-mac-presenter-share #remoteTileStrip')&&
  shareCss.includes('body.ds-native-mac-presenter-share #participantVideoDock'),
  'Approved native share must keep the solo-presenter video panel available while suppressing duplicate renderer video surfaces during active Mac sharing.'
);
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
  macPresenter.includes("const BORDER_ACTIVE_COLOR='#2ed573';")&&
  macPresenter.includes("const BORDER_PAUSED_COLOR='#f5b942';")&&
  macPresenter.includes('border:${BORDER_THICKNESS}px solid ${BORDER_ACTIVE_COLOR}')&&
  macPresenter.includes('body[data-share-state="paused"]::before{border-color:${BORDER_PAUSED_COLOR}}')&&
  macPresenter.includes("document.body.dataset.shareState='${paused?'paused':'active'}'")&&
  macPresenter.includes("'screen-saver',2")&&
  macPresenter.includes("setSimpleFullScreen(true)")&&
  macPresenter.includes("setSimpleFullScreen(false)")&&
  macPresenter.includes("mac_share_perimeter_load")&&
  !macPresenter.includes("mac_share_border_edge_"),
  'The presenter perimeter must be one continuous full-display overlay that changes coherently from green active-share state to amber paused-share state.'
);
assert(
  shareAnnotation.includes('getCoalescedEvents')&&shareAnnotation.includes('batch.length-12')&&shareAnnotation.includes('desynchronized:true')&&
  shareAnnotation.includes("state.ctx.lineTo(next.x,next.y)")&&
  !shareAnnotation.includes("batch.length-2")&&
  !shareAnnotation.includes('pointerrawupdate')&&
  shareAnnotation.includes("addEventListener('pointermove',move,{passive:false})")&&
  shareAnnotation.includes('drawImage(state.canvas,0,0)')&&
  shareAnnotation.includes("version:'1.7.0-async-history-event-driven-annotation'")&&
  shareAnnotation.includes('createImageBitmap(state.canvas)')&&
  shareAnnotation.includes('historyPending')&&
  shareAnnotation.includes("window.addEventListener('dominion:share-state'")&&
  !shareAnnotation.includes("setInterval(()=>{if(state.active")&&
  shareAnnotation.includes('function drawShape')&&
  shareAnnotation.includes('function setWidth')&&
  shareAnnotation.includes("state.canvas.style.touchAction='none'"),
  'Annotation input must preserve immediate low-latency pointer delivery while supporting functional stroke widths and shapes.'
);
assert(
  shareService.includes("const qaNoMacPark=qaPresenterTrace&&process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1';")&&
  shareService.includes('Do not perform any delayed')&&
  shareService.includes('cancelMacParkTimer();\n    const main=getMainWindow?.();keepMeetingRendererLive();setMacPresenterStealth(main,true);\n    try{main?.setOpacity?.(0.001);}catch{}\n    return true;')&&
  shareService.includes('main.setWindowButtonVisibility?.(!enabled)')&&
  shareService.includes('main.setHasShadow?.(!enabled)')&&
  !shareService.includes('setTimeout(()=>{macParkTimer=null;if(shareActive)parkMacMeetingWindow({preCapture:false});')&&
  shareService.includes('main.setOpacity?.(1)')&&
  shareService.includes('try{main.blur?.();}catch{}')&&
  shareService.includes('Do not resize, move, minimize, hide or fade the meeting engine after')&&
  shareService.includes("const protect=platform==='darwin'?false:Boolean(enabled);")&&
  shareService.includes('protectMeetingChrome(main,Boolean(shareActive));')&&
  shareService.includes('protectMeetingChrome(main,true);main.show();main.focus();')&&
  !shareService.includes('MAC_SENTINEL_WIDTH')&&
  !shareService.includes('MAC_SENTINEL_HEIGHT')&&
  !shareService.includes('MAC_PARK_COORDINATE=-32000')&&
  !shareService.includes('main.setOpacity?.(0.02)')&&
  !bootstrap.includes('originalSetOpacity.call(main,0.02)')&&
  !macPresenter.includes('main.setOpacity?.(0.02)'),
  'The meeting control renderer must keep stable on-display geometry after capture is isolated and must remain visible to ordinary macOS screenshots; resize, off-display and minimize transitions are forbidden because they starve physical-Mac presenter commands.'
);

assert(
  webrtc.includes("window.dispatchEvent(new CustomEvent('dominion:remote-share-state'")&&
  physical.includes("const sharingParticipantIds=new Set();")&&
  physical.includes("participantShareStateNode(row,id)")&&
  physical.includes("window.addEventListener('dominion:remote-share-state'"),
  'Participant roster must show a canonical green sharing-state indicator driven by real local/remote share state.'
);
assert(
  parityCss.includes('2.0.44+ compact right-side participant filmstrip reference')&&
  parityCss.includes('#participantVideoDock[data-orientation="vertical"]:not(.gallery-stage):not(.multi-speaker-stage)')&&
  parityCss.includes('grid-template-columns:306px!important')&&
  parityCss.includes('max-height:515px!important')&&
  parityCss.includes('.remote-peer-tile.active-speaker')&&
  parityCss.includes('border-color:#35d07f!important'),
  'Right-side participant video must remain a one-column five-visible 306x172 filmstrip with internal scroll and green active-speaker outline.'
);
assert(
  profileFallback.includes("width:64px;height:64px")&&
  !profileFallback.includes("if(count>0)dock.dataset.orientation='grid';"),
  'Profile-photo fallback must stay compact and must not force the right-side filmstrip into grid orientation.'
);

assert(app.includes("media.onChange?.(()=>{try{attachPreview();}catch{}});"),'All media mutations must repaint meeting AV state, including presenter-toolbar commands.');
assert(preload.includes("if(process.platform==='darwin')ipcRenderer.send('mac-share:state',state||{});return invoke('share:capture-state',state);"),'Mac share state must reach both native overlay and companion-window authorities.');
assert(presenterPreload.includes("environment:()=>invoke('app:get-environment')"),'Mac presenter surfaces must be able to detect certified QA runtime without loading the full meeting preload.');
assert(
  main.includes('qaPresenterFixtures:qaFixtureRequested')&&
  macVideoJs.includes('qaPresenterFixtures')&&
  !macVideoJs.includes('getUserMedia(')&&
  !macVideoJs.includes('ImageCapture(')&&
  !macVideoJs.includes('qaSynthetic')&&
  !macVideoJs.includes('qaInteractionFixtures'),
  'Packaged presenter QA may expose QA-only tracing, but the native video surface must remain independent of synthetic camera fixtures and alternate camera ownership.'
);
assert(
  integration.includes("cameraId:String(mediaState.cameraId||'')")&&
  integration.includes("mirror:mediaState.mirror!==false")&&
  integration.includes('const presenterParticipants=()=>')&&
  integration.includes("const localTrack=media.stream()?.getVideoTracks?.().find(track=>track.readyState==='live'&&track.enabled!==false)||null")&&
  integration.includes("localImageCapture=new ImageCapture(localTrack)")&&
  integration.includes("#participantVideoDock .remote-peer-tile:not(.local-video-dock-tile),#remoteTileStrip .remote-peer-tile")&&
  integration.includes("frameCanvas.width=504;frameCanvas.height=264")&&
  integration.includes("frameContext.imageSmoothingQuality='high'")&&
  integration.includes("frameCanvas.toDataURL('image/webp',.84)")&&
  integration.includes("setInterval(publishMacRemoteFrames,66)")&&
  integration.includes("if(signature===lastPresenterStateSignature)return")&&
  !integration.includes("frameCanvas.toDataURL('image/jpeg',.58)")&&
  !integration.includes("getUserMedia"),
  'The capture-owning renderer must publish a higher-fidelity, high-smoothing camera mirror from the already-owned track, keep state broadcasts coalesced, and avoid creating another camera authority.'
);
assert(
  !macVideoJs.includes('getUserMedia')&&
  !macVideoJs.includes('previewStream')&&
  !macVideoJs.includes("stack.textContent=''")&&
  macVideoJs.includes('bridge?.onVideoFrame?.(applyRemoteFrame)')&&
  macVideoJs.includes('<canvas class="remote-frame" aria-label="Live participant video" hidden></canvas>')&&
  macVideoJs.includes('function paintRemoteFrame(tile,person,dataUrl)')&&
  macVideoJs.includes("canvas.dataset.frameReady='1'")&&
  macVideoJs.includes("context.imageSmoothingQuality='high'")&&
  macVideoJs.includes('renderParticipants(layoutChanged);')&&
  !macVideoJs.includes('renderParticipants(layoutChanged||frameChanged)')&&
  macVideoJs.includes('function createTile(person,stack)')&&
  macVideoJs.includes('function updateTile(tile,person)')&&
  macPresenter.includes("videoWindow.webContents.send('mac-share:video-frame',{participantId,dataUrl,at})")&&
  !macPresenter.includes("videoWindow.webContents.send('share:toolbar-state',{...shareState,videoLayout,videoFrames:[...latestVideoFrames.entries()].map(([id,frame])=>({participantId:id,...frame}))})"),
  'The approved share participant strip must keep persistent keyed canvas tiles, decode each camera frame before painting it, and transport frames independently from participant/layout state so camera motion cannot trigger tile reorder or blank repaint flashes.'
);

/* PHYSICAL_MAC_SCREENSHOT_2026_10_01_IDENTITY_AND_MENU_LOCK */
assert(
  app.includes("const inlineRole=role==='host'?(self?'(Host, me)':'(Host)')")&&
  app.includes("role==='cohost'?(self?'(Co-host, me)':'(Co-host)'):(self?'(me)':'')")&&
  participantsReference.includes('.participant-you{font-style:normal!important')&&
  participantsReference.includes('font-size:11px!important')&&
  participantsReference.includes('.person-copy{min-width:0!important;display:flex!important;flex-direction:row!important'),
  'Participants must keep the full name and role/me metadata on one compact readable row, matching the desktop reference.'
);
assert(
  macToolbarCss.includes('position:absolute;top:60px')&&
  macPresenter.includes('const height=toolbarMenuOpen?468:(toolbarAutoHidden?30:88);')&&macPresenter.includes('maxHeight:500'),
  'Presenter Layout/More menus must open directly below the approved control strip with enough native window height for the full functional menu.'
);

assert(
  integration.includes('const effectiveLocalCameraOn=()=>')&&
  integration.includes("snap.cameraOn&&snap.videoLive&&stream?.getVideoTracks?.().some(track=>track.readyState==='live'&&track.enabled!==false)")&&
  integration.includes("const localTrack=media.stream()?.getVideoTracks?.().find(track=>track.readyState==='live'&&track.enabled!==false)||null")&&
  integration.includes("localImageCapture=new ImageCapture(localTrack)")&&
  macVideoCss.includes('.video-fallback img[hidden]{display:none!important}')&&
  macVideoCss.includes('.video-fallback span[hidden]{display:none!important}')&&
  macVideoJs.includes('if(fallbackInitials)fallbackInitials.hidden=true;'),
  'Presenter video must use the authoritative existing live camera track and must never show avatar plus initials at the same time.'
);

/* PHYSICAL_MAC_2_0_50_REFERENCE_GEOMETRY_LOCK */
assert(
  macPresenter.includes('const width=Math.min(780,Math.max(560,area.width-28));')&&
  macPresenter.includes('const participantCount=Math.max(1,Math.min(5,presenterParticipantCount()||1));')&&macPresenter.includes('const seen=new Set();')&&macPresenter.includes('return seen.size;')&&
  macPresenter.includes('let width=252,height=166;')&&
  macPresenter.includes("if(videoLayout==='strip')height=Math.min(area.height-92,32+(participantCount*134)+Math.max(0,participantCount-1)*2);")&&
  macPresenter.includes('let x=Math.round(area.x+area.width-width-18),y=Math.round(area.y+76);')&&
  macPresenter.includes('const width=annotationFlyoutOpen?184:52,height=Math.min(526,Math.max(430,area.height-180));')&&
  macPresenter.includes('function toolbarRevealZoneContains(point)')&&
  macPresenter.includes('if(moved<3||!toolbarRevealZoneContains(point))return;')&&
  macPresenter.includes('y=Math.round(area.y+12)')&&
  macToolbarCss.includes('width:748px;max-width:calc(100% - 8px);height:60px')&&
  macToolbarCss.includes('.share-strip{')&&
  macToolbarCss.includes('top:60px')&&
  macToolbarCss.includes('width:360px')&&
  macToolbarCss.includes('.toolbar.auto-hidden .share-strip{top:0;opacity:1;pointer-events:auto}')&&
  macToolbar.includes('const AUTO_HIDE_MS=2400;')&&
  shareAnnotation.includes("state.active&&state.mode==='laser'"),
  'Physical reference geometry must preserve the longer Zoom-reference toolbar, shorter persistent status strip below it, localized toolbar reveal zone, true one-to-five participant-strip sizing with internal scroll beyond five, left annotation palette, and live laser pointer.'
);

console.log('DOMINIONSTAR_PHYSICAL_MAC_PARITY_2_0_50_OK detached-capture-worker acknowledged-presenter-dispatch explicit-av-targets native-toolbar-autohide hidden-meeting-renderer synchronized-media-ui approved-five-tile-share-strip simple-fullscreen-perimeter raw-low-latency-smoothed-annotation capture-excluded-meeting deterministic-presenter-teardown single-off-strike stable-right-panels mac-panel-controls canonical-participant-row');
