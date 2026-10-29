import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const messages=readFileSync(new URL('../assets/js/direct-messages.js',import.meta.url),'utf8');
const global=readFileSync(new URL('../assets/js/global-call-manager.js',import.meta.url),'utf8');
const start=messages.indexOf("  const pendingGlobalCallRaw = sessionStorage.getItem('ds_pending_global_call');");
const end=messages.indexOf("\n  const initial = new URLSearchParams",start);
assert.ok(start>=0&&end>start,'Expected Messages-page incoming-call handoff block');
const block=messages.slice(start,end);
const now=Date.now();
const callerOffer={
 type:'offer',from:'caller',to:'recipient',callType:'audio',
 description:{type:'offer',sdp:'v=0\r\nmock-offer'},
 acceptedFromGlobal:true,acceptedAt:now
};

async function restore(value){
 let stored=value===undefined?null:(typeof value==='string'?value:JSON.stringify(value));
 const events=[];
 const context={
  sessionStorage:{
   getItem(key){assert.equal(key,'ds_pending_global_call');return stored},
   removeItem(key){assert.equal(key,'ds_pending_global_call');stored=null;events.push('removed')}
  },
  session:{user:{id:'recipient'}},
  incomingCall:{classList:{add(){events.push('hidden')}},setAttribute(){}},
  openConversation:async id=>events.push('opened:'+id),
  acceptIncomingCall:async()=>events.push('answered'),
  console:{warn(){}}
 };
 const code='(async()=>{let pendingOffer=null;'+block+';return {pendingOffer};})()';
 const result=await vm.runInNewContext(code,context,{timeout:2000});
 return {events,result,stored};
}

test('Only a fresh, deliberately accepted and well-formed offer can start the call handoff',async()=>{
 const x=await restore(callerOffer);
 assert.deepEqual(x.events,['removed','opened:caller','hidden','answered']);
 assert.equal(x.result.pendingOffer?.from,'caller');
 assert.equal(x.stored,null);
});

test('A merely ringing invitation is never answered on navigation',async()=>{
 const x=await restore({...callerOffer,acceptedFromGlobal:undefined});
 assert.deepEqual(x.events,['removed']);
 assert.equal(x.result.pendingOffer,null);
});

test('Expired, future-dated or missing accept times cannot auto-answer',async()=>{
 for(const acceptedAt of [now-61000,now+60000,undefined,null,NaN]){
  const x=await restore({...callerOffer,acceptedAt});
  assert.deepEqual(x.events,['removed']);
  assert.equal(x.result.pendingOffer,null);
 }
});

test('Malformed or misdirected caller descriptions cannot auto-answer',async()=>{
 for(const patch of [
  {to:'unrelated'},{from:'recipient'},{from:''},{type:'hangup'},
  {description:{type:'answer',sdp:'sdp'}},{description:{type:'offer',sdp:''}},
  {description:null},{acceptedFromGlobal:false}
 ]){
  const x=await restore({...callerOffer,...patch});
  assert.deepEqual(x.events,['removed']);
  assert.equal(x.result.pendingOffer,null);
 }
});

test('Malformed persisted JSON is deleted without auto-answer',async()=>{
 const x=await restore('{not JSON');
 assert.deepEqual(x.events,['removed']);
 assert.equal(x.result.pendingOffer,null);
});

test('The global inbox only stores the cross-page offer after the Accept click',()=>{
 const render=global.slice(global.indexOf('  const renderIncoming = async payload => {'),
   global.indexOf('  const sendPairSignal = async',global.indexOf('  const renderIncoming = async payload => {')));
 const accept=global.slice(global.indexOf('  async function accept() {'),global.indexOf('  async function decline() {'));
 assert.doesNotMatch(render,/sessionStorage\.setItem/);
 assert.match(accept,/acceptedFromGlobal:true, acceptedAt:Date\.now\(\)/);
 assert.match(block,/pendingGlobalCall\?\.acceptedFromGlobal === true/);
 assert.match(block,/handoffAge >= 0 && handoffAge <= 60000/);
});
