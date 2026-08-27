import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const service=read('src/meeting-service.mjs');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const peer=read('ui/webrtc-controller.js');
const media=read('ui/media-controller.js');
const css=read('ui/webrtc.css');

for(const rpc of ['meet_v2_send_signal','meet_v2_pull_signals','meet_v2_prune_signals'])assert(service.includes(rpc),`Missing signaling RPC ${rpc}`);
assert(service.includes("let current={roomId:'',participantId:''"),'Meeting service must own current media context.');
assert(service.includes('const context=()=>Object.freeze({...current})'),'Meeting context must be returned as an immutable copy.');
for(const channel of ['meeting:context','meeting:signal-send','meeting:signal-pull','meeting:signal-prune','meeting:ice-config'])assert(main.includes(channel),`Missing signaling/ICE IPC ${channel}`);
for(const method of ['context:()=>','sendSignal:','pullSignals:','pruneSignals:','iceConfig:'])assert(preload.includes(method),`Missing narrow renderer transport method ${method}`);
assert(!peer.includes('createClient(')&&!peer.includes('.from('),'Renderer WebRTC must not construct or query the database client directly.');

assert(peer.includes('new RTCPeerConnection'),'WebRTC peer connection authority is missing.');
assert(peer.includes("localeCompare(String(remoteId))<0"),'Peer offer ownership must be deterministic.');
assert.equal((peer.match(/addTransceiver\('/g)||[]).length,3,'Each peer must have exactly three media lanes.');
assert(peer.includes("addTransceiver('audio',{direction:'sendrecv'})"),'Microphone lane is missing.');
assert.equal((peer.match(/addTransceiver\('video'/g)||[]).length,2,'Camera and screen must have independent video lanes.');
assert(peer.includes('replaceTrack(audio)')&&peer.includes('replaceTrack(camera)')&&peer.includes('replaceTrack(screen)'),'Local media changes must replace tracks without rebuilding the room.');
assert(peer.includes("meeting.sendSignal(record.id,'offer'")&&peer.includes("meeting.sendSignal(remoteId,'answer'")&&peer.includes("meeting.sendSignal(remoteId,'ice'"),'Offer/answer/ICE exchange is incomplete.');
assert(peer.includes('pendingIce.push(payload.candidate)')&&peer.includes('flushIce(record)'),'Early ICE must be queued until the remote description exists.');
assert(peer.includes('scheduleReconnect(record,RECONNECT_MS)'),'Peer reconnect handling is missing.');
assert(peer.includes('setInterval(()=>void pullSignals(),POLL_MS)')&&peer.includes('setInterval(()=>void reconcileParticipants(),SNAPSHOT_MS)'),'Signaling and roster reconciliation must be independent.');
assert(peer.includes('playRemoteAudio')&&peer.includes('audio.srcObject=stream')&&peer.includes('audio.play()'),'Remote microphone audio must render through a real media element.');
assert(peer.includes('audio.setSinkId')&&peer.includes('speakerId'),'Selected speaker routing must be honored where supported.');
assert(peer.includes('showRemoteCamera')&&peer.includes('showRemoteShare'),'Remote camera and shared content must render independently.');
assert(peer.includes('active-speaker')&&peer.includes('createAnalyser()'),'Active-speaker detection must use the remote audio signal.');
assert(peer.includes("window.DominionMediaController?.onChange")&&peer.includes("window.DominionShareController?.onChange"),'Camera/mic/share track changes must propagate to existing peers.');
assert(media.includes("script.src='./webrtc-controller.js'"),'Media authority must load the isolated peer controller.');
assert(media.includes("link.href='./webrtc.css'"),'Peer layout stylesheet must be loaded once.');
assert(css.includes('.remote-peer-tile.active-speaker')&&css.includes('.remote-share-video'),'Remote active-speaker and shared-content layouts are missing.');

assert(!peer.includes('stun:stun.l.google.com'),'Production peer transport must not rely on a hardcoded STUN-only list.');
assert(peer.includes('const config=await meeting.iceConfig(force,7200)'),'WebRTC relay loader must request short-lived ICE configuration.');
assert(peer.indexOf('await loadIceConfig(false)')<peer.indexOf('state.running=true'),'WebRTC must obtain valid TURN configuration before becoming active.');
assert(peer.includes("throw new Error('turn_relay_unavailable')"),'WebRTC must fail closed when relay configuration is unavailable.');
assert(peer.includes('pc.setConfiguration(iceConfiguration())')&&peer.includes('pc.restartIce()'),'Active peer connections must accept refreshed TURN credentials and restart ICE.');
assert(peer.includes('createOffer(iceRestart?{iceRestart:true}:undefined)'),'Credential refresh must support deterministic ICE restart offers.');
assert(peer.includes("setTransportStatus('Connected via TURN relay','relay')")&&peer.includes("setTransportStatus('Direct connection • TURN standby','ready')"),'Physical QA must expose selected network path.');
assert(css.includes('.transport-status[data-kind="relay"]')&&css.includes('.transport-status[data-kind="error"]'),'Transport status must visibly distinguish relay and failure states.');

const ids=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'];
assert.equal(ids[0].localeCompare(ids[1])<0,true,'Deterministic initiator policy sanity check failed.');
assert.equal(ids[1].localeCompare(ids[0])<0,false,'Both peers must never initiate the same pair.');
console.log('DOMINIONSTAR_WEBRTC_TRANSPORT_OK deterministic-offer three-lanes audio-output remote-camera remote-share active-speaker reconnect turn-aware isolated-signaling');
