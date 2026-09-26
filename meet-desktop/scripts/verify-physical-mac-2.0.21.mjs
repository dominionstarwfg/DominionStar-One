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
const rejectionCss=read('ui/rejected-build-repair-2.0.40.css');
const pkg=JSON.parse(read('package.json'));

const [major,minor,patch]=String(pkg.version||'').split('.').map(Number);
assert.ok(major===2&&minor===0&&Number.isInteger(patch)&&patch>=21,`Physical Mac gate requires 2.0.21+; found ${pkg.version}.`);

// Final authority load order and screenshot rejection layer.
for(const file of ['physical-mac-repair.css','zoom-adaptive-parity.css','runtime-stability.css','rejected-build-repair-2.0.40.css'])assert.ok(auth.includes(file),`${file} must be loaded.`);
for(const file of ['physical-mac-repair.js','zoom-adaptive-parity.js','runtime-stability.js'])assert.ok(auth.includes(file),`${file} must be loaded.`);
assert.ok(auth.indexOf('zoom-physical-acceptance.css')<auth.indexOf('rejected-build-repair-2.0.40.css'),'2.0.40 rejection repair must load after the rejected physical layer.');
assert.ok(rejectionCss.includes('#participantRoster .ds-participant-media{display:none!important}'),'Duplicate participant media renderer must remain physically hidden.');

// Personal Meeting ID and prejoin identity remain deterministic.
assert.match(repair,/document\.addEventListener\('submit'.*true\)/s);
assert.match(repair,/newMeetingUsePersonal/);
assert.match(repair,/meeting\?\.personalRoom/);
assert.match(repair,/meeting\?\.startPersonalRoom/);
assert.match(repair,/digits\(personal\.roomCode\)!==digits\(room\.roomCode\)/);
assert.match(repair,/beginHostPrejoin\(room,'personal'\)/);

