import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const app=read('ui/app.js');
const controls=read('ui/participant-controls.js');
const webrtc=read('ui/webrtc-controller.js');
const css=read('ui/zoom-production-polish.css');
const participantReference=read('ui/zoom-participants-reference-2.0.41.js');
const physical=read('ui/zoom-physical-acceptance.js');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=34))),'Participant-roster authority introduced in 2.0.34 must remain enforced for every later candidate.');
assert.ok(app.includes('const roleRank=role=>role===\'host\'?0:role===\'cohost\'?1:2'),'Host and co-host ordering authority is missing.');
assert.ok(app.includes('participant-media-state'),'Roster must reserve a stable media-state zone.');
assert.ok(app.includes('participant-actions'),'Roster must reserve a stable actions zone.');
assert.ok(app.includes("row.dataset.participantSelf=self?'1':'0'"),'Roster must identify the local user without name guessing.');
assert.ok(app.includes('participant-you'),'Roster must visibly mark the local user.');
assert.ok(app.includes('data-participant-mic')&&app.includes('data-participant-video'),'Roster must include mic/video status controls.');
assert.ok(app.includes('<svg viewBox="0 0 24 24" aria-hidden="true">'),'Roster media indicators must use vector icons.');

assert.ok(webrtc.includes('const state={running:false,context:null,lastSignalId:0,peers:new Map(),participants:new Map(),remoteMedia:new Map()'),'WebRTC must own remote media truth.');
assert.ok(webrtc.includes("window.dispatchEvent(new CustomEvent('dominion:remote-media-state'"),'Remote media changes must be published to the roster.');
assert.ok(webrtc.includes("event.track.onmute=()=>setRemoteMediaState(record.id,{micOn:false})"),'Remote mic mute must update roster state.');
assert.ok(webrtc.includes("event.track.onunmute=()=>setRemoteMediaState(record.id,{micOn:true})"),'Remote mic unmute must update roster state.');
assert.ok(webrtc.includes("setRemoteMediaState(id,{cameraOn:true})"),'Remote camera-on must update roster state.');
assert.ok(webrtc.includes("setRemoteMediaState(id,{cameraOn:false})"),'Remote camera-off must update roster state.');

assert.ok(controls.includes("window.addEventListener('dominion:remote-media-state'"),'Participant controls must consume real remote media state.');
assert.ok(controls.includes("media()?.snapshot?.()"),'Local roster media state must come from the real media controller.');
assert.ok(controls.includes("media()?.onChange?.(()=>syncAllMedia())"),'Local mic/camera changes must refresh roster state immediately.');
assert.ok(controls.includes('function bindMediaAction(node,row,kind)')&&controls.includes("q(kind==='mic'?'#roomMic':'#roomCamera')?.click()")&&controls.includes("on?'host:mute':'host:ask-unmute'")&&controls.includes("on?'host:stop-video':'host:ask-start-video'"),'Participant mic/video icons must be real local controls and host/co-host moderation controls, not decorative status indicators.');
assert.ok(controls.includes("button.setAttribute('aria-label',`More controls for"),'Per-participant More action must be accessible.');
assert.ok(controls.includes("version:'2.0.50-approved-share-actions'")&&controls.includes("window.addEventListener('dominion:remote-media-state'")&&controls.includes("window.addEventListener('dominion:meeting-snapshot'")&&controls.includes("window.addEventListener('dominion:active-speakers'")&&controls.includes("button.setAttribute('aria-label',`More controls for"),'Participant controls must preserve the roster/media/action authority with stable self and host menus.');

assert.ok(css.includes('grid-template-columns:34px minmax(0,1fr) auto auto'),'Roster row must use stable avatar/name/media/actions geometry.');
assert.ok(css.includes('border-radius:50%'),'Participant avatars must be circular.');
assert.ok(css.includes('.participant-media-icon.off'),'Muted/off media must have a distinct visual state.');
assert.ok(css.includes('.participant-control-menu{'),'Host/co-host participant menu styling must remain present.');

for(const required of ["add('Mute'","add('Ask to Unmute'","add('Stop Video'","add('Ask to Start Video'","add('Rename'","add('Remove'"]){
  assert.ok(controls.includes(required),`Existing participant control missing: ${required}`);
}
assert.ok(controls.includes("add('Make Co-host'")&&controls.includes("add('Remove Co-host'"),'Host-only co-host authority must remain intact.');
assert.ok(controls.includes("add('Make Host'")&&controls.includes("meeting.transferHost(id)"),'Current host must be able to transfer host authority to a signed-in participant.');
assert.ok(participantReference.includes('max-height:331px!important')&&participantReference.includes('min-height:46px!important;height:46px!important')&&participantReference.includes('overflow-y:auto!important')&&participantReference.includes('overscroll-behavior:contain!important'),'Participants panel must cap the roster at seven compact rows and scroll internally beyond that point.');
assert.ok(participantReference.includes('runtimeMac=isMac||')&&participantReference.includes('.ds-participants-traffic')&&participantReference.includes("traffic.querySelector('.close').onclick")&&participantReference.includes("traffic.querySelector('.min').onclick")&&participantReference.includes("traffic.querySelector('.max').onclick"),'Mac Participants must expose working traffic-light close/collapse/expand controls.');
assert.ok(participantReference.includes("window.addEventListener('dominion:active-speakers'")&&participantReference.includes("row.classList.toggle('participant-speaking'")&&participantReference.includes("if(speaking)return speakerRank"),'Active speakers must move to the top of the participant roster and receive a visible speaking state.');
assert.ok(participantReference.includes("icon.innerHTML=kind==='mic'?ICONS.micOn:ICONS.videoOn"),'Main meeting AV icons must use slash-free base SVGs so the OFF state draws exactly one strike.');
assert.ok(physical.includes("openParticipantMenu?.(more)"),'Normalized participant ellipsis controls must stay bound to the canonical More menu authority.');
assert.ok(physical.includes('data-participant-mic')&&physical.includes('data-participant-video')&&physical.includes("addSelfAction(mediaState.micOn?'Mute':'Unmute'")&&physical.includes("addSelfAction(mediaState.cameraOn?'Stop Video':'Start Video'"),'Visible self roster media controls and the self More menu must perform real microphone/camera actions.');
assert.ok(controls.includes("if(!self&&(!canManage()||role==='host'))")&&controls.includes('dsParticipantMenuBound')&&controls.includes("add('Copy display name'"),'Participant control reconciliation must keep the self More menu interactive instead of skipping the local row.');
assert.ok(participantReference.includes('roomCamera.ds-av-off .ds-control-icon::after')&&participantReference.includes('roomCamera::before')&&participantReference.includes('roomCamera::after'),'Main meeting camera-off state must render one explicit strike while suppressing duplicate pseudo-element strikes.');

console.log('DOMINIONSTAR_ZOOM_PARTICIPANTS_2_0_34_OK speaker-first compact-seven-visible internal-scroll interactive-self-media interactive-self-more interactive-host-media mac-traffic real-mic real-video single-strike vector-icons profile-avatar more-controls make-host host-authority-preserved');
