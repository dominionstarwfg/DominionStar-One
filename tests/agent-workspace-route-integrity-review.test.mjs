import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=relative=>readFileSync(path.join(root,relative),'utf8');

const pages=[
  'member-dashboard/index.html',
  'member-login/index.html',
  'founder-control/index.html',
  'community/index.html',
  'direct-messages/index.html',
  'appointments/index.html',
  'member-directory/index.html',
  'recognition/index.html',
  'professional-profile/index.html',
  'account-settings/index.html'
];
const mainNav=[
  ['Home','/member-dashboard/'],
  ['Messages','/direct-messages/'],
  ['Meet','/meet/'],
  ['Community','/community/'],
  ['Calendar','/appointments/'],
  ['Team Members','/member-directory/'],
  ['Recognition','/recognition/'],
  ['My Profile','/professional-profile/'],
  ['Agent Settings','/account-settings/']
];
const routeToFile=raw=>{
  const url=new URL(raw,'https://dominionstarld.com');
  assert.equal(url.origin,'https://dominionstarld.com',raw);
  let pathname=decodeURIComponent(url.pathname);
  assert.ok(!pathname.includes('..'),`Unexpected traversal in ${raw}`);
  let mapped;
  if(pathname==='/meet/' || pathname.startsWith('/meet/')){
    mapped='meet-desktop/ui/'+pathname.slice('/meet/'.length);
  }else{
    mapped=pathname.slice(1);
  }
  if(!mapped || mapped.endsWith('/'))mapped+='index.html';
  return path.join(root,mapped);
};

test('All ten core authenticated pages link only to existing internal routes and assets',()=>{
  let reviewed=0;
  for(const page of pages){
    const markup=read(page);
    for(const match of markup.matchAll(/\b(?:href|src)\s*=\s*["'](\/[^"']+)["']/g)){
      const target=match[1];
      const mapped=routeToFile(target);
      assert.ok(existsSync(mapped),`${page} has missing route or asset: ${target}`);
      assert.ok(statSync(mapped).isFile(),`${page} target is not a file: ${target}`);
      reviewed++;
    }
  }
  assert.ok(reviewed>=180,`Unexpectedly few route/asset references checked: ${reviewed}`);
});

test('Dashboard and shared navigation use exactly the same nine core destinations',()=>{
  const dashboard=read('member-dashboard/index.html');
  const shell=read('assets/js/dominionstar-agent-nav-shell.js');
  const nav=dashboard.match(/<nav class="dsos-nav"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav,'Main Dashboard navigation not found');
  for(const [label,route] of mainNav){
    assert.ok(nav.includes('href="'+route+'"'),`Dashboard: ${label} target differs`);
    assert.ok(nav.includes('<span>'+label+'</span>'),`Dashboard: ${label} is mislabeled`);
    assert.ok(shell.includes("['"+label+"','"+route+"','"),`Shared nav: ${label} mismatch`);
    assert.ok(existsSync(routeToFile(route)),`Main navigation destination missing: ${route}`);
  }
});

test('Meet remains mounted at /meet/ and is not a duplicate Dashboard settings route',()=>{
  const build=read('scripts/build-public-netlify.sh');
  const agent=read('account-settings/index.html');
  const meet=read('meet-desktop/ui/index.html');
  assert.match(build,/MEET_SOURCE="\$ROOT\/meet-desktop\/ui"/);
  assert.match(build,/MEET_DIST="\$DIST\/meet"/);
  assert.match(build,/rsync -a --delete "\$MEET_SOURCE\/" "\$MEET_DIST\/"/);
  assert.match(agent,/href="\/meet\/">Open DominionStar Meet<\/a>/);
  assert.match(meet,/id="settingsDialog"/);
  assert.doesNotMatch(agent,/data-settings-tab="(?:audio-video|meeting-defaults)"/);
});

test('Dashboard does not visibly label itself with an unsupported year',()=>{
  const dashboard=read('member-dashboard/index.html');
  const shell=read('assets/js/dominionstar-agent-nav-shell.js');
  const visible=dashboard.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]*>/g,' ')
    .replace(/\s+/g,' ');
  assert.doesNotMatch(visible,/\b2030\b/);
  assert.doesNotMatch(shell,/small\.textContent\s*=\s*['"]EXECUTIVE OS 2030/);
  assert.match(dashboard,/<title>DominionStar Executive OS/);
});
