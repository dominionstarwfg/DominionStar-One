import fs from 'node:fs';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const cut=(a,b)=>{const start=src.indexOf(a),end=src.indexOf(b,start);assert.ok(start>=0&&end>start,'Missing '+a);return src.slice(start,end);};
const configSource=cut('  function iceConfiguration(remoteId=', '  function validIceConfig()');
const iceConfiguration=new Function('state','hasRelay',configSource+'\nreturn iceConfiguration')(
  {iceServers:[{urls:'turn:qa.invalid',username:'stub',credential:'stub'}],relayOnlyPeers:new Set(['second'])},()=>true);
assert.equal(iceConfiguration('first').iceTransportPolicy,'all');
assert.equal(iceConfiguration('second').iceTransportPolicy,'relay');
const scheduled=[];
const timers=[];
const events=[];
const state={running:true,networkOnline:true,relayOnlyPeers:new Set(),iceServers:[{urls:'turn:qa.invalid',username:'stub',credential:'stub'}],peers:new Map(),participants:new Map(),qaDirectOnly:false};
const pc={connectionState:'connecting',signalingState:'have-local-offer',iceConnectionState:'checking'};
const record={id:'second',pc,createdAt:Date.now()-13000,negotiationStarted:true,reconnectTimer:0,transport:'unknown'};
state.peers.set(record.id,record);state.participants.set(record.id,{});
const newRecord={id:'second',pc:{connectionState:'new',signalingState:'stable'},reconnectTimer:0};
let invokes=0;
const scheduleSource=cut('  function scheduleReconnect(record,delay,forceRelayOnly=false){','  function closePeer(');
const scheduleReconnect=new Function('state','hasRelay','setTimeout','clearTimeout','closePeer','ensurePeer','isInitiator','initiate','RECONNECT_MS','DISCONNECT_GRACE_MS','setTransportStatus',scheduleSource+'\nreturn scheduleReconnect;')(
state,()=>true,(fn,ms)=>{timers.push({fn,ms});return timers.length},()=>{},()=>{state.peers.delete('second');events.push('close')},()=>{state.peers.set('second',newRecord);events.push('replace');return newRecord},()=>true,()=>{invokes++;return Promise.resolve()},1800,6000,()=>{});
const sampleSource=cut('  async function sampleTransports(){','  function scheduleReconnect(');
const sampleTransports=new Function('state','hasRelay','sampleTransport','scheduleReconnect','setTransportStatus',sampleSource+'\nreturn sampleTransports;')(
state,()=>true,async()=>{},scheduleReconnect,()=>{});
await sampleTransports();
assert.equal(timers.length,1,'Stalled initial connection must schedule one restart');
assert.equal(timers[0].ms,0);
assert.equal(state.relayOnlyPeers.has('second'),false,'Escalation must happen only during the timeout callback');
timers[0].fn();
assert.equal(state.relayOnlyPeers.has('second'),true,'Retry must force TURN relay');
assert.deepEqual(events,['close','replace']);
assert.equal(invokes,1,'Replaced initiator must negotiate once');
await sampleTransports();
assert.equal(timers.length,1,'Only one relay escalation per peer per meeting');
assert.equal(state.peers.get('second'),newRecord);
assert.match(src,/state\.relayOnlyPeers\.clear\(\)/,'Meeting cleanup must clear relay-only decisions');
console.log('PASS one-time relay fallback for stalled ICE; no repeat churn (controlled simulation)');
