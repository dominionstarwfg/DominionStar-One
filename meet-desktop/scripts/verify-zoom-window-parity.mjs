import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const polish=read('ui/zoom-production-polish.js');
const repair=read('ui/physical-mac-repair.js');
const adaptive=read('ui/zoom-adaptive-parity.js');
const css=read('ui/zoom-adaptive-parity.css');

// Keep explicit Pop Out / Merge controls, but do not hard-code one geometry for
// every roster size. The physical Zoom reference supplied for a one-person
// meeting is compact and floating; larger workspaces retain dock/merge options.
assert(polish.includes("action.textContent=popout?'Merge to Meeting':'Pop Out'")&&polish.includes('function popOutParticipantPanel'),'Participants must provide Pop Out and Merge to Meeting behavior.');
assert(adaptive.includes("if(count<=6)centerParticipantPanel(side,count)"),'Small participant rosters must start in compact floating mode.');
assert(adaptive.includes("search.hidden=count<=1"),'One-person participant panels must not waste space on search.');
assert(adaptive.includes("waiting.hidden=!hasWaitingPeople()"),'Empty Waiting Room chrome must be hidden.');
assert(adaptive.includes("if(self)bucket=0")&&adaptive.includes("else if(role==='host')bucket=1")&&adaptive.includes("else if(role==='cohost')bucket=2")&&adaptive.includes("else if(raised)bucket=3")&&adaptive.includes("else if(micOn)bucket=4"),'Participant roster does not implement Zoom-style priority ordering.');
assert(css.includes('#participantVideoDock .dock-grip{display:none !important;}'),'Legacy video-dock grip affordance must be removed.');
assert(css.includes('#participantVideoDock .participant-video-dock-head')&&css.includes('cursor:default !important'),'Movable participant-video surface must use the normal arrow cursor.');
assert(repair.includes("participantCount<=2")&&repair.includes("dock.dataset.zoomThreshold=suppress?'suppressed-under-3':'available'"),'Speaker-mode video panel must stay out of the way for one- and two-person meetings.');
assert(repair.includes("view==='speaker'")&&repair.includes("!shared"),'Video-panel threshold must apply only when not sharing in Speaker view.');
assert(repair.includes("version:'2.0.21'")&&adaptive.includes("version:'2.0.21'"),'Adaptive window authorities must expose candidate version 2.0.21.');

console.log('DOMINIONSTAR_ZOOM_WINDOW_PARITY_OK adaptive-small-roster search-when-useful empty-waiting-hidden zoom-priority-sort pop-out merge-to-meeting arrow-cursor no-grip video-panel-threshold');
