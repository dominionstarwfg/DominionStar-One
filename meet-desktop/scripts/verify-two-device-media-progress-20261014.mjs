import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const extract=(start,end)=>{
  const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,'QA diagnostic/source region missing: '+start);
  return src.slice(a,b);
};
const mediaPatch=extract('  function setRemoteMediaState(id,patch={}){','  function showRemoteCamera(');
const remoteMedia=new Map(),events=[],tile={dataset:{}};
const media=new Function('state','q','CSS','window',mediaPatch+';return setRemoteMediaState')(
  {remoteMedia},()=>tile,{escape:id=>id},{dispatchEvent:e=>events.push(e.detail)});
const originalCustomEvent=globalThis.CustomEvent;
if(typeof globalThis.CustomEvent!=='function')globalThis.CustomEvent=class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail;}};
try{
  media('guest',{cameraOn:true});
  assert.deepEqual(remoteMedia.get('guest'),{cameraOn:true});
  assert.equal(tile.dataset.micOn,'unknown','camera-only status cannot falsely mark microphone muted');
  assert.equal(tile.dataset.cameraOn,'1');
  media('guest',{micOn:true});
  assert.deepEqual(remoteMedia.get('guest'),{cameraOn:true,micOn:true});
  media('guest',{cameraOn:false});
  assert.equal(remoteMedia.get('guest').micOn,true);
  assert.equal(tile.dataset.cameraOn,'0');
  assert.equal(events.length,3);
}finally{if(originalCustomEvent)globalThis.CustomEvent=originalCustomEvent;else delete globalThis.CustomEvent;}

const probe=extract('  async function diagnosticWindow(durationMs=4000){','  function companionTracks(){');
const lane=(screenIn=0,screenOut=0,camIn=0)=>[
  {lane:'camera',receiver:{readyState:'live'},sender:{readyState:'live'},
    inbound:{bytes:camIn*200,framesDecoded:camIn,packets:camIn},outbound:{bytes:0,frames:0,packets:0}},
  {lane:'screen',receiver:{readyState:'live'},sender:{readyState:'live'},
    inbound:{bytes:screenIn*600,framesDecoded:screenIn,packets:screenIn},
    outbound:{bytes:screenOut*700,frames:screenOut,packets:screenOut}}
];
const stage=(time,visible=true)=>({present:true,hidden:!visible,readyState:4,videoWidth:1280,videoHeight:720,currentTime:time,streamTracks:[{kind:'video',readyState:'live',muted:false,enabled:true}]});
const makeSnapshot=(screenIn,screenOut,camIn,time,visible=true)=>({
 at:'2026-10-14T12:00:00Z',surface:'desktop',running:true,networkOnline:true,
 remoteShareElement:stage(time,visible),
 remoteCameraElements:[{peerId:'user-private-id',video:{hidden:false,videoWidth:176,currentTime:time}}],
 peers:[{peerId:'user-private-id',connectionState:'connected',lanes:lane(screenIn,screenOut,camIn)}]
});
async function check(before,after){
 const samples=[before,after],delays=[];
 const diagnosticWindow=new Function('diagnosticSnapshot','setTimeout',probe+';return diagnosticWindow')(
   async()=>samples.shift(),(cb,ms)=>{delays.push(ms);cb();});
 return {value:await diagnosticWindow(4500),delays};
}
const good=await check(makeSnapshot(3,5,8,1),makeSnapshot(45,60,58,5.5));
assert.equal(good.value.peerCount,1);
assert.equal(good.value.screenReceiversWithDecodedFrameProgress,1);
assert.equal(good.value.screenSendersWithFrameProgress,1);
assert.equal(good.value.peerLanes[0].lanes.screen.inbound.frames,42);
assert.equal(good.value.peerLanes[0].lanes.screen.outbound.frames,55);
assert.equal(good.value.peerLanes[0].lanes.camera.inbound.frames,50);
assert.equal(good.value.remoteSharePlayback.secondsAdvanced,4.5);
assert.equal(good.value.remoteSharePlayback.visible,true);
assert.equal(good.value.durationMs,4500);
assert.deepEqual(good.delays,[4500]);
assert.ok(!JSON.stringify(good.value).includes('user-private-id'),'report must exclude participant IDs');
const stalled=await check(makeSnapshot(3,5,2,1),makeSnapshot(3,5,2,1));
assert.equal(stalled.value.screenReceiversWithDecodedFrameProgress,0);
assert.equal(stalled.value.screenSendersWithFrameProgress,0);
assert.equal(stalled.value.peerLanes[0].lanes.screen.inbound.frames,0);
assert.equal(stalled.value.remoteSharePlayback.secondsAdvanced,0);
const missing=await check(makeSnapshot(3,5,2,1),{
 ...makeSnapshot(6,8,4,2),peers:[{peerId:'user-private-id',connectionState:'connected',lanes:[
 {lane:'screen',sender:null,receiver:null,inbound:null,outbound:null}
 ]}]
});
assert.equal(missing.value.peerLanes[0].lanes.screen.inbound.frames,null,
 'missing telemetry must not be accepted as decoded-frame progress');
assert.equal(missing.value.screenReceiversWithDecodedFrameProgress,0);
console.log('PASS remote mic/camera unknown states and two-device media delta probe: decoded, stalled, absent telemetry (simulation only)');
