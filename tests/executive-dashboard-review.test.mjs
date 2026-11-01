import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const html = read('member-dashboard/index.html');
const css = read('assets/css/member-dashboard-executive.css');
const js = read('assets/js/member-dashboard.js');
const os = read('assets/js/dominionstar-os.js');

const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test('Executive OS Feed preserves only the hooks required by focused Home', () => {
  assert.equal(new Set(htmlIds).size, htmlIds.length, 'All IDs must remain unique');
  for (const hook of [
    'dsosSidebar','dsosMenu','memberName','memberGreeting','heroGreeting','heroMemberName',
    'founderControlLink','memberLogout','dashboardAvatar','dashboardAvatarInitials',
    'heroProfileAvatar','heroProfileInitials','dsosSocialGateway','feedComposerAvatar',
    'feedComposerBody','feedComposerPublish','dashboardCommunityPreview',
    'notificationBell','notificationCount','pendingMemberContent','dsosCommunitySection',
    'dashboardPresenceSelect','dashboardPresenceDot','dsosSearchPanel','dsosAiPanel','dsosBackdrop'
  ]) {
    assert.ok(htmlIds.includes(hook), 'Missing required Feed hook ' + hook);
  }
  for (const removed of [
    'memberStatus','memberRank','memberEmail','memberAgentCode','journeyPercent',
    'dashboardIdentityName','dashboardNextAppointment','activityAnnouncements','activityMessages',
    'activityNotifications','openNotificationsMetric','approvedMemberContent','memberFeedbackForm',
    'executiveTimeline','refreshExecutiveTimeline','dsosNotificationPreview','runMemberAudit'
  ]) {
    assert.ok(!htmlIds.includes(removed), 'Legacy Home module must stay off Feed: ' + removed);
  }
  for (const script of ['member-auth.js','member-dashboard.js','dominionstar-os.js',
                        'executive-core.js','presence-engine.js']) {
    assert.ok(html.includes('/assets/js/' + script), 'Missing functional script ' + script);
  }
  assert.match(html,/href="\/notifications\/"/);
});

test('Executive visual system isolates a centered Feed stage from other site pages', () => {
  assert.match(html, /class="dsos-body dsos-executive"/);
  assert.match(html, /member-dashboard-executive\.css/);
  assert.match(css, /\.dsos-body\.dsos-executive/);
  assert.match(css, /background:linear-gradient\(180deg,#102b4c/);
  assert.match(css, /\.dsos-feed-layout\{display:block!important;max-width:920px/);
  assert.match(css, /\.dsos-feed-intro/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
});

test('Community social gateway is present but hidden until approved', () => {
  assert.match(html, /id="dsosSocialGateway" class="[^"]*member-hidden"/);
  assert.match(html, /id="dsosCommunitySection" class="[^"]*member-hidden"/);
  assert.match(html, /id="dashboardCommunityPreview"/);
  assert.match(html, /href="\/community\/"/);
  assert.match(js, /if \(status === 'approved'\) \{[\s\S]*?socialGateway\?\.classList\.remove\('member-hidden'\)/);
  assert.match(js, /communitySection\?\.classList\.add\('member-hidden'\)/);
  assert.match(js, /status === 'approved' \? loadDashboardCommunity\(\) : Promise\.resolve\(\)/);
  assert.match(js, /window\.DSDashboardSocial\.mount/);
  assert.match(html, /\/assets\/js\/dashboard-social\.js/);
});

test('Founder control is no longer granted from email or profile claims alone', () => {
  assert.doesNotMatch(js, /founderEmails/);
  assert.match(js, /supabase\.rpc\('is_dominionstar_founder'\)/);
  assert.match(js, /!permission\.error && permission\.data === true/);
  assert.doesNotMatch(js, /profile\?\.role === 'founder'/);
  assert.doesNotMatch(js, /profile\?\.is_founder \|\|/);
  assert.match(html, /id="founderControlLink" class="member-hidden"/);
  assert.match(os, /item\[1\] !== '\/founder-control\/'/);
  assert.match(os, /founderControlLink/);
});

test('Notification deep links reject untrusted external and executable URLs', () => {
  const match = js.match(/const safeNotificationHref = candidate => \{[\s\S]*?\n  \};/);
  assert.ok(match, 'safe notification href helper must exist');
  const context = { window: { location: { origin: 'https://dominionstarld.com' } }, URL };
  const run = vm.runInNewContext(match[0] + '\nsafeNotificationHref;', context);
  for (const unsafe of ['javascript:alert(1)', '//example.org/x', 'https://example.org',
                        '/\\example.org', null, {}, '']) {
    assert.equal(run(unsafe), '/notifications/');
  }
  assert.equal(run('/direct-messages/?thread=123'), '/direct-messages/?thread=123');
  assert.match(js, /safeNotificationHref\(item\.payload\?\.action_url\)/);
});

test('Feed does not render fabricated dashboard metrics', () => {
  assert.doesNotMatch(html, /Visual preview|No live member data|placeholder members/i);
  assert.doesNotMatch(html, /id="activityMessages"|id="activityNotifications"|id="activityAnnouncements"/);
  assert.match(html, /id="dashboardCommunityPreview"/);
  assert.match(html, /id="dsosSocialGateway"/);
});

test('Dashboard health audit only claims route and interface checks', () => {
  assert.match(os, /route and interface checks passed/);
  assert.match(os, /Live feature access is not verified/);
  assert.doesNotMatch(os, /All member modules passed/);
});
