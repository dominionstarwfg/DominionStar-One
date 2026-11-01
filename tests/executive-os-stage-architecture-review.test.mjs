import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('member dashboard is a focused Feed stage, not an all-modules landing page',()=>{
  const html=read('member-dashboard/index.html');
  assert.match(html,/>Feed<\/span>/);
  assert.match(html,/href="\/notifications\/"/);
  assert.match(html,/Share with your network/);
  assert.match(html,/id="dsosSocialGateway"[^>]*<span|id="dsosSocialGateway"/);
  assert.match(html,/id="feedComposerBody"/);
  assert.match(html,/id="feedComposerPublish"/);
  assert.match(html,/id="feedComposerAvatar"/);
  assert.match(html,/id="dashboardCommunityPreview"/);
  for(const stale of [
    'Professional identity','Quick actions','System status','Account health',
    'Featured learning','Professional resources','Help improve DominionStar',
    'id="openAuroraSide"','id="runMemberAudit"'
  ]){
    assert.ok(!html.includes(stale),'Home must not render legacy dashboard module: '+stale);
  }
});

test('shared Agent OS rail exposes focused workspaces',()=>{
  const shell=read('assets/js/dominionstar-agent-nav-shell.js');
  assert.match(shell,/\['Feed','\/member-dashboard\/','home'\]/);
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

test('feed uses real profile avatars, direct posting, visible links, and a non-preview post count',()=>{
  const dashboard=read('assets/js/member-dashboard.js');
  const social=read('assets/js/dashboard-social.js');
  assert.match(dashboard,/\['feedComposerAvatar','feedComposerInitials'\]/);
  assert.match(dashboard,/class="dsos-inline-link"/);
  assert.match(dashboard,/document\.getElementById\('dsosSocialGateway'\)/);
  assert.match(dashboard,/\.from\('community_messages'\)[\s\S]*\.insert\(/);
  assert.match(dashboard,/community_notify_mentions/);
  assert.match(social,/result_limit:20/);
});
