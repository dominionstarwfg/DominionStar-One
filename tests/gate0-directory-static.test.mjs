// Gate 0 member-directory migration source-level guard tests.
// Usage after branch checkout: node --test tests/gate0-directory-static.test.mjs
// Not a substitute for JWT/RLS staging tests. Requires Node.js 22+.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('directory UI calls vetted RPC and never retrieves agent code from other profiles', () => {
  const js = read('assets/js/member-directory.js');
  assert.match(js, /client\.rpc\('list_directory_members'\)/);
  assert.doesNotMatch(js, /\.select\('id,full_name,preferred_name,rank,agent_code/);
  assert.doesNotMatch(js, /\bm\.agent_code\b/);
  assert.match(js, /verification_status'\)\.eq\('id',session\.user\.id\)/);
});

test('directory function limits caller and visibility while returning minimal columns', () => {
  const sql = read('supabase/gate0-review/06_member_directory_rpc_candidate.sql');
  assert.match(sql, /CREATE FUNCTION public\.list_directory_members\(\)/);
  assert.match(sql, /auth\.uid\(\) IS NOT NULL/);
  assert.match(sql, /requesting_agent\.verification_status\s*=\s*'approved'/);
  assert.match(sql, /profile\.verification_status\s*=\s*'approved'/);
  assert.match(sql, /profile\.profile_visibility\s*=\s*'members'/);
  const signature = sql.split('RETURNS TABLE(')[1]?.split(')\nLANGUAGE')[0];
  assert.ok(signature, 'Explicit return list required');
  for (const sensitive of ['email','agent_code','phone','address_line1','account_notes','is_founder','smd_name']) {
    assert.doesNotMatch(signature,new RegExp('\\b'+sensitive+'\\b'),'Private field leaked: '+sensitive);
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.list_directory_members\(\) FROM PUBLIC;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.list_directory_members\(\) TO authenticated;/);
});

test('review notes acknowledge old base-table policy stays exposed until full cutover', () => {
  const doc = read('supabase/gate0-review/06_profile_privacy_cutover.md');
  assert.match(doc, /until the old.*policy is replaced/i);
  assert.match(doc, /Founder/);
  assert.match(doc, /staging/);
});
