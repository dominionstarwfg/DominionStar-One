import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const flags=read('assets/js/member-login-google-flags.js');
const settings=read('account-settings/index.html');
const linking=read('assets/js/account-google-identity-review.js');
const css=read('assets/css/account-google-identity-review.css');
const login=read('assets/js/member-login.js');

test('Google access and linking remain separately disabled until release approval',()=>{
  assert.match(flags,/googleSignIn:\s*false/);
  assert.match(flags,/googleIdentityLinking:\s*false/);
  assert.match(linking,/googleIdentityLinking !== true\) return/);
  assert.match(settings,/id="googleIdentitySettings" class="ds-google-identity member-hidden"/);
  assert.match(settings,/member-login-google-flags\.js/);
  assert.match(css,/\.ds-google-identity\.member-hidden\{display:none!important\}/);
});

test('Google linking starts only after verifying the current approved member profile and Agent Code',()=>{
  assert.match(linking,/client\.auth\.getUser\(\)/);
  assert.match(linking,/\.from\('member_profiles'\)/);
  assert.match(linking,/\.select\('agent_code,verification_status'\)/);
  assert.match(linking,/\.eq\('id',user\.id\)\.single\(\)/);
  assert.match(linking,/verification_status!=='approved'/);
  assert.match(linking,/agent_code/);
  assert.match(linking,/const fresh=await requireApprovedMember\(\)/);
  assert.match(linking,/\.auth\.linkIdentity\(\{/);
  assert.match(linking,/provider:'google'/);
  assert.doesNotMatch(linking,/user_metadata\?.*verification_status/);
});

test('Google linked-identity confirmation checks the verified Supabase Auth identity list',()=>{
  assert.match(linking,/user\.identities\|\|\[\]/);
  assert.match(linking,/identity\.provider==='google'/);
  assert.match(linking,/Complete the Google verification screen/);
  assert.match(linking,/if\(new URLSearchParams\(location\.search\)\.get\('google_link'\)==='complete'\)/);
  assert.match(linking,/Google linking was not confirmed/);
  assert.match(login,/\.auth\.signInWithOAuth\(\{/);
  assert.match(login,/verified\.data\?\.verification_status!=='approved'/);
});

test('Security settings are not replaced and only the new optional section is appended',()=>{
  for(const id of ['passwordForm','securityResult','signOutOtherSessions','currentSessionEmail'])
    assert.ok(settings.includes('id="'+id+'"'));
  assert.match(settings,/data-settings-panel="privacy-security"/);
  assert.match(settings,/account-google-identity-review\.js/);
});
