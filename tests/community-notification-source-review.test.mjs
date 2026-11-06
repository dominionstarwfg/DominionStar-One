import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('scripts/security/community-notifications-from-source.DO-NOT-RUN.review.sql');
const email=read('scripts/security/priority-member-email-routing.DO-NOT-RUN.review.sql');
const hub=read('assets/js/community-hub.js');
const social=read('assets/js/dashboard-social.js');
const notifications=read('assets/js/notifications-center.js');
const page=read('notifications/index.html');

test('Community alerts are emitted by genuine saved-source triggers, never arbitrary client RPCs',()=>{
  assert.match(sql,/REVIEW ONLY — DO NOT RUN/);
  assert.match(sql,/AFTER INSERT ON public\.community_messages/);
  assert.match(sql,/AFTER INSERT ON public\.community_comments/);
  assert.match(sql,/SECURITY DEFINER\s+SET search_path=''/);
  assert.match(sql,/RETURNS trigger/);
  assert.match(sql,/IF TG_OP<>'INSERT' THEN RETURN NEW/);
  assert.match(sql,/source_id:=NEW\.id/);
  assert.match(sql,/source_body:=NEW\.body/);
  assert.match(sql,/WHERE p\.id=NEW\.user_id AND p\.verification_status='approved'/);
  assert.match(sql,/WHERE m\.id=post_id AND m\.is_deleted=false/);
  assert.doesNotMatch(hub,/rpc\('community_notify_mentions'/);
  assert.doesNotMatch(social,/rpc\('community_notify_mentions'/);
});

test('Mention matching uses literal names and does not wildcard or substring match @Ann in @Annabelle',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION dominionstar_private\.has_exact_member_mention/);
  assert.match(sql,/pg_catalog\.strpos/);
  assert.match(sql,/before_char !~ '\[\[:alnum:\]_\]'/);
  assert.match(sql,/after_char !~ '\[\[:alnum:\]_\]'/);
  assert.match(sql,/pos:=pos\+next_pos/);
  assert.match(sql,/char_length\(needle\)>90/);
  assert.doesNotMatch(sql,/message_body ilike '%@'/i);
  assert.doesNotMatch(sql,/exec\s*\(/i);
});

test('Member activity never notifies their own account and source fanout is bounded',()=>{
  assert.match(sql,/p\.id<>NEW\.user_id/);
  assert.match(sql,/source_type<>'comment' OR p\.id<>post_author/);
  assert.match(sql,/ORDER BY p\.id LIMIT 5/);
  assert.match(sql,/p\.profile_visibility='members'/);
  assert.match(sql,/p\.verification_status='approved'/);
  assert.match(sql,/post_author<>NEW\.user_id/);
  assert.match(sql,/event_type IN \('community\.mention','community\.reply'\)/);
  assert.match(sql,/ON CONFLICT DO NOTHING/);
  assert.match(sql,/CREATE UNIQUE INDEX executive_community_notifications_source_once_idx/);
});

test('No privileged function is exposed to ordinary agents or anonymous visitors',()=>{
  assert.match(sql,/REVOKE ALL ON FUNCTION dominionstar_private\.emit_community_notifications\(\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION dominionstar_private\.has_exact_member_mention\(text,text\)/);
  assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.community_notify_mentions\(uuid,text\)/);
  assert.match(sql,/FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/has_function_privilege\('authenticated'/);
});

test('Cross-member Community links use signed-in recipient personal inbox and distinct icon',()=>{
  assert.match(sql,/INSERT INTO public\.executive_events/);
  assert.match(sql,/event_type,title,description,payload,priority/);
  assert.match(sql,/jsonb_build_object\('source_type',source_type,'source_id',source_id::text/);
  assert.match(sql,/destination:='\/community\/\?post='/);
  assert.match(notifications,/e\.event_type\?\.startsWith\('community\.'\)\?'community'/);
  assert.match(notifications,/community:'<circle/);
  assert.match(page,/class="dsx-icon-action dsx-filter-community"/);
  assert.match(page,/data-filter="community"/);
  assert.match(page,/>Community<\/span>/);
  assert.match(notifications,/\.eq\('member_id',session\.user\.id\)/);
  assert.match(notifications,/CommunicationEngine\.safeActionUrl/);
});

test('Optional priority email verifies real Community source and preserves opt-in',()=>{
  assert.match(email,/REVIEW ONLY — DO NOT RUN/);
  assert.match(email,/to_regprocedure\('dominionstar_private\.has_exact_member_mention\(text,text\)'\)/);
  assert.match(email,/new\.event_type='community\.reply'/);
  assert.match(email,/new\.event_type='community\.mention'/);
  assert.match(email,/new\.payload->>'source_id'/);
  assert.match(email,/new\.payload->>'post_id'/);
  assert.match(email,/c\.user_id=new\.actor_id/);
  assert.match(email,/m\.user_id=new\.actor_id/);
  assert.match(email,/recipient\.verification_status='approved'/);
  assert.match(email,/recipient\.profile_visibility='members'/);
  assert.match(email,/dominionstar_private\.has_exact_member_mention\(c\.body,recipient\.full_name\)/);
  assert.match(email,/dominionstar_private\.has_exact_member_mention\(m\.body,recipient\.full_name\)/);
  assert.match(email,/coalesce\(prefs\.community_email_enabled,false\)/);
  assert.match(email,/email_confirmed_at IS NOT NULL/);
  assert.doesNotMatch(email,/validated_source:=new\.actor_id IS NULL/);
});
