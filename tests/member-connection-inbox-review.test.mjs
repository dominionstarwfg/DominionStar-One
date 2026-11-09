import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/member-directory.js',import.meta.url),'utf8');
const self='10000000-0000-4000-8000-000000000001';
const peer='20000000-0000-4000-8000-000000000002';
const conn='30000000-0000-4000-8000-000000000003';
const member=(id,name='Approved Peer')=>({
  id,full_name:name,preferred_name:name.split(' ')[0],rank:'Associate',
  verification_status:'approved',avatar_path:null,city:'',state:''
});
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
const buttons=element=>[...element.innerHTML.matchAll(/<button\b([^>]*)>/g)].map(([,markup])=>{
  const attr=name=>(markup.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))||[])[1]||'';
  const btn={
    dataset:{
      id:attr('data-id'),action:attr('data-action'),
      connectionId:attr('data-connection-id'),
      connectionResponse:attr('data-connection-response')
    },
    disabled:/\sdisabled(?:\s|>|\b)/.test(markup),
    addEventListener(_kind,handler){this.click=handler;}
  };
  return btn;
});
const element=()=>({
  innerHTML:'',textContent:'',value:'',
  classList:{add(){},remove(){},toggle(){}},
  handlers:{},addEventListener(name,handler){this.handlers[name]=handler;},
  querySelectorAll(selector){
    if(selector==='.connect-member')return buttons(this).filter(b=>
      b.dataset.action);
    if(selector==='[data-connection-response]')return buttons(this).filter(b=>
      b.dataset.connectionResponse);
    return [];
  },
  scrollIntoView(){}
});

async function mount({flag=true,rows=[],hidden=false,failRead=false,failRpc=false}={}){
  const roster=[member(self,'Self Member'),...(hidden?[]:[member(peer)])];
  const state={rows:rows.map(x=>({...x})),rpcCalls:[],inserts:[],tables:[],failRead};
  const nodes=Object.fromEntries([
    'directoryGate','directoryApp','directoryGrid',
    'directorySearch','directoryRank','directoryConnectionPanel',
    'directoryInvitations','directoryConnectionStatus','directoryConnectionsRefresh'
  ].map(id=>[id,element()]));
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:self}}},error:null})},
    rpc:async(name,payload)=>{
      if(name==='community_set_presence')return {data:true,error:null};
      state.rpcCalls.push({name,payload});
      if(failRpc)return {data:null,error:{message:'RPC unavailable'}};
      const c=state.rows.find(x=>x.id===payload.target_connection_id);
      if(!c)return {data:false,error:null};
      if(name==='respond_my_member_connection'&&c.recipient_id===self&&c.status==='pending'){
        c.status=payload.target_status;return {data:true,error:null};
      }
      if(name==='cancel_my_member_connection'&&c.requester_id===self&&c.status==='pending'){
        state.rows=state.rows.filter(x=>x.id!==c.id);return {data:true,error:null};
      }
      return {data:false,error:null};
    },
    from(table){
      state.tables.push(table);
      return {
        select(){return this;},eq(){return this;},
        single:async()=>({data:{verification_status:'approved'},error:null}),
        order:async()=>({data:table==='member_public_profiles'?roster:[],error:null}),
        or:async()=>state.failRead?{data:null,error:{message:'SELECT denied'}}:
          {data:state.rows,error:null},
        insert:async payload=>{
          state.inserts.push(payload);
          state.rows.push({
            id:'30000000-0000-4000-8000-000000000099',
            ...payload,status:'pending'
          });
          return {error:null};
        }
      };
    }
  };
  const window={DSAuth:{ready:true,init:async()=>client},
    DOMINIONSTAR_AGENT_DATA_FEATURES:{publicMemberProfilesV2:flag}};
  vm.runInNewContext(source,{
    window,document:{getElementById:id=>nodes[id]||null},
    location:{href:''},Map,Set,Object,Promise,Date,Error,console,
    setTimeout(){/* Synthetic requests resolve before timeout. */}
  },{filename:'member-directory.js'});
  await flush();
  return {state,nodes,grid:()=>nodes.directoryGrid.innerHTML,
    requests:()=>nodes.directoryInvitations.innerHTML,
    cardButton:()=>nodes.directoryGrid.querySelectorAll('.connect-member')[0],
    requestButton:choice=>nodes.directoryInvitations
      .querySelectorAll('[data-connection-response]')
      .find(b=>b.dataset.connectionResponse===choice),
    refresh:async()=>{nodes.directoryConnectionsRefresh.handlers.click();await flush();}
  };
}

