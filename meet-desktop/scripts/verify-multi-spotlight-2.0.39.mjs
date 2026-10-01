import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const controls=read('ui/participant-controls.js');
const parity=read('ui/meeting-parity.js');
const css=read('ui/meeting-parity.css');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=39))),'Multi-spotlight authority introduced in 2.0.39 must remain enforced for every later candidate.');

assert.ok(controls.includes('spotlightParticipantIds=[]'),'Participant controls must hold an ordered spotlight set.');
assert.ok(controls.includes("slice(0,4)"),'Spotlight set must be bounded to four promoted participants.');
assert.ok(controls.includes("spotlightParticipantIds.includes(id)"),'Per-participant menu must toggle membership in the spotlight set.');
assert.ok(controls.includes("spotlightParticipantIds.length?'Add Spotlight':'Spotlight for Everyone'"),'Menu must distinguish first spotlight from Add Spotlight.');
assert.ok(controls.includes("participantIds:[...next],participantId:next[0]||''"),'Spotlight signal must carry the ordered set plus backward-compatible primary ID.');
assert.ok(controls.includes("Array.isArray(detail.payload?.participantIds)"),'Receivers must consume multi-spotlight payloads.');
assert.ok(controls.includes("new CustomEvent('dominion:spotlight-change'"),'Spotlight changes must still flow through the shared meeting-layout event.');

assert.ok(parity.includes('spotlightParticipantIds=[]'),'Meeting parity must own an ordered spotlight set.');
assert.ok(parity.includes("multiSpotlight=spotlightParticipantIds.length>1&&!share"),'Two or more spotlights must activate promoted multi layout.');
assert.ok(parity.includes("dock.classList.toggle('multi-speaker-stage',(mode==='multi'||multiSpotlight)&&!share)"),'Multi-spotlight must reuse the certified multi-speaker grid.');
assert.ok(parity.includes("spotlight-rank-1")&&parity.includes("spotlight-rank-4"),'Layout must assign stable spotlight ranks.');
assert.ok(parity.includes("if(sharing()||spotlightParticipantIds.length>1)"),'Single-speaker stage must yield when multiple spotlights are active.');
assert.ok(parity.includes("Array.isArray(event.detail?.participantIds)?event.detail.participantIds"),'Meeting layout must consume the ordered spotlight set.');
assert.ok(parity.includes("spotlightParticipantIds=[];closeMenus()"),'Spotlight state must clear when the meeting ends.');

assert.ok(css.includes('.remote-peer-tile.spotlighted'),'Spotlighted tiles must have a visible promoted state.');
assert.ok(css.includes('.remote-peer-tile.spotlight-rank-1{order:-40}'),'First spotlight must lead the promoted grid.');
assert.ok(css.includes('.remote-peer-tile.spotlight-rank-4{order:-37}'),'Fourth spotlight ordering must remain deterministic.');

console.log('DOMINIONSTAR_MULTI_SPOTLIGHT_2_0_39_OK single spotlight add remove ordered-four broadcast promoted-grid meeting-end-reset');
