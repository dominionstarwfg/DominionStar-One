import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/global-call-manager.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
const profile={id:'caller',full_name:'Authorized Caller',preferred_name:'Caller',avatar_path:''};
const offer=(sdp='offer-one',from='caller')=>({
  type:'offer',from,to:'recipient',callType:'audio',description:{sdp}
});

async function harness({profileWait,engineWait,signalWait}={}){
 const log={rings:[],notifications:[],timers:[],channels:[],storage:new Map()};
 const nodes={};
 const element=id=>{
   const el={
     id,textContent:'',
     setAttribute(name,value){log.rings.push(this.id+':'+name+':'+value)},
     addEventListener(event,fn){this.handlers??={};this.handlers[event]=fn},
     set innerHTML(value){this._html=value},get innerHTML(){return this._html}
   };
   el.classList={
     add(token){log.rings.push('show:'+el.id+':'+token)},
     remove(token){log.rings.push('hide:'+el.id+':'+token)}
   };
   return el;
 };
 for(const id of ['dsGlobalAcceptCall','dsGlobalDeclineCall','dsGlobalCallerAvatar',
  'dsGlobalCallerName','dsGlobalCallType'])nodes[id]=element(id);
 const doc={
  readyState:'complete',getElementById(id){return nodes[id]||null},
  createElement(){return element('new')},
  head:{appendChild(){}},body:{appendChild(el){nodes[el.id]=el}},
  addEventListener(){}
 };
 const channel={
  handlers:new Map(),
  on(_type,{event},fn){this.handlers.set(event,fn);return this},
  subscribe(){return this},
  async send({payload}){log.rings.push('signal:'+payload.type);if(signalWait)await signalWait.promise;return 'ok'}
 };
 const client={
  auth:{getSession:async()=>({data:{session:{user:{id:'recipient'}}}})},
  from(name){
   assert.equal(name,'member_profiles');
   return {select(columns){return{eq(key,value){return{
     async maybeSingle(){
       if(columns==='verification_status,agent_code'){
         assert.equal(value,'recipient');
         return{data:{verification_status:'approved',agent_code:'DS123'},error:null};
       }
       assert.equal(value,'caller');
       if(profileWait)await profileWait.promise;
       return {data:{...profile},error:null};
     }
   }}}}};
  },
  channel(name,config){log.channels.push({name,config});return channel},
  removeChannel(){}
 };
 let engineInitCount=0;
 const engine={
  async init(){engineInitCount++;if(engineWait && engineInitCount>1)await engineWait.promise},
  stopAll(){log.rings.push('stopAudio')},
  startLoop(name){log.rings.push('startAudio:'+name)},
  play(name){log.rings.push('playAudio:'+name)},
  browserNotify(data){log.notifications.push(data)}
 };
 const window={DSAuth:{ready:true,async init(){return client}},
  CommunicationEngine:engine,DOMINIONSTAR_CALL_PRIVATE_V2:false,
  addEventListener(){}};
 const storage={setItem(key,value){log.storage.set(key,value)},getItem(key){return log.storage.get(key)||null},
  removeItem(key){log.storage.delete(key)}};
 const context={window,document:doc,sessionStorage:storage,
  location:{pathname:'/member-dashboard/',href:'unchanged'},
  setTimeout(callback){log.timers.push({callback,cancelled:false});return log.timers.length},
  clearTimeout(id){if(log.timers[id-1])log.timers[id-1].cancelled=true},
  console};
 vm.runInNewContext(source,context,{timeout:2000});
 for(let i=0;i<5;i++)await tick();
 assert.ok(channel.handlers.has('incoming-call'),'Authenticated inbox must be subscribed');
 return {
  log,nodes,context,manager:window.DominionStarGlobalCallManager,
  emit:(event,payload)=>channel.handlers.get(event)({payload}),
  fire:(index)=>log.timers[index].callback()
 };
}

