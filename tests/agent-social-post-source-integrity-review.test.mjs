import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sources={
  feed:read('assets/js/feed.js'),
  dashboard:read('assets/js/dashboard-social-preview.js')
};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function node(extra={}) {
  return {
    textContent:'',innerHTML:'',value:'',disabled:false,
    dataset:{},classList:{add(){},remove(){},toggle(){}},
    addEventListener(type,callback){this.handlers ||= {};this.handlers[type]=callback;},
    focus(){},...extra
  };
}
async function mount(kind,{insertError=null,refreshError=false,text='An actual network update'}={}) {
  const feed=kind==='feed';
  const names=feed?[
    'feedGate','feedApp','feedPageComposer','feedComposerBody',
    'feedComposerPublish','feedComposerStatus','feedPageStream','feedRefresh',
    'feedPageName','feedPageRank','feedPageInitials','feedPageAvatar',
    'feedPageFounding'
  ]:[
    'dashboardComposerForm','dashboardComposerBody','dashboardComposerPublish',
    'dashboardComposerStatus','dashboardSocialPreview',
    'dashboardComposerAvatar','dashboardComposerInitials'
  ];
  const elements=Object.fromEntries(names.map(id=>[id,node()]));
  const body=elements[feed?'feedComposerBody':'dashboardComposerBody'];
  const form=elements[feed?'feedPageComposer':'dashboardComposerForm'];
  const status=elements[feed?'feedComposerStatus':'dashboardComposerStatus'];
  const target=elements[feed?'feedPageStream':'dashboardSocialPreview'];
  const insertions=[];
  const rpcCalls=[];
  const client={
    auth:{getSession:async()=>({
      data:{session:{user:{id:'synthetic-approved',email:'member@example.test'}}},
      error:null
    })},
    rpc:async(name)=>{rpcCalls.push(name);return {error:{message:'Legacy mention RPC must never be called'}};},
    from(table){
      const q={
        select(){return this;},eq(){return this;},
        maybeSingle:async()=>({data:{
          id:'synthetic-approved',full_name:'Test Member',preferred_name:'Test',
          rank:'Associate',verification_status:'approved',avatar_path:null,
          founding_member:false,exclusive_member_number:null
        },error:null}),
        insert(payload){insertions.push({table,payload});return this;},
        single:async()=>({data:insertError?null:{id:'post-123'},error:insertError})
      };
      return q;
    }
  };
  const window={
    DSAuth:{ready:true,init:async()=>client},
    DSDashboardSocial:{mount:async ({target})=>{
      target.__ds30Controller={refresh:async()=>{
        if(refreshError)throw new Error('Preview offline');
      }};
    }}
  };
  const document={getElementById:id=>elements[id]||null};
  const scope={window,document,location:{href:'',origin:'https://example.test'},
    console,Promise,Date,Error};
  body.value=text;
  vm.runInNewContext(sources[kind],scope,{filename:kind+'.js'});
  await flush();await flush();
  assert.equal(typeof form.handlers?.submit,'function',kind+' composer did not initialize');
  await form.handlers.submit({preventDefault(){}});
  return {body,status,insertions,rpcCalls};
}

for(const kind of ['feed','dashboard']){
  test(kind+' saves source post without deprecated mention RPC; refresh failure is reported accurately',async()=>{
    const r=await mount(kind,{refreshError:true});
    assert.equal(r.insertions.length,1);
    assert.equal(r.insertions[0].table,'community_messages');
    assert.equal(r.insertions[0].payload.body,'An actual network update');
    assert.deepEqual(r.rpcCalls,[]);
    assert.equal(r.body.value,'','successful source insert clears the draft');
    assert.match(r.status.textContent,/Posted successfully/i);
    assert.match(r.status.textContent,/refresh failed|could not refresh/i);
    assert.doesNotMatch(r.status.textContent,/could not be published/i);
  });

  test(kind+' preserves the draft when insert fails, without an RPC side effect',async()=>{
    const r=await mount(kind,{insertError:{message:'Insert rejected by RLS'}});
    assert.equal(r.insertions.length,1);
    assert.equal(r.body.value,'An actual network update');
    assert.deepEqual(r.rpcCalls,[]);
    assert.match(r.status.textContent,/Insert rejected by RLS/);
    assert.doesNotMatch(r.status.textContent,/Posted successfully|Posted to/i);
  });

  test(kind+' refuses oversized posts rather than silently truncating',async()=>{
    const draft='Long form '+('x'.repeat(2100));
    const r=await mount(kind,{text:draft});
    assert.equal(r.insertions.length,0);
    assert.deepEqual(r.rpcCalls,[]);
    assert.equal(r.body.value,draft);
    assert.match(r.status.textContent,/2,000 characters/);
  });
}

test('all community post composers rely on verified saved-source notification triggers',()=>{
  const hub=read('assets/js/community-hub.js');
  const sql=read('scripts/security/community-notifications-from-source.DO-NOT-RUN.review.sql');
  for(const source of [sources.feed,sources.dashboard,hub])
    assert.doesNotMatch(source,/rpc\('community_notify_mentions'/);
  assert.match(sql,/AFTER INSERT ON public\.community_messages/);
  assert.match(sql,/REVIEW ONLY — DO NOT RUN/);
  assert.doesNotThrow(()=>new vm.Script(sources.feed));
  assert.doesNotThrow(()=>new vm.Script(sources.dashboard));
});
