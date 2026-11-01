import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('assets/css/dominionstar-cinematic-os.css');
const messages=read('assets/js/direct-messages.js');

test('cinematic OS outranks high-specificity legacy light controls',()=>{
  for(const selector of [
    'body.ds-auth-os-page .settings-field select',
    'body.ds-auth-os-page .settings-form input',
    'body.ds-auth-os-page.dm-os-body .dm-os',
    'body.ds-auth-os-page .dm-conversation',
    'body.ds-auth-os-page .dm-thread',
    'body.ds-auth-os-page .dm-member-panel',
    'body.ds-auth-os-page .member-directory-actions .btn'
  ]) assert.ok(css.includes(selector),selector+' override missing');
  assert.match(css,/background:rgba\(8,25,49,.92\)!important/);
  assert.match(css,/linear-gradient\(135deg,#f4cd72,#d69b31\)!important/);
  assert.doesNotMatch(css,/\b2030\b/);
});

test('Messages uses signed member photos with resilient initials fallback',()=>{
  assert.match(messages,/\.select\('id,full_name,preferred_name,rank,agent_code,smd_name,verification_status,avatar_path'\)/);
  assert.match(messages,/\.from\('member-avatars'\)[\s\S]*createSignedUrl\(member\.avatar_path, 3600\)/);
  assert.match(messages,/class="dm-avatar-fallback member-hidden"/);
  assert.match(messages,/class="dm-avatar-photo"/);
  assert.match(messages,/const wireAvatarFallback = root =>/);
  assert.match(messages,/image\.addEventListener\('error'/);
  assert.match(messages,/fallback\?\.classList\.remove\('member-hidden'\)/);
  assert.match(messages,/wireAvatarFallback\(list\)/);
  assert.match(messages,/wireAvatarFallback\(element\)/);
});

test('cinematic stylesheet is loaded after shared light-era stylesheet on core workspaces',()=>{
  for(const path of [
    'direct-messages/index.html','notifications/index.html','community/index.html',
    'member-directory/index.html','agent-journey/index.html','account-settings/index.html',
    'professional-profile/index.html'
  ]){
    const html=read(path);
    const cinematic=html.indexOf('dominionstar-cinematic-os.css');
    assert.ok(cinematic>0,path+' cinematic stylesheet missing');
    const auth=html.indexOf('dominionstar-auth-os-v2.css');
    if(auth>=0) assert.ok(cinematic>auth,path+' must load cinematic CSS after auth OS CSS');
  }
});
