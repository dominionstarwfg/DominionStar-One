import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..','..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const exists=relative=>fs.existsSync(path.join(root,relative));

const login=read('assets/js/member-login.js');
const auth=read('assets/js/member-auth.js');
const main=read('desktop 2/src/main-v2.mjs');

// One OAuth return path only. The system browser performs Google OAuth and the
// hosted Supabase project must allow-list the installed app's custom protocol.
assert(login.includes("const DESKTOP_OAUTH_CALLBACK = 'dominionstar://auth/callback'"),'Desktop OAuth callback must be the installed app protocol.');
assert(login.includes('redirectTo: DESKTOP_OAUTH_CALLBACK'),'Google OAuth must request the direct app callback.');
assert(login.includes('skipBrowserRedirect: true'),'Desktop OAuth must remain in the system browser.');
assert(login.includes('window.dominionDesktop?.openExternal?.(data.url)'),'Google OAuth must open outside Electron.');
assert(!login.includes('/meet-auth-callback/'),'Retired HTTPS callback bridge must not return.');
assert.equal(exists('meet-auth-callback/index.html'),false,'Retired HTTPS OAuth callback page returned.');
assert.equal(exists('meet-auth-start/index.html'),false,'Temporary Site URL OAuth launch relay returned.');

// Electron receives the deep link, moves the returned credentials into its
// persistent member-login route, establishes the Supabase session, then lands
// only on an approved Meet destination.
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"),'Electron must recognize dominionstar://auth/callback.');
assert(main.includes("new URL('/member-login/?desktop=1&oauth=complete', APP_ORIGIN)"),'Electron OAuth callback must enter desktop login completion.');
assert(login.includes('supabase.auth.setSession({'),'Desktop OAuth completion must establish the Electron Supabase session.');
assert(login.includes("return '/meet-home/?desktop=1';"),'Desktop post-auth destination must fail closed to Meet Home.');
assert(login.includes('window.location.replace(requestedDestination())'),'Successful OAuth must leave login for the approved Meet route.');

// Desktop sign-out remains inside DominionStar Meet.
assert(auth.includes('const desktop = Boolean(window.dominionDesktop?.isDesktop)'));
assert(auth.includes("desktop ? '/member-login/?desktop=1' : '/member-login/'"));

console.log('DOMINIONSTAR_DESKTOP_GOOGLE_OAUTH_CODE_CONTRACT_OK direct-deep-link external-browser persistent-session meet-home');
