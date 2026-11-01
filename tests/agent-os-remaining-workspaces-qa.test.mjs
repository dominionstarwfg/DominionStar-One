import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const profileHtml=read('professional-profile/index.html');
const profileJs=read('assets/js/professional-profile.js');
const directoryJs=read('assets/js/member-directory.js');
const css=read('assets/css/dominionstar-cinematic-os.css');

test('profile identity uses real signed photo or initials, never the company logo fallback',()=>{
  assert.match(profileHtml,/id="profileAvatarInitials"/);
  assert.match(profileHtml,/id="profileAvatarPreview" class="member-hidden"/);
  assert.doesNotMatch(profileHtml,/id="profileAvatarPreview"[^>]*src="\/assets\/logo\.jpeg"/);
  assert.doesNotMatch(profileHtml,/Exclusive Edition/);
  assert.match(profileJs,/const profileInitials = value/);
  assert.match(profileJs,/showAvatarFallback/);
  assert.match(profileJs,/showAvatarImage/);
  assert.match(profileJs,/createSignedUrl\(path, 3600\)/);
  assert.match(profileJs,/avatarPreview\.onerror = \(\) => showAvatarFallback\(\)/);
  assert.doesNotMatch(profileJs,/avatarPreview\.src = '\/assets\/logo\.jpeg'/);
});

test('member directory keeps initials behind signed member photos',()=>{
  assert.match(directoryJs,/const initials=name=>/);
  assert.match(directoryJs,/class="member-directory-fallback"/);
  assert.match(directoryJs,/class="member-directory-photo"/);
  assert.match(directoryJs,/wireAvatarFallbacks\(grid\)/);
  assert.match(directoryJs,/image\.addEventListener\('error',\(\)=>image\.remove\(\)/);
});

test('remaining workspaces are explicitly finished in the cinematic design system',()=>{
  for(const selector of [
    'body.ds-auth-os-page .appointment-center-grid>.member-panel',
    'body.ds-auth-os-page .recognition-post',
    'body.ds-auth-os-page .agent-learning-card',
    'body.ds-auth-os-page .ds-agent-meet-bridge',
    'body.ds-auth-os-page .profile-avatar-fallback',
    'body.ds-auth-os-page .member-directory-photo'
  ]) assert.ok(css.includes(selector),selector+' missing');
  assert.doesNotMatch(css,/\b2030\b/);
});
