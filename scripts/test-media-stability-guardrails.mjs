import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const guardianUrl=new URL('../assets/js/runtime/guardian-recovery.js',import.meta.url);
const guardian=fs.existsSync(guardianUrl)?fs.readFileSync(guardianUrl,'utf8'):null;
const dock=fs.readFileSync(new URL('../assets/js/meet/dock-layout-v2.js',import.meta.url),'utf8');
const dockCss=fs.readFileSync(new URL('../assets/css/meet/dock-layout-v2.css',import.meta.url),'utf8');
const background=fs.readFileSync(new URL('../assets/js/meet/background-effects-2030.js',import.meta.url),'utf8');
const cameraPolish=fs.readFileSync(new URL('../assets/js/meet/camera-reaction-polish.js',import.meta.url),'utf8');
const cameraStability=fs.readFileSync(new URL('../assets/js/meet/camera-device-stability.js',import.meta.url),'utf8');
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

assert(!ui.includes("recoverPeer?.(participantId,{reason:'guardian-remote-video-missing'})"),
  'The view reconciler must never rebuild a connected peer because a frame is temporarily missing.');
const reconciler=ui.slice(ui.indexOf('function reconcileMeetingView()'),ui.indexOf('function startViewReconciler()'));
assert(!reconciler.includes('requestMediaResync'),
  'The view reconciler must never renegotiate transport from rendering state.');
assert(ui.includes('setTimeout(()=>engine.requestMediaResync?.(payload.participantId).catch(()=>{}),4000)'),
  'A presentation track receives time to negotiate before requesting one targeted resync.');
assert(engine.includes('remoteTrackStreamIds'),
  'The engine must retain incoming track-to-stream identity for late screen metadata.');
assert(engine.includes('payload.screenStreamId && state.remoteTrackStreamIds.get'),
  'Late screen metadata must reclassify presentation tracks by stream identity.');
assert(engine.includes('const preservedScreen=state.remoteScreenStreams.get(payload.from)'),
  'Repeated screen sharing must reuse the existing WebRTC receiver.');
const screenStopBranch=engine.slice(engine.indexOf("} else {\n        state.remoteScreenTrackIds.delete(payload.from)"),engine.indexOf("emit('screen-state'"));
assert(!screenStopBranch.includes('remoteScreenStreams.delete')&&!screenStopBranch.includes('removeTrack'),
  'Stopping a share must not destroy the reusable remote screen receiver.');

if(guardian!==null){
  assert(guardian.includes("if(type==='meet.peer.state')return"),
    'Guardian must not compete with meeting-engine peer recovery.');
  assert(!guardian.includes("recoverDegradedPeers('health-check')"),
    'Guardian health polling must be observational, not destructive.');
}

assert(engine.includes("const primary=state.participantId.localeCompare(remoteId)<0"),
  'Only one deterministic peer may receive the first ICE-recovery turn.');
assert(engine.includes("(primary?5000:12000)"),
  'Transient disconnects must receive a recovery grace period.');
const peerRecovery=engine.slice(engine.indexOf('const recoverPeer = async'),engine.indexOf('const recoverPeers = async'));
assert(!peerRecovery.includes('remote-video-missing')&&!peerRecovery.includes('forceRebuild'),
  'Rendering symptoms must never destroy a live peer transport.');
assert(dock.includes("dock.addEventListener('pointerdown'")&&dock.includes('Math.hypot(dx,dy)<4'),
  'The complete participant dock must provide intentional drag activation.');
assert(dock.includes("event.target.closest(interactive)"),
  'Dock buttons and interactive controls must remain clickable.');
assert(/cursor\s*:\s*grab\s*!important/i.test(dockCss),
  'The movable dock must visibly communicate its drag surface.');
assert(engine.includes('const requestedRole=payload.targetRole||payload.role')&&engine.includes('targetRole:nextRole'),
  'A sender role must never overwrite the requested participant role.');

assert(background.includes('/float16/1/selfie_segmenter_landscape.tflite')&&!background.includes('/float16/latest/'),
  'Background segmentation must use a pinned model asset, never an unversioned latest model.');
assert(background.includes("const audioTracks = rawStream.getAudioTracks().filter(track => track.readyState === 'live')"),
  'Background processing must preserve the live microphone tracks from the raw media stream.');
assert(background.includes('const restoreStream = new MediaStream([current.sourceTrack,...audioTracks])')&&background.includes('await restoreRawSession(current)'),
  'Disabling Blur/Portrait must restore a real camera source stream while preserving audio.');
