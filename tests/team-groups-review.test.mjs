import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('team-groups/index.html');
const code=read('assets/js/dominionstar-team-groups.js');
const css=read('assets/css/dominionstar-team-groups.css');
const sql=read('scripts/security/agent-team-groups.DO-NOT-RUN.review.sql');
const build=read('scripts/build-public-netlify.sh');

test('Team Groups has a real create / select / chat / invite / accept interface',()=>{
  for(const id of ['teamGroupsGate','teamGroupsApp','dsgCreateButton','dsgCreateForm',
    'dsgGroupList','dsgMessages','dsgMessageInput','dsgMessageForm',
    'dsgInviteDialog','dsgInviteChoices','dsgInviteSearch','dsgMembersPanel',
    'dsgMemberList','dsgMuteButton','dsgLeaveButton',
    'dsgEditButton','dsgEditDialog','dsgEditForm','dsgEditName','dsgEditTopic']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(code,/async function createGroup/);
  assert.match(code,/async function sendMessage/);
  assert.match(code,/async function invitePerson/);
  assert.match(code,/async function acceptInvite/);
  assert.match(code,/async function leaveGroup/);
  assert.match(code,/async function toggleMute/);
  assert.match(code,/function localDemo/);
  assert.match(css,/\.dsg-workspace\{/);
  assert.match(css,/@media\(max-width:650px\)/);
  assert.doesNotThrow(()=>new vm.Script(code));
});

test('Production group access is fail-closed until BOTH security and public projection flags are enabled',()=>{
  assert.match(code,/flags\.teamGroupsV1!==true\|\|flags\.publicMemberProfilesV2!==true/);
  assert.match(code,/verification_status/);
  assert.match(code,/Founder-approved agents/);
  assert.match(code,/client\.from\('member_public_profiles'\)/);
  assert.doesNotMatch(code,/\.from\('member_profiles'\)\s*\.select\([^\n]*(email|phone|agent_code|date_of_birth)/i);
  assert.doesNotMatch(code,/localStorage|sessionStorage|service_role|supabase\.service_role/i);
  assert.match(sql,/DO NOT RUN IN PRODUCTION/);
  assert.match(sql,/create schema if not exists agent_private/);
  assert.match(sql,/enable row level security/g);
  assert.match(sql,/security definer set search_path=''/);
  assert.match(sql,/revoke all on function public\.create_agent_group\(text,text\) from public, anon/);
});

test('Group members are private and cannot be read by outsiders or invited nonmembers',()=>{
  assert.match(sql,/agent_groups_read_invited_or_active/);
  assert.match(sql,/agent_members_read_active_or_self/);
  assert.match(sql,/agent_messages_read_members_only/);
  assert.match(sql,/agent_messages_send_members_only/);
  assert.match(sql,/agent_private\.is_group_member\(group_id,false\)/);
  assert.match(sql,/agent_private\.is_group_admin\(group_id\)/);
  assert.match(sql,/role='member' and status='invited'/);
  assert.match(sql,/member_public_profiles/);
  assert.match(sql,/guard_agent_group_member_update/);
  assert.doesNotMatch(sql,/grant (select|all) on public\.agent_group_messages to anon/i);
});

test('Group messages render as text, without trusting user-supplied HTML',()=>{
  assert.match(code,/document\.createTextNode\(/);
  assert.match(code,/\.textContent/);
  assert.match(code,/safeLinkify\(bubble,msg\.body\)/);
  assert.doesNotMatch(code,/innerHTML\s*=/);
  assert.match(code,/noopener noreferrer nofollow/);
  assert.match(code,/role:'member'/);
  assert.match(code,/state\.preview/);
});

test('Review Netlify build uses only static sample groups without backend scripts',()=>{
  assert.match(build,/team-groups\/index\.html/);
  assert.match(build,/if rel == 'team-groups\/index.html':/);
  assert.match(build,/dominionstar-team-groups\.js\?v=review-20261113/);
  assert.match(build,/keep_scripts=\('dominionstar-agent-nav-shell\.js',\)/);
  assert.match(build,/Team Groups/);
  assert.match(read('assets/js/dominionstar-agent-nav-shell.js'),/\['Team Groups','\/team-groups\/'/);
  assert.match(read('member-dashboard/index.html'),/href="\/team-groups\/"/);
  assert.match(read('direct-messages/index.html'),/href="\/team-groups\/"/);
});

test('Owner may edit the group, while admins can moderate members without expelling other admins',()=>{
  assert.match(code,/async function editGroup\(/);
  assert.match(code,/async function removeMember\(/);
  assert.match(code,/async function declineInvite\(/);
  assert.match(code,/const isOwner=g=>/);
  assert.match(code,/m\.role==='admin'&&!isOwner\(g\)/);
  assert.match(code,/\.update\(\{name,topic\}\)\.eq\('id',g\.id\)\.eq\('owner_id',state\.uid\)/);
  assert.match(code,/\.delete\(\)\.eq\('group_id',g\.id\)\.eq\('user_id',m\.user_id\)/);
  assert.match(code,/m\.status==='invited'\?'Cancel invitation':'Remove member'/);
  assert.match(code,/Only the group owner can edit its details/);
  assert.match(code,/You do not have permission to remove this member/);
  assert.match(sql,/Ordinary admins may remove members/);
  assert.match(sql,/role='member'\s+or exists\(select 1 from public\.agent_groups owner_group/);
  assert.match(css,/\.dsg-member-item \.dsg-member-remove/);
  assert.match(css,/\.dsg-invite-response/);
});

test('Invited members can accept or decline but cannot read messages and roster until acceptance',()=>{
  assert.match(code,/mine\(g\)\?\.status==='invited'/);
  assert.match(code,/Decline invitation/);
  assert.match(code,/Accept invitation/);
  assert.match(code,/Only invitation acceptance is allowed|invitation acceptance/i);
  assert.match(code,/group\.id/);
  assert.match(code,/Regional Growth Circle/);
  assert.match(code,/state\.messages\.set\('demo-pending'/);
  const tests=read('tests/sql/agent-team-groups-assertions.sql');
  assert.match(tests,/Admin could remove another admin/);
  assert.match(tests,/Admin could not remove ordinary member/);
  assert.match(tests,/Group owner could not edit group details/);
  assert.match(tests,/Owner could not remove another admin/);
});
