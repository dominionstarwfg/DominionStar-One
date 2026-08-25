import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(here, '..');
const navigation = fs.readFileSync(path.join(desktopRoot, 'src', 'desktop-navigation-authority.mjs'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));
const focusedHome = path.resolve(desktopRoot, '..', 'meet-home', 'desktop.html');

assert(navigation.includes("protocol.handle('https'"), 'Desktop session must intercept DominionStar HTTPS requests.');
assert(navigation.includes('bypassCustomProtocolHandlers: true'), 'Non-local HTTPS requests must bypass the interceptor instead of recursing.');
assert(navigation.includes("path.join(process.resourcesPath, 'desktop-runtime')"), 'Packaged app must serve Meet from its bundled desktop runtime.');
assert(navigation.includes("path.resolve(__dirname, '..', '..')"), 'Development runtime must resolve the checked-out DominionStar source tree.');
assert(navigation.includes("route === '/meet-home' && url.searchParams.get('desktop') === '1'"), 'Desktop Meet Home must resolve to the focused native desktop home.');
assert(navigation.includes("return 'meet-home/desktop.html'"), 'Desktop Meet Home must serve the packaged desktop-only hub.');
assert(fs.existsSync(focusedHome), 'Focused desktop Meet Home file is missing.');
assert(navigation.includes("rawPath.startsWith('/assets/')"), 'Bundled Meet assets must be resolved locally.');
assert(navigation.includes("rawPath.startsWith('/meet/')"), 'Bundled Meet route resources such as release-contract.json must be resolved locally.');
assert(navigation.includes('net.fetch(pathToFileURL(candidate).toString()'), 'Local runtime files must be returned through Electron net.fetch.');

// New Meeting must honor the desktop Home preference before a user starts the
// meeting. Personal Room is an identity/default, not a competing meeting type.
assert(navigation.includes('function installDesktopMeetingIdentityBootstrap(contents)'), 'Desktop Personal Room bootstrap authority is missing.');
assert(navigation.includes("localStorage.getItem('ds_meet_identity_preferences_v1')"), 'Desktop New Meeting must read the Use Personal Room preference.');
assert(navigation.includes('window.DominionPersonalRoom?.current?.()'), 'Desktop New Meeting must prefer the account-backed Personal Room authority.');
assert(navigation.includes("['ds_meet_personal_room_v2','ds_meet_personal_room_v1']"), 'Desktop New Meeting must retain a stable Personal Room cache fallback.');
assert(navigation.includes("typeof window.DominionStarEnterHostPrejoin!=='function'"), 'Desktop Personal Room bootstrap must route through the shared host prejoin owner.');
assert(navigation.includes("window.__DS_DESKTOP_PERSONAL_ROOM_BOOTSTRAP='account-personal-room-v1'"), 'Desktop Personal Room bootstrap completion marker is missing.');
assert(navigation.includes("window.__DS_DESKTOP_PERSONAL_ROOM_BOOTSTRAP='generated-meeting-v1'"), 'Desktop generated-meeting opt-out marker is missing.');
assert(navigation.includes('attempts>=20'), 'Desktop Personal Room bootstrap retry must be bounded and non-blocking.');
assert(navigation.includes('installDesktopMeetingIdentityBootstrap(contents);'), 'Desktop Personal Room authority must be installed for renderer contents.');

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
console.log('Local desktop runtime authority contract passed.');
