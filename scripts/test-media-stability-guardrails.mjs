import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const guardianUrl=new URL('../assets/js/runtime/guardian-recovery.js',import.meta.url);
const guardian=fs.existsSync(guardianUrl)?fs.readFileSync(guardianUrl,'utf8'):null;
const dock=fs.readFileSync(new URL('../assets/js/meet/dock-layout-v2.js',import.meta.url),'utf8');
const dockCss=fs.readFileSync(new URL('../assets/css/meet/dock-layout-v2.css',import.meta.url),'utf8');
const background=fs.readFileSync(new URL('../assets/js/meet/background-effects-2030.js',import.meta.url),'utf8');
const videoQuality=fs.readFileSync(new URL('../assets/js/meet/video-quality-parity.js',import.meta.url),'utf8');
const reactionPolish=fs.readFileSync(new URL('../assets/js/meet/reaction-polish.js',import.meta.url),'utf8');
const cameraCatalog=fs.readFileSync(new URL('../assets/js/meet/camera-device-stability.js',import.meta.url),'utf8');
const hotfix=fs.readFileSync(new URL('../assets/js/meet/hotfix-rc13-1-media-prejoin.js',import.meta.url),'utf8');
const sharePicker=fs.readFileSync(new URL('../assets/js/meet/desktop-share-picker.js',import.meta.url),'utf8');
const meetingIdentity=fs.readFileSync(new URL('../assets/js/meet/meeting-identity-settings.js',import.meta.url),'utf8');
const personalRoom=fs.readFileSync(new URL('../assets/js/meet-next/personal-room.js',import.meta.url),'utf8');
const meetIndex=fs.readFileSync(new URL('../meet/index.html',import.meta.url),'utf8');
const desktopMain=fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs',import.meta.url),'utf8');
const desktopPreload=fs.readFileSync(new URL('../desktop 2/src/preload.cjs',import.meta.url),'utf8');
const desktopBootstrap=fs.readFileSync(new URL('../desktop 2/src/bootstrap.mjs',import.meta.url),'utf8');
const presenterToolbar=fs.readFileSync(new URL('../desktop 2/src/presenter-toolbar.html',import.meta.url),'utf8');
const presenterToolbarJs=fs.readFileSync(new URL('../desktop 2/src/presenter-toolbar.js',import.meta.url),'utf8');
const presenterDockMain=fs.readFileSync(new URL('../desktop 2/src/presenter-dock.mjs',import.meta.url),'utf8');
const presenterDockHtml=fs.readFileSync(new URL('../desktop 2/src/presenter-dock.html',import.meta.url),'utf8');
const shareLifecycle=fs.readFileSync(new URL('../desktop 2/src/share-lifecycle.mjs',import.meta.url),'utf8');
const remoteControlDialog=fs.readFileSync(new URL('../desktop 2/src/remote-control-dialog.mjs',import.meta.url),'utf8');
const screenPermissionLifecycle=fs.readFileSync(new URL('../desktop 2/src/screen-permission-lifecycle.mjs',import.meta.url),'utf8');
const operationBootstrap=fs.readFileSync(new URL('../assets/js/meet/operation-2030-bootstrap.js',import.meta.url),'utf8');

assert(!ui.includes("recoverPeer?.(participantId,{reason:'guardian-remote-video-missing'})"),'The view reconciler must never rebuild a connected peer because a frame is temporarily missing.');
const reconciler=ui.slice(ui.indexOf('function reconcileMeetingView()'),ui.indexOf('function startViewReconciler()'));
assert(!reconciler.includes('requestMediaResync'),'The view reconciler must never renegotiate transport from rendering state.');
assert(ui.includes('setTimeout(()=>engine.requestMediaResync?.(payload.participantId).catch(()=>{}),4000)'),'A presentation track receives time to negotiate before requesting one targeted resync.');
assert(engine.includes('remoteTrackStreamIds'),'The engine must retain incoming track-to-stream identity for late screen metadata.');
assert(engine.includes('payload.screenStreamId && state.remoteTrackStreamIds.get'),'Late screen metadata must reclassify presentation tracks by stream identity.');
assert(engine.includes('const preservedScreen=state.remoteScreenStreams.get(payload.from)'),'Repeated screen sharing must reuse the existing WebRTC receiver.');
const screenStopBranch=engine.slice(engine.indexOf("} else {\n        state.remoteScreenTrackIds.delete(payload.from)"),engine.indexOf("emit('screen-state'"));
assert(!screenStopBranch.includes('remoteScreenStreams.delete')&&!screenStopBranch.includes('removeTrack'),'Stopping a share must not destroy the reusable remote screen receiver.');

