import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const auth=read('src/auth-service.mjs');
const app=read('ui/app.js');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=29))),'OAuth foreground-return authority introduced in 2.0.29 must remain enforced for every later candidate.');
assert.ok(auth.includes("flowType:'pkce'"),'PKCE must remain authoritative.');
assert.ok(auth.includes('redirectTo:CALLBACK_URL'),'OAuth must still return to the local desktop loopback callback.');
assert.ok(auth.includes('exchangeCodeForSession(code)'),'PKCE code exchange must remain in the main process.');
assert.ok(auth.includes("app.focus?.({steal:true})"),'macOS app activation must explicitly steal focus back from the browser.');
assert.ok(auth.includes('win.moveTop?.()'),'Desktop window must be raised above the browser.');
assert.ok(auth.includes('foregroundAfterOAuth'),'OAuth completion must use the retrying foreground handoff.');
assert.ok(auth.includes('for(const delay of [120,420,900])'),'Foreground activation retries must be bounded and deterministic.');
assert.ok(auth.includes('setTimeout(()=>window.close(),220)'),'Callback tab should close itself when permitted.');
assert.ok(auth.includes("foregroundAfterOAuth();await emitState();"),'Successful OAuth must foreground the app and then publish authenticated state.');
assert.ok(app.includes("state?.signedIn?showHome(state):showAuth()"),'Authenticated state must unlock the desktop Home surface.');
for(const forbidden of ['dominionstarld.com','#access_token','dominionstar://auth'])assert.ok(!auth.includes(forbidden),`Forbidden legacy/public auth path returned: ${forbidden}`);

console.log('DOMINIONSTAR_DESKTOP_OAUTH_RETURN_2_0_29_OK pkce loopback app-focus move-top retry tab-close no-public-site-fallback');
