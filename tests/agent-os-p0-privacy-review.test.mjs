import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const baseline=read('scripts/security/agent-os-privacy-baseline.READ-ONLY.review.sql');
const draft=read('scripts/security/member-connection-integrity.DO-NOT-RUN.review.sql');
const plan=read('docs/AGENT_OS_P0_PRIVACY_RELEASE_GATE.md');
const directory=read('assets/js/member-directory.js');
const profile=read('assets/js/professional-profile.js');

test('privacy preflight reads metadata only and has no executable mutation statements',()=>{
  assert.match(baseline,/READ ONLY/);
  assert.match(baseline,/pg_policies/);
  assert.match(baseline,/has_table_privilege/);
  assert.match(baseline,/has_column_privilege/);
  assert.doesNotMatch(baseline,/^\s*(?:insert|update|delete|alter|create|drop|truncate|revoke|grant|call|do)\b/im);
  assert.doesNotMatch(baseline,/\bselect\s+\*\s+from\s+public\.member_profiles\b/i);
});

test('connection migration remains review only and restricts initial status',()=>{
  assert.match(draft,/REVIEW ONLY — DO NOT RUN/);
  assert.match(draft,/CREATE POLICY "approved members create pending connection requests"/);
  assert.match(draft,/requester_id=\(select auth\.uid\(\)\)/);
  assert.match(draft,/AND status='pending'/);
  assert.match(draft,/AND p\.verification_status='approved'/);
});

test('only invitation recipients can respond to pending requests',()=>{
  assert.match(draft,/CREATE OR REPLACE FUNCTION public\.respond_my_member_connection/);
  assert.match(draft,/target_status NOT IN \('accepted','declined'\)/);
  assert.match(draft,/recipient_id=auth\.uid\(\)[\s\S]*status='pending'/);
  assert.match(draft,/SET search_path=''/);
});

test('requesters cancel only their own pending invitations',()=>{
  assert.match(draft,/CREATE OR REPLACE FUNCTION public\.cancel_my_member_connection/);
  assert.match(draft,/DELETE FROM public\.member_connections[\s\S]*requester_id=auth\.uid\(\)[\s\S]*status='pending'/);
});

test('browser cannot directly rewrite connection ownership or status after cutover',()=>{
  assert.match(draft,/DROP POLICY IF EXISTS "members respond to connections"/);
  assert.match(draft,/REVOKE UPDATE, DELETE ON TABLE public\.member_connections/);
  assert.match(draft,/REVOKE UPDATE \(id,requester_id,recipient_id,status,created_at,updated_at\)/);
  assert.match(draft,/REVOKE EXECUTE ON FUNCTION public\.respond_my_member_connection\(uuid,text\)[\s\S]*FROM PUBLIC, anon/);
  assert.match(draft,/REVOKE EXECUTE ON FUNCTION public\.cancel_my_member_connection\(uuid\)[\s\S]*FROM PUBLIC, anon/);
  assert.match(draft,/has_column_privilege\('authenticated','public\.member_connections','status','UPDATE'\)/);
});

test('privacy remediation explicitly blocks view-only masking and production release',()=>{
  assert.match(plan,/security_invoker/);
  assert.match(plan,/view alone does NOT hide the original base table/);
  assert.match(plan,/revoke broad authenticated SELECT/);
  assert.match(plan,/privat(?:e|e table)/i);
  assert.match(plan,/production changes prohibited/);
  assert.match(plan,/isolated staging/);
  assert.match(plan,/Founder access to all member-to-member messages/);
});

test('currently displayed directory/member views request a public-safe subset, not account notes',()=>{
  assert.match(directory,/const directoryTable=publicDirectoryV2\?'member_public_profiles':'member_profiles'/);
  assert.match(directory,/const directoryFields=publicDirectoryV2/);
  assert.match(directory,/\? 'id,full_name,preferred_name,rank,city,state,avatar_path,exclusive_member_number'/);
  assert.match(directory,/publicDirectoryV2\?null:m\.agent_code/);
  assert.doesNotMatch(directory,/\.select\('[^']*(?:email|phone|account_notes|address_line1)[^']*'\)/);
  assert.match(profile,/function renderProfile\(\)/);
  // This is UI-side hygiene, not a substitute for database authorization.
  assert.match(plan,/A read-only professional-profile page is NOT a data/);
});
