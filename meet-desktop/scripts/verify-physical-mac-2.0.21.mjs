import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const auth=read('ui/auth-password.js');
const repair=read('ui/physical-mac-repair.js');
const adaptive=read('ui/zoom-adaptive-parity.js');
const runtime=read('ui/runtime-stability.js');
const css=read('ui/physical-mac-repair.css');
const adaptiveCss=read('ui/zoom-adaptive-parity.css');
const runtimeCss=read('ui/runtime-stability.css');
const shareService=read('src/share-service.mjs');
const shareIntegration=read('ui/share-integration.js');
const preload=read('src/preload.cjs');
const bootstrap=read('src/bootstrap.mjs');
const relaunch=read('src/relaunch-service.mjs');
const presenter=read('ui/presenter-toolbar.html');
const presenterJs=read('ui/presenter-toolbar.js');
const pkg=JSON.parse(read('package.json'));

const [major,minor,patch]=String(pkg.version||'').split('.').map(Number);
assert.ok(major===2&&minor===0&&Number.isInteger(patch)&&patch>=21,`Carried-forward physical Mac repair gate requires DominionStar Meet 2.0.21 or later in the 2.0.x line; found ${pkg.version}.`);
assert.match(auth,/physical-mac-repair\.css/,'Physical Mac repair CSS must be loaded.');
assert.match(auth,/physical-mac-repair\.js/,'Physical Mac repair JS must be loaded.');
assert.match(auth,/zoom-adaptive-parity\.css/,'Adaptive Zoom authority CSS must be loaded.');
assert.match(auth,/zoom-adaptive-parity\.js/,'Adaptive Zoom authority JS must be loaded.');
assert.match(auth,/runtime-stability\.css/,'Final runtime stability CSS must be loaded.');
assert.match(auth,/runtime-stability\.js/,'Final runtime stability controller must be loaded.');
assert.ok(auth.indexOf('script.onload=loadAdaptiveParity')>=0,'Adaptive authority must load after physical-Mac repair.');
assert.ok(auth.indexOf('approved-reference-parity.css')<auth.indexOf('runtime-stability.css'),'Runtime stability must be the final physical visual authority.');

// Personal Meeting ID: capture-phase selection still owns the instant-meeting submit.
assert.match(repair,/document\.addEventListener\('submit'.*true\)/s,'Personal Meeting ID needs capture-phase submit authority.');
assert.match(repair,/newMeetingUsePersonal/,'Personal Meeting ID selection must be read.');
assert.match(repair,/meeting\?\.personalRoom/,'Displayed Personal Room identity must be read before Start.');
assert.match(repair,/meeting\?\.startPersonalRoom/,'Selected Personal Meeting ID must start the personal-room service path.');
assert.match(repair,/digits\(personal\.roomCode\)!==digits\(room\.roomCode\)/,'Personal Meeting ID must be equality-checked before prejoin.');
assert.match(repair,/beginHostPrejoin\(room,'personal'\)/,'Personal Meeting ID must enter host prejoin with the same room.');
assert.match(repair,/passLabel\?\.style\.setProperty\('display','none','important'\)/,'Instant passcode field must not remain visible when Personal Meeting ID is selected.');

