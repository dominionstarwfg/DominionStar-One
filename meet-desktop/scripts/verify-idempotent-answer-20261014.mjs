import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const source=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);
  assert.ok(i>=0&&j>i,'Missing WebRTC handler boundary');return src.slice(i,j);};
const code=source('  async function handleSignal(signal){','  function handleRemoteTrack(');
const applicationTypes=new Set(),state={running:true,context:{participantId:'me'},peers:new Map()};
const attempts=[],counters={remoteDescriptions:0,answerCreates:0,localDescriptions:0,senderSyncs:0,closed:0};
let failAnswerDelivery=true,failCreateAnswer=false;
function peer(){
  const pc={
    remoteDescription:null,localDescription:null,
    async setRemoteDescription(value){this.remoteDescription=value;counters.remoteDescriptions++;},
    getTransceivers(){return Array.from({length:4},()=>({direction:'recvonly'}));},
    async createAnswer(){counters.answerCreates++;if(failCreateAnswer)throw Error('temporary_codec_failure');return {type:'answer',sdp:'signed-answer'};},
    async setLocalDescription(value){this.localDescription=value;counters.localDescriptions++;}
  };
  return {id:'guest',pc,transceivers:[],pendingIce:[],lastOfferSignalId:0,lastOfferAnswer:null};
}
let record=peer();state.peers.set('guest',record);
const meeting={async sendSignal(id,type,payload){
  attempts.push({id,type,payload});
  if(failAnswerDelivery){failAnswerDelivery=false;throw Error('transient_signaling_failure');}
  return {ok:true};
}};
const closePeer=(id)=>{counters.closed++;state.peers.delete(id)};
const ensurePeer=id=>{if(!state.peers.has(id)){record=peer();state.peers.set(id,record);}return state.peers.get(id)};
const handler=new Function('state','APPLICATION_SIGNAL_TYPES','dispatchMeetingSignal','closePeer',
  'ensurePeer','syncLocalTracks','flushIce','meeting',code+';return handleSignal')(
  state,applicationTypes,()=>{},closePeer,ensurePeer,
  async()=>{counters.senderSyncs++},async()=>{},meeting);
const offer={id:100,type:'offer',fromParticipantId:'guest',payload:{sdp:{type:'offer',sdp:'sender-offer'}}};
await assert.rejects(handler(offer),/transient_signaling_failure/);
assert.equal(record.lastOfferSignalId,100,'the answer must be cached after SDP is complete');
assert.equal(counters.closed,0,'answer signaling failure must not tear down a healthy peer');
await handler(offer);
assert.equal(counters.remoteDescriptions,1,'retry must not re-apply remote SDP');
assert.equal(counters.answerCreates,1,'retry must not create a new answer');
assert.equal(counters.localDescriptions,1,'retry must preserve original local answer');
assert.equal(counters.senderSyncs,1,'retry must not tear down and rebind media');
assert.equal(attempts.length,2);
assert.deepEqual(attempts[0].payload,attempts[1].payload,'answer redelivery must use identical SDP');

const broken={...offer,id:101};
failCreateAnswer=true;
await assert.rejects(handler(broken),/temporary_codec_failure/);
assert.equal(counters.closed,1,'mid-negotiation failure must clear half-open PC');
failCreateAnswer=false;
await handler(broken);
assert.equal(counters.closed,1,'new peer must handle retried offer');
assert.equal(counters.answerCreates,3);
assert.equal(counters.remoteDescriptions,3);
assert.equal(record.lastOfferSignalId,101);
console.log('PASS SDP answer redelivery: same answer after signaling outage; half-open failed offer resets only failed peer (mock only)');