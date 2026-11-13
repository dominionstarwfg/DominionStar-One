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
    'dsgMemberList','dsgMuteButton','dsgLeaveButton']){
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
  assert.match(code,/role='member'/);
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
