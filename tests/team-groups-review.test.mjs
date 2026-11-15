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


test('Private team group composer offers JPG/PNG/WebP/PDF and natural-height flyer preview',()=>{
  for(const id of ['dsgChatShareFlyer','dsgChatShareRow','dsgPostAttachButton',
    'dsgPostFile','dsgAttachmentPreview','dsgAttachmentContent',
    'dsgAttachmentInfo','dsgAttachmentNotice','dsgRemoveAttachment']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/accept="image\/jpeg,image\/png,image\/webp,application\/pdf/);
  assert.match(code,/MAX_GROUP_POST_MEDIA=15\*1024\*1024/);
  assert.match(code,/allowedGroupMediaTypes=new Set/);
  assert.match(code,/URL\.createObjectURL\(file\)/);
  assert.match(code,/URL\.revokeObjectURL\(/);
  assert.match(code,/state\.previewMediaUrls\.add\(url\)/);
  assert.match(code,/function pickAttachment\(file\)/);
  assert.match(code,/function renderPostedMedia\(media\)/);
  assert.match(code,/switchGroupView\('posts'\)/);
  assert.match(code,/async function publishGroupPost\(kind,body\)/);
  assert.match(code,/if\(attachment&&!state\.preview&&!mediaFeatureEnabled\(\)\)/);
  assert.match(code,/Flyer uploads are not yet enabled for real groups/);
  assert.match(code,/state\.attachment\)resetAttachment\(\)/);
  assert.match(css,/\.dsg-flyer-preview/);
  assert.match(css,/\.dsg-post-media-image/);
  assert.match(css,/object-fit:contain!important/);
  assert.match(css,/max-height:none!important/);
  assert.match(css,/\.dsg-attachment-preview\[hidden\]/);
  assert.match(css,/\.dsg-pdf-file/);
  assert.match(code,/mediaFeatureEnabled\(\)/);
  assert.match(code,/window\.DOMINIONSTAR_AGENT_DATA_FEATURES\?\.teamGroupsMediaV1===true/);
  assert.match(code,/\.storage\.from\(GROUP_MEDIA_BUCKET\)/);
  assert.match(code,/\.upload\(path,attachment\.file,\{upsert:false/);
  assert.match(code,/\.download\(media\.path\)/);
  assert.match(code,/\.remove\(\[path\]\)/);
});

test('Group flyer post keeps files in browser-only preview rather than implicitly publishing',()=>{
  assert.match(code,/resetAttachment\(\{keepUrl:Boolean\(attachment\)\}\)/);
  assert.match(code,/Local preview only/);
  assert.match(code,/state\.previewMediaUrls\.has\(media\.url\)/);
  assert.match(code,/nodes\.postFile\.addEventListener\('change'/);
  assert.match(code,/nodes\.chatShareFlyer\.addEventListener\('click'/);
  assert.match(code,/nodes\.postSubmit\.disabled=!selected\(\)\|\|!isActive\(selected\(\)\)/);
  const browser=read('scripts/review-feed-browser-geometry.mjs');
  assert.match(browser,/team-training-flyer\.png/);
  assert.match(browser,/leadership-presentation\.pdf/);
  assert.match(browser,/flyerGeometry\.naturalWidth,12/);
  assert.match(browser,/postedFlyer\.count\(\),1/);
});


test('Attachment bytes must match file type; stale validation and upload cannot publish to another group',()=>{
  assert.match(code,/async function mediaSignatureMatches\(file,mime\)/);
  assert.match(code,/file\.slice\(0,16\)\.arrayBuffer\(\)/);
  assert.match(code,/mime==='image\/png'/);
  assert.match(code,/mime==='image\/jpeg'/);
  assert.match(code,/mime==='image\/webp'/);
  assert.match(code,/mime==='application\/pdf'/);
  assert.match(code,/state\.attachmentRequest\+=1/);
  assert.match(code,/const request=\+\+state\.attachmentRequest/);
  assert.match(code,/request!==state\.attachmentRequest\|\|groupId!==state\.selected/);
  assert.match(code,/File contents do not match JPG, PNG, WebP or PDF/);
  assert.match(code,/if\(!await mediaSignatureMatches\(attachment\.file,attachment\.mime\)\)/);
  assert.match(code,/state\.selected!==g\.id \|\| state\.attachment!==attachment/);
  assert.match(code,/if\(!state\.busy\)selectGroup\(g\.id\)/);
  assert.doesNotMatch(code,/if\(state\.busy&&id!==state\.selected\)return/);
  const browser=read('scripts/review-feed-browser-geometry.mjs');
  assert.match(browser,/fake-flyer\.png/);
  assert.match(browser,/File contents do not match/);
  assert.match(browser,/team-training-flyer\.png/);
});

test('Real group media stays feature-flagged and private until migration passes',()=>{
  const migration=read('scripts/security/agent-team-groups-media.DO-NOT-RUN.review.sql');
  const suite=read('tests/sql/agent-team-groups-media-assertions.sql');
  const workflow=read('.github/workflows/team-groups-isolation-review.yml');
  assert.match(migration,/DO NOT RUN IN PRODUCTION/);
  assert.match(migration,/id,name,public,file_size_limit,allowed_mime_types/);
  assert.match(migration,/'agent-group-media','agent-group-media',false,15728640/);
  assert.match(migration,/media_path_matches\(group_id,author_id,media_path\)/);
  assert.match(migration,/create policy ds_agent_group_media_read_authenticated/);
  assert.match(migration,/create policy ds_agent_group_media_upload_member/);
  assert.match(migration,/create policy ds_agent_group_media_rollback_unpublished/);
  assert.match(migration,/storage\.allow_any_operation/);
  assert.match(migration,/agent_private\.media_path_authorized\(name,true\)/);
  assert.match(migration,/not exists\(select 1 from public\.agent_group_posts post/);
  assert.doesNotMatch(migration,/public\s*=\s*true/);
  assert.doesNotMatch(migration,/for update to authenticated/);
  assert.match(code,/const mediaFeatureEnabled=\(\)=>!state.preview/);
  assert.match(code,/flags.teamGroupsV1!==true\|\|flags.publicMemberProfilesV2!==true/);
  assert.match(code,/if\(attachment&&!state.preview&&!mediaFeatureEnabled\(\)\)/);
  assert.match(code,/crypto.randomUUID\(\)/);
  assert.match(code,/\.upload\(path,attachment.file,\{upsert:false/);
  assert.match(code,/if\(rollback.error\)status\(/);
  assert.match(code,/function revokePrivatePostMedia/);
  assert.match(code,/\.download\(media.path\)/);
  for(const phrase of ['Uninvited member accessed a private group file',
    'Revoked agent downloaded a private group file',
    'Unapproved agent downloaded a private group file',
    'Joined admin spoofed the group owner upload prefix',
    'Cross-group post media path was accepted',
    'Published group media was deleted by user',
    'ISOLATED_TEAM_GROUP_MEDIA_RLS_PASS']){
    assert.ok(suite.includes(phrase),phrase);
  }
  assert.match(workflow,/agent-team-groups-media-fixture.sql/);
  assert.match(workflow,/agent-team-groups-media-assertions.sql/);
});
