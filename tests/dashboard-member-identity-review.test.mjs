import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('member-dashboard/index.html');
const dashboardJs=read('assets/js/member-dashboard.js');
const socialJs=read('assets/js/dashboard-social.js');
const css=read('assets/css/dominionstar-cinematic-os.css');

test('Local daypart greeting identifies the authenticated member and shows credentials above feed',()=>{
  const marker=html.indexOf('id="heroMemberName"');
  assert.ok(marker>0);
  assert.match(html,/<span id="heroGreeting">Good day<\/span>, <strong id="heroMemberName">/);
  assert.match(html,/Welcome back to DominionStar Executive OS/);
  for(const daypart of ['Good morning','Good afternoon','Good evening']) assert.ok(dashboardJs.includes(daypart),daypart);
  assert.ok(marker<html.indexOf('id="dsosCommunitySection"'));
  for(const hook of ['heroProfileFullName','heroContractLevel','heroProfileAvatar','heroProfileInitials',
    'heroFoundingBadge','dashboardAvatarInitials','topbarFoundingBadge','feedComposerInitials']){
    assert.ok(html.includes('id="'+hook+'"'),hook+' missing');
  }
  assert.match(dashboardJs,/setIdentityText\('heroMemberName', firstName\)/);
  assert.match(dashboardJs,/setIdentityText\('heroProfileFullName', fullName\)/);
  assert.match(dashboardJs,/setIdentityText\('heroContractLevel', contractLevelText\)/);
  assert.match(dashboardJs,/createSignedUrl\(profile.avatar_path, 3600\)/);
  assert.match(dashboardJs,/renderAvatar\(null\)/);
  assert.match(dashboardJs,/Number\.isInteger\(foundingNumber\)/);
  assert.match(dashboardJs,/profile\.founding_member === true/);
  assert.match(dashboardJs,/classList\.toggle\('member-hidden', !isFoundingMember\)/);
  assert.match(css,/\.dsx-hero-profile/);
  assert.match(css,/\.dsos-feed-avatar/);
});
test('Branding remains unnumbered and no unsupported stock photo is shown',()=>{
  assert.match(html,/DominionStar Executive OS/);
  assert.doesNotMatch(html,/\b20[3]0\b/);
  assert.doesNotMatch(html,/id="dashboardAvatar"[^>]*src="\/assets\/logo\.jpeg"/);
  assert.doesNotMatch(html,/id="heroProfileAvatar"[^>]*src=/);
});
test('Post authors display real ranks, signed photo URLs and founding status only when numbered',async()=>{
  const target={innerHTML:'',insertAdjacentElement(){},setAttribute(){},removeAttribute(){},
    querySelectorAll:()=>[],addEventListener(){}};
  const doc={createElement:()=>({className:'',setAttribute(){},textContent:'',
    classList:{toggle(){}}})};
  const posts=[
    {id:'a',user_id:'u1',author_full_name:'Alex James',author_rank:'MD',
     author_exclusive_number:5,author_avatar_path:'u1/profile.webp',post_type:'milestone',
     created_at:'2026-10-20T10:00:00Z',body:'Our first achievement.'},
    {id:'b',user_id:'u2',author_full_name:'Beth Green',author_rank:'TA',
     author_exclusive_number:null,author_avatar_path:null,post_type:'discussion',
     created_at:'2026-10-20T10:00:00Z',body:'Sharing a note.'}
  ];
  const client={
    rpc:async()=>({data:posts,error:null}),
    storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://example.test/photo.webp'},error:null})})},
    from:()=>({select(){return this},in(){return this},eq(){return this},
      then(onOk,onFail){return Promise.resolve({data:[],error:null}).then(onOk,onFail)}})
  };
  const scope={window:{},document:doc,location:{origin:'https://dominionstarld.com'},navigator:{},URL};
  vm.runInNewContext(socialJs,scope);
  await scope.window.DSDashboardSocial.mount({client,memberId:'myself',target});
  const first=target.innerHTML.split('data-post-id="a"')[1].split('data-post-id="b"')[0];
  const second=target.innerHTML.split('data-post-id="b"')[1];
  assert.match(first,/Alex James/);
  assert.match(first,/Contract Level: MD/);
  assert.match(first,/Founding Member #5/);
  assert.match(first,/class="ds30-author-photo"/);
  assert.match(first,/https:\/\/example\.test\/photo\.webp/);
  assert.match(second,/Beth Green/);
  assert.match(second,/Contract Level: TA/);
  assert.doesNotMatch(second,/Founding Member #/);
  assert.doesNotMatch(second,/class="ds30-author-photo"/);
});
