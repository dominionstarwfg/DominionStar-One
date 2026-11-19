import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const prepare=read('scripts/security/member-public-projection-prepare.DO-NOT-RUN.review.sql');
const enforce=read('scripts/security/member-public-projection-enforce.DO-NOT-RUN.review.sql');
const auth=read('assets/js/member-auth.js');
const directory=read('assets/js/member-directory.js');
const messages=read('assets/js/direct-messages.js');
const community=read('assets/js/community-hub.js');
const chat=read('assets/js/community-chat.js');
const calls=read('assets/js/global-call-manager.js');
const settings=read('assets/js/account-settings.js');
const plan=read('docs/AGENT_OS_P0_PRIVACY_RELEASE_GATE.md');

test('public profile SQL drafts explicitly prohibit release execution',()=>{
  assert.match(prepare,/REVIEW ONLY — DO NOT RUN/);
  assert.match(enforce,/REVIEW ONLY — DO NOT RUN/);
  assert.match(plan,/Production member privacy weakness:[^\n]*not remediated yet/i);
});

test('public-safe projection contains no private contact data or Agent Code',()=>{
  const definition=prepare.match(/CREATE TABLE public\.member_public_profiles \(([\s\S]+?)\);\nALTER TABLE/);
  assert.ok(definition,'Public-safe table DDL must be present');
  for(const restricted of ['email','phone','address','account_notes','agent_code','smd_name','is_founder','role']){
    assert.doesNotMatch(definition[1],new RegExp('\\b'+restricted+'\\b','i'));
  }
  for(const field of ['id','full_name','preferred_name','rank','avatar_path','city','state','founding_member']){
    assert.match(definition[1],new RegExp('\\b'+field+'\\b'));
  }
  assert.match(prepare,/ENABLE ROW LEVEL SECURITY/);
  assert.match(prepare,/REVOKE ALL ON TABLE public\.member_public_profiles FROM PUBLIC, anon, authenticated/);
  assert.match(prepare,/GRANT SELECT ON public\.member_public_profiles TO authenticated/);
  assert.match(prepare,/viewer\.id=\(SELECT auth\.uid\(\)\)/);
  assert.match(prepare,/viewer\.verification_status='approved'/);
});

test('only approved and opted-in profiles are projected and synchronized',()=>{
  assert.match(prepare,/NEW\.verification_status='approved'/);
  assert.match(prepare,/NEW\.profile_visibility='members'/);
  assert.match(prepare,/AFTER INSERT OR UPDATE ON public\.member_profiles/);
  assert.match(prepare,/ON CONFLICT\(id\) DO UPDATE/);
  assert.match(prepare,/DELETE FROM public\.member_public_profiles WHERE id=NEW\.id/);
  assert.match(prepare,/WHERE p\.verification_status='approved' AND p\.profile_visibility='members'/);
  // Never re-expose someone who opted out under the legacy metadata-only UI.
  assert.match(prepare,/raw_user_meta_data #>> '\{dominionstar_settings,privacy,directoryVisible\}' = 'false'/);
  assert.match(prepare,/SET profile_visibility='private'/);
});

test('visibility setting writes server-enforced RPC, never metadata alone',()=>{
  assert.match(prepare,/FUNCTION public\.set_my_member_directory_visibility/);
  assert.match(prepare,/target_visibility NOT IN \('members','private'\)/);
  assert.match(prepare,/WHERE id=auth\.uid\(\) AND verification_status='approved'/);
  assert.match(prepare,/REVOKE EXECUTE ON FUNCTION public\.set_my_member_directory_visibility\(text\)[\s\S]*FROM PUBLIC, anon/);
  assert.match(settings,/\.select\('profile_visibility'\)\.eq\('id',session\.user\.id\)/);
  assert.match(settings,/db\.rpc\('set_my_member_directory_visibility'/);
  assert.match(settings,/if\(!serverDirectoryVisibilityReady\)/);
  assert.match(settings,/if\(accepted\)/);
});

test('community Feed and Chat privileged RPCs no longer join raw member_profiles for authors',()=>{
  const feed=prepare.match(/CREATE OR REPLACE FUNCTION public\.list_community_feed\([\s\S]+?\n\$function\$;/)?.[0];
  const liveChat=prepare.match(/CREATE OR REPLACE FUNCTION public\.list_community_chat\([\s\S]+?\n\$function\$;/)?.[0];
  assert.ok(feed&&liveChat);
  for(const f of [feed,liveChat]){
    assert.match(f,/LEFT JOIN public\.member_public_profiles profile/);
    assert.doesNotMatch(f,/JOIN public\.member_profiles profile/);
    assert.match(f,/viewer\.verification_status='approved'/);
  }
});

test('browser cutover is disabled until coordinated DB and client release',()=>{
  assert.match(auth,/publicMemberProfilesV2:false/);
  assert.doesNotMatch(auth,/publicMemberProfilesV2:true/);
  assert.match(directory,/const directoryTable='member_public_profiles'/);
  assert.match(messages,/\.from\('member_public_profiles'\)/);
  assert.match(community,/\.from\('member_public_profiles'\)/);
  assert.match(chat,/\.from\('member_public_profiles'\)/);
  assert.match(calls,/\.from\('member_public_profiles'\)/);
  assert.doesNotMatch(directory,/'member_public_profiles':'member_profiles'/);
  assert.doesNotMatch(messages,/'member_public_profiles':'member_profiles'/);
  assert.doesNotMatch(community,/'member_public_profiles':'member_profiles'/);
  assert.doesNotMatch(chat,/'member_public_profiles':'member_profiles'/);
  assert.doesNotMatch(calls,/'member_public_profiles'\s*:\s*'member_profiles'/);
  assert.doesNotMatch(messages,/if\(membersResult\.error\).*?from\('member_profiles'\)/);
});

test('final RLS enforcement is a distinct blocked phase retaining owner and founder access',()=>{
  assert.match(enforce,/DROP POLICY "profile approved directory read" ON public\.member_profiles/);
  assert.match(enforce,/profile own read/);
  assert.match(enforce,/profile founder read/);
  assert.match(enforce,/member_profiles_sync_public_directory/);
  assert.match(enforce,/Public-safe member projection missing/);
  assert.match(plan,/PR #196/);
  assert.match(plan,/Professional Profile/);
});
