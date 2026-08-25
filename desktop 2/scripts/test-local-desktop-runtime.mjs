import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(here, '..');
const navigation = fs.readFileSync(path.join(desktopRoot, 'src', 'desktop-navigation-authority.mjs'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));
const focusedHome = path.resolve(desktopRoot, '..', 'meet-home', 'desktop.html');
const settingsAuthority = path.resolve(desktopRoot, '..', 'assets', 'js', 'meet', 'desktop-settings-authority.js');

assert(navigation.includes("protocol.handle('https'"), 'Desktop session must intercept DominionStar HTTPS requests.');
assert(navigation.includes('bypassCustomProtocolHandlers: true'), 'Non-local HTTPS requests must bypass the interceptor instead of recursing.');
assert(navigation.includes("path.join(process.resourcesPath, 'desktop-runtime')"), 'Packaged app must serve Meet from its bundled desktop runtime.');
assert(navigation.includes("path.resolve(__dirname, '..', '..')"), 'Development runtime must resolve the checked-out DominionStar source tree.');
assert(navigation.includes("route === '/meet-home' && url.searchParams.get('desktop') === '1'"), 'Desktop Meet Home must resolve to the focused native desktop home.');
assert(navigation.includes("return 'meet-home/desktop.html'"), 'Desktop Meet Home must serve the packaged desktop-only hub.');
assert(fs.existsSync(focusedHome), 'Focused desktop Meet Home file is missing.');
assert(fs.existsSync(settingsAuthority), 'Desktop consolidated Settings authority is missing.');
assert(navigation.includes("rawPath.startsWith('/assets/')"), 'Bundled Meet assets must be resolved locally.');
assert(navigation.includes("rawPath.startsWith('/meet/')"), 'Bundled Meet route resources such as release-contract.json must be resolved locally.');
assert(navigation.includes('net.fetch(pathToFileURL(candidate).toString()'), 'Local runtime files must be returned through Electron net.fetch.');

// New Meeting must resolve Personal Room identity before /meet pre-join loads.
// This prevents the legacy host-prejoin fallback from generating a random ID
// when the user has explicitly selected Use Personal Room.
assert(navigation.includes('async function resolveDesktopHostIdentity(contents)'), 'Desktop Personal Room resolver is missing.');
assert(navigation.includes('function enforceDesktopHostIdentity(contents, event, url)'), 'Desktop pre-navigation Personal Room authority is missing.');
assert(navigation.includes("read('ds_meet_identity_preferences_v1')"), 'Desktop New Meeting must read the Use Personal Room preference.');
assert(navigation.includes("['ds_meet_personal_room_v2','ds_meet_personal_room_v1']"), 'Desktop New Meeting must retain a stable Personal Room cache fallback.');
assert(navigation.includes("target.searchParams.set('room', identity.id)"), 'Personal Room ID must be placed in the URL before pre-join loads.');
assert(navigation.includes("target.searchParams.set('host', '1')"), 'Personal Room launch must enter as host before pre-join loads.');
assert(navigation.includes("target.searchParams.set('desktopIdentityResolved', '1')"), 'Desktop identity resolution must be bounded against redirect loops.');
assert(navigation.includes('if (enforceDesktopHostIdentity(contents, event, url)) return;'), 'Navigation must invoke Personal Room authority before allowing /meet to load.');
assert(navigation.includes('desktop-settings-authority.js?v=2-core-host-settings'), 'Desktop Home must inject consolidated Settings authority.');
assert(navigation.includes('installDesktopSettingsAuthority(contents);'), 'Desktop Settings authority must be installed for renderer contents.');

const resources = Array.isArray(pkg.build?.extraResources) ? pkg.build.extraResources : [];
const required = [
  ['../assets', 'desktop-runtime/assets'],
  ['../meet', 'desktop-runtime/meet'],
  ['../meet-home', 'desktop-runtime/meet-home'],
  ['../meet-login', 'desktop-runtime/meet-login'],
  ['../member-login', 'desktop-runtime/member-login'],
  ['../styles.css', 'desktop-runtime/styles.css']
];
for (const [from, to] of required) {
  assert(resources.some((entry) => entry && entry.from === from && entry.to === to), `Missing packaged desktop runtime resource: ${from} -> ${to}`);
}

assert(String(pkg.scripts?.verify || '').includes('test-local-desktop-runtime.mjs'), 'Desktop verify suite must enforce the local-runtime boundary.');
console.log('Local desktop runtime + pre-navigation Personal Room authority contract passed.');
