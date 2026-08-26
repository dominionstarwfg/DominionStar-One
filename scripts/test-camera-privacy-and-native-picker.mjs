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
const sharePickerAuthority=read('desktop 2/src/share-picker-authority.mjs');
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

// One visible DominionStar source chooser, matching the approved illustration.
// macOS remains the TCC/capture authority underneath, but it must not surface a
// second picker. Native source enumeration is single-flight and bounded so a
// slow permission transition cannot freeze the meeting event loop.
for(const retired of ['desktop 2/src/macos-system-picker-session.mjs','desktop 2/src/macos-screen-permission-guard.mjs','assets/js/meet/desktop-share-permission-guard.js']){
  assert.equal(exists(retired),false,`Retired capture authority returned: ${retired}`);
}
requireSource(bootstrap,dynamicImportNeedle('share-picker-authority.mjs'),'Desktop bootstrap must install the approved share-picker authority first.');
requireSource(bootstrap,dynamicImportNeedle('screen-permission-lifecycle.mjs'),'Desktop bootstrap must load screen permission lifecycle before main runtime.');
assert(bootstrap.indexOf(dynamicImportNeedle('share-picker-authority.mjs'))<bootstrap.indexOf(dynamicImportNeedle('main-v2.mjs')),'Share-picker authority must install before main-v2.');
requireSource(bootstrap,dynamicImportNeedle('main-v2.mjs'),'main-v2 must remain the single Electron display-media owner.');
forbidSource(bootstrap,'macos-system-picker-session.mjs','Second macOS display-media handler must never be reinstalled.');
requireSource(main,'desktopSession.setDisplayMediaRequestHandler','Single Electron display-media handler is missing.');
assert.equal((main.match(/setDisplayMediaRequestHandler/g)||[]).length,1,'Desktop must expose exactly one display-media handler.');
requireSource(main,"types: ['screen', 'window']",'Capture authority must resolve both screens and application windows.');
requireSource(sharePickerAuthority,'SOURCE_ENUMERATION_TIMEOUT_MS = 4500','Native source enumeration must have a strict timeout.');
requireSource(sharePickerAuthority,'sourceEnumerationInFlight','Native source enumeration must be single-flight.');
requireSource(sharePickerAuthority,'Promise.race([sourceEnumerationInFlight, timeoutResult()])','A stalled native source request must release the UI.');
requireSource(sharePickerAuthority,'useSystemPicker: false','A second Apple picker must be disabled while DominionStar owns visible selection.');
requireSource(nativeCapture,'export function supportsNativeMacPicker()','Capture capability contract is missing.');
requireSource(nativeCapture,'return false;','Approved desktop flow must keep the DominionStar chooser as the visible picker.');
requireSource(nativeCapture,"'macos-system-picker'",'Diagnostics must still name the alternate native authority truthfully.');
requireSource(nativeCapture,"'dominionstar-custom-picker'",'Diagnostics must identify DominionStar source-selection authority.');
requireSource(preload,"ipcRenderer.invoke('desktop:native-capture-capability')",'Renderer must read capture capability diagnostics.');
requireSource(preload,'systemSharePicker: nativeSystemPicker','Renderer must expose native system-picker state.');
requireSource(preload,'customSharePicker: !nativeSystemPicker','Renderer must expose DominionStar source-picker state.');
requireSource(preload,'installDesktopMeetRuntimeLayers','Desktop preload must own advanced Meet runtime installation.');
requireSource(engine,'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)','Meeting engine must select exactly one picker path.');
requireSource(engine,'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose','DominionStar source selection must own the installed desktop picker path.');
requireSource(engine,'window.DominionDesktopSharePicker?.choose','DominionStar picker must remain available.');
requireSource(engine,'navigator.mediaDevices.getDisplayMedia(displayOptions)','Sharing must enter standards getDisplayMedia after source selection.');

// Permission diagnostics remain passive. The approved DominionStar chooser is
// non-modal and bounded so it cannot lock the meeting while macOS handles TCC.
requireSource(screenLifecycle,"systemPreferences.getMediaAccessStatus('screen')",'Permission lifecycle must use lightweight macOS TCC state.');
forbidSource(screenLifecycle,'desktopCapturer','Permission-status IPC must never enumerate desktop sources.');
requireSource(screenLifecycle,'captureProbed:false','Permission status must remain a non-capture diagnostic.');
requireSource(customPicker,'data-filter="screen">Screens','Approved picker must expose Screens.');
requireSource(customPicker,'data-filter="window">Applications','Approved picker must expose Applications.');
requireSource(customPicker,'dialog.show()','DominionStar picker must be visible without modal UI lock.');
forbidSource(customPicker,'dialog.showModal()','DominionStar picker must stay non-modal.');
requireSource(customPicker,'#desktopSharePicker::backdrop{background:transparent}','Picker backdrop must not intercept meeting controls.');
requireSource(customPicker,'const withTimeout=','Picker must bound native IPC waits.');
requireSource(customPicker,'const requestSources=()=>withTimeout','Source enumeration must be time-bounded.');
requireSource(customPicker,"if(dialog.open)dialog.close('cancel')",'Picker must close before macOS Settings opens.');
forbidSource(customPicker,"window.addEventListener('focus'",'Returning from Settings must never auto-launch capture.');
requireSource(preload,'let shareSourcesInFlight = null;','Renderer source enumeration must have a single-flight guard.');
requireSource(preload,'if (shareSourcesInFlight) return shareSourcesInFlight;','Picker retries must reuse the outstanding native request.');
requireSource(preload,'getShareSources: (options = {}) => getShareSourcesSingleFlight(options)','Desktop bridge must route source enumeration through the renderer single-flight guard.');

// Web/Netlify remains browser-native and independent of Electron bridges.
requireSource(shareView,'const isDesktop = Boolean(window.dominionDesktop?.isDesktop)','Share controls must distinguish desktop and browser runtimes.');
forbidSource(shareView,"bootstrap.src = '/assets/js/meet/operation-2030-bootstrap.js",'Web share controls must not bootstrap desktop runtime.');
requireSource(shareView,'media.__dsWebDisplayMediaBoundary = true','Browser display-media boundary is missing.');
requireSource(shareView,'if (!window.isSecureContext)','Browser sharing must fail clearly outside HTTPS.');
requireSource(shareView,"audio: chromiumFamily && Boolean(requested.audio)",'Safari/Firefox must not be forced into unsupported system-audio capture.');
requireSource(shareView,"name === 'NotAllowedError' || name === 'SecurityError'",'Browser/OS screen-share denial needs actionable recovery.');
requireSource(netlify,'Permissions-Policy = "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)"','Netlify Meet media permissions are incomplete.');
requireSource(headers,'Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)','Published media/display-capture permissions are incomplete.');

console.log('PASS camera privacy + approved DominionStar Screens/Applications picker + bounded single-flight native capture path.');
