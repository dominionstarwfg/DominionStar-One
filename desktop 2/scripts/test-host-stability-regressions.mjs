import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..','..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const exists=relative=>fs.existsSync(path.join(root,relative));

const home=read('meet-home/desktop.html');
const controller=read('assets/js/meet/desktop-home-controller.js');
const navigation=read('desktop 2/src/desktop-navigation-authority.mjs');
const lifecycle=read('desktop 2/src/screen-permission-lifecycle.mjs');
const picker=read('assets/js/meet/desktop-share-picker.js');
const desktopBootstrap=read('desktop 2/src/bootstrap.mjs');
const settingsGuard=read('desktop 2/src/desktop-home-settings-guard.mjs');
const operationBootstrap=read('assets/js/meet/operation-2030-bootstrap.js');

// One desktop Home authority. Home exposes only the four meeting actions; all
// Personal Room identity/default decisions live in Settings.
assert.match(home,/desktop-home-controller\.js\?v=2-settings-own-meeting-identity/,'desktop Home must load the cleaned Home controller');
assert.match(controller,/DominionDesktopHomeController/,'single desktop Home controller must expose its authority');
assert.match(controller,/meet_personal_rooms/,'Home controller must use the account Personal Room table');
assert.doesNotMatch(controller,/randomDigits\s*=|Math\.random\(\).*personalRoom/i,'desktop Home must never invent a Personal Meeting ID');
assert.match(controller,/const usePersonal=state\.identity\.usePersonalForInstant!==false/,'New Meeting must read the Personal Room choice from Settings state.');
assert.match(home,/id="settingsUsePersonal"/,'Settings must own the Personal Room instant-meeting toggle.');
for(const id of ['newMeeting','joinMeeting','scheduleMeeting','shareScreen'])assert.match(home,new RegExp(`id="${id}"`),`Home action ${id} is missing.`);
for(const retiredId of ['personalIdentity','newMeetingMenuButton','newMeetingMenu','usePersonalRoom','startWithVideo','newMeetingPersonalId'])assert.doesNotMatch(home,new RegExp(`id="${retiredId}"`),`retired Home Personal Room control returned: ${retiredId}`);
assert.equal((home.match(/class="action(?: primary)?" id="/g)||[]).length,4,'Desktop Home must expose exactly four primary action cards.');
assert.doesNotMatch(controller,/\$\('usePersonalRoom'\)|\$\('startWithVideo'\)|newMeetingMenu/,'Home controller must not re-create per-click Personal Room controls.');

// Desktop media/device settings must remain saveable when Personal Room is
// intentionally disabled or has not yet been provisioned.
assert.match(desktopBootstrap,/desktop-home-settings-guard\.mjs/,'desktop bootstrap must load the Settings independence guard.');
assert.match(settingsGuard,/event\.stopImmediatePropagation\(\)/,'Settings guard must take ownership only for the no-Personal-Room save case.');
assert.match(settingsGuard,/if\(roomValue\.length===10\|\|usePersonal\)return/,'Configured/active Personal Room settings must remain owned by the primary Home controller.');
assert.match(settingsGuard,/usePersonalForInstant:false/,'Saving without a Personal Room must persist that instant meetings should not require Personal Room.');
for(const marker of ['cameraId','microphoneId','speakerId','joinMuted','joinCameraOff','mirror','quality','background','brightness','touchAppearance','shareSound','shareOptimize','shareOwnWindows'])assert.match(settingsGuard,new RegExp(marker),`Independent desktop settings save is missing ${marker}.`);
assert.match(settingsGuard,/meet_user_preferences/,'Independent settings save should best-effort synchronize account preferences.');
assert.match(settingsGuard,/Settings saved\./,'Independent settings save must provide successful UI feedback.');

// Duplicate Home and capture authorities must stay deleted.
for(const retired of [
  'assets/js/meet/desktop-home-compact-launch.js',
  'desktop 2/src/desktop-home-injection.mjs',
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
assert.doesNotMatch(desktopBootstrap,/desktop-home-injection|macos-system-picker-session/,'desktop bootstrap must not load a second Home or capture authority.');

// Navigation no longer reads/invents user state or injects Settings/permission UI.
assert.doesNotMatch(navigation,/resolveDesktopHostIdentity|installDesktopSettingsAuthority|installDesktopSharePermissionGuard/,'native navigation must not own Home account/settings state');
assert.match(navigation,/installDesktopMeetingIdentityBootstrap/,'explicit Personal Room URL must still enter host prejoin');
assert.match(navigation,/explicit-home-identity-v3/,'Personal Room bootstrap must come from the single Home authority');

// Physical-Mac permission handoff: System Settings never shares an in-flight
// source-enumeration transaction with the meeting. The picker closes first and
// does not install any focus listener. A fresh app process may then prove actual
// source access even when macOS reports stale TCC state.
assert.match(picker,/getScreenPermissionStatus/,'share picker must retain native permission diagnostics');
assert.match(picker,/const withTimeout=/,'share picker must bound native waits');
assert.match(picker,/const requestSources=\(\)=>withTimeout/,'source enumeration must have a bounded timeout');
assert.match(picker,/if\(!dialog\.open\)dialog\.show\(\)/,'share picker must be non-modal');
assert.doesNotMatch(picker,/dialog\.showModal\(\)/,'share picker must never lock the meeting behind a modal dialog');
assert.match(picker,/if\(dialog\.open\)dialog\.close\('cancel'\);\s*await withTimeout\(window\.dominionDesktop\.openScreenRecordingSettings/,'picker must close before System Settings opens');
assert.doesNotMatch(picker,/addEventListener\(['"]focus['"]/,'returning from System Settings must not auto-run capture on focus');
assert.match(picker,/PERMISSION_RESTART_KEY/,'permission transition must persist an explicit fresh-process marker');
assert.match(picker,/allowFreshProcessProbe/,'fresh process must be able to probe real sources when TCC status is stale');
const permissionIndex=picker.indexOf('permissionState=await status()');
const sourceIndex=picker.indexOf('next=await requestSources()');
assert(permissionIndex>=0&&sourceIndex>=0&&permissionIndex<sourceIndex,'permission state must be read before source enumeration');
assert.match(lifecycle,/systemPreferences\.getMediaAccessStatus\('screen'\)/,'native lifecycle must read macOS Screen Recording state');
assert.doesNotMatch(lifecycle,/desktopCapturer|getSources\s*\(/,'passive permission lifecycle must never enumerate capture sources');
assert.match(lifecycle,/captureProbed:false/,'permission status must report that capture was not probed');
assert.match(lifecycle,/desktop:relaunch-for-permissions/,'permission lifecycle must expose one clean restart path');

// Startup budget remains bounded and retired override layers stay gone.
assert.match(operationBootstrap,/3\.0\.0-clean-lazy-runtime/,'desktop bootstrap must use clean lazy runtime');
assert.match(operationBootstrap,/loadMediaEnhancements/,'advanced video processing must be lazy');
assert.match(operationBootstrap,/loadPresentationTools/,'presentation extensions must be lazy');
assert.doesNotMatch(operationBootstrap,/meeting-identity-settings|meeting-identity-bridge|media-effect-safety/,'retired identity/effect override layers must not return to startup');
assert.equal((operationBootstrap.match(/const core=\[/g)||[]).length,1,'bootstrap must expose one bounded core group');

console.log('DOMINIONSTAR_CLEAN_SINGLE_AUTHORITY_CONTRACT_OK settings-independent single-capture');
