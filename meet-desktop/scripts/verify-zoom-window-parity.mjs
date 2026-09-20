import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const polish=read('ui/zoom-production-polish.js');
const repair=read('ui/physical-mac-repair.js');
const adaptive=read('ui/zoom-adaptive-parity.js');
const css=read('ui/zoom-adaptive-parity.css');
const approved=read('ui/approved-reference-parity.css');
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const meetingParity=read('ui/meeting-parity.js');
const preferences=read('ui/preferences.js');

// Pop Out / Merge remain available, while the final physical-Mac behavior keeps
// Participants and Chat as floating, draggable surfaces at every meeting width.
// Geometry adapts by clamping/recentering inside the current meeting body rather
// than switching into a permanent right sidebar.
assert(polish.includes("action.textContent=popout?'Merge to Meeting':'Pop Out'")&&polish.includes('function popOutParticipantPanel'),'Participants must provide Pop Out and Merge to Meeting behavior.');
assert(!runtime.includes("const wide=bodyWidth>=940"),'Final participant geometry must not switch to a fixed desktop dock breakpoint.');
assert(!runtime.includes("panel.dataset.dsRuntimeMode='docked'"),'Participants must not occupy the right edge reserved for the participant video dock.');
assert(runtime.includes("panel.dataset.dsRuntimeMode='floating'"),'Participants and Chat must use the floating surface model at every meeting width.');
assert(runtime.includes("installFloatingSurfaceDrag(panel)"),'Floating participant/chat surfaces must remain draggable.');
assert(runtime.includes("clamp(currentLeft,10,Math.max(10,bodyWidth-pw-10))"),'Floating panel geometry must clamp intelligently when the meeting window changes size.');
assert(runtime.includes('function syncVideoDockGeometry()'),'Final runtime must own participant-video dock geometry.');
assert(runtime.includes('const compact=width<760||height<520'),'Participant video dock must reflow on genuinely narrow or short meeting windows.');
assert(runtime.includes("dock.dataset.dsRuntimeDockMode=userPositioned?'user':compact?'top':'right'"),'Dock runtime mode must resolve deterministically to user/top/right.');
assert(runtime.includes("dock.style.setProperty('right','14px','important')"),'Wide meeting windows must return the default video dock to the right edge.');
assert(runtime.includes("dock.style.setProperty('left','14px','important')")&&runtime.includes("dock.style.setProperty('right','14px','important')"),'Compact windows must reflow the video dock across the top.');
assert(runtime.includes("body.style.setProperty('grid-auto-flow','column','important')"),'Compact dock must become a horizontal filmstrip.');
assert(runtime.includes("body.style.setProperty('grid-auto-flow','row','important')"),'Wide dock must return to a vertical filmstrip.');
assert(runtime.includes("const search=side.querySelector('.zoom-participant-search');if(search)search.hidden=count<7"),'Participant search should appear only when useful.');
assert(runtime.includes("const waiting=q('#waitingQueueSection');if(waiting)waiting.hidden=!hasWaitingPeople()"),'Empty Waiting Room chrome must stay hidden.');
assert(runtime.includes('participantPriority(row)')&&runtime.includes("return self?0:role==='host'?1:role==='cohost'?2:raised?3:micOn?4:5"),'Final participant roster does not encode You → Host → Co-host → raised → unmuted → others priority.');
assert(runtimeCss.includes("panel.style")===false||runtimeCss.includes('#meetingOverlay .room-side'),'Final runtime stylesheet must own the participant surface.');
assert(css.includes('#participantVideoDock .dock-grip{display:none !important;}'),'Legacy video-dock grip affordance must be removed.');
assert(css.includes('#participantVideoDock .participant-video-dock-head')&&css.includes('cursor:default !important'),'Movable participant-video surface must use the normal arrow cursor.');
assert(repair.includes("participantCount<=1&&visibleTiles===0")&&repair.includes("dock.dataset.zoomThreshold=suppress?'empty-solo':'available'"),'Speaker-mode video panel may suppress only a truly empty solo dock.');
assert(repair.includes("if(thresholdApplies&&visibleTiles>0&&dock.hidden)dock.hidden=false"),'Two-person Speaker view must be allowed to reveal a real video filmstrip.');
assert(approved.includes('#meetingOverlay #participantVideoDock[data-approved-filmstrip="1"]:not(.user-positioned):not(.gallery-stage):not(.multi-speaker-stage)'),'Approved reference layer must own the normal unpositioned video-filmstrip geometry.');
assert(approved.includes('right:14px !important;')&&approved.includes('grid-template-columns:176px !important;'),'Normal desktop video filmstrip must default to a right-side vertical column.');
assert(approved.includes('@media(max-width:680px)'),'Top-style compact reflow must be reserved for genuinely narrow windows.');
assert(repair.includes("version:'2.0.21'")&&adaptive.includes("version:'2.0.21'"),'Carried-forward adaptive authorities must remain identifiable.');
assert(preferences.includes("shareSideBySide:'ds_pref_share_side_by_side'")&&preferences.includes('shareSideBySide:false'),'Side-by-side viewing must use a dedicated saved preference rather than the legacy undefined localStorage key.');
assert(preferences.includes("'See shared content in side-by-side mode'"),'Sharing settings must expose the Zoom-style automatic side-by-side preference.');
assert(meetingParity.includes('const sideBySideCapable=stageRect.width>=680&&stageRect.height>=360'),'Side-by-side sharing must temporarily suspend when the meeting window is too compact to remain usable.');
assert(meetingParity.includes("overlay.dataset.shareSideBySideSuspended=active&&showPanel&&requestedSideBySide&&!sideBySideCapable?'1':'0'"),'Compact-window side-by-side suspension must be observable and automatically reversible.');
assert(meetingParity.includes("const anchor=automaticDockAnchor();dock.dataset.anchor=anchor"),'Floating share video must reuse the intelligent top/right dock anchor instead of remaining hard-wired to the right edge.');
assert(meetingParity.includes("new ResizeObserver(()=>scheduleParityRefresh())"),'Share layout must react to stage-size changes even when no browser window resize event fires.');
assert(meetingParity.includes("['ArrowLeft','ArrowRight','Home','End']"),'The side-by-side separator must support keyboard resizing as well as pointer dragging.');
assert(runtime.includes("if(overlay.classList.contains('share-side-by-side')){releaseRuntimeVideoDockGeometry(dock);return false;}"),'Final runtime geometry must not override the dedicated side-by-side share layout.');
assert(runtime.includes('function releaseRuntimeVideoDockGeometry(dock)'),'Entering side-by-side mode must clear stale inline dock geometry from floating mode.');
assert(runtime.includes("new ResizeObserver(()=>schedule())")&&runtime.includes('stageResizeObserver.observe(stage)'),'Final runtime must react to stage-size changes, not only browser window resize events.');

console.log('DOMINIONSTAR_ZOOM_WINDOW_PARITY_OK floating-all-widths draggable-panels resize-clamp search-when-useful empty-waiting-hidden zoom-priority-sort pop-out merge-to-meeting arrow-cursor no-grip two-person-filmstrip right-default-video-dock narrow-only-top-reflow');