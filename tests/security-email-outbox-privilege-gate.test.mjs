import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const preflight=read('scripts/security/email-outbox-acl-preflight.review.sql');
const plan=read('scripts/security/email-outbox-acl-lockdown.DO-NOT-RUN.review.sql');
const processor=read('netlify/functions/process-email-outbox.mjs');
const scheduled=read('netlify/functions/scheduled-email-outbox.mjs');
const releaseGate=read('docs/security-review-notification-outbox-rpc-20261028.md');

test('Preflight is read-only and does not invoke sensitive queue claim',()=>{
  assert.match(preflight,/READ ONLY/);
  assert.match(preflight,/has_function_privilege\('anon'/);
  assert.match(preflight,/has_function_privilege\('authenticated'/);
  assert.match(preflight,/has_function_privilege\('service_role'/);
  assert.match(preflight,/SELECT[\s\S]*?pg_proc/);
  assert.doesNotMatch(preflight,/^\s*(?:UPDATE|DELETE|INSERT|CALL|GRANT|REVOKE)\b/mi);
  assert.doesNotMatch(preflight,/SELECT\s+\*\s+FROM\s+public\.email_notification_outbox/i);
});

test('Planned lockdown excludes public roles while preserving processor role',()=>{
  assert.match(plan,/SECURITY CHANGE PROPOSAL, NOT APPROVED OR APPLIED/);
  assert.match(plan,/BEGIN;/);
  assert.match(plan,/COMMIT;/);
  assert.match(plan,/REVOKE EXECUTE ON FUNCTION public\.claim_email_notification_batch\(integer\)/);
  assert.match(plan,/FROM PUBLIC, anon, authenticated/);
  assert.match(plan,/GRANT EXECUTE ON FUNCTION public\.claim_email_notification_batch\(integer\)/);
  assert.match(plan,/TO service_role/);
  assert.match(plan,/has_function_privilege\('anon'/);
  assert.match(plan,/has_function_privilege\('authenticated'/);
  assert.match(plan,/has_function_privilege\('service_role'/);
  assert.doesNotMatch(plan,/GRANT EXECUTE[\s\S]*?TO (?:anon|authenticated)/);
});

test('Existing email processor uses service-role Supabase client after authorization',()=>{
  assert.match(processor,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(processor,/createClient\(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(processor,/rpc\('claim_email_notification_batch',\{batch_size:25\}\)/);
  const guard=processor.indexOf("if(!secretAuthorized)");
  const claim=processor.indexOf("rpc('claim_email_notification_batch'");
  assert.ok(guard>=0&&claim>guard,'Caller authorization must precede privileged queue claim');
  assert.match(scheduled,/processOutbox/);
  assert.match(scheduled,/EMAIL_PROCESSOR_SECRET/);
});

test('Security hardening remains an explicit separate production-change gate',()=>{
  assert.match(releaseGate,/REVIEW ONLY/);
  assert.match(releaseGate,/No live grants/);
  assert.match(plan,/must NEVER be executed by CI/);
  assert.match(plan,/explicit production-change approval/);
});