test('Directory feature stays fail-closed without the coordinated privacy release',async()=>{
  const h=await mount({flag:false});
  assert.match(h.nodes.directoryGate.innerHTML,/temporarily unavailable/);
  assert.ok(!h.state.tables.includes('member_public_profiles'));
  assert.ok(!h.state.tables.includes('member_connections'));
  assert.equal(h.state.rpcCalls.length,0);
});

test('Incoming invitation is visible with safe member identity and accepts by scoped RPC',async()=>{
  const h=await mount({rows:[{
    id:conn,requester_id:peer,recipient_id:self,status:'pending'
  }]});
  assert.match(h.requests(),/Approved|Peer/);
  assert.match(h.requests(),/Accept/);
  assert.match(h.requests(),/Decline/);
  assert.match(h.grid(),/Review request/);
  h.requestButton('accepted').click();
  await flush();
  assert.equal(h.state.rpcCalls.length,1);
  assert.equal(h.state.rpcCalls[0].name,'respond_my_member_connection');
  assert.equal(h.state.rpcCalls[0].payload.target_connection_id,conn);
  assert.equal(h.state.rpcCalls[0].payload.target_status,'accepted');
  assert.equal(h.state.rows[0].status,'accepted');
  assert.match(h.grid(),/Connected/);
  assert.doesNotMatch(h.requests(),/data-connection-response="accepted"/);
});

test('Outgoing pending invitation cancels only through scoped RPC and permits new request',async()=>{
  const h=await mount({rows:[{
    id:conn,requester_id:self,recipient_id:peer,status:'pending'
  }]});
  assert.match(h.grid(),/Cancel request/);
  const b=h.cardButton();
  assert.equal(b.dataset.action,'cancel');
  b.click();
  await flush();
  assert.equal(h.state.rpcCalls.length,1);
  assert.equal(h.state.rpcCalls[0].name,'cancel_my_member_connection');
  assert.equal(h.state.rows.length,0);
  assert.match(h.grid(),/>Connect<\/button>/);
  assert.equal(h.cardButton().dataset.action,'request');
  await h.cardButton().click();
  await flush();
  assert.equal(h.state.inserts.length,1);
  assert.equal(h.state.inserts[0].status,'pending');
  assert.equal(h.state.inserts[0].requester_id,self);
  assert.equal(h.state.inserts[0].recipient_id,peer);
  assert.match(h.grid(),/Cancel request/);
});

test('Denied connection SELECT blocks new requests rather than guessing connection state',async()=>{
  const h=await mount({failRead:true});
  assert.match(h.grid(),/Checking/);
  assert.match(h.nodes.directoryConnectionStatus.textContent,/could not be verified/);
  await h.cardButton().click();
  assert.equal(h.state.inserts.length,0);
  assert.equal(h.state.rpcCalls.length,0);
  h.state.failRead=false;
  await h.refresh();
  assert.match(h.grid(),/>Connect<\/button>/);
});

test('Denied accept preserves pending request, status and retry controls',async()=>{
  const h=await mount({failRpc:true,rows:[{
    id:conn,requester_id:peer,recipient_id:self,status:'pending'
  }]});
  h.requestButton('accepted').click();
  await flush();
  assert.equal(h.state.rows[0].status,'pending');
  assert.match(h.nodes.directoryConnectionStatus.textContent,/could not be completed/);
  assert.match(h.requests(),/Accept/);
  assert.equal(h.state.inserts.length,0);
});

test('Opted-out requester is not resolved through private profiles',async()=>{
  const h=await mount({hidden:true,rows:[{
    id:conn,requester_id:peer,recipient_id:self,status:'pending'
  }]});
  assert.match(h.requests(),/<strong>Member<\/strong>/);
  assert.ok(h.state.tables.filter(t=>t==='member_profiles').length===1,
    'Only the signed-in member approval status can read the private profile table');
  assert.ok(h.state.tables.includes('member_public_profiles'));
});

test('Member connections use scoped select/RPC and no browser UPDATE/DELETE',()=>{
  assert.match(source,/\.from\('member_connections'\)[\s\S]*?\.select\('id,requester_id,recipient_id,status,created_at'\)/);
  assert.match(source,/\.or\('requester_id\.eq\.'\+id\+',recipient_id\.eq\.'\+id\)/);
  assert.match(source,/rpc\('respond_my_member_connection'/);
  assert.match(source,/rpc\('cancel_my_member_connection'/);
  assert.doesNotMatch(source,/\.from\('member_connections'\)\.(?:update|delete)\(/);
  assert.doesNotMatch(source,/select\('.*agent_code/);
  assert.doesNotThrow(()=>new vm.Script(source));
});
