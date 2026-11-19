import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const chat=read('assets/js/community-chat.js');
const html=read('community-chat/index.html');
const migration=read('scripts/security/legacy-community-broadcast-disable.DO-NOT-RUN.review.sql');
const selectedEmail=read('scripts/security/priority-member-email-routing.DO-NOT-RUN.review.sql');

test('routine chat send never invokes the privileged legacy email blast',()=>{
  assert.match(chat,/\.from\('community_chat_messages'\)\.insert\(/);
  assert.doesNotMatch(chat,/queue_community_message_email/);
  assert.doesNotMatch(chat,/emailPref|Email alerts were queued/);
  assert.doesNotMatch(html,/id="chatEmailPreference"/);
  assert.match(html,/Routine Community Chat messages stay in the app/);
  assert.match(html,/review-selected-email-20261110/);
  assert.match(chat,/result\.textContent='Message sent\.';/);
});

test('the old public RPC gets a fail-closed gated permission revocation',()=>{
  assert.match(migration,/REVIEW ONLY — DO NOT RUN/);
  assert.match(migration,/to_regprocedure\('public\.queue_community_message_email\(uuid\)'\)/);
  assert.match(migration,/prosecdef=true/);
  assert.match(migration,/REVOKE EXECUTE ON FUNCTION public\.queue_community_message_email\(uuid\)/);
  assert.match(migration,/FROM PUBLIC, anon, authenticated/);
  assert.match(migration,/has_function_privilege\([\s\S]*'anon'/);
  assert.match(migration,/has_function_privilege\([\s\S]*'authenticated'/);
  assert.doesNotMatch(migration,/\bDROP\s+FUNCTION\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b/i);
});

test('selected source-verified Community email remains separate from ordinary chat',()=>{
  assert.match(selectedEmail,/new\.event_type IN \('community\.mention','community\.reply'\)/);
  assert.match(selectedEmail,/coalesce\(prefs\.community_email_enabled,false\)/);
  assert.match(selectedEmail,/email_confirmed_at IS NOT NULL/);
  assert.doesNotMatch(selectedEmail,/queue_community_message_email/);
});
