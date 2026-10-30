import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/direct-messages.js',import.meta.url),'utf8');
const take=(start,end)=>{
 const a=source.indexOf(start);
 assert.ok(a>=0,'Missing source block: '+start);
 const b=source.indexOf(end,a+start.length);
 assert.ok(b>a,'Missing source end: '+end);
 return source.slice(a,b);
};
const viewBlock=take('  async function openConversation(memberId) {',"\n  select.addEventListener('change'");
const endBlock=take('  const endActiveCall = async notify => {','  const startScreenShare = async () => {');
const startBlock=take('  const startCall = async callType => {','  const acceptIncomingCall = async () => {');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}};

function setup({active=false,dialing=false,ringing=false,mediaWait=null}={}){
 const events=[];
 const hidden={classList:{add(){},remove(){}},setAttribute(){}};
 const context={
  window:{CommunicationEngine:{
   setActiveConversation(id){events.push('active:'+id)},
   stopAll(){},play(){},startLoop(){}
  }},
  select:{value:'caller'},members:[{id:'caller'},{id:'other'}],
  updateActiveHeader(){},renderMembers(){},app:{classList:{add(){}}},
  loadConversation:async()=>{},textarea:{focus(){}},
  history:{replaceState(){}},ensureTypingChannel:async id=>events.push('typing:'+id),
  updatePresenceDisplays(){},
  ensureCallChannel:async id=>{events.push('call-channel:'+id)},
  search:{value:''},
  localVideo:{},remoteVideo:{},
  callOverlay:hidden,incomingCall:hidden,activeCallBar:hidden,toggleMute:hidden,toggleCamera:hidden,
  setSendStatus(message){events.push('error:'+message)},
  navigator:{mediaDevices:{getUserMedia:async()=>
   mediaWait ? mediaWait.promise : {getTracks(){return []}}}},
  createPeerConnection:()=>({addTrack(){},createOffer:async()=>({type:'offer',sdp:'sample'}),
   setLocalDescription:async()=>{},close(){}}),
  showCallOverlay(){},sendCallSignal:async()=>events.push('sent-to:'+state().callPartnerId),
  startTrustedCallRecord:async()=>'',finishTrustedCallRecord:async()=>null,
  recordCallOutcome:async()=>{},clearInterval(){},clearTimeout(){},
  setTimeout(){return 1},
  stopScreenShare:async()=>{},
  console:{warn(){}}
 };
 let state=()=>({});
 const code='(()=>{'+
   "let activeMemberId='caller',callPartnerId='caller',callAccepting=false,callDialing="+dialing+","+
   'peerConnection='+(active?"{close(){}}":"null")+
   ',pendingOffer='+(ringing?"{from:'caller'}":"null")+
   ',localStream=null,activeCallAnswered=false,outgoingCallTimer=null,'+
   "incomingCallTimer=null,callDurationTimer=null,callStartedAt=0,callMinimized=false,activeCallRecordId='';"+
   "let globalOutgoingCallChannel=null,activeCallType='audio';"+
   viewBlock+endBlock+startBlock+
   "return {view:openConversation,end:endActiveCall,start:startCall,"+
   "setCall:(value)=>{peerConnection=value},"+
   "setDialing:(value)=>{callDialing=value},"+
   "setRinging:(value)=>{pendingOffer=value},"+
   "state:()=>({activeMemberId,callPartnerId,callDialing,peerConnection})};"+
   '})()';
 const x=vm.runInNewContext(code,context,{timeout:2500});
 state=x.state;
 return {...x,events};
}

test('Switching chats during a connected call does not replace its signal channel',async()=>{
 const h=setup({active:true});
 await h.view('other');
 assert.equal(h.state().activeMemberId,'other');
 assert.equal(h.state().callPartnerId,'caller');
 assert.deepEqual(h.events,['active:other','typing:other']);
});

test('Switching chats while an incoming invitation rings preserves its call channel',async()=>{
 const h=setup({ringing:true});
 await h.view('other');
 assert.equal(h.state().callPartnerId,'caller');
 assert.ok(!h.events.some(x=>x.startsWith('call-channel:')));
});

test('Switching chats while permission prompt is pending cannot reroute outgoing call',async()=>{
 const gate=deferred(),h=setup({mediaWait:gate});
 const starting=h.start('audio');
 for(let i=0;i<3;i++)await tick();
 assert.equal(h.state().callDialing,true);
 await h.view('other');
 assert.equal(h.state().callPartnerId,'caller');
 assert.ok(!h.events.includes('call-channel:other'));
 gate.resolve({getTracks(){return []}});
 await starting;
 assert.equal(h.state().callDialing,false);
 assert.ok(h.events.includes('sent-to:caller'));
});

test('After ending a call, the selected chat regains its own signal subscription',async()=>{
 const h=setup({active:true});
 await h.view('other');
 await h.end(false);
 assert.equal(h.state().peerConnection,null);
 assert.ok(h.events.includes('call-channel:other'));
});

test('Changing chat while idle still updates its call channel normally',async()=>{
 const h=setup();
 await h.view('other');
 assert.ok(h.events.includes('call-channel:other'));
 assert.ok(h.events.includes('typing:other'));
});

test('The view guard covers active media, pending permissions and incoming invitations',()=>{
 assert.match(viewBlock,/!peerConnection && !callDialing && !callAccepting && !pendingOffer/);
 assert.match(startBlock,/const dialedMember = activeMemberId/);
 assert.match(startBlock,/await ensureCallChannel\(dialedMember\)/);
 assert.match(startBlock,/callDialing = false/);
 assert.match(endBlock,/await ensureCallChannel\(activeMemberId\)/);
});
