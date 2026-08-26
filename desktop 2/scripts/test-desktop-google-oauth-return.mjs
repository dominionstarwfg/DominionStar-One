import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..','..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

const login=read('assets/js/member-login.js');
const auth=read('assets/js/member-auth.js');
const callback=read('meet-auth-callback/index.html');
const main=read('desktop 2/src/main-v2.mjs');

// Desktop Google OAuth must never ask Supabase to return directly to a custom
// scheme. A dedicated HTTPS bridge on the DominionStar origin receives the
// browser result and hands it to the installed app protocol.
assert(login.includes("new URL('/meet-auth-callback/', window.location.origin)"),'Desktop Google OAuth callback must use the dedicated HTTPS Meet bridge.');
assert(login.includes('redirectTo: desktopOAuthReturnUrl()'),'Google OAuth must use the dedicated desktop return URL.');
assert(!login.includes("redirectTo: 'dominionstar://auth/callback'"),'Direct custom-scheme OAuth redirect must not return.');
assert(login.includes("skipBrowserRedirect: true"),'Desktop must continue opening OAuth in the system browser.');
assert(login.includes("window.dominionDesktop?.openExternal?.(data.url)"),'Desktop OAuth must open Google externally rather than inside the Electron app.');

// The callback page has one purpose: remove browser-visible credentials and
// return them to DominionStar Meet. It must not route into the public website.
assert(callback.includes("new URL('dominionstar://auth/callback')"),'HTTPS OAuth bridge must return to the DominionStar app protocol.');
assert(callback.includes("history.replaceState(null,''"),'OAuth bridge must remove returned credentials from the browser address bar.');
assert(callback.includes("window.location.assign(deepLink.toString())"),'OAuth bridge must launch the installed app.');
assert(!callback.includes('/member-dashboard/')&&!callback.includes('/workspace/'),'OAuth bridge must not enter public/member web surfaces.');
assert(callback.includes('This page only returns authentication to the installed DominionStar Meet app.'),'OAuth bridge must remain a single-purpose return surface.');

// Electron owns the final handoff and puts the returned credentials back into
// the persistent desktop member-login route, which then establishes the session
// and moves to Meet Home.
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"),'Electron deep-link resolver must recognize auth callbacks.');
assert(main.includes("new URL('/member-login/?desktop=1&oauth=complete', APP_ORIGIN)"),'Electron OAuth callback must resolve into the desktop login completion route.');
assert(login.includes("supabase.auth.setSession({"),'Desktop OAuth completion must establish the Electron Supabase session explicitly.');
assert(login.includes("return '/meet-home/?desktop=1';"),'Desktop post-auth destination must fail closed to Meet Home.');
assert(login.includes("window.location.replace(requestedDestination())"),'Successful desktop OAuth must leave login for the approved Meet destination.');

// Signing out of the installed application must remain inside the installed
// application login flow. The generic web member login is browser-only.
assert(auth.includes("const desktop = Boolean(window.dominionDesktop?.isDesktop)"),'Auth sign-out must distinguish installed desktop from browser.');
assert(auth.includes("desktop ? '/member-login/?desktop=1' : '/member-login/'"),'Desktop sign-out must preserve desktop login context.');

console.log('DOMINIONSTAR_DESKTOP_GOOGLE_OAUTH_RETURN_OK https-bridge deep-link persistent-session meet-home');
