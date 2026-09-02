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
const pkg=JSON.parse(read('package.json'));

const [major,minor,patch]=String(pkg.version||'').split('.').map(Number);
assert.ok(major===2&&minor===0&&Number.isInteger(patch)&&patch>=21,`Carried-forward physical Mac repair gate requires DominionStar Meet 2.0.21 or later in the 2.0.x line; found ${pkg.version}.`);

// Final authority load order.
assert.match(auth,/physical-mac-repair\.css/,'Physical Mac repair CSS must be loaded.');
assert.match(auth,/physical-mac-repair\.js/,'Physical Mac repair JS must be loaded.');
assert.match(auth,/zoom-adaptive-parity\.css/,'Adaptive Zoom CSS must be loaded.');
assert.match(auth,/zoom-adaptive-parity\.js/,'Adaptive Zoom JS must be loaded.');
assert.match(auth,/runtime-stability\.css/,'Runtime stability CSS must be loaded.');
assert.match(auth,/runtime-stability\.js/,'Runtime stability JS must be loaded.');
assert.ok(auth.indexOf('script.onload=loadAdaptiveParity')>=0,'Adaptive authority must load after physical Mac repair.');
assert.ok(auth.indexOf('approved-reference-parity.css')<auth.indexOf('runtime-stability.css'),'Runtime stability must remain final physical visual authority.');

// Personal Meeting ID and prejoin identity remain deterministic.
assert.match(repair,/document\.addEventListener\('submit'.*true\)/s,'Personal Meeting ID needs capture-phase submit authority.');
assert.match(repair,/newMeetingUsePersonal/,'Personal Meeting ID selection must be read.');
assert.match(repair,/meeting\?\.personalRoom/,'Displayed Personal Room must be read before Start.');
assert.match(repair,/meeting\?\.startPersonalRoom/,'Personal Meeting ID must start the personal-room service path.');
assert.match(repair,/digits\(personal\.roomCode\)!==digits\(room\.roomCode\)/,'Personal Meeting ID must be equality checked.');
assert.match(repair,/beginHostPrejoin\(room,'personal'\)/,'Personal Room must enter host prejoin with the same room.');
assert.match(repair,/passLabel\?\.style\.setProperty\('display','none','important'\)/,'Personal Meeting ID must hide the unrelated instant passcode field.');

