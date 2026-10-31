import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const flags=read('assets/js/notification-feature-flags.js');
const engine=read('assets/js/communication-engine.js');
const settings=read('assets/js/account-settings.js');
const messages=read('assets/js/direct-messages.js');
const sw=read('sw.js');
const pushKey=read('netlify/functions/push-public-key.mjs');
const processor=read('netlify/functions/process-push-outbox.mjs');
const scheduled=read('netlify/functions/scheduled-push-outbox.mjs');
const sql=read('scripts/security/web-push-foundation.DO-NOT-RUN.review.sql');
const releaseGate=read('scripts/check-agent-release-gates.mjs');
const pages=[
  read('member-dashboard/index.html'),
  read('account-settings/index.html'),
  read('direct-messages/index.html')
];

test('trusted message events are active while closed-browser push remains fail-closed',()=>{
  assert.match(flags,/Object\.freeze\s*\(/);
  assert.match(flags,/trustedMessageEvents:true/);
  assert.match(flags,/webPush:false/);
  assert.match(releaseGate,/trustedMessageEvents\\s\*:\\s\*true/);
  assert.match(releaseGate,/webPush\\s\*:\\s\*false/);
  for(const page of pages){
    const flagsAt=page.indexOf('notification-feature-flags.js');
    const engineAt=page.indexOf('communication-engine.js');
    assert.ok(flagsAt>=0&&engineAt>flagsAt,'notification flags must load before communication engine');
  }
});

test('browser push registration uses PushManager and authenticated RPC ownership',()=>{
  assert.equal(pkg.dependencies['web-push'],'3.6.7');
  assert.match(engine,/PushManager/);
  assert.match(engine,/pushManager\.subscribe/);
  assert.match(engine,/applicationServerKey:urlBase64ToUint8Array/);
  assert.match(engine,/rpc\('register_my_push_subscription'/);
  assert.match(engine,/rpc\('remove_my_push_subscription'/);
  assert.match(engine,/DOMINIONSTAR_NOTIFICATION_FEATURES\?\.webPush!==true/);
  assert.match(settings,/webPushReady/);
  assert.match(settings,/enablePushSubscription/);
  assert.match(settings,/disablePushSubscription/);
});

test('focused Agent OS avoids duplicate system notifications',()=>{
  assert.match(engine,/document\.visibilityState==='visible' && document\.hasFocus\(\)/);
  assert.match(sw,/clients\.matchAll\(\{type:'window',includeUncontrolled:true\}\)/);
  assert.match(sw,/windows\.some\(client=>client\.focused\)/);
});

test('server push sender keeps VAPID private material server-side',()=>{
  assert.match(pushKey,/VAPID_PUBLIC_KEY/);
  assert.doesNotMatch(pushKey,/VAPID_PRIVATE_KEY/);
  assert.match(processor,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(processor,/VAPID_PRIVATE_KEY/);
  assert.match(processor,/PUSH_PROCESSOR_SECRET/);
  assert.match(processor,/webpush\.setVapidDetails/);
  assert.match(processor,/rpc\('claim_push_notification_batch'/);
  assert.match(processor,/statusCode===404\|\|statusCode===410/);
  assert.match(processor,/enabled:false/);
  assert.match(scheduled,/schedule:'\* \* \* \* \*'/);
  assert.match(scheduled,/PUSH_PROCESSOR_SECRET/);
});

test('trusted database message events replace browser cross-member publication only when enabled',()=>{
  assert.match(messages,/trustedMessageEvents !== true/);
  assert.match(messages,/ExecutiveCore\.publish\('message\.received'/);
  assert.match(sql,/emit_direct_message_notification/);
  assert.match(sql,/AFTER INSERT ON public\.direct_messages/);
  assert.match(sql,/'message\.received'/);
  assert.match(sql,/'message_id',new\.id::text/);
  assert.match(sql,/m\.id::text=new\.payload->>'message_id'/);
  assert.match(sql,/m\.sender_id=new\.actor_id/);
  assert.match(sql,/m\.recipient_id=new\.member_id/);
  assert.match(sql,/DROP POLICY IF EXISTS "members create executive events"/);
  assert.match(sql,/CREATE POLICY "members create own executive events"/);
  assert.match(sql,/actor_id=auth\.uid\(\)[\s\S]*member_id=auth\.uid\(\)/);
});

test('trusted call events require authoritative terminal call records',()=>{
  assert.match(sql,/to_regclass\('public\.communication_calls'\)/);
  assert.match(sql,/new\.event_type='call\.missed'/);
  assert.match(sql,/c\.caller_id=new\.actor_id/);
  assert.match(sql,/c\.recipient_id=new\.member_id/);
  assert.match(sql,/c\.status='missed'/);
  assert.match(sql,/new\.event_type='call\.declined'/);
  assert.match(sql,/c\.caller_id=new\.member_id/);
  assert.match(sql,/c\.recipient_id=new\.actor_id/);
  assert.match(sql,/c\.status='declined'/);
});

test('push subscription and outbox tables are not directly exposed to ordinary clients',()=>{
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.web_push_subscriptions/);
  assert.match(sql,/ALTER TABLE public\.web_push_subscriptions ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON TABLE public\.web_push_subscriptions FROM anon, authenticated/);
  assert.match(sql,/Push endpoint belongs to another account/);
  assert.doesNotMatch(sql,/DELETE FROM public\.web_push_subscriptions\s+WHERE endpoint=target_endpoint AND user_id<>auth\.uid\(\)/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.push_notification_outbox/);
  assert.match(sql,/REVOKE ALL ON TABLE public\.push_notification_outbox FROM anon, authenticated/);
  assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.claim_push_notification_batch\(integer\)[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/TO service_role/);
});

test('review SQL cannot be mistaken for an automatic deployment',()=>{
  assert.match(sql,/DO NOT RUN/);
  assert.match(sql,/BEGIN;/);
  assert.match(sql,/COMMIT;/);
  assert.doesNotMatch(sql,/VAPID_PRIVATE_KEY\s*=/);
});
