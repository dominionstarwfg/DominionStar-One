import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dashboard=read('member-dashboard/index.html');
const notifications=read('notifications/index.html');
const noticesJs=read('assets/js/notifications-center.js');
const communityJs=read('assets/js/community-hub.js');
const messages=read('direct-messages/index.html');
const messagesJs=read('assets/js/direct-messages.js');
const css=read('assets/css/dominionstar-cinematic-os.css');
const preview=read('scripts/build-public-netlify.sh');

test('Dashboard quick actions retain their routes and carry SVG pictograms',()=>{
  const quickStart=dashboard.indexOf('class="dsx-quick-grid dsx-quick-grid-six"');
  assert.ok(quickStart>=0,'Dashboard quick-action grid missing');
  const quickEnd=dashboard.indexOf('</div>',quickStart);
  const quick=dashboard.slice(quickStart,quickEnd);
  const expected=[
    ['#dashboardComposerBody','ds30-edit'],
    ['/meet/','ds30-video'],
    ['/appointments/','ds30-calendar'],
    ['/agent-learning/','ds30-book'],
    ['/member-directory/','ds30-users'],
    ['/community/','ds30-community']
  ];
  for(const [destination,symbol] of expected){
    const pos=quick.indexOf('href="'+destination+'"');
    assert.ok(pos>=0,'Missing quick action for '+destination);
    const link=quick.slice(quick.lastIndexOf('<a',pos),quick.indexOf('</a>',pos)+4);
    assert.ok(link.includes('href="#'+symbol+'"'),'Missing identifiable icon: '+symbol);
    assert.match(link,/aria-label="/);
  }
  for(const id of ['ds30-photo','ds30-video','ds30-attach','ds30-poll','ds30-send']){
    assert.ok(dashboard.includes('href="#'+id+'"'),id+' must have a recognizable icon');
  }
  assert.doesNotMatch(quick,/>✎/);
});

test('Notifications have recognizable category SVGs and labeled filter controls',()=>{
  assert.doesNotThrow(()=>new vm.Script(noticesJs));
  assert.match(noticesJs,/const notificationPaths=/);
  assert.match(noticesJs,/dsx-notice-symbol/);
  for(const category of ['communications','calls','meetings','journey','recognition']){
    assert.match(noticesJs,new RegExp(category+":'<"));
    assert.match(notifications,new RegExp('data-filter="'+category+'"'));
  }
  assert.match(notifications,/id="markAllNotifications"[\s\S]*?class="dsx-inline-action-icon"/);
});

test('Community uses semantic, non-emoji reaction icons and accessible labels',()=>{
  assert.doesNotThrow(()=>new vm.Script(communityJs));
  assert.match(communityJs,/communityIconPaths=/);
  assert.match(communityJs,/aria-pressed/);
  assert.match(communityJs,/aria-label="\x27\+reactionLabel/);
  assert.match(communityJs,/community_toggle_reaction/);
  assert.doesNotMatch(communityJs,/like:'👍 Like'/);
});

test('Messages keep icon buttons through sound toggling and quick actions',()=>{
  assert.doesNotThrow(()=>new vm.Script(messagesJs));
  for(const id of ['dmMeetButton','dmEmojiButton','dmSendButton','dmSoundToggle']){
    const element=messages.match(new RegExp('<button[^>]*id="'+id+'"[^>]*>[\\s\\S]*?<\\/button>'));
    assert.ok(element,'Missing '+id);
    assert.match(element[0],/<svg/);
    assert.match(element[0],/aria-label="/);
  }
  assert.match(messagesJs,/soundToggle\.innerHTML=/);
  assert.match(messagesJs,/data-quick-action="reply" type="button" aria-label="Reply to message"/);
});

test('Icon sizes, contrast and focus remain accessible',()=>{
  assert.match(css,/\.dsos-executive \.dsx-quick-grid-six a\{[\s\S]*min-height:68px!important/);
  assert.match(css,/\.dsos-executive \.dsx-quick-grid-six \.dsx-action-symbol\{[\s\S]*width:23px!important/);
  assert.match(css,/\.community-reaction-button\[data-reaction="like"\] \.dsx-inline-action-icon\{color:#65aaff!important/);
  assert.match(css,/\.dm-hover-actions button:focus-visible/);
  assert.match(preview,/const reviewActionIcons=/);
  assert.match(preview,/const noticePaths=/);
});
