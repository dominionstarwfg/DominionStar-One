import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/share-controller.js',import.meta.url),'utf8');
const between=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>=0&&j>i,'Expected capture method not found');return src.slice(i,j)};
const changeSource=between("  async function replaceSource({name='',options={}}={}){","  async function captureFreezeFrame(");
const nativeAcquire=between('  async function acquireMacWorkerDisplay(options={},generation){','  async function acquireDisplay(');

async function testSourceChange(nativeMacCapture,fail=true){
  const calls=[],oldTrack={readyState:'live',stop(){this.readyState='ended';calls.push('old.stop');}};
  const oldStream={getTracks:()=>[oldTrack]},state={busy:false,liveStream:oldStream,frozenStream:null,freezeCanvas:null,
    paused:false,sourceName:'Old share',options:{source:'old'},annotationCanvas:null};
  let displayRequestGeneration=0,macWorkerActive=true;
  const snapshot=()=>({active:nativeMacCapture?macWorkerActive:!!state.liveStream,
    busy:state.busy,sourceName:state.sourceName});
  const stopTracks=stream=>stream?.getTracks?.().forEach(track=>track.stop());
  const bridge={captureStopped:()=>{calls.push('bridge.captureStopped');},
    captureState:()=>{calls.push('bridge.captureState');}};
  const picker=async()=>{
    if(fail)throw Error('picker_cancelled');
    const track={label:'Replacement',readyState:'live',addEventListener(){}};
    const stream={getTracks:()=>[track]};return {stream,track};
  };
  const disposeMacCaptureClient=({stopWorker})=>{
    calls.push('worker.dispose:'+stopWorker);
    if(state.liveStream===oldStream)stopTracks(oldStream);
    state.liveStream=null;
  };
  const factory=new Function('state','nativeMacCapture','snapshot','stopTracks','bridge',
    'picker','stopComposite','disposeMacCaptureClient','emit',
    'getGeneration','getActive',
    "let displayRequestGeneration=getGeneration();let macWorkerActive=getActive();"+
    "const acquireDisplay=async(options)=>{displayRequestGeneration++;return picker(options);};"+
    changeSource+";return {replaceSource,readState:()=>({displayRequestGeneration,macWorkerActive})};");
  const api=factory(state,nativeMacCapture,snapshot,stopTracks,bridge,picker,
    ()=>calls.push('composite.stop'),disposeMacCaptureClient,()=>calls.push('emit'),
    ()=>displayRequestGeneration,()=>macWorkerActive);
  if(fail)await assert.rejects(api.replaceSource(),/picker_cancelled/);
  else await api.replaceSource();
  await Promise.resolve();
  if(nativeMacCapture&&fail){
    assert.equal(api.readState().macWorkerActive,false);
    assert.equal(state.liveStream,null);
    assert.equal(state.sourceName,'');
    assert.ok(calls.includes('worker.dispose:true'));
    assert.ok(calls.includes('bridge.captureStopped'));
    assert.equal(oldTrack.readyState,'ended');
    assert.equal(snapshot().active,false,'Mac must not keep a phantom share active');
  }else if(!nativeMacCapture&&fail){
    assert.equal(state.liveStream,oldStream,'browser picker cancellation preserves old share');
    assert.equal(oldTrack.readyState,'live');
    assert.equal(state.sourceName,'Old share');
    assert.ok(!calls.some(x=>x.startsWith('worker.dispose')));
    assert.ok(!calls.includes('bridge.captureStopped'));
    assert.equal(snapshot().active,true);
  }else if(!fail&&!nativeMacCapture){
    assert.equal(state.sourceName,'Replacement');
    assert.equal(oldTrack.readyState,'ended');
    assert.equal(snapshot().active,true);
    assert.ok(calls.includes('bridge.captureState'));
  }
  assert.equal(state.busy,false,'all New Share outcomes release busy state');
}
await testSourceChange(true,true);
await testSourceChange(false,true);
await testSourceChange(false,false);

async function testMacWorkerStartRejection(){
  let disposed=0,stopRequested=0,livePeer=null;
  const source=new Function('RTCPeerConnection','MediaStream','captureBridge','state',
    'disposeMacCaptureClient','waitForShareVideoTrack','displayRequestGeneration',
    'stop','getPeer','setPeer',
    "let macCapturePeer=getPeer(),macCaptureUnsubs=[],macCaptureSignalGeneration=0,macWorkerActive=false;"+
    nativeAcquire+";return acquireMacWorkerDisplay;");
  class FakePC{
    close(){disposed++;}
  }
  class FakeMediaStream{
    constructor(){this.tracks=[];}
    getTracks(){return this.tracks;}
    getVideoTracks(){return [];}
    addTrack(track){this.tracks.push(track);}
  }
  let promiseShouldReject=true;
  const bridge={start:async()=>{if(promiseShouldReject)throw Error('picker_denied');return {ok:false,error:'capture_failed'};},
    stop:()=>{stopRequested++;},onOffer:()=>()=>{},onCandidate:()=>()=>{},onError:()=>()=>{},onStopped:()=>()=>{}};
  const state={liveStream:null};
  const dispose=({stopWorker})=>{
    if(livePeer?.close)livePeer.close();livePeer=null;state.liveStream=null;
    if(stopWorker)stopRequested++;
  };
  // Factory local peer is tracked through a wrapper constructor; test the
  // real try/catch path, including cleanup before the promise rejects.
  const PC=class extends FakePC{constructor(){super();livePeer=this;}};
  const acquire=source(PC,FakeMediaStream,bridge,state,dispose,async()=>null,42,async()=>{},()=>livePeer,peer=>{livePeer=peer});
  await assert.rejects(acquire({},42),/picker_denied/);
  assert.equal(state.liveStream,null);
  assert.equal(stopRequested,1);
  assert.equal(disposed,1);
  promiseShouldReject=false;
  await assert.rejects(acquire({},42),/capture_failed/);
  assert.equal(state.liveStream,null,'worker returning ok=false must free stream');
  assert.equal(stopRequested,2);
  assert.equal(disposed,2);
}
await testMacWorkerStartRejection();
console.log('PASS New Share: macOS failed replacement and native worker rejection fail closed; browser cancellation preserves old sharing (mock only)');