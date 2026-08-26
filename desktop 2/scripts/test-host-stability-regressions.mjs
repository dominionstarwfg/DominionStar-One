import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..','..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8').replace(/\r\n/g,'\n');
const exists=relative=>fs.existsSync(path.join(root,relative));

const home=read('meet-home/desktop.html');
const browserHome=read('meet-home/index.html');
const controller=read('assets/js/meet/desktop-home-controller.js');
const navigation=read('desktop 2/src/desktop-navigation-authority.mjs');
const lifecycle=read('desktop 2/src/screen-permission-lifecycle.mjs');
const picker=read('assets/js/meet/desktop-share-picker.js');
const desktopBootstrap=read('desktop 2/src/bootstrap.mjs');
const main=read('desktop 2/src/main-v2.mjs');
const sharePickerAuthority=read('desktop 2/src/share-picker-authority.mjs');
const nativeCapture=read('desktop 2/src/macos-native-capture-authority.mjs');
const preload=read('desktop 2/src/preload.cjs');
const operationBootstrap=read('assets/js/meet/operation-2030-bootstrap.js');
const pkg=JSON.parse(read('desktop 2/package.json'));

assert.match(controller,/DominionDesktopHomeController/,'single desktop Home controller must expose its authority');
assert.match(controller,/3\.0\.0-single-home-generated-default/,'clean single Home controller version is missing');
assert.match(controller,/meet_personal_rooms/,'Home controller must use the account Personal Room table');
assert.match(controller,/const IDENTITY_KEY='ds_meet_identity_preferences_v2'/,'clean meeting-identity preference generation is missing');
assert.match(controller,/usePersonalForInstant:false/,'fresh Meeting ID must be the default instant-meeting behavior');
assert.match(controller,/if\(!state\.room\?\.personalRoomId\)\{usePersonal=false/,'missing Personal Room must fall back instead of opening another page');
assert.doesNotMatch(controller,/randomDigits\s*=|Math\.random\(\).*personalRoom/i,'desktop Home must never invent a Personal Meeting ID');
assert.match(home,/id="settingsUsePersonal"/,'Settings must own the Personal Room instant-meeting toggle.');
for(const id of ['newMeeting','joinMeeting','scheduleMeeting','shareScreen'])assert.match(home,new RegExp(`id="${id}"`),`Home action ${id} is missing.`);
assert.equal((home.match(/class="action(?: primary)?" id="/g)||[]).length,4,'Desktop Home must expose exactly four primary action cards.');
assert.equal(exists('desktop 2/src/desktop-home-settings-guard.mjs'),false,'Settings guard must not return as a second authority.');
assert.doesNotMatch(desktopBootstrap,/desktop-home-settings-guard/,'desktop bootstrap must not load a second Settings authority.');
for(const marker of ['cameraId','microphoneId','speakerId','joinMuted','joinCameraOff','mirror','quality','background','brightness','touchAppearance','shareSound','shareOptimize','shareOwnWindows'])assert.match(controller,new RegExp(marker),`Primary Home settings save is missing ${marker}.`);
assert.match(controller,/Other settings saved\. Personal Room is not configured/,'Settings must save independently when Personal Room is unavailable.');

assert(browserHome.includes('Aurora Meeting Assistant'),'Browser Home fixture changed unexpectedly.');
assert.match(navigation,/DESKTOP_HOME_ALIASES/,'Desktop navigation must normalize legacy Home aliases.');
assert.match(navigation,/if\(DESKTOP_HOME_ALIASES\.has\(route\)\)return 'meet-home\/desktop\.html'/,'Desktop route must never serve browser Home.');
const homeResource=(pkg.build?.extraResources||[]).find(entry=>entry?.from==='../meet-home');
assert.deepEqual(homeResource?.filter,['desktop.html'],'Desktop package must contain only desktop.html for Meet Home.');

for(const retired of [
  'assets/js/meet/desktop-home-compact-launch.js',
  'desktop 2/src/desktop-home-injection.mjs',
  'desktop 2/src/desktop-home-settings-guard.mjs',
  'desktop 2/src/macos-system-picker-session.mjs',
  'assets/js/meet/desktop-host-stability-authority.js',
  'assets/js/meet/desktop-settings-authority.js',
  'assets/js/meet/desktop-share-permission-guard.js',
  'assets/js/meet/meeting-identity-settings.js',
  'assets/js/meet/meeting-identity-bridge.js',
  'assets/js/meet/media-effect-safety.js',
  'desktop 2/src/macos-screen-permission-guard.mjs',
  'desktop 2/src/launcher.html'
])assert.equal(exists(retired),false,`retired runtime file returned: ${retired}`);
assert.doesNotMatch(navigation,/resolveDesktopHostIdentity|installDesktopSettingsAuthority|installDesktopSharePermissionGuard/,'native navigation must not own Home account/settings state');
assert.match(navigation,/installDesktopMeetingIdentityBootstrap/,'explicit Personal Room URL must still enter host prejoin');

// One visible DominionStar picker, one Electron display-media handler. The
// authority module disables a second native picker and bounds source enumeration.
assert.ok(desktopBootstrap.indexOf("await import('./share-picker-authority.mjs')")<desktopBootstrap.indexOf("await import('./main-v2.mjs')"),'share-picker authority must install before main-v2');
assert.equal((main.match(/setDisplayMediaRequestHandler/g)||[]).length,1,'desktop must expose one display-media handler');
assert.match(sharePickerAuthority,/SOURCE_ENUMERATION_TIMEOUT_MS = 4500/,'source enumeration timeout guard is missing');
assert.match(sharePickerAuthority,/sourceEnumerationInFlight/,'source enumeration must be single-flight');
assert.match(sharePickerAuthority,/Promise\.race\(\[sourceEnumerationInFlight, timeoutResult\(\)\]\)/,'stalled native enumeration must release the UI');
assert.match(sharePickerAuthority,/useSystemPicker: false/,'native picker must not create a second visible source chooser');
assert.match(nativeCapture,/supportsNativeMacPicker/,'renderer picker capability contract is missing');
assert.match(nativeCapture,/supportsNativeMacPicker\(\)\s*\{\s*return false;\s*\}/,'renderer must report the approved DominionStar picker on macOS');
assert.match(nativeCapture,/authority: 'dominionstar-custom-picker'/,'capture diagnostics must identify the DominionStar authority');
assert.match(preload,/systemSharePicker: nativeSystemPicker/,'renderer must receive picker capability');
assert.match(preload,/customSharePicker: !nativeSystemPicker/,'renderer must expose exactly the inverse custom-picker capability');
assert.match(picker,/if\(!dialog\.open\)dialog\.show\(\)/,'share picker must be non-modal');
assert.doesNotMatch(picker,/dialog\.showModal\(\)/,'share picker must never lock the meeting');
assert.doesNotMatch(picker,/addEventListener\(['"]focus['"]/,'returning from System Settings must not auto-run capture');
assert.match(preload,/let shareSourcesInFlight = null/,'renderer share source enumeration must be serialized');
assert.match(lifecycle,/systemPreferences\.getMediaAccessStatus\('screen'\)/,'native lifecycle must read macOS Screen Recording state');
assert.doesNotMatch(lifecycle,/desktopCapturer|getSources\s*\(/,'passive permission lifecycle must never enumerate capture sources');

assert.match(operationBootstrap,/3\.0\.0-clean-lazy-runtime/,'desktop bootstrap must use clean lazy runtime');
assert.match(operationBootstrap,/loadMediaEnhancements/,'advanced video processing must be lazy');
assert.match(operationBootstrap,/loadPresentationTools/,'presentation extensions must be lazy');
assert.doesNotMatch(operationBootstrap,/meeting-identity-settings|meeting-identity-bridge|media-effect-safety/,'retired identity/effect override layers must not return to startup');

console.log('DOMINIONSTAR_CLEAN_SINGLE_AUTHORITY_CONTRACT_OK one-home settings-owned approved-custom-picker bounded-enumeration');
