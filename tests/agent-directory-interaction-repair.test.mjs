import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const team = read('assets/js/team-directory.js');
const directory = read('assets/js/member-directory.js');
const profile = read('assets/js/professional-profile.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const classList = {add(){},remove(){}};
const ownId = '10000000-0000-4000-8000-000000000001';
const peerId = '20000000-0000-4000-8000-000000000002';
const peer = {
  id:peerId, full_name:'Test Agent', preferred_name:'Test', rank:'Associate',
  avatar_path:'private/test.png', verification_status:'approved',city:'Austin',state:'TX'
};

test('Team Directory renders member names immediately even when photo signing never completes', async () => {
  const grid = {innerHTML:'',querySelectorAll(){return [];}};
  const elements = {
    directoryGate:{innerHTML:'',classList},
    directoryApp:{classList},
    directoryGrid:grid,
    directorySearch:{value:'',addEventListener(){}},
    directoryRankFilter:{value:'',addEventListener(){}}
  };
  let photoCalls = 0;
  const client = {
    auth:{getSession:async()=>({data:{session:{user:{id:ownId}}},error:null})},
    storage:{from:()=>({createSignedUrl:()=>{
      photoCalls++;
      return new Promise(()=>{});
    }})},
    from(table){
      const query = {
        select(){return this;},eq(){return this;},
        single:async()=>({data:{verification_status:'approved'},error:null}),
        order(){return this;},
        then(resolve,reject){
          return Promise.resolve({
            data:table==='member_public_profiles'?[peer]:[],
            error:null
          }).then(resolve,reject);
        }
      };
      return query;
    }
  };
  const window = {DSAuth:{ready:true,init:async()=>client},
    DOMINIONSTAR_AGENT_DATA_FEATURES:{publicMemberProfilesV2:true}};
  vm.runInNewContext(team, {
    window,document:{getElementById:id=>elements[id]},
    location:{href:''},Promise,Date,Error,setTimeout(){},console
  },{filename:'team-directory.js'});
  await tick();await tick();
  assert.equal(photoCalls,1);
  assert.match(grid.innerHTML,/Test/);
  assert.match(grid.innerHTML,/View professional profile/);
  assert.match(grid.innerHTML,/data-member-id=/);
});

test('Members Connect retries failed requests and explicitly sends pending status', async () => {
  const calls = [];
  const grid = {
    innerHTML:'',button:null,
    querySelectorAll(selector){
      if(selector==='.connect-member') {
        const button={dataset:{id:peerId},disabled:false,
          addEventListener(_event,handler){this.click=handler;}};
        this.button=button;
        return [button];
      }
      return [];
    }
  };
  const elements = {
    directoryGate:{innerHTML:'',classList},
    directoryApp:{classList},
    directoryGrid:grid,
    directorySearch:{value:'',addEventListener(){}},
    directoryRank:{value:'',addEventListener(){}}
  };
  const client = {
    auth:{getSession:async()=>({data:{session:{user:{id:ownId}}}})},
    rpc:async()=>({data:true,error:null}),
    from(table) {
      return {
        select(){return this;},eq(){return this;},
        single:async()=>({data:{verification_status:'approved'},error:null}),
        order:async()=>({data:table==='member_public_profiles'?[peer,{...peer,id:ownId}]:[],error:null}),
        // Only own connection rows are available through the authorized RLS SELECT.
        or:async()=>({data:[],error:null}),
        insert:async payload=>{
          calls.push(payload);
          return calls.length===1?{error:{code:'500',message:'Temporary error'}}:{error:null};
        }
      };
    }
  };
  const window = {DSAuth:{ready:true,init:async()=>client},
    DOMINIONSTAR_AGENT_DATA_FEATURES:{publicMemberProfilesV2:true}};
  vm.runInNewContext(directory,{
    window,document:{getElementById:id=>elements[id]},
    location:{href:''},Promise,Map,Date,Error,
    setTimeout(){},console
  },{filename:'member-directory.js'});
  await tick();await tick();
  assert.match(grid.innerHTML,/Test/);
  assert.equal((grid.innerHTML.match(/connect-member/g)||[]).length,1,
    'Do not show a Connect button for the signed-in member');
  await grid.button.click();
  assert.match(grid.innerHTML,/Retry Connect/);
  assert.equal(calls.length,1);
  assert.equal(calls[0].status,'pending');
  await grid.button.click();
  assert.match(grid.innerHTML,/Requested/);
  assert.equal(calls.length,2);
  assert.equal(calls[1].status,'pending');
});

test('Profile badge text and backend errors cannot enter unescaped innerHTML', () => {
  assert.match(profile,/escapeHtml\(profile\.verification_status \|\| 'pending'\)/);
  assert.match(profile,/escapeHtml\(profile\.rank \|\| 'TA'\)/);
  assert.match(profile,/detail\.textContent = response\.error\?\.message/);
  assert.doesNotMatch(profile,/<h1>\$\{response\.error\?\.message/);
  assert.doesNotThrow(()=>new vm.Script(profile));
});

test('Both member directory implementations remain scoped to safe projection',()=>{
  assert.match(team,/\.from\('member_public_profiles'\)/);
  assert.match(directory,/const directoryTable='member_public_profiles'/);
  assert.doesNotMatch(team,/for\s*\(const member of \(data \|\| \[\]\)\)/);
  assert.match(directory,/status:'pending'/);
  assert.doesNotThrow(()=>new vm.Script(team));
  assert.doesNotThrow(()=>new vm.Script(directory));
});
