import assert from 'node:assert/strict';
import fs from 'node:fs';

const desktopService = fs.readFileSync(new URL('../meet-desktop/src/meeting-service.mjs', import.meta.url), 'utf8');
const desktopRtc = fs.readFileSync(new URL('../meet-desktop/ui/webrtc-controller.js', import.meta.url), 'utf8');
const browserTransport = fs.readFileSync(new URL('../assets/js/meet/v2-desktop-interop.js', import.meta.url), 'utf8');
const browserEngine = fs.readFileSync(new URL('../assets/js/meeting-engine.js', import.meta.url), 'utf8');
const meetHtml = fs.readFileSync(new URL('../meet/index.html', import.meta.url), 'utf8');

const sharedRpcContracts = [
  ['meet_v2_request_join', ['p_room_code','p_passcode','p_display_name']],
  ['meet_v2_join_status', ['p_participant_id','p_join_token']],
  ['meet_v2_mark_joined', ['p_participant_id','p_join_token']],
  ['meet_v2_touch_presence', ['p_participant_id','p_join_token']],
  ['meet_v2_room_snapshot', ['p_room_id']],
  ['meet_v2_send_signal', ['p_from_participant_id','p_to_participant_id','p_signal_type','p_payload']],
  ['meet_v2_pull_signals', ['p_participant_id','p_after_id','p_limit']],
  ['meet_v2_leave_room', ['p_participant_id','p_join_token']]
];

for (const [rpc, fields] of sharedRpcContracts) {
  assert(desktopService.includes(`'${rpc}'`), `Desktop meeting service no longer uses ${rpc}.`);
  assert(browserTransport.includes(`'${rpc}'`), `Browser V2 transport no longer uses ${rpc}.`);
  for (const field of fields) {
    assert(desktopService.includes(field), `Desktop ${rpc} contract lost ${field}.`);
    assert(browserTransport.includes(field), `Browser ${rpc} contract lost ${field}.`);
  }
}

assert(
  desktopService.includes("auth.invokeServerFunction('meet-v2-turn-credentials'"),
  'Desktop no longer uses the V2 TURN credential broker.'
);
assert(
  browserTransport.includes("invokeFunction('meet-v2-turn-credentials'"),
  'Browser no longer uses the V2 TURN credential broker.'
);

for (const type of ['offer','answer','ice','bye']) {
  assert(
    desktopRtc.includes(`meeting.sendSignal(`) && desktopRtc.includes(`'${type}'`),
    `Desktop WebRTC controller lost ${type} V2 signaling.`
  );
}
assert(browserEngine.includes("v2Type=event==='meet-offer'?'offer'"), 'Browser offer mapping no longer targets V2 signaling.');
assert(browserEngine.includes("event==='meet-answer'?'answer'"), 'Browser answer mapping no longer targets V2 signaling.');
assert(browserEngine.includes("event==='meet-ice'?'ice'"), 'Browser ICE mapping no longer targets V2 signaling.');
assert(browserEngine.includes("event==='meet-left'?'bye'"), 'Browser leave mapping no longer targets V2 signaling.');
assert(browserEngine.includes('roomId:state.roomId,from,to:state.participantId'), 'Browser inbound V2 signals lost room identity.');
assert(browserEngine.includes("if (!payload || payload.roomId !== state.roomId"), 'Browser no longer rejects cross-room signaling.');

const bridgeIndex = meetHtml.indexOf('/assets/js/meet/v2-desktop-interop.js');
const engineIndex = meetHtml.indexOf('/assets/js/meeting-engine.js');
assert(bridgeIndex >= 0, 'Browser Meet does not load the desktop-interoperability bridge.');
assert(engineIndex >= 0, 'Browser Meet does not load the meeting engine.');
assert(bridgeIndex < engineIndex, 'Browser V2 interoperability bridge must load before the meeting engine.');

assert(
  desktopRtc.includes('meeting?.sendSignal') &&
  desktopRtc.includes('meeting?.pullSignals') &&
  desktopRtc.includes('meeting?.iceConfig'),
  'Desktop WebRTC controller is no longer bound to the V2 meeting transport surface.'
);
assert(
  browserEngine.includes('const v2Transport=()=>window.DominionBrowserV2Transport||null;'),
  'Browser meeting engine is no longer bound to the V2 desktop interoperability transport.'
);

console.log('PASS desktop-browser V2 interoperability contract: shared room lifecycle, signaling, TURN, and load-order contracts are aligned.');