assert(background.includes('video[data-ds-background-processed="1"]{filter:none!important;}'),
  'Processed background video must own filter presentation and block legacy whole-frame CSS filters.');
assert(cameraPolish.includes('DominionBackgroundEffects2030?.getSourceTrack?.()')&&cameraPolish.includes('const track = hardwareVideoTrack();'),
  'HD constraints must target the raw hardware camera source rather than the segmented canvas track.');

assert(cameraStability.includes('enumerateDevices()')&&cameraStability.includes('deviceId:{exact:id}'),
  'Camera recovery must probe real enumerated hardware instead of repeatedly retrying one stale camera request.');
assert(cameraStability.includes('track.getSettings?.()')&&cameraStability.includes('localStorage.setItem(key, settings.deviceId)'),
  'The camera layer must remember the device that actually opened, not a stale generic selection.');
assert(cameraStability.includes('`${fallback} — name unavailable`'),
  'Unresolved camera labels must be presented as unresolved rather than pretending Camera 1 is a hardware name.');
assert(cameraStability.includes('activeResolved')&&cameraStability.includes('MutationObserver'),
  'The active hardware label must remain authoritative when the base UI rebuilds device selectors.');
assert(cameraStability.includes('getMediaPermissions')&&cameraStability.includes('requestMediaPermissions'),
  'Desktop camera acquisition must honor the native macOS permission bridge.');
assert(cameraStability.includes('enforcePrejoinCameraPrivacy')&&cameraStability.includes("if (track.readyState !== 'ended') track.stop()"),
  'Prejoin Video Off must physically release the camera instead of leaving the macOS camera light active.');
assert(cameraStability.includes('looksOpaqueLabel')&&cameraStability.includes('knownLabels'),
  'Camera settings must never promote an opaque device identifier to a hardware name.');
assert(meetIndex.indexOf('/assets/js/meet/camera-device-stability.js') < meetIndex.indexOf('/assets/js/meeting-engine.js'),
  'Camera stability must load before the meeting engine so prejoin and in-meeting acquisition share one policy.');
assert(/function supportsMacSystemPicker\(\)\s*\{\s*return false;\s*\}/.test(desktopMain),
  'The macOS system share sheet must not bypass the DominionStar desktop source picker.');
assert(desktopMain.includes('customSharePicker: !supportsMacSystemPicker()')&&desktopMain.includes('systemSharePicker: supportsMacSystemPicker()'),
  'Desktop runtime metadata must advertise DominionStar as the active share picker.');

assert(screenPermissionLifecycle.includes("getMediaAccessStatus('screen')"),
  'macOS screen permission must be read directly instead of inferred from an empty source list.');
assert(screenPermissionLifecycle.includes('desktop:screen-permission-status')&&screenPermissionLifecycle.includes('desktop:relaunch-for-permissions'),
  'The native shell must expose screen-permission status and a controlled permission relaunch.');
assert(screenPermissionLifecycle.includes('QA_PREVIEW_HOST'),
  'The same native screen-permission lifecycle must operate on the exact QA preview used by the desktop build.');
assert(desktopPreload.includes('getScreenPermissionStatus')&&desktopPreload.includes('relaunchForPermissions'),
  'The trusted preload must expose the screen-permission lifecycle to the hosted Meet UI.');
assert(desktopBootstrap.includes('screen-permission-lifecycle.mjs'),
  'The desktop bootstrap must load the native screen permission lifecycle controller.');
assert(!operationBootstrap.includes('screen-permission-ui-guard.js'),
  'The active desktop runtime must not load a second browser permission authority.');
assert(sharePicker.includes('state?.requiresRestart')&&sharePicker.includes('Restart DominionStar Meet')&&sharePicker.includes('getScreenPermissionStatus'),
  'The share picker must distinguish granted-but-stale sessions from denied permission and offer one controlled restart.');
assert(sharePicker.includes("permissionTitle.textContent='Screen access is active'")&&sharePicker.includes('SOURCE_RETRY_DELAYS'),
  'Granted permission must retry real source enumeration instead of looping back to Settings.');

assert(meetingIdentity.includes('ds-personal-room-heading')&&meetingIdentity.includes('Set your meeting identity and Personal Room defaults.'),
  'Meeting Settings must use a clear Personal Room section and concise hierarchy.');
