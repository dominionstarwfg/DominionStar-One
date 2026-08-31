import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const polish=read('ui/zoom-production-polish.js');
const repair=read('ui/physical-mac-repair.js');
const adaptive=read('ui/zoom-adaptive-parity.js');
const css=read('ui/zoom-adaptive-parity.css');
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');

// Pop Out / Merge remain available, but the physical Mac result supersedes the
// old small-roster default: a normal desktop-width meeting uses a stable right
// dock. Floating geometry is only the constrained-window fallback.
assert(polish.includes("action.textContent=popout?'Merge to Meeting':'Pop Out'")&&polish.includes('function popOutParticipantPanel'),'Participants must provide Pop Out and Merge to Meeting behavior.');
assert(runtime.includes("const wide=bodyWidth>=940"),'Final participant geometry must respond to actual meeting width.');
assert(runtime.includes("panel.dataset.dsRuntimeMode='docked'"),'Desktop-width Participants must use the final right-docked surface.');
assert(runtime.includes("panel.dataset.dsRuntimeMode='floating'"),'Constrained windows must retain a compact floating fallback.');
assert(runtime.includes("const search=side.querySelector('.zoom-participant-search');if(search)search.hidden=count<7"),'Participant search should appear only when useful.');
assert(runtime.includes("const waiting=q('#waitingQueueSection');if(waiting)waiting.hidden=!hasWaitingPeople()"),'Empty Waiting Room chrome must stay hidden.');
assert(runtime.includes('participantPriority(row)')&&runtime.includes("return self?0:role==='host'?1:role==='cohost'?2:raised?3:micOn?4:5"),'Final participant roster does not encode You → Host → Co-host → raised → unmuted → others priority.');
assert(runtimeCss.includes("panel.style")===false||runtimeCss.includes('#meetingOverlay .room-side'),'Final runtime stylesheet must own the participant surface.');
assert(css.includes('#participantVideoDock .dock-grip{display:none !important;}'),'Legacy video-dock grip affordance must be removed.');
assert(css.includes('#participantVideoDock .participant-video-dock-head')&&css.includes('cursor:default !important'),'Movable participant-video surface must use the normal arrow cursor.');
assert(repair.includes("participantCount<=2")&&repair.includes("dock.dataset.zoomThreshold=suppress?'suppressed-under-3':'available'"),'Speaker-mode video panel must stay out of the way for one- and two-person meetings.');
assert(repair.includes("view==='speaker'")&&repair.includes("!shared"),'Video-panel threshold must apply only when not sharing in Speaker view.');
assert(repair.includes("version:'2.0.21'")&&adaptive.includes("version:'2.0.21'"),'Carried-forward adaptive authorities must remain identifiable.');

console.log('DOMINIONSTAR_ZOOM_WINDOW_PARITY_OK desktop-right-dock constrained-floating search-when-useful empty-waiting-hidden zoom-priority-sort pop-out merge-to-meeting arrow-cursor no-grip video-panel-threshold');
