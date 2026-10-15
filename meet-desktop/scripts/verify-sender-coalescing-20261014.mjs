import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const part=(start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Expected media sync function missing');return src.slice(a,b);};
const code=part('  async function syncLocalTracks(record){','  async function initiate(record,iceRestart=false){');

async function verifyBurstySynchronization(){
  let releaseCamera,computations=0;
  const cameraGate=new Promise(resolve=>{releaseCamera=resolve;});
  const audio={kind:'audio',id:'mic',readyState:'live'},
    camera1={kind:'video',id:'camera-old',readyState:'live'},
    camera2={kind:'video',id:'camera-new',readyState:'live'},
    screen1={kind:'video',id:'screen-old',readyState:'live'},
    screen2={kind:'video',id:'screen-new',readyState:'live'};
  let camera=camera1,screen=screen1,sharing=true;
  const updates=[];
  const lanes=Array.from({length:4},(_,i)=>({
    sender:{track:null,async replaceTrack(track){updates.push([i,track?.id||null]);this.track=track;},
      getParameters(){return {encodings:[{}]}},async setParameters(){}}
  }));
  const record={id:'remote',senderSync:Promise.resolve(),senderSyncRunning:false,
    senderSyncDirty:false,pc:{signalingState:'stable'}};
  const state={running:true,peers:new Map([['remote',record]])};
  const localMedia=()=>({getAudioTracks:()=>[audio]});
  const localCameraTrack=async()=>{computations++;await cameraGate;return camera;};
  const shareMedia=()=>sharing?{getVideoTracks:()=>[screen],getAudioTracks:()=>[]}:null;
  const syncLocalTracks=new Function('state','transceivers','localMedia','localCameraTrack','shareMedia','window',
    code+'\nreturn syncLocalTracks;')(state,()=>lanes,localMedia,localCameraTrack,shareMedia,
    {DominionShareController:{snapshot:()=>({options:{optimizeVideo:false}})}});
  const first=syncLocalTracks(record);
  const pending=[];
  for(let i=0;i<40;i++){
    if(i===19){camera=camera2;screen=screen2;}
    pending.push(syncLocalTracks(record));
  }
  releaseCamera();
  await Promise.all([first,...pending]);
  assert.ok(computations<=2,'camera/effects computation must not grow with notification count');
  assert.equal(lanes[1].sender.track,camera2,'latest camera wins');
  assert.equal(lanes[2].sender.track,screen2,'latest screen wins');
  assert.equal(record.senderSyncRunning,false);
  assert.equal(record.senderSyncDirty,false);
  const before=updates.length;
  await syncLocalTracks(record);
  assert.equal(updates.length,before,'unchanged tracks must not be rebound');
  sharing=false;
  await syncLocalTracks(record);
  assert.equal(lanes[2].sender.track,null,'stop share must clear sender track');
  const last=updates.at(-1);
  assert.deepEqual(last,[2,null]);
  const afterStop=updates.length;
  state.running=false;
  await syncLocalTracks(record);
  assert.equal(updates.length,afterStop,'ended meeting cannot reattach media');
}
await verifyBurstySynchronization();
console.log('PASS coalesced WebRTC sender sync: 40 rapid changes, current camera/screen, stop share, no stale reattachment (mock only)');