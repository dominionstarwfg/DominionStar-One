import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

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
  assert.match(preview,/DOMINIONSTAR_DEPLOY_PREVIEW_STATIC_VISUAL_OK/);
  assert.match(preview,/connect-src 'none'/);
});
