import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/direct-messages.js',import.meta.url),'utf8');
const from=source.indexOf('  const acceptIncomingCall = async () => {');
const to=source.indexOf('  const endActiveCall = async notify => {',from);
assert.ok(from>=0&&to>from,'Accept handler source must be present');
const acceptCode=source.slice(from,to);
const viewCode=source.slice(source.indexOf('  async function openConversation(memberId) {'),source.indexOf("\n  select.addEventListener('change'"));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const incoming=()=>({type:'offer',from:'caller',to:'recipient',callId:'call-1',
 description:{type:'offer',sdp:'v=0\r\nmock SDP'},callType:'audio'});

function setup({initialView='other',channel='other',mediaGate=null,navigationGate=null,channelFailure=false}={}){
 const events=[],tracks=[],peers=[];
 const offer=incoming();
 const media={getTracks(){return [{stop(){tracks.push('stopped')}}]}};
 const nodes={classList:{add(){}},setAttribute(){}};
 const context={
  incomingCall:nodes,window:{CommunicationEngine:{stopAll(){events.push('sound stopped')}}},
  members:[{id:'caller',display_name:'Caller'}],
  clearTimeout(){},
  navigator:{mediaDevices:{async getUserMedia(){events.push('permission requested');return mediaGate?mediaGate.promise:media}}},
  createPeerConnection(){
   events.push('peer created');
   const peer={
    addTrack(){},
    async setRemoteDescription(){events.push('remote set')},
    async createAnswer(){return {type:'answer',sdp:'answer'}},
    async setLocalDescription(){events.push('local set')}
   };
   peers.push(peer);return peer;
  },
  localVideo:{},setSendStatus:(t)=>events.push('error:'+t),
  answerTrustedCallRecord:async id=>{events.push('trusted-answer:'+id);return true},
  showCallOverlay(){events.push('overlay')},
  updateCallStatus(){},
  console:{warn(){}}
 };
 const code=[
  "(()=>{",
  "let activeMemberId="+JSON.stringify(initialView)+
    ",callPartnerId="+JSON.stringify(channel)+
    ",callAccepting=false,callDialing=false,peerConnection=null,"+
    "localStream=null,callStartedAt=0,pendingOffer="+JSON.stringify(offer)+
    ",incomingCallTimer=1,activeCallType='audio',activeCallRecordId='';",
  "const openConversation=async memberId=>{events.push('open:'+memberId);"+
    "activeMemberId=memberId;if(navigationGate)await navigationGate.promise;};",
  "const ensureCallChannel=async memberId=>{events.push('channel:'+memberId);"+
    "if(channelFailure)throw Error('Subscribe denied');callPartnerId=memberId;};",
  "const sendCallSignal=async signal=>{events.push('send:'+signal.type+':'+callPartnerId);"+
    "if(callPartnerId!=='caller')throw Error('Wrong channel');};",
  "const endActiveCall=async()=>{events.push('end');peerConnection=null;pendingOffer=null;};",
  acceptCode,
  "return {acceptIncomingCall,cancel:()=>{pendingOffer=null},state:()=>"+
  "({activeMemberId,callPartnerId,callAccepting,peerConnection,pendingOffer})};",
  "})()"
 ].join('\n');
 const obj=vm.runInNewContext(code,{...context,events,navigationGate,channelFailure},{timeout:2500});
 return {...obj,events,tracks,peers,media};
}

test('Accepting a call from another agent subscribes to the caller pair after navigating',async()=>{
 const h=setup({initialView:'other',channel:'other'});
 await h.acceptIncomingCall();
 assert.deepEqual(h.events.filter(x=>x.startsWith('open:')||x.startsWith('channel:')||x.startsWith('send:')),
  ['open:caller','channel:caller','send:answer:caller']);
 assert.equal(h.state().callPartnerId,'caller');
 assert.equal(h.state().callAccepting,false);
 assert.equal(h.peers.length,1);
 assert.ok(h.events.includes('trusted-answer:call-1'));
});

test('Same selected chat still selects the correct caller signaling channel',async()=>{
 const h=setup({initialView:'caller',channel:'other'});
 await h.acceptIncomingCall();
 assert.ok(!h.events.includes('open:caller'));
 assert.ok(h.events.includes('channel:caller'));
 assert.ok(h.events.includes('send:answer:caller'));
});

test('Cancellation during conversation navigation does not start microphone or send answer',async()=>{
 const gate=deferred(),h=setup({navigationGate:gate});
 const pending=h.acceptIncomingCall();
 await tick();
 h.cancel();
 gate.resolve();
 await pending;
 assert.ok(h.events.includes('open:caller'));
 assert.ok(!h.events.some(x=>x.startsWith('channel:')));
 assert.ok(!h.events.includes('permission requested'));
 assert.equal(h.state().callAccepting,false);
});

test('Cancellation during microphone prompt stops newly granted tracks and never answers',async()=>{
 const gate=deferred(),h=setup({mediaGate:gate});
 const pending=h.acceptIncomingCall();
 await tick();
 assert.ok(h.events.includes('permission requested'));
 h.cancel();
 gate.resolve(h.media);
 await pending;
 assert.deepEqual(h.tracks,['stopped']);
 assert.equal(h.peers.length,0);
 assert.ok(!h.events.some(x=>x.startsWith('send:answer')));
 assert.equal(h.state().callAccepting,false);
});

test('Concurrent Accept clicks cannot create duplicate microphone permission requests',async()=>{
 const gate=deferred(),h=setup({mediaGate:gate});
 const p1=h.acceptIncomingCall();
 const p2=h.acceptIncomingCall();
 await tick();
 assert.equal(h.events.filter(x=>x==='permission requested').length,1);
 gate.resolve(h.media);
 await Promise.all([p1,p2]);
 assert.equal(h.peers.length,1);
 assert.equal(h.events.filter(x=>x==='send:answer:caller').length,1);
});

test('Failed caller-pair subscription never routes an answer to the old conversation',async()=>{
 const h=setup({channelFailure:true});
 await h.acceptIncomingCall();
 assert.ok(h.events.includes('channel:caller'));
 assert.ok(!h.events.some(x=>x.startsWith('send:answer')));
 assert.ok(!h.events.includes('permission requested'));
 assert.ok(h.events.some(x=>x.startsWith('error:')));
 assert.equal(h.state().callAccepting,false);
});

test('Messages navigation must not replace a pair channel during active acceptance',()=>{
 assert.match(viewCode,/!peerConnection && !callDialing && !callAccepting && !pendingOffer/);
 assert.match(acceptCode,/await ensureCallChannel\(callerId\)/);
 assert.match(acceptCode,/requestedStream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
});
