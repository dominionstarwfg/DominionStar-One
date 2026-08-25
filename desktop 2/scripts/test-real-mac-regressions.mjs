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
const home=read('meet-home/desktop.html');
const homeController=read('assets/js/meet/desktop-home-controller.js');

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

// Exactly one renderer permission flow and a side-effect-free native status API.
assert.equal(exists('assets/js/meet/desktop-share-permission-guard.js'),false);
assert.equal(exists('desktop 2/src/macos-screen-permission-guard.mjs'),false);
assert(bootstrap.indexOf("await import('./screen-permission-lifecycle.mjs')")<bootstrap.indexOf("await import('./main-v2.mjs')"));
assert(lifecycle.includes('This API is intentionally side-effect free'));
assert(!lifecycle.includes('desktopCapturer'));
assert(lifecycle.includes('restart-required-after-screen-permission-change'));
assert(picker.includes('getScreenPermissionStatus'));
assert(picker.indexOf('getScreenPermissionStatus')<picker.indexOf('getShareSources'));
assert(picker.includes("screen!=='granted'"));
assert(picker.includes('Restart DominionStar Meet'));
assert(preload.includes('customSharePicker: !nativeSystemPicker'));
assert(engine.includes('window.DominionDesktopSharePicker?.choose'));

console.log('REAL_MAC_CLEAN_RUNTIME_CONTRACT_OK');