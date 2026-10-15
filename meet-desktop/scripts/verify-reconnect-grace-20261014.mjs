import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const between=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);
  assert.ok(i>=0&&j>i,'Recovery function missing: '+a);return src.slice(i,j);};
const code=between('  function scheduleReconnect(record,delay){','  function closePeer(id,remove=true){');

function createHarness(){
  const callbacks=[],closed=[],started=[],states=[];
  const timers=new Map();let nextTimer=1;
  const state={running:true,networkOnline:true,peers:new Map(),participants:new Map()};
  const setTimeout=(callback,delay)=>{const id=nextTimer++;timers.set(id,{callback,delay});callbacks.push(delay);return id};
  const clearTimeout=id=>timers.delete(id);
  const closePeer=id=>{closed.push(id);state.peers.delete(id);};
  const ensurePeer=id=>{const peer={id,pc:{connectionState:'new'},reconnectTimer:0};
    state.peers.set(id,peer);return peer;};
  const start=async record=>{started.push(record.id)};
  const fn=new Function('state','setTimeout','clearTimeout','closePeer',
    'ensurePeer','isInitiator','initiate','setTransportStatus','RECONNECT_MS','DISCONNECT_GRACE_MS',
    code+';return scheduleReconnect;');
  const schedule=fn(state,setTimeout,clearTimeout,closePeer,ensurePeer,()=>true,start,
    (label)=>states.push(label),1800,6000);
  const make=connectionState=>{const record={id:'guest',pc:{connectionState},reconnectTimer:0};
    state.peers.set('guest',record);state.participants.set('guest',{});return record;};
  const fire=async record=>{const task=timers.get(record.reconnectTimer);
    assert.ok(task,'timer must exist');timers.delete(record.reconnectTimer);task.callback();
    await Promise.resolve();};
  return {state,callbacks,closed,started,states,schedule,make,fire,timers};
}
const temporary=createHarness(),peer=temporary.make('disconnected');
temporary.schedule(peer,6000);
assert.deepEqual(temporary.callbacks,[6000],'disconnected peer gets grace, not immediate teardown');
peer.pc.connectionState='connecting';
await temporary.fire(peer);
assert.deepEqual(temporary.closed,[],'ICE connecting should retain peer and video');
assert.equal(temporary.state.peers.get('guest'),peer,'video owner remains stable');

const successful=createHarness(),connected=successful.make('disconnected');
successful.schedule(connected,6000);connected.pc.connectionState='connected';
await successful.fire(connected);
assert.equal(successful.closed.length,0,'ICE-recovered peer cannot be rebuilt');

const failed=createHarness(),failedPeer=failed.make('failed');
failed.schedule(failedPeer,0);await failed.fire(failedPeer);
assert.deepEqual(failed.closed,['guest'],'confirmed failed peer may be replaced');
assert.deepEqual(failed.started,['guest'],'replacement peer can renegotiate');

const offline=createHarness(),offlinePeer=offline.make('disconnected');
offline.state.networkOnline=false;offline.schedule(offlinePeer,6000);await offline.fire(offlinePeer);
assert.deepEqual(offline.closed,[],'offline peer cannot churn indefinitely');
assert.equal(offlinePeer.reconnectTimer>0,true,'offline retry must wait');
assert.deepEqual(offline.callbacks,[6000,6000]);

const stale=createHarness(),stalePeer=stale.make('disconnected');
stale.schedule(stalePeer,6000);stale.state.peers.set('guest',{id:'guest'});
await stale.fire(stalePeer);
assert.deepEqual(stale.closed,[],'stale peer timer cannot destroy replacement');

assert.ok(src.includes("else if(status==='connected'||status==='connecting')"),'real event handler must cancel reconnection on recovering ICE');
console.log('PASS reconnect grace: temporary disconnect, ICE recovery, failed replacement, offline retry, stale peer timer (mock only)');