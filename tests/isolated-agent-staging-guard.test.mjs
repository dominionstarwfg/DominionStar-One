import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateStagingConfig} from '../scripts/verify-isolated-agent-staging.mjs';

const stagingScript=readFileSync(
  new URL('../scripts/verify-isolated-agent-staging.mjs',import.meta.url),'utf8');
const base={
  DOMINIONSTAR_STAGING_ISOLATION_APPROVED:'STAGING_ONLY',
  DOMINIONSTAR_STAGING_SUPABASE_URL:'https://staging-only-abcdefghijkl.supabase.co/',
  DOMINIONSTAR_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_STAGING_TEST_ONLY',
  DOMINIONSTAR_STAGING_TEST_MEMBER_A_EMAIL:'member-a@example.test',
  DOMINIONSTAR_STAGING_TEST_MEMBER_B_EMAIL:'member-b@example.test',
  DOMINIONSTAR_STAGING_TEST_MEMBER_A_PASSWORD:'sample-staging-password-a',
  DOMINIONSTAR_STAGING_TEST_MEMBER_B_PASSWORD:'sample-staging-password-b'
};
test('Staging read-only checks refuse production and unauthorized environments',()=>{
  assert.throws(()=>validateStagingConfig({...base,
    DOMINIONSTAR_STAGING_ISOLATION_APPROVED:''}),/Staging authorization missing/);
  assert.throws(()=>validateStagingConfig({...base,
    DOMINIONSTAR_STAGING_SUPABASE_URL:'https://ckmurvhjumzlhsegncba.supabase.co/'}),
    /Refusing production/);
  assert.throws(()=>validateStagingConfig({...base,
    DOMINIONSTAR_STAGING_SUPABASE_URL:'https://localhost:54321/'}),
    /Refusing production or non-isolated/);
  assert.throws(()=>validateStagingConfig({...base,
    DOMINIONSTAR_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_secret_NOT_ALLOWED'}),
    /secret\/service keys are forbidden/);
  assert.throws(()=>validateStagingConfig({...base,
    DOMINIONSTAR_STAGING_TEST_MEMBER_B_EMAIL:base.DOMINIONSTAR_STAGING_TEST_MEMBER_A_EMAIL}),
    /Two different synthetic approved staging member credentials/);
});

test('Staging validator is pure and accepts isolated synthetic credentials',()=>{
  const config=validateStagingConfig(base);
  assert.equal(config.url,base.DOMINIONSTAR_STAGING_SUPABASE_URL.slice(0,-1));
  assert.equal(config.a,base.DOMINIONSTAR_STAGING_TEST_MEMBER_A_EMAIL);
  assert.equal(config.b,base.DOMINIONSTAR_STAGING_TEST_MEMBER_B_EMAIL);
});

test('Staging harness checks actual RLS, not changing or sending real data',()=>{
  assert.match(stagingScript,/\.from\('member_profiles'\)[\s\S]*select\('id,email,phone,address_line1,account_notes'\)/);
  assert.match(stagingScript,/\.from\('member_public_profiles'\)/);
  assert.match(stagingScript,/\.from\('notification_preferences'\)/);
  assert.match(stagingScript,/\.from\('executive_events'\)/);
  assert.match(stagingScript,/\.from\('email_notification_outbox'\)/);
  assert.match(stagingScript,/auth\.getUser\(\)/);
  assert.match(stagingScript,/email_confirmed_at/);
  assert.doesNotMatch(stagingScript,/\.insert\(|\.update\(|\.delete\(|claim_email_notification_batch|emails\.send/);
  assert.match(stagingScript,/ISOLATED_AGENT_STAGING_READ_ONLY_PASS/);
});
