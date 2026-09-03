import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const app=read('ui/app.js');
const controls=read('ui/participant-controls.js');
const webrtc=read('ui/webrtc-controller.js');
const css=read('ui/zoom-production-polish.css');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=34))),'Participant-roster authority introduced in 2.0.34 must remain enforced for every later candidate.');
assert.ok(app.includes('const roleRank=role=>role===\'host\'?0:role===\'cohost\'?1:2'),'Host and co-host ordering authority is missing.');
assert.ok(app.includes('participant-media-state'),'Roster must reserve a stable media-state zone.');
assert.ok(app.includes('participant-actions'),'Roster must reserve a stable actions zone.');
assert.ok(app.includes('data-participant-self'),'Roster must identify the local user without name guessing.');
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
assert.ok(controls.includes("button.setAttribute('aria-label',`More controls for"),'Per-participant More action must be accessible.');
assert.ok(controls.includes("version:'2.0.34'"),'Participant controls must expose the 2.0.34 authority version.');

assert.ok(css.includes('grid-template-columns:34px minmax(0,1fr) auto auto'),'Roster row must use stable avatar/name/media/actions geometry.');
assert.ok(css.includes('border-radius:50%'),'Participant avatars must be circular.');
assert.ok(css.includes('.participant-media-icon.off'),'Muted/off media must have a distinct visual state.');
assert.ok(css.includes('.participant-control-menu{'),'Host/co-host participant menu styling must remain present.');

for(const required of ["add('Mute'","add('Ask to Unmute'","add('Stop Video'","add('Ask to Start Video'","add('Rename'","add('Remove'"]){
  assert.ok(controls.includes(required),`Existing participant control missing: ${required}`);
}
assert.ok(controls.includes("add('Make Co-host'")&&controls.includes("add('Remove Co-host'"),'Host-only co-host authority must remain intact.');

console.log('DOMINIONSTAR_ZOOM_PARTICIPANTS_2_0_34_OK host-first cohost-second stable-row real-mic real-video vector-icons profile-avatar more-controls host-authority-preserved');
