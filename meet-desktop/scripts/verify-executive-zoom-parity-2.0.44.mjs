import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const index=read('ui/index.html');
const runtime=read('ui/runtime-stability.js');
const screenshotJs=read('ui/zoom-screenshot-reference-2.0.41.js');
const screenshotCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const physical=read('ui/zoom-physical-acceptance.js');
const profile=read('ui/profile-photo-fallback.js');
const personal=read('ui/personal-room.js');
const app=read('ui/app.js');

assert.equal(pkg.version,'2.0.44','Executive Zoom parity repair must ship under 2.0.44.');
assert(!index.includes('participants-center-lock-2.0.41.js')&&!index.includes('host-tools-separation-lock-2.0.41.js'),'Conflicting legacy panel/host locks must not load.');
assert(runtime.includes("overlay.dataset.dsRuntimeSide='center-floating'")&&runtime.includes("Math.round((bodyWidth-pw)/2)"),'Participants and Chat must share one stable centered floating authority.');
assert(runtime.includes("document.addEventListener('pointermove',moveFloatingSurface,true)")&&runtime.includes("document.addEventListener('pointerup',endFloatingSurfaceDrag,true)"),'Floating panel drag must continue through document-level pointer movement after the pointer leaves the title bar.');
assert(runtime.includes("document.addEventListener('mousedown',event=>{const hit=delegatedFloatingPanel(event);if(hit)beginFloatingDrag(hit.panel,event,'mouse');},true)")&&runtime.includes("document.addEventListener('pointerdown',event=>{const hit=delegatedFloatingPanel(event);if(hit)beginFloatingDrag(hit.panel,event,'pointer');},true)"),'Floating panel drag must begin from delegated document-capture mouse/pointer input so title-bar replacement cannot break it.');
assert(read('ui/zoom-participants-reference-2.0.41.js').includes('.ds-participants-mac .room-side-head>button{display:grid!important'),'Participants close control must remain visible on Mac.');
assert(runtime.includes("'DominionZoomParticipantsReference2041'")&&runtime.includes("window.DominionZoomParticipantsReference2041?.sync?.()"),'Legacy participant chrome may prime once but its geometry reconciler must be retired.');
assert(runtime.includes('function openRuntimeHostTools(anchor)')&&runtime.includes('void openRuntimeHostTools(hostTools)')&&!runtime.includes("DominionMeetingParity?.openSecurity?.(hostTools)"),'Host Tools must have one canonical runtime owner.');
assert(screenshotJs.includes("host.dataset.dsRefHostBound='runtime-single-owner'"),'Screenshot compatibility layer must not bind a second Host Tools listener.');
assert(screenshotCss.includes('#prejoinOverlay #prejoinAvatar[hidden]{display:none!important}'),'Hidden prejoin avatar must stay hidden over live video.');
assert(profile.includes('videoActuallyLive')&&profile.includes("getVideoTracks?.()"),'Prejoin avatar fallback must follow the actual live video track.');
assert(physical.includes("roleText='(Host, me)'")&&physical.includes('.ds-canonical-participant-role')&&!physical.includes("badge.className='ds-role-chip'"),'Participant role presentation must be one Zoom-style suffix, never a duplicate badge.');
assert(runtime.includes("host.onclick=null")&&runtime.includes("host.dataset.dsPhysicalAuthority='runtime-owned'"),'Physical Host Tools onclick must be retired after priming so runtime remains the only owner.');
assert(runtime.includes("data-ds-runtime-close-participants")||runtime.includes("dataset.dsRuntimeCloseParticipants='1'"),'Participants must expose a direct close control.');
assert(personal.includes("passInput.value=String(state.room.passcode||'')")&&personal.includes("passLabel.style.setProperty('display',personal?'none':'','important')"),'Personal Meeting ID mode must not expose a stale alternate passcode.');
assert(app.includes("if(!target){")&&app.includes("prejoinVideo.hidden=true"),'Camera-off feedback must remain immediate.');

console.log('DOMINIONSTAR_EXECUTIVE_ZOOM_PARITY_2_0_44_OK single-layout-authority centered-floating-panels single-host-tools prejoin-video-exclusive canonical-participant-role direct-close clean-personal-passcode');
