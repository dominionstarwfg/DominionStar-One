import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('member-login/index.html');
const js=read('assets/js/member-login.js');
const css=read('assets/css/member-login-executive-v1.css');
const flags=read('assets/js/member-login-google-flags.js');

test('Agent Code is explicitly required during registration and stored for Founder verification',()=>{
  assert.match(html,/name="agent_code"[^>]*required>/);
  assert.match(html,/id="registrationAgentCodeHelp"/);
  assert.match(html,/assigned to you by your agency or team/);
  assert.match(js,/const agentCode = registerForm\.agent_code\.value\.trim\(\)\.toUpperCase\(\)/);
  assert.match(js,/if\(!agentCode \|\| agentCode\.length>50\)/);
  assert.match(js,/supabase\.auth\.signUp\(/);
  assert.match(js,/agent_code: agentCode/);
  assert.match(js,/Founder approval is still required/);
});

test('Google provider is a review-only opt-in, not an always-on auth shortcut',()=>{
  assert.match(flags,/googleSignIn:\s*false/);
  assert.match(js,/DOMINIONSTAR_AUTH_FEATURES\?\.googleSignIn === true/);
  assert.match(html,/id="memberGoogleSignIn" class="login2-google-section member-hidden"/);
  assert.match(css,/\.login2-google-section\.member-hidden\{display:none!important\}/);
  assert.match(js,/tabName !== 'login'/);
  assert.match(js,/signInWithOAuth\(/);
  assert.match(js,/provider:'google'/);
  assert.match(js,/options:\{redirectTo\}/);
});

test('Google callback verifies stored approved profile and registered Agent Code',()=>{
  assert.match(js,/supabase\.auth\.getUser\(\)/);
  assert.match(js,/from\('member_profiles'\)/);
  assert.match(js,/\.select\('id,agent_code,verification_status'\)/);
  assert.match(js,/\.eq\('id',auth\.data\.user\.id\)/);
  assert.match(js,/verified\.data\?\.verification_status!=='approved'/);
  assert.match(js,/verified\.data\?\.agent_code/);
  assert.match(js,/await supabase\.auth\.signOut\(\)/);
  assert.match(js,/window\.location\.replace\('\/member-dashboard\/'\)/);
  assert.doesNotMatch(js,/auth\.data\.user\.user_metadata\?\.verification_status/);
});

test('All regular login and recovery actions still exist',()=>{
  assert.match(js,/signInWithPassword\(/);
  assert.match(js,/resetPasswordForEmail\(/);
  assert.match(js,/memberRegisterForm/);
  assert.match(html,/memberResetForm/);
});
