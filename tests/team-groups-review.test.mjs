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
  assert.match(sql,/Only invitation acceptance is allowed/);
  assert.match(code,/const own=mine\(g\)/);
  assert.match(code,/Regional Growth Circle/);
  assert.match(code,/state\.messages\.set\('demo-pending'/);
  const tests=read('tests/sql/agent-team-groups-assertions.sql');
  assert.match(tests,/Admin could remove another admin/);
  assert.match(tests,/Admin could not remove ordinary member/);
  assert.match(tests,/Group owner could not edit group details/);
  assert.match(tests,/Owner could not remove another admin/);
});


test('Group updates remain scoped to active approved members and respect mute',()=>{
  for(const id of ['dsgUnreadTotal','dsgIncomingNotice','dsgSoundToggle',
    'dsgSimulateButton','dsgRefreshButton','dsgUpdateHint']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(sql,/last_read_at timestamptz not null default now\(\)/);
  assert.match(sql,/list_agent_group_unread\(\)/);
  assert.match(sql,/language sql stable security invoker set search_path=''/);
  assert.match(sql,/agent_private\.is_group_member\(member\.group_id,false\)/);
  assert.match(sql,/message\.author_id<>\(select auth\.uid\(\)\)/);
  assert.match(sql,/member\.status='active'/);
  assert.match(sql,/grant execute on function public\.list_agent_group_unread\(\) to authenticated/);
  assert.match(sql,/grant update\(last_read_at\) on public\.agent_group_members to authenticated/);
  assert.match(sql,/Read cursor may only advance/);
  assert.match(code,/async function refreshUnread/);
  assert.match(code,/async function refreshUpdates/);
  assert.match(code,/function startRefresh/);
  assert.match(code,/document\.visibilityState==='hidden'/);
  assert.match(code,/window\.setInterval\(\(\)=>refreshUpdates\(\),20000\)/);
  assert.match(code,/state\.muted\.has\(group\.id\)/);
  assert.match(code,/state\.unread\.set\(destination\.id,count\)/);
  assert.match(code,/state\.soundEnabled/);
  assert.match(code,/state\.client\.rpc\('list_agent_group_unread'\)/);
  assert.match(code,/\.update\(\{last_read_at:latest\}\)/);
  assert.doesNotMatch(code,/service_role|RESEND_API_KEY|Notification\.requestPermission|pushManager/i);
  assert.match(css,/\.dsg-group-unread/);
  assert.match(css,/\.dsg-unread-total/);
});

test('Unread metadata cannot be enumerated by pending, revoked or anonymous members',()=>{
  const rls=read('tests/sql/agent-team-groups-assertions.sql');
  for(const claim of ['Invited agent obtained private unread metadata',
    'Uninvited agent learned unread metadata',
    'Revoked member learned unread metadata',
    'Anonymous member called unread summary',
    'Owner own message counted as unread',
    'Joined member lacks one new unread group message',
    'Reading messages did not clear unread count',
    'Future-dated read cursor accepted']){
    assert.ok(rls.includes(claim),claim);
  }
  assert.match(sql,/revoke all on function public\.list_agent_group_unread\(\) from public,anon/);
  assert.match(sql,/new\.last_read_at<old\.last_read_at/);
  assert.match(sql,/new\.last_read_at>now\(\)\+interval '1 second'/);
});


test('Creator appoints admins; only owner/admin can add or remove other people',()=>{
  assert.match(code,/async function setMemberAdmin/);
  assert.match(code,/const isOwner=g=>/);
  assert.match(code,/const isAdmin=g=>/);
  assert.match(code,/if\(!g\|\|!isAdmin\(g\)\)/);
  assert.match(code,/const canModerate=isAdmin\(g\)/);
  assert.match(code,/m\.role!=='admin'\|\|isOwner\(g\)/);
  assert.match(code,/if\(isOwner\(g\)&&m\.user_id!==state\.uid/);
  assert.match(code,/state\.client\.rpc\('set_agent_group_admin'/);
  assert.match(sql,/create function public\.set_agent_group_admin\(/);
  assert.match(sql,/Only the group owner can appoint or remove admins/);
  assert.match(sql,/agent_private\.is_group_admin\(group_id\)/);
  assert.match(sql,/grant execute on function public\.set_agent_group_admin\(uuid,uuid,boolean\)/);
  assert.doesNotMatch(sql,/grant update\([^)]*role[^)]*\) on public\.agent_group_members to authenticated/i);
  const assertions=read('tests/sql/agent-team-groups-assertions.sql');
  assert.match(assertions,/Appointed admin delegated their own admin powers/);
  assert.match(assertions,/Owner could not appoint group admin/);
  assert.match(assertions,/Owner could not revoke group admin/);
  assert.match(assertions,/Ordinary member could invite/);
  assert.match(assertions,/Admin could remove another admin/);
});

test('Group posts are full-height milestone and announcement cards with private member-only reactions',()=>{
  for(const id of ['dsgViewTabs','dsgChatTab','dsgPostsTab',
    'dsgPostsPanel','dsgPostForm','dsgPostKind','dsgPostBody',
    'dsgPostSubmit','dsgPostList']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(code,/function renderPosts/);
  assert.match(code,/async function publishGroupPost/);
  assert.match(code,/async function reactToPost/);
  assert.match(code,/switchGroupView\('posts'\)/);
  assert.match(code,/Congratulations to Alex Morgan/);
  assert.match(code,/Only joined group members can publish/);
  assert.match(code,/safeLinkify\(copy,post\.body\)/);
  assert.match(code,/const active=isActive\(g\)/);
  assert.match(css,/dsg-post-copy/);
  assert.match(css,/white-space:pre-wrap!important/);
  assert.match(css,/dsg-kind-milestone/);
  for(const table of ['agent_group_posts','agent_group_post_reactions']){
    assert.match(sql,new RegExp('create table public\\.'+table));
    assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
  }
  assert.match(sql,/agent_group_posts_insert_active/);
  assert.match(sql,/agent_group_post_reactions_add_active/);
  assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
  const assertions=read('tests/sql/agent-team-groups-assertions.sql');
  for(const claim of ['Invited agent read private recognition posts',
    'Invited agent posted before accepting','Joined member could not see group congratulations',
    'Joined member cannot publish group post','Reaction author spoofing was permitted',
    'Uninvited agent sees private group posts',
    'Revoked member still sees milestone posts','Anonymous reader saw group milestones']){
    assert.ok(assertions.includes(claim),claim);
  }
});


test('Group milestone comments stay attached to the original post and use safe text rendering',()=>{
  assert.match(code,/postComments:new Map\(\)/);
  assert.match(code,/function renderPosts\(g\)/);
  assert.match(code,/dsg-post-comment-thread/);
  assert.match(code,/dsg-post-comment-row/);
  assert.match(code,/dsg-post-reply-form/);
  assert.match(code,/async function sendPostComment\(post,body\)/);
  assert.match(code,/safeLinkify\(text,comment\.body\)/);
  assert.match(code,/const visible=state\.expandedPostComments\.has\(post\.id\)\?comments:comments\.slice\(-2\)/);
  assert.match(code,/\.insert\(\{post_id:post\.id,author_id:state\.uid,body\}\)/);
  assert.match(code,/state\.commentDrafts\.set\(post\.id,input\.value\)/);
  assert.match(code,/Congratulations, Alex!/);
  assert.match(code,/No replies yet/);
  assert.match(css,/\.dsg-post-comment-bubble/);
  assert.match(css,/\.dsg-post-comment-text/);
  assert.match(css,/white-space:pre-wrap!important/);
  assert.match(css,/\.dsg-post-reply-form\[hidden\]\{display:none!important\}/);
  assert.doesNotMatch(code,/innerHTML\s*=/);
});

test('Private post replies have explicit member-only RLS, narrow table grants and negative isolation tests',()=>{
  assert.match(sql,/create table public\.agent_group_post_comments/);
  assert.match(sql,/alter table public\.agent_group_post_comments enable row level security/);
  assert.match(sql,/agent_group_post_comments_read_active/);
  assert.match(sql,/agent_group_post_comments_insert_active/);
  assert.match(sql,/agent_private\.is_group_member\(post\.group_id,false\)/);
  assert.match(sql,/author_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/grant select,insert\(post_id,author_id,body\)/);
  assert.doesNotMatch(sql,/grant (?:delete|update) on public\.agent_group_post_comments to authenticated/i);
  const tests=read('tests/sql/agent-team-groups-assertions.sql');
  for(const c of [
    'Group owner could not read the private milestone reply',
    'Invited agent read private post replies',
    'Invited agent replied before accepting',
    'Joined member cannot read existing milestone replies',
    'Joined member could not post a milestone reply',
    'Post reply author spoofing was permitted',
    'Uninvited agent sees private milestone replies',
    'Uninvited agent wrote a private reply',
    'Revoked member still sees private post replies',
    'Anonymous reader saw private milestone replies'
  ])assert.ok(tests.includes(c),c);
});
