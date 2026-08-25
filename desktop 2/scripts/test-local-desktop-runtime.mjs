import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const desktopRoot=path.resolve(here,'..');
const repoRoot=path.resolve(desktopRoot,'..');
const navigation=fs.readFileSync(path.join(desktopRoot,'src','desktop-navigation-authority.mjs'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(desktopRoot,'package.json'),'utf8'));
const focusedHome=path.resolve(repoRoot,'meet-home','desktop.html');
const retiredSettings=path.resolve(repoRoot,'assets','js','meet','desktop-settings-authority.js');

// One packaged HTTPS runtime boundary. Local DominionStar Meet resources are
// served from the installer; all non-local requests bypass the interceptor so
// the protocol handler can never recurse into itself.
assert(/protocol\.handle\(\s*['"]https['"]/.test(navigation),'Desktop session must intercept DominionStar HTTPS requests.');
assert(/bypassCustomProtocolHandlers\s*:\s*true/.test(navigation),'Non-local HTTPS requests must bypass the interceptor instead of recursing.');
assert(/path\.join\(process\.resourcesPath\s*,\s*['"]desktop-runtime['"]\)/.test(navigation),'Packaged app must serve Meet from bundled desktop-runtime resources.');
assert(/path\.resolve\(__dirname\s*,\s*['"]\.\.['"]\s*,\s*['"]\.\.['"]\)/.test(navigation),'Development runtime must resolve the checked-out source tree.');
assert(navigation.includes("route==='/meet-home'&&url.searchParams.get('desktop')==='1'"),'Desktop Meet Home must use the focused desktop route.');
assert(navigation.includes("return 'meet-home/desktop.html'"),'Desktop Meet Home must serve the packaged desktop-only hub.');
assert(fs.existsSync(focusedHome),'Focused desktop Meet Home file is missing.');
assert(!fs.existsSync(retiredSettings),'Retired duplicate desktop Settings authority returned.');
assert(navigation.includes("rawPath.startsWith('/assets/')"),'Bundled Meet assets must resolve locally.');
assert(navigation.includes("rawPath.startsWith('/meet/')"),'Bundled Meet route resources must resolve locally.');
assert(/net\.fetch\(pathToFileURL\(candidate\)\.toString\(\)/.test(navigation),'Local runtime files must be returned through Electron net.fetch.');

// Personal Room identity has one owner: Desktop Home. Native navigation accepts
// only the explicit room/action encoded by that controller and forwards it into
// the established host-prejoin API. It must never read, generate, or replace
// Personal Room account state itself.
assert(navigation.includes('function installDesktopMeetingIdentityBootstrap(contents)'),'Explicit desktop meeting identity bootstrap is missing.');
assert(navigation.includes("['desktop-new','desktop-share'].includes(action)"),'Desktop bootstrap must distinguish explicit Personal Room start/share actions.');
assert(navigation.includes("const room=String(current.searchParams.get('room')||'').replace(/\\D/g,'').slice(0,10)"),'Desktop bootstrap must consume an explicit ten-digit room from Home.');
assert(navigation.includes("window.DominionStarEnterHostPrejoin({room"),'Desktop bootstrap must enter the existing host prejoin with the explicit room.');
assert(navigation.includes("window.__DS_DESKTOP_PERSONAL_ROOM_BOOTSTRAP='explicit-home-identity-v3'"),'Explicit Home-owned Personal Room bootstrap marker is missing.');
assert(!navigation.includes('resolveDesktopHostIdentity'),'Native navigation must not regain a second Personal Room resolver.');
assert(!navigation.includes('ds_meet_personal_room_v1')&&!navigation.includes('ds_meet_personal_room_v2'),'Native navigation must not read cached Personal Room account state.');
assert(!navigation.includes('desktop-settings-authority.js'),'Native navigation must not inject the retired Settings controller.');

const resources=Array.isArray(pkg.build?.extraResources)?pkg.build.extraResources:[];
for(const [from,to] of [
  ['../assets','desktop-runtime/assets'],
  ['../meet','desktop-runtime/meet'],
  ['../meet-home','desktop-runtime/meet-home'],
  ['../meet-login','desktop-runtime/meet-login'],
  ['../member-login','desktop-runtime/member-login'],
  ['../styles.css','desktop-runtime/styles.css']
]){
  assert(resources.some(entry=>entry&&entry.from===from&&entry.to===to),`Missing packaged desktop runtime resource: ${from} -> ${to}`);
}

assert(String(pkg.scripts?.verify||'').includes('test-local-desktop-runtime.mjs'),'Desktop verify suite must enforce the packaged-runtime boundary.');
console.log('Local desktop runtime contract passed: packaged resources, non-recursive HTTPS, explicit Home-owned Personal Room identity.');
