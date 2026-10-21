import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('assets/js/dominionstar-public-app-shell.js');
const css=read('assets/css/dominionstar-public-app-shell.css');
const community=read('community/index.html');
const draft=read('assets/js/community-media-draft-review.js');
const draftsCss=read('assets/css/community-media-draft-review.css');
const publicPages=[
 'index.html','mentorship/index.html','financial-services/index.html','opportunity/index.html',
 'about/index.html','knowledge/index.html','schedule/index.html','consultation/index.html',
 'join/index.html','knowledge/articles/build-a-career-on-trust/index.html'
];

test('Public navigation continuity is integrated across core marketing pages',()=>{
 for(const path of publicPages){
   const source=read(path);
   assert.match(source,/dominionstar-public-app-shell\.css/,path);
   assert.match(source,/dominionstar-public-app-shell\.js/,path);
   assert.match(source,/canonical/,path);
   assert.match(source,/<main/,path);
 }
});
test('Navigation remains native with honest progress and reduced-motion handling',()=>{
 assert.match(js,/url\.origin!==location\.origin/);
 assert.match(js,/event\.metaKey/);
 assert.match(js,/event\.defaultPrevented/);
 assert.match(js,/event\.target\.closest\('a\[href\]'\)/);
 assert.match(js,/window\.addEventListener\('pageshow',clear\)/);
 assert.match(js,/window\.addEventListener\('pagehide',clear\)/);
 assert.doesNotMatch(js,/setTimeout|pushState|fetch\(/);
 assert.match(css,/@view-transition\{navigation:auto\}/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(js,/dialog\.showModal/);
 assert.match(js,/event\.key\.toLowerCase\(\)==='k'/);
});
test('Composer has one universal attachment action and caption-first presentation',()=>{
 assert.match(community,/class="dsmedia-composer-top"/);
 assert.match(community,/name="body"/);
 assert.match(community,/data-draft-attach/);
 assert.match(community,/type="file" data-draft-file-input/);
 assert.match(community,/class="dsmedia-post-options"/);
 assert.doesNotMatch(community,/data-draft-picker/);
 assert.match(draft,/attach\?\.addEventListener\('click'/);
 assert.doesNotMatch(draft,/requestedKind|data-draft-picker/);
 assert.match(draftsCss,/\.dsmedia-attach-button svg/);
});
test('Draft-only media cannot become a silent broken publication',()=>{
 assert.match(draft,/publish\.disabled=blocked/);
 assert.match(draft,/event\.stopImmediatePropagation\(\)/);
 assert.match(draft,/Local preview only|local preview only/);
 assert.doesNotMatch(draft,/\.storage\.from\(|\.upload\(/);
});


test('Primary navigation and interactive actions retain left-side placement',()=>{
  const shell=read('assets/js/dominionstar-public-app-shell.js');
  const shellCss=read('assets/css/dominionstar-public-app-shell.css');
  const dashboardCss=read('assets/css/member-dashboard-executive-2030.css');
  assert.match(shell,/brand\.insertAdjacentElement\('afterend',button\)/);
  assert.doesNotMatch(shell,/insertBefore\(button,cta\)/);
  assert.match(shellCss,/left:17px!important;right:auto!important/);
  assert.match(dashboardCss,/\.dsos-sidebar\{grid-column:1;left:0;right:auto/);
  assert.match(dashboardCss,/\.ds30-post-actions\{\s*display:flex!important;justify-content:flex-start/);
  assert.match(draftsCss,/\.community-composer-actions\{\s*display:flex;justify-content:flex-start!important/);
});
