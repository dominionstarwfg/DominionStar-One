import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const js=read('assets/js/dominionstar-agent-nav-shell.js');
const css=read('assets/css/dominionstar-agent-nav-shell.css');
const targetPages=[
 ['feed/index.html','feedApp'],
 ['community/index.html','communityApp'],
 ['member-directory/index.html','directoryApp'],
 ['appointments/index.html','appointmentApp'],
 ['professional-profile/index.html','profileApp'],
 ['account-settings/index.html','settingsApp']
];

test('Member shell mounts only into authenticated app roots and never bypasses their gates',()=>{
  for(const root of ['#feedApp','#communityApp','#appointmentApp','#directoryApp','#profileApp','#settingsApp']){
    assert.ok(js.includes(root),'Missing authenticated root '+root);
  }
  assert.match(js,/app\.prepend\(shell\)/);
  assert.doesNotMatch(js,/\.classList\.remove\('member-hidden'\)/);
  assert.doesNotMatch(js,/signIn|signOut|setSession|updateUser|is_founder|verification_status/);
  assert.match(js,/app\.classList\.contains\('member-hidden'\)/);
  assert.match(js,/app\.hidden\|\|app\.hasAttribute\('hidden'\)/);
  for(const [path,id] of targetPages){
    const html=read(path);
    assert.match(html,new RegExp('<section id="'+id+'" class="member-hidden"'));
    assert.match(html,/dominionstar-agent-nav-shell\.css/);
    assert.match(html,/dominionstar-agent-nav-shell\.js/);
  }
});

test('Simple labels, SVGs and exact routes match executive approval',()=>{
 for(const [label,route] of [
  ['Dashboard','/member-dashboard/'],
  ['Feed','/feed/'],
  ['Messages','/direct-messages/'],
  ['Meet','/meet/'],
  ['Notifications','/notifications/'],
  ['Community','/community/'],
  ['Calendar','/appointments/'],
  ['Team Members','/member-directory/'],
  ['Recognition','/recognition/'],
  ['My Journey','/agent-journey/'],
  ['Learning','/agent-learning/'],
  ['Aurora','/member-dashboard/?open=aurora'],
  ['My Profile','/professional-profile/'],
  ['Agent Settings','/account-settings/']
 ]){
   assert.ok(js.includes("['"+label+"','"+route+"'"),label);
 }
 const agentItems=js.match(/const agentItems=\[([\s\S]*?)\];\s*const founderItems=/)?.[1]||'';
 assert.doesNotMatch(agentItems,/\/workspace\//);
 assert.doesNotMatch(agentItems,/Directory'/);
 assert.match(js,/aria-current','page'/);
 assert.match(css,/\.ds-agent-nav-item\.active/);
 assert.match(js,/<svg viewBox="0 0 24 24"/);
});

test('Enhanced navigation preserves normal page links and keyboard shortcuts',()=>{
 assert.match(js,/document\.addEventListener\('click'/);
 assert.match(js,/url\.origin|to\.origin!==location\.origin/);
 assert.match(js,/event\.ctrlKey/);
 assert.match(js,/event\.metaKey/);
 assert.match(js,/window\.addEventListener\('pageshow',clear\)/);
 assert.match(js,/window\.addEventListener\('pagehide',clear\)/);
 assert.match(js,/dialog\.showModal\(\)/);
 assert.match(js,/event\.key\.toLowerCase\(\)==='k'/);
 assert.doesNotMatch(js,/pushState|replaceState|setTimeout|location\.href\s*=/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Javascript source parses and code has no unprotected interpolation for route names',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(js,/section\.textContent=/);
 assert.match(js,/lastElementChild\.textContent=name/);
 assert.match(js,/results\.replaceChildren\(\)/);
 assert.match(css,/\.ds-agent-jump::backdrop/);
});
