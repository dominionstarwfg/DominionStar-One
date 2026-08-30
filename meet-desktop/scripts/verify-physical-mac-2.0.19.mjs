import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const auth=read('ui/auth-password.js');
const repair=read('ui/physical-mac-repair.js');
const css=read('ui/physical-mac-repair.css');
const preload=read('src/preload.cjs');
const bootstrap=read('src/bootstrap.mjs');
const relaunch=read('src/relaunch-service.mjs');
const pkg=JSON.parse(read('package.json'));

assert.equal(pkg.version,'2.0.20','Physical Mac repair gate must remain active on 2.0.20.');
assert.match(auth,/physical-mac-repair\.css/,'Physical Mac repair CSS must be loaded.');
assert.match(auth,/physical-mac-repair\.js/,'Physical Mac repair JS must be loaded.');
assert.match(auth,/const loadPhysicalRepair=\(\)=>\{[\s\S]*physical-mac-repair\.js[\s\S]*\};/,'Physical Mac repair must use an explicit loader.');
assert.ok(auth.indexOf("if(physicalStyle.sheet)loadPhysicalRepair()")>auth.indexOf("zoom-contract-bridge.js"),'Physical Mac repair execution must occur after legacy meeting-layer registration.');
assert.match(auth,/physicalStyle\.addEventListener\('load',loadPhysicalRepair/,'Physical Mac repair controller must wait for its final-authority stylesheet.');

// Personal Meeting ID: checkbox selection must own submit before the legacy instant-room path.
assert.match(repair,/document\.addEventListener\('submit'.*true\)/s,'Personal Meeting ID needs capture-phase submit authority.');
assert.match(repair,/newMeetingUsePersonal/,'Personal Meeting ID selection must be read.');
assert.match(repair,/meeting\?\.personalRoom/,'Displayed Personal Room identity must be read before Start.');
assert.match(repair,/meeting\?\.startPersonalRoom/,'Selected Personal Meeting ID must start the personal-room service path.');
assert.match(repair,/digits\(personal\.roomCode\)!==digits\(room\.roomCode\)/,'Personal Meeting ID must be equality-checked before prejoin.');
assert.match(repair,/beginHostPrejoin\(room,'personal'\)/,'Personal Meeting ID must enter host prejoin with the same room.');
assert.match(repair,/passLabel\?\.style\.setProperty\('display','none','important'\)/,'Instant passcode field must not remain visible when Personal Meeting ID is selected.');

// Screen Share: never stack custom recovery on the unresolved native macOS prompt.
assert.match(repair,/initialStatus==='not-determined'/,'not-determined must be treated as native macOS prompt ownership.');
assert.match(repair,/waitForNativeDecision/,'Share must wait for the native permission decision.');
const notDeterminedBlock=repair.slice(repair.indexOf("if(initialStatus==='not-determined')"));
assert.ok(notDeterminedBlock.indexOf('showRecovery')>notDeterminedBlock.indexOf("if(decided==='not-determined')return"),'Custom recovery must not appear while native prompt remains unresolved.');
assert.match(repair,/resetScreenPermission/,'Prototype recovery must explicitly reset stale ScreenCapture TCC only on user action.');
assert.match(repair,/app\?\.relaunch/,'Newly granted Screen Recording permission must have a full-process relaunch path.');
assert.match(relaunch,/tccutil.*reset.*ScreenCapture.*com\.dominionstar\.desktop/s,'TCC reset must target only DominionStar ScreenCapture permission.');
assert.match(relaunch,/stableAcrossRebuilds:false/,'Ad-hoc privacy identity must never be represented as persistence-certified.');
assert.match(preload,/resetScreenPermission/,'Renderer must have explicit reset recovery IPC.');
assert.match(preload,/relaunch/,'Renderer must have process relaunch IPC.');
assert.match(bootstrap,/relaunch-service\.mjs/,'Relaunch/TCC authority must load before main desktop services.');

// Reactions and Settings: screenshot-derived rendered constraints.
assert.match(css,/\.ds-reaction-tray[\s\S]*\.ds-raise-hand[\s\S]*white-space:nowrap!important/,'Raise Hand must not wrap.');
assert.match(css,/font-size:13px!important[\s\S]*font-weight:650!important[\s\S]*line-height:1!important/,'Raise Hand must have explicit final packaged typography authority.');
assert.match(css,/\.ds-reaction-tray[\s\S]*overflow:hidden!important/,'Reaction tray must contain its controls.');
assert.match(css,/\.av-toggle-row>span[\s\S]*font-size:13\.5px!important/,'Video setting row labels must be readable.');
assert.match(css,/\.av-range-row[\s\S]*minmax\(220px,420px\)/,'Video setting sliders must be bounded instead of spanning the dialog.');
assert.match(repair,/Participants \(\$\{count\}\)/,'Participants heading must expose the live count.');

console.log('DOMINIONSTAR_PHYSICAL_MAC_REPAIR_OK personal-id-equality single-native-permission-flow explicit-tcc-recovery real-relaunch adhoc-not-certified reaction-contained reaction-font-authority settings-readable participant-count stylesheet-before-controller');
