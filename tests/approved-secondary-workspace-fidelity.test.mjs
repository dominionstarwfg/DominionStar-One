import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('assets/css/dominionstar-cinematic-os.css');
const messages=read('direct-messages/index.html');
const notifications=read('notifications/index.html');
const community=read('community/index.html');
const profile=read('professional-profile/index.html');
const settings=read('account-settings/index.html');

test('ordinary workspace actions no longer use premium gold classes',()=>{
  assert.doesNotMatch(messages,/id="dmConfirmForward"[^>]*btn-gold/);
  assert.doesNotMatch(notifications,/id="markAllNotifications"[^>]*btn-gold/);
  assert.doesNotMatch(community,/id="communityPostSubmit"[^>]*btn-gold/);
  assert.doesNotMatch(community,/href="\/community-chat\/"[^>]*btn-gold/);
  assert.doesNotMatch(profile,/Save Profile Changes<\/button>[\s\S]{0,20}btn-gold/);
  assert.doesNotMatch(settings,/Update Password[\s\S]{0,20}btn-gold/);
  assert.match(messages,/id="dmConfirmForward" class="btn dsx-action-primary"/);
  assert.match(notifications,/id="markAllNotifications" class="btn dsx-action-primary"/);
  assert.match(community,/id="communityPostSubmit" class="btn dsx-action-primary"/);
  assert.match(profile,/class="btn dsx-action-primary" type="submit">Save Profile Changes/);
  assert.match(settings,/class="btn dsx-action-primary" type="submit">[\s\S]*Update Password/);
});

test('secondary authenticated workspaces use approved compact proportions',()=>{
  for(const selector of [
    '#communityApp>.member-dashboard-header',
    '.profile-stable-layout',
    '.settings-layout',
    '.dm-os.dm-os-three',
    '.notification-center>header'
  ]) assert.ok(css.includes(selector),selector+' missing');

  assert.match(css,/\.community-hub-layout\{[\s\S]*285px!important/);
  assert.match(css,/\.profile-stable-layout\{[\s\S]*220px minmax\(0,1fr\)!important/);
  assert.match(css,/\.settings-layout\{[\s\S]*190px minmax\(0,1fr\)!important/);
  assert.match(css,/\.dm-os\.dm-os-three\{[\s\S]*295px[\s\S]*285px/);
  assert.match(css,/\.notification-layout\{[\s\S]*250px!important/);
  assert.match(css,/\.notification-item\{[\s\S]*min-height:64px!important/);
});

test('Messages Journey action stays inside authenticated Agent OS',()=>{
  assert.match(messages,/id="dmRecognitionLink"[^>]*href="\/agent-journey\/"/);
  assert.doesNotMatch(messages,/id="dmRecognitionLink"[^>]*href="\/journey\/"/);
});

test('approved semantic color hierarchy remains intact',()=>{
  assert.match(css,/\.dsx-action-primary\{[\s\S]*#2583f7[\s\S]*#126be2/);
  assert.match(css,/--dsx-gold:#f0c15b/);
  assert.match(css,/--dsx-blue:#1877f2/);
  assert.match(css,/--dsx-danger:#ff4d5a/);
  assert.match(css,/--dsx-success:#35d07f/);
  assert.match(css,/--dsx-warning:#f2c94c/);
  assert.doesNotMatch(css,/\b2030\b/);
});
