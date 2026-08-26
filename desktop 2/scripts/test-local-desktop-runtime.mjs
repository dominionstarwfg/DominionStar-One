import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const desktopRoot=path.resolve(here,'..');
const repoRoot=path.resolve(desktopRoot,'..');
const navigation=fs.readFileSync(path.join(desktopRoot,'src','desktop-navigation-authority.mjs'),'utf8').replace(/\r\n/g,'\n');
const pkg=JSON.parse(fs.readFileSync(path.join(desktopRoot,'package.json'),'utf8'));
const focusedHome=path.resolve(repoRoot,'meet-home','desktop.html');
const retiredSettings=path.resolve(repoRoot,'assets','js','meet','desktop-settings-authority.js');

assert(/protocol\.handle\(\s*['"]https['"]/.test(navigation),'Desktop session must intercept DominionStar HTTPS requests.');
assert(/bypassCustomProtocolHandlers\s*:\s*true/.test(navigation),'Non-local HTTPS requests must bypass the interceptor instead of recursing.');
assert(/path\.join\(process\.resourcesPath\s*,\s*['"]desktop-runtime['"]\)/.test(navigation),'Packaged app must serve Meet from bundled desktop-runtime resources.');
assert(/path\.resolve\(__dirname\s*,\s*['"]\.\.['"]\s*,\s*['"]\.\.['"]\)/.test(navigation),'Development runtime must resolve the checked-out source tree.');

// Installed DominionStar Meet must have exactly one Home surface regardless of
// missing query state, legacy index paths, or a return from another Meet route.
assert(navigation.includes("const DESKTOP_HOME_ALIASES=new Set(['/meet-home','/meet-home/index.html','/meet-home/desktop.html'])"),'Desktop Home aliases are not normalized.');
assert(navigation.includes("if(DESKTOP_HOME_ALIASES.has(route))return 'meet-home/desktop.html'"),'Every desktop Home alias must resolve to the focused desktop Home.');
assert(navigation.includes("target.pathname='/meet-home/'"),'Legacy Home aliases must normalize to /meet-home/.');
assert(fs.existsSync(focusedHome),'Focused desktop Meet Home file is missing.');
assert(!fs.existsSync(retiredSettings),'Retired duplicate desktop Settings authority returned.');
assert(navigation.includes("rawPath.startsWith('/assets/')"),'Bundled Meet assets must resolve locally.');
assert(navigation.includes("rawPath.startsWith('/meet/')"),'Bundled Meet route resources must resolve locally.');
assert(/net\.fetch\(pathToFileURL\(candidate\)\.toString\(\)/.test(navigation),'Local runtime files must be returned through Electron net.fetch.');

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
]) assert(resources.some(entry=>entry&&entry.from===from&&entry.to===to),`Missing packaged desktop runtime resource: ${from} -> ${to}`);
const homeResource=resources.find(entry=>entry?.from==='../meet-home');
assert.deepEqual(homeResource?.filter,['desktop.html'],'Desktop package must exclude the browser/Aurora Home implementation.');

assert(String(pkg.scripts?.verify||'').includes('test-local-desktop-runtime.mjs'),'Desktop verify suite must enforce the packaged-runtime boundary.');
console.log('Local desktop runtime contract passed: one packaged Home, non-recursive HTTPS, explicit Personal Room identity only.');