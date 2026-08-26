import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const exists=rel=>fs.existsSync(new URL(`../${rel}`,import.meta.url));
const engine=read('assets/js/meeting-engine.js');
const ui=read('assets/js/meet-next/executive6.js');
const shareView=read('assets/js/meet/share-view-controls.js');
const main=read('desktop 2/src/main-v2.mjs');
const bootstrap=read('desktop 2/src/bootstrap.mjs');
const preload=read('desktop 2/src/preload.cjs');
const nativeCapture=read('desktop 2/src/macos-native-capture-authority.mjs');
const screenLifecycle=read('desktop 2/src/screen-permission-lifecycle.mjs');
const customPicker=read('assets/js/meet/desktop-share-picker.js');
const netlify=read('netlify.toml');
const headers=read('_headers');

const requireSource=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};
const forbidSource=(source,needle,message)=>{if(source.includes(needle))throw new Error(message);};
const dynamicImportNeedle=file=>`await ${'import'}('./${file}')`;

// Camera Off is a real hardware privacy boundary and must support reliable
// reacquisition rather than leaving a hidden live track behind.
requireSource(engine,"const cameraTracks=[...(base?.getVideoTracks?.()||[])]",'Video Off does not enumerate every local camera track.');
requireSource(engine,"if(base?.getVideoTracks?.().includes(item)){try{base.removeTrack(item);}catch(_){}}",'Video Off does not detach local camera tracks.');
requireSource(engine,"if(item?.readyState!=='ended'){try{item.stop();released=true;}catch(_){}}",'Video Off does not physically stop live camera tracks.');
requireSource(engine,"if(released||cameraTracks.length)state.lastCameraReleaseAt=Date.now()",'Camera hardware release is not recorded for stable reacquisition.');
requireSource(engine,"Promise.allSettled([...state.peers.values()].map(peer=>syncPeerTracks(peer)))",'Camera Off does not clear negotiated peer senders.');
requireSource(ui,"video:state.video?{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}:false",'Prejoin does not preserve HD/30 camera intent.');
requireSource(ui,"state.stream.removeTrack(track)",'Prejoin Camera Off does not detach its camera track.');
requireSource(ui,'markPreviewCameraReleased()','Prejoin Camera Off does not mark the hardware-release boundary.');

// One Electron display-media owner and one visible source-selection surface.
// DominionStar owns the approved Zoom-style picker on every desktop platform;
// macOS/Windows remain the underlying permission and capture authorities.
for(const retired of ['desktop 2/src/macos-system-picker-session.mjs','desktop 2/src/macos-screen-permission-guard.mjs','assets/js/meet/desktop-share-permission-guard.js']){
  assert.equal(exists(retired),false,`Retired capture authority returned: ${retired}`);
}
requireSource(bootstrap,dynamicImportNeedle('screen-permission-lifecycle.mjs'),'Desktop bootstrap must load screen permission lifecycle first.');
requireSource(bootstrap,dynamicImportNeedle('main-v2.mjs'),'main-v2 must remain the single Electron display-media owner.');
forbidSource(bootstrap,'macos-system-picker-session.mjs','Second macOS display-media handler must never be reinstalled.');
requireSource(main,"function supportsMacSystemPicker() {\n  return false;\n}",'Apple system picker must stay disabled while DominionStar owns source selection.');
requireSource(main,'desktopSession.setDisplayMediaRequestHandler','Single Electron display-media handler is missing.');
requireSource(main,'{ useSystemPicker: supportsMacSystemPicker() }','Single display-media handler must explicitly keep system-picker delegation disabled.');
requireSource(main,"types: ['screen', 'window']",'DominionStar capture authority must resolve screens and application windows.');
requireSource(nativeCapture,"export function supportsNativeMacPicker() {\n  return false;\n}",'Native capture capability reporter must keep Apple source selection disabled.');
forbidSource(nativeCapture,'major >= 15','macOS version must not silently re-enable a second system picker.');
requireSource(nativeCapture,"'dominionstar-custom-picker'",'Native capture diagnostics must identify DominionStar as source-selection authority.');
requireSource(preload,"ipcRenderer.invoke('desktop:native-capture-capability')",'Renderer must read native capture capability diagnostics.');
requireSource(preload,'systemSharePicker: nativeSystemPicker','Renderer must expose native system-picker state.');
requireSource(preload,'customSharePicker: !nativeSystemPicker','Renderer must expose DominionStar source-picker state.');
requireSource(preload,'installDesktopMeetRuntimeLayers','Desktop preload must own advanced Meet runtime installation.');
requireSource(engine,'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)','Meeting engine must select exactly one picker path.');
requireSource(engine,'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose','DominionStar source selection must be used when the native system picker is disabled.');
requireSource(engine,'window.DominionDesktopSharePicker?.choose','DominionStar picker must remain available.');
requireSource(engine,'navigator.mediaDevices.getDisplayMedia(displayOptions)','Sharing must enter standards getDisplayMedia after DominionStar source selection.');

