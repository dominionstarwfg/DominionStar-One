import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const engineSource=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const uiSource=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const flowSource=fs.readFileSync(new URL('../assets/js/meet/hotfix-rc13-1-media-prejoin.js',import.meta.url),'utf8');
const deviceLocalitySource=fs.readFileSync(new URL('../assets/js/meet/device-preference-locality.js',import.meta.url),'utf8');
const bootstrapSource=fs.readFileSync(new URL('../assets/js/meet/operation-2030-bootstrap.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../meet/index.html',import.meta.url),'utf8');
const contract=JSON.parse(fs.readFileSync(new URL('../meet/release-contract.json',import.meta.url),'utf8'));

const requireSource=(source,needle,message)=>assert(source.includes(needle),message);
const forbidSource=(source,needle,message)=>assert(!source.includes(needle),message);

// Camera recovery must be a first-class meeting behavior, not a competing patch.
requireSource(engineSource,'const CAMERA_RELEASE_GRACE_MS=750','Meeting engine has no macOS/USB camera release grace period.');
requireSource(engineSource,"const CAMERA_RETRY_DELAYS_MS=[0,320,760,1400]",'Meeting engine has no bounded camera retry policy.');
requireSource(engineSource,"['NotAllowedError','SecurityError','OverconstrainedError','NotFoundError']",'Permission/security camera failures are not explicitly fail-closed.');
requireSource(engineSource,'recoverCameraTrack({intentSeq:seq})','Camera reacquisition is not tied to the latest user video intent.');
requireSource(engineSource,'state.lastCameraReleaseAt=Date.now()','Video Off does not record hardware release time.');
requireSource(uiSource,'const PREVIEW_CAMERA_RELEASE_GRACE_MS=750','Prejoin camera does not share the hardware-release policy.');
requireSource(uiSource,'acquireUserMediaStable({video:{width:{ideal:1280},height:{ideal:720}},audio:false})','Prejoin Video On bypasses stable camera acquisition.');
requireSource(uiSource,'while(ids.toastLayer.children.length>3)','Camera failures can still flood the meeting stage with unlimited toasts.');

// Clean host-prejoin flow: explicit checkpoint, scoped media ownership, direct
// native permission gate, and short deterministic handoff to the meeting engine.
requireSource(flowSource,"event.target.closest?.('#newMeetingAction')",'New Meeting is not intercepted for the professional pre-join checkpoint.');
requireSource(flowSource,"const bootstrapParams = new URLSearchParams(location.search);",'Installed desktop launch intent is not consumed before auto-start.');
requireSource(flowSource,"window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'single-owner-host-prejoin-v1'",'Single-owner desktop prejoin identity is missing.');
requireSource(flowSource,"heading.textContent = 'Ready to start?'",'Host pre-join screen does not expose the Start Meeting checkpoint.');
requireSource(flowSource,"subcopy.textContent = 'Check your camera and microphone before you start the meeting.'",'Host pre-join screen does not explicitly verify camera and microphone state.');
requireSource(flowSource,'await ensureNativeMediaPermissions(constraints);','Host prejoin camera/mic does not cross the native permission gate.');
requireSource(flowSource,'await sleep(220);','Host preview handoff is no longer bounded to the short hardware-release interval.');
requireSource(flowSource,'stopTracks(hostPreviewStream);','Host preview is not physically released before meeting acquisition.');
requireSource(flowSource,"await replaceHostTrack('audio',preferredDevice('microphone'));",'Mic On cannot acquire a microphone when the prejoin started without one.');
forbidSource(flowSource,'navigator.mediaDevices.getUserMedia =','Production prejoin reintroduced a global getUserMedia wrapper.');
forbidSource(flowSource,'__dsLocalDeviceRouting','Production prejoin reintroduced the legacy global media routing marker.');
requireSource(flowSource,"window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'retired-global-wrapper-single-owner-flow-v1'",'Single-owner prejoin architecture marker is missing.');

