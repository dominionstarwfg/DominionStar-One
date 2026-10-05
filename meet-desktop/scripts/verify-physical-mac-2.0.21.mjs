import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const runtimeBootstrap=read('ui/runtime-bootstrap.js');
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const shareCss=read('ui/share.css');
const shareService=read('src/share-service.mjs');
const shareController=read('ui/share-controller.js');
const shareIntegration=read('ui/share-integration.js');
const preload=read('src/preload.cjs');
const bootstrap=read('src/bootstrap.mjs');
const relaunch=read('src/relaunch-service.mjs');
const presenter=read('ui/presenter-toolbar.html');
const presenterJs=read('ui/presenter-toolbar.js');
const approved=read('ui/approved-reference-parity.js');
const meetingCss=read('ui/meeting.css');
const approvedCss=read('ui/approved-reference-parity.css');
const physicalIntelligence=read('ui/physical-intelligence-2.0.41.js');
const macOverlay=read('src/mac-share-presenter-overlay.mjs');
const macVideo=read('ui/mac-share-video.js');
const pkg=JSON.parse(read('package.json'));

const [major,minor,patch]=String(pkg.version||'').split('.').map(Number);
assert.ok(major===2&&minor===0&&Number.isInteger(patch)&&patch>=21,`Physical Mac gate requires 2.0.21+; found ${pkg.version}.`);

// Clean startup: one canonical runtime, no rejected/legacy visual authorities.
assert.ok(runtimeBootstrap.includes("version:'2.0.54-minimal-runtime-bootstrap'"),'Physical Mac gate requires the minimal runtime bootstrap.');
for(const retired of ['physical-mac-repair.js','physical-mac-repair.css','zoom-adaptive-parity.js','zoom-adaptive-parity.css','active-share-home-parity-2.0.41.js','runtime-layout-fix.css','rejected-build-repair-2.0.40.css']){
  assert.ok(!runtimeBootstrap.includes(retired),`Retired Physical Mac layer must not load: ${retired}`);
}
assert.ok(runtimeBootstrap.includes("loadScript('./physical-intelligence-2.0.41.js'"),'Functional macOS permission intelligence must remain loaded.');

// App-owned chooser is the active screen-share authority.
assert.match(shareService,/systemPickerAvailable=platform==='darwin'&&macMajor>=15/);
assert.match(shareService,/const nativeSystemPicker=false/);
assert.match(shareService,/function configureDisplayMediaHandler\(useSystemPicker\)/);
assert.match(shareService,/configureDisplayMediaHandler\(false\);/);
assert.doesNotMatch(shareService,/if\(nativeSystemPicker&&status!=='granted'\)/);
assert.match(shareService,/share:list-sources[\s\S]*configureDisplayMediaHandler\(false\);pendingSelection=null/);
assert.match(shareService,/share:select-source[\s\S]*configureDisplayMediaHandler\(false\)/);
assert.match(shareIntegration,/SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'/);
assert.match(shareIntegration,/const result=await bridge\.openPicker\(permission\)/);
assert.ok(!shareIntegration.includes('bridge?.probeAccess?.()'),'Initial Share must not enumerate sources as a permission probe.');

// Share start is bounded and late streams are discarded.
assert.match(shareController,/let displayRequestGeneration=0/);
assert.match(shareController,/error\.code='share_start_timeout'/);
assert.match(shareController,/setTimeout\(\(\)=>\{timedOut=true;[\s\S]*\},5000\)/);
assert.match(shareController,/capturePromise\.then\(lateStream=>stopTracks\(lateStream\)\)/);

// Capture-start notification is one-way to avoid renderer/main deadlock.
assert.match(preload,/captureStarted:state=>\{ipcRenderer\.send\('share:capture-started',state\|\|\{\}\);return true;\}/);
assert.doesNotMatch(preload,/captureStarted:state=>invoke\('share:capture-started'/);

// Presenter controls remain direct, acknowledged, and available while sharing.
assert.match(shareIntegration,/id='inlinePresenterToolbar'/);
assert.match(shareIntegration,/data-inline-command="pause"/);
assert.match(shareIntegration,/data-inline-command="stop"/);
assert.match(presenter,/data-command="stop"[^>]*>[\s\S]*Stop Share/);
assert.match(presenterJs,/if\(command==='stop'\)/);
assert.match(shareCss,/data-ds-share-companion="chat"/);
assert.match(shareCss,/data-ds-share-companion="participants"/);
assert.match(shareCss,/data-ds-share-companion="annotate"/);

// TCC / relaunch recovery stays functional without the old Physical Mac Repair layer.
assert.match(physicalIntelligence,/resetScreenPermission/);
assert.match(physicalIntelligence,/app\?\.relaunch/);
assert.match(relaunch,/tccutil.*reset.*ScreenCapture.*com\.dominionstar\.desktop/s);
assert.match(relaunch,/stableAcrossRebuilds:false/);
assert.match(preload,/resetScreenPermission/);
assert.match(bootstrap,/relaunch-service\.mjs/);

// Profile-photo-first identity remains owned by the approved reference helper.
assert.match(approved,/function syncProfilePictures\(\)/);
assert.match(approved,/paintAvatar\(q\('#prejoinAvatar'\),own\.url/);
assert.match(approved,/paintAvatar\(q\('#stageAvatar'\),own\.url/);
assert.match(approved,/paintAvatar\(badge,url,initials\(name\)\)/);
assert.match(meetingCss,/\.person-badge\.has-photo/);

// Native sharing filmstrip is hidden for one participant and starts at two.
assert.ok(macOverlay.includes("function shouldShowVideoWindow(){return videoLayout!=='hide'&&presenterParticipantCount()>=2;}"),'Native Mac filmstrip must start at two participants.');
assert.ok(!macVideo.includes('getUserMedia'),'Native share filmstrip must never acquire a second camera.');
assert.ok(macVideo.includes("realParticipants=out.filter(item=>item.participantId!=='local-self')"),'Native filmstrip must suppress duplicate synthetic self identity.');

// Participants/chat remain floating, draggable, and full-stage safe.
assert.doesNotMatch(runtime,/panel\.dataset\.dsRuntimeMode='docked'/);
assert.match(runtime,/panel\.dataset\.dsRuntimeMode='floating'/);
assert.match(runtime,/installFloatingSurfaceDrag\(panel\)/);
assert.match(runtimeCss,/width:var\(--ds-runtime-vw,100vw\)!important/);
assert.match(runtimeCss,/height:var\(--ds-runtime-vh,100vh\)!important/);
assert.match(approvedCss,/right:14px !important;/);

console.log(`DOMINIONSTAR_PHYSICAL_MAC_2_0_54_OK carried-forward-on=${pkg.version} minimal-bootstrap custom-only-preshare bounded-share-start direct-presenter-controls permission-intelligence profile-first-identity two-person-native-filmstrip floating-panels full-stage`);
