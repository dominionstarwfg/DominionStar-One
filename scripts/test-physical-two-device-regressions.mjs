import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const engine = read('assets/js/meeting-engine.js');
const app = read('meet-desktop/ui/app.js');
const physical = read('meet-desktop/ui/zoom-physical-acceptance.js');
const participantControls = read('meet-desktop/ui/participant-controls.js');
const desktopWebrtc = read('meet-desktop/ui/webrtc-controller.js');
const parity = read('meet-desktop/ui/meeting-parity.js');
const behavior = read('meet-desktop/ui/zoom-behavior.js');
const reference = read('meet-desktop/ui/zoom-screenshot-reference-2.0.41.js');
const css = read('meet-desktop/ui/zoom-screenshot-reference-2.0.41.css');
const index = read('meet-desktop/ui/index.html');
const lifecycle = read('meet-desktop/ui/meeting-lifecycle-authority.js');

assert(engine.includes('serializeIceCandidate'), 'Browser meeting engine does not serialize ICE candidates for V2 RPC.');
assert(engine.includes('candidate:serializeIceCandidate(candidate)'), 'Browser ICE candidate still crosses RPC as a raw RTCIceCandidate.');
assert(engine.includes('serializeSessionDescription(peer.localDescription)'), 'Browser SDP still crosses RPC as a raw RTCSessionDescription.');
assert(engine.includes("if(type==='chat')return ['meet-chat',base]"), 'Desktop-to-browser V2 chat is not translated into the browser meeting engine.');
assert(engine.includes("'host:mute':'mute'"), 'Desktop host mute control is not translated into browser moderation.');
assert(engine.includes("event==='meet-chat'||event==='meet-reaction'"), 'Browser-to-desktop chat/reaction does not fan out through V2.');
assert(engine.includes("if(type==='screen-state')return ['meet-screen-state'"), 'Desktop screen-share state is not translated into browser presentation state.');
assert(desktopWebrtc.includes("meeting.sendSignal(remoteId,'screen-state'"), 'Desktop WebRTC does not publish screen-share state to browser participants.');
assert(desktopWebrtc.includes('broadcastShareState(snapshot)'), 'Desktop share changes do not fan out presentation state to connected peers.');

assert(!physical.includes("wrap.className='ds-participant-media'"), 'Physical participant renderer recreates the rejected duplicate media strip.');
assert(physical.includes("row.querySelector('.participant-media-state')"), 'Physical participant renderer is not reusing the canonical media strip.');

assert(app.includes("const activePeople=people.filter(p=>['admitted','joined'].includes"), 'Participant presence still counts waiting-room records as joined participants.');
assert(app.includes('DominionMeetingLifecycleAuthority?.openExit?.()'), 'Primary End/Leave button can bypass the canonical confirmation authority.');

const lifecycleIndex=index.indexOf('./meeting-lifecycle-authority.js');
const behaviorIndex=index.indexOf('./zoom-behavior.js');
assert(lifecycleIndex>=0 && behaviorIndex>=0 && lifecycleIndex<behaviorIndex, 'Lifecycle authority must load before legacy meeting behavior.');
assert(behavior.includes('if(window.DominionMeetingLifecycleAuthority)return;'), 'Legacy host exit interception can still compete with canonical lifecycle authority.');

assert(lifecycle.includes("End Meeting for All"), 'Canonical exit dialog lost End Meeting for All.');
assert(lifecycle.includes("Leave Meeting"), 'Canonical exit dialog lost Leave Meeting.');
assert(lifecycle.includes("openInvite"), 'Canonical lifecycle authority lost persistent Invite.');
assert(lifecycle.includes("Copy Invitation"), 'Invite dialog does not expose invitation copy.');
assert(reference.includes('DominionMeetingLifecycleAuthority') && reference.includes('openInvite'), 'Reference participant footer Invite does not route to persistent lifecycle authority.');
assert(participantControls.includes("data-ds-canonical-participant-footer"), 'Loaded participant controls do not own a stable canonical footer.');
assert(participantControls.includes("DominionMeetingLifecycleAuthority?.openInvite?.()"), 'Loaded participant footer Invite does not route to persistent lifecycle authority.');

assert(parity.includes('function dedupeVideoDockTiles()'), 'Participant video dock has no duplicate-participant guard.');
assert(parity.includes('dedupeVideoDockTiles();const mode=readView()'), 'Participant video dock does not dedupe before layout.');

assert(css.includes('width:392px!important'), 'Physical participant panel regressed to the squeezed width.');
assert(css.includes('.participant-media-icon:not(.off)::after'), 'Participant media icon has no explicit live-state slash suppression.');
assert(css.includes('.participant-media-icon.off::after'), 'Participant media icon lost the single muted slash authority.');

console.log('PASS physical two-device regressions: serialized WebRTC, one media strip, guarded exit, persistent invite, readable roster, and deduplicated video dock.');
