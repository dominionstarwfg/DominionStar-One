import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/global-call-manager.js',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../assets/js/member-dashboard.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

async function launch({route='/member-dashboard/',status='approved',code='DS123',error=null,throwLookup=false,session=true,clientAvailable=true,sessionFailure=false}={}){
  const events={initialized:0,subscriptions:0,lookup:0,ui:0,authInit:0,channelNames:[]};
  const nodes={
    dsGlobalAcceptCall:{addEventListener(){}},
    dsGlobalDeclineCall:{addEventListener(){}}
  };
  const doc={
    readyState:'complete',
    getElementById(id){return nodes[id]||null},
    createElement(tag){return {tagName:tag,setAttribute(){},set innerHTML(v){this._html=v}};},
    head:{appendChild(){events.ui++}},
    body:{appendChild(node){events.ui++;nodes[node.id]=node;}},
    addEventListener(){}
  };
  const channel={
    on(){return this},
    subscribe(){events.subscriptions++;return this}
  };
  const client={
    auth:{getSession:async()=>{if(sessionFailure)throw Error('auth unavailable');return{data:{session:session?{user:{id:'agent-1'}}:null}};}},
    from(table){
      assert.equal(table,'member_profiles');
      return{
        select(columns){
          assert.equal(columns,'verification_status,agent_code');
          return{
            eq(name,value){
              assert.equal(name,'id');assert.equal(value,'agent-1');
              return{
                async maybeSingle(){
                  events.lookup++;
                  if(throwLookup)throw Error('network unavailable');
                  return {data:error?null:{verification_status:status,agent_code:code},error};
                }
              };
            }
          };
        }
      };
    },
    channel(name){events.channelNames.push(name);return channel;},
    removeChannel(){}
  };
  const window={
    DSAuth:{ready:true,async init(){events.authInit++;return clientAvailable?client:null}},
    CommunicationEngine:{async init(){events.initialized++},stopAll(){}},
    addEventListener(){}
  };
  const context={
    window,document:doc,location:{pathname:route},setTimeout(){},
    sessionStorage:{setItem(){},removeItem(){}},
    console
  };
  vm.runInNewContext(source,context,{timeout:2000});
  for(let i=0;i<5;i++)await flush();
  return events;
}
test('Approved agent with Agent Code subscribes to exactly one incoming web-call channel',async()=>{
  const e=await launch();
  assert.equal(e.lookup,1);
  assert.equal(e.subscriptions,1);
  assert.equal(e.initialized,1);
  assert.deepEqual(e.channelNames,['dominionstar-user-call-agent-1']);
});
test('Pending and revoked agents cannot subscribe or open call UI',async()=>{
  for(const status of ['pending','rejected','revoked','']){
    const e=await launch({status});
    assert.equal(e.subscriptions,0,status);
    assert.equal(e.initialized,0,status);
    assert.equal(e.ui,0,status);
  }
});
test('An approved profile without Agent Code cannot subscribe',async()=>{
  const e=await launch({code:'   '});
  assert.equal(e.subscriptions,0);
  assert.equal(e.initialized,0);
});
test('Profile lookup errors and outages deny call subscriptions',async()=>{
  for(const options of [{error:{message:'RLS denied'}},{throwLookup:true}]){
    const e=await launch(options);
    assert.equal(e.subscriptions,0);
    assert.equal(e.initialized,0);
    assert.equal(e.ui,0);
  }
});
test('Login and password-recovery pages never launch global web calling',async()=>{
  for(const route of ['/member-login/','/member-update-password/']){
    const e=await launch({route});
    assert.equal(e.authInit,0);
    assert.equal(e.lookup,0);
    assert.equal(e.subscriptions,0);
  }
});
test('The direct-messages route keeps ownership of its call controls',async()=>{
  const e=await launch({route:'/direct-messages/'});
  assert.equal(e.lookup,0);
  assert.equal(e.subscriptions,0);
});
test('Dashboard initializes its communications engine only for approved agents with Agent Codes',()=>{
  assert.match(dashboard,/if \(status === 'approved' && String\(profile\.agent_code \|\| ''\)\.trim\(\)\) \{/);
  assert.match(dashboard,/await window\.CommunicationEngine\?\.init/);
});

test('Unavailable auth client or session lookup fails closed without subscriptions',async()=>{
  for(const options of [{clientAvailable:false},{sessionFailure:true},{session:false}]){
    const e=await launch(options);
    assert.equal(e.lookup,0);
    assert.equal(e.subscriptions,0);
    assert.equal(e.initialized,0);
  }
});
