// Gate 0 Messages roster static contract tests (review branch only).
// node --test tests/gate0-messaging-contacts-static.test.mjs
// NOT a substitute for real SQL/JWT authorization tests in isolated staging.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Messages roster uses minimal RPC, fails closed, then starts communications',()=>{
  const src=read('assets/js/direct-messages.js');
  const roster=src.indexOf("const membersResult = await client.rpc('list_message_contacts');");
  const errorCheck=src.indexOf('if (membersResult.error || !Array.isArray(membersResult.data))',roster);
  const denial=src.indexOf("gate.textContent = 'Messages are temporarily unavailable.",errorCheck);
  const clientStart=src.indexOf('await window.CommunicationEngine?.init({client,session})',roster);
  const shown=src.indexOf("app.classList.remove('member-hidden')",roster);
  assert.ok(roster>0 && errorCheck>roster && denial>errorCheck);
  assert.ok(clientStart>denial && shown>clientStart);
  assert.doesNotMatch(src, /\.select\('id,full_name,preferred_name,rank,agent_code/);
  assert.doesNotMatch(src,/\.from\('member_profiles'\)[\s\S]{0,250}\.neq\('id',session\.user\.id\)/);
});

test('Messages incoming call/deep link cannot open unknown contact',()=>{
  const src=read('assets/js/direct-messages.js');
  const start=src.indexOf('async function openConversation(memberId)');
  assert.ok(start>0);
  const block=src.slice(start,start+650);
  assert.match(block,/const member = members\.find\(item => item\.id === memberId\)/);
  assert.match(block,/if \(!member\) \{[\s\S]*?return;/);
  assert.ok(block.indexOf('if (!member)')<block.indexOf('activeMemberId = memberId'));
});

test('Messages contact panel keeps Contract Level but removes private fields',()=>{
  const html=read('direct-messages/index.html');
  assert.match(html,/id="dmMemberContract"/);
  assert.match(html,/id="dmMemberStatus"/);
  assert.doesNotMatch(html,/id="dmMemberAgentCode"/);
  assert.doesNotMatch(html,/id="dmMemberSmd"/);
  const src=read('assets/js/direct-messages.js');
  assert.doesNotMatch(src,/member\.agent_code|member\.smd_name|memberAgentCode|memberSmd/);
});

test('RLS helper requires approved caller, approved contacts and safe projection',()=>{
  const sql=read('supabase/gate0-review/10_message_contacts_rpc_candidate.sql');
  assert.match(sql,/CREATE FUNCTION public\.list_message_contacts\(\)/);
  assert.match(sql,/viewer\.verification_status\s*=\s*'approved'/);
  assert.match(sql,/contact\.verification_status\s*=\s*'approved'/);
  assert.match(sql,/contact\.id\s*<>\s*auth\.uid\(\)/);
  const projection=sql.split('RETURNS TABLE (')[1]?.split(')\nLANGUAGE')[0];
  assert.ok(projection);
  for(const sensitive of ['email','phone','address','agent_code','smd_name','is_founder','account_notes','role','profile_visibility']){
    assert.doesNotMatch(projection,new RegExp('\\b'+sensitive+'\\b'));
  }
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.list_message_contacts\(\) FROM PUBLIC;/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.list_message_contacts\(\) FROM anon;/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.list_message_contacts\(\) TO authenticated;/);
});

test('Documentation flags old RLS leak and separates discovery from send permissions',()=>{
  const doc=read('supabase/gate0-review/10_message_contacts_privacy_cutover.md');
  assert.match(doc,/No changes to Netlify build config/);
  assert.match(doc,/Phase A/);
  assert.match(doc,/Phase B/);
  assert.match(doc,/adding new minimal RPCs alone does NOT stop direct profile-table reads/i);
  assert.match(doc,/blocked connection attempts new DM/i);
});
