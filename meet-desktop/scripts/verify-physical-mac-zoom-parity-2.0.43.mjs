import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const adaptive=read('ui/zoom-adaptive-parity.js');
const polish=read('ui/zoom-production-polish.js');
const screenshotJs=read('ui/zoom-screenshot-reference-2.0.41.js');
const screenshotCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const physical=read('ui/zoom-physical-acceptance.js');
const features=read('ui/meeting-features.js');
const parity=read('ui/meeting-parity.js');
const personal=read('ui/personal-room.js');
const personalCss=read('ui/personal-room.css');
const app=read('ui/app.js');
const media=read('ui/media-controller.js');
const legacyParticipants=read('ui/participants-center-lock-2.0.41.js');
const legacyHostTools=read('ui/host-tools-separation-lock-2.0.41.js');
const legacyHostToolsCss=read('ui/host-tools-size-lock-2.0.41.css');
const indexHtml=read('ui/index.html');
const featureReady=read('ui/meeting-feature-ready-2.0.41.js');
const profileFallback=read('ui/profile-photo-fallback.js');
const shareService=read('src/share-service.mjs');
const shareController=read('ui/share-controller.js');
const macPresenter=read('src/mac-share-presenter-overlay.mjs');
const bootstrap=read('src/bootstrap.mjs');
const preload=read('src/preload.cjs');
const integration=read('ui/share-integration.js');
const shareRuntimeAuthority=read('ui/share-runtime-authority-2.0.41.js');
const macToolbarHtml=read('ui/mac-presenter-toolbar.html');

for(const source of [runtime,adaptive,polish,screenshotJs,physical,features,parity,personal,app,media,featureReady,profileFallback,shareController,shareRuntimeAuthority])new Function(source);

assert.equal(pkg.version,'2.0.43','Physical Mac parity repair must ship as 2.0.43.');

assert(runtime.includes("side.dataset.zoomPanelMode='runtime'")&&runtime.includes("panel.dataset.zoomPanelMode='runtime'"),'Participants and Chat must use one runtime panel authority.');
assert(legacyParticipants.includes("version:'2.0.43-compatibility-no-geometry'")&&!legacyParticipants.includes('setInterval(')&&!legacyParticipants.includes('function centerPanel('),'Legacy Participants compatibility must never re-center or poll the live panel.');
assert(legacyHostTools.includes("version:'2.0.43-compatibility-no-geometry'")&&!legacyHostTools.includes('centerParticipantsOnce')&&!legacyHostTools.includes("host.style.setProperty('width','248px'"),'Legacy Host Tools compatibility must not own Participants or Host Tools geometry.');
assert(!legacyHostToolsCss.includes('248px!important')&&!legacyHostToolsCss.includes('.room-side:has(.ds-ref-host-tools-panel)'),'Legacy Host Tools stylesheet must not shrink Host Tools or move Participants.');
assert(runtime.includes("panel.style.setProperty('right','10px','important')")&&runtime.includes("panel.style.setProperty('left','auto','important')"),'Default side surfaces must remain stably anchored at the meeting right edge.');
assert(runtime.includes('function ensurePanelTraffic(panel)')&&runtime.includes("className='ds-panel-traffic'"),'Participants and Chat must expose Mac-style close/minimize/zoom controls.');
assert(runtimeCss.includes('.ds-panel-traffic .close')&&runtimeCss.includes('.ds-panel-minimized'),'Panel traffic controls and minimization styling must be packaged.');
assert(runtimeCss.includes('position:fixed!important;\n  z-index:2800!important;')&&!runtimeCss.includes('left:18px!important;\n  right:auto!important;\n  top:auto!important;\n  bottom:94px!important;'),'Reaction chooser must not be hard-pinned to the lower-left corner.');

assert(adaptive.includes('if(window.DominionRuntimeStability?.layoutSideSurface){window.DominionRuntimeStability.layoutSideSurface();}')&&adaptive.includes("side.style.setProperty('right','10px','important')"),'Adaptive parity must defer to the final stable side-surface authority.');
assert(polish.includes('if(window.DominionRuntimeStability?.layoutSideSurface){window.DominionRuntimeStability.layoutSideSurface();return;}')&&polish.includes("menu.dataset.dsAnchorStable='1'"),'Production polish must stop rewriting panel and reaction geometry.');