// Physical device IDs stay local to each machine, but this is now isolated from
// media acquisition in its own tiny preference-boundary module.
requireSource(deviceLocalitySource,'delete sanitized.camera_id','Camera hardware ID is still eligible for remote account sync.');
requireSource(deviceLocalitySource,'delete sanitized.microphone_id','Microphone hardware ID is still eligible for remote account sync.');
requireSource(deviceLocalitySource,'delete sanitized.speaker_id','Speaker hardware ID is still eligible for remote account sync.');
forbidSource(deviceLocalitySource,'getUserMedia','Device preference locality module must never acquire media.');
requireSource(bootstrapSource,'device-preference-locality.js?v=1-machine-local','Desktop advanced bootstrap does not load the isolated device-locality boundary.');

// Zoom-like Pause Share keeps the last frame visible and remains private local
// presenter state; it must not broadcast a public "paused" state.
requireSource(engineSource,'createFrozenScreenTrack','Pause Share does not create a frozen last-frame presentation track.');
requireSource(engineSource,"const frozenScreenTrack = state.screenPaused",'Peer sender routing does not use the frozen presentation track.');
assert(!engineSource.includes("send('meet-screen-state',{active:true,paused:state.screenPaused})"),'Pause Share still tells participants that sharing is paused.');
assert(!engineSource.includes("state.screenStream.getVideoTracks().forEach(track=>track.enabled=!state.screenPaused)"),'Pause Share still disables the display track instead of freezing the outgoing frame.');

// Invitation contract remains one-click and compatible with browser/desktop.
requireSource(uiSource,'const buildMeetingJoinLink=', 'No canonical meeting invitation builder exists.');
requireSource(uiSource,"url.searchParams.set('passcode',code)",'Passcode-protected invitations do not carry the existing shared passcode.');
requireSource(uiSource,"ids.meetingPasscode.value=String(query.get('passcode')",'Incoming invitation passcodes are not applied to the join flow.');
requireSource(uiSource,"query.get('room') || query.get('meeting')",'Legacy desktop meeting links are not normalized at entry.');
requireSource(uiSource,'buildMeetingJoinLink(pendingCredentials.id,{passcode,waiting:waitingRoom})','Scheduled meeting links do not use the canonical room/passcode/waiting-room contract.');
requireSource(html,'meeting-engine.js?v=96-rc13-4-desktop-realtime-isolation','Meet HTML does not bust the certified engine cache key.');
requireSource(html,'executive6.js?v=82-rc13-4-live-room-lookup','Meet HTML does not load the certified Executive 6 UI.');
requireSource(html,'dock-layout-v2.js?v=4-rc13-1-device-locality','Meet HTML does not load the professional device-control layout.');
requireSource(html,'hotfix-rc13-1-media-prejoin.js?v=4-camera-privacy-reacquire','Meet HTML does not load the scoped host-prejoin flow controller.');
assert.equal(contract.releaseId,'2026.08.16-rc13.1-modern-ui-contract','Release contract is not pinned to the certified candidate.');

