// Gate 0 DM/connection integrity source checks; NO live DB writes.
// After branch checkout: node --test tests/gate0-dm-integrity-static.test.mjs
// These checks cannot substitute for SQL execution or synthetic user JWT tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Messages client uses narrow RPCs instead of direct mutation',()=>{
 const src=read('assets/js/direct-messages.js');
 assert.match(src,/\.rpc\('dm_mark_read',\{/);
 assert.match(src,/\.rpc\('dm_edit_own_message',\{/);
 assert.match(src,/\.rpc\('dm_soft_delete_own_message',\{/);
 assert.doesNotMatch(src,/\.from\('direct_messages'\)[\s\S]{0,150}\.update\(/);
 assert.match(src,/target_sender_id:activeMemberId/);
 assert.match(src,/target_message_id:selectedMessage.id/);
});

test('Missed incoming call cannot impersonate remote member as message author',()=>{
 const src=read('assets/js/direct-messages.js');
 const section=src.slice(src.indexOf('const recordMissedCall ='),src.indexOf("await publishCallEvent('call.missed'"));
 assert.match(section,/if \(direction !== 'incoming'\)/);
 assert.match(section,/sender_id:session.user.id/);
 assert.doesNotMatch(section,/sender_id:direction === 'incoming' \? memberId/);
});

test('DM mutation RPCs enforce own sender/recipient and reject broad UPDATE',()=>{
 const sql=read('supabase/gate0-review/11_dm_integrity_rpc_candidate.sql');
 for(const name of ['dm_mark_read','dm_edit_own_message','dm_soft_delete_own_message']){
   assert.match(sql,new RegExp('CREATE FUNCTION public\\.'+name+'\\('));
   assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.'+name));
 }
 assert.match(sql,/recipient_id=auth\.uid\(\)/);
 assert.match(sql,/sender_id=auth\.uid\(\)/);
 assert.match(sql,/AND is_deleted=false/);
 assert.match(sql,/REVOKE UPDATE ON TABLE public\.direct_messages FROM authenticated;/);
 assert.match(sql,/REVOKE UPDATE ON TABLE public\.direct_messages FROM PUBLIC;/);
 assert.match(sql,/verification_status='approved'/);
});

test('Connections enforce pending requests, restrictive transitions, and UPDATE revocation',()=>{
 const sql=read('supabase/gate0-review/12_connection_state_integrity_candidate.sql');
 assert.match(sql,/ALTER POLICY "members request connections"/);
 assert.match(sql,/requester_id=auth\.uid\(\)/);
 assert.match(sql,/status='pending'/);
 assert.match(sql,/CREATE FUNCTION public\.respond_member_connection/);
 assert.match(sql,/recipient_id=auth\.uid\(\) AND status='pending'/);
 assert.match(sql,/new_status='blocked'/);
 assert.match(sql,/REVOKE UPDATE ON TABLE public\.member_connections FROM authenticated;/);
});

test('Blocking a contact denies further sends in either direction',()=>{
 const sql=read('supabase/gate0-review/13_dm_blocked_send_guard_candidate.sql');
 assert.match(sql,/ALTER POLICY "members send direct messages"/);
 assert.match(sql,/NOT EXISTS \(/);
 assert.match(sql,/relationship\.status='blocked'/);
 assert.match(sql,/relationship\.requester_id=auth\.uid\(\)/);
 assert.match(sql,/relationship\.recipient_id=auth\.uid\(\)/);
 assert.match(sql,/sender\.verification_status='approved'/);
 assert.match(sql,/recipient\.verification_status='approved'/);
});

test('Read-only inventory and unresolved privacy decisions are documented',()=>{
 const checks=read('supabase/gate0-review/14_dm_integrity_readonly_checks.sql');
 const doc=read('supabase/gate0-review/11_dm_integrity_cutover.md');
 assert.match(checks,/BEGIN TRANSACTION READ ONLY;/);
 assert.match(doc,/Founder-wide DM SELECT/);
 assert.match(doc,/No test in this file has run/);
 assert.match(doc,/incoming missed calls/i);
});
