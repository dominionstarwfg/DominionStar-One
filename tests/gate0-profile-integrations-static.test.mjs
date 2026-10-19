// Gate 0 profile integration source checks. Node 22+.
// Run after review-branch checkout: node --test tests/gate0-profile-integrations-static.test.mjs
// Static checks are NOT RLS/JWT or production safety validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Community comments resolve through a restricted author RPC, not general directory',()=>{
 const src=read('assets/js/community-hub.js');
 assert.match(src,/\.rpc\('list_community_comment_authors'/);
 assert.match(src,/target_author_ids\s*:\s*ids/);
 assert.doesNotMatch(src,/\.from\('member_profiles'\)[\s\S]{0,120}\.in\('id',ids\)/);
 const sql=read('supabase/gate0-review/07_community_comment_author_rpc_candidate.sql');
 assert.match(sql,/profile\.id = ANY\(/);
 assert.match(sql,/requester\.verification_status\s*=\s*'approved'/);
 assert.match(sql,/c\.is_deleted=false/);
 assert.match(sql,/m\.is_deleted=false/);
 assert.doesNotMatch(sql,/profile\.profile_visibility\s*=\s*'members'/);
 const projection=sql.split('RETURNS TABLE(')[1].split(')\nLANGUAGE')[0];
 for(const forbidden of ['email','phone','agent_code','smd_name','account_notes','is_founder','address_line1']) {
   assert.doesNotMatch(projection,new RegExp('\\b'+forbidden+'\\b'));
 }
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.list_community_comment_authors\(uuid\[\]\) FROM PUBLIC;/);
});

test('Workspace updates only own avatar through vetted RPC',()=>{
 const src=read('workspace/workspace.js');
 assert.match(src,/\.rpc\('set_own_avatar_path',\{new_avatar_path:newPath\}\)/);
 assert.doesNotMatch(src,/\.from\('member_profiles'\)\.update\(\{avatar_path:newPath/);
 const sql=read('supabase/gate0-review/08_set_own_avatar_rpc_candidate.sql');
 assert.match(sql,/CREATE FUNCTION public\.set_own_avatar_path\(new_avatar_path text\)/);
 assert.match(sql,/WHERE id=auth\.uid\(\)/);
 assert.match(sql,/obj\.bucket_id='member-avatars' AND obj\.name=new_avatar_path/);
 assert.match(sql,/new_avatar_path !~/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.set_own_avatar_path\(text\) FROM PUBLIC;/);
});

test('All new RPC SQL remains in review directory with no auto-migrations',()=>{
 const build=read('scripts/build-public-netlify.sh');
 assert.match(build,/--exclude 'supabase\/'/);
 const readme=read('supabase/gate0-review/README.md');
 assert.match(readme,/not\s+in the automatic.*supabase\/migrations/smi);
});
