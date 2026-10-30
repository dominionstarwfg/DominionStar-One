import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/direct-messages.js',import.meta.url),'utf8');
const extract=(begin,end)=>{
 const start=source.indexOf(begin);
 assert.ok(start>=0,'Expected runtime block: '+begin);
 const stop=source.indexOf(end,start+begin.length);
 assert.ok(stop>start,'Expected runtime boundary: '+end);
 return source.slice(start,stop);
};
const incomingHelpers=extract('  const showIncomingCallOffer = payload => {','  const ensureCallChannel = async otherId => {');
const incomingCode=extract("    callChannel.on('broadcast', {event:'call-signal'}, async ({payload}) => {","    await callChannel.subscribe();");
const startCallCode=extract('  const startCall = async callType => {','  const acceptIncomingCall = async () => {');
const declineCode=extract("  declineCall?.addEventListener('click', async () => {","  endCall?.addEventListener('click', () => endActiveCall(true));");

function clock(){
 const timers=[];
 return {
  timers,
  setTimeout(callback){const t={callback,cancelled:false};timers.push(t);return timers.length;},
  clearTimeout(id){if(timers[id-1])timers[id-1].cancelled=true;},
  fire(index){return timers[index].callback();}
 };
}

function incoming({status='approved',agentCode='DS123',denied=false,lookupFailure=false}={}){
 const c=clock(),missed=[],media=[],ui=[],channels=[];
 let listener;
 const inboxHandlers=new Map();
 const window={CommunicationEngine:{
   startLoop(name){media.push('start:'+name)},
   stopAll(){media.push('stop')},
   play(name){media.push('play:'+name)}
 }};
 const incomingCall={
   classList:{add(name){ui.push('hide:'+name)},remove(name){ui.push('show:'+name)}},
   setAttribute(name,value){ui.push(name+':'+value)}
 };
 const client={
   from(name){
     assert.equal(name,'member_profiles');
     return {select(columns){
       assert.equal(columns,'verification_status,agent_code');
       return {eq(column,value){
         assert.equal(column,'id');assert.equal(value,'recipient');
         return {async maybeSingle(){
           if(lookupFailure)throw Error('network unavailable');
           return denied ? {data:null,error:{message:'RLS denied'}} :
             {data:{verification_status:status,agent_code:agentCode},error:null};
         }};
       }};
     }};
   },
   channel(name,config){
   channels.push({name,config});
   return {on(_type,{event},handler){inboxHandlers.set(event,handler);return this},subscribe(){return this}};
 }};
 const context={
  setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,
  window,client,incomingCall,incomingAvatar:{},incomingName:{},incomingType:{},
  session:{user:{id:'recipient'}},members:[{id:'caller',display_name:'Caller'},{id:'another',display_name:'Another agent'}],
  setAvatarElement(){},startCallDuration(){},updateCallStatus(){},
  recordCallOutcome:async (...args)=>missed.push(args),
  callChannel:{on(_type,_event,handler){listener=handler}},
  callStatus:{},callHeaderStatus:{},
 };
 const code=`(() => {
    let pendingOffer=null;
    let incomingCallTimer=null;
    let outgoingCallTimer=null;
    let incomingCallInboxChannel=null;
    let activeCallAnswered=false;
    let callPartnerId='caller';
    let activeCallType='audio';
    let callStartedAt=0;
    let activeCallRecordId='';
    let peerConnection=null;
    const callInboxName=id=>'inbox:'+id;
    const callChannelConfig=()=>({config:{private:true}});
    ${incomingHelpers}
    ${incomingCode}
    return {
      state:()=>({pendingOffer,incomingCallTimer,activeCallAnswered}),
      setPeer:p=>{peerConnection=p},
      subscribeIncomingCallInbox,
    };
  })()`;
 const access=vm.runInNewContext(code,context,{timeout:2000});
 return {access,send:async payload=>listener({payload}),
   inbox:async(event,payload)=>inboxHandlers.get(event)({payload}),
   channels,clock:c,missed,media,ui};
}

test('Incoming offer timeout clears the invitation without pretending it was answered',async()=>{
 const h=incoming(),offer={from:'caller',to:'recipient',type:'offer',callType:'video'};
 await h.send(offer);
 assert.equal(h.access.state().pendingOffer,offer);
 assert.equal(h.clock.timers.length,1);
 await h.clock.fire(0);
 assert.equal(h.access.state().pendingOffer,null);
 assert.equal(h.access.state().activeCallAnswered,false);
 assert.equal(h.access.state().incomingCallTimer,null);
 assert.equal(h.missed.length,1);
 assert.equal(h.missed[0][2],'incoming');
 assert.ok(h.media.includes('stop'));
 assert.ok(h.ui.includes('aria-hidden:true'));
});

