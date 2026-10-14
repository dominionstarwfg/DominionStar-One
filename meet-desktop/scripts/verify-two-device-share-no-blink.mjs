import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const webrtc=read('ui/webrtc-controller.js');
const reference=read('ui/zoom-screenshot-reference-2.0.41.js');
const styles=read('ui/zoom-screenshot-reference-2.0.41.css');
const participants=read('ui/zoom-participants-reference-2.0.41.js');
const parity=read('ui/meeting-parity.css');

// Structural contract only. The actual two-device Mac acceptance gate must
// still exercise host/guest screen-share delivery and filmstrip stability.
for(const [needle,message] of [
  ['record.senderSync.catch(()=>{}).then(async()=>{','per-peer media sender updates must be serialized'],
  ['lane.sender.track!==track','unchanged sender tracks must not be replaced'],
  ['if(video.srcObject!==stream)video.srcObject=stream','remote video streams must not rebind on every state tick'],
  ['clearTimeout(record.cameraMuteTimer)','remote camera mute must be debounced and cancellable'],
  ['clearTimeout(record.shareMuteTimer)','remote share mute must be debounced and cancellable'],
  ['hideRemoteShare(record.id,false)','transient share mute must retain its stream'],
  ['state.lastSpeakerSignature','speaker roster notifications must be change-driven'],
  ['speakerSignature!==state.lastSpeakerSignature','audio sampling must not rebuild the filmstrip every 350ms'],
  ["setTransportStatus('Network connected','ready')",'successful ICE connection must clear stale retry warnings'],
  ["if(Object.keys(patch).every(field=>current[field]===next[field]))return;",'identical participant media events must not rebuild controls'],
  ["if(index===2&&event.track.kind==='video')",'second video transceiver must attach remote shared content'],
])assert.ok(webrtc.includes(needle),message);

assert.ok(reference.includes("participantsButton.setAttribute('aria-label',`Participants (${count})`)"),'toolbar needs accessible live count');
assert.ok(reference.includes('icon.dataset.participantCount=String(count)'), 'toolbar icon count must use the canonical roster');
assert.ok(styles.includes('.ds-control-icon[data-participant-count]::after'),'numeric count must be visible beside the Participants icon');
assert.ok(styles.includes('#meetingOverlay #roomParticipants{padding-left:1px!important;padding-right:1px!important}')&&styles.includes('font-size:11px!important;letter-spacing:-.24px'),'Participants caption must preserve approved typography while fitting the control');
assert.ok(participants.includes('width:318px!important')&&participants.includes('height:390px!important'),'approved participant window remains 318x390');
assert.ok(participants.includes('height:42px!important'),'participant rows remain 42px');
assert.ok(parity.includes('width:176px!important')&&parity.includes('height:99px!important'),'approved video tiles remain 176x99');
console.log('PASS two-device remote share no-blink structural contract (physical acceptance still required)');
