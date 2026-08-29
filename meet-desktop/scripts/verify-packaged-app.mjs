import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-app.mjs <DominionStar Meet.app>');
const absolute=path.resolve(appPath);assert(fs.existsSync(absolute),'Packaged .app does not exist.');
const resources=path.join(absolute,'Contents','Resources'),asarPath=path.join(resources,'app.asar');
assert(fs.existsSync(asarPath),'Packaged app.asar is missing.');
assert(fs.existsSync(path.join(resources,'branding','dominionstar-logo.jpeg')),'Packaged app must include the DominionStar logo.');
const asarBin=path.resolve('node_modules/@electron/asar/bin/asar.js');
const listing=execFileSync(process.execPath,[asarBin,'list',asarPath],{encoding:'utf8'});
const required=[
  '/src/main.mjs','/src/auth-service.mjs','/src/meeting-service.mjs','/src/share-service.mjs','/src/share-source-authority.mjs','/src/preload.cjs',
  '/ui/index.html','/ui/app.js','/ui/auth-password.js','/ui/media-controller.js','/ui/video-effects.js','/ui/av-settings.js','/ui/av-settings.css',
  '/ui/meeting-parity.js','/ui/meeting-parity.css','/ui/meeting-features.js','/ui/meeting-features.css','/ui/meeting-captions.js','/ui/meeting-captions.css',
  '/ui/zoom-behavior.js','/ui/zoom-behavior.css','/ui/participant-controls.js','/ui/participant-controls.css','/ui/participants-window.html','/ui/participants-window.js','/ui/participants-window.css',
  '/ui/physical-zoom-parity.js','/ui/physical-zoom-parity.css','/ui/meeting-notifications.js','/ui/meeting-notifications.css','/ui/preferences.js',
  '/ui/share-controller.js','/ui/share-integration.js','/ui/share-annotation.js','/ui/share-picker.html','/ui/share-picker.js','/ui/share-picker.css','/ui/presenter-toolbar.html','/ui/presenter-toolbar.js',
  '/ui/webrtc-controller.js','/ui/webrtc.css','/package.json'
];
for(const item of required)assert(listing.includes(item),`Packaged ASAR is missing ${item}`);
for(const forbidden of ['/desktop/','/desktop 2/','/meet-home/','/meet-login/','/assets/js/meeting-engine.js'])assert(!listing.includes(forbidden),`Legacy runtime leaked into packaged ASAR: ${forbidden}`);

const unpackDir=path.resolve('.package-audit');fs.rmSync(unpackDir,{recursive:true,force:true});execFileSync(process.execPath,[asarBin,'extract',asarPath,unpackDir]);
const read=(...parts)=>fs.readFileSync(path.join(unpackDir,...parts),'utf8');
const main=read('src','main.mjs'),auth=read('src','auth-service.mjs'),meeting=read('src','meeting-service.mjs'),preload=read('src','preload.cjs'),shareService=read('src','share-service.mjs'),shareAuthority=read('src','share-source-authority.mjs');
const app=read('ui','app.js'),authBootstrap=read('ui','auth-password.js'),av=read('ui','av-settings.js'),physical=read('ui','physical-zoom-parity.js'),physicalCss=read('ui','physical-zoom-parity.css');
const pickerHtml=read('ui','share-picker.html'),picker=read('ui','share-picker.js'),shareController=read('ui','share-controller.js'),shareIntegration=read('ui','share-integration.js'),annotation=read('ui','share-annotation.js'),presenter=read('ui','presenter-toolbar.html');
const participantHtml=read('ui','participants-window.html'),participantJs=read('ui','participants-window.js'),participantCss=read('ui','participants-window.css'),participantControls=read('ui','participant-controls.js');
const parity=read('ui','meeting-parity.js'),features=read('ui','meeting-features.js'),zoom=read('ui','zoom-behavior.js'),notifications=read('ui','meeting-notifications.js'),webrtc=read('ui','webrtc-controller.js'),videoEffects=read('ui','video-effects.js');

// Native desktop identity and auth.
assert(main.includes("loadFile(path.join(uiDir,'index.html'))"),'Packaged app must boot local desktop UI.');
assert(!main.includes('dominionstarld.com'),'Packaged desktop must not boot the public website.');
assert(auth.includes("flowType:'pkce'")&&auth.includes("CALLBACK_HOST='127.0.0.1'")&&auth.includes('signInWithPassword'),'Packaged auth must retain PKCE, loopback callback, and password sign-in.');
assert(preload.includes('brand:Object.freeze({logoUrl})'),'Packaged renderer must receive the real DominionStar logo through the narrow bridge.');
assert(meeting.includes("/^\\d{3,7}$/")&&meeting.includes("/^\\d{10,11}$/"),'Meeting authority must retain exact passcode/Meeting ID validation.');

// Physical Mic / Video parity.
assert(authBootstrap.includes('physical-zoom-parity.js')&&authBootstrap.includes('physical-zoom-parity.css'),'Packaged desktop must load physical Zoom parity layer.');
assert(av.includes("caret.className='av-device-caret attached-device-caret'")&&av.includes("button.insertAdjacentElement('afterend',caret)"),'Packaged Mic/Video device arrows must be adjacent to their controls.');
assert(physical.includes("if(button.nextElementSibling!==caret)button.insertAdjacentElement('afterend',caret)"),'Packaged toolbar must repair detached carets.');
assert(physicalCss.includes('.av-device-caret.zoom-attached-caret'),'Packaged caret must be visually bound to its split control.');
assert(physical.includes("setFallback(q('#prejoinAvatar'),currentUser)")&&physical.includes("setFallback(q('#stageAvatar'),currentUser)"),'Packaged camera-off fallback must use signed-in profile photo where available.');
assert(app.includes('id="stageAvatar"')&&app.includes('id="prejoinAvatar"'),'Packaged camera-off fallback surfaces must exist.');

