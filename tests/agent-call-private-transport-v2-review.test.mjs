import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dm=read('assets/js/direct-messages.js');
const global=read('assets/js/global-call-manager.js');
const preview=read('scripts/security/agent-call-realtime-v2.DO-NOT-RUN.review.sql');

function helpers(source, privateV2, member='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'){
 const extracted=source.match(/const privateCallV2 = window\.DOMINIONSTAR_CALL_PRIVATE_V2 === true;[\s\S]*?const callChannelConfig = \(\) => \(\{[\s\S]*?\n  \}\);/)?.[0];
 assert.ok(extracted,'Expected coordinated call helper declarations');
 const code='(()=>{'+
   'const session={user:{id:'+JSON.stringify(member)+'}};'+
   'const state={session};'+
   'const PAIR_CHANNEL_PREFIX="dominionstar-call";'+
   extracted+
   'return {'+
     'pair:(id)=>typeof callChannelName==="function"?callChannelName(id):pairChannelName(id),'+
     'inbox:(id)=>typeof callInboxName==="function"?callInboxName(id):inboxChannelName(id),'+
     'config:()=>callChannelConfig()};'+
   '})()';
 return vm.runInNewContext(code,{window:{DOMINIONSTAR_CALL_PRIVATE_V2:privateV2}},{timeout:1000});
}
const alice='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const bob='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const chris='cccccccc-cccc-4ccc-cccc-cccccccccccc';

test('Both agent web-call endpoints agree on canonical sorted private pair topic',()=>{
 const a=helpers(dm,true,alice);
 const b=helpers(global,true,bob);
 assert.equal(a.pair(bob),'ds-call-v2:'+alice+':'+bob);
 assert.equal(b.pair(alice),a.pair(bob));
 assert.equal(b.inbox(alice),'ds-call-inbox-v2:'+alice);
 assert.equal(a.inbox(bob),'ds-call-inbox-v2:'+bob);
 assert.equal(a.pair(chris),'ds-call-v2:'+alice+':'+chris);
});
test('Private v2 config is enabled on both caller and receiver',()=>{
 for(const source of [dm,global]){
   const p=helpers(source,true);
   assert.equal(p.config().config.private,true);
   assert.equal(p.config().config.broadcast.self,false);
 }
});
test('Default legacy topics and nonprivate settings remain unchanged',()=>{
 const a=helpers(dm,false,alice);
 const b=helpers(global,false,bob);
 assert.equal(a.pair(bob),b.pair(alice));
 assert.equal(a.inbox(bob),'dominionstar-user-call-'+bob);
 assert.equal(b.inbox(alice),'dominionstar-user-call-'+alice);
 assert.equal(a.config().config.private,undefined);
 assert.equal(b.config().config.private,undefined);
});
test('All calling paths use the common pair and inbox transport helpers',()=>{
 assert.match(dm,/client\.channel\(callChannelName\(otherId\), callChannelConfig\(\)\)/);
 assert.match(dm,/client\.channel\(callInboxName\(callPartnerId\), callChannelConfig\(\)\)/);
 assert.match(global,/const name = pairChannelName\(targetId\)/);
 assert.match(global,/state\.client\.channel\(name, callChannelConfig\(\)\)/);
 assert.match(global,/\.channel\(inboxChannelName\(state\.session\.user\.id\), callChannelConfig\(\)\)/);
});
test('Only a non-executable server policy draft is staged; release flag is off',()=>{
 assert.match(preview,/DO NOT RUN/i);
 assert.match(preview,/realtime\.messages/);
 assert.match(preview,/for select/);
 assert.match(preview,/for insert/);
 assert.match(preview,/realtime\.topic\(\)/);
 assert.match(preview,/auth\.uid\(\)/);
 assert.match(preview,/verification_status = 'approved'/);
 assert.ok(preview.split(/\r?\n/).every(line=>!line.trim()||line.trim().startsWith('--')),
   'Review-only SQL draft must contain no executable statements');
 const auth=read('assets/js/member-auth.js');
 assert.doesNotMatch(auth,/DOMINIONSTAR_CALL_PRIVATE_V2\s*=\s*true/);
});

test('Proposed private pair receive policy rejects a revoked or unapproved call partner',()=>{
 const readRule=preview.split('-- create policy "ds_agent_v2_broadcast_read"')[1]?.split('-- create policy "ds_agent_v2_broadcast_send"')[0];
 const sendRule=preview.split('-- create policy "ds_agent_v2_broadcast_send"')[1];
 assert.ok(readRule && sendRule, 'Both private call policies must be present');
 for (const rule of [readRule, sendRule]) {
   assert.match(rule,/select 1 from public\.member_profiles partner/);
   assert.match(rule,/partner\.verification_status = 'approved'/);
   assert.match(rule,/nullif\(btrim\(partner\.agent_code\),''\)/);
   assert.match(rule,/split_part\(realtime\.topic\(\), ':', 2\)/);
   assert.match(rule,/split_part\(realtime\.topic\(\), ':', 3\)/);
 }
 assert.match(preview,/private member profiles/i);
 assert.doesNotMatch(preview,/^\s*(?:CREATE POLICY|ALTER TABLE|GRANT|REVOKE)\b/im);
});
test('Other public Broadcast and Postgres Changes listeners block a global public-access cutover',()=>{
 const typing=read('assets/js/direct-messages.js');
 const community=read('assets/js/community-chat.js');
 const presence=read('assets/js/presence-engine.js');
 assert.match(typing,/client\.channel\(\['dominionstar-typing'/);
 assert.match(typing,/broadcast:\{self:false\}/);
 assert.match(community,/\.on\('postgres_changes'/);
 assert.match(presence,/\.on\('postgres_changes'/);
 assert.match(preview,/Do not set Realtime "Allow public access" to OFF/i);
});
