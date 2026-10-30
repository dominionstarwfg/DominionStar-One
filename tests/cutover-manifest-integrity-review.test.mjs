import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=read('docs/agent-os-cutover-manifest-20261030.md');
const rollback=read('scripts/security/agent-os-emergency-compatibility-rollback.DO-NOT-RUN.review.sql');

const entries=[
  ['scripts/security/agent-os-production-preflight.READ-ONLY.review.sql','99f4bcd77db52409c63b62d956b5c525220a8562'],
  ['scripts/security/notification-read-state.DO-NOT-RUN.review.sql','469154cf0be188d5783df6501e9e7b27914ad2fe'],
  ['scripts/security/direct-message-integrity.DO-NOT-RUN.review.sql','1395765416a5a17382a039f52c1a5543fa02f59b'],
  ['scripts/security/agent-founder-rpc-privilege-hardening.DO-NOT-RUN.review.sql','5fcab25534ddf0d1ad549532421daef7d6aa20e4'],
  ['scripts/security/communication-call-lifecycle.DO-NOT-RUN.review.sql','4fefda45f8b5f94fb9b6d3ddb0d24897dcbbc208'],
  ['scripts/security/notification-email-opt-in-reset.DO-NOT-RUN.review.sql','546a446844903492f2bfa04823e0cb26dbabd54e'],
  ['scripts/security/web-push-foundation.DO-NOT-RUN.review.sql','e25d5bf2d7ca6ba0c2f8b4143a256a5e5db91553'],
  ['scripts/security/agent-os-postcutover-verify.READ-ONLY.review.sql','2bfa9f1a171cd2a987af573bead31176e47c2d65'],
  ['scripts/security/agent-os-emergency-rollback-preflight.READ-ONLY.review.sql','98652c171e6a8f5b98d107ec4442c9775e8869e2'],
  ['scripts/security/agent-os-emergency-compatibility-rollback.DO-NOT-RUN.review.sql','d837e4aa8a1b9b95d5c12a58fe1908e8a740da3d']
];

const gitBlobSha=content=>{
  const bytes=Buffer.from(content,'utf8');
  return createHash('sha1').update(Buffer.concat([
    Buffer.from('blob '+bytes.length+'\0'),
    bytes
  ])).digest('hex');
};

test('cutover manifest fingerprints exactly match the current database artifacts',()=>{
  for(const [path,expected] of entries){
    const actual=gitBlobSha(read(path));
    assert.equal(actual,expected,path+' blob SHA drifted');
    assert.ok(manifest.includes('`'+expected+'`'),path+' fingerprint missing from manifest');
    assert.ok(manifest.includes('`'+path+'`'),path+' missing from manifest');
  }
});

test('manifest preserves frozen migration order and execution refusal conditions',()=>{
  let previous=-1;
  for(const [path] of entries.slice(0,8)){
    const at=manifest.indexOf(path);
    assert.ok(at>previous,'Manifest order drift: '+path);
    previous=at;
  }
  assert.match(manifest,/final approved PR head[\s\S]{0,40}must be recorded/i);
  assert.match(manifest,/branch is behind/);
  assert.match(manifest,/communication call is ringing or connected/);
  assert.match(manifest,/email outbox has a row in/);
});

test('emergency compatibility rollback never restores anonymous browser access',()=>{
  assert.match(rollback,/REVOKE ALL ON TABLE public\.direct_messages FROM anon/);
  assert.match(rollback,/REVOKE ALL ON TABLE public\.executive_events FROM anon, authenticated/);
  assert.match(rollback,/GRANT SELECT,INSERT,UPDATE ON TABLE public\.executive_events TO authenticated/);
  assert.match(rollback,/FROM PUBLIC, anon/);
  assert.doesNotMatch(rollback,/GRANT EXECUTE[^\n]*TO anon/);
  assert.doesNotMatch(rollback,/GRANT .* ON TABLE .* TO anon/);
});

test('emergency rollback prevents trusted-message duplication before old browser code returns',()=>{
  assert.match(rollback,/DROP TRIGGER IF EXISTS emit_direct_message_notification_trigger/);
  assert.match(rollback,/CREATE POLICY "members create executive events"/);
  assert.match(rollback,/actor_id=auth\.uid\(\)[\s\S]*member_id IS NOT NULL/);
});

test('emergency rollback restores only compatibility surfaces and leaves call hardening intact',()=>{
  assert.match(rollback,/GRANT UPDATE ON TABLE public\.direct_messages TO authenticated/);
  assert.match(rollback,/CREATE POLICY "members update own executive events"/);
  assert.match(rollback,/queue_community_email_notifications/);
  assert.doesNotMatch(rollback,/GRANT .*communication_calls/);
  assert.doesNotMatch(rollback,/DROP FUNCTION public\.start_my_communication_call/);
});
