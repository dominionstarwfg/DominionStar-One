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

// One Electron display-media owner only. macOS 15+ delegates selection to the
// operating system picker; the DominionStar picker remains the fallback on
// older macOS and non-macOS platforms. No second session handler may return.
for(const retired of ['desktop 2/src/macos-system-picker-session.mjs','desktop 2/src/macos-screen-permission-guard.mjs','assets/js/meet/desktop-share-permission-guard.js']){
  assert.equal(exists(retired),false,`Retired capture authority returned: ${retired}`);
}
requireSource(bootstrap,dynamicImportNeedle('screen-permission-lifecycle.mjs'),'Desktop bootstrap must load screen permission lifecycle first.');
requireSource(bootstrap,dynamicImportNeedle('main-v2.mjs'),'main-v2 must remain the single Electron display-media owner.');
forbidSource(bootstrap,'macos-system-picker-session.mjs','Second macOS display-media handler must never be reinstalled.');
requireSource(main,"if (process.platform !== 'darwin') return false;",'System picker must remain macOS-only.');
requireSource(main,"process.getSystemVersion?.()",'macOS picker capability must be based on the real system version.');
requireSource(main,'major >= 15','macOS 15+ must use the native system picker.');
requireSource(main,'desktopSession.setDisplayMediaRequestHandler','Single Electron display-media handler is missing.');
requireSource(main,'{ useSystemPicker: supportsMacSystemPicker() }','Single display-media handler must delegate to the system picker when supported.');
requireSource(nativeCapture,'export function supportsNativeMacPicker()','Native capture capability reporter is missing.');
requireSource(nativeCapture,'major >= 15','Native capture capability must match the macOS 15+ policy.');
requireSource(nativeCapture,"'macos-system-picker'",'Native capture capability must identify the macOS system picker.');
requireSource(preload,"ipcRenderer.invoke('desktop:native-capture-capability')",'Renderer must read native capture capability diagnostics.');
requireSource(preload,'systemSharePicker: nativeSystemPicker','Renderer must expose native system-picker state.');
requireSource(preload,'customSharePicker: !nativeSystemPicker','Renderer must keep the DominionStar picker as the fallback only.');
requireSource(preload,'installDesktopMeetRuntimeLayers','Desktop preload must own advanced Meet runtime installation.');
requireSource(engine,'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)','Meeting engine must select exactly one picker path.');
requireSource(engine,'if (useNativeSystemPicker) {','Meeting engine must bypass the custom picker on supported macOS.');
requireSource(engine,'window.DominionDesktopSharePicker?.choose','Custom picker fallback must remain available.');
requireSource(engine,'navigator.mediaDevices.getDisplayMedia(displayOptions)','Sharing must enter standards getDisplayMedia after the selected picker path.');

// Permission diagnostics remain passive. The custom fallback picker is bounded,
// non-modal and single-flight so older macOS/Windows cannot stack native source
// enumeration calls. Modern macOS bypasses this picker entirely.
requireSource(screenLifecycle,"systemPreferences.getMediaAccessStatus('screen')",'Permission lifecycle must use lightweight macOS TCC state.');
forbidSource(screenLifecycle,'desktopCapturer','Permission-status IPC must never enumerate desktop sources.');
requireSource(screenLifecycle,'captureProbed:false','Permission status must remain a non-capture diagnostic.');
requireSource(customPicker,'dialog.show()','Desktop fallback source picker must be visible without modal UI lock.');
forbidSource(customPicker,'dialog.showModal()','Desktop fallback source picker must stay non-modal.');
requireSource(customPicker,'#desktopSharePicker::backdrop{background:transparent}','Fallback picker backdrop must not intercept meeting controls.');
requireSource(customPicker,'const withTimeout=','Fallback picker must bound native IPC waits.');
requireSource(customPicker,'const requestSources=()=>withTimeout','Fallback source enumeration must be time-bounded.');
requireSource(customPicker,"if(dialog.open)dialog.close('cancel')",'Fallback picker must close before macOS Settings opens.');
forbidSource(customPicker,"window.addEventListener('focus'",'Returning from Settings must never auto-launch capture.');
requireSource(preload,'let shareSourcesInFlight = null;','Fallback source enumeration must have a single-flight guard.');
requireSource(preload,'if (shareSourcesInFlight) return shareSourcesInFlight;','Fallback retries must reuse the outstanding native request.');
requireSource(preload,'getShareSources: (options = {}) => getShareSourcesSingleFlight(options)','Fallback bridge must route source enumeration through single-flight guard.');

// Web/Netlify remains browser-native and independent of Electron bridges.
requireSource(shareView,'const isDesktop = Boolean(window.dominionDesktop?.isDesktop)','Share controls must distinguish desktop and browser runtimes.');
forbidSource(shareView,"bootstrap.src = '/assets/js/meet/operation-2030-bootstrap.js",'Web share controls must not bootstrap desktop runtime.');
requireSource(shareView,'media.__dsWebDisplayMediaBoundary = true','Browser display-media boundary is missing.');
requireSource(shareView,'if (!window.isSecureContext)','Browser sharing must fail clearly outside HTTPS.');
requireSource(shareView,"audio: chromiumFamily && Boolean(requested.audio)",'Safari/Firefox must not be forced into unsupported system-audio capture.');
requireSource(shareView,"name === 'NotAllowedError' || name === 'SecurityError'",'Browser/OS screen-share denial needs actionable recovery.');
requireSource(netlify,'Permissions-Policy = "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)"','Netlify Meet media permissions are incomplete.');
requireSource(headers,'Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)','Published media/display-capture permissions are incomplete.');

console.log('PASS camera privacy and one-handler native-mac/fallback desktop capture path.');
