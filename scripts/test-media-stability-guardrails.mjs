import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const guardian=fs.readFileSync(new URL('../assets/js/runtime/guardian-recovery.js',import.meta.url),'utf8');
const dock=fs.readFileSync(new URL('../assets/js/meet/dock-layout-v2.js',import.meta.url),'utf8');
const dockCss=fs.readFileSync(new URL('../assets/css/meet/dock-layout-v2.css',import.meta.url),'utf8');

assert(!ui.includes("recoverPeer?.(participantId,{reason:'guardian-remote-video-missing'})"),
  'The view reconciler must never rebuild a connected peer because a frame is temporarily missing.');
const reconciler=ui.slice(ui.indexOf('function reconcileMeetingView()'),ui.indexOf('function startViewReconciler()'));
assert(!reconciler.includes('requestMediaResync'),
  'The view reconciler must never renegotiate transport from rendering state.');
assert(ui.includes('setTimeout(()=>engine.requestMediaResync?.(payload.participantId).catch(()=>{}),4000)'),
  'A presentation track receives time to negotiate before requesting one targeted resync.');
assert(engine.includes('remoteTrackStreamIds'),
  'The engine must retain incoming track-to-stream identity for late screen metadata.');
assert(engine.includes('payload.screenStreamId && state.remoteTrackStreamIds.get'),
  'Late screen metadata must reclassify presentation tracks by stream identity.');
assert(engine.includes('const preservedScreen=state.remoteScreenStreams.get(payload.from)'),
  'Repeated screen sharing must reuse the existing WebRTC receiver.');
const screenStopBranch=engine.slice(engine.indexOf("} else {\n        state.remoteScreenTrackIds.delete(payload.from)"),engine.indexOf("emit('screen-state'"));
assert(!screenStopBranch.includes('remoteScreenStreams.delete')&&!screenStopBranch.includes('removeTrack'),
  'Stopping a share must not destroy the reusable remote screen receiver.');
assert(guardian.includes("if(type==='meet.peer.state')return"),
  'Guardian must not compete with meeting-engine peer recovery.');
assert(!guardian.includes("recoverDegradedPeers('health-check')"),
  'Guardian health polling must be observational, not destructive.');
assert(engine.includes("const primary=state.participantId.localeCompare(remoteId)<0"),
  'Only one deterministic peer may receive the first ICE-recovery turn.');
assert(engine.includes("(primary?5000:12000)"),
  'Transient disconnects must receive a recovery grace period.');
const peerRecovery=engine.slice(engine.indexOf('const recoverPeer = async'),engine.indexOf('const recoverPeers = async'));
assert(!peerRecovery.includes('remote-video-missing')&&!peerRecovery.includes('forceRebuild'),
  'Rendering symptoms must never destroy a live peer transport.');
assert(dock.includes("dock.addEventListener('pointerdown'")&&dock.includes('Math.hypot(dx,dy)<4'),
  'The complete participant dock must provide intentional drag activation.');
assert(dock.includes("event.target.closest(interactive)"),
  'Dock buttons and interactive controls must remain clickable.');
assert(dockCss.includes('cursor: grab !important'),
  'The movable dock must visibly communicate its drag surface.');
assert(engine.includes('const requestedRole=payload.targetRole||payload.role')&&engine.includes('targetRole:nextRole'),
  'A sender role must never overwrite the requested participant role.');

console.log('Media stability guardrails passed.');
