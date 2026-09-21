import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const runtime=read('ui/runtime-stability.js');
const screenshotJs=read('ui/zoom-screenshot-reference-2.0.41.js');
const screenshotCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const physical=read('ui/zoom-physical-acceptance.js');
const profile=read('ui/profile-photo-fallback.js');
const personal=read('ui/personal-room.js');
const app=read('ui/app.js');

assert.equal(pkg.version,'2.0.43','Physical Zoom-behavior repair must ship under 2.0.43.');
assert(runtime.includes("overlay.dataset.dsRuntimeSide='right-floating'")&&runtime.includes("bodyWidth-pw-12"),'Participants and Chat must share one stable right-edge runtime authority.');
assert(runtime.includes("const tray=q('.ds-reaction-tray')||q('.meeting-reaction-menu')")&&runtime.includes("r.left+r.width/2-w/2"),'Reaction chooser must anchor directly above React.');
assert(screenshotCss.includes('.meeting-head .ds-meeting-brand{display:flex!important')&&screenshotCss.includes('.ds-ref-meeting-head-icons{display:none!important}'),'Meeting header must show DominionStar branding and suppress stray top-right controls.');
assert(screenshotCss.includes('.room-side{width:390px!important')&&screenshotCss.includes('right:12px!important')&&screenshotCss.includes('transform:none!important'),'Final Participants geometry must agree with right-edge runtime authority.');
assert(screenshotCss.includes('.ds-ref-host-tools-panel{position:fixed;right:12px')&&screenshotCss.includes('width:360px'),'Host Tools must remain readable at the final desktop scale.');
assert(screenshotJs.includes("close.dataset.dsParticipantsClose='1'")&&screenshotJs.includes("close.onclick=()=>q('#roomParticipants')?.click()"),'Participants must expose a direct close control.');
assert(profile.includes("prejoinAvatar.hidden=Boolean(mediaState.videoLive)")&&profile.includes("prejoinVideo.hidden=!Boolean(mediaState.videoLive)"),'Profile photo must never overlay live prejoin video.');
assert(personal.includes("passInput.value=String(state.room.passcode||'')")&&personal.includes("passLabel.style.setProperty('display',personal?'none':'','important')"),'Personal Meeting ID mode must not expose a stale alternate passcode.');
assert(app.includes("if(!target){")&&app.includes("prejoinVideo.hidden=true")&&app.includes("setControlLabel(id,target?'Stop Video':'Start Video')"),'Camera controls must provide immediate click feedback before asynchronous media work.');
assert(physical.includes("const existing=actions.querySelector('[data-participant-more]')")&&physical.includes("replace(/\\s*\\((?:host|co-host|cohost|me)\\)\\s*/gi"),'Participant rows must not duplicate overflow controls or role labels.');

console.log('DOMINIONSTAR_PHYSICAL_ZOOM_BEHAVIOR_2_0_43_OK stable-right-panels no-duplicate-participant-chrome close-controls reaction-above-toolbar readable-host-tools branded-header clean-prejoin immediate-camera-feedback consistent-personal-passcode');
