import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const media=read('ui/media-controller.js');
const app=read('ui/app.js');
const webrtc=read('ui/webrtc-controller.js');
const approved=read('ui/approved-reference-parity.js');

assert.equal(pkg.version,'2.0.35','Camera responsiveness candidate must report 2.0.35.');

assert.ok(media.includes('cameraPending:false'),'Media state must explicitly model camera acquisition.');
assert.ok(media.includes('let cameraIntent=0,warmVideoTrack=null,warmVideoTimer=0'),'Camera intent and short warm-track authority must exist.');
assert.ok(media.includes('warmVideoTimer=setTimeout(releaseWarmVideo,1800)'),'Warm camera handoff must be short and bounded.');
assert.ok(media.includes('const intent=++cameraIntent'),'Every camera request must get a cancellation generation.');
assert.ok(media.includes('if(intent!==cameraIntent||!state.cameraOn){stopTrack(fresh);return api.snapshot();}'),'Late camera acquisition must not resurrect a cancelled camera request.');
assert.ok(media.includes("try{stream.removeTrack(current);}catch{}holdWarmVideo(current)"),'Video Off must detach the camera from the meeting immediately before warm holding it.');
assert.ok(media.includes("try{track.enabled=false;}catch{}warmVideoTrack=track"),'Warm camera track must be disabled while detached.');
assert.ok(media.includes("try{track.enabled=true;}catch{}ensureStream().addTrack(track)"),'Quick Video On must reactivate the warm camera without fresh acquisition.');
assert.ok(media.includes('releaseWarmVideo();state.cameraPending=false;stopTracks'),'Meeting stop must fully release any warm camera track.');
assert.ok(media.includes('cameraPending:state.cameraPending'),'Snapshots must expose acquisition state.');
assert.ok(!media.includes("if(!enabled){state.cameraOn=false;removeKind('video');emit();return api.snapshot();}"),'Old destructive Video Off path must not return.');

assert.ok(app.includes('const operation=media.setCamera(target);'),'Camera intent must start without blocking the UI thread.');
assert.ok(app.includes('attachPreview();\n    try{\n      await operation;attachPreview();'),'Fallback/UI must repaint before waiting for camera acquisition.');
assert.ok(!app.includes('async function toggleCamera(button){button.disabled=true'),'Video control must not be disabled during camera acquisition.');

assert.ok(webrtc.includes('state.mediaUnsub=window.DominionMediaController?.onChange?.(()=>void syncAllSenders())'),'WebRTC senders must continue reacting immediately to media changes.');
assert.ok(approved.includes("paintAvatar(q('#stageAvatar'),own.url,initials(own.name))"),'Camera-off stage must retain profile-photo/initials fallback authority.');

console.log('DOMINIONSTAR_INSTANT_CAMERA_2_0_35_OK immediate-off short-warm-handoff cancellable-on no-dead-button fallback-preserved sender-sync-preserved');