if(guardian!==null){
  assert(guardian.includes("if(type==='meet.peer.state')return"),'Guardian must not compete with meeting-engine peer recovery.');
  assert(!guardian.includes("recoverDegradedPeers('health-check')"),'Guardian health polling must be observational, not destructive.');
}

assert(engine.includes("const primary=state.participantId.localeCompare(remoteId)<0"),'Only one deterministic peer may receive the first ICE-recovery turn.');
assert(engine.includes("(primary?5000:12000)"),'Transient disconnects must receive a recovery grace period.');
const peerRecovery=engine.slice(engine.indexOf('const recoverPeer = async'),engine.indexOf('const recoverPeers = async'));
assert(!peerRecovery.includes('remote-video-missing')&&!peerRecovery.includes('forceRebuild'),'Rendering symptoms must never destroy a live peer transport.');
assert(dock.includes("dock.addEventListener('pointerdown'")&&dock.includes('Math.hypot(dx,dy)<4'),'The complete participant dock must provide intentional drag activation.');
assert(dock.includes("event.target.closest(interactive)"),'Dock buttons and interactive controls must remain clickable.');
assert(/cursor\s*:\s*grab\s*!important/i.test(dockCss),'The movable dock must visibly communicate its drag surface.');
assert(engine.includes('const requestedRole=payload.targetRole||payload.role')&&engine.includes('targetRole:nextRole'),'A sender role must never overwrite the requested participant role.');

assert(background.includes('/float16/1/selfie_segmenter_landscape.tflite')&&!background.includes('/float16/latest/'),'Background segmentation must use a pinned model asset.');
assert(background.includes("const audioTracks = rawStream.getAudioTracks().filter(track => track.readyState === 'live')"),'Background processing must preserve live microphone tracks.');
assert(background.includes('const restoreStream = new MediaStream([current.sourceTrack,...audioTracks])')&&background.includes('await restoreRawSession(current)'),'Disabling Blur/Portrait must restore a real camera source stream while preserving audio.');
assert(background.includes('video[data-ds-background-processed="1"]{filter:none!important;}'),'Processed background video must own filter presentation.');
assert(videoQuality.includes('DominionVideoIntelligenceCompositor?.getSourceTrack?.()')&&videoQuality.includes('DominionBackgroundEffects2030?.getSourceTrack?.()'),'Video quality must resolve the real camera through the effect pipeline instead of adding another acquisition owner.');

// Reaction presentation is now deliberately isolated from cameras/devices.
assert(reactionPolish.includes('DominionReactionPolish')&&reactionPolish.includes('floating-reaction-symbol'),'Reaction polish must retain the approved presentation treatment.');
assert(!reactionPolish.includes('enumerateDevices'),'Reaction polish must never enumerate devices.');
assert(!reactionPolish.includes('getUserMedia'),'Reaction polish must never acquire media.');
assert(!reactionPolish.includes('MutationObserver'),'Reaction polish must never start DOM feedback observers.');
assert(!reactionPolish.includes('createElement(\'script\')'),'Reaction polish must never become a second module loader.');
assert(operationBootstrap.includes('reaction-polish.js?v=1-reaction-only')&&!operationBootstrap.includes('camera-reaction-polish.js'),'Bootstrap must load the reaction-only module and reject the deleted camera/reaction bundle.');

