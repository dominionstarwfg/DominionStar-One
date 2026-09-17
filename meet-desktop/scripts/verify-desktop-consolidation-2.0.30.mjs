import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const auth=read('src/auth-service.mjs');
const main=read('src/main.mjs');
const share=read('ui/share-integration.js');
const bootstrap=read('src/bootstrap.mjs');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=30))),'Consolidated desktop authorities introduced in 2.0.30 must remain enforced for every later candidate.');

// OAuth return authority from certified 2.0.29 OAuth branch.
assert.ok(auth.includes("flowType:'pkce'"),'PKCE must remain authoritative.');
assert.ok(auth.includes('redirectTo:CALLBACK_URL'),'OAuth must remain loopback-bound.');
assert.ok(auth.includes("app.focus?.({steal:true})"),'OAuth completion must activate the macOS app.');
assert.ok(auth.includes('win.moveTop?.()'),'OAuth completion must raise the existing window.');
assert.ok(auth.includes('foregroundAfterOAuth'),'OAuth foreground retries must remain active.');
assert.ok(auth.includes('setTimeout(()=>window.close(),220)'),'Callback tab close attempt must remain present.');

// Screen Recording recovery authority. Permission inspection stays passive, but
// macOS TCC status is advisory because Electron can report stale denied values.
// An explicit Share action must therefore be allowed to reach real source
// enumeration, which is the authoritative usability test.
assert.ok(main.includes("detectedBy:reportedStatus==='granted'?'tcc-status':'tcc-advisory'"),'Screen Recording TCC state must be treated as advisory when it is not granted.');
assert.ok(main.includes('ok:true'),'A stale non-granted TCC label must not hard-block explicit Share.');
assert.ok(main.includes('real desktop')&&main.includes('source enumeration is the authoritative test'),'Real desktop source enumeration must remain the explicit-share authority.');
assert.ok(!main.includes('function activeScreenCaptureProbe()'),'Screen permission checks must not trigger hidden capture enumeration.');
assert.ok(!main.includes('screenPermissionProbeInFlight'),'Screen permission checks must not retain hidden probe state.');
assert.ok(share.includes('localStorage.removeItem(SCREEN_CAPTURE_PROVEN_KEY)'),'Stale persisted capture proof must be cleared on boot.');
assert.ok(share.includes("sessionStorage.setItem(SCREEN_CAPTURE_PROVEN_KEY,'1')"),'Successful capture proof must be session-scoped.');
assert.ok(share.includes("sessionStorage.getItem(SCREEN_CAPTURE_PROVEN_KEY)==='1'"),'Permission proof lookup must be session-scoped.');
assert.ok(!share.includes("localStorage.setItem(SCREEN_CAPTURE_PROVEN_KEY,'1')"),'Capture proof must never persist across app relaunches/rebuilds.');

// Keep the 2.0.28 canonical app identity/relaunch line.
assert.ok(bootstrap.includes('app.requestSingleInstanceLock()'),'Single-instance authority must remain active.');
assert.ok(bootstrap.includes('app.moveToApplicationsFolder'),'Canonical /Applications authority must remain active.');

console.log('DOMINIONSTAR_DESKTOP_2_0_30_CONSOLIDATED_OK oauth-return advisory-screen-permission real-source-share-authority single-instance canonical-install');
