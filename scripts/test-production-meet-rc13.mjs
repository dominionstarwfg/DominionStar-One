import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const engineSource=read('assets/js/meeting-engine.js');
const uiSource=read('assets/js/meet-next/executive6.js');
const flowSource=read('assets/js/meet/hotfix-rc13-1-media-prejoin.js');
const deviceLocalitySource=read('assets/js/meet/device-preference-locality.js');
const bootstrapSource=read('assets/js/meet/operation-2030-bootstrap.js');
const html=read('meet/index.html');
const contract=JSON.parse(read('meet/release-contract.json'));
const requireSource=(source,needle,message)=>assert(source.includes(needle),message);
const forbidSource=(source,needle,message)=>assert(!source.includes(needle),message);

// Camera recovery remains a first-class meeting-engine behavior.
requireSource(engineSource,'const CAMERA_RELEASE_GRACE_MS=750','Meeting engine lost its camera release grace period.');
requireSource(engineSource,"const CAMERA_RETRY_DELAYS_MS=[0,320,760,1400]",'Meeting engine lost its bounded camera retry policy.');
requireSource(engineSource,"['NotAllowedError','SecurityError','OverconstrainedError','NotFoundError']",'Permission/security camera failures are no longer fail-closed.');
requireSource(engineSource,'recoverCameraTrack({intentSeq:seq})','Camera recovery is no longer tied to the latest video intent.');
requireSource(engineSource,'state.lastCameraReleaseAt=Date.now()','Video Off no longer records hardware release time.');
requireSource(uiSource,'const PREVIEW_CAMERA_RELEASE_GRACE_MS=750','Prejoin lost the shared camera-release policy.');
requireSource(uiSource,'acquireUserMediaStable({video:{width:{ideal:1280},height:{ideal:720}},audio:false})','Prejoin Video On bypasses stable camera acquisition.');

// Desktop host prejoin is a scoped checkpoint, not another global media owner.
requireSource(flowSource,"event.target.closest?.('#newMeetingAction')",'New Meeting no longer enters host prejoin.');
requireSource(flowSource,"window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'single-owner-host-prejoin-v1'",'Single-owner desktop prejoin marker is missing.');
requireSource(flowSource,"heading.textContent = 'Ready to start?'",'Host prejoin checkpoint is missing.');
requireSource(flowSource,'await ensureNativeMediaPermissions(constraints);','Host prejoin bypasses native camera/mic permission state.');
requireSource(flowSource,'stopTracks(hostPreviewStream);','Host preview is not released before meeting acquisition.');
requireSource(flowSource,'await sleep(220);','Host-to-meeting media handoff is no longer bounded.');
requireSource(flowSource,"await replaceHostTrack('audio',preferredDevice('microphone'));",'Prejoin Mic On cannot reacquire a missing microphone.');
forbidSource(flowSource,'navigator.mediaDevices.getUserMedia =','Host prejoin reintroduced a global getUserMedia wrapper.');
forbidSource(flowSource,'__dsLocalDeviceRouting','Retired global device routing returned.');

// Physical device identifiers are machine-local and the locality boundary is
// loaded once as part of the cleaned core runtime, independent of cache labels.
for(const key of ['camera_id','microphone_id','speaker_id']) requireSource(deviceLocalitySource,`delete sanitized.${key}`,`${key} can leak into remote preference sync.`);
forbidSource(deviceLocalitySource,'getUserMedia','Device-locality boundary must never acquire media.');
requireSource(bootstrapSource,'device-preference-locality.js','Clean bootstrap does not load the device-locality boundary.');
requireSource(bootstrapSource,"version:'3.1.0-single-dock-layout-authority'",'Production Meet is not using the single-authority clean runtime.');
requireSource(bootstrapSource,'dock-resize-quality.js?v=1-single-layout-authority','Clean runtime lost its resize-only dock quality layer.');
forbidSource(bootstrapSource,'dock-polish-2030.js','Legacy competing dock geometry authority returned.');
requireSource(bootstrapSource,'const core=[','Device locality is no longer part of the bounded core bootstrap.');
assert.equal((bootstrapSource.match(/device-preference-locality\.js/g)||[]).length,1,'Device-locality boundary is loaded more than once.');
for(const retired of ['meeting-identity-settings','meeting-identity-bridge','media-effect-safety']) forbidSource(bootstrapSource,retired,`Retired runtime override returned: ${retired}`);

