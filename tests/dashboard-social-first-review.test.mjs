import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dashboard=read('member-dashboard/index.html');
const css=read('assets/css/dominionstar-social-first-dashboard.css');
const preview=read('scripts/build-public-netlify.sh');

test('Dashboard opens with the network feed rather than four large KPI tiles',()=>{
  const hero=dashboard.indexOf('class="dsx-hero"');
  const details=dashboard.indexOf('<details class="dsx-overview-drawer">');
  const feed=dashboard.indexOf('<section class="dsx-dashboard-grid">');
  assert.ok(hero>=0 && details>hero && feed>details);
  assert.match(dashboard,/<summary aria-label="Expand or collapse your executive network insights">/);
  assert.doesNotMatch(dashboard,/<details class="dsx-overview-drawer"\s+open\b/);
  assert.match(dashboard,/class="dsx-overview" aria-label="Executive overview"/);
  assert.equal((dashboard.match(/class="dsx-stat dsx-stat-/g)||[]).length,4);
  assert.match(dashboard,/<h2>From your network<\/h2>/);
  assert.match(dashboard,/id="dashboardComposerBody"/);
  assert.match(dashboard,/id="dashboardSocialPreview"/);
});

test('New presentation CSS loads after shared design; Dashboard-only scoped',()=>{
  const cinematic=dashboard.indexOf('dominionstar-cinematic-os.css');
  const natural=dashboard.indexOf('dominionstar-feed-flow.css');
  const social=dashboard.indexOf('dominionstar-social-first-dashboard.css?v=social-first-20261111');
  assert.ok(cinematic>=0 && natural>cinematic && social>natural);
  assert.match(css,/body\.dsos-executive \.dsx-dashboard-grid\{/);
  assert.match(css,/body\.dsos-executive \.dsx-overview-drawer:not\(\[open\]\) \.dsx-overview\{/);
  assert.match(css,/body\.dsos-executive \.dsx-dashboard-composer textarea\{/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/\.ds-auth-os-page/);
});

test('Backend-disabled preview reflects this visual change with correct sample copy',()=>{
  assert.match(preview,/social-first Agent OS layouts/);
  assert.match(preview,/Levismond Aken/);
  assert.doesNotMatch(preview,/Levismous/);
  assert.doesNotMatch(preview,/Wednesday, July 22/);
  assert.match(preview,/meta http-equiv="refresh" content="0;url=\/member-dashboard\/"/);
  assert.match(preview,/visual-review'\/'index.html/);
  assert.match(preview,/DOMINIONSTAR_DEPLOY_PREVIEW_STATIC_VISUAL_OK/);
  assert.match(preview,/connect-src 'none'/);
});


test('Sample Feed shows four distinct post formats with visible safe actions',()=>{
  assert.match(preview,/Saving Your Future · Live Zoom invitation/);
  assert.match(preview,/ds-review-message-bubble/);
  assert.match(preview,/ds-review-long-post/);
  assert.match(preview,/ds-review-text-post/);
  assert.doesNotMatch(preview,/class="ds-review-zoom-card"/);
  assert.match(preview,/https:\/\/zoom\.us\/j\/7443001370/);
  assert.match(preview,/target="_blank" rel="noopener noreferrer"/);
  assert.match(preview,/ds-review-post-photo/);
  assert.match(preview,/ds-review-photo-layout/);
  assert.match(preview,/Full proportions preserved/);
  assert.match(preview,/assets\/founder-blue\.jpeg/);
  assert.match(preview,/ds-review-quote-card/);
  assert.match(preview,/Success is not just what you achieve/);
  assert.match(preview,/It’s who you become/);
  assert.match(preview,/ds-review-milestone-card/);
  assert.match(preview,/Licensing milestone achieved/);
  assert.match(preview,/EXAMPLE POST/);
  assert.match(preview,/socialActions\('like'\)/);
  assert.match(preview,/socialActions\('love'\)/);
  assert.match(preview,/html\('dashboardSocialPreview',shortPost\+post\+photoPost\+longPost\+quotePost\)/);
  assert.match(preview,/html\('feedPageStream',shortPost\+post\+photoPost\+longPost\+quotePost\+dashboardSecond\)/);
  assert.match(preview,/button,input,select,textarea,form\{pointer-events:none!important\}/);
  assert.match(preview,/connect-src 'none'/);
});

test('Preview-only fixtures parse as JavaScript without any live posting scripts',()=>{
  const marker='dominionstar-visual-review-fixtures.js';
  const pos=preview.indexOf('cat > "$DIST/assets/js/'+marker+'"');
  assert.ok(pos>0,'visual preview fixtures must exist');
  const open=preview.indexOf("<<'JS'\n",pos);
  assert.ok(open>pos,'visual preview JS heredoc must exist');
  const close=preview.indexOf('\nJS\n',open);
  assert.ok(close>open,'visual preview JS heredoc must close');
  const body=preview.slice(open+7,close);
  assert.ok(body.includes('feedPageStream'),'sample posts must load in Feed');
  assert.ok(body.includes('dashboardSocialPreview'),'sample posts must load in Dashboard');
  assert.doesNotMatch(body,/\b(?:supabase|fetch\(|\.rpc\(|\.insert\(|\.update\()\b/i);
  // Node vm compiles but does not execute sample fixtures or access any backend.
  const {Script}=vm;
  assert.doesNotThrow(()=>new Script(body));
});

test('Preview improvements do not reach production or alter posting backend',()=>{
  const visual=read('assets/css/dominionstar-social-preview-refinement.css');
  const demo=read('assets/js/dominionstar-social-preview-interactions.js');
  const htmlFeed=read('feed/index.html');
  assert.ok(visual.includes('body.ds-visual-review .ds-review-event'));
  assert.match(visual,/object-fit:contain!important/);
  assert.match(visual,/pointer-events:auto!important/);
  assert.match(demo,/local preview only/i);
  assert.match(demo,/data-preview-action/);
  assert.match(demo,/Nothing was published/);
  assert.ok(!['fetch(','.rpc(','.from(','.insert(','.update(','WebSocket(','sendBeacon('].some(api=>demo.includes(api)), 'Preview demo cannot call remote APIs');
  assert.match(preview,/dominionstar-social-preview-refinement.css/);
  assert.match(preview,/dominionstar-social-preview-interactions.js/);
  assert.doesNotMatch(htmlFeed,/dominionstar-social-preview-interactions.js/);
  assert.doesNotMatch(dashboard,/dominionstar-social-preview-interactions.js/);
  assert.doesNotThrow(()=>new vm.Script(demo));
});


test('Preview and real Feed retain natural vertical heights and content-dependent surfaces',()=>{
  const organic=read('assets/css/dominionstar-organic-posts.css');
  assert.match(organic,/data-post-kind="meeting"/);
  assert.match(organic,/data-post-kind="link"/);
  assert.match(organic,/data-post-kind="quote"/);
  assert.match(organic,/data-post-kind="announcement"/);
  assert.match(organic,/ds-review-zoom-post/);
  assert.match(organic,/ds-review-photo-post/);
  assert.match(organic,/ds-review-long-post/);
  assert.match(organic,/max-height:none!important/);
  assert.match(organic,/white-space:pre-wrap!important/);
  assert.match(organic,/ds-review-message-bubble/);
  for(const path of ['feed/index.html','member-dashboard/index.html']){
    const html=read(path);
    assert.match(html,/dominionstar-organic-posts\.css\?v=organic-20261111/);
    assert.match(html,/dashboard-social\.js\?v=organic-20261111/);
  }
});