// Physical share path: no stale pre-gate; actual source discovery is authority.
assert(shareService.includes("ipcMain.handle('share:open-picker',()=>openPicker())"),'Packaged Share must open the native source chooser immediately.');
assert(!shareIntegration.includes('requestScreen?.()'),'Packaged renderer must not re-block Share using stale Screen Recording status.');
assert(shareIntegration.includes('openSharePicker')&&shareIntegration.includes('await bridge.openPicker()'),'Packaged meeting Share must call the independent chooser directly.');
assert(shareAuthority.includes('const sourceMaps=new Map()')&&shareAuthority.includes('mergedMap().get'),'Packaged source authority must retain screen and window groups together.');
assert(pickerHtml.includes('Entire screen')&&pickerHtml.includes('Application windows'),'Packaged source chooser must expose entire displays and application windows.');
assert(picker.includes("kind:'screen'")&&picker.includes("kind:'window'"),'Packaged source chooser must enumerate both source classes.');
assert(picker.includes('const first=screens[0]||windows[0]||null'),'Packaged source chooser must preselect an available source.');
assert(pickerHtml.includes('Share sound')&&pickerHtml.includes('Optimize for video sharing'),'Packaged source chooser must expose real share options.');
assert(!pickerHtml.includes('Presenter layout'),'Packaged picker must not advertise an unimplemented presenter-layout mode.');
assert(shareController.includes('async function replaceSource')&&shareController.includes('const previousLive=state.liveStream'),'Packaged New Share must acquire transactionally.');
assert(shareIntegration.includes("if(command==='new-share'){await openSharePicker();return;}")&&shareIntegration.includes('if(replacing){await share.replaceSource'),'Packaged New Share must keep current presentation until replacement succeeds.');
assert(shareController.includes('canvas.captureStream(1)')&&shareController.includes('context.drawImage(videoElement,0,0,width,height)'),'Packaged Pause Share must freeze the last frame rather than blacking out.');
assert(annotation.includes('data-annotation-mode="laser"')&&annotation.includes('data-annotation-undo'),'Packaged annotation must retain laser and Undo.');
for(const command of ['audio','video','pause','participants','show-meeting','stop'])assert(presenter.includes(`data-command="${command}"`),`Presenter toolbar missing ${command}.`);

// Participants is a separate utility window, not the obsolete inline admin panel.
assert(preload.includes('participants:Object.freeze'),'Packaged app must expose a narrow Participants utility bridge.');
assert(shareService.includes("titleBarStyle:platform==='darwin'?'hiddenInset':'default'")&&shareService.includes('positionParticipants(participantWindow)'),'Packaged Participants must be a native-style floating utility window.');
assert(participantHtml.includes('Invite')&&participantHtml.includes('Mute All')&&participantHtml.includes('More'),'Packaged Participants footer must be Invite / Mute All / More.');
assert(participantHtml.includes('Ask All to Unmute')&&participantHtml.includes('Mute participants upon entry')&&participantHtml.includes('Play join and leave sound'),'Packaged Participants More menu must contain secondary bulk actions.');
assert(participantJs.includes("add('Mute','host:mute')")&&participantJs.includes("add('Ask to Unmute','host:ask-unmute')")&&participantJs.includes("add('Stop Video','host:stop-video')")&&participantJs.includes("add('Ask to Start Video','host:ask-start-video')"),'Packaged participant row controls must remain functional.');
assert(participantCss.includes('-webkit-app-region:drag'),'Packaged Participants title bar must be independently draggable.');
assert(physical.includes('desktop.participants?.toggle?.()')&&physical.includes('side.hidden=true'),'Packaged main Participants control must open the utility window and suppress obsolete inline panel.');
assert(participantControls.includes("type==='host:mute'")&&participantControls.includes("type==='host:ask-unmute'")&&participantControls.includes('authorizedSender'),'Remote participant control execution must remain authority-checked.');

// Chat, recording, notifications, video dock and media transport remain live.
assert(zoom.includes('meetingChatRecipient')&&zoom.includes('sendZoomChat')&&zoom.includes('meetingChatPolicy'),'Packaged Chat must retain Everyone/private recipient and host policy behavior.');
assert(features.includes('recordingAuthority()')&&features.includes('toggleRecording'),'Packaged recording must retain authority checks.');
assert(notifications.includes("play('waiting')")&&notifications.includes("play('join')")&&notifications.includes("play('leave')")&&notifications.includes("play('chat')"),'Packaged meeting sounds must retain Waiting Room, join/leave, and Chat feedback.');
assert(parity.includes("dock.dataset.orientation=(anchor==='top'||anchor==='bottom')?'horizontal':'vertical'"),'Packaged participant video dock must switch horizontal/vertical with placement.');
assert(parity.includes('share-panel-floating')&&parity.includes('shareVideoDock'),'Packaged share layout must retain floating participant video panel.');
assert(webrtc.includes('RTCPeerConnection')&&(webrtc.match(/addTransceiver\('audio'/g)||[]).length===2&&(webrtc.match(/addTransceiver\('video'/g)||[]).length===2,'Packaged transport must retain microphone, camera, shared video, and system-audio lanes.');
assert(videoEffects.includes('setVirtualBackground')&&videoEffects.includes('setAppearance'),'Packaged outgoing video effects path must remain present.');

console.log('DOMINIONSTAR_PACKAGED_APP_OK physical-zoom-contract local-auth attached-av-carets profile-fallback direct-share-picker screens-windows transactional-share native-participants chat sounds floating-video-dock four-media-lanes');
