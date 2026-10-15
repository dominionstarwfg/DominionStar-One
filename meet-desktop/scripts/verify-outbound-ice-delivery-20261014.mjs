import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const extract=(start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Missing outbound ICE delivery implementation');return src.slice(a,b);};
const implementation=extract('  function queueOutboundIce(record,candidate){','  function createPeerRecord(remoteId){');
const build=({failCount=0}={})=>{
  const state={running:true,peers:new Map(),signalingErrors:0,lastSignalError:''};
  const delivered=[],requested=[];const timers=new Map();let tick=1;
  const meeting={async sendSignal(id,type,payload){
    requested.push(payload.candidate.candidate);
    if(failCount>0){failCount--;throw Error('temporary_network_failure');}
    delivered.push(payload.candidate.candidate);return {ok:true};
  }};
  const queue=new Function('state','meeting','setTimeout','clearTimeout','RECONNECT_MS',
    implementation+';return {queueOutboundIce,flushOutboundIce}')(
      state,meeting,(fn,ms)=>{const id=tick++;timers.set(id,{fn,ms});return id},
      id=>timers.delete(id),1800);
  const record={id:'guest',outboundIce:[],outboundIceSending:false,
    outboundIceRetryTimer:0,outboundIceSendFailures:0};
  state.peers.set('guest',record);
  const candidate=label=>({candidate:label});
  const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
  const fire=async()=>{
    const id=record.outboundIceRetryTimer,entry=timers.get(id);
    assert.ok(entry,'Expected scheduled retry');assert.equal(entry.ms,1800);
    timers.delete(id);entry.fn();await settle();
  };
  return {state,queue,record,delivered,requested,timers,candidate,settle,fire};
};
const transient=build({failCount:1});
transient.queue.queueOutboundIce(transient.record,transient.candidate('candidate-A'));
await transient.settle();
assert.deepEqual(transient.delivered,[]);
assert.equal(transient.record.outboundIce.length,1,'failed ICE must not be discarded');
assert.equal(transient.record.outboundIceSendFailures,1);
assert.equal(transient.state.lastSignalError,'outbound_ice_delivery_failed');
assert.equal(transient.timers.size,1);
await transient.fire();
assert.deepEqual(transient.delivered,['candidate-A']);
assert.equal(transient.record.outboundIce.length,0);
assert.equal(transient.record.outboundIceRetryTimer,0);
const burst=build({failCount:1});
burst.queue.queueOutboundIce(burst.record,burst.candidate('A'));
await burst.settle();
burst.queue.queueOutboundIce(burst.record,burst.candidate('B'));
await burst.settle();
assert.deepEqual(burst.delivered,['A','B'],'queued ICE must preserve order');
assert.equal(burst.timers.size,0,'retry timer must be cancelled when delivery resumes');
assert.deepEqual(burst.requested,['A','A','B']);
const stopped=build({failCount:1});
stopped.queue.queueOutboundIce(stopped.record,stopped.candidate('C'));
await stopped.settle();
stopped.state.running=false;stopped.state.peers.delete('guest');
await stopped.fire();
assert.deepEqual(stopped.delivered,[],'room exit cannot send stale ICE');
const full=build();
full.record.outboundIce=Array.from({length:128},()=>full.candidate('existing'));
full.record.outboundIceSending=true;full.queue.queueOutboundIce(full.record,full.candidate('overflow'));
assert.equal(full.record.outboundIce.length,128,'queue must be bounded');
assert.equal(full.state.lastSignalError,'outbound_ice_queue_full');
console.log('PASS outbound ICE queue: retry after transient RPC failure, candidate order, no stale resend and bounded backlog (mock only)');