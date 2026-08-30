import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const polish=read('ui/zoom-production-polish.js');
const repair=read('ui/physical-mac-repair.js');
const css=read('ui/physical-mac-repair.css');

assert(polish.includes("side.dataset.zoomPanelMode='docked'")&&polish.includes("right','10px','important'"),'Participants must default to Zoom current right-side docked mode.');
assert(polish.includes("action.textContent=popout?'Merge to Meeting':'Pop Out'")&&polish.includes('function popOutParticipantPanel'),'Participants must provide Zoom Pop Out and Merge to Meeting behavior.');
assert(polish.includes("participantPanelMode(side)==='docked'")&&polish.includes('event.stopImmediatePropagation()'),'Docked Participants must not accidentally enter drag mode.');
assert(css.includes('.meeting-overlay .room-side.dragging')&&css.includes('.meeting-overlay .participant-video-dock.dragging')&&css.includes('cursor:default!important'),'Movable participant surfaces must use the normal arrow cursor, never grab/grabbing hands.');
assert(css.includes('.meeting-overlay .dock-grip{display:none!important}'),'Legacy video-dock grip affordance must be removed.');
assert(repair.includes("participantCount<=2")&&repair.includes("dock.dataset.zoomThreshold=suppress?'suppressed-under-3':'available'"),'Speaker-mode video panel must stay out of the way for one- and two-person meetings.');
assert(repair.includes("view==='speaker'")&&repair.includes("!shared"),'Video-panel threshold must apply only when not sharing in Speaker view.');
assert(polish.includes("version:'1.5.0'")&&repair.includes("version:'2.0.20'"),'Zoom window authorities must expose the expected candidate versions.');

console.log('DOMINIONSTAR_ZOOM_WINDOW_PARITY_OK participants-right-default pop-out merge-to-meeting draggable-arrow-cursor no-grip video-panel-threshold');