assert(screenshotCss.includes('#prejoinOverlay #prejoinAvatar[hidden]{display:none!important}'),'Live prejoin video must never have the profile avatar painted over it.');
assert(screenshotCss.includes('.meeting-head .ds-meeting-brand{display:flex!important')&&screenshotCss.includes('.meeting-view-button{display:inline-flex!important'),'Meeting chrome must expose DominionStar branding and a clear View control.');
assert(screenshotCss.includes('.ds-ref-meeting-head-icons{display:none!important}')&&screenshotJs.includes("head.querySelector('.ds-ref-meeting-head-icons')?.remove()"),'Obsolete unexplained meeting-head glyph controls must be removed.');
assert(screenshotCss.includes('#meetingOverlay .room-side{width:390px!important')&&screenshotCss.includes('right:10px!important;bottom:10px!important;transform:none!important'),'Final Participants CSS must agree with the right-edge runtime position.');
assert(screenshotCss.includes('.ds-ref-host-tools-panel{position:fixed;right:0;top:86px;bottom:68px;width:360px;')&&screenshotCss.includes('.ds-ref-host-tools-panel label{height:42px;'),'Host Tools must use the approved readable DominionStar panel scale.');

assert(physical.includes('function normalizeParticipantIdentity(row,id)')&&physical.includes("copy.querySelector('small')?.remove()")&&physical.includes("querySelectorAll('[data-participant-more],[data-ds-self-more],.ds-host-row-more')"),'Participant rows must collapse duplicate role labels and duplicate ellipsis controls to one canonical representation.');
assert(physical.includes("className='ds-canonical-role'")&&physical.includes("className='ds-canonical-self'"),'Participant identity must render one role badge and one self marker.');
assert(parity.includes('<circle cx="18.2" cy="6" r="3.1"/>')&&physical.includes('<circle cx="18.2" cy="6" r="3.1"/>'),'Reaction toolbar icon must be a recognizable smiley-plus symbol.');
assert(features.includes('r.left+r.width/2-width/2')&&features.includes('const top=Math.max(10,r.top-height-10)'),'Reaction chooser must open directly above its toolbar button.');

assert(personal.includes("passInput.value=String(state.room.passcode||'')")&&personal.includes('passInput.disabled=personal'),'Personal Meeting ID mode must not show a stale unrelated passcode.');
assert(personalCss.includes('#newMeetingDialog label[hidden]{display:none!important}'),'Hidden personal-room passcode field must remain visually hidden.');
assert(app.includes('const operation=media.setCamera(target);\n    syncMediaLabels();\n    attachPreview();\n    try{\n      await operation;attachPreview();syncMediaLabels();'),'Video button state and camera fallback must react before waiting for device acquisition.');
assert(media.includes('warmVideoTimer=setTimeout(releaseWarmVideo,1800)'),'Camera warm handoff must remain bounded while immediate UI intent provides responsive control feedback.');