// Pause Share must freeze the last outgoing frame privately instead of stopping
// the physical display track or telling attendees that the presenter paused.
requireSource(engineSource,'createFrozenScreenTrack','Pause Share cannot create a frozen-frame presentation track.');
requireSource(engineSource,"const frozenScreenTrack = state.screenPaused",'Peer routing does not use the frozen presentation track.');
forbidSource(engineSource,"send('meet-screen-state',{active:true,paused:state.screenPaused})",'Pause Share still broadcasts a public paused state.');
forbidSource(engineSource,"state.screenStream.getVideoTracks().forEach(track=>track.enabled=!state.screenPaused)",'Pause Share still disables the real display track.');

// Invitation behavior remains canonical across browser and desktop.
requireSource(uiSource,'const buildMeetingJoinLink=','Canonical invitation builder is missing.');
requireSource(uiSource,"url.searchParams.set('passcode',code)",'Protected invitation links omit the passcode.');
requireSource(uiSource,"ids.meetingPasscode.value=String(query.get('passcode')",'Incoming invitation passcodes are not applied.');
requireSource(uiSource,"query.get('room') || query.get('meeting')",'Legacy meeting-link room normalization is missing.');
requireSource(uiSource,'buildMeetingJoinLink(pendingCredentials.id,{passcode,waiting:waitingRoom})','Scheduled meetings bypass the canonical invitation contract.');
requireSource(html,'meeting-engine.js?v=96-rc13-4-desktop-realtime-isolation','Meet page no longer loads the certified engine.');
requireSource(html,'executive6.js?v=82-rc13-4-live-room-lookup','Meet page no longer loads the certified UI controller.');
assert.equal(contract.releaseId,'2026.08.16-rc13.1-modern-ui-contract','Release identity changed unexpectedly.');
assert.equal(contract.desktopBridge,14,'Desktop bridge contract changed unexpectedly.');

class FakeTrack{
  constructor(kind,id,{width=1280,height=720}={}){this.kind=kind;this.id=id;this.label=id;this.readyState='live';this.enabled=true;this.contentHint='';this.width=width;this.height=height;this.listeners=new Map();}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  stop(){if(this.readyState==='ended')return;this.readyState='ended';this.listeners.get('ended')?.();}
  getSettings(){return {width:this.width,height:this.height,displaySurface:this.id.includes('screen')?'monitor':undefined};}
}
class FakeMediaStream{
  constructor(tracks=[]){this.tracks=[...tracks];this.id=`stream-${Math.random().toString(36).slice(2)}`;}
  getTracks(){return [...this.tracks];}
  getVideoTracks(){return this.tracks.filter(track=>track.kind==='video');}
  getAudioTracks(){return this.tracks.filter(track=>track.kind==='audio');}
  addTrack(track){if(!this.tracks.includes(track))this.tracks.push(track);}
  removeTrack(track){this.tracks=this.tracks.filter(item=>item!==track);}
}
class FakePeer{
  constructor(){this.connectionState='connected';this.signalingState='stable';this.senders=[];this.transceivers=[];}
  getSenders(){return this.senders;}
  getTransceivers(){return this.transceivers;}
  addTrack(track){const sender={track,async replaceTrack(next){this.track=next;}};this.senders.push(sender);return sender;}
  addTransceiver(kind){const sender={track:null,async replaceTrack(next){this.track=next;}};const t={sender,receiver:{track:new FakeTrack(kind,`recv-${kind}`)},mid:String(this.transceivers.length),direction:'sendonly'};this.senders.push(sender);this.transceivers.push(t);return t;}
  async createOffer(){return {type:'offer',sdp:'test'};}
  async setLocalDescription(value){this.localDescription=value;}
  async setRemoteDescription(value){this.remoteDescription=value;}
  async createAnswer(){return {type:'answer',sdp:'test'};}
  async addIceCandidate(){}
  restartIce(){}
  close(){this.connectionState='closed';}
}