// Single-owner media contract: Executive 6 owns normal camera acquisition and
// recovery. The passive catalog labels/selects devices but may not control media.
assert(ui.includes('const PREVIEW_CAMERA_RETRY_DELAYS_MS=[0,320,760,1400]')&&ui.includes('const acquireUserMediaStable=async constraints=>'),'Executive 6 must retain bounded camera retry.');
assert(ui.includes('navigator.mediaDevices.enumerateDevices()')&&ui.includes('async function loadDevices()'),'Executive 6 must enumerate attached camera/microphone/speaker devices.');
assert(ui.includes("state.stream?.getVideoTracks?.().forEach(track=>{try{state.stream.removeTrack(track);}")&&ui.includes("track.readyState!=='ended')track.stop()"),'Visible prejoin Video Off must physically release the camera track.');
assert(cameraCatalog.includes('enumerateDevices()')&&cameraCatalog.includes('cameraSelect')&&cameraCatalog.includes('microphoneSelect')&&cameraCatalog.includes('speakerSelect'),'Passive catalog must hydrate all three hardware selectors.');
assert(cameraCatalog.includes('looksOpaque')&&cameraCatalog.includes('knownLabels'),'Device catalog must reject opaque IDs as user-facing hardware names.');
assert(cameraCatalog.includes('replaceChildren(fragment)')&&cameraCatalog.includes('sameOptions'),'Device catalog must avoid repeated DOM churn when the device list did not change.');
assert(!cameraCatalog.includes('media.getUserMedia ='),'Device catalog must never wrap getUserMedia.');
assert(!cameraCatalog.includes('__dsCameraStabilityWrapped')&&!cameraCatalog.includes('engine[method] ='),'Device catalog must never wrap the meeting engine.');
assert(!cameraCatalog.includes('MutationObserver'),'Device catalog must not run mutation-observer feedback loops.');
assert(!cameraCatalog.includes('.stop()'),'Device catalog must never own physical camera shutdown.');
assert(hotfix.includes('getMediaPermissions')&&hotfix.includes('requestMediaPermissions'),'Desktop host-prejoin permission checks must still honor native macOS permissions.');
assert(!hotfix.includes('navigator.mediaDevices.getUserMedia ='),'Host prejoin flow must not wrap getUserMedia globally.');
assert(meetIndex.indexOf('/assets/js/meet/camera-device-stability.js') < meetIndex.indexOf('/assets/js/meeting-engine.js'),'Passive hardware catalog must load before the meeting engine.');
assert(!operationBootstrap.includes('microphone-device-identity.js'),'Desktop advanced runtime must not load a second microphone selector owner.');
assert(operationBootstrap.includes('mediaIdle')&&operationBootstrap.includes('requestIdleCallback'),'Heavy camera/effect enhancements must wait until UI/media startup is idle.');
assert(/function supportsMacSystemPicker\(\)\s*\{\s*return false;\s*\}/.test(desktopMain),'The macOS system share sheet must not bypass the DominionStar picker.');
assert(desktopMain.includes('customSharePicker: !supportsMacSystemPicker()')&&desktopMain.includes('systemSharePicker: supportsMacSystemPicker()'),'Desktop runtime metadata must advertise DominionStar as active share picker.');

// Real capture readiness overrides stale macOS/TCC status so granted users do
// not get trapped in a System Settings loop.
assert(screenPermissionLifecycle.includes("getMediaAccessStatus('screen')"),'macOS screen permission status must still be observed.');
assert(screenPermissionLifecycle.includes('desktopCapturer.getSources')&&screenPermissionLifecycle.includes('probeCaptureReadiness'),'Native lifecycle must probe real screen-capture readiness.');
assert(screenPermissionLifecycle.includes('captureReady: true')&&screenPermissionLifecycle.includes('requiresRestart: false'),'Working capture sources must override stale permission/restart state.');
assert(screenPermissionLifecycle.includes('sourceCount')&&screenPermissionLifecycle.includes('previewCount'),'Screen permission diagnostics must expose source/preview counts.');
assert(screenPermissionLifecycle.includes('desktop:screen-permission-status')&&screenPermissionLifecycle.includes('desktop:relaunch-for-permissions'),'Native shell must expose permission status and controlled relaunch.');
assert(screenPermissionLifecycle.includes('QA_PREVIEW_HOST'),'QA preview must use the same native screen-permission lifecycle.');
assert(desktopPreload.includes('getScreenPermissionStatus')&&desktopPreload.includes('relaunchForPermissions'),'Trusted preload must expose screen permission lifecycle.');
assert(desktopBootstrap.includes('screen-permission-lifecycle.mjs'),'Desktop bootstrap must load native screen permission lifecycle.');
assert(!operationBootstrap.includes('screen-permission-ui-guard.js'),'Desktop runtime must not load a second screen-permission authority.');
assert(sharePicker.includes('state?.requiresRestart')&&sharePicker.includes('Restart DominionStar Meet')&&sharePicker.includes('getScreenPermissionStatus'),'Share picker must distinguish stale process state from denied permission.');
assert(sharePicker.includes("'Screen access is active'")&&sharePicker.includes('SOURCE_RETRY_DELAYS')&&sharePicker.includes('settingsButton.hidden=granted'),'Granted permission must retry source enumeration rather than looping to Settings.');

