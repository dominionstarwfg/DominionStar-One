import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const founderHtml=read('founder-control/index.html');
const founderJs=read('assets/js/founder-control.js');
const recognition=read('assets/js/member-recognition-review.js');
const css=read('assets/css/dominionstar-auth-os-v2.css');

test('Founder member administration renders all ten operational columns',()=>{
  assert.match(founderHtml,/Recognize Advancement/);
  assert.match(founderHtml,/Exclusive 20/);
  assert.match(founderJs,/colspan="10"/);
  assert.match(founderJs,/exclusive_member_number/);
  assert.match(founderJs,/recognize-member/);
  assert.match(founderJs,/founder-exclusive-control/);
});

test('Exclusive 20 uses the authoritative numbered assignment RPC',()=>{
  assert.match(founderJs,/founder_update_member/);
  assert.match(founderJs,/mark_founding_member:\s*null/);
  assert.match(founderJs,/assign_exclusive_founding_number/);
  assert.match(founderJs,/should_be_founding:\s*founding/);
  assert.match(founderJs,/original\.founding_member/);
});

test('Founder recognition is backed by current rank history and exact Recognition feed format',()=>{
  assert.match(founderJs,/from\('rank_history'\)/);
  assert.match(founderJs,/history\.data\.new_rank !== member\.rank/);
  assert.match(founderJs,/Leadership Recognition · \$\{member\.full_name\}/);
  assert.match(founderJs,/from\('community_messages'\)/);
  assert.match(founderJs,/post_type:'announcement'/);
  assert.match(founderJs,/gte\('created_at',history\.data\.created_at\)/);
  assert.match(recognition,/title\.startsWith\('Leadership Recognition · '\)/);
});

test('Profile Settings and Messages explicitly override legacy dark-theme descendants',()=>{
  assert.match(css,/Profile: override legacy dark-card descendants/);
  assert.match(css,/verified-data-grid span[\s\S]*color:#5d7287!important/);
  assert.match(css,/Settings: convert the old dark RC5 interior/);
  assert.match(css,/settings-nav button\.active[\s\S]*background:#173b5c!important/);
  assert.match(css,/Messages: old dark-theme controls/);
  assert.match(css,/dm-header-actions button[\s\S]*color:#315b7d!important/);
  assert.match(css,/dm-os[\s\S]*flex:1 1 auto!important/);
});

test('Founder wide administration table remains usable with the dashboard sidebar',()=>{
  assert.match(css,/founder-member-table\{min-width:1480px\}/);
  assert.match(css,/founder-member-table th:first-child,[\s\S]*position:sticky/);
  assert.match(css,/recognize-member[\s\S]*min-width:96px/);
});
