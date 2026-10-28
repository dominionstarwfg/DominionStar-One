import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const audit=read('scripts/security/notification-rpc-preflight.READ-ONLY.review.sql');
const acl=read('scripts/security/notification-rpc-acl-lockdown.DO-NOT-RUN.review.sql');
const guarded=read('scripts/security/community-email-rpc-guard.DO-NOT-RUN.review.sql');
const source=read('assets/js/community-chat.js');
const schema=read('supabase/member-email-notifications.sql');

test('Outbox preflight is read-only and reports each vulnerable RPC by role',()=>{
  for(const routine of ['claim_email_notification_batch','queue_email_notification','queue_community_email_notifications']){
    assert.ok(audit.includes(routine),routine);
  }
  assert.match(audit,/has_function_privilege\('anon'/);
  assert.match(audit,/has_function_privilege\('authenticated'/);
  assert.match(audit,/has_function_privilege\('service_role'/);
  assert.doesNotMatch(audit,/^\s*(?:UPDATE|DELETE|INSERT|CALL|GRANT|REVOKE|ALTER|CREATE)\b/mi);
});

test('Privileged queue claim and generic email queue are service-role-only in proposal',()=>{
  assert.match(acl,/REVIEW ONLY/);
  assert.match(acl,/REVOKE EXECUTE ON FUNCTION public\.claim_email_notification_batch\(integer\)/);
  assert.match(acl,/REVOKE EXECUTE ON FUNCTION public\.queue_email_notification\(uuid,text,text,text\)/);
  assert.match(acl,/FROM PUBLIC, anon, authenticated/);
  assert.match(acl,/TO service_role/);
  assert.match(acl,/RAISE EXCEPTION 'Privilege verification failed/);
  assert.doesNotMatch(acl,/REVOKE EXECUTE ON FUNCTION public\.queue_community_email_notifications/);
});

test('Current Community UI directly invokes its separate email RPC after chat insert',()=>{
  assert.match(source,/client\.from\('community_chat_messages'\)\.insert/);
  assert.match(source,/client\.rpc\('queue_community_email_notifications'/);
  assert.match(source,/sender_id:session\.user\.id/);
  assert.match(source,/chat_body:body/);
});

test('Proposed Community server function prevents impersonation and unverified chat email requests',()=>{
  assert.match(guarded,/auth\.uid\(\) IS NULL OR sender_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(guarded,/p\.verification_status='approved'/);
  assert.match(guarded,/m\.user_id=sender_id AND m\.body=chat_body/);
  assert.match(guarded,/m\.is_deleted=false/);
  assert.match(guarded,/m\.created_at >= now\(\)-interval '2 minutes'/);
  assert.match(guarded,/A matching recent published chat message is required/);
  assert.match(guarded,/coalesce\(np\.email_enabled,true\)=true/);
  assert.match(guarded,/coalesce\(np\.community_email_enabled,false\)=true/);
  assert.match(guarded,/ON CONFLICT \(dedupe_key\) WHERE dedupe_key IS NOT NULL DO NOTHING/);
  assert.match(guarded,/chat_message_id::text \|\| ':' \|\| recipient\.id::text/);
  assert.match(guarded,/REVOKE EXECUTE ON FUNCTION public\.queue_community_email_notifications\(uuid,text\)/);
  assert.match(guarded,/FROM PUBLIC, anon/);
  assert.match(guarded,/TO authenticated, service_role/);
  assert.doesNotMatch(guarded,/TO anon/);
});

test('Existing schema script explicitly revokes grants rather than only PUBLIC default',()=>{
  assert.match(schema,/revoke execute on function public\.claim_email_notification_batch\(integer\)\s+from PUBLIC, anon, authenticated/);
  assert.match(schema,/grant execute on function public\.claim_email_notification_batch\(integer\) to service_role/);
});

test('Review-only security scripts are never production CI entry points',()=>{
  for(const content of [acl,guarded]){
    assert.match(content,/DO NOT|NOT APPLIED|NOT EXECUTED|REVIEW ONLY/i);
    assert.match(content,/BEGIN;/);
    assert.match(content,/COMMIT;/);
  }
  const workflow=read('.github/workflows/agent-settings-review-gate.yml');
  assert.doesNotMatch(workflow,/psql\s|supabase db|apply_migration|deploy/);
  assert.doesNotMatch(workflow,/community-email-rpc-guard\.DO-NOT-RUN\.review\.sql/);
});