test('An expired offer timer cannot dismiss a newer incoming offer',async()=>{
 const h=incoming();
 const first={from:'caller',to:'recipient',type:'offer',description:{sdp:'first'}};
 const second={from:'caller',to:'recipient',type:'offer',description:{sdp:'second'}};
 await h.send(first);
 await h.send(second);
 await h.clock.fire(0); // deliberately fire stale callback despite cancellation
 assert.equal(h.access.state().pendingOffer,second);
 assert.equal(h.missed.length,0);
 await h.clock.fire(1);
 assert.equal(h.missed.length,1);
 assert.equal(h.access.state().pendingOffer,null);
});

test('Answered calls cancel the incoming timeout before it can report a missed call',async()=>{
 const h=incoming();
 const offer={from:'caller',to:'recipient',type:'offer'};
 await h.send(offer);
 h.access.setPeer({async setRemoteDescription(){}});
 await h.send({from:'caller',to:'recipient',type:'answer',description:{sdp:'accepted'}});
 assert.equal(h.access.state().activeCallAnswered,true);
 assert.equal(h.clock.timers[0].cancelled,true);
 await h.clock.fire(0);
 assert.equal(h.missed.length,0);
});

test('Outgoing call timeout belongs to the original connection, not a rapid redial',async()=>{
 const c=clock(),missed=[],signals=[],errors=[],peers=[];
 const context={
  setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,
  members:[{id:'caller'}],window:{CommunicationEngine:{startLoop(){}}},
  navigator:{mediaDevices:{async getUserMedia(){return {getTracks(){return []}}}}},
  localVideo:{},
  ensureCallChannel:async()=>{},
  createPeerConnection:()=>{
   const peer={addTrack(){},async createOffer(){return {type:'offer'}},async setLocalDescription(){}};
   peers.push(peer);return peer;
  },
  showCallOverlay(){},
  sendCallSignal:async signal=>{signals.push(signal)},
  startTrustedCallRecord:async()=>'',recordCallOutcome:async (...args)=>missed.push(args),
  setSendStatus:(message)=>errors.push(message)
 };
 const code=`(() => {
   let activeMemberId='caller',callPartnerId='caller',peerConnection=null,
       localStream=null,callDialing=false,activeCallAnswered=false,outgoingCallTimer=null,callStartedAt=0,
       activeCallRecordId='';
   const endActiveCall=async()=>{peerConnection=null};
   ${startCallCode}
   return {startCall,redial:()=>{peerConnection=null;outgoingCallTimer=null},
     peer:()=>peerConnection};
 })()`;
 const h=vm.runInNewContext(code,context,{timeout:2000});
 await h.startCall('audio');
 assert.equal(c.timers.length,1);
 await h.startCall('audio');
 assert.equal(c.timers.length,1,'Second click must not replace a live call');
 assert.ok(errors.some(x=>x.includes('End the current call')));
 h.redial();
 await h.startCall('audio');
 assert.equal(c.timers.length,2);
 await c.fire(0);
 assert.equal(missed.length,0);
 assert.equal(h.peer(),peers[1]);
 await c.fire(1);
 assert.equal(missed.length,1);
 assert.equal(h.peer(),null);
 assert.equal(signals.filter(s=>s.type==='hangup').length,1);
});

test('Declining an incoming call switches from another conversation channel first',async()=>{
 const c=clock(),events=[],ui=[];
 let handler;
 const context={
  clearTimeout:c.clearTimeout,
  window:{CommunicationEngine:{stopAll(){events.push('stop')}}},
  incomingCall:{
   classList:{add(name){ui.push(name)}},
   setAttribute(name,value){ui.push(name+':'+value)}
  },
  declineCall:{addEventListener(_event,fn){handler=fn}},
  recordCallOutcome:async(id,type)=>events.push('missed:'+id+':'+type)
 };
 const code=`(() => {
   let pendingOffer={from:'new-caller',callType:'video'};
   let callPartnerId='other-agent',incomingCallTimer=1;
   const ensureCallChannel=async(id)=>{
     if(callPartnerId===id){events.push('wrong-reuse');return;}
     events.push('switch:'+id);
     callPartnerId=id;
   };
   const sendCallSignal=async(signal)=>events.push('signal:'+signal.type+':'+callPartnerId);
   ${declineCode}
   return {state:()=>({pendingOffer,callPartnerId,incomingCallTimer})};
 })()`;
 const state=vm.runInNewContext(code,{...context,events},{timeout:2000});
 await handler();
 assert.deepEqual(events.slice(0,3),['switch:new-caller','signal:decline:new-caller','missed:new-caller:video']);
 assert.equal(state.state().pendingOffer,null);
 assert.equal(state.state().incomingCallTimer,null);
 assert.ok(ui.includes('aria-hidden:true'));
});

