import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const memberLogin = read('assets/js/member-login.js');
const camera = read('assets/js/meet/camera-device-stability.js');
const screenGuard = read('assets/js/meet/screen-permission-ui-guard.js');
const engine = read('assets/js/meeting-engine.js');
const main = read('desktop 2/src/main-v2.mjs');
const bootstrap = read('desktop 2/src/bootstrap.mjs');
const preload = read('desktop 2/src/preload.cjs');
const nativeCapture = read('desktop 2/src/macos-native-capture-authority.mjs');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');

// Real-device regression: desktop authentication must remain a Meet flow, not
// embed the public DominionStar website inside the Electron application.
assert(memberLogin.includes("provider: 'google'"), 'Desktop login must expose Google OAuth.');
assert(memberLogin.includes("redirectTo: 'dominionstar://auth/callback'"), 'Desktop Google OAuth must return through the DominionStar deep link.');
assert(memberLogin.includes("skipBrowserRedirect: true"), 'Desktop Google OAuth must use the system browser instead of embedding Google inside Electron.');
assert(memberLogin.includes("returnLink.textContent = '← Back to DominionStar Meet'"), 'Desktop login must return to DominionStar Meet, not the public platform.');
assert(memberLogin.includes("return '/meet-home/?desktop=1'"), 'Desktop authentication must default back to Meet Home.');
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"), 'Native app must accept the DominionStar OAuth callback.');

// The desktop shell is a meeting application, not an embedded browser for the
// public DominionStar site. Register navigation authority before main-v2 creates
// the first BrowserWindow and force QA preview chrome out of internal routes.
assert(bootstrap.indexOf("await import('./desktop-navigation-authority.mjs')") < bootstrap.indexOf("await import('./main-v2.mjs')"), 'Desktop navigation authority must load before main window startup.');
assert(navigation.includes("const INTERNAL_PATHS = new Set(['/meet', '/meet-home', '/meet-login', '/member-login'])"), 'Desktop internal route allowlist changed unexpectedly.');
assert(navigation.includes("const ACCOUNT_RETURN_PATHS = new Set(['/member-dashboard', '/workspace'])"), 'Desktop account-return routes must resolve back to Meet Home.');
assert(navigation.includes("void shell.openExternal(url.toString())"), 'Public DominionStar routes must open in the system browser instead of replacing the desktop app.');
assert(navigation.includes("target.searchParams.set('ntl-drawer-state', 'hidden')"), 'QA preview routes must suppress the Netlify collaboration drawer.');
assert(navigation.includes("target.searchParams.set('desktop', '1')"), 'Internal desktop navigation must preserve desktop mode.');

// Real-device regression: camera can be visibly live even while enumerateDevices
// is briefly empty. Settings must still identify the physical active track.
assert(camera.includes('let lastLiveVideoTrack = null;'), 'Camera layer must retain the active video track.');
assert(camera.includes("if (lastLiveVideoTrack?.readyState === 'live') return lastLiveVideoTrack;"), 'Active video track must be authoritative for camera identity.');
assert(camera.includes('activeSynthetic: true'), 'Camera settings must synthesize an active-device row when enumeration lags.');
assert(camera.includes('activeCameraDeviceId:'), 'Camera diagnostics must expose the active deviceId.');
assert(camera.includes('scheduleDeviceRefresh'), 'Camera labels must be re-hydrated after media startup.');

// Real-device regression: Apple's own Screen Recording dialog can send the user
// to System Settings without clicking DominionStar's custom settings button.
assert(screenGuard.includes("window.addEventListener('blur'"), 'Screen permission recovery must detect OS-owned settings flows.');
assert(screenGuard.includes('PERMISSION_FLOW_KEY'), 'Screen permission flow state must survive blur/focus transitions.');
assert(screenGuard.includes('relaunchOnceAfterPermissionFlow'), 'Newly granted macOS screen permission must be applied by one controlled relaunch.');
assert(screenGuard.includes("restart.textContent = 'Retry Capture'"), 'Granted screen permission must retry capture instead of looping back to Settings.');
assert(screenGuard.includes("version: '1.1.0'"), 'Updated macOS permission recovery layer must be active.');

// Known-good August 16 recovery: supported Macs use one native picker authority.
// The custom DominionStar picker remains a fallback for Windows/older macOS but
// cannot compete with Apple's picker in the same share transaction.
assert(bootstrap.includes("await import('./macos-native-capture-authority.mjs')"), 'Desktop bootstrap must install native macOS capture authority.');
assert(nativeCapture.includes('major >= 15'), 'Native picker must be gated to supported macOS versions.');
assert(nativeCapture.includes('{ useSystemPicker: true }'), 'Native capture authority must enable Electron system picker mode.');
assert(nativeCapture.includes("authority: supportsNativeMacPicker() ? 'macos-system-picker' : 'dominionstar-custom-picker'"), 'Native capture capability must report a single authority.');
assert(preload.includes('systemSharePicker: nativeSystemPicker'), 'Preload must expose native picker authority to meeting runtime.');
assert(preload.includes('customSharePicker: !nativeSystemPicker'), 'Preload must disable the custom picker when native authority is active.');
assert(engine.includes('const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)'), 'Meeting engine must consume the native picker capability.');
assert(engine.includes('window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose'), 'Meeting engine must never open both picker authorities.');

console.log('Real Mac auth/navigation/camera/single-authority screen-share regression contract passed.');