class FakeTrack {
  constructor(kind,id,{width=1280,height=720}={}){this.kind=kind;this.id=id;this.label=id;this.readyState='live';this.enabled=true;this.contentHint='';this.width=width;this.height=height;this.listeners=new Map();}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  stop(){if(this.readyState==='ended')return;this.readyState='ended';this.listeners.get('ended')?.();}
  getSettings(){return {width:this.width,height:this.height,displaySurface:this.id.includes('screen')?'monitor':undefined};}
}
class FakeMediaStream {
  constructor(tracks=[]){this.tracks=[...tracks];this.id=`stream-${Math.random().toString(36).slice(2)}`;}
  getTracks(){return [...this.tracks];}
  getVideoTracks(){return this.tracks.filter(track=>track.kind==='video');}
  getAudioTracks(){return this.tracks.filter(track=>track.kind==='audio');}
  addTrack(track){if(!this.tracks.includes(track))this.tracks.push(track);}
  removeTrack(track){this.tracks=this.tracks.filter(item=>item!==track);}
}
class FakePeer {
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
const context2d={drawImage(){}};
const documentMock={
  createElement(tag){
    if(tag==='video')return {...videoElement};
    if(tag==='canvas')return {width:0,height:0,getContext(){return context2d;},captureStream(){return new FakeMediaStream([new FakeTrack('video','frozen-screen')]);}};
    return {};
  }
};
const navigatorMock={mediaDevices:{
  async getUserMedia(){
    cameraCalls+=1;
    const step=cameraPlan.shift();
    if(step instanceof Error)throw step;
    if(step instanceof FakeMediaStream)return step;
    return new FakeMediaStream([new FakeTrack('video',`camera-${cameraCalls}`)]);
  },
  async getDisplayMedia(){return displayStream;}
}};
const context={
  console,setTimeout,clearTimeout,setInterval,clearInterval,performance,Promise,Date,Math,Map,Set,WeakSet,
  MediaStream:FakeMediaStream,RTCPeerConnection:FakePeer,
  RTCSessionDescription:class{constructor(value){Object.assign(this,value);}},RTCIceCandidate:class{constructor(value){Object.assign(this,value);}},
  navigator:navigatorMock,document:documentMock,requestAnimationFrame:fn=>setTimeout(fn,0),sessionStorage:{setItem(){}},
  crypto:{randomUUID:()=>Math.random().toString(36).slice(2)},location:{search:'',origin:'https://dominionstarld.com'},
  window:{addEventListener(){},DominionRuntime:{events:{publish(){}}}}
};
context.window.window=context.window;context.window.document=documentMock;context.window.navigator=navigatorMock;context.window.location=context.location;
vm.createContext(context);vm.runInContext(engineSource,context);
const engine=context.window.DominionStarMeetingEngine;
assert(engine,'Meeting engine did not initialize in the contract harness.');
let latestLocalStream=null;let lastScreenPause=null;
engine.on('local-stream',event=>{if(event?.stream)latestLocalStream=event.stream;});
engine.on('screen-paused',event=>{lastScreenPause=event;});

const initialCamera=new FakeTrack('video','camera-initial');
const initialStream=new FakeMediaStream([initialCamera]);
await engine.startMedia({existingStream:initialStream,video:true,audio:false});
await engine.toggleVideo(false);
assert.equal(initialCamera.readyState,'ended','Video Off did not release physical camera hardware.');
assert.equal(initialStream.getVideoTracks().length,0,'Video Off left the stopped camera track inside the local stream.');
const busy1=new Error('Could not start video source');busy1.name='NotReadableError';
const busy2=new Error('camera device busy');busy2.name='NotReadableError';
cameraCalls=0;cameraPlan=[busy1,busy2,new FakeMediaStream([new FakeTrack('video','camera-recovered')])];
const recovered=await engine.toggleVideo(true);
assert.equal(recovered,true,'Transient camera busy errors were not automatically recovered.');
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
const paused=await engine.pauseScreenShare(true);
assert.equal(paused,true,'Pause Share did not enter frozen-frame mode.');
assert.equal(shared.getVideoTracks()[0].readyState,'live','Pause Share stopped the real screen capture instead of freezing the outgoing frame.');
assert.equal(shared.getVideoTracks()[0].enabled,true,'Pause Share disabled the real display track.');
assert.equal(lastScreenPause?.paused,true,'Pause Share did not publish its local presenter state.');
assert.equal(lastScreenPause?.privateFreeze,true,'Pause Share did not identify private frozen-frame behavior.');
const resumed=await engine.pauseScreenShare(false);
assert.equal(resumed,false,'Resume Share did not restore live presentation mode.');
assert.equal(lastScreenPause?.paused,false,'Resume Share did not publish its local resumed state.');
await engine.stopScreenShare();
assert.equal(shared.getVideoTracks()[0].readyState,'ended','Stop Share did not release the display capture.');

console.log('PASS production single-owner camera recovery, scoped host prejoin, machine-local device IDs, freeze-frame sharing, and canonical invitations.');
