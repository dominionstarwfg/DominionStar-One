import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const memberLogin = read('assets/js/member-login.js');
const camera = read('assets/js/meet/camera-device-stability.js');
const screenGuard = read('assets/js/meet/screen-permission-ui-guard.js');
const main = read('desktop 2/src/main-v2.mjs');

// Real-device regression: desktop authentication must remain a Meet flow, not
// embed the public DominionStar website inside the Electron application.
assert(memberLogin.includes("provider: 'google'"), 'Desktop login must expose Google OAuth.');
assert(memberLogin.includes("redirectTo: 'dominionstar://auth/callback'"), 'Desktop Google OAuth must return through the DominionStar deep link.');
assert(memberLogin.includes("skipBrowserRedirect: true"), 'Desktop Google OAuth must use the system browser instead of embedding Google inside Electron.');
assert(memberLogin.includes("returnLink.textContent = '← Back to DominionStar Meet'"), 'Desktop login must return to DominionStar Meet, not the public platform.');
assert(memberLogin.includes("return '/meet-home/?desktop=1'"), 'Desktop authentication must default back to Meet Home.');
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"), 'Native app must accept the DominionStar OAuth callback.');

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

console.log('Real Mac auth/camera/screen-permission regression contract passed.');