// Permission diagnostics remain passive. The DominionStar picker is bounded,
// non-modal and single-flight so permission transitions cannot stack native
// enumeration calls or create multiple competing picker surfaces.
requireSource(screenLifecycle,"systemPreferences.getMediaAccessStatus('screen')",'Permission lifecycle must use lightweight macOS TCC state.');
forbidSource(screenLifecycle,'desktopCapturer','Permission-status IPC must never enumerate desktop sources.');
requireSource(screenLifecycle,'captureProbed:false','Permission status must remain a non-capture diagnostic.');
requireSource(customPicker,'dialog.show()','DominionStar source picker must be visible without modal UI lock.');
forbidSource(customPicker,'dialog.showModal()','DominionStar source picker must stay non-modal.');
requireSource(customPicker,'#desktopSharePicker::backdrop{background:transparent}','Picker backdrop must not intercept meeting controls.');
requireSource(customPicker,'const withTimeout=','Picker must bound native IPC waits.');
requireSource(customPicker,'const requestSources=()=>withTimeout','Source enumeration must be time-bounded.');
requireSource(customPicker,"if(dialog.open)dialog.close('cancel')",'Picker must close before macOS Settings opens.');
forbidSource(customPicker,"window.addEventListener('focus'",'Returning from Settings must never auto-launch capture.');
requireSource(preload,'let shareSourcesInFlight = null;','Source enumeration must have a single-flight guard.');
requireSource(preload,'if (shareSourcesInFlight) return shareSourcesInFlight;','Picker retries must reuse the outstanding native request.');
requireSource(preload,'getShareSources: (options = {}) => getShareSourcesSingleFlight(options)','Desktop bridge must route source enumeration through single-flight guard.');

// Web/Netlify remains browser-native and independent of Electron bridges.
requireSource(shareView,'const isDesktop = Boolean(window.dominionDesktop?.isDesktop)','Share controls must distinguish desktop and browser runtimes.');
forbidSource(shareView,"bootstrap.src = '/assets/js/meet/operation-2030-bootstrap.js",'Web share controls must not bootstrap desktop runtime.');
requireSource(shareView,'media.__dsWebDisplayMediaBoundary = true','Browser display-media boundary is missing.');
requireSource(shareView,'if (!window.isSecureContext)','Browser sharing must fail clearly outside HTTPS.');
requireSource(shareView,"audio: chromiumFamily && Boolean(requested.audio)",'Safari/Firefox must not be forced into unsupported system-audio capture.');
requireSource(shareView,"name === 'NotAllowedError' || name === 'SecurityError'",'Browser/OS screen-share denial needs actionable recovery.');
requireSource(netlify,'Permissions-Policy = "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)"','Netlify Meet media permissions are incomplete.');
requireSource(headers,'Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)','Published media/display-capture permissions are incomplete.');

console.log('PASS camera privacy and one-handler DominionStar desktop capture path.');
