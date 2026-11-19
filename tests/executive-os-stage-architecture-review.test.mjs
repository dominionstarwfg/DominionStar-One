import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('member dashboard is an executive landing stage and Feed is a separate workspace',()=>{
  const html=read('member-dashboard/index.html');
  assert.match(html,/>Dashboard<\/span>/);
  assert.match(html,/href="\/feed\/"/);
  assert.match(html,/href="\/notifications\/"/);
  assert.match(html,/Your DominionStar Executive OS/);
  assert.match(html,/id="heroGreeting"/);
  assert.doesNotMatch(html,/Welcome back to DominionStar Executive OS/);
  assert.match(html,/class="dsx-overview"/);
  assert.match(html,/id="dashboardNextAppointment"/);
  assert.match(html,/id="journeyPercent"/);
  assert.match(html,/class="dsx-dashboard-social"/);
  assert.match(html,/id="dashboardComposerForm"/);
  assert.match(html,/id="dashboardSocialPreview"/);
  assert.doesNotMatch(html,/id="dsosSocialGateway"|id="feedComposerBody"|id="dashboardCommunityPreview"/);
  for(const stale of [
    'Professional identity','System status','Account health',
    'Featured learning','Professional resources','Help improve DominionStar',
    'id="openAuroraSide"','id="runMemberAudit"'
  ]){
    assert.ok(!html.includes(stale),'Home must not render legacy dashboard module: '+stale);
  }
});

test('shared Agent OS rail exposes focused workspaces',()=>{
  const shell=read('assets/js/dominionstar-agent-nav-shell.js');
  assert.match(shell,/\['Dashboard','\/member-dashboard\/','home'\]/);
  assert.match(shell,/\['Feed','\/feed\/','feed'\]/);
  assert.match(shell,/\['Notifications','\/notifications\/','bell'\]/);
  assert.match(shell,/\['Aurora','\/member-dashboard\/\?open=aurora','sparkles'\]/);
});

test('authenticated workspaces do not inject landing-page briefing chrome',()=>{
  const aurora=read('assets/js/aurora-ui.js');
  const css=read('assets/css/dominionstar-auth-os-v2.css');
  assert.match(aurora,/isFocusedAgentWorkspace\(\)/);
  assert.match(css,/\.aurora-command-strip,[\s\S]*\.aurora-member-briefing\{display:none!important\}/);
  assert.match(css,/\.member-directory-card\{[\s\S]*background:#fff!important/);
});

test('dedicated Feed uses real profile avatars and existing authenticated social writes',()=>{
  const feed=read('feed/index.html');
  const feedJs=read('assets/js/feed.js');
  const social=read('assets/js/dashboard-social.js');
  assert.match(feed,/id="feedPageAvatar"/);
  assert.match(feed,/id="feedPageInitials"/);
  assert.match(feed,/id="feedPageComposer"/);
  assert.match(feedJs,/createSignedUrl\(profile\.avatar_path,3600\)/);
  assert.match(feedJs,/\.from\('community_messages'\)[\s\S]*\.insert\(/);
  // Saved community_messages trigger is the only approved mention source.
  assert.doesNotMatch(feedJs,/rpc\('community_notify_mentions'/);
  assert.match(social,/resultLimit=20/);
  assert.match(social,/result_limit:safeLimit/);
});