let cameraCalls=0;
let cameraPlan=[];
let displayStream=null;
const videoElement={readyState:2,muted:true,playsInline:true,autoplay:true,srcObject:null,addEventListener(_type,fn){queueMicrotask(fn);},async play(){},pause(){}};
const documentMock={createElement(tag){if(tag==='video')return {...videoElement};if(tag==='canvas')return {width:0,height:0,getContext(){return {drawImage(){}};},captureStream(){return new FakeMediaStream([new FakeTrack('video','frozen-screen')]);}};return {};}};
const navigatorMock={mediaDevices:{
  async getUserMedia(){cameraCalls+=1;const step=cameraPlan.shift();if(step instanceof Error)throw step;if(step instanceof FakeMediaStream)return step;return new FakeMediaStream([new FakeTrack('video',`camera-${cameraCalls}`)]);},
  async getDisplayMedia(){return displayStream;}
}};
const context={console,setTimeout,clearTimeout,setInterval,clearInterval,performance,Promise,Date,Math,Map,Set,WeakSet,MediaStream:FakeMediaStream,RTCPeerConnection:FakePeer,RTCSessionDescription:class{constructor(value){Object.assign(this,value);}},RTCIceCandidate:class{constructor(value){Object.assign(this,value);}},navigator:navigatorMock,document:documentMock,requestAnimationFrame:fn=>setTimeout(fn,0),sessionStorage:{setItem(){}},crypto:{randomUUID:()=>Math.random().toString(36).slice(2)},location:{search:'',origin:'https://dominionstarld.com'},window:{addEventListener(){},DominionRuntime:{events:{publish(){}}}}};
context.window.window=context.window;context.window.document=documentMock;context.window.navigator=navigatorMock;context.window.location=context.location;
vm.createContext(context);vm.runInContext(engineSource,context);
const engine=context.window.DominionStarMeetingEngine;
assert(engine,'Meeting engine did not initialize in the behavior harness.');
let latestLocalStream=null;let lastScreenPause=null;
engine.on('local-stream',event=>{if(event?.stream)latestLocalStream=event.stream;});
engine.on('screen-paused',event=>{lastScreenPause=event;});

const initialCamera=new FakeTrack('video','camera-initial');
const initialStream=new FakeMediaStream([initialCamera]);
await engine.startMedia({existingStream:initialStream,video:true,audio:false});
await engine.toggleVideo(false);
assert.equal(initialCamera.readyState,'ended','Video Off did not release physical camera hardware.');
assert.equal(initialStream.getVideoTracks().length,0,'Video Off left the stopped camera in the local stream.');

const busy1=new Error('Could not start video source');busy1.name='NotReadableError';
const busy2=new Error('camera device busy');busy2.name='NotReadableError';
cameraCalls=0;cameraPlan=[busy1,busy2,new FakeMediaStream([new FakeTrack('video','camera-recovered')])];
assert.equal(await engine.toggleVideo(true),true,'Transient camera busy errors were not recovered.');
assert.equal(cameraCalls,3,'Camera recovery did not use the bounded retry sequence.');
assert.equal(engine.snapshot().mediaState.video,true,'Recovered camera was not published as video-on.');
assert.equal(latestLocalStream?.getVideoTracks()[0]?.id,'camera-recovered','Recovered camera track was not installed.');

await engine.toggleVideo(false);
const denied=new Error('Permission denied');denied.name='NotAllowedError';
cameraCalls=0;cameraPlan=[denied];
await assert.rejects(()=>engine.toggleVideo(true),error=>error?.name==='NotAllowedError');
assert.equal(cameraCalls,1,'Permission denial was incorrectly retried.');

displayStream=new FakeMediaStream([new FakeTrack('video','shared-screen')]);
const shared=await engine.shareScreen();
assert.equal(shared.getVideoTracks()[0].readyState,'live','Screen share did not return a live display track.');
assert.equal(await engine.pauseScreenShare(true),true,'Pause Share did not enter frozen-frame mode.');
assert.equal(shared.getVideoTracks()[0].readyState,'live','Pause Share stopped the real display capture.');
assert.equal(shared.getVideoTracks()[0].enabled,true,'Pause Share disabled the real display track.');
assert.equal(lastScreenPause?.paused,true,'Pause Share did not publish local presenter state.');
assert.equal(lastScreenPause?.privateFreeze,true,'Pause Share lost private frozen-frame behavior.');
assert.equal(await engine.pauseScreenShare(false),false,'Resume Share did not restore live presentation mode.');
assert.equal(lastScreenPause?.paused,false,'Resume Share did not publish resumed state.');
await engine.stopScreenShare();
assert.equal(shared.getVideoTracks()[0].readyState,'ended','Stop Share did not release display capture.');

console.log('PASS production clean architecture: camera recovery, scoped prejoin, machine-local devices, private freeze-frame sharing, canonical invitations.');
