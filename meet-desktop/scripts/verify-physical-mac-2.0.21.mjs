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
const shareCss=read('ui/share.css');
const shareService=read('src/share-service.mjs');
const shareIntegration=read('ui/share-integration.js');
const preload=read('src/preload.cjs');
const bootstrap=read('src/bootstrap.mjs');
const relaunch=read('src/relaunch-service.mjs');
const presenter=read('ui/presenter-toolbar.html');
const presenterJs=read('ui/presenter-toolbar.js');
const approved=read('ui/approved-reference-parity.js');
const meetingCss=read('ui/meeting.css');
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

// Screen Share: a Mac with explicitly granted Screen Recording should use the
// DominionStar Zoom-style chooser immediately. Unknown/ungranted permission must
// still fall back to the native macOS authorization picker. No source enumeration
// may be used merely to decide which path to take.
assert.match(shareService,/nativeSystemPicker=platform==='darwin'&&macMajor>=15/,'macOS native picker capability is missing.');
assert.match(shareService,/function configureDisplayMediaHandler\(useSystemPicker\)/,'Dynamic display-media authority is missing.');
assert.match(shareService,/configureDisplayMediaHandler\(nativeSystemPicker\)/,'Share authority must initialize native-safe.');
assert.match(shareService,/if\(nativeSystemPicker&&status!=='granted'\)/,'Unknown/ungranted Mac does not retain native authorization.');
assert.match(shareService,/configureDisplayMediaHandler\(false\)/,'Granted/proven Mac cannot switch to the DominionStar chooser.');
assert.match(shareIntegration,/SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'/,'Successful capture proof must survive renderer relaunch.');
assert.match(shareIntegration,/async function grantedScreenPermission\(\)/,'Granted Screen Recording decision helper is missing.');
assert.match(shareIntegration,/desktop\?\.media\?\.permissions\?\.\(\)/,'Share entry must use lightweight permission status rather than source enumeration.');
assert.match(shareIntegration,/String\(permissions\?\.screen\|\|''\)\.toLowerCase\(\)==='granted'/,'Only explicit granted Screen Recording status may bypass native authorization.');
assert.match(shareIntegration,/const proven=replace\|\|share\.snapshot\(\)\.active\|\|await grantedScreenPermission\(\);/,'Share entry must recognize active, persisted, or explicitly granted capture authority.');
assert.match(shareIntegration,/const permission=proven\?'granted':'unknown';/,'Permission-aware chooser routing is missing.');
assert.ok(!shareIntegration.includes('bridge?.probeAccess?.()'),'Share entry must not enumerate desktop sources as a permission probe.');
assert.match(shareIntegration,/const entry=await resolveShareEntry\(permission\)/,'Share must route through resolved permission-aware selection.');
const openIndex=shareIntegration.indexOf('const result=await bridge.openPicker(permission);');
const deepDiagnostic=shareIntegration.indexOf('desktop?.media?.requestScreen?.()');
assert.ok(openIndex>=0&&deepDiagnostic>openIndex,'Deep Screen Recording diagnostics must remain after picker/capture failure.');
assert.match(shareIntegration,/await share\.start\(\{name:'Shared content',options\}\)/,'Native first-authorization path must still reach getDisplayMedia through ShareController.');
assert.match(shareIntegration,/markCaptureProven\(\);applyLayout\(\);/,'Successful capture must persist proof before normal sharing continues.');
assert.match(shareIntegration,/isPermissionFailure\(error\)/,'Permission recovery must be driven by a real capture failure.');
assert.match(shareIntegration,/status==='granted'\|\|Boolean\(diagnostic\?\.restartRequired\)/,'A grant that still fails real capture must surface restart recovery.');
assert.doesNotMatch(repair,/sharePicker\?\.listSources|sourceProbe\(|desktopCapturer|getSources\(/,'Physical compatibility code must not enumerate sources before share authority chooses a mode.');
assert.match(repair,/return await integration\.open\(\)/,'Compatibility Share helper must delegate to the isolated share integration.');
const repairClick=repair.slice(repair.indexOf('function onDocumentClick'),repair.indexOf("document.addEventListener('submit'"));
assert.ok(!repairClick.includes('#roomShare'),'Physical Mac repair must not intercept/cancel the Share Screen button.');

// Presenter mode: controls remain available while normal meeting chrome is hidden.
assert.match(shareService,/hideMeetingWindowForShare\(\)/,'Presenter mode must be able to hide the normal meeting window.');
assert.match(shareService,/async function openToolbar\(\)/,'Presenter toolbar readiness must be awaitable.');
assert.match(shareService,/await created\.loadFile\(path\.join\(uiDir,'presenter-toolbar\.html'\)\)/,'Presenter toolbar must finish loading before the meeting can hide.');
assert.match(shareService,/const toolbarReady=await openToolbar\(\);/,'Capture start must await presenter-toolbar readiness.');
assert.match(shareService,/if\(toolbarReady\)hideMeetingWindowForShare\(\);/,'Capture start can hide the meeting before presenter controls are available.');
assert.match(shareService,/main\.webContents\?\.setBackgroundThrottling\?\.\(false\)/,'Hidden meeting renderer must stay responsive while sharing.');
assert.match(shareService,/setVisibleOnAllWorkspaces\(true,\{visibleOnFullScreen:true/,'Presenter controls must remain visible across full-screen apps/Spaces.');
assert.match(shareService,/function showCompanionWindow\(kind='chat'\)/,'Presenter Chat/Participants/Annotate companion authority is missing.');
assert.match(shareService,/showCompanionWindow\(normalized\)/,'Presenter Chat/Participants/Annotate must not reopen the full meeting by default.');
assert.match(shareCss,/data-ds-share-companion="chat"/,'Share Chat companion CSS is missing.');
assert.match(shareCss,/data-ds-share-companion="participants"/,'Share Participants companion CSS is missing.');
assert.match(shareCss,/data-ds-share-companion="annotate"/,'Share Annotation companion CSS is missing.');
assert.match(shareService,/if\(normalized==='stop'&&shareActive\)/,'Stop Share must have main-process retry protection.');
assert.match(shareService,/showMeetingWindow\(\{focus:false\}\);sendMain\('share:presenter-command','stop'\)/,'Stop Share retry must wake the hidden renderer and retry the actual stop command.');
assert.match(presenter,/data-command="stop"[^>]*>[\s\S]*Stop Share/,'Presenter toolbar must expose a direct Stop Share control.');
assert.match(presenterJs,/if\(command==='stop'\)/,'Presenter Stop Share must have direct click authority.');
assert.match(repair,/resetScreenPermission/,'Prototype recovery must retain an explicit user-triggered TCC reset outside normal Share UX.');
assert.match(repair,/app\?\.relaunch/,'Newly granted Screen Recording permission must retain a full-process relaunch path.');
assert.match(relaunch,/tccutil.*reset.*ScreenCapture.*com\.dominionstar\.desktop/s,'TCC reset must target only DominionStar ScreenCapture permission.');
assert.match(relaunch,/stableAcrossRebuilds:false/,'Ad-hoc privacy identity must never be represented as persistence-certified.');
assert.match(preload,/resetScreenPermission/,'Renderer must have explicit reset recovery IPC.');
assert.match(preload,/relaunch/,'Renderer must have process relaunch IPC.');
assert.match(bootstrap,/relaunch-service\.mjs/,'Relaunch/TCC authority must load before main desktop services.');

// Profile-first meeting identity: a real profile picture takes precedence and
// initials remain the fallback. The local participant can reopen the profile
// image picker directly from their participant badge.
assert.match(approved,/function syncProfilePictures\(\)/,'Meeting profile-photo synchronization is missing.');
assert.match(approved,/paintAvatar\(q\('#prejoinAvatar'\),own\.url/,'Prejoin must prefer the signed-in profile photo.');
assert.match(approved,/paintAvatar\(q\('#stageAvatar'\),own\.url/,'Camera-off meeting stage must prefer the profile photo.');
assert.match(approved,/paintAvatar\(badge,url,initials\(name\)\)/,'Participant roster must fall back to initials only when no profile photo is available.');
assert.match(approved,/profileAvatarInput/,'Local participant must be able to open profile-picture upload/change from meeting identity.');
assert.match(approved,/detail\.type!=='profile'/,'Remote profile-picture signaling must be recognized.');
assert.match(meetingCss,/\.person-badge\.has-photo/,'Roster profile-photo styling is missing.');

// Carried-forward screenshot constraints: reactions/settings/participant count.
assert.match(css,/\.ds-reaction-tray[\s\S]*\.ds-raise-hand[\s\S]*white-space:nowrap!important/,'Raise Hand must not wrap.');
assert.match(css,/font-size:13px!important[\s\S]*font-weight:650!important[\s\S]*line-height:1!important/,'Raise Hand must have explicit final packaged typography authority.');
assert.match(css,/\.ds-reaction-tray[\s\S]*overflow:hidden!important/,'Reaction tray must contain its controls.');
assert.match(css,/\.av-toggle-row>span[\s\S]*font-size:13\.5px!important/,'Video setting row labels must be readable.');
assert.match(css,/\.av-range-row[\s\S]*minmax\(220px,420px\)/,'Video setting sliders must be bounded instead of spanning the dialog.');
assert.match(repair,/Participants \(\$\{count\}\)/,'Participants heading must expose the live count.');

// In normal meeting mode Participants and Chat remain true floating draggable
// surfaces at every width; the share-specific companion state is separate.
assert.doesNotMatch(runtime,/const wide=bodyWidth>=940/,'Participants/Chat must not switch to a forced dock at a desktop breakpoint.');
assert.doesNotMatch(runtime,/panel\.dataset\.dsRuntimeMode='docked'/,'Participants/Chat must not occupy the participant-video dock edge.');
assert.match(runtime,/panel\.dataset\.dsRuntimeMode='floating'/,'Participants/Chat must use the floating panel model.');
assert.match(runtime,/installFloatingSurfaceDrag\(panel\)/,'Floating participant/chat surfaces must be draggable.');
assert.match(runtime,/stage\.style\.setProperty\('right','0px','important'\)/,'Floating panels must leave the meeting stage full width.');
assert.match(runtime,/search=side\.querySelector\('\.zoom-participant-search'\);if\(search\)search\.hidden=count<7/,'Participant search must be shown only when useful.');
assert.match(runtime,/waiting=q\('#waitingQueueSection'\);if\(waiting\)waiting\.hidden=!hasWaitingPeople\(\)/,'Empty waiting-room section must be hidden.');
assert.match(runtimeCss,/width:var\(--ds-runtime-vw,100vw\)!important/,'Meeting must fill the Electron viewport width.');
assert.match(runtimeCss,/height:var\(--ds-runtime-vh,100vh\)!important/,'Meeting must fill the Electron viewport height.');
assert.match(adaptiveCss,/max-width:560px !important/,'Prejoin must remain compact.');

console.log(`DOMINIONSTAR_PHYSICAL_MAC_2_0_21_OK carried-forward-on=${pkg.version} personal-id permission-aware-share granted-custom-chooser native-unproven-fallback no-source-probe persistent-capture-proof toolbar-before-hide hidden-meeting-presenter-state share-companions direct-stop-share single-share-owner profile-first-identity adhoc-not-certified reaction-contained settings-readable participant-count floating-participants-chat draggable-panels right-edge-video-dock full-window compact-prejoin`);
