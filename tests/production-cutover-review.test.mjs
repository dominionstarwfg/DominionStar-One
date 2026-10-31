import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pre=read('scripts/security/agent-os-production-preflight.READ-ONLY.review.sql');
const post=read('scripts/security/agent-os-postcutover-verify.READ-ONLY.review.sql');
const plan=read('docs/agent-os-production-cutover-20261029.md');
const flags=read('assets/js/notification-feature-flags.js');

test('production preflight and verifier remain read-only',()=>{
  for(const sql of [pre,post]){
    assert.doesNotMatch(sql,/^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL)\b/mi);
  }
});

test('cutover installs additive read-state RPC before the browser deployment',()=>{
  const phase1=plan.indexOf('Phase 1 — Additive RPC before deploy');
  const phase2=plan.indexOf('Phase 2 — Deploy the reviewed Agent/Founder OS code');
  assert.ok(phase1>=0&&phase2>phase1);
  assert.match(plan,/notification-read-state\.DO-NOT-RUN\.review\.sql/);
});

test('privilege-revoking migrations have a frozen post-deploy order',()=>{
  const ordered=[
    'direct-message-integrity.DO-NOT-RUN.review.sql',
    'agent-founder-rpc-privilege-hardening.DO-NOT-RUN.review.sql',
    'communication-call-lifecycle.DO-NOT-RUN.review.sql',
    'notification-email-opt-in-reset.DO-NOT-RUN.review.sql',
    'web-push-foundation.DO-NOT-RUN.review.sql'
  ];
  let previous=-1;
  for(const item of ordered){
    const at=plan.indexOf(item);
    assert.ok(at>previous,'Migration order drift: '+item);
    previous=at;
  }
  assert.match(plan,/Do not reorder #1–#5/);
});

test('post-cutover release enables trusted message events while Web Push stays disabled',()=>{
  assert.match(flags,/trustedMessageEvents:true/);
  assert.match(flags,/webPush:false/);
  assert.match(plan,/trustedMessageEvents: false → true/);
  assert.match(plan,/webPush: false/);
});

test('Web Push server configuration is a separate activation gate',()=>{
  for(const name of [
    'VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT',
    'PUSH_PROCESSOR_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'
  ]) assert.ok(plan.includes(name),name);
  assert.match(plan,/Web Push activation is a separate gate/);
});

test('post-cutover verification requires hardened message call and event privileges',()=>{
  assert.match(post,/direct_message_rpc_integrity/);
  assert.match(post,/executive_event_privileges/);
  assert.match(post,/communication_call_rpc_integrity/);
  assert.match(post,/notification_email_opt_in/);
  assert.match(post,/trusted_direct_message_trigger/);
  assert.match(post,/web_push_foundation/);
  assert.match(post,/anon_non_meet_security_definer_zero/);
});
