import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const segment=(start,end)=>{
  const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Source function boundary missing: ${start}`);
  return src.slice(a,b);
};

function makeVideo(){
  let stream=null,attachments=0;
  const node={dataset:{},hidden:true,readyState:0,videoWidth:0,videoHeight:0,
    paused:true,muted:false,onloadeddata:null,onresize:null,
    play(){this.paused=false;return Promise.resolve()}};
  Object.defineProperty(node,'srcObject',{get(){return stream},set(value){stream=value;attachments++}});
  return {node,get attachments(){return attachments}};
}
async function testRemoteMedia(){
  const share=makeVideo(),camera=makeVideo(),fallback={hidden:false};
  const tile={dataset:{},querySelector:selector=>selector==='video'?camera.node:fallback};
  const banner={hidden:true,querySelector:()=>({textContent:''})};
  const classes=new Set(),events=[],remoteState=[];
  const q=selector=>selector==='#remoteShareVideo'?share.node:
    selector==='#remoteShareBanner'?banner:selector.startsWith('#remoteTileStrip ')?tile:null;
  const FakeEvent=function(type,options){this.type=type;this.detail=options.detail;};
  const document={body:{classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}}};
  const factory=new Function('q','ensureUi','ensureTile','setRemoteMediaState','setTileState',
    'participantName','window','document','CustomEvent','CSS',
    segment('  function showRemoteCamera(id,stream){','  async function routeAudioElement(')+
    '\nreturn {showRemoteCamera,hideRemoteCamera,showRemoteShare,hideRemoteShare};');
  const actions=factory(q,()=>{},()=>tile,(id,value)=>remoteState.push([id,value]),
    ()=>{},id=>`Remote ${id}`,{dispatchEvent:event=>events.push(event)},
    document,FakeEvent,{escape:value=>value});
  const stream1={getVideoTracks:()=>[{}]};
  actions.showRemoteShare('peer1',stream1);
  assert.equal(share.node.hidden,true,'screen cannot cover stage before decoded frames');
  assert.equal(classes.has('remote-share-active'),false,'no premature share-state banner');
  assert.equal(events.some(event=>event.detail.active===true),false,'no false share-ready event');
  share.node.videoWidth=1280;share.node.videoHeight=720;share.node.readyState=2;
  share.node.onloadeddata();
  assert.equal(share.node.hidden,false);
  assert.equal(classes.has('remote-share-active'),true);
  const attachments=share.attachments;
  actions.showRemoteShare('peer1',stream1);
  assert.equal(share.attachments,attachments,'same stream must never be rebound');
  actions.hideRemoteShare('peer1',true);
  assert.equal(share.node.hidden,true);
  assert.equal(share.node.srcObject,null,'ended share must detach its stream');
  assert.equal(classes.has('remote-share-active'),false);
  const stream2={getVideoTracks:()=>[{}]};
  actions.showRemoteCamera('peer2',stream2);
  assert.equal(camera.node.hidden,true,'camera cannot show until first frame');
  camera.node.readyState=2;camera.node.videoWidth=640;camera.node.videoHeight=360;
  camera.node.onloadeddata();
  assert.equal(camera.node.hidden,false);
  assert.equal(fallback.hidden,true);
  const cameraAttachments=camera.attachments;
  actions.showRemoteCamera('peer2',stream2);
  assert.equal(camera.attachments,cameraAttachments);
  actions.hideRemoteCamera('peer2',true);
  assert.equal(camera.node.hidden,true);
  assert.equal(camera.node.srcObject,null);
  assert.equal(fallback.hidden,false);
  await Promise.resolve();
}
async function testSignalPolling(){
  const text=segment('  async function pullSignals(){','  async function syncAllSenders(){');
  const state={running:true,signalPull:null,lastSignalId:0,generation:1,
    signalsProcessed:0,signalingErrors:0,lastSignalError:''};
  let requestCount=0,failOn=2;const consumed=[];
  const meeting={pullSignals:async()=>{requestCount++;return {
    signals:[{id:3,type:'ice'},{id:1,type:'offer'},{id:2,type:'answer'}],lastId:3
  }}};
  const handler=async event=>{if(event.id===failOn)throw Error('transient processing failure');consumed.push(event.id)};
  const poll=new Function('state','meeting','handleSignal',text+'\nreturn pullSignals')(state,meeting,handler);
  await Promise.all([poll(),poll(),poll()]);
  assert.equal(requestCount,1,'parallel timers must use one signal pull');
  assert.deepEqual(consumed,[1],'signals must be sorted and stop on processing failure');
  assert.equal(state.lastSignalId,1,'cursor cannot skip failed answer');
  failOn=0;await poll();
  assert.deepEqual(consumed,[1,2,3],'retry must finish the prior signal stream');
  assert.equal(state.lastSignalId,3);
}
await testRemoteMedia();
await testSignalPolling();
console.log('PASS remote camera/share decode gate + serialized signaling functional mocks (NOT real devices)');
