import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const modules={
  directory:read('assets/js/member-directory.js'),
  profile:read('assets/js/professional-profile.js'),
  messages:read('assets/js/direct-messages.js'),
  community:read('assets/js/community-hub.js'),
  chat:read('assets/js/community-chat.js'),
  calls:read('assets/js/global-call-manager.js'),
  groups:read('assets/js/group-chats.js'),
  team:read('assets/js/team-directory.js')
};
const schema=read('scripts/security/member-public-projection-prepare.DO-NOT-RUN.review.sql');
const auth=read('assets/js/member-auth.js');

test('Public-safe directory remains disabled until coordinated schema release',()=>{
  assert.match(auth,/publicMemberProfilesV2:false/);
  assert.doesNotMatch(auth,/publicMemberProfilesV2:true/);
  assert.match(schema,/CREATE TABLE public\.member_public_profiles/);
  assert.match(schema,/GRANT SELECT ON public\.member_public_profiles TO authenticated/);
  assert.match(schema,/NEW\.verification_status='approved'/);
  assert.match(schema,/NEW\.profile_visibility='members'/);
});

test('No peer-facing consumer has a raw member_profiles identity fallback',()=>{
  for(const [name,s] of Object.entries(modules)){
    assert.match(s,/member_public_profiles/,
      name+' is missing the approved projection');
    assert.doesNotMatch(s,/'member_public_profiles'\s*:\s*'member_profiles'/,
      name+' falls back to the private table');
    assert.doesNotMatch(s,/publicDirectoryV2\?'member_public_profiles':'member_profiles'/,
      name+' still conditionally reads raw peer profile rows');
    assert.doesNotMatch(s,/\bfrom\('member_profiles'\)\.select\('id,full_name,preferred_name'\)/,
      name+' queries raw peer directory');
    assert.doesNotThrow(()=>new vm.Script(s),name+' JavaScript parse failed');
  }
});

test('Peer Directory, Professional Profile and Messages fail closed until projection enabled',()=>{
  assert.match(modules.directory,/if\(!publicDirectoryV2\)\{/);
  assert.match(modules.directory,/Member Directory temporarily unavailable/);
  assert.match(modules.directory,/const directoryTable='member_public_profiles'/);
  assert.doesNotMatch(modules.directory,/agent_code/);
  assert.match(modules.profile,/if\(!publicDirectoryV2\)\{/);
  assert.match(modules.profile,/Professional profile temporarily unavailable/);
  assert.match(modules.profile,/const memberResult=await supabase\.from\('member_public_profiles'\)/);
  assert.match(modules.messages,/if\(!publicDirectoryV2\)\{/);
  assert.match(modules.messages,/Messages temporarily unavailable/);
  assert.match(modules.messages,/const membersResult = await client\s*\.from\('member_public_profiles'\)/);
  // Call and video support can still use the caller ID and a generic fallback.
  assert.match(modules.calls,/publicDirectoryV2\s*\?\s*await state\.client\.from\('member_public_profiles'\)/);
  assert.match(modules.calls,/: \{data:null,error:null\}/);
});

test('Community Feed/Chat show neutral names without bypassing visibility consent',()=>{
  for(const [key,s] of [['community',modules.community],['chat',modules.chat]]){
    assert.match(s,/publicMemberProfilesV2!==true/,
      key+' must respect privacy release gating');
    assert.match(s,/return \{\};/,
      key+' must not read peer data when backend is unavailable');
    assert.match(s,/\.from\('member_public_profiles'\)/);
  }
  assert.match(modules.community,/profileResult=await supabase/);
  assert.match(modules.chat,/\.eq\('id',session\.user\.id\)\.single\(\)/);
});

test('Group Chats membership picker has approved viewer gate and safe target selection',()=>{
  const s=modules.groups;
  assert.match(s,/publicMemberProfilesV2!==true/);
  assert.match(s,/Group Chats temporarily unavailable/);
  assert.match(s,/\.from\('member_profiles'\)\.select\('verification_status'\)\.eq\('id',session\.user\.id\)/);
  assert.match(s,/\.from\('member_public_profiles'\)\.select\('id,full_name,preferred_name'\)/);
  assert.doesNotMatch(s,/from\('member_profiles'\)\.select\('id,full_name,preferred_name'\)/);
});

test('Remaining raw profile reads are only self-owned or Founder administrative reads',()=>{
  for(const [name,s] of Object.entries(modules)){
    const occurrences=[...s.matchAll(/\.from\('member_profiles'\)/g)];
    if(name==='directory'||name==='profile'||name==='messages'||name==='community'||
       name==='chat'||name==='calls'||name==='groups'){
      // Each of these routes has at most a self-membership read, never a peer
      // lookup. Message/call systems may read own Agent Code for authorization.
      assert.ok(occurrences.length<=2,
        name+' unexpectedly gained peer raw-table lookups');
    }
  }
  assert.match(modules.team,/Team Directory temporarily unavailable/);
  assert.match(modules.team,/\.from\('member_public_profiles'\)/);
});
