import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../../${rel}`,import.meta.url),'utf8');
const exists=rel=>fs.existsSync(new URL(`../../${rel}`,import.meta.url));

const memberLogin=read('assets/js/member-login.js');
const cameraCatalog=read('assets/js/meet/camera-device-stability.js');
const ui=read('assets/js/meet-next/executive6.js');
const hostPrejoin=read('assets/js/meet/hotfix-rc13-1-media-prejoin.js');
const operationBootstrap=read('assets/js/meet/operation-2030-bootstrap.js');
const picker=read('assets/js/meet/desktop-share-picker.js');
const engine=read('assets/js/meeting-engine.js');
const main=read('desktop 2/src/main-v2.mjs');
const bootstrap=read('desktop 2/src/bootstrap.mjs');
const preload=read('desktop 2/src/preload.cjs');
const navigation=read('desktop 2/src/desktop-navigation-authority.mjs');
const lifecycle=read('desktop 2/src/screen-permission-lifecycle.mjs');
const nativeCapture=read('desktop 2/src/macos-native-capture-authority.mjs');
const nativePickerSession=read('desktop 2/src/macos-system-picker-session.mjs');
const home=read('meet-home/desktop.html');
const homeController=read('assets/js/meet/desktop-home-controller.js');
const compactHome=read('assets/js/meet/desktop-home-compact-launch.js');

// Authentication remains external-browser OAuth returning through deep link.
assert(memberLogin.includes("provider: 'google'"));
assert(memberLogin.includes("redirectTo: 'dominionstar://auth/callback'"));
assert(memberLogin.includes('supabase.auth.setSession({'));
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"));

// Desktop app owns only Meet/auth routes. Public product pages stay external.
assert(bootstrap.indexOf("await import('./desktop-navigation-authority.mjs')")<bootstrap.indexOf("await import('./main-v2.mjs')"));
assert(navigation.includes("INTERNAL_PATHS=new Set(['/meet','/meet-home','/meet-login','/member-login'])"));
assert(navigation.includes('shell.openExternal(url.toString())'));
assert(home.includes('desktop-home-controller.js?v=1-single-authority'));
assert(homeController.includes('DominionDesktopHomeController'));
assert(!navigation.includes('resolveDesktopHostIdentity'));
assert(!navigation.includes('installDesktopSettingsAuthority'));
assert(compactHome.includes("strong.textContent='Start Meeting'"));
assert(compactHome.includes('role="switch"'));
assert(compactHome.includes('personalButton?.remove?.()'));

// Camera device catalog remains passive; media acquisition has bounded owners.
assert(cameraCatalog.includes('enumerateDevices()'));
assert(cameraCatalog.includes('cameraSelect')&&cameraCatalog.includes('microphoneSelect')&&cameraCatalog.includes('speakerSelect'));
assert(!cameraCatalog.includes('media.getUserMedia ='));
assert(!cameraCatalog.includes('MutationObserver'));
assert(!cameraCatalog.includes('.stop()'));
assert(ui.includes('const PREVIEW_CAMERA_RETRY_DELAYS_MS=[0,320,760,1400]'));
assert(ui.includes('const acquireUserMediaStable=async constraints=>'));
assert(engine.includes('state.lastCameraReleaseAt=Date.now()'));
assert(engine.includes('recoverCameraTrack({intentSeq:seq})'));
assert(hostPrejoin.includes('await ensureNativeMediaPermissions(constraints);'));
assert(hostPrejoin.includes('stopTracks(hostPreviewStream);'));
assert(hostPrejoin.includes('await sleep(220);'));
assert(!hostPrejoin.includes('navigator.mediaDevices.getUserMedia ='));

// Advanced meeting modules no longer all execute during startup.
assert(operationBootstrap.includes("version:'3.0.0-clean-lazy-runtime'"));
assert(operationBootstrap.includes('loadMediaEnhancements'));
assert(operationBootstrap.includes('loadPresentationTools'));
assert(!operationBootstrap.includes('meeting-identity-settings'));
assert(!operationBootstrap.includes('media-effect-safety'));

// Physical Mac Share Screen regression. macOS 15+ must delegate source choice to
// Electron's native system picker. The old custom-only path froze after Screen
// & System Audio Recording permission changes. A small fallback capture probe is
// allowed only as bounded diagnostics so real capture can override stale TCC.
assert.equal(exists('assets/js/meet/desktop-share-permission-guard.js'),false);
assert.equal(exists('desktop 2/src/macos-screen-permission-guard.mjs'),false);
assert(bootstrap.indexOf("await import('./screen-permission-lifecycle.mjs')")<bootstrap.indexOf("await import('./main-v2.mjs')"));
assert(bootstrap.includes("await import('./macos-system-picker-session.mjs')"));
assert(nativeCapture.includes('enabled: nativePicker'));
assert(nativeCapture.includes("nativePicker ? 'macos-system-picker' : 'dominionstar-custom-picker'"));
assert(nativePickerSession.includes('{ useSystemPicker: true }'));
assert(lifecycle.includes('desktopCapturer.getSources'));
assert(lifecycle.includes('CAPTURE_PROBE_TIMEOUT_MS=1800'));
assert(lifecycle.includes('if(probe.captureReady)return'));
assert(lifecycle.includes('requiresRestart:false'));
assert(picker.includes('getScreenPermissionStatus'));
assert(picker.includes('const withTimeout='));
assert(picker.includes('const requestSources=()=>withTimeout'));
assert(picker.includes("if(sources.length){permission.hidden=true;list.hidden=false"));
assert(picker.includes("if(runtime?.platform==='darwin'){showProblem(await status());return;}"));
assert(picker.includes('if(current?.captureReady){void loadSources();return;}'));
assert(picker.includes('Restart DominionStar Meet'));
assert(preload.includes('systemSharePicker: nativeSystemPicker'));
assert(preload.includes('customSharePicker: !nativeSystemPicker'));
assert(engine.includes('const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)'));
assert(engine.includes('window.DominionDesktopSharePicker?.choose'));

console.log('REAL_MAC_PHYSICAL_SHARE_RECOVERY_CONTRACT_OK');