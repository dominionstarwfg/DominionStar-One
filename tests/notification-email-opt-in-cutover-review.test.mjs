import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../scripts/security/notification-email-opt-in-reset.DO-NOT-RUN.review.sql',import.meta.url),'utf8');
const settings=readFileSync(new URL('../assets/js/account-settings.js',import.meta.url),'utf8');

test('message and community email are explicit opt-in at cutover',()=>{
  assert.match(sql,/messages_email_enabled=false/);
  assert.match(sql,/community_email_enabled=false/);
  assert.match(sql,/ALTER COLUMN messages_email_enabled SET DEFAULT false/);
  assert.match(sql,/ALTER COLUMN community_email_enabled SET DEFAULT false/);
});

test('stale queued email is cancelled rather than deleted',()=>{
  assert.match(sql,/status='cancelled'/);
  assert.match(sql,/created_at < now\(\) - interval '30 days'/);
  assert.match(sql,/stale pre-release email/);
  assert.doesNotMatch(sql,/DELETE FROM public\.email_notification_outbox/);
});

test('appointment and announcement preferences are preserved',()=>{
  assert.doesNotMatch(sql,/appointments_email_enabled=false/);
  assert.doesNotMatch(sql,/announcements_email_enabled=false/);
});

test('Agent Settings can explicitly re-enable selected email categories',()=>{
  assert.match(settings,/messages_email_enabled/);
  assert.match(settings,/community_email_enabled/);
  assert.match(settings,/appointments_email_enabled/);
  assert.match(settings,/announcements_email_enabled/);
});