// 2.0.40 rejected-preshare repair: system picker can be detected, but may not
// own capture. The app-owned chooser is the only active pre-share authority.
assert.match(shareService,/systemPickerAvailable=platform==='darwin'&&macMajor>=15/,'macOS capability detection must remain available for diagnostics.');
assert.match(shareService,/const nativeSystemPicker=false/,'Rejected macOS system picker must stay disabled in active capture.');
assert.match(shareService,/function configureDisplayMediaHandler\(useSystemPicker\)/,'Display-media handler authority is missing.');
assert.match(shareService,/configureDisplayMediaHandler\(false\);/,'Custom DominionStar display-media handler must initialize immediately.');
assert.doesNotMatch(shareService,/if\(nativeSystemPicker&&status!=='granted'\)/,'No permission state may reopen the rejected Apple share overlay.');
assert.match(shareService,/share:list-sources[\s\S]*configureDisplayMediaHandler\(false\);pendingSelection=null/,'Opening approved chooser must clear stale pending selection and force custom capture.');
assert.match(shareService,/share:select-source[\s\S]*configureDisplayMediaHandler\(false\)/,'Source commit must force custom capture before getDisplayMedia.');
assert.match(shareIntegration,/SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'/);
assert.match(shareIntegration,/const result=await bridge\.openPicker\(permission\)/);
assert.ok(!shareIntegration.includes('bridge?.probeAccess?.()'),'Initial Share must not enumerate sources as a permission probe.');
const openIndex=shareIntegration.indexOf('const result=await bridge.openPicker(permission);');
const diagnosticIndex=shareIntegration.indexOf('desktop?.media?.requestScreen?.()');
assert.ok(openIndex>=0&&diagnosticIndex>openIndex,'Deep Screen Recording diagnostics must remain post-failure only.');
assert.doesNotMatch(repair,/sharePicker\?\.listSources|sourceProbe\(|desktopCapturer|getSources\(/,'Compatibility layer must not compete with the share authority.');
assert.match(repair,/return await integration\.open\(\)/,'Physical compatibility Share helper must delegate to Share Integration.');

// Share start may not hang forever.
assert.match(shareController,/let displayRequestGeneration=0/);
assert.match(shareController,/error\.code='share_start_timeout'/);
assert.match(shareController,/setTimeout\(\(\)=>\{timedOut=true;[\s\S]*\},5000\)/,'Share start timeout must remain five seconds.');
assert.match(shareController,/capturePromise\.then\(lateStream=>stopTracks\(lateStream\)\)/,'Late capture completion must be discarded.');

// Capture start remains one-way so the renderer cannot deadlock on main IPC.
assert.match(preload,/captureStarted:state=>\{ipcRenderer\.send\('share:capture-started',state\|\|\{\}\);return true;\}/);
assert.doesNotMatch(preload,/captureStarted:state=>invoke\('share:capture-started'/);
const captureStarted=shareService.slice(shareService.indexOf("ipcMain.on('share:capture-started'"),shareService.indexOf("ipcMain.handle('share:capture-state'"));
assert.match(captureStarted,/event\.sender!==main\.webContents/);
assert.match(captureStarted,/keepMeetingRendererLive\(\)/);
assert.doesNotMatch(captureStarted,/scheduleToolbarForShare\(\);/);
assert.doesNotMatch(captureStarted,/openToolbar\(/);
assert.doesNotMatch(captureStarted,/hideMeetingWindowForShare\(\)/);

// Presenter controls remain available and direct.
const scheduler=shareService.slice(shareService.indexOf('function scheduleToolbarForShare()'),shareService.indexOf('const displayMediaHandler'));
assert.match(scheduler,/if\(platform==='darwin'\)/);
assert.match(scheduler,/toolbarReadyForShare=true/);
assert.match(scheduler,/toolbarOpenTimer=setTimeout\(async\(\)=>/);
assert.match(shareIntegration,/id='inlinePresenterToolbar'/);
assert.match(shareIntegration,/data-inline-command="pause"/);
assert.match(shareIntegration,/data-inline-command="stop"/);
assert.doesNotMatch(shareController,/rendererCommitted:true/);
assert.match(shareIntegration,/function commitPresenterMode\(\)/);
assert.match(shareIntegration,/markCaptureProven\(\);applyLayout\(\);/);
assert.match(preload,/ipcRenderer\.send\('share:presenter-committed'/);
assert.match(shareService,/async function openToolbar\(\)/);
assert.match(shareService,/acceptFirstMouse:true/);
assert.match(shareService,/backgroundThrottling:false/);
assert.match(shareService,/showCompanionWindow\(normalized\)/);
assert.match(shareCss,/data-ds-share-companion="chat"/);
assert.match(shareCss,/data-ds-share-companion="participants"/);
assert.match(shareCss,/data-ds-share-companion="annotate"/);
assert.match(presenter,/data-command="stop"[^>]*>[\s\S]*Stop Share/);
assert.match(presenterJs,/if\(command==='stop'\)/);

// TCC/relaunch recovery remains explicit during ad-hoc QA.
assert.match(repair,/resetScreenPermission/);
assert.match(repair,/app\?\.relaunch/);
assert.match(relaunch,/tccutil.*reset.*ScreenCapture.*com\.dominionstar\.desktop/s);
assert.match(relaunch,/stableAcrossRebuilds:false/);
assert.match(preload,/resetScreenPermission/);
assert.match(bootstrap,/relaunch-service\.mjs/);

// Profile-photo-first identity stays local to the user's selected profile data.
assert.match(approved,/function syncProfilePictures\(\)/);
assert.match(approved,/paintAvatar\(q\('#prejoinAvatar'\),own\.url/);
assert.match(approved,/paintAvatar\(q\('#stageAvatar'\),own\.url/);
assert.match(approved,/paintAvatar\(badge,url,initials\(name\)\)/);
assert.match(meetingCss,/\.person-badge\.has-photo/);

// Right-side video filmstrip, floating management panels, and full-window shell.
assert.match(repair,/participantCount<=1&&visibleTiles===0/);
assert.match(approvedCss,/right:14px !important;/);
assert.match(approvedCss,/grid-template-columns:176px !important;/);
assert.match(approvedCss,/@media\(max-width:680px\)/);
assert.doesNotMatch(runtime,/panel\.dataset\.dsRuntimeMode='docked'/);
assert.match(runtime,/panel\.dataset\.dsRuntimeMode='floating'/);
assert.match(runtime,/installFloatingSurfaceDrag\(panel\)/);
assert.match(runtimeCss,/width:var\(--ds-runtime-vw,100vw\)!important/);
assert.match(runtimeCss,/height:var\(--ds-runtime-vh,100vh\)!important/);
assert.match(adaptiveCss,/max-width:560px !important/);
assert.match(css,/\.ds-reaction-tray[\s\S]*overflow:hidden!important/);

console.log(`DOMINIONSTAR_PHYSICAL_MAC_2_0_21_OK carried-forward-on=${pkg.version} custom-only-preshare no-apple-overlay bounded-share-start one-participant-media-set presenter-controls profile-first-identity two-person-right-video-filmstrip floating-participants-chat full-window compact-prejoin`);
