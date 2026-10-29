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

function incoming(){
 const c=clock(),missed=[],media=[],ui=[];
 let listener;
 const window={CommunicationEngine:{
   startLoop(name){media.push('start:'+name)},
   stopAll(){media.push('stop')},
   play(name){media.push('play:'+name)}
 }};
 const incomingCall={
   classList:{add(name){ui.push('hide:'+name)},remove(name){ui.push('show:'+name)}},
   setAttribute(name,value){ui.push(name+':'+value)}
 };
 const context={
  setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,
  window,incomingCall,incomingAvatar:{},incomingName:{},incomingType:{},
  session:{user:{id:'recipient'}},members:[{id:'caller',display_name:'Caller'}],
  setAvatarElement(){},startCallDuration(){},updateCallStatus(){},
  recordMissedCall:async (...args)=>missed.push(args),
  callChannel:{on(_type,_event,handler){listener=handler}},
  callStatus:{},callHeaderStatus:{},
 };
 const code=`(() => {
    let pendingOffer=null;
    let incomingCallTimer=null;
    let outgoingCallTimer=null;
    let activeCallAnswered=false;
    let callPartnerId='caller';
    let activeCallType='audio';
    let callStartedAt=0;
    let peerConnection=null;
    ${incomingCode}
    return {
      state:()=>({pendingOffer,incomingCallTimer,activeCallAnswered}),
      setPeer:p=>{peerConnection=p},
    };
  })()`;
 const access=vm.runInNewContext(code,context,{timeout:2000});
 return {access,send:async payload=>listener({payload}),clock:c,missed,media,ui};
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
  recordMissedCall:async (...args)=>missed.push(args),
  setSendStatus:(message)=>errors.push(message)
 };
 const code=`(() => {
   let activeMemberId='caller',callPartnerId='caller',peerConnection=null,
       localStream=null,activeCallAnswered=false,outgoingCallTimer=null,callStartedAt=0;
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
  recordMissedCall:async(id,type)=>events.push('missed:'+id+':'+type)
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
