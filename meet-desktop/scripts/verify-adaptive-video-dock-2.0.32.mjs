import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const approved=read('ui/approved-reference-parity.css');
const parity=read('ui/meeting-parity.js');
const participantControls=read('ui/participant-controls.js');
const webrtc=read('ui/webrtc-controller.js');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=32))),'Adaptive video-dock authority introduced in 2.0.32 must remain enforced for every later candidate.');
assert.ok(runtime.includes('function syncVideoDockGeometry()'),'Final runtime must own dock geometry.');
assert.ok(!runtime.includes('const compact=width<760'),'Default participant video must not change anchor automatically at a compact threshold.');
assert.ok(runtime.includes("dock.dataset.dsRuntimeDockMode=userPositioned?'user':'right'"),'Dock must resolve only to explicit user position or the approved right default.');
assert.ok(runtime.includes("if(!userPositioned){dock.dataset.anchor='right';dock.dataset.orientation='vertical';}"),'Unmoved participant video must stay right and vertical.');
assert.ok(runtime.includes("dock.style.setProperty('right','14px','important')"),'Default dock must stay on the right.');
assert.ok(runtime.includes("body.style.setProperty('grid-template-columns','176px','important')"),'Default dock must remain a one-column 176px filmstrip.');
assert.ok(runtime.includes("body.style.setProperty('overflow-y',count>5?'auto':'hidden','important')"),'Default dock must scroll vertically only after five visible tiles.');
assert.ok(runtime.includes('const currentLeft=parseFloat(dock.style.left)')&&runtime.includes('const currentTop=parseFloat(dock.style.top)'),'User position must be read before resize clamping.');
assert.ok(runtime.includes('clamp(Number.isFinite(currentLeft)?currentLeft'),'Dragged dock must be clamped after resize.');
assert.ok(runtime.includes("window.addEventListener('resize',schedule,{passive:true})"),'Resize must remain event-driven.');
assert.ok(!runtime.includes('setInterval('),'Dock reflow must not add polling.');
assert.ok(runtime.includes('syncParticipantsSurface();layoutSideSurface();installVideoDockDrag();syncVideoDockGeometry();'),'Dock geometry must commit in the same final runtime pass.');
assert.ok(approved.includes('right:14px !important;'),'Approved reference must retain the wide right-filmstrip visual baseline.');
assert.ok(approved.includes('.local-video-dock-tile')&&approved.includes('order:-100 !important'),'Self view must remain first in the participant filmstrip regardless of host role.');
assert.ok(approved.includes('.remote-peer-tile:hover .participant-video-hover-actions')&&approved.includes('opacity:0 !important')&&approved.includes('pointer-events:none !important'),'Video-tile actions must stay visually quiet until pointer/focus interaction.');
assert.ok(parity.includes('participant-video-hover-actions')&&parity.includes("primary.textContent=micOn?'Mute':'Unmute'"),'Self tile must expose pointer-driven Mute/Unmute controls.');
assert.ok(parity.includes("else if(canManageView())")&&parity.includes("primary.textContent=micOn?'Mute':'Ask to Unmute'"),'Remote moderation control must only appear for host/co-host authority.');
assert.ok(parity.includes("selfRow=q('#participantRoster [data-participant-self=\"1\"]')")&&parity.includes("name.textContent=selfName"),'Self tile must use the signed-in participant meeting name instead of a host assumption.');
assert.ok(parity.includes('const should=Boolean(!hideSelf)')&&parity.includes("fallback.hidden=!should"),'Camera-off self view must remain represented by its fallback/profile surface rather than disappearing.');
assert.ok(participantControls.includes('sendParticipant:send')&&participantControls.includes('openParticipantMenu'),'Filmstrip moderation must reuse participant authority instead of duplicating host logic.');
assert.ok(webrtc.includes('tile.dataset.participantRole')&&webrtc.includes('tile.dataset.micOn'),'Remote video tiles must carry live role and microphone state for contextual actions.');
assert.ok(parity.includes('VIDEO_PANEL_MODE_KEY')&&parity.includes("['speaker','strip','gallery']")&&parity.includes('data-dock-panel-mode="hide"'),'Floating video panel must expose speaker, strip, gallery, and hide modes.');
assert.ok(parity.includes("index>0&&index%5===0")&&parity.includes("all.length>5"),'Gallery paging and scroll affordance must cap each visible participant group at five.');
assert.ok(approved.includes('max-height:527px !important')&&approved.includes('max-height:313px !important')&&approved.includes('scrollbar-width:none !important'),'Video panel must show no more than five equal tiles before internal scrolling, with no outside scrollbar.');
assert.ok(approved.includes('width:176px !important')&&approved.includes('height:99px !important')&&approved.includes('max-width:176px !important')&&approved.includes('max-height:99px !important'),'Floating participant tiles must use one stable 16:9 size.');
assert.ok(approved.includes('.participant-video-dock-modes')&&approved.includes('.participant-video-scroll-controls'),'The panel must keep compact native-looking layout controls and internal up/down scroll controls inside the floating surface.');
assert.ok(runtimeCss.includes('2.0.52 approved-baseline smart video-panel chrome'),'Final runtime CSS must own smart video-panel chrome.');
assert.ok(runtimeCss.includes('#meetingOverlay #participantVideoDock .participant-video-dock-head')&&runtimeCss.includes('opacity:0!important')&&runtimeCss.includes('visibility:hidden!important')&&runtimeCss.includes('pointer-events:none!important'),'Video-panel control bar must stay visually quiet by default.');
assert.ok(runtimeCss.includes('#meetingOverlay #participantVideoDock:hover .participant-video-dock-head')&&runtimeCss.includes('#meetingOverlay #participantVideoDock:focus-within .participant-video-dock-head'),'Video-panel control bar must reveal for pointer or keyboard intent.');
assert.ok(!runtime.includes('headerHeight=28'),'Hidden video-panel chrome must not reserve blank layout height.');


console.log('DOMINIONSTAR_ADAPTIVE_VIDEO_DOCK_2_0_32_OK default-right vertical-filmstrip five-visible user-clamp event-driven no-polling self-first smart-hover role-aware self-name camera-off-fallback equal-tiles five-visible internal-scroll speaker-strip-gallery-hide hover-overlay-no-layout-shift');
