import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
function between(a,b){const from=source.indexOf(a),to=source.indexOf(b,from);
  assert.ok(from>=0&&to>from,'Expected signaling function not found');return source.slice(from,to);}
const handlerCode=between('  async function handleSignal(signal){','  function handleRemoteTrack(');
const pollingCode=between('  async function pullSignals(){','  async function syncAllSenders(){');
const state={running:true,generation:1,context:{participantId:'self'},signalPull:null,lastSignalId:0,signalsProcessed:0,signalingErrors:0,lastSignalError:''};
const signalList=[{id:10,type:'offer',fromParticipantId:'guest',payload:{sdp:{type:'offer',sdp:'synthetic'}}},
  {id:11,type:'ice',fromParticipantId:'guest',payload:{candidate:{candidate:'synthetic'}}}];
const sends=[],received=[],queries=[];
let allowPeer=false,created=0;
const pc={signalingState:'stable',remoteDescription:null,
  async setRemoteDescription(d){this.remoteDescription=d;received.push(['remote',d.type]);},
  getTransceivers(){return Array.from({length:4},()=>({direction:'recvonly'}));},
  async createAnswer(){return {type:'answer',sdp:'synthetic'};},
  async setLocalDescription(d){this.localDescription=d;},
  async addIceCandidate(d){received.push(['ice',d.candidate]);}};
const record={id:'guest',pc,transceivers:[],pendingIce:[]};
const meeting={
  async sendSignal(to,type,payload){sends.push({to,type,payload});return {ok:true};},
  async pullSignals(after){queries.push(after);return {signals:signalList.filter(s=>s.id>after),lastId:11};}
};
const ensurePeer=id=>{if(!allowPeer)throw Error('ice_configuration_unavailable');created++;return record;};
const flushIce=async r=>{while(r.pendingIce.length)await r.pc.addIceCandidate(r.pendingIce.shift());};
const applications=new Set(['chat']);
const handleSignal=new Function('state','meeting','APPLICATION_SIGNAL_TYPES','dispatchMeetingSignal','closePeer','ensurePeer','syncLocalTracks','flushIce',
  handlerCode+';return handleSignal;')(state,meeting,applications,()=>{},()=>{},ensurePeer,async()=>{},flushIce);
const pullSignals=new Function('state','meeting','handleSignal',pollingCode+';return pullSignals;')(state,meeting,handleSignal);

await pullSignals();
assert.equal(state.lastSignalId,0,'unavailable ICE config must NOT acknowledge the remote offer');
assert.equal(state.signalingErrors,1);
assert.equal(sends.length,0);
allowPeer=true;await pullSignals();
assert.equal(state.lastSignalId,11,'retried offer and ICE must advance only after application');
assert.deepEqual(received,[['remote','offer'],['ice','synthetic']]);
assert.deepEqual(sends.map(e=>e.type),['answer']);
assert.deepEqual(queries,[0,0],'retried pull must begin with same cursor');
assert.ok(created>=2);

state.generation=1;state.lastSignalId=0;state.signalsProcessed=0;queries.length=0;
let changeGeneration=true;
const stale=new Function('state','meeting','handleSignal',pollingCode+';return pullSignals;')(
  state,meeting,async()=>{if(changeGeneration){state.generation+=1;changeGeneration=false;}});
await stale();
assert.equal(state.lastSignalId,0,'stale room result must not move new room cursor');
console.log('PASS transient ICE peer-construction failure retries offer and candidate without advancing cursor; old-room async signal rejected (mock only)');