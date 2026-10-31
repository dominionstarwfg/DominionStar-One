import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

const authenticatedPages=[
  'professional-profile/index.html',
  'account-settings/index.html',
  'direct-messages/index.html',
  'community/index.html',
  'community-chat/index.html',
  'community-center/index.html',
  'appointments/index.html',
  'member-directory/index.html',
  'recognition/index.html',
  'notifications/index.html',
  'digital-card/index.html',
  'mindset-center/index.html',
  'agent-journey/index.html',
  'agent-learning/index.html',
  'founder-control/index.html',
  'founder-dashboard/index.html',
  'founder-appointments/index.html',
  'founder-email/index.html',
  'qa-center/index.html',
  'release-check/index.html',
  'founder-features/index.html',
  'founder-diagnostics/index.html'
];

test('every authenticated Agent and Founder surface loads the unified OS contract',()=>{
  for(const path of authenticatedPages){
    const source=read(path);
    assert.match(source,/dominionstar-auth-os-v2\.css/,path+' missing authenticated OS stylesheet');
    assert.match(source,/dominionstar-agent-nav-shell\.css/,path+' missing shared navigation stylesheet');
    assert.match(source,/dominionstar-agent-nav-shell\.js/,path+' missing shared navigation runtime');
  }
});

test('dashboard routes growth work only to authenticated OS stages',()=>{
  const dashboard=read('member-dashboard/index.html');
  assert.doesNotMatch(dashboard,/href="\/journey\/"/);
  assert.doesNotMatch(dashboard,/href="\/academy\/"/);
  assert.doesNotMatch(dashboard,/href="\/mentorship\/"/);
  assert.doesNotMatch(dashboard,/href="\/leadership\/"/);
  assert.doesNotMatch(dashboard,/href="\/financial-services\/"/);
  assert.match(dashboard,/href="\/agent-journey\/"/);
  assert.match(dashboard,/href="\/agent-learning\/"/);
  assert.doesNotMatch(dashboard,/Featured learning|Professional resources/);
});

test('Agent Journey uses the live milestone schema rather than stale label field',()=>{
  const dashboard=read('assets/js/member-dashboard.js');
  const journey=read('assets/js/agent-journey.js');
  assert.match(dashboard,/select\('milestone_key,title,completed'\)/);
  assert.doesNotMatch(dashboard,/milestone_label/);
  assert.match(journey,/select\('id,milestone_key,title,completed,completed_at'\)/);
  assert.match(journey,/ensure_default_milestones/);
});

test('full Notification Center uses the narrow authenticated read-state RPC',()=>{
  const notifications=read('assets/js/notifications-center.js');
  assert.match(notifications,/mark_my_executive_notifications_read/);
  assert.doesNotMatch(notifications,/\.from\('executive_events'\)\.update\(\{read_at:/);
  assert.match(notifications,/safeActionUrl/);
});

test('Founder operations are consistently permission-gated',()=>{
  const release=read('assets/js/release-check.js');
  assert.match(release,/founder\.data!==true/);
  assert.match(release,/Founder access is required|Founder access required/);

  const analytics=read('founder-dashboard/founder-dashboard.js');
  assert.match(analytics,/select\('is_founder,verification_status'\)/);
  assert.match(analytics,/authorization:\`Bearer \$\{token\}\`/);
  assert.doesNotMatch(analytics,/ds_founder_key|founderKey/);

  const server=read('netlify/functions/founder-data.mjs');
  assert.match(server,/authorization\.replace\(\/\^Bearer/);
  assert.match(server,/is_founder,verification_status/);
  assert.match(server,/profile\.data\?\.is_founder===true/);
});

const channel=value=>{
  const h=value.replace('#','');
  return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);
};
const luminance=value=>{
  const [r,g,b]=channel(value).map(c=>c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4));
  return .2126*r+.7152*g+.0722*b;
};
const ratio=(a,b)=>{
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};

test('core authenticated palette meets readable contrast targets',()=>{
  const pairs=[
    ['#10263f','#ffffff'],
    ['#4e6479','#ffffff'],
    ['#d6e2ee','#0b213b'],
    ['#f1cf93','#0b213b'],
    ['#5d7287','#ffffff']
  ];
  for(const [fg,bg] of pairs)assert.ok(ratio(fg,bg)>=4.5,`${fg} on ${bg} contrast ${ratio(fg,bg).toFixed(2)} is below 4.5`);
  const css=read('assets/css/dominionstar-auth-os-v2.css');
  assert.match(css,/small\{font-size:12px!important\}/);
  assert.match(css,/input::placeholder[\s\S]*#5d7287!important/);
  assert.match(css,/member-dashboard-header p[\s\S]*#d6e2ee!important/);
});

test('shared shell covers the full Agent and Founder route families',()=>{
  const shell=read('assets/js/dominionstar-agent-nav-shell.js');
  for(const root of ['#dmApp','#notificationApp','#mindsetApp','#chatApp','#agentJourneyApp','#agentLearningApp','#founderApp','#founderDashboard','#releaseCheckApp']){
    assert.ok(shell.includes(root),'missing root '+root);
  }
  assert.match(shell,/FOUNDER OS/);
  assert.match(shell,/EXECUTIVE OS/);
  assert.match(shell,/app\.hidden\|\|app\.hasAttribute\('hidden'\)/);
});

test('legacy authenticated build labels are normalized at runtime',()=>{
  const shell=read('assets/js/dominionstar-agent-nav-shell.js');
  assert.match(shell,/DominionStar · Founder OS/);
  assert.match(shell,/DominionStar · Executive OS/);
});