test('Cancelled invitation cannot reappear after caller profile resolves',async()=>{
 const profileWait=defer(),h=await harness({profileWait});
 const incoming=h.emit('incoming-call',offer());
 await tick();
 assert.equal(h.log.timers.length,1,'Timer starts before profile lookup');
 await h.emit('call-cancelled',{type:'hangup',from:'caller',to:'recipient'});
 assert.equal(h.log.storage.size,0);
 profileWait.resolve();
 await incoming;
 assert.ok(!h.log.rings.includes('show:dsGlobalIncomingCall:visible'));
 assert.equal(h.log.notifications.length,0);
 assert.ok(!h.log.rings.includes('startAudio:incoming_ring'));
 assert.equal(h.log.timers[0].cancelled,true);
});

test('Cancelled invitation cannot restart ringtone while engine initializes',async()=>{
 const engineWait=defer(),h=await harness({engineWait});
 const incoming=h.emit('incoming-call',offer());
 await tick();
 assert.ok(h.log.rings.includes('show:dsGlobalIncomingCall:visible'));
 await h.emit('call-cancelled',{type:'hangup',from:'caller',to:'recipient'});
 engineWait.resolve();
 await incoming;
 assert.equal(h.log.notifications.length,0);
 assert.ok(!h.log.rings.includes('startAudio:incoming_ring'));
 assert.ok(h.log.rings.includes('dsGlobalIncomingCall:aria-hidden:true'));
});

test('Stale timeout cannot dismiss a newer invitation',async()=>{
 const h=await harness();
 await h.emit('incoming-call',offer('sdp-1'));
 await h.emit('incoming-call',offer('sdp-2'));
 assert.equal(h.log.timers.length,2);
 await h.fire(0);
 assert.equal(h.log.storage.size,1);
 assert.ok(h.log.rings.includes('show:dsGlobalIncomingCall:visible'));
 await h.fire(1);
 assert.equal(h.log.storage.size,0);
 assert.ok(h.log.rings.includes('dsGlobalIncomingCall:aria-hidden:true'));
 assert.equal(h.log.rings.filter(x=>x==='signal:hangup').length,1);
});

test('Wrong caller and malformed call offers cannot displace a ringing invitation',async()=>{
 const h=await harness();
 await h.emit('incoming-call',offer());
 await h.emit('incoming-call',offer('impostor','unrelated'));
 await h.emit('incoming-call',{type:'offer',from:'caller',to:'recipient'});
 await h.emit('incoming-call',{type:'offer',from:'recipient',to:'recipient',description:{sdp:'fake'}});
 await h.emit('incoming-call',offer());
 assert.equal(h.log.timers.length,1);
 assert.equal(h.log.notifications.length,1);
 assert.equal(h.log.storage.size,1);
});

test('Decline hides the overlay immediately even if signaling has not returned',async()=>{
 const signalWait=defer(),h=await harness({signalWait});
 await h.emit('incoming-call',offer());
 const decline=h.manager.decline();
 await tick();
 assert.equal(h.log.storage.size,0);
 assert.ok(h.log.rings.includes('dsGlobalIncomingCall:aria-hidden:true'));
 signalWait.resolve();
 await decline;
 assert.ok(h.log.rings.includes('signal:decline'));
});

test('Accept forwards only the currently active invitation and cancels its timer',async()=>{
 const h=await harness();
 await h.emit('incoming-call',offer());
 await h.manager.accept();
 assert.match(h.context.location.href,/^\/direct-messages\/\?member=caller&incoming=1$/);
 const stored=JSON.parse(h.log.storage.get('ds_pending_global_call'));
 assert.equal(stored.acceptedFromGlobal,true);
 assert.equal(stored.description.sdp,'offer-one');
 assert.equal(h.log.timers[0].cancelled,true);
 assert.ok(h.log.rings.includes('stopAudio'));
});

test('Caller cancellation from an unrelated sender or recipient cannot dismiss active invitation',async()=>{
 const h=await harness();
 await h.emit('incoming-call',offer());
 await h.emit('call-cancelled',{from:'unrelated',to:'recipient'});
 await h.emit('call-cancelled',{from:'caller',to:'unrelated'});
 assert.equal(h.log.storage.size,1);
 assert.equal(h.log.timers[0].cancelled,false);
});