assert(!meetingIdentity.includes('<input id="generatedWaitingRoom"')&&!meetingIdentity.includes('<input id="generatedRequirePasscode"'),
  'Meeting Settings must not duplicate Waiting Room/passcode controls for generated meetings inside Personal Room settings.');

for(const legacy of ['🎙','◉','♙','▢','Ⅱ','↗']){
  assert(!presenterToolbar.includes(legacy),`The native presenter toolbar must not use legacy glyph ${legacy}.`);
}
assert(presenterToolbar.includes('<svg')&&presenterToolbar.includes('data-command="new-share"')&&presenterToolbar.includes('data-command="pause"')&&presenterToolbar.includes('data-command="stop"'),
  'The native presenter toolbar must use vector controls for the core Zoom-style sharing actions.');
assert(ui.includes('window.dominionDesktop.updatePresenterDock?.({tiles})'),
  'The meeting runtime must publish live participant tiles while desktop sharing is active.');
assert(desktopPreload.includes("updatePresenterDock: state => ipcRenderer.send('desktop:presenter-dock-update'"),
  'The desktop preload must expose the native participant dock bridge.');
assert(desktopBootstrap.includes('presenter-dock.mjs'),
  'The desktop bootstrap must load the native presenter dock controller.');
assert(presenterDockMain.includes('alwaysOnTop:true')&&presenterDockMain.includes('resizable:true')&&presenterDockMain.includes('desktop:presenter-dock-update'),
  'The native participant dock must be a resizable always-on-top sharing surface.');
assert(presenterDockHtml.includes('-webkit-app-region:drag')&&presenterDockHtml.includes('Participant video will appear here while you share.'),
  'The native participant dock must remain movable and provide a clean empty state.');

assert(engine.includes('context.drawImage(video,0,0,width,height)')&&engine.includes('const freezeStream=canvas.captureStream(1)'),
  'Pause Share must freeze the last rendered frame rather than blank the receiver.');
assert(engine.includes('const frozen=await createFrozenScreenTrack()')&&engine.includes('state.screenPaused=true')&&engine.includes('syncPeerTracks(peer)'),
  'Pause Share must replace only the outgoing presentation sender with the frozen frame.');
assert(engine.includes('state.screenPaused=false')&&engine.includes('clearFrozenScreenTrack()'),
  'Resume Share must return receivers to the live capture and dispose the temporary frozen track.');

assert(shareLifecycle.includes('app.dock.isVisible()')&&shareLifecycle.includes('await app.dock.show()'),
  'Screen sharing must actively preserve the DominionStar macOS Dock icon.');
assert(shareLifecycle.includes('desktop:presenter-show')&&shareLifecycle.includes('desktop:presenter-hide'),
  'Dock visibility must be guarded for the full presenter lifecycle.');
assert(desktopBootstrap.includes('share-lifecycle.mjs'),
  'The desktop bootstrap must load the share-lifecycle guard.');

assert(presenterToolbarJs.includes("document.body.classList.add('stopping','collapsed')")&&presenterToolbarJs.includes("document.body.style.opacity='0'"),
  'Stop Share must immediately retire the native presenter controls.');
assert(presenterToolbarJs.includes("window.presenterBridge.command('stop')")&&presenterToolbarJs.includes('stopRecoveryTimer=setTimeout'),
  'Stop Share must still execute the real engine command and recover controls if teardown fails.');

assert(desktopPreload.includes('showRemoteControlPrompt')&&desktopPreload.includes('onRemoteControlDecision')&&desktopPreload.includes('showRemoteControlError'),
  'The preload bridge must expose the complete remote-control approval lifecycle.');
assert(remoteControlDialog.includes('desktop:remote-control-prompt')&&remoteControlDialog.includes("buttons: ['Deny', 'Approve']"),
  'Desktop remote control must present an explicit trusted-user approval dialog.');
assert(remoteControlDialog.includes('desktop:remote-control-error')&&remoteControlDialog.includes('dialog.showMessageBox'),
  'Remote-control permission failures must be surfaced through a native desktop dialog.');
assert(desktopBootstrap.includes('remote-control-dialog.mjs'),
  'The desktop bootstrap must load the native remote-control approval UI.');

assert(personalRoom.includes("$('personalRoomForm')?.addEventListener('submit'")&&!personalRoom.includes("$('savePersonalRoom')?.addEventListener('click'"),
  'Personal Room Save must execute once through the form submit contract.');

console.log('Media stability guardrails passed.');
