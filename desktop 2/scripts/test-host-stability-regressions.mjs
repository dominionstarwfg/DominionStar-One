import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const hostAuthority = read('assets/js/meet/desktop-host-stability-authority.js');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const permissionGuard = read('desktop 2/src/macos-screen-permission-guard.mjs');
const permissionLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
const desktopHome = read('meet-home/desktop.html');

assert.match(navigation, /desktop-host-stability-authority\.js\?v=1-host-stability/,
  'desktop Home must load the host stability authority');
assert.match(hostAuthority, /params\.set\('room',room\.personalRoomId\)/,
  'Personal Room identity must be placed in navigation before pre-join loads');
assert.match(hostAuthority, /params\.set\('host','1'\)/,
  'Personal Room instant meeting must be marked as host entry before navigation');
assert.match(hostAuthority, /if\(!room\?\.personalRoomId\)/,
  'Personal Room must fail closed instead of silently generating a random meeting ID');
assert.doesNotMatch(hostAuthority, /background\s*:\s*['"]none['"].*brightness\s*:\s*100.*touchAppearance\s*:\s*0/s,
  'New Meeting authority must not wipe saved background/appearance preferences');

for (const id of [
  'desktopCameraSelect','desktopMicrophoneSelect','desktopSpeakerSelect','desktopMirrorVideo',
  'desktopVideoQuality','desktopBackground','desktopBrightness','desktopAppearance'
]) {
  assert.match(hostAuthority, new RegExp(id), `Settings must include persistent ${id}`);
}
assert.match(hostAuthority, /meet_user_preferences/,
  'host media preferences must persist to the account preference table');

assert.match(permissionGuard, /screenSettingsVisitedThisLaunch = true/,
  'opening macOS Screen Recording settings must arm the current-process guard');
assert.match(permissionGuard, /DOMINIONSTAR_SCREEN_PERMISSION_RESTART_REQUIRED/,
  'desktopCapturer must be blocked until a clean restart after visiting Screen Recording settings');
assert.match(permissionLifecycle, /restart-required-after-screen-permission-change/,
  'permission lifecycle must report one restart after access changes during the running process');
assert.match(permissionLifecycle, /initialScreenPermission !== 'granted' && raw === 'granted'/,
  'permission transition must be detected before capture probing');

assert.match(desktopHome, /id="settingsDialog"/,
  'desktop Home must retain one central Settings surface');
assert.match(desktopHome, /id="defaultMic"/,
  'Settings must retain join microphone default');
assert.match(desktopHome, /id="defaultCamera"/,
  'Settings must retain join camera default');
assert.match(desktopHome, /id="settingsUsePersonal"/,
  'Settings must retain Personal Room instant-meeting preference');

console.log('DOMINIONSTAR_HOST_STABILITY_REGRESSIONS_OK');