assert(!indexHtml.includes('<script src="./share-integration.js"></script>')&&media.includes("script.src='./share-integration.js'")&&media.includes("script.dataset.dsShareIntegration='1'"),'Share integration must have one bootstrap authority owned by MediaController, with no competing static loader.');
assert(shareRuntimeAuthority.includes('async function waitForShareIntegration(timeoutMs=3000)')&&shareRuntimeAuthority.includes('if(!await waitForShareIntegration())'),'The final Share chooser must wait for the single Share integration bootstrap before source enumeration or commit.');
assert(featureReady.includes('#stageAvatar{width:196px!important;height:196px!important;border-radius:50%!important')&&read('ui/meeting-parity.css').includes('.stage-avatar{width:196px;height:196px;border-radius:50%}'),'Camera-off stage profile photos must remain at the enlarged circular meeting scale after final reference handoff.');
assert(screenshotCss.includes('#prejoinOverlay #prejoinAvatar[hidden]{display:none!important}')&&read('ui/meeting-parity.css').includes('#prejoinAvatar.preview-avatar{width:176px;height:176px;border-radius:50%'),'Prejoin must hide its avatar over live video and use the enlarged camera-off profile scale.');
assert(screenshotCss.includes('#meetingOverlay .meeting-footer{height:64px!important;min-height:64px!important')&&screenshotCss.includes('#meetingOverlay .meeting-control{min-width:68px!important;height:58px!important')&&screenshotCss.includes('.meeting-control .ds-control-icon{width:24px!important;height:24px!important')&&screenshotCss.includes('.meeting-control .ds-control-label{font-size:11px!important'),'Final meeting toolbar must preserve readable control targets and icon/label scale instead of reverting to the undersized reference dimensions.');
assert(profileFallback.includes('width:88px;height:88px;border-radius:50%'),'Participant camera-off profile photos must no longer use the undersized 58px fallback.');
assert(featureReady.includes('box-shadow:none!important')&&read('ui/meeting-parity.css').includes('box-shadow:none!important'),'Mic/video off state must use one clean slash without the old doubled halo stripe.');
assert(featureReady.includes('M18.8 3.1v3.6M17 4.9h3.6'),'The loaded meeting toolbar must use the recognizable reaction smile/spark icon.');
assert(shareService.includes("return {ok:Boolean(sent),qaCommandId:Number(delivery?.qaCommandId||0),sent:Boolean(sent),direct:Boolean(delivery?.direct),handled:Boolean(delivery?.direct)}"),'Presenter command service must expose execution proof instead of a bare production ok response.');
const macToolbar=read('ui/mac-presenter-toolbar.js');
assert(macToolbar.includes("if(nativeBridge?.command)return await sendNative(normalized);")&&!macToolbar.includes("if(nativeBridge?.command)return sendNative(normalized);"),'Physical-Mac presenter controls must use one acknowledged native delivery path instead of duplicate renderer/native dispatch.');
assert(preload.includes('const accepted=result?.handled===true;')&&!preload.includes('const accepted=result?.handled!==false;'),'Presenter preload must reject undefined/stale listener results instead of falsely acknowledging dead toolbar commands.');
assert(integration.includes("if(command==='stop'){clearCompanion();await share.stop();return {handled:true,command};}")&&!integration.includes("await share.stop();applyLayout();return {handled:true,command};"),'Stop Share must use one local-first state transition and rely on the synchronous share-state listener to restore meeting chrome.');
assert(!macToolbarHtml.includes('id="layoutButton"')&&!macToolbarHtml.includes('data-command="show-meeting"><span class="glyph"')&&macToolbarHtml.includes('<button type="button" data-command="show-meeting">Show meeting</button>'),'Presenter strip must expose only primary share controls while secondary layout/show-meeting actions live under More.');
assert(shareService.indexOf('closePicker();\n    if(platform===\'darwin\')parkMacMeetingWindow({preCapture:true});')>=0,'The share chooser must disappear before the Mac meeting window is parked for capture.');
assert(shareService.includes("displayId:String(source.display_id||'')")&&shareController.includes("displayId:String(state.options?.displayId||'')"),'The selected physical display identity must flow from source selection into presenter state.');
assert(macPresenter.includes('const displayForSharedContent=()=>')&&macPresenter.includes('{x:bounds.x,y:bounds.y,width:t,height:Math.max(t,bounds.height)}')&&macPresenter.includes('setImmediate(()=>{if(shareActive&&bordersReady()){positionBorder();'),'The green presenter border must use the selected display, flush full-height side edges, and re-lock after macOS window placement.');
assert(shareService.includes('main.setOpacity?.(0.001)')&&bootstrap.includes('originalSetOpacity.call(main,0.001)'),'The live meeting renderer must remain scheduled at near-zero opacity instead of visibly leaking into the shared desktop.');

console.log('DOMINIONSTAR_PHYSICAL_MAC_PARITY_2_0_43_OK stable-right-panels mac-panel-controls canonical-participant-row anchored-reactions readable-host-tools branded-header prejoin-avatar-safe personal-passcode-consistent responsive-video single-share-bootstrap');
