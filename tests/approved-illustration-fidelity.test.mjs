import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('member-dashboard/index.html');
const css=read('assets/css/dominionstar-cinematic-os.css');
const dashboardJs=read('assets/js/member-dashboard.js');
const previewJs=read('assets/js/dashboard-social-preview.js');
const social=read('assets/js/dashboard-social.js');

test('approved illustration composition is present on Dashboard',()=>{
  for(const marker of [
    'dsx-approved-topbar','dsx-global-search','dsx-create-action',
    'dsx-hero','dsx-overview','dsx-dashboard-social','dsx-dashboard-tabs',
    'dashboardComposerForm','dashboardSocialPreview','dsx-right-rail',
    'dsx-quick-grid-six','dashboardAnnouncementPreview'
  ]) assert.ok(html.includes(marker),marker+' missing');
  assert.match(html,/Network Feed/);
  assert.match(html,/Announcements &amp; Alerts/);
  assert.match(html,/Create Post/);
  assert.match(html,/Meet Now/);
  assert.match(html,/Book Appointment/);
  assert.match(html,/Browse Learning/);
  assert.match(html,/Find Members/);
  assert.match(html,/Start a Discussion/);
});

test('desktop scale remains compact and social-app dense',()=>{
  const tail=css.slice(css.lastIndexOf('/* ===== Illustration geometry lock'));
  assert.match(css,/grid-template-columns:220px minmax\(0,1fr\)!important/);
  assert.match(tail,/\.dsx-hero\{[\s\S]*min-height:162px!important[\s\S]*max-height:162px!important/);
  assert.match(tail,/\.dsx-stat\{[\s\S]*min-height:74px!important[\s\S]*max-height:74px!important/);
  assert.match(tail,/\.dsx-dashboard-grid\{[\s\S]*304px!important/);
  assert.match(tail,/\.dsx-global-search\{[\s\S]*min-height:36px!important/);
  assert.match(css,/\.dsx-quick-grid-six\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.doesNotMatch(tail,/min-height:260px!important|min-height:178px!important|min-height:82px!important|315px!important/);
});

test('dashboard social preview stays separate from the full Feed and only requests one post',()=>{
  assert.doesNotThrow(()=>new vm.Script(previewJs));
  assert.match(previewJs,/resultLimit:1/);
  assert.match(previewJs,/\.from\('community_messages'\)[\s\S]*\.insert\(/);
  // Posting must rely on the reviewed source-row notification trigger,
  // not the legacy browser RPC that ordinary agents cannot execute.
  assert.doesNotMatch(previewJs,/rpc\('community_notify_mentions'/);
  assert.match(social,/resultLimit=20/);
  assert.match(social,/result_limit:safeLimit/);
  assert.match(html,/href="\/feed\//);
});

test('signed social avatars are physically contained at 42px on authenticated pages',()=>{
  assert.match(css,/body\.ds-auth-os-page \.ds30-author-avatar,[\s\S]*width:42px!important[\s\S]*height:42px!important/);
  assert.match(css,/body\.ds-auth-os-page \.ds30-author-avatar \.ds30-author-photo,[\s\S]*object-fit:cover!important/);
  assert.match(css,/max-width:100%!important/);
  assert.match(css,/max-height:100%!important/);
});

test('Founder dashboard content stays compact instead of dumping raw meeting text',()=>{
  assert.match(dashboardJs,/cleanLines=String\(item\.body\|\|''\)/);
  assert.match(dashboardJs,/slice\(0,3\)/);
  assert.match(dashboardJs,/Read Full Update →/);
  assert.match(dashboardJs,/founderEvent=await withTimeout/);
  assert.match(dashboardJs,/Join Meeting/);
});


test('effective illustration geometry uses the final compact desktop overrides',()=>{
  const tail=css.slice(css.lastIndexOf('/* ===== Illustration geometry lock'));
  assert.match(tail,/width:min\(1320px,calc\(100% - 34px\)\)!important/);
  assert.match(tail,/\.dsx-hero\{[\s\S]*min-height:162px!important[\s\S]*max-height:162px!important/);
  assert.match(tail,/\.dsx-stat\{[\s\S]*min-height:74px!important[\s\S]*max-height:74px!important/);
  assert.match(tail,/\.dsx-dashboard-grid\{[\s\S]*304px!important/);
  assert.match(tail,/\.dsx-quick-grid-six a\{min-height:52px!important/);
  assert.match(tail,/#feedApp\{[\s\S]*1280px/);
  assert.match(tail,/\.dm-os\.dm-os-three\{[\s\S]*260px[\s\S]*240px/);
});


test('featured social post uses one real media block and no duplicate pseudo banner',()=>{
  assert.doesNotMatch(css,/#dashboardSocialPreview \.ds-review-post:first-child:after/);
  assert.match(css,/\.ds-review-feature-media\{[\s\S]*min-height:118px!important/);
});

test('hero preserves the approved cinematic globe and premium profile anchors',()=>{
  const tail=css.slice(css.lastIndexOf('/* ===== Final hero\/profile polish'));
  assert.match(tail,/\.dsx-hero:before\{[\s\S]*width:670px!important[\s\S]*height:670px!important/);
  assert.match(tail,/\.dsx-hero:after\{[\s\S]*width:390px!important[\s\S]*#ffd86f/);
  assert.match(tail,/\.dsx-hero-profile\{[\s\S]*max-width:330px!important/);
  assert.match(tail,/\.dsx-welcome\{[\s\S]*color:#d5e0ec!important/);
});
