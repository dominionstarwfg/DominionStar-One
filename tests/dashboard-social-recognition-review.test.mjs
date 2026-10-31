import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

const dashboard=read('member-dashboard/index.html');
const member=read('assets/js/member-dashboard.js');
const social=read('assets/js/dashboard-social.js');
const community=read('assets/js/community-hub.js');
const founder=read('assets/js/founder-admin.js');
const founderHtml=read('founder-control/index.html');
const recognition=read('recognition/index.html');
const recognitionJs=read('assets/js/member-recognition-review.js');
const nav=read('assets/js/dominionstar-os.js');
const sharedNav=read('assets/js/dominionstar-agent-nav-shell.js');

test('Greeting does not assume returning visitor and displays the first name',()=>{
  assert.match(dashboard,/class="dsos-feed-greeting"><span id="heroGreeting">Good day<\/span>, <strong id="heroMemberName">Member<\/strong>/);
  assert.doesNotMatch(dashboard,/Welcome back/);
  assert.match(member,/profile\.preferred_name \|\| profile\.full_name/);
  for(const text of ['Good morning','Good afternoon','Good evening'])assert.ok(member.includes(text));
  assert.match(member,/heroGreeting\.textContent = greetingText/);
  assert.match(member,/new Date\(\)\.getHours\(\)/);
});

test('Social actions include copy and download without pretending media was uploaded',()=>{
  for(const js of [social,community]){
    assert.match(js,/Copy post text/);
    assert.match(js,/Copy post link/);
    assert.match(js,/Download post text \(\.txt\)/);
    assert.match(js,/new Blob\(/);
    assert.match(js,/URL\.createObjectURL/);
    assert.match(js,/URL\.revokeObjectURL/);
  }
  assert.match(social,/data-social="repost"/);
  assert.match(social,/community_toggle_reaction/);
  assert.match(social,/community_comments/);
  assert.match(social,/noopener noreferrer nofollow/);
  assert.doesNotMatch(social,/\.storage\.from\('community-media'\)/);
});

test('Founder-selected recognition cannot be silently inferred from a rank decrease',()=>{
  assert.match(founderHtml,/Recognize Advancement/);
  assert.match(founderHtml,/id="founderRecognitionResult"/);
  assert.match(founder,/ranks\.indexOf\(rankSelect\.value\)>ranks\.indexOf\(current\.rank\)/);
  assert.match(founder,/recognition\.disabled=!isAdvancement/);
  assert.match(founder,/recognitionCheck\?\.checked/);
  assert.match(founder,/verified\.data\?\.rank!==targetRank/);
  assert.match(founder,/post_type:'announcement'/);
});

test('Recognition is gated by approved member session; it is not the public journey route',()=>{
  assert.match(recognition,/id="recognitionGate"/);
  assert.match(recognitionJs,/verification_status/);
  assert.match(recognitionJs,/list_community_feed/);
  assert.match(recognitionJs,/post_type==='announcement'/);
  assert.match(recognitionJs,/Leadership Recognition/);
  assert.doesNotMatch(recognitionJs,/\.insert\(|\.update\(/);
  assert.match(dashboard,/href="\/recognition\/"/);
  assert.match(nav,/\['Recognition','\/recognition\/'/);
  assert.match(sharedNav,/\['Recognition','\/recognition\/'/);
});
