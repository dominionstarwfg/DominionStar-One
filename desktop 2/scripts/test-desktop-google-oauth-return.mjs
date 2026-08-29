import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..','..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const login=read('assets/js/member-login.js');
const auth=read('assets/js/member-auth.js');
const main=read('desktop 2/src/main-v2.mjs');
const relay=read('assets/js/desktop-oauth-return.js');
const publicHome=read('index.html');

assert(login.includes('const DESKTOP_OAUTH_BROWSER_RETURN = `${window.location.origin}/`;'));
assert(login.includes('redirectTo: DESKTOP_OAUTH_BROWSER_RETURN'));
assert(login.includes('skipBrowserRedirect: true'));
assert(login.includes('window.dominionDesktop?.openExternal?.(data.url)'));
assert(!login.includes('window.location.assign(data.url)'));
assert(login.includes('let { data } = await supabase.auth.getSession();'));
assert(login.includes('supabase.auth.setSession({'));
assert(login.includes("returned.get('error_description')"));
assert(login.includes("return '/meet-home/?desktop=1';"));

assert(publicHome.includes('<script src="/assets/js/desktop-oauth-return.js"></script>'));
assert(relay.includes('dominionstar://auth/callback'));
assert(relay.includes("params.get('access_token')"));
assert(relay.includes("params.get('refresh_token')"));
assert(relay.includes('window.location.href = callback'));

assert(main.includes("url.protocol !== 'dominionstar:'"));
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"));
assert(main.includes("app.setAsDefaultProtocolClient('dominionstar'"));
assert(main.includes("new URL('/member-login/?desktop=1&oauth=complete', APP_ORIGIN)"));
assert(auth.includes('const desktop = Boolean(window.dominionDesktop?.isDesktop)'));

console.log('DOMINIONSTAR_DESKTOP_GOOGLE_OAUTH_CODE_CONTRACT_OK trusted-web-relay deep-link meet-home');
