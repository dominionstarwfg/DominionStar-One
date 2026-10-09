import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const app=read('ui/app.js');
const runtime=read('ui/runtime-stability.js');
const webrtc=read('ui/webrtc-controller.js');
const css=read('ui/zoom-production-polish.css');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=37))),'Active-speaker roster authority introduced in 2.0.37 must remain enforced for every later candidate.');

assert.ok(webrtc.includes("window.dispatchEvent(new CustomEvent('dominion:active-speakers'"),'Real WebRTC speaker meter must remain the speaker-order source.');
assert.ok(webrtc.includes("ranked.sort((a,b)=>b.level-a.level)"),'Speaker order must be based on measured audio energy.');
assert.ok(runtime.includes("window.addEventListener('dominion:active-speakers'")&&runtime.includes("activeSpeakerIds=Array.isArray(event.detail?.participantIds)"),'Canonical runtime must consume ordered active-speaker IDs.');
assert.ok(runtime.includes("if(role==='host')return 0;")&&runtime.includes("if(role==='cohost')return 100;"),'Host and co-host must remain pinned above ordinary participants.');
assert.ok(runtime.includes("if(speaking<999)return 200+speaking;"),'Ordinary speaking participants must sort by measured speaker rank.');
assert.ok(runtime.includes("const fragment=document.createDocumentFragment();for(const row of sorted)fragment.append(row);roster.append(fragment);"),'Speaker updates must reorder existing DOM rows instead of rebuilding the roster.');
assert.ok(runtime.includes("row.classList.toggle('participant-speaking',speaking)"),'Speaking rows must expose a stable visual state.');
assert.ok(runtime.includes("badge.textContent='Speaking'"),'Speaking state must be visible, not color-only.');
assert.ok(runtime.includes("activeSpeakerIds=[];"),'Speaker state must reset when the meeting ends.');

assert.ok(css.includes('.person-row.participant-speaking'),'Active speaker row treatment must exist.');
assert.ok(css.includes('.participant-speaking-badge'),'Speaking badge styling must exist.');

console.log('DOMINIONSTAR_ACTIVE_SPEAKER_ROSTER_2_0_37_OK host-pinned cohost-pinned real-audio-rank dom-reorder stable-actions speaking-badge');
