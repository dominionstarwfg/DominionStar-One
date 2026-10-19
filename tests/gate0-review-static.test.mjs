// Gate 0 security review: dependency-free static regression tests.
 // Run locally: node --test tests/gate0-review-static.test.mjs
 // These DO NOT prove RLS safety or replace actual staging JWT tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('DM client authorizes member status before initializing communications', () => {
  const src = read('assets/js/direct-messages.js');
  const identity = src.indexOf(".eq('id', session.user.id)");
  const status = src.indexOf("approval.data?.verification_status === 'approved'");
  const failClosed = src.indexOf("if (!approvedAgent)");
  const bootstrap = src.indexOf('await window.CommunicationEngine?.init({client,session})');
  const showApp = src.indexOf("app.classList.remove('member-hidden')");
  assert.ok(identity > 0, 'Current member profile must be requested');
  assert.ok(identity < status, 'Profile lookup must precede the approval check');
  assert.ok(status < failClosed, 'Status validation must precede denial branch');
  assert.ok(failClosed < bootstrap, 'Unapproved agents must not initialize messaging');
  assert.ok(bootstrap < showApp, 'Messaging UI must stay hidden until approved');
  assert.match(src.slice(status, bootstrap), /gate\.textContent\s*=/);
  assert.doesNotMatch(src.slice(status, bootstrap), /gate\.innerHTML\s*=/);
});

test('DM INSERT candidate enforces sender identity and both approvals', () => {
  const sql = read('supabase/gate0-review/04_dm_approved_sender_policy.sql');
  assert.match(sql, /ALTER POLICY "members send direct messages"/i);
  assert.match(sql, /sender_id\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /sender_profile\.verification_status\s*=\s*'approved'/i);
  assert.match(sql, /recipient_profile\.verification_status\s*=\s*'approved'/i);
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/);
});

test('Notification RPC candidate removes anonymous and member grants', () => {
  const sql = read('supabase/gate0-review/01_notification_rpc_lockdown.sql');
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.claim_email_notification_batch\(integer\) FROM PUBLIC;/);
  assert.match(sql, /FROM anon;/);
  assert.match(sql, /FROM authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.claim_email_notification_batch\(integer\) TO service_role;/);
});

test('Candidate SQL stays out of automatic migration and public deployment paths', () => {
  const netlify = read('scripts/build-public-netlify.sh');
  assert.match(netlify, /--exclude 'supabase\/'/);
  const readme = read('supabase/gate0-review/README.md');
  assert.match(readme, /not\s+in the automatic.*supabase\/migrations/smi);
});

// These source tests are necessary but never sufficient.
// Before production changes: synthetic JWT policy tests and worker integration
// tests on a genuinely separate database are mandatory.
