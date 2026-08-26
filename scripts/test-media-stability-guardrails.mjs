import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const exists=rel=>fs.existsSync(new URL(`../${rel}`,import.meta.url));

const engine=read('assets/js/meeting-engine.js');
const ui=read('assets/js/meet-next/executive6.js');
const guardianUrl=new URL('../assets/js/runtime/guardian-recovery.js',import.meta.url);
const guardian=fs.existsSync(guardianUrl)?fs.readFileSync(guardianUrl,'utf8'):null;
const dock=read('assets/js/meet/dock-layout-v2.js');
const dockCss=read('assets/css/meet/dock-layout-v2.css');
const background=read('assets/js/meet/background-effects-2030.js');
const videoQuality=read('assets/js/meet/video-quality-parity.js');
const reactionPolish=read('assets/js/meet/reaction-polish.js');
const cameraCatalog=read('assets/js/meet/camera-device-stability.js');
const hostPrejoin=read('assets/js/meet/hotfix-rc13-1-media-prejoin.js');
const sharePicker=read('assets/js/meet/desktop-share-picker.js');
const personalRoom=read('assets/js/meet-next/personal-room.js');
const homeController=read('assets/js/meet/desktop-home-controller.js');
const meetIndex=read('meet/index.html');
const desktopMain=read('desktop 2/src/main-v2.mjs');
const desktopPreload=read('desktop 2/src/preload.cjs');
const desktopBootstrap=read('desktop 2/src/bootstrap.mjs');
const presenterToolbar=read('desktop 2/src/presenter-toolbar.html');
const presenterToolbarJs=read('desktop 2/src/presenter-toolbar.js');
const presenterDockMain=read('desktop 2/src/presenter-dock.mjs');
const presenterDockHtml=read('desktop 2/src/presenter-dock.html');
const shareLifecycle=read('desktop 2/src/share-lifecycle.mjs');
const remoteControlDialog=read('desktop 2/src/remote-control-dialog.mjs');
const screenLifecycle=read('desktop 2/src/screen-permission-lifecycle.mjs');
const operationBootstrap=read('assets/js/meet/operation-2030-bootstrap.js');

// Rendering symptoms must never destroy healthy WebRTC transport.
assert(!ui.includes("recoverPeer?.(participantId,{reason:'guardian-remote-video-missing'})"));
const reconciler=ui.slice(ui.indexOf('function reconcileMeetingView()'),ui.indexOf('function startViewReconciler()'));
assert(!reconciler.includes('requestMediaResync'));
assert(engine.includes('remoteTrackStreamIds'));
assert(engine.includes('const preservedScreen=state.remoteScreenStreams.get(payload.from)'));
if(guardian!==null){assert(guardian.includes("if(type==='meet.peer.state')return"));assert(!guardian.includes("recoverDegradedPeers('health-check')"));}
assert(engine.includes("const primary=state.participantId.localeCompare(remoteId)<0"));
const peerRecovery=engine.slice(engine.indexOf('const recoverPeer = async'),engine.indexOf('const recoverPeers = async'));
assert(!peerRecovery.includes('remote-video-missing')&&!peerRecovery.includes('forceRebuild'));

// Participant dock remains movable without swallowing button clicks.
assert(dock.includes("dock.addEventListener('pointerdown'")&&dock.includes('Math.hypot(dx,dy)<4'));
assert(dock.includes("event.target.closest(interactive)"));
assert(/cursor\s*:\s*grab\s*!important/i.test(dockCss));

// Optional background processing is a single pipeline and preserves audio.
assert(background.includes('/float16/1/selfie_segmenter_landscape.tflite')&&!background.includes('/float16/latest/'));
assert(background.includes("const audioTracks = rawStream.getAudioTracks().filter(track => track.readyState === 'live')"));
assert(background.includes('await restoreRawSession(current)'));
assert(videoQuality.includes('DominionVideoIntelligenceCompositor?.getSourceTrack?.()')&&videoQuality.includes('DominionBackgroundEffects2030?.getSourceTrack?.()'));

// Reaction presentation never owns media hardware and is lazy.
assert(reactionPolish.includes('DominionReactionPolish'));
assert(!reactionPolish.includes('enumerateDevices')&&!reactionPolish.includes('getUserMedia')&&!reactionPolish.includes('MutationObserver'));
assert(operationBootstrap.includes('loadReactions'));
assert(operationBootstrap.includes("reaction-polish.js?v=2-on-demand"));

// Single-owner camera/media behavior.
assert(ui.includes('const PREVIEW_CAMERA_RETRY_DELAYS_MS=[0,320,760,1400]'));
assert(ui.includes('const acquireUserMediaStable=async constraints=>'));
assert(cameraCatalog.includes('enumerateDevices()')&&cameraCatalog.includes('cameraSelect')&&cameraCatalog.includes('microphoneSelect')&&cameraCatalog.includes('speakerSelect'));
assert(!cameraCatalog.includes('media.getUserMedia =')&&!cameraCatalog.includes('MutationObserver')&&!cameraCatalog.includes('.stop()'));
assert(hostPrejoin.includes('getMediaPermissions')&&hostPrejoin.includes('requestMediaPermissions'));
assert(hostPrejoin.includes('stopTracks(hostPreviewStream)')&&hostPrejoin.includes('await sleep(220)'));
assert(!hostPrejoin.includes('navigator.mediaDevices.getUserMedia ='));
assert(meetIndex.indexOf('/assets/js/meet/camera-device-stability.js')<meetIndex.indexOf('/assets/js/meeting-engine.js'));

