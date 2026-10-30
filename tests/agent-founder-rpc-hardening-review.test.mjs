import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('scripts/security/agent-founder-rpc-privilege-hardening.DO-NOT-RUN.review.sql');
const chat=read('assets/js/community-chat.js');

test('Community email queue is backed by a persisted caller-owned message',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.queue_community_message_email/);
  assert.match(sql,/WHERE id=target_message_id[\s\S]*AND user_id=auth\.uid\(\)/);
  assert.match(sql,/AND is_deleted=false/);
  assert.match(sql,/dedupe_key/);
  assert.match(sql,/community-chat:/);
  assert.match(chat,/\.select\('id'\)\.single\(\)/);
  assert.match(chat,/queue_community_message_email/);
  assert.doesNotMatch(chat,/queue_community_email_notifications/);
});

test('appointment email queue explicitly requires authentication and dedupes update versions',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.queue_appointment_email/);
  assert.match(sql,/IF auth\.uid\(\) IS NULL THEN[\s\S]*Authenticated member required/);
  assert.match(sql,/appointment_row\.updated_at::text/);
  assert.match(sql,/ON CONFLICT\(dedupe_key\)/);
});

test('Agent and Founder security-definer RPCs revoke anonymous execution',()=>{
  assert.match(sql,/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role/);
  assert.match(sql,/assign_exclusive_founding_number/);
  assert.match(sql,/founder_update_member/);
  assert.match(sql,/update_own_contact_profile/);
  assert.match(sql,/list_community_feed/);
  assert.match(sql,/ensure_default_milestones/);
});

test('internal queue and retired helpers are not browser RPCs',()=>{
  assert.match(sql,/claim_email_notification_batch/);
  assert.match(sql,/queue_email_notification/);
  assert.match(sql,/queue_community_email_notifications/);
  assert.match(sql,/dominionstar_test_notification/);
  assert.match(sql,/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/handle_new_member/);
  assert.match(sql,/queue_member_event_email/);
  assert.match(sql,/community_notify_mentions/);
});

test('review verification requires zero anonymous non-Meet security-definer RPCs',()=>{
  assert.match(sql,/p\.proname NOT LIKE 'meet_%'/);
  assert.match(sql,/queue_meeting_host_absent_notification/);
  assert.match(sql,/has_function_privilege\('anon',p\.oid,'EXECUTE'\)/);
  assert.match(sql,/IF exposed<>0 THEN/);
});

test('simple timestamp trigger helpers receive fixed empty search_path',()=>{
  assert.match(sql,/ALTER FUNCTION public\.touch_updated_at\(\) SET search_path=''/);
  assert.match(sql,/ALTER FUNCTION public\.set_presence_updated_at\(\) SET search_path=''/);
});
