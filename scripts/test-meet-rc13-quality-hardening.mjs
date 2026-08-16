import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../assets/js/meet/dock-layout-v2.js',import.meta.url),'utf8');
const meet=fs.readFileSync(new URL('../meet/index.html',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');

for(const marker of [
  "__dsQualityHardening",
  "rc13-media-room-parity",
  "url.searchParams.get('meeting')",
  "url.searchParams.set('room',legacy)",
  "retryableCameraError",
  "NotReadableError",
  "cameraQueue",
  "releaseAge<700",
  "const retryDelays=[0,320,760,1350]",
  "const videoWasOn=Boolean(engine.snapshot?.()?.mediaState?.video)",
  "displayTrack.readyState!=='live'",
  "wrapParticipantAction('admit')",
  "wrapParticipantAction('deny')",
  "engine.resyncPresence",
  "engine.recoverPeers",
  "while(toastLayer.children.length>3)",
  "canonicalInviteLink"
]) assert.ok(source.includes(marker),`RC13 hardening marker missing: ${marker}`);

assert.match(meet,/assets\/js\/meeting-engine\.js/,'Meeting engine must load in Meet');
assert.match(meet,/assets\/js\/meet\/dock-layout-v2\.js/,'RC13 hardening carrier must load in Meet');
assert.ok(meet.indexOf('meeting-engine.js')<meet.indexOf('dock-layout-v2.js'),'Hardening must load after the meeting engine');
assert.match(engine,/const toggleVideo = enabled =>/,'Camera lifecycle contract must remain present');
assert.match(engine,/const shareScreen = async \(\) =>/,'Screen-share lifecycle contract must remain present');
assert.match(engine,/const admit = async participantId =>/,'Waiting-room admit contract must remain present');
assert.match(engine,/const deny = async participantId =>/,'Waiting-room deny contract must remain present');

// Security boundary: quality recovery must never manufacture admission/role state.
for(const forbidden of [
  "state.admitted=true",
  "state.role='host'",
  "state.role='cohost'",
  "waitingRoomEnabled=false"
]) assert.ok(!source.includes(forbidden),`Hardening must not bypass authority: ${forbidden}`);

console.log('DominionStar Meet RC13 quality hardening contract passed.');
