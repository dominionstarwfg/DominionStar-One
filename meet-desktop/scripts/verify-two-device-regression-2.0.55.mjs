import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const app=read('ui/app.js');
const lifecycle=read('ui/meeting-lifecycle-authority.js');
const webrtc=read('ui/webrtc-controller.js');
const participantCss=read('ui/participant-panel-stability.css');
const participantRef=read('ui/zoom-participants-reference-2.0.41.js');

// Approved participant-panel geometry is a hard contract.
assert(participantCss.includes('width:392px!important'),'Participant panel width regressed from approved 392px geometry.');
assert(participantCss.includes('height:48px!important'),'Participant row height regressed from approved 48px geometry.');
assert(participantCss.includes('.participant-media-icon.off::after'),'Single mute/video slash owner is missing.');
assert(participantCss.includes('content:none!important'),'Legacy pseudo-element slash suppression is missing.');
assert(participantRef.includes("node.innerHTML=kind==='mic'?ICONS.micOn:ICONS.videoOn;"),'Participant reference layer must not inject a second slash into mic/video SVG state.');

// Leave/End must always be guarded.
assert(lifecycle.includes('Leave Meeting'),'Canonical Leave Meeting action is missing.');
assert(lifecycle.includes('End Meeting for All'),'Canonical End Meeting for All action is missing.');
assert(lifecycle.includes('__DOMINION_CANONICAL_INVITE_GUARD_BOUND'),'Canonical Invite capture guard is missing.');
assert(app.includes('__DOMINION_EXIT_GUARD_BOUND'),'Meeting Exit capture guard is missing.');
assert(app.includes('void exitRoom();'),'Exit guard must route through the canonical exit authority.');

// Invite must stay open long enough to copy link/invitation.
for(const token of ['data-copy-link','data-copy-invite','data-link','data-room','data-passcode'])assert(lifecycle.includes(token),`Invite dialog contract missing ${token}.`);

// The first remote participant must generate a presence event so the join tone is not skipped.
assert(app.includes("const joined=activePeople.filter(p=>String(p.participantId||'')!==selfId);"),'Initial remote participant presence event is missing.');

// Two-device media delivery must tolerate asynchronous track/state arrival.
assert(webrtc.includes('remoteShareSignaled:false'),'Remote share signaling latch is missing.');
assert(webrtc.includes('remoteShareStream:null'),'Remote share stream latch is missing.');
assert(webrtc.includes('function announcedScreenCandidate(record)')&&webrtc.includes('function bindRemoteScreenCandidate(record,candidate)'), 'Remote screen-state must recover when track metadata and ontrack arrive out of order.');
assert(webrtc.includes('record.remoteShareStream=stream;'),'Remote share track must be retained until signaling catches up.');
assert(webrtc.includes('remoteShareTrackId')&&webrtc.includes('remoteShareStreamId')&&webrtc.includes('remoteShareMid'),'Remote share identity metadata is not retained for physical desktop/browser reclassification.');
assert(webrtc.includes('const lanes=transceivers(record),index=lanes.indexOf(event.transceiver)'), 'Remote track routing must use the stable peer transceiver contract.');
assert(webrtc.includes('video.muted=true;video.autoplay=true;video.playsInline=true'),'Remote camera/share video must be autoplay-safe.');

console.log('DOMINIONSTAR_TWO_DEVICE_REGRESSION_2_0_55_OK participant-geometry single-slash guarded-exit persistent-invite join-tone remote-camera remote-share-race');
