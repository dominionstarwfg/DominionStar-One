import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const engine=read('assets/js/communication-engine.js');
const sw=read('sw.js');
const settings=read('assets/js/account-settings.js');
const settingsHtml=read('account-settings/index.html');
const dashboard=read('assets/js/member-dashboard.js');
const dashboardHtml=read('member-dashboard/index.html');
const readability=read('assets/css/member-dashboard-readability-v2.css');
const schema=read('supabase/member-email-notifications.sql');
const readGate=read('scripts/security/notification-read-state.DO-NOT-RUN.review.sql');

test('browser notifications are explicit opt-in and priority events use priority sound',()=>{
  assert.match(engine,/ds_browser_notifications'\) === 'on'/);
  assert.match(engine,/\['high','critical'\]\.includes\(priority\)/);
  assert.match(engine,/eventType\.startsWith\('appointment\.'/);
  assert.match(engine,/play\(kind\)/);
  assert.match(engine,/dominionstar:notification/);
  assert.match(engine,/safeActionUrl/);
});

test('service worker constrains notification routing and persists urgent alerts',()=>{
  assert.match(sw,/safeActionUrl/);
  assert.match(sw,/renotify:\['high','critical'\]\.includes\(priority\)/);
  assert.match(sw,/requireInteraction:priority==='critical'/);
  assert.match(sw,/clients\.openWindow\(url\)/);
});

test('selected email defaults do not turn every social event into email',()=>{
  assert.match(settings,/messages:false,community:false,appointments:true,browser:false,sound:true/);
  assert.match(settings,/Selected email alerts/);
  assert.match(settings,/Founder & critical announcements/);
  assert.match(settings,/Appointments & schedule changes/);
  assert.match(settingsHtml,/Email is reserved for the categories you choose/);
  assert.match(schema,/messages_email_enabled boolean not null default false/);
  assert.match(schema,/community_email_enabled boolean not null default false/);
  assert.match(schema,/coalesce\(prefs\.messages_email_enabled,false\)/);
  assert.match(schema,/coalesce\(prefs\.community_email_enabled,false\)/);
});

test('dashboard live event refresh and read-state use the narrow RPC',()=>{
  assert.match(dashboard,/addEventListener\('dominionstar:notification'/);
  assert.match(dashboard,/loadExecutiveActivity\(\)\.catch/);
  assert.match(dashboard,/rpc\('mark_my_executive_notifications_read'/);
  assert.doesNotMatch(dashboard,/\.from\('executive_events'\)[\s\S]{0,180}\.update\(\{ read_at:/);
  assert.match(readGate,/SECURITY DEFINER/);
  assert.match(readGate,/member_id=auth\.uid\(\)/);
  assert.match(readGate,/REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon/);
  assert.match(readGate,/TO authenticated/);
});

test('readability pass raises microcopy and collapses layout before text',()=>{
  assert.match(dashboardHtml,/member-dashboard-readability-v2\.css/);
  assert.match(readability,/\.dsos-nav a,[\s\S]*font-size:14px;min-height:44px/);
  assert.match(readability,/\.ds30-post-copy\{font-size:14px/);
  assert.match(readability,/\.notification-item p\{font-size:13\.5px/);
  assert.match(readability,/@media \(max-width:1180px\)/);
  assert.match(readability,/\.dsos-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
});