// Native-first Screen Recording permission authority.
assert.match(shareService,/nativeSystemPicker=platform==='darwin'&&macMajor>=15/,'macOS native picker capability is missing.');
assert.match(shareService,/function configureDisplayMediaHandler\(useSystemPicker\)/,'Dynamic display-media authority is missing.');
assert.match(shareService,/if\(nativeSystemPicker&&status!=='granted'\)/,'Unknown/ungranted macOS must retain native authorization.');
assert.match(shareService,/configureDisplayMediaHandler\(false\)/,'Granted/proven macOS cannot use the DominionStar chooser.');
assert.match(shareIntegration,/SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'/,'Capture proof must persist across renderer relaunches.');
assert.match(shareIntegration,/async function grantedScreenPermission\(\)/,'Granted Screen Recording helper is missing.');
assert.match(shareIntegration,/const permission=proven\?'granted':'unknown';/,'Share entry must preserve granted-vs-unknown routing.');
assert.ok(!shareIntegration.includes('bridge?.probeAccess?.()'),'Initial Share must not enumerate sources as a permission probe.');
assert.match(shareIntegration,/const entry=await resolveShareEntry\(permission\)/,'Share must route through permission-aware selection.');
const openIndex=shareIntegration.indexOf('const result=await bridge.openPicker(permission);');
const diagnosticIndex=shareIntegration.indexOf('desktop?.media?.requestScreen?.()');
assert.ok(openIndex>=0&&diagnosticIndex>openIndex,'Deep Screen Recording diagnostics must remain post-failure only.');
assert.match(shareIntegration,/await share\.start\(\{name:'Shared content',options\}\)/,'Native first-authorization path must reach ShareController.');
assert.doesNotMatch(repair,/sharePicker\?\.listSources|sourceProbe\(|desktopCapturer|getSources\(/,'Physical compatibility code must not enumerate sources before Share authority chooses a mode.');
assert.match(repair,/return await integration\.open\(\)/,'Physical compatibility Share helper must delegate to Share Integration.');
const repairClick=repair.slice(repair.indexOf('function onDocumentClick'),repair.indexOf("document.addEventListener('submit'"));
assert.ok(!repairClick.includes('#roomShare'),'Physical Mac repair must not intercept the Share Screen button.');

// Critical presenter repair: captureStarted returns immediately, with no presenter
// BrowserWindow scheduling. Only a renderer commit sent after ShareController.start
// and shared-stage mounting may unlock presenter chrome.
const captureStarted=shareService.slice(
  shareService.indexOf("ipcMain.handle('share:capture-started'"),
  shareService.indexOf("ipcMain.handle('share:capture-state'")
);
assert.match(captureStarted,/toolbarPending:true/,'Capture start must report toolbar pending.');
assert.match(captureStarted,/meetingHidden:false/,'Capture start must keep the meeting visible.');
assert.match(captureStarted,/awaitingPresenterCommit:true/,'Capture start must wait for later presenter commit.');
assert.match(captureStarted,/keepMeetingRendererLive\(\)/,'Capture start must keep the renderer unthrottled.');
assert.doesNotMatch(captureStarted,/scheduleToolbarForShare\(\);/,'Capture start must not schedule presenter BrowserWindow work before its IPC reply is delivered.');
assert.doesNotMatch(captureStarted,/openToolbar\(/,'Presenter BrowserWindow creation must not occur inside captureStarted.');
assert.doesNotMatch(captureStarted,/hideMeetingWindowForShare\(\)/,'Meeting hide must not occur inside captureStarted.');

assert.match(shareService,/function scheduleToolbarForShare\(\)/,'Deferred presenter toolbar scheduler is missing.');
const scheduler=shareService.slice(shareService.indexOf('function scheduleToolbarForShare()'),shareService.indexOf('const displayMediaHandler'));
assert.match(scheduler,/toolbarOpenTimer=setTimeout\(async\(\)=>/,'Presenter toolbar must start on a later main-process turn after renderer commit.');
assert.match(scheduler,/const ready=await openToolbar\(\);/,'Deferred scheduler must create the real presenter toolbar.');
assert.match(scheduler,/\},75\);/,'Presenter toolbar scheduling must remain explicitly deferred after renderer commit.');
assert.match(scheduler,/toolbarReadyForShare=Boolean\(ready\)/,'Toolbar readiness must be tracked independently.');
assert.match(scheduler,/if\(presenterCommitPending\)/,'Committed presenter state must wait for toolbar readiness.');
assert.match(scheduler,/sendMain\('share:presenter-command','stop'\)/,'Toolbar creation failure must fail Share closed.');

// ShareController owns capture only. Integration owns safe presenter commit and
// that commit is the sole authority that may initiate toolbar creation.
assert.doesNotMatch(shareController,/rendererCommitted:true/,'ShareController must not own meeting visibility commit.');
assert.match(shareIntegration,/function commitPresenterMode\(\)/,'Share Integration must own presenter commit.');
assert.match(shareIntegration,/markCaptureProven\(\);applyLayout\(\);/,'Shared stage must mount before presenter commit.');
assert.match(shareIntegration,/bridge\?\.presenterCommitted\?\.\(/,'Share Integration cannot send presenter-ready state.');
assert.match(preload,/ipcRenderer\.send\('share:presenter-committed'/,'Presenter commit must use one-way IPC.');
const presenterCommitted=shareService.slice(
  shareService.indexOf("ipcMain.on('share:presenter-committed'"),
  shareService.indexOf("ipcMain.handle('share:capture-stopped'")
);
assert.match(presenterCommitted,/presenterCommitPending=true/,'Presenter commit must unlock presenter chrome only after renderer completion.');
assert.match(presenterCommitted,/if\(!toolbarReadyForShare\)\{scheduleToolbarForShare\(\);return;\}/,'Presenter toolbar creation must originate from renderer presenter commit.');
assert.match(presenterCommitted,/setImmediate\(\(\)=>/,'Meeting hide must happen on a later main-process turn after toolbar readiness.');
assert.match(shareService,/function cancelToolbarOpen\(\)/,'Pending presenter toolbar creation must be cancellable.');
assert.match(shareService,/cancelToolbarOpen\(\);/,'Stop Share must cancel deferred toolbar creation.');

// Floating presenter controls stay clickable and available across macOS Spaces.
assert.match(shareService,/async function openToolbar\(\)/,'Presenter toolbar loader is missing.');
assert.match(shareService,/await created\.loadFile\(path\.join\(uiDir,'presenter-toolbar\.html'\)\)/,'Presenter toolbar must load its real UI.');
assert.match(shareService,/acceptFirstMouse:true/,'Presenter toolbar must accept the first macOS click.');
assert.match(shareService,/backgroundThrottling:false/,'Presenter toolbar renderer must remain live.');
assert.match(shareService,/setVisibleOnAllWorkspaces\(true,\{visibleOnFullScreen:true/,'Presenter controls must remain visible across full-screen apps/Spaces.');
assert.doesNotMatch(shareService,/type:platform==='darwin'\?'panel':undefined/,'Unsupported nonactivating panel type must not return.');
assert.match(shareService,/function showCompanionWindow\(kind='chat'\)/,'Share companion authority is missing.');
assert.match(shareService,/showCompanionWindow\(normalized\)/,'Chat/Participants/Annotation must not reopen the full meeting by default.');
assert.match(shareCss,/data-ds-share-companion="chat"/,'Share Chat companion CSS is missing.');
assert.match(shareCss,/data-ds-share-companion="participants"/,'Share Participants companion CSS is missing.');
assert.match(shareCss,/data-ds-share-companion="annotate"/,'Share Annotation companion CSS is missing.');
assert.match(shareService,/if\(normalized==='stop'&&shareActive\)/,'Stop Share must retain main-process retry protection.');
assert.match(shareService,/showMeetingWindow\(\{focus:false\}\);sendMain\('share:presenter-command','stop'\)/,'Stop Share retry must wake the hidden renderer.');
assert.match(presenter,/data-command="stop"[^>]*>[\s\S]*Stop Share/,'Presenter toolbar must expose Stop Share.');
assert.match(presenterJs,/if\(command==='stop'\)/,'Presenter Stop Share must have direct click authority.');

// TCC/relaunch recovery remains explicit in this ad-hoc QA phase.
assert.match(repair,/resetScreenPermission/,'Explicit Screen Recording reset recovery is missing.');
assert.match(repair,/app\?\.relaunch/,'Screen Recording recovery must retain full-process relaunch.');
assert.match(relaunch,/tccutil.*reset.*ScreenCapture.*com\.dominionstar\.desktop/s,'TCC reset must target only DominionStar ScreenCapture permission.');
assert.match(relaunch,/stableAcrossRebuilds:false/,'Ad-hoc identity must not be represented as persistence-certified.');
assert.match(preload,/resetScreenPermission/,'Renderer must retain explicit TCC reset IPC.');
assert.match(preload,/relaunch/,'Renderer must retain relaunch IPC.');
assert.match(bootstrap,/relaunch-service\.mjs/,'Relaunch/TCC authority must load before desktop services.');

// Profile photo first; initials only as fallback.
assert.match(approved,/function syncProfilePictures\(\)/,'Meeting profile-photo synchronization is missing.');
assert.match(approved,/paintAvatar\(q\('#prejoinAvatar'\),own\.url/,'Prejoin must prefer profile photo.');
assert.match(approved,/paintAvatar\(q\('#stageAvatar'\),own\.url/,'Camera-off stage must prefer profile photo.');
assert.match(approved,/paintAvatar\(badge,url,initials\(name\)\)/,'Participant roster must fall back to initials only without a photo.');
assert.match(approved,/profileAvatarInput/,'Local user must be able to upload/change profile picture.');
assert.match(meetingCss,/\.person-badge\.has-photo/,'Profile-photo roster styling is missing.');

// Right-side Zoom-like video filmstrip, including two-person meetings.
assert.match(repair,/participantCount<=1&&visibleTiles===0/,'Two-person Speaker view is still suppressed.');
assert.match(repair,/dock\.dataset\.zoomThreshold=suppress\?'empty-solo':'available'/,'Corrected video-filmstrip threshold is missing.');
assert.match(approvedCss,/right:14px !important;/,'Video filmstrip does not default to the right edge.');
assert.match(approvedCss,/grid-template-columns:176px !important;/,'Desktop filmstrip is not vertical.');
assert.match(approvedCss,/@media\(max-width:680px\)/,'Top reflow does not remain limited to genuinely narrow windows.');

// Floating management panels and full-window meeting shell remain stable.
assert.doesNotMatch(runtime,/panel\.dataset\.dsRuntimeMode='docked'/,'Participants/Chat must not occupy the video-filmstrip edge.');
assert.match(runtime,/panel\.dataset\.dsRuntimeMode='floating'/,'Participants/Chat must use floating application surfaces.');
assert.match(runtime,/installFloatingSurfaceDrag\(panel\)/,'Floating participant/chat surfaces must remain draggable.');
assert.match(runtime,/stage\.style\.setProperty\('right','0px','important'\)/,'Floating panels must leave the stage full width.');
assert.match(runtimeCss,/width:var\(--ds-runtime-vw,100vw\)!important/,'Meeting must fill Electron viewport width.');
assert.match(runtimeCss,/height:var\(--ds-runtime-vh,100vh\)!important/,'Meeting must fill Electron viewport height.');
assert.match(adaptiveCss,/max-width:560px !important/,'Prejoin must remain compact.');
assert.match(css,/\.ds-reaction-tray[\s\S]*overflow:hidden!important/,'Reaction tray must remain contained.');
assert.match(repair,/Participants \(\$\{count\}\)/,'Participants heading must expose live count.');

console.log(`DOMINIONSTAR_PHYSICAL_MAC_2_0_21_OK carried-forward-on=${pkg.version} personal-id permission-aware-share native-unproven-fallback granted-custom-chooser capture-start-returns-before-toolbar toolbar-after-renderer-commit integration-owned-one-way-presenter-commit renderer-live-before-toolbar toolbar-fail-closed first-click-presenter-controls share-companions direct-stop-share profile-first-identity adhoc-not-certified two-person-right-video-filmstrip floating-participants-chat full-window compact-prejoin`);