test('Messages page inbox receives a call from an agent outside the selected conversation',async()=>{
 const h=incoming();
 await h.access.subscribeIncomingCallInbox();
 assert.equal(h.channels.length,1);
 assert.equal(h.channels[0].name,'inbox:recipient');
 assert.equal(h.channels[0].config.config.private,true);
 const offer={type:'offer',from:'another',to:'recipient',callType:'video',description:{sdp:'other-agent-offer'}};
 await h.inbox('incoming-call',offer);
 assert.equal(h.access.state().pendingOffer,offer);
 assert.equal(h.clock.timers.length,1);
 assert.ok(h.ui.includes('aria-hidden:false'));
});

test('Pair and inbox duplicate offers do not create duplicate ringing timers',async()=>{
 const h=incoming();
 await h.access.subscribeIncomingCallInbox();
 const offer={type:'offer',from:'caller',to:'recipient',callType:'audio',description:{sdp:'same-offer'}};
 await h.send(offer);
 await h.inbox('incoming-call',{...offer});
 assert.equal(h.clock.timers.length,1);
 assert.equal(h.media.filter(x=>x==='start:incoming_ring').length,1);
});

test('Wrong recipient and self-call notifications are ignored on Messages',async()=>{
 const h=incoming();
 await h.access.subscribeIncomingCallInbox();
 await h.inbox('incoming-call',{type:'offer',from:'another',to:'someone-else'});
 await h.inbox('incoming-call',{type:'offer',from:'recipient',to:'recipient'});
 assert.equal(h.access.state().pendingOffer,null);
 assert.equal(h.clock.timers.length,0);
});

test('Caller cancellation clears a pending inbox offer and its ringtone',async()=>{
 const h=incoming();
 await h.access.subscribeIncomingCallInbox();
 await h.inbox('incoming-call',{type:'offer',from:'another',to:'recipient'});
 assert.ok(h.access.state().pendingOffer);
 await h.inbox('call-cancelled',{type:'hangup',from:'another',to:'recipient'});
 assert.equal(h.access.state().pendingOffer,null);
 assert.equal(h.clock.timers[0].cancelled,true);
 assert.ok(h.ui.includes('aria-hidden:true'));
 assert.ok(h.media.includes('stop'));
 assert.equal(h.missed.length,0);
});

test('Messages inbox ignores additional invitations while another call is active',async()=>{
 const h=incoming();
 await h.access.subscribeIncomingCallInbox();
 h.access.setPeer({});
 await h.inbox('incoming-call',{type:'offer',from:'another',to:'recipient'});
 assert.equal(h.access.state().pendingOffer,null);
 assert.equal(h.clock.timers.length,0);
});

test('Accepting a call from another agent switches to their conversation before answering',()=>{
 const block=extract('  const acceptIncomingCall = async () => {','  const endActiveCall = async notify => {');
 assert.match(block,/if \(activeMemberId !== callerId\) await openConversation\(callerId\)/);
 assert.match(block,/if \(pendingOffer !== acceptedOffer\) return/);
 assert.match(block,/setRemoteDescription\(acceptedOffer\.description\)/);
 assert.match(source,/await subscribeIncomingCallInbox\(\);\n\n  const pendingGlobalCallRaw/);
 assert.match(source,/if \(incomingCallInboxChannel\) client\.removeChannel\(incomingCallInboxChannel\)/);
});

test('An unrelated caller cannot overwrite an existing ringing invitation',async()=>{
 const h=incoming();
 await h.access.subscribeIncomingCallInbox();
 const first={type:'offer',from:'caller',to:'recipient',description:{sdp:'caller-one'}};
 await h.inbox('incoming-call',first);
 await h.inbox('incoming-call',{type:'offer',from:'another',to:'recipient',description:{sdp:'caller-two'}});
 assert.equal(h.access.state().pendingOffer,first);
 assert.equal(h.clock.timers.length,1);
});

test('Unrelated cancellation cannot dismiss a different caller invitation',async()=>{
 const h=incoming();
 await h.access.subscribeIncomingCallInbox();
 const first={type:'offer',from:'caller',to:'recipient',description:{sdp:'caller-one'}};
 await h.inbox('incoming-call',first);
 await h.inbox('call-cancelled',{type:'hangup',from:'another',to:'recipient'});
 assert.equal(h.access.state().pendingOffer,first);
 assert.equal(h.clock.timers[0].cancelled,false);
});

test('Unapproved or unverified Messages users cannot subscribe to incoming agent calls',async()=>{
 for(const options of [
   {status:'pending'}, {status:'revoked'}, {status:'rejected'},
   {agentCode:'   '}, {denied:true}, {lookupFailure:true}
 ]){
   const h=incoming(options);
   const channel=await h.access.subscribeIncomingCallInbox();
   assert.equal(channel,null);
   assert.equal(h.channels.length,0);
 }
});