// Screen Share: first-time macOS authorization may use the native picker, but
// an already-granted Mac must receive the DominionStar/Zoom-style source chooser.
assert.match(shareService,/nativeSystemPicker=platform==='darwin'&&macMajor>=15/,'macOS native picker capability is missing.');
assert.match(shareService,/function configureDisplayMediaHandler\(useSystemPicker\)/,'Dynamic display-media authority is missing.');
assert.match(shareService,/configureDisplayMediaHandler\(nativeSystemPicker\)/,'Share authority must initialize native-safe.');
assert.match(shareService,/if\(nativeSystemPicker&&status!=='granted'\)/,'Un-granted Mac does not retain native authorization.');
assert.match(shareService,/configureDisplayMediaHandler\(false\)/,'Granted Mac does not switch to the DominionStar chooser.');
assert.match(shareService,/hideMeetingWindowForShare\(\)/,'Presenter mode must be able to hide the normal meeting window.');
assert.match(shareService,/openToolbar\(\);\n    hideMeetingWindowForShare\(\);/,'Capture start must expose presenter controls before hiding the meeting.');
assert.match(shareService,/setVisibleOnAllWorkspaces\(true,\{visibleOnFullScreen:true/,'Presenter controls must remain visible across full-screen apps/Spaces.');
assert.match(shareService,/if\(normalized==='stop'&&shareActive\)/,'Stop Share must have main-process retry protection.');
assert.match(presenter,/data-command="stop"[^>]*>[\s\S]*Stop Share/,'Presenter toolbar must expose a direct Stop Share control.');
assert.match(presenterJs,/if\(command==='stop'\)/,'Presenter Stop Share must have direct click authority.');
assert.doesNotMatch(repair,/sharePicker\?\.listSources|sourceProbe\(|desktopCapturer|getSources\(/,'Physical compatibility code must not enumerate sources before share authority chooses a mode.');
assert.match(repair,/return await integration\.open\(\)/,'Compatibility Share helper must delegate to the isolated share integration.');
const repairClick=repair.slice(repair.indexOf('function onDocumentClick'),repair.indexOf("document.addEventListener('submit'"));
assert.ok(!repairClick.includes('#roomShare'),'Physical Mac repair must not intercept/cancel the Share Screen button.');
assert.match(shareIntegration,/async function screenPermissionStatus\(\)/,'Share integration must own cheap Screen Recording status intelligence.');
assert.match(shareIntegration,/if\(permission==='denied'\|\|permission==='restricted'\)/,'Explicit denial must show recovery before capture.');
assert.match(shareIntegration,/const entry=await resolveShareEntry\(permission\)/,'Share entry must choose native-vs-Zoom-style picker from permission state.');
const openIndex=shareIntegration.indexOf('const result=await bridge.openPicker(permission);');
const deepDiagnostic=shareIntegration.indexOf('desktop?.media?.requestScreen?.()');
assert.ok(openIndex>=0&&deepDiagnostic>openIndex,'Deep Screen Recording diagnostics must remain after picker/capture failure.');
assert.match(shareIntegration,/await share\.start\(\{name:'Shared content',options\}\)/,'Native first-time path must still reach getDisplayMedia through ShareController.');
assert.match(shareIntegration,/isPermissionFailure\(error\)/,'Permission recovery must be driven by a real capture failure.');
assert.match(shareIntegration,/status==='granted'\|\|Boolean\(diagnostic\?\.restartRequired\)/,'A grant that still fails real capture must surface restart recovery.');
assert.match(repair,/resetScreenPermission/,'Prototype recovery must retain an explicit user-triggered TCC reset outside normal Share UX.');
assert.match(repair,/app\?\.relaunch/,'Newly granted Screen Recording permission must retain a full-process relaunch path.');
assert.match(relaunch,/tccutil.*reset.*ScreenCapture.*com\.dominionstar\.desktop/s,'TCC reset must target only DominionStar ScreenCapture permission.');
assert.match(relaunch,/stableAcrossRebuilds:false/,'Ad-hoc privacy identity must never be represented as persistence-certified.');
assert.match(preload,/resetScreenPermission/,'Renderer must have explicit reset recovery IPC.');
assert.match(preload,/relaunch/,'Renderer must have process relaunch IPC.');
assert.match(bootstrap,/relaunch-service\.mjs/,'Relaunch/TCC authority must load before main desktop services.');

// Carried-forward screenshot constraints: reactions/settings/participant count.
assert.match(css,/\.ds-reaction-tray[\s\S]*\.ds-raise-hand[\s\S]*white-space:nowrap!important/,'Raise Hand must not wrap.');
assert.match(css,/font-size:13px!important[\s\S]*font-weight:650!important[\s\S]*line-height:1!important/,'Raise Hand must have explicit final packaged typography authority.');
assert.match(css,/\.ds-reaction-tray[\s\S]*overflow:hidden!important/,'Reaction tray must contain its controls.');
assert.match(css,/\.av-toggle-row>span[\s\S]*font-size:13\.5px!important/,'Video setting row labels must be readable.');
assert.match(css,/\.av-range-row[\s\S]*minmax\(220px,420px\)/,'Video setting sliders must be bounded instead of spanning the dialog.');
assert.match(repair,/Participants \(\$\{count\}\)/,'Participants heading must expose the live count.');

// Physical Mac 2.0.22 correction: normal desktop windows dock the participant/chat
// management surface to the right and resize the stage. Floating remains only
// for constrained windows.
assert.match(runtime,/const wide=bodyWidth>=940/,'Final panel behavior must adapt to actual meeting width.');
assert.match(runtime,/panel\.dataset\.dsRuntimeMode='docked'/,'Desktop-width participant/chat panels must dock on the right.');
assert.match(runtime,/panel\.dataset\.dsRuntimeMode='floating'/,'Constrained-window panel fallback must remain available.');
assert.match(runtime,/stage\.style\.setProperty\('right',`\$\{reserve\}px`,'important'\)/,'Stage must resize around the active docked panel.');
assert.match(runtime,/search=side\.querySelector\('\.zoom-participant-search'\);if\(search\)search\.hidden=count<7/,'Participant search must be shown only when useful.');
assert.match(runtime,/waiting=q\('#waitingQueueSection'\);if\(waiting\)waiting\.hidden=!hasWaitingPeople\(\)/,'Empty waiting-room section must be hidden.');
assert.match(runtimeCss,/width:var\(--ds-runtime-vw,100vw\)!important/,'Meeting must fill the Electron viewport width.');
assert.match(runtimeCss,/height:var\(--ds-runtime-vh,100vh\)!important/,'Meeting must fill the Electron viewport height.');
assert.match(adaptiveCss,/max-width:560px !important/,'Prejoin must remain compact.');

console.log(`DOMINIONSTAR_PHYSICAL_MAC_2_0_21_OK carried-forward-on=${pkg.version} personal-id permission-aware-native-fallback granted-zoom-chooser hidden-meeting-presenter-state direct-stop-share single-share-owner adhoc-not-certified reaction-contained settings-readable participant-count desktop-right-dock constrained-float full-window compact-prejoin`);