assert(meetingIdentity.includes('ds-personal-room-heading')&&meetingIdentity.includes('Set your meeting identity and Personal Room defaults.'),'Meeting Settings must keep clear Personal Room hierarchy.');
assert(!meetingIdentity.includes('<input id="generatedWaitingRoom"')&&!meetingIdentity.includes('<input id="generatedRequirePasscode"'),'Meeting Settings must not duplicate generated-meeting controls.');

for(const legacy of ['🎙','◉','♙','▢','Ⅱ','↗']) assert(!presenterToolbar.includes(legacy),`Native presenter toolbar must not use legacy glyph ${legacy}.`);
assert(presenterToolbar.includes('<svg')&&presenterToolbar.includes('data-command="new-share"')&&presenterToolbar.includes('data-command="pause"')&&presenterToolbar.includes('data-command="stop"'),'Native presenter toolbar must use vector controls for core sharing actions.');
assert(ui.includes('window.dominionDesktop.updatePresenterDock?.({tiles})'),'Meeting runtime must publish participant tiles while desktop sharing is active.');
assert(desktopPreload.includes("updatePresenterDock: state => ipcRenderer.send('desktop:presenter-dock-update'"),'Desktop preload must expose native participant dock bridge.');
assert(desktopBootstrap.includes('presenter-dock.mjs'),'Desktop bootstrap must load native presenter dock controller.');
assert(presenterDockMain.includes('alwaysOnTop:true')&&presenterDockMain.includes('resizable:true')&&presenterDockMain.includes('desktop:presenter-dock-update'),'Native participant dock must remain resizable and always on top.');
assert(presenterDockHtml.includes('-webkit-app-region:drag')&&presenterDockHtml.includes('Participant video will appear here while you share.'),'Native participant dock must remain movable with a clean empty state.');

assert(engine.includes('context.drawImage(video,0,0,width,height)')&&engine.includes('const freezeStream=canvas.captureStream(1)'),'Pause Share must freeze the last rendered frame.');
assert(engine.includes('const frozen=await createFrozenScreenTrack()')&&engine.includes('state.screenPaused=true')&&engine.includes('syncPeerTracks(peer)'),'Pause Share must replace only the outgoing presentation sender.');
assert(engine.includes('state.screenPaused=false')&&engine.includes('clearFrozenScreenTrack()'),'Resume Share must restore live capture and dispose frozen track.');

assert(shareLifecycle.includes('app.dock.isVisible()')&&shareLifecycle.includes('await app.dock.show()'),'Screen sharing must preserve the macOS Dock icon.');
assert(shareLifecycle.includes('desktop:presenter-show')&&shareLifecycle.includes('desktop:presenter-hide'),'Dock visibility must be guarded for presenter lifecycle.');
assert(desktopBootstrap.includes('share-lifecycle.mjs'),'Desktop bootstrap must load share-lifecycle guard.');

assert(presenterToolbarJs.includes("document.body.classList.add('stopping','collapsed')")&&presenterToolbarJs.includes("document.body.style.opacity='0'"),'Stop Share must immediately retire native presenter controls.');
assert(presenterToolbarJs.includes("window.presenterBridge.command('stop')")&&presenterToolbarJs.includes('stopRecoveryTimer=setTimeout'),'Stop Share must execute real engine command and recover controls if teardown fails.');

assert(desktopPreload.includes('showRemoteControlPrompt')&&desktopPreload.includes('onRemoteControlDecision')&&desktopPreload.includes('showRemoteControlError'),'Preload bridge must expose remote-control approval lifecycle.');
assert(remoteControlDialog.includes('desktop:remote-control-prompt')&&remoteControlDialog.includes("buttons: ['Deny', 'Approve']"),'Remote control must present explicit approval dialog.');
assert(remoteControlDialog.includes('desktop:remote-control-error')&&remoteControlDialog.includes('dialog.showMessageBox'),'Remote-control failures must surface in native dialog.');
assert(desktopBootstrap.includes('remote-control-dialog.mjs'),'Desktop bootstrap must load remote-control approval UI.');

assert(personalRoom.includes("$('personalRoomForm')?.addEventListener('submit'")&&!personalRoom.includes("$('savePersonalRoom')?.addEventListener('click'"),'Personal Room Save must execute once through form submit.');

console.log('Media stability guardrails passed: single media owner, passive device catalog, reaction-only polish, capture-ready screen permission.');
