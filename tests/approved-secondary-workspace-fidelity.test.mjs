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


test('account settings, profile and Community labels are readable over dark surfaces',()=>{
  const selectors=[
    '.settings-panel .settings-field',
    '.profile-section-card .member-grid label',
    '.dsmedia-caption-label',
    '.dsmedia-post-options summary',
    '.dsmedia-action-row .dsmedia-attach-button'
  ];
  for(const selector of selectors)assert.ok(css.includes(selector),selector+' contrast lock missing');
  assert.match(css,/\.settings-panel \.settings-field,[\s\S]*color:#dbe7f5!important/);
  assert.match(css,/\.profile-section-card \.member-grid label,[\s\S]*color:#dce8f6!important/);
  assert.match(css,/\.dsmedia-caption-label,[\s\S]*color:#e5eef9!important/);
  assert.match(css,/\.dsmedia-action-row \.dsmedia-attach-button,[\s\S]*color:#e6f2ff!important/);
});

test('Notifications preview does not render dead native preference toggles',()=>{
  assert.match(notifications,/class="dsx-preferences-link" href="\/account-settings\/#notifications"/);
  assert.doesNotMatch(notifications,/id="notificationSoundSetting"/);
  assert.doesNotMatch(notifications,/id="notificationBrowserSetting"/);
});

test('directory member loading is independent of presence and has explicit retry state',()=>{
  const directory=read('assets/js/member-directory.js');
  assert.match(directory,/await load\(\);/);
  assert.doesNotMatch(directory,/await client\.rpc\('community_set_presence'.*\);await load\(\)/);
  assert.match(directory,/id="directoryRetry"/);
  assert.match(directory,/Promise\.race/);
  assert.match(directory,/try\{[\s\S]*createSignedUrl\(path,3600\)/);
  const build=read('scripts/build-public-netlify.sh');
  assert.match(build,/VISUAL SAMPLE ONLY/);
  assert.match(build,/Sample profile · no live data/);
});


test('isolated visual review keeps the desktop Messages workspace in its true grid',()=>{
  const preview=read('scripts/build-public-netlify.sh');
  assert.match(preview,/#dmApp\.dm-os\.dm-os-three\{display:grid!important\}/);
  assert.doesNotMatch(preview,/#feedApp,#communityApp,#dmApp,#notificationApp/);
  assert.match(messages,/<main id="dmApp" class="dm-os dm-os-three member-hidden">/);
  assert.match(messages,/<aside class="dm-sidebar">/);
  assert.match(messages,/<section class="dm-chat">/);
  assert.match(messages,/<aside id="dmMemberPanel" class="dm-member-panel">/);
  assert.match(messages,/<form id="dmForm" class="dm-composer">/);
});


test('Messages member details have sufficient width and hierarchy on desktop',()=>{
  assert.match(css,/\.dm-os\.dm-os-three\{[\s\S]*minmax\(265px,285px\)!important/);
  assert.match(css,/\.dm-member-facts>div\{[\s\S]*grid-template-columns:minmax\(85px,1fr\) minmax\(0,1\.15fr\)!important/);
  assert.match(css,/#dmAttachmentButton\{[\s\S]*color:#87baff!important/);
  assert.match(css,/#dmEmojiButton\{[\s\S]*color:#f0c15b!important/);
});

test('review preview anchors short conversations at bottom with compact message entry',()=>{
  const build=read('scripts/build-public-netlify.sh');
  assert.match(build,/body\.ds-visual-review #dmThread\{[\s\S]*justify-content:flex-end!important/);
  assert.match(build,/body\.ds-visual-review #dmForm textarea\{[\s\S]*height:44px!important/);
  assert.match(build,/body\.ds-visual-review \.dm-member-panel\{display:block!important\}/);
  assert.match(css,/\.dm-composer textarea\{[\s\S]*max-height:130px!important/);
});
