import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const js=read('assets/js/direct-messages.js');
const sql=read('scripts/security/direct-message-integrity.DO-NOT-RUN.review.sql');

test('Direct Messages prefer narrow RPCs and only fall back when RPC is missing',()=>{
  assert.match(js,/mark_my_direct_messages_read/);
  assert.match(js,/edit_my_direct_message/);
  assert.match(js,/delete_my_direct_message/);
  assert.match(js,/code==='PGRST202'/);
  assert.match(js,/schema cache/);
  assert.match(js,/updated_at:new Date\(\)\.toISOString\(\)/);
});

test('review migration removes broad browser UPDATE access',()=>{
  assert.match(sql,/REVOKE UPDATE ON TABLE public\.direct_messages FROM anon, authenticated/);
  assert.match(sql,/DROP POLICY IF EXISTS "members update received direct messages"/);
  assert.match(sql,/has_table_privilege\('authenticated','public\.direct_messages','UPDATE'\)/);
});

test('message mutation RPCs are owner-scoped and use empty search_path',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.mark_my_direct_messages_read/);
  assert.match(sql,/recipient_id=auth\.uid\(\)/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.edit_my_direct_message/);
  assert.match(sql,/sender_id=auth\.uid\(\)/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.delete_my_direct_message/);
  assert.match(sql,/SET search_path=''/);
  assert.doesNotMatch(sql,/SET search_path=public/);
});

test('edited and deleted messages update server timestamp',()=>{
  const occurrences=(sql.match(/updated_at=now\(\)/g)||[]).length;
  assert.ok(occurrences>=2);
});
