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
const navigation=read('desktop 2/src/desktop-navigation-authority.mjs');

// Desktop Google OAuth stays in the persistent Electron partition. It may
// navigate through Google/Supabase, but it must return to DominionStar's own
// member-login route rather than handing tokens to a second browser process.
assert(login.includes('const DESKTOP_OAUTH_RETURN = `${window.location.origin}/member-login/?desktop=1&oauth=complete`'),'Desktop OAuth must return to the trusted in-app member-login route.');
assert(login.includes('redirectTo: DESKTOP_OAUTH_RETURN'),'Google OAuth must request the in-app desktop return route.');
assert(login.includes('skipBrowserRedirect: true'),'OAuth URL creation must remain explicit and testable.');
assert(login.includes('window.location.assign(data.url)'),'Google OAuth must continue in the existing Electron webContents.');
assert(!login.includes('window.dominionDesktop?.openExternal?.(data.url)'),'Desktop Google OAuth must not be handed to a second browser session.');
assert(!login.includes("const DESKTOP_OAUTH_CALLBACK = 'dominionstar://auth/callback'"),'Custom-protocol token relay must not be the normal desktop Google sign-in path.');
assert.equal(exists('meet-auth-callback/index.html'),false,'Retired HTTPS OAuth callback page returned.');
assert.equal(exists('meet-auth-start/index.html'),false,'Temporary Site URL OAuth launch relay returned.');

// Successful authentication must resolve inside the persistent session and fail
// closed to Meet Home. Existing Supabase session detection is preferred; hash
// token recovery is retained only as compatibility fallback.
assert(login.includes('let { data } = await supabase.auth.getSession();'),'Desktop OAuth return must first recognize an already-established persistent session.');
assert(login.includes('supabase.auth.setSession({'),'Desktop OAuth return must retain compatibility with hash-token recovery.');
assert(login.includes("return '/meet-home/?desktop=1';"),'Desktop post-auth destination must fail closed to Meet Home.');
assert(login.includes('window.location.replace(requestedDestination())'),'Successful OAuth must leave login for the approved Meet route.');

// Trusted non-DominionStar OAuth hops are not blocked by the same-origin
// navigation authority; internal DominionStar routes remain normalized.
assert(navigation.includes("if(url.protocol!=='https:'||!isDominionDesktopHost(url.hostname))return;"),'Navigation authority must allow external OAuth hops to proceed in the same webContents.');
assert(navigation.includes("const INTERNAL_PATHS=new Set(['/meet','/meet-home','/meet-login','/member-login'])"),'Desktop internal return routes must remain explicit.');

// Desktop sign-out remains inside DominionStar Meet.
assert(auth.includes('const desktop = Boolean(window.dominionDesktop?.isDesktop)'));
assert(auth.includes("desktop ? '/member-login/?desktop=1' : '/member-login/'"));

console.log('DOMINIONSTAR_DESKTOP_GOOGLE_OAUTH_CODE_CONTRACT_OK in-app-persistent-session meet-home');
