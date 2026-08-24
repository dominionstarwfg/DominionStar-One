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

// Desktop authentication is a Meet flow, not an embedded copy of the public site.
assert(memberLogin.includes("provider: 'google'"), 'Desktop login must expose Google OAuth.');
assert(memberLogin.includes("redirectTo: 'dominionstar://auth/callback'"), 'Desktop Google OAuth must return through the DominionStar deep link.');
assert(memberLogin.includes("skipBrowserRedirect: true"), 'Desktop Google OAuth must use the system browser instead of embedding Google inside Electron.');
assert(memberLogin.includes("returned.get('access_token')"), 'Desktop OAuth callback must consume the returned access token.');
assert(memberLogin.includes("returned.get('refresh_token')"), 'Desktop OAuth callback must consume the returned refresh token.');
assert(memberLogin.includes('supabase.auth.setSession({'), 'Desktop OAuth callback must persist the browser-authenticated session inside Electron.');
assert(memberLogin.includes("returnLink.textContent = '← Back to DominionStar Meet'"), 'Desktop login must return to DominionStar Meet, not the public platform.');
assert(memberLogin.includes("return '/meet-home/?desktop=1'"), 'Desktop authentication must default back to Meet Home.');
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"), 'Native app must accept the DominionStar OAuth callback.');

// The desktop shell is a meeting application, not a generic embedded browser.
assert(bootstrap.indexOf("await import('./desktop-navigation-authority.mjs')") < bootstrap.indexOf("await import('./main-v2.mjs')"), 'Desktop navigation authority must load before main window startup.');
assert(navigation.includes("const INTERNAL_PATHS = new Set(['/meet', '/meet-home', '/meet-login', '/member-login'])"), 'Desktop internal route allowlist changed unexpectedly.');
assert(navigation.includes("const ACCOUNT_RETURN_PATHS = new Set(['/member-dashboard', '/workspace'])"), 'Desktop account-return routes must resolve back to Meet Home.');
assert(navigation.includes("void shell.openExternal(url.toString())"), 'Public DominionStar routes must open in the system browser instead of replacing the desktop app.');
assert(navigation.includes("target.searchParams.set('ntl-drawer-state', 'hidden')"), 'QA preview routes must request a hidden Netlify collaboration drawer.');
assert(navigation.includes("Collaborate on this Deploy Preview"), 'QA desktop shell must actively remove leaked Netlify preview chrome.');
assert(navigation.includes("Log in to the Netlify Drawer"), 'QA Netlify drawer removal must cover the collaboration prompt.');
assert(navigation.includes("contents.executeJavaScript(script, true)"), 'QA preview chrome suppression must run inside the actual desktop renderer.');
assert(navigation.includes("target.searchParams.set('desktop', '1')"), 'Internal desktop navigation must preserve desktop mode.');

// Camera can be visibly live even while enumerateDevices is briefly empty.
assert(camera.includes('let lastLiveVideoTrack = null;'), 'Camera layer must retain the active video track.');
assert(camera.includes("if (lastLiveVideoTrack?.readyState === 'live') return lastLiveVideoTrack;"), 'Active video track must be authoritative for camera identity.');
assert(camera.includes('activeSynthetic: true'), 'Camera settings must synthesize an active-device row when enumeration lags.');
assert(camera.includes('activeCameraDeviceId:'), 'Camera diagnostics must expose the active deviceId.');
assert(camera.includes('scheduleDeviceRefresh'), 'Camera labels must be re-hydrated after media startup.');

// macOS Screen Recording can change while the app is open. Permission recovery
// must recognize both DominionStar-owned and Apple-owned Settings flows.
assert(screenGuard.includes("window.addEventListener('blur'"), 'Screen permission recovery must detect OS-owned settings flows.');
assert(screenGuard.includes('PERMISSION_FLOW_KEY'), 'Screen permission flow state must survive blur/focus transitions.');
assert(screenGuard.includes('relaunchOnceAfterPermissionFlow'), 'Newly granted macOS screen permission must be applied by one controlled relaunch.');
assert(screenGuard.includes("restart.textContent = 'Retry Capture'"), 'Granted screen permission must retry capture instead of looping back to Settings.');
assert(screenGuard.includes("version: '1.1.0'"), 'Updated macOS permission recovery layer must be active.');

// Approved UI authority: the DominionStar source picker owns the normal macOS
// experience. Apple/Electron's picker can be detected as fallback capability,
// but must not replace the approved Screens / Application windows interface.
assert(bootstrap.includes("await import('./macos-native-capture-authority.mjs')"), 'Desktop bootstrap must retain capture capability reporting.');
assert(nativeCapture.includes('major >= 15'), 'Native picker availability must be limited to supported macOS versions.');
assert(nativeCapture.includes("authority: 'dominionstar-custom-picker'"), 'macOS must report DominionStar as the primary capture authority.');
assert(nativeCapture.includes('enabled: false'), 'Apple system picker must be disabled as the primary user-facing picker.');
assert(nativeCapture.includes('available: supportsNativeMacPicker()'), 'Apple system picker may remain detectable as an emergency fallback.');
assert(preload.includes('systemSharePicker: nativeSystemPicker'), 'Preload must expose the final system-picker state.');
assert(preload.includes('customSharePicker: !nativeSystemPicker'), 'Preload must expose DominionStar picker authority when native mode is off.');
assert(engine.includes('const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)'), 'Meeting engine must consume capture authority.');
assert(engine.includes('window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose'), 'Meeting engine must route normal desktop sharing through the approved DominionStar picker.');

console.log('Real Mac OAuth/navigation/camera/approved-share-picker regression contract passed.');
