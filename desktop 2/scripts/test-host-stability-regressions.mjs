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
const compactHome=read('assets/js/meet/desktop-home-compact-launch.js');
const homeInjection=read('desktop 2/src/desktop-home-injection.mjs');
const navigation=read('desktop 2/src/desktop-navigation-authority.mjs');
const lifecycle=read('desktop 2/src/screen-permission-lifecycle.mjs');
const picker=read('assets/js/meet/desktop-share-picker.js');
const bootstrap=read('assets/js/meet/operation-2030-bootstrap.js');

// One desktop Home authority. HTML is markup, not a competing application.
assert.match(home,/desktop-home-controller\.js\?v=1-single-authority/,'desktop Home must load exactly one Home controller');
assert.doesNotMatch(home,/const\s+randomDigits|applyNewMeetingPrefs|readRemoteRoom\s*=|saveSettings'\)\.onclick/,'desktop Home markup must not contain legacy application state owners');
assert.match(controller,/DominionDesktopHomeController/,'single desktop Home controller must expose its authority');
assert.match(controller,/meet_personal_rooms/,'Home controller must use the account Personal Room table');
assert.doesNotMatch(controller,/randomDigits\s*=|Math\.random\(\).*personalRoom/i,'desktop Home must never invent a Personal Meeting ID');
assert.match(controller,/action:share\?\(usePersonal\?'desktop-share':'share'\):\(usePersonal\?'desktop-new':'new'\)/,'Home must explicitly distinguish Personal Room from generated meeting launch');
assert.match(controller,/background:String\(\$\('desktopBackground'\)/,'saved background preference must be read from Settings');
assert.doesNotMatch(controller,/background\s*:\s*['"]none['"].*brightness\s*:\s*100.*touchAppearance\s*:\s*0/s,'navigation/start must not erase saved appearance preferences');

// Physical-QA Home compaction: Personal Room is no longer a permanent action
// card. Start Meeting owns one modern switch between the permanent room and a
// fresh one-time meeting while preserving the account Personal Room identity.
assert.match(homeInjection,/desktop-home-compact-launch\.js\?v=1-physical-qa/,'desktop Home must inject the physical-QA compact launch authority');
assert.match(compactHome,/personalButton\?\.remove\?\.\(\)/,'desktop Home must remove the separate Personal Room action card');
assert.match(compactHome,/strong\.textContent='Start Meeting'/,'desktop Home primary action must read Start Meeting');
assert.match(compactHome,/role=\"switch\"/,'Start Meeting Personal Room choice must use a modern switch control');
assert.match(compactHome,/action:'desktop-new'/,'Personal Room launch must retain the permanent room identity');
assert.match(compactHome,/location\.href='\/meet\/\?desktop=1&action=new'/,'switching Personal Room off must launch a fresh one-time meeting');

// Retired duplicate authorities must stay deleted.
for(const retired of [
  'assets/js/meet/desktop-host-stability-authority.js',
  'assets/js/meet/desktop-settings-authority.js',
  'assets/js/meet/desktop-share-permission-guard.js',
  'assets/js/meet/meeting-identity-settings.js',
  'assets/js/meet/meeting-identity-bridge.js',
  'assets/js/meet/media-effect-safety.js',
  'desktop 2/src/macos-screen-permission-guard.mjs',
  'desktop 2/src/launcher.html'
])assert.equal(exists(retired),false,`retired runtime file returned: ${retired}`);

// Navigation no longer reads/invents user state or injects Settings/permission UI.
assert.doesNotMatch(navigation,/resolveDesktopHostIdentity|installDesktopSettingsAuthority|installDesktopSharePermissionGuard/,'native navigation must not own Home account/settings state');
assert.match(navigation,/installDesktopMeetingIdentityBootstrap/,'explicit Personal Room URL must still enter host prejoin');
assert.match(navigation,/explicit-home-identity-v3/,'Personal Room bootstrap must come from the single Home authority');

// Physical-Mac screen permission recovery. Unsigned QA app identity can leave
// macOS TCC text stale, so real bounded capture evidence must be authoritative.
// The fallback picker may inspect the lifecycle only after real source loading
// fails; no permission/source IPC is allowed to wait forever.
assert.match(picker,/getScreenPermissionStatus/,'fallback share picker must retain native screen-permission diagnostics');
assert.match(picker,/const withTimeout=/,'fallback share picker must bound all native waits');
assert.match(picker,/const requestSources=\(\)=>withTimeout/,'fallback source enumeration must have a bounded timeout');
assert.match(lifecycle,/systemPreferences\.getMediaAccessStatus\('screen'\)/,'native lifecycle must still read macOS Screen Recording state');
assert.match(lifecycle,/desktopCapturer\.getSources/,'native lifecycle must probe real capture availability when TCC state may be stale');
assert.match(lifecycle,/CAPTURE_PROBE_TIMEOUT_MS/,'real capture probe must have a hard timeout');
assert.match(lifecycle,/if\(probe\.captureReady\)return/,'successful real capture must override stale permission text');
assert.match(lifecycle,/requiresRestart:false/,'successful real capture must suppress an unnecessary restart loop');

// Startup budget: advanced modules are on demand instead of all loading at once.
assert.match(bootstrap,/3\.0\.0-clean-lazy-runtime/,'desktop bootstrap must use clean lazy runtime');
assert.match(bootstrap,/loadMediaEnhancements/,'advanced video processing must be lazy');
assert.match(bootstrap,/loadPresentationTools/,'presentation extensions must be lazy');
assert.doesNotMatch(bootstrap,/meeting-identity-settings|meeting-identity-bridge|media-effect-safety/,'retired identity/effect override layers must not return to startup');
const immediateLoads=(bootstrap.match(/const core=\[/g)||[]).length;
assert.equal(immediateLoads,1,'bootstrap must expose one bounded core group');

console.log('DOMINIONSTAR_CLEAN_SINGLE_AUTHORITY_CONTRACT_OK');