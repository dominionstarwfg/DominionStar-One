import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const participants=read('ui/zoom-participants-reference-2.0.41.js');
const macOverlay=read('src/mac-share-presenter-overlay.mjs');
const bootstrap=read('ui/runtime-bootstrap.js');

// Participants and Chat stay floating/draggable at every desktop width.
assert(!runtime.includes("const wide=bodyWidth>=940"),'Final panel geometry must not switch to a fixed desktop dock breakpoint.');
assert(!runtime.includes("panel.dataset.dsRuntimeMode='docked'"),'Participants/Chat must not occupy the video-filmstrip right edge.');
assert(runtime.includes("panel.dataset.dsRuntimeMode='floating'"),'Participants and Chat must use the floating surface model.');
assert(runtime.includes("installFloatingSurfaceDrag(panel)"),'Floating participant/chat surfaces must remain draggable.');
assert(runtime.includes("clamp(currentLeft,10,Math.max(10,bodyWidth-pw-10))"),'Floating geometry must clamp intelligently on window resize.');

// Participant-video dock has one deterministic owner and one compact threshold.
assert(runtime.includes('function syncVideoDockGeometry()'),'Canonical runtime must own participant-video dock geometry.');
assert(runtime.includes('const compact=width<760'),'Participant video dock must have one explicit compact reflow threshold.');
assert(runtime.includes("dock.dataset.dsRuntimeDockMode=userPositioned?'user':compact?'top':'right'"),'Dock mode must resolve deterministically to user/top/right.');
assert(runtime.includes("dock.style.setProperty('right','14px','important')"),'Wide meeting windows must return the video dock to the right edge.');
assert(runtime.includes("body.style.setProperty('grid-auto-flow','column','important')"),'Compact dock must become a horizontal filmstrip.');
assert(runtime.includes("body.style.setProperty('grid-auto-flow','row','important')"),'Wide dock must return to a vertical filmstrip.');

// Search and roster ordering have one authority.
assert(!runtime.includes("search.className='zoom-participant-search';")&&!runtime.includes("search.hidden=count<7"),'Runtime must never recreate or count-hide participant search.');
assert(runtime.includes('Participants search has one owner: DominionZoomParticipantsReference2041.'),'Runtime must explicitly defer search ownership.');
assert(participants.includes("version:'2.0.53-canonical-manual-desktop'"),'Canonical participant reference authority is missing.');
assert(runtime.includes("const waiting=q('#waitingQueueSection'),waitingHidden=!hasWaitingPeople();"),'Empty Waiting Room chrome must remain hidden.');
assert(runtime.includes('participantPriority(row)')&&runtime.includes("return self?0:role==='host'?1:role==='cohost'?2:raised?3:micOn?4:5"),'Roster priority must remain You → Host → Co-host → raised → unmuted → others.');

// Native share filmstrip starts at two participants; one participant has no side tile.
assert(macOverlay.includes("function shouldShowVideoWindow(){return videoLayout!=='hide'&&presenterParticipantCount()>=2;}"),'Native share filmstrip must start at two participants.');
assert(runtimeCss.includes('right:14px!important;'),'Canonical runtime must preserve the right-side filmstrip default.');

// Retired adaptive/physical repair authorities may not return to startup.
for(const retired of ['zoom-adaptive-parity.js','zoom-adaptive-parity.css','physical-mac-repair.js','physical-mac-repair.css','active-share-home-parity-2.0.41.js']){
  assert(!bootstrap.includes(retired),`Retired window authority must remain unloaded: ${retired}`);
}
assert(runtimeCss.includes('#meetingOverlay .room-side'),'Canonical runtime stylesheet must own the participant surface.');

console.log('DOMINIONSTAR_ZOOM_WINDOW_PARITY_2_0_54_OK floating-all-widths draggable-panels resize-clamp single-search-authority empty-waiting-hidden priority-sort two-person-native-filmstrip right-default-video-dock narrow-only-top-reflow no-retired-window-authority');
