import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const apply=read('scripts/github/apply-main-release-protection.sh');
const verify=read('scripts/github/verify-main-release-protection.sh');

const required=[
  'Verify authenticated Agent and Founder OS',
  'Verify Agent OS notification and readability review',
  'Build & validate review package — never deploy',
  'Verify main release controls'
];

test('branch protection installer requires an externally supplied admin token',()=>{
  assert.match(apply,/GH_TOKEN/);
  assert.match(apply,/repository administration permission/);
  assert.doesNotMatch(apply,/ghp_[A-Za-z0-9]+/);
  assert.doesNotMatch(apply,/github_pat_[A-Za-z0-9_]+/);
});

test('branch protection installer enforces pull request review and stale-review dismissal',()=>{
  assert.match(apply,/"required_pull_request_reviews"/);
  assert.match(apply,/"required_approving_review_count": 1/);
  assert.match(apply,/"dismiss_stale_reviews": true/);
  assert.match(apply,/"required_conversation_resolution": true/);
});

test('branch protection installer blocks force pushes and branch deletion',()=>{
  assert.match(apply,/"allow_force_pushes": false/);
  assert.match(apply,/"allow_deletions": false/);
  assert.match(apply,/"enforce_admins": true/);
});

test('installer and verifier require all four release checks',()=>{
  for(const name of required){
    assert.ok(apply.includes(name),name+' missing from installer');
    assert.ok(verify.includes(name),name+' missing from verifier');
  }
});

test('installer verifies protection after applying it',()=>{
  assert.match(apply,/protected!==true/);
  assert.match(apply,/missing required checks/);
  assert.match(apply,/enforcement_level==='off'/);
  assert.match(apply,/DOMINIONSTAR_MAIN_PROTECTION_OK/);
});

test('release-control scripts do not deploy application code or mutate Supabase',()=>{
  for(const body of [apply,verify]){
    assert.doesNotMatch(body,/netlify deploy/);
    assert.doesNotMatch(body,/supabase db push/);
    assert.doesNotMatch(body,/apply_migration/);
    assert.doesNotMatch(body,/execute_sql/);
  }
});
