import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PRIORITY_EMAIL_EVENTS,priorityEmailCategory,priorityEmailDecision
  ,safeDominionStarEmailUrl
} from '../netlify/functions/_shared/priority-email-policy.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('scripts/security/priority-member-email-routing.DO-NOT-RUN.review.sql');
const worker=read('netlify/functions/process-email-outbox.mjs');
const settings=read('assets/js/account-settings.js');
const settingsHtml=read('account-settings/index.html');

test('Only known high-value event types qualify for any email',()=>{
  for(const name of ['community.like','community.reaction','community.post',
    'feed.post','announcement.published','founder.announcement',
    'message.typing','call.ringing','appointment.viewed','meeting.joined',
    'journey.milestone','recognition.badge','unknown.critical']){
    assert.equal(priorityEmailCategory(name,'normal'),null,name);
  }
  assert.equal(priorityEmailCategory('announcement.published','high'),'announcements');
  assert.equal(priorityEmailCategory('founder.announcement','critical'),'announcements');
  for(const type of ['founder.urgent','founder.critical',
    'announcement.urgent','announcement.critical']){
    assert.equal(priorityEmailCategory(type),'announcements');
  }
  for(const [category,types] of Object.entries(PRIORITY_EMAIL_EVENTS)){
    for(const type of types){
      assert.equal(priorityEmailCategory(type),category,type);
    }
  }
});

test('An email is eligible only when the account address was verified',()=>{
  for(const t of ['security.alert','account.approved',
    'appointment.cancelled','founder.urgent','meeting.host_absent']){
    assert.equal(priorityEmailDecision({eventType:t,verifiedEmail:false}).allowed,false,t);
    assert.equal(priorityEmailDecision({eventType:t,verifiedEmail:true}).allowed,true,t);
  }
  assert.equal(priorityEmailDecision({
    eventType:'security.alert',verifiedEmail:true,
    preferences:{email_enabled:false}
  }).reason,'email_disabled');
});

test('Member messages and community notices require their own explicit opt-in',()=>{
  for(const eventType of ['message.received','call.missed']){
    assert.equal(priorityEmailDecision({eventType,verifiedEmail:true}).allowed,false);
    assert.equal(priorityEmailDecision({
      eventType,verifiedEmail:true,
      preferences:{messages_email_enabled:true}
    }).allowed,true);
    assert.equal(priorityEmailDecision({
      eventType,verifiedEmail:true,
      preferences:{messages_email_enabled:false}
    }).reason,'category_opted_out');
  }
  for(const eventType of ['community.mention','community.reply']){
    assert.equal(priorityEmailDecision({eventType,verifiedEmail:true}).allowed,false);
    assert.equal(priorityEmailDecision({
      eventType,verifiedEmail:true,
      preferences:{community_email_enabled:true}
    }).allowed,true);
  }
});

test('Members can disable selected Founder, appointment and meeting emails',()=>{
  for(const [eventType,field] of [
    ['founder.urgent','announcements_email_enabled'],
    ['appointment.confirmed','appointments_email_enabled'],
    ['meeting.host_absent','meeting_room_email_enabled']
  ]){
    assert.equal(priorityEmailDecision({
      eventType,verifiedEmail:true,
      preferences:{[field]:false}
    }).allowed,false);
  }
});

test('Priority SQL draft checks provenance, member preferences, verified Auth email and dedupe',()=>{
  assert.match(sql,/REVIEW ONLY — DO NOT RUN/);
  assert.match(sql,/NEW\.event_type|new\.event_type/);
  assert.match(sql,/ELSE RETURN new; -- Likes, reactions, normal posts and unknown events never email/);
  assert.match(sql,/new\.actor_id IS NOT NULL THEN RETURN new/);
  assert.match(sql,/founder\.is_founder=true/);
  assert.match(sql,/public\.direct_messages/);
  assert.match(sql,/public\.communication_calls/);
  assert.match(sql,/prefs\.email_enabled IS FALSE/);
  assert.match(sql,/coalesce\(prefs\.messages_email_enabled,false\)/);
  assert.match(sql,/coalesce\(prefs\.community_email_enabled,false\)/);
  assert.match(sql,/auth\.users/);
  assert.match(sql,/email_confirmed_at IS NOT NULL/);
  assert.match(sql,/ON CONFLICT\(dedupe_key\)/);
  assert.match(sql,/has_function_privilege\('anon'/);
});

test('Delivery worker rechecks account, event origin and opt-out BEFORE sending',()=>{
  assert.match(worker,/DOMINIONSTAR_PRIORITY_EMAIL_ROUTING_ENABLED==='enabled'/);
  const gate=worker.indexOf('if(strictEmailGateEnabled()){');
  const send=worker.indexOf('await resend.emails.send');
  assert.ok(gate>0&&send>gate);
  assert.match(worker,/supabase\.auth\.admin\.getUserById/);
  assert.match(worker,/recipient_email_changed/);
  assert.match(worker,/\.from\('notification_preferences'\)/);
  assert.match(worker,/\.from\('executive_events'\)/);
  assert.match(worker,/\.eq\('id',match\[1\]\)\.maybeSingle\(\)/);
  assert.match(worker,/decision\.allowed/);
  assert.match(worker,/status:'cancelled'/);
  assert.match(worker,/reason:'unverified_event_source'/);
  assert.match(worker,/reason:'no_verified_email'/);
  assert.match(worker,/rpc\('claim_email_notification_batch',\{batch_size:25\}\)/);
  assert.match(worker,/if\(!secretAuthorized\)/);
  assert.ok(worker.indexOf('if(!secretAuthorized')<worker.indexOf("rpc('claim_email_notification_batch'"));
});

test('Email action links are kept on the verified DominionStar origin',()=>{
  assert.equal(safeDominionStarEmailUrl('/appointments/'),
    'https://dominionstarld.com/appointments/');
  assert.equal(safeDominionStarEmailUrl('https://dominionstarld.com/member-dashboard/'),
    'https://dominionstarld.com/member-dashboard/');
  for(const v of ['https://another.example/phish','//other.example',
    'javascript:alert(1)','http://dominionstarld.com/member-dashboard/',
    'https://dominionstarld.com.attacker.test','']){
    assert.equal(safeDominionStarEmailUrl(v),null,v);
  }
});

test('Settings clearly show the Auth verified destination and selected email controls',()=>{
  assert.match(settingsHtml,/id="priorityNotificationEmail"/);
  assert.match(settingsHtml,/Only selected priority events are eligible for email/);
  assert.match(settings,/db\.auth\.getUser\(\)\.then\(result=>/);
  assert.match(settings,/account\.email&&account\.email_confirmed_at/);
  assert.match(settings,/account\.email\+' \(verified\)'/);
  assert.match(settings,/Founder & critical announcements/);
  assert.match(settings,/Appointments & schedule changes/);
  assert.match(settings,/Selected email alerts/);
  assert.match(settings,/messages:false,community:false,appointments:true/);
  assert.doesNotMatch(settings,/\.from\('member_profiles'\)[\s\S]{0,150}\.select\('email'\)/);
});
