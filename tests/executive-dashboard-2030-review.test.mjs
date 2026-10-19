import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const html = read('member-dashboard/index.html');
const css = read('assets/css/member-dashboard-executive-2030.css');
const js = read('assets/js/member-dashboard.js');
const os = read('assets/js/dominionstar-os.js');

const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test('Executive OS dashboard preserves core existing application hooks', () => {
  assert.equal(new Set(htmlIds).size, htmlIds.length, 'All IDs must remain unique');
  for (const hook of [
    'dsosSidebar', 'dsosMenu', 'memberName', 'memberGreeting', 'heroGreeting',
    'heroMemberName', 'founderControlLink', 'memberLogout', 'memberStatus',
    'memberRank', 'memberEmail', 'memberAgentCode', 'journeyPercent',
    'journeyProgressBar', 'dashboardIdentityName', 'dashboardNextAppointment',
    'dashboardCommunityPreview', 'activityAnnouncements', 'activityMessages',
    'activityNotifications', 'notificationBell', 'notificationPanel',
    'notificationList', 'openNotificationsMetric', 'pendingMemberContent',
    'approvedMemberContent', 'memberFeedbackForm', 'executiveTimeline',
    'refreshExecutiveTimeline', 'dashboardPresenceSelect', 'dashboardPresenceDot',
    'dsosSearchPanel', 'dsosAiPanel', 'dsosBackdrop',
    'dsosNotificationPreview', 'dsosFloatingAurora'
  ]) {
    assert.ok(htmlIds.includes(hook), 'Missing existing DOM hook ' + hook);
  }
  for (const script of ['member-auth.js','member-dashboard.js','dominionstar-os.js',
                        'executive-core.js','presence-engine.js']) {
    assert.ok(html.includes('/assets/js/' + script), 'Missing functional script ' + script);
  }
  assert.match(os, /notificationBell/);
});

test('Balanced Executive visual system remains isolated from other site pages', () => {
  assert.match(html, /class="dsos-body dsos-executive-2030"/);
  assert.match(html, /member-dashboard-executive-2030\.css/);
  assert.match(css, /\.dsos-body\.dsos-executive-2030/);
  assert.match(css, /background:linear-gradient\(180deg,#102b4c/);
  assert.match(css, /grid-template-columns:minmax\(0,1\.75fr\)/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:730px\)/);
  assert.match(css, /@media\(max-width:460px\)/);
});

test('Community social gateway is present but hidden until approved', () => {
  assert.match(html, /id="dsosSocialGateway" class="[^"]*member-hidden"/);
  assert.match(html, /id="dsosCommunitySection" class="[^"]*member-hidden"/);
  assert.match(html, /id="dashboardCommunityPreview"/);
  assert.match(html, /href="\/community\/"/);
  assert.match(js, /if \(status === 'approved'\) \{[\s\S]*?socialGateway\?\.classList\.remove\('member-hidden'\)/);
  assert.match(js, /communitySection\?\.classList\.add\('member-hidden'\)/);
  assert.match(js, /status === 'approved' \? loadDashboardCommunity\(\) : Promise\.resolve\(\)/);
  assert.match(js, /supabase\.rpc\('list_community_feed', \{ result_limit: 3 \}\)/);
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

test('No new Supabase writes or mock agent counts in Executive OS layout', () => {
  assert.doesNotMatch(html, /Visual preview|No live member data|placeholder members/i);
  assert.doesNotMatch(html, /id="activityMessages">[1-9]/);
  assert.doesNotMatch(html, /id="activityNotifications">[1-9]/);
  assert.match(html, /id="activityMessages">—/);
  assert.match(html, /id="activityNotifications">—/);
});

test('Dashboard health audit only claims route and interface checks', () => {
  assert.match(os, /route and interface checks passed/);
  assert.match(os, /Live feature access is not verified/);
  assert.doesNotMatch(os, /All member modules passed/);
});
