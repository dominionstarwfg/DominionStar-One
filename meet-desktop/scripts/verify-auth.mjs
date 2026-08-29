import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const main=read('src/main.mjs');
const authService=read('src/auth-service.mjs');
const preload=read('src/preload.cjs');
const html=read('ui/index.html');
const passwordUi=read('ui/auth-password.js');
const app=read('ui/app.js');
const pkg=JSON.parse(read('package.json'));

assert(authService.includes("const CALLBACK_HOST='127.0.0.1'"),'Desktop auth must bind only to loopback.');
assert(authService.includes('const CALLBACK_PORT=37654'),'Desktop auth must use the fixed approved callback port.');
assert(authService.includes("const CALLBACK_PATH='/auth/callback'"),'Desktop auth callback path changed unexpectedly.');
assert(authService.includes("flowType:'pkce'"),'Google desktop authentication must use PKCE.');
assert(authService.includes("provider:'google'"),'Google provider wiring is missing.');
assert(authService.includes('redirectTo:CALLBACK_URL'),'OAuth must return to the local desktop callback.');
assert(authService.includes('skipBrowserRedirect:true'),'Desktop must open the external browser explicitly.');
assert(authService.includes('exchangeCodeForSession(code)'),'Desktop must exchange the PKCE code locally.');
assert(authService.includes('callbackServer.listen(CALLBACK_PORT,CALLBACK_HOST)'),'Callback server must bind to fixed loopback authority.');
assert(authService.includes('safeStorage.encryptString')&&authService.includes('safeStorage.decryptString'),'Desktop session storage must be encrypted when OS encryption is available.');
assert(authService.includes("if(redirect!==CALLBACK_URL)throw new Error('Desktop authentication refused an unexpected redirect destination.')"),'Desktop must fail closed when Supabase changes the redirect destination.');
assert(authService.includes('client.auth.signInWithPassword'),'Email/password desktop sign-in must use Supabase auth in the main process.');
for(const forbidden of ['dominionstarld.com','#access_token','dominionstar://auth'])assert(!authService.includes(forbidden),`Forbidden legacy auth path returned: ${forbidden}`);

assert(main.includes("ipcMain.handle('auth:start-google'"),'Native shell must own the Google sign-in command.');
assert(main.includes("ipcMain.handle('auth:sign-in-password'"),'Native shell must own email/password sign-in.');
for(const method of ['getState:','startGoogle:','signInPassword:','signOut:','onChanged:','onError:'])assert(preload.includes(method),`Minimal auth bridge is missing ${method}`);
assert(preload.includes('meeting:Object.freeze({'),'Meeting authority must be a separate bridge, not mixed into auth.');
for(const forbidden of ['createClient(','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','access_token','refresh_token','exchangeCodeForSession'])assert(!preload.includes(forbidden),`Preload must not expose auth internals: ${forbidden}`);
for(const forbidden of ['createClient(','.from(','exchangeCodeForSession','access_token','refresh_token'])assert(!app.includes(forbidden)&&!passwordUi.includes(forbidden),`Renderer must not own Supabase auth/database internals: ${forbidden}`);

for(const id of ['authGate','emailSignInForm','emailSignInEmail','emailSignInPassword','emailSignInButton','googleSignIn'])assert(html.includes(`id="${id}"`),`Installed sign-in UI is missing ${id}.`);
assert(html.includes('id="signOutButton"'),'Account surface must expose sign out.');
assert(passwordUi.includes('auth.signInPassword(email.value,password.value)'),'Email/password form must call only the native auth bridge.');
assert(app.includes('const desktop=window.dominionDesktop||null,auth=desktop?.auth||null'),'Renderer must obtain auth only from the native bridge.');
assert(app.includes('const state=await auth.getState()'),'Home must wait for desktop auth state.');
assert(app.includes('await auth.startGoogle()'),'Google button must call the native auth authority.');
assert(app.includes("state?.signedIn?showHome(state):showAuth()"),'Authenticated callback must unlock Home.');
assert(pkg.dependencies?.['@supabase/supabase-js'],'Supabase JS must be an explicit production dependency.');
console.log('DOMINIONSTAR_DESKTOP_AUTH_OK email-password google-pkce loopback encrypted-session no-public-site-fallback');
