import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dashboard=read('member-dashboard/index.html');
const dashboardJs=read('assets/js/member-dashboard.js');
const community=read('community/index.html');
const communityJs=read('assets/js/community-hub.js');
const social=read('assets/js/dashboard-social-2030.js');
test('Verified dashboard identity has greeting, name, profile image and contract level in top bar and hero',()=>{
 for(const id of ['heroMemberName','heroProfileAvatar','heroProfileInitials','heroContractLevel','heroFoundingBadge','topbarMemberName','dashboardAvatar','dashboardAvatarInitials','topbarContractLevel','topbarFoundingBadge']){
   assert.ok(dashboard.includes('id="'+id+'"'),id+' missing');
 }
 assert.match(dashboard,/Welcome back,\s*<span id="heroMemberName"/);
 assert.match(dashboardJs,/setIdentityText\('heroMemberName', firstName\)/);
 assert.match(dashboardJs,/setIdentityText\('topbarMemberName', fullName\)/);
 assert.match(dashboardJs,/setIdentityText\('heroContractLevel', contractLevelText\)/);
 assert.match(dashboardJs,/setIdentityText\('topbarContractLevel', contractLevelText\)/);
});
test('Profile display cannot be blocked by optional founder and avatar RPCs',()=>{
 const identityAt=dashboardJs.indexOf("setIdentityText('heroMemberName'");
 const founderAt=dashboardJs.indexOf("withTimeout(supabase.rpc('is_dominionstar_founder')");
 const numberAt=dashboardJs.indexOf("withTimeout(supabase.rpc('ensure_my_founding_member_number')");
 assert.ok(identityAt>0 && founderAt>identityAt && numberAt>identityAt);
 assert.match(dashboardJs,/renderAvatar\(null\)/);
 assert.match(dashboardJs,/img\.onerror = onBrokenImage/);
 assert.match(dashboardJs,/\.catch\(\(\) => \{ \/\* Keep visible initials/);
});
test('Founding Member badge is conditional on trusted membership flag and valid 1 to 20 number',()=>{
 assert.match(dashboardJs,/profile\.founding_member === true/);
 assert.match(dashboardJs,/Number\.isInteger\(foundingNumber\)/);
 assert.match(dashboardJs,/foundingNumber >= 1 && foundingNumber <= 20/);
 assert.match(dashboardJs,/classList\.toggle\('member-hidden', !isFoundingMember\)/);
 assert.match(dashboardJs,/padStart\(2,'0'\)/);
});
test('Approved community composer identifies author and safely falls back from missing photo',()=>{
 for(const id of ['communityComposerName','communityComposerRank','communityComposerFounding','communityComposerAvatar','communityComposerInitials']){
  assert.ok(community.includes('id="'+id+'"'),id+' missing');
 }
 assert.match(communityJs,/profile\.preferred_name\|\|profile\.full_name/);
 assert.match(communityJs,/profile\.founding_member===true/);
 assert.match(communityJs,/member-avatars/);
 assert.match(communityJs,/photoNode\.onerror/);
 assert.match(communityJs,/photoNode\.onload/);
});
test('Each social post has author initials or signed photo, contract level and eligible founding number',()=>{
 assert.match(social,/author_full_name/);
 assert.match(social,/author_rank/);
 assert.match(social,/author_avatar_path/);
 assert.match(social,/ds30-post-rank/);
 assert.match(social,/ds30-post-founding/);
 assert.match(social,/foundingNumber>=1&&foundingNumber<=20/);
 assert.match(social,/createSignedUrl\(path,3600\)/);
});
