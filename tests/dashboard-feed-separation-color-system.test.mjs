import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dashboard=read('member-dashboard/index.html');
const dashboardJs=read('assets/js/member-dashboard.js');
const feed=read('feed/index.html');
const feedJs=read('assets/js/feed.js');
const social=read('assets/js/dashboard-social.js');
const nav=read('assets/js/dominionstar-agent-nav-shell.js');
const os=read('assets/js/dominionstar-os.js');
const css=read('assets/css/dominionstar-cinematic-os.css');
const media=read('assets/js/community-media-draft-review.js');

test('Dashboard and Feed are separate first-class Agent OS workspaces',()=>{
  assert.match(dashboard,/>Dashboard<\/span>/);
  assert.match(dashboard,/href="\/feed\/"/);
  assert.match(dashboard,/class="dsx-dashboard-hub"/);
  assert.match(dashboard,/id="dashboardNextAppointment"/);
  assert.match(dashboard,/id="dashboardJourneyPercentMirror"/);
  assert.match(dashboard,/id="dashboardAnnouncementPreview"/);
  assert.doesNotMatch(dashboard,/id="dsosSocialGateway"|id="feedComposerBody"|id="dashboardCommunityPreview"|dashboard-social\.js/);
  assert.doesNotMatch(dashboardJs,/dsosSocialGateway|loadDashboardCommunity|feedComposerPublish|feedComposerAvatar/);

  assert.match(feed,/id="feedApp"/);
  assert.match(feed,/id="feedPageComposer"/);
  assert.match(feed,/id="feedPageStream"/);
  assert.match(feed,/dashboard-social\.js/);
  assert.match(feed,/feed\.js/);
  assert.match(feedJs,/window\.DSDashboardSocial\.mount/);
  assert.match(feedJs,/\.from\('community_messages'\)[\s\S]*\.insert\(/);
  assert.match(feedJs,/community_notify_mentions/);

  assert.match(nav,/\['Dashboard','\/member-dashboard\/','home'\]/);
  assert.match(nav,/\['Feed','\/feed\/','feed'\]/);
  assert.match(os,/\['Dashboard','\/member-dashboard\/','Executive overview and command center'\]/);
  assert.match(os,/\['Feed','\/feed\/','Your professional social network'\]/);
});

test('social interaction colors are semantic rather than decorative',()=>{
  for(const token of [
    '--dsx-blue:#1877f2',
    '--dsx-danger:#ff4d5a',
    '--dsx-success:#35d07f',
    '--dsx-warning:#f2c94c',
    '--dsx-gold:#f0c15b'
  ]) assert.ok(css.includes(token),token+' missing');
  assert.match(css,/button\[data-social="like"\]\.is-liked[\s\S]*color:#5d9fff!important/);
  assert.match(css,/button\[data-social="repost"\]:hover[\s\S]*color:#62c8fa!important/);
  assert.match(css,/\.ds30-nav-badge,[\s\S]*background:var\(--dsx-danger\)!important/);
  assert.match(css,/\.dsos-presence-dot\.online[\s\S]*background:var\(--dsx-success\)!important/);
  assert.match(css,/\.appointment-status\.pending[\s\S]*var\(--dsx-warning\)|\.appointment-status\.pending[\s\S]*#f6d966/);
  assert.match(css,/\.dsmedia-founding-badge[\s\S]*linear-gradient\(135deg,#f3cb6d,#d79b32\)/);
});

test('Feed media picker remains visibly useful but fail-closed until secure media publishing exists',()=>{
  assert.match(feed,/Photo \/ Video \/ File/);
  assert.match(feed,/Secure media publication is not enabled yet/);
  assert.match(feed,/data-draft-publish/);
  assert.match(media,/form\.querySelector\('#communityPostSubmit,\[data-draft-publish\]'\)/);
  assert.match(media,/hasFiles\|\|validationInProgress/);
  assert.match(media,/attachments have NOT been uploaded/);
  assert.doesNotMatch(feedJs,/storage\.from\('community-media'\)/);
  assert.doesNotMatch(social,/storage\.from\('community-media'\)/);
});

test('approved executive background uses layered midnight navy instead of a flat page fill',()=>{
  assert.match(css,/--dsx-bg:#061225/);
  assert.match(css,/--dsx-bg-2:#0a1c36/);
  assert.match(css,/--dsx-hero-1:#071a33/);
  assert.match(css,/--dsx-hero-2:#0c2d52/);
  assert.match(css,/--dsx-hero-3:#163e68/);
  assert.match(css,/linear-gradient\(145deg,#041020 0%,#061225 37%,#0a1c36 72%,#07172d 100%\)/);
  assert.doesNotMatch(css,/\b2030\b/);
});