// Startup is bounded. Heavy video/presentation modules are lazy.
assert(operationBootstrap.includes("version:'3.0.0-clean-lazy-runtime'"));
assert(operationBootstrap.includes('requestIdleCallback'));
assert(operationBootstrap.includes('loadMediaEnhancements'));
assert(operationBootstrap.includes('loadPresentationTools'));
assert(!operationBootstrap.includes('meeting-identity-settings')&&!operationBootstrap.includes('meeting-identity-bridge')&&!operationBootstrap.includes('media-effect-safety'));

// Physical-Mac share stability: one display-media owner, passive permission
// diagnostics, non-modal picker, no focus-triggered recovery, and single-flight
// native source enumeration.
assert.equal(exists('desktop 2/src/macos-system-picker-session.mjs'),false);
assert.equal(exists('desktop 2/src/macos-screen-permission-guard.mjs'),false);
assert.equal(exists('assets/js/meet/desktop-share-permission-guard.js'),false);
assert(screenLifecycle.includes("getMediaAccessStatus('screen')"));
assert(!screenLifecycle.includes('desktopCapturer')&&!screenLifecycle.includes('getSources('));
assert(screenLifecycle.includes('captureProbed:false'));
assert(screenLifecycle.includes("requiresRestart:process.platform==='darwin'&&granted&&initialScreenPermission!=='granted'"));
assert(screenLifecycle.includes('desktop:screen-permission-status')&&screenLifecycle.includes('desktop:relaunch-for-permissions'));
assert(desktopPreload.includes('getScreenPermissionStatus')&&desktopPreload.includes('relaunchForPermissions'));
assert(desktopBootstrap.indexOf("screen-permission-lifecycle.mjs")<desktopBootstrap.indexOf("main-v2.mjs"));
assert(!desktopBootstrap.includes('macos-system-picker-session.mjs'));
assert(desktopMain.includes('function supportsMacSystemPicker() {\n  return false;'));
assert(desktopMain.includes('desktopSession.setDisplayMediaRequestHandler'));
assert(sharePicker.includes('getScreenPermissionStatus'));
assert(sharePicker.includes('const withTimeout='));
assert(sharePicker.includes('const requestSources=()=>withTimeout'));
assert(sharePicker.includes('if(!dialog.open)dialog.show()'));
assert(!sharePicker.includes('dialog.showModal()'));
assert(sharePicker.includes('markRestartNeeded();'));
assert(sharePicker.includes("if(dialog.open)dialog.close('cancel')"));
assert(!sharePicker.includes("window.addEventListener('focus'"));
assert(desktopPreload.includes('let shareSourcesInFlight = null;'));
assert(desktopPreload.includes('if (shareSourcesInFlight) return shareSourcesInFlight;'));
assert(desktopPreload.includes('getShareSources: (options = {}) => getShareSourcesSingleFlight(options)'));

// Desktop Personal Room has one account-backed authority. No local random PMIs.
assert(homeController.includes('meet_personal_rooms'));
assert(homeController.includes('Personal Room identity is not configured. DominionStar will not generate a replacement ID locally.'));
assert(!homeController.includes('randomDigits'));
assert.equal(exists('assets/js/meet/meeting-identity-settings.js'),false);
assert.equal(exists('assets/js/meet/meeting-identity-bridge.js'),false);
assert(personalRoom.includes("$('personalRoomForm')?.addEventListener('submit'"));

// Native presenter/dock lifecycle remains functional.
for(const legacy of ['🎙','◉','♙','▢','Ⅱ','↗'])assert(!presenterToolbar.includes(legacy));
assert(presenterToolbar.includes('<svg')&&presenterToolbar.includes('data-command="new-share"')&&presenterToolbar.includes('data-command="pause"')&&presenterToolbar.includes('data-command="stop"'));
assert(ui.includes('window.dominionDesktop.updatePresenterDock?.({tiles})'));
assert(desktopPreload.includes("updatePresenterDock: state => ipcRenderer.send('desktop:presenter-dock-update'"));
assert(desktopBootstrap.includes('presenter-dock.mjs'));
assert(presenterDockMain.includes('alwaysOnTop:true')&&presenterDockMain.includes('resizable:true'));
assert(presenterDockHtml.includes('-webkit-app-region:drag'));

// Pause Share freezes the last frame and resumes the original presentation lane.
assert(engine.includes('context.drawImage(video,0,0,width,height)')&&engine.includes('const freezeStream=canvas.captureStream(1)'));
assert(engine.includes('const frozen=await createFrozenScreenTrack()')&&engine.includes('state.screenPaused=true'));
assert(engine.includes('state.screenPaused=false')&&engine.includes('clearFrozenScreenTrack()'));

assert(shareLifecycle.includes('app.dock.isVisible()')&&shareLifecycle.includes('await app.dock.show()'));
assert(desktopBootstrap.includes('share-lifecycle.mjs'));
assert(presenterToolbarJs.includes("window.presenterBridge.command('stop')")&&presenterToolbarJs.includes('stopRecoveryTimer=setTimeout'));
assert(desktopPreload.includes('showRemoteControlPrompt')&&desktopPreload.includes('onRemoteControlDecision'));
assert(remoteControlDialog.includes("buttons: ['Deny', 'Approve']"));

console.log('MEDIA_STABILITY_PHYSICAL_MAC_SHARE_OK single-owner no-auto-focus single-flight');
