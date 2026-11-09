import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const helper=read('assets/js/data-layer.js');
const team=read('assets/js/team-directory.js');
const founder=read('assets/js/member-profile.js');
const html=read('team-directory/index.html');
const projection=read('scripts/security/member-public-projection-prepare.DO-NOT-RUN.review.sql');

function fakeClient(){
  const calls=[];
  const client={
    from(table){
      const query={
        table,fields:null,idColumn:null,ids:null,
        select(fields){this.fields=fields;return this;},
        in(idColumn,ids){
          this.idColumn=idColumn;this.ids=ids;
          calls.push({table:this.table,fields:this.fields,idColumn,ids});
          return Promise.resolve({data:ids.map(id=>({
            id,full_name:'Approved Synthetic Member',
            preferred_name:'Synthetic',rank:'Associate'
          })),error:null});
        }
      };
      return query;
    }
  };
  return {client,calls};
}

function helperWith(flag){
  const window={DOMINIONSTAR_AGENT_DATA_FEATURES:{publicMemberProfilesV2:flag}};
  vm.runInNewContext(helper,{window,Map,Set,Promise,Error}, {filename:'data-layer.js'});
  return window.DSData;
}

test('Shared member profiles fail closed before server-side projection is released',async()=>{
  const ds=helperWith(false);
  const {client,calls}=fakeClient();
  assert.deepEqual(await ds.fetchProfiles(client,['synthetic-id']),{});
  assert.equal(calls.length,0);
  const merged=await ds.mergeProfiles(client,[{user_id:'synthetic-id'}]);
  assert.equal(merged[0].member_profile,null);
  assert.equal(calls.length,0);
});

test('Shared member profiles query only approved public projection fields',async()=>{
  const ds=helperWith(true);
  const {client,calls}=fakeClient();
  const map=await ds.fetchProfiles(client,['id-a','id-a','id-b'],
    'preferred_name,full_name,rank');
  assert.equal(map['id-a'].full_name,'Approved Synthetic Member');
  assert.equal(calls.length,1);
  assert.equal(calls[0].table,'member_public_profiles');
  assert.equal(calls[0].idColumn,'id');
  assert.equal(calls[0].fields,'id,preferred_name,full_name,rank');
  assert.equal(calls[0].ids.length,2);
});

test('No member may request private fields through the shared profile helper',async()=>{
  const ds=helperWith(true);
  const {client,calls}=fakeClient();
  for(const columns of [
    'id,full_name,email',
    'id,agent_code',
    'id,phone',
    'id,account_notes',
    'id,role,is_founder',
    '*',
    'id,full_name,member_profiles(email)'
  ]){
    await assert.rejects(()=>ds.fetchProfiles(client,['id-a'],columns),
      /not approved/);
  }
  await assert.rejects(()=>ds.fetchByIds(
    client,'member_profiles',['id-a'],'id,email'
  ),/Private member profiles/);
  assert.equal(calls.length,0);
});

test('Public projection field list is consistent with the database migration',()=>{
  const columns=['id','full_name','preferred_name','rank',
    'founding_member','exclusive_member_number','avatar_path',
    'city','state','verification_status'];
  const def=projection.split('CREATE TABLE public.member_public_profiles (')[1]
    .split(');')[0];
  for(const col of columns){
    assert.match(def,new RegExp('(?:^|\\n)\\s*'+col+'\\s+','m'));
  }
  for(const col of ['email','agent_code','smd_name','account_notes',
    'phone','linkedin_url','website_url','bio','team_name']){
    assert.doesNotMatch(def,new RegExp('(?:^|\\n)\\s*'+col+'\\s+','m'));
  }
});

test('Team Directory never fetches private peer rows or deprecated private fields',()=>{
  assert.match(team,/publicMemberProfilesV2!==true/);
  assert.match(team,/Team Directory temporarily unavailable/);
  assert.match(team,/\.from\('member_public_profiles'\)/);
  assert.match(team,/\.select\('id,full_name,preferred_name,city,state,rank,avatar_path,founding_member,exclusive_member_number'\)/);
  assert.match(team,/\.eq\('id', session\.user\.id\)/);
  assert.match(team,/View professional profile/);
  assert.match(team,/\/professional-profile\/\?member=/);
  const peer=team.split("const { data, error } = await supabase")[1];
  assert.ok(peer);
  assert.doesNotMatch(peer,/\.from\('member_profiles'\)/);
  assert.doesNotMatch(peer,/linkedin_url|instagram_url|website_url|team_name|member\.bio/);
  assert.ok(team.includes('src="${esc(member.avatarUrl)}"'));
  assert.match(html,/assets\/js\/team-directory\.js/);
  assert.match(html,/assets\/js\/member-auth\.js/);
});

test('Founder-only member detail is explicit-field and still Founder-gated',()=>{
  assert.match(founder,/\.select\('is_founder'\)/);
  assert.match(founder,/if \(!founder\?\.is_founder\)/);
  assert.match(founder,/\.select\('id,full_name,email,agent_code,smd_name,rank,verification_status,account_notes'\)/);
  assert.doesNotMatch(founder,/\.select\('\*'\)/);
  assert.ok(founder.includes("if (!/^[0-9a-f]{8}"));
});

test('All changed consumers parse under Node before browser usage',()=>{
  assert.doesNotThrow(()=>new vm.Script(helper));
  assert.doesNotThrow(()=>new vm.Script(team));
  assert.doesNotThrow(()=>new vm.Script(founder));
});
