import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const settingsAuthority = read('assets/js/meet/desktop-settings-authority.js');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const permissionGuard = read('desktop 2/src/macos-screen-permission-guard.mjs');
const permissionLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
const desktopHome = read('meet-home/desktop.html');

// Personal Room identity must be fixed before the meeting renderer can reach
// the legacy random-ID fallback.
assert.match(navigation, /desktop-settings-authority\.js\?v=2-core-host-settings/,
  'desktop Home must load the consolidated Settings authority');
assert.match(navigation, /async function resolveDesktopHostIdentity\(contents\)/,
  'desktop navigation must own Personal Room identity resolution');
assert.match(navigation, /target\.searchParams\.set\('room', identity\.id\)/,
  'Personal Room identity must be placed in navigation before pre-join loads');
assert.match(navigation, /target\.searchParams\.set\('host', '1'\)/,
  'Personal Room instant meeting must be marked as host entry before navigation');
assert.match(navigation, /read\('ds_meet_identity_preferences_v1'\)/,
  'Personal Room navigation must honor the Use Personal Room preference');
assert.match(settingsAuthority, /if\(\$\('newMeeting'\)\)\$\('newMeeting'\)\.onclick=async/,
  'desktop Settings authority must own New Meeting launch');
assert.match(settingsAuthority, /room=await remoteRoom\(client,session\)/,
  'New Meeting must refresh the account Personal Room before launch');
assert.match(settingsAuthority, /launch\('new',room,usePersonal\)/,
  'New Meeting must launch with the resolved Personal Room identity');
assert.doesNotMatch(settingsAuthority, /background\s*:\s*['"]none['"].*brightness\s*:\s*100.*touchAppearance\s*:\s*0/s,
  'New Meeting authority must not wipe saved background/appearance preferences');

for (const id of [
  'desktopCameraSelect','desktopMicrophoneSelect','desktopSpeakerSelect','desktopMirrorVideo',
  'desktopVideoQuality','desktopBackground','desktopBrightness','desktopAppearance',
  'desktopShareSound','desktopShareOptimize','desktopShareOwnWindows'
]) {
  assert.match(settingsAuthority, new RegExp(id), `Settings must include persistent ${id}`);
}
assert.match(settingsAuthority, /meet_user_preferences/,
  'host media preferences must persist to the account preference table');

// Screen capture must be one-way on macOS: no desktopCapturer probing before
// access is granted, and one clean restart after visiting the Privacy pane.
assert.match(permissionGuard, /screenSettingsVisitedThisLaunch = true/,
  'opening macOS Screen Recording settings must arm the current-process guard');
assert.match(permissionGuard, /screenPermissionStatus\(\)/,
  'native capture guard must inspect Screen Recording permission before enumeration');
assert.match(permissionGuard, /permission !== 'granted'/,
  'desktopCapturer must not run while macOS Screen Recording is ungranted');
assert.match(permissionGuard, /DOMINIONSTAR_SCREEN_PERMISSION_REQUIRED/,
  'ungranted screen access must fail locally without invoking the native capture sheet');
assert.match(permissionGuard, /DOMINIONSTAR_SCREEN_PERMISSION_RESTART_REQUIRED/,
  'desktopCapturer must be blocked until a clean restart after visiting Screen Recording settings');
assert.match(permissionLifecycle, /if \(raw !== 'granted'\) return blockedStatus\(raw\)/,
  'permission lifecycle must stop before capture probing when access is ungranted');
assert.match(permissionLifecycle, /if \(initialScreenPermission !== 'granted'\)/,
  'permission transition must require one clean process before capture probing');
assert.match(permissionLifecycle, /restart-required-after-screen-permission-change/,
  'permission lifecycle must report one restart after access changes during the running process');

assert.match(desktopHome, /id="settingsDialog"/,
  'desktop Home must retain one central Settings surface');
assert.match(desktopHome, /id="defaultMic"/,
  'Settings must retain join microphone default');
assert.match(desktopHome, /id="defaultCamera"/,
  'Settings must retain join camera default');
assert.match(desktopHome, /id="settingsUsePersonal"/,
  'Settings must retain Personal Room instant-meeting preference');

console.log('DOMINIONSTAR_HOST_STABILITY_REGRESSIONS_OK');
