import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dm=read('assets/js/direct-messages.js');
const globalCall=read('assets/js/global-call-manager.js');
const lifecycle=read('scripts/security/communication-call-lifecycle.DO-NOT-RUN.review.sql');
const pushSql=read('scripts/security/web-push-foundation.DO-NOT-RUN.review.sql');

test('caller creates a trusted call record and carries its id in the WebRTC offer',()=>{
  assert.match(dm,/start_my_communication_call/);
  assert.match(dm,/activeCallRecordId=await startTrustedCallRecord\(dialedMember,callType\)/);
  assert.match(dm,/type:'offer'[\s\S]*callId:activeCallRecordId \|\| undefined/);
});

test('recipient answer is bound to the authoritative call id',()=>{
  assert.match(dm,/activeCallRecordId = acceptedOffer\.callId \|\| ''/);
  assert.match(dm,/answer_my_communication_call/);
  assert.match(dm,/await answerTrustedCallRecord\(activeCallRecordId\)/);
  assert.match(lifecycle,/recipient_id=auth\.uid\(\)[\s\S]*AND status='ringing'/);
});

test('incoming missed-call fallback never impersonates the remote caller',()=>{
  assert.doesNotMatch(dm,/sender_id:direction === 'incoming' \? memberId/);
  assert.match(dm,/if\(trusted===null && direction==='outgoing'\)/);
  assert.match(dm,/Incoming fallback remains visual\/local only/);
});

test('trusted missed and declined outcomes are atomically terminal and deduplicated',()=>{
  assert.match(lifecycle,/SELECT \*[\s\S]*FOR UPDATE/);
  assert.match(lifecycle,/target_outcome='missed'[\s\S]*call_row\.status<>'ringing'/);
  assert.match(lifecycle,/target_outcome='declined'[\s\S]*auth\.uid\(\)<>call_row\.recipient_id/);
  assert.match(lifecycle,/GET DIAGNOSTICS changed=ROW_COUNT/);
  assert.match(lifecycle,/IF changed=0 THEN RETURN false/);
});

test('server-authored missed call history records the real caller and recipient',()=>{
  assert.match(lifecycle,/INSERT INTO public\.direct_messages\(sender_id,recipient_id,body\)/);
  assert.match(lifecycle,/call_row\.caller_id,[\s\S]*call_row\.recipient_id,[\s\S]*'\[call-event\]missed\|'/);
  assert.match(lifecycle,/event_type,member_id,actor_id/);
  assert.match(lifecycle,/'call\.missed',[\s\S]*call_row\.recipient_id,[\s\S]*call_row\.caller_id/);
});

test('normal direct-message notification trigger skips explicit call-event history',()=>{
  assert.match(pushSql,/IF new\.body LIKE '\[call-event\]%' THEN RETURN new; END IF;/);
});

test('global incoming-call overlay finalizes the same trusted call record',()=>{
  assert.match(globalCall,/finish_my_communication_call/);
  assert.match(globalCall,/pending\.callId \|\| '','declined'/);
  assert.match(globalCall,/pending\.callId \|\| '','missed'/);
  assert.match(globalCall,/callId:pending\.callId \|\| undefined/);
});

test('communication_calls browser mutations are removed in the migration',()=>{
  assert.match(lifecycle,/REVOKE ALL ON TABLE public\.communication_calls FROM anon, authenticated/);
  assert.match(lifecycle,/GRANT SELECT ON TABLE public\.communication_calls TO authenticated/);
  assert.match(lifecycle,/has_table_privilege\('authenticated','public\.communication_calls','INSERT'\)/);
  assert.match(lifecycle,/has_table_privilege\('authenticated','public\.communication_calls','UPDATE'\)/);
  assert.match(lifecycle,/has_table_privilege\('authenticated','public\.communication_calls','DELETE'\)/);
});

test('call lifecycle RPCs use empty search_path and deny anonymous execution',()=>{
  for(const fn of ['start_my_communication_call','answer_my_communication_call','finish_my_communication_call']){
    assert.ok(lifecycle.includes('public.'+fn),fn);
  }
  assert.match(lifecycle,/SET search_path=''/);
  assert.match(lifecycle,/FROM PUBLIC, anon/);
  assert.match(lifecycle,/TO authenticated, service_role/);
});
