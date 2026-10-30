import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const audit=read('scripts/security/notification-rpc-preflight.READ-ONLY.review.sql');
const acl=read('scripts/security/notification-rpc-acl-lockdown.DO-NOT-RUN.review.sql');
const hardening=read('scripts/security/agent-founder-rpc-privilege-hardening.DO-NOT-RUN.review.sql');
const source=read('assets/js/community-chat.js');
const schema=read('supabase/member-email-notifications.sql');

test('Outbox preflight is read-only and reports each legacy vulnerable RPC by role',()=>{
  for(const routine of ['claim_email_notification_batch','queue_email_notification','queue_community_email_notifications']){
    assert.ok(audit.includes(routine),routine);
  }
  assert.match(audit,/has_function_privilege\('anon'/);
  assert.match(audit,/has_function_privilege\('authenticated'/);
  assert.match(audit,/has_function_privilege\('service_role'/);
  assert.doesNotMatch(audit,/^\s*(?:UPDATE|DELETE|INSERT|CALL|GRANT|REVOKE|ALTER|CREATE)\b/mi);
});

test('Privileged queue claim and generic email queue remain service-role-only in proposal',()=>{
  assert.match(acl,/REVIEW ONLY/);
  assert.match(acl,/REVOKE EXECUTE ON FUNCTION public\.claim_email_notification_batch\(integer\)/);
  assert.match(acl,/REVOKE EXECUTE ON FUNCTION public\.queue_email_notification\(uuid,text,text,text\)/);
  assert.match(acl,/FROM PUBLIC, anon, authenticated/);
  assert.match(acl,/TO service_role/);
  assert.match(acl,/RAISE EXCEPTION 'Privilege verification failed/);
  assert.match(hardening,/claim_email_notification_batch/);
  assert.match(hardening,/queue_email_notification/);
  assert.match(hardening,/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
  assert.match(hardening,/GRANT EXECUTE ON FUNCTION %s TO service_role/);
});

test('Current Community UI queues email only from the persisted chat row id',()=>{
  assert.match(source,/client\.from\('community_chat_messages'\)\.insert/);
  assert.match(source,/\.select\('id'\)\.single\(\)/);
  assert.match(source,/client\.rpc\('queue_community_message_email'/);
  assert.match(source,/target_message_id:sent\.data\.id/);
  assert.doesNotMatch(source,/client\.rpc\('queue_community_email_notifications'/);
  assert.doesNotMatch(source,/sender_id:session\.user\.id[\s\S]*chat_body:body/);
});

test('Proposed Community email function prevents impersonation and arbitrary-body fan-out',()=>{
  assert.match(hardening,/CREATE OR REPLACE FUNCTION public\.queue_community_message_email/);
  assert.match(hardening,/IF auth\.uid\(\) IS NULL THEN/);
  assert.match(hardening,/WHERE id=target_message_id[\s\S]*AND user_id=auth\.uid\(\)[\s\S]*AND is_deleted=false/);
  assert.match(hardening,/p\.verification_status='approved'/);
  assert.match(hardening,/coalesce\(np\.email_enabled,true\)=true/);
  assert.match(hardening,/coalesce\(np\.community_email_enabled,false\)=true/);
  assert.match(hardening,/ON CONFLICT\(dedupe_key\) WHERE dedupe_key IS NOT NULL DO NOTHING/);
  assert.match(hardening,/'community-chat:'\|\|message_row\.id::text\|\|':'\|\|recipient\.id::text/);
  assert.match(hardening,/queue_community_email_notifications/);
  assert.match(hardening,/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(hardening,/GRANT EXECUTE ON FUNCTION public\.queue_community_email_notifications.*authenticated/s);
});

test('New Community email RPC is authenticated-only and old arbitrary-body RPC is server-only',()=>{
  assert.match(hardening,/queue_community_message_email/);
  assert.match(hardening,/GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role/);
  assert.match(hardening,/queue_community_email_notifications/);
  assert.match(hardening,/GRANT EXECUTE ON FUNCTION %s TO service_role/);
  assert.match(hardening,/has_function_privilege\('authenticated',old_community_oid,'EXECUTE'\)/);
  assert.match(hardening,/NOT has_function_privilege\('authenticated',new_community_oid,'EXECUTE'\)/);
});

test('Existing schema script explicitly revokes queue-claim grants rather than relying on PUBLIC defaults',()=>{
  assert.match(schema,/revoke execute on function public\.claim_email_notification_batch\(integer\)\s+from PUBLIC, anon, authenticated/);
  assert.match(schema,/grant execute on function public\.claim_email_notification_batch\(integer\) to service_role/);
});

test('Review-only security scripts are never production CI entry points',()=>{
  for(const content of [acl,hardening]){
    assert.match(content,/DO NOT|NOT APPLIED|NOT EXECUTED|REVIEW ONLY/i);
    assert.match(content,/BEGIN;/);
    assert.match(content,/COMMIT;/);
  }
  const workflow=read('.github/workflows/agent-settings-review-gate.yml');
  assert.doesNotMatch(workflow,/psql\s|supabase db|apply_migration|deploy/);
  assert.doesNotMatch(workflow,/agent-founder-rpc-privilege-hardening\.DO-NOT-RUN\.review\.sql/);
});
