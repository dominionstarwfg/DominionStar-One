import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'public-dist');
const fail=message=>{throw new Error(message)};
const read=relative=>readFileSync(path.join(dist,relative),'utf8');
const present=relative=>existsSync(path.join(dist,relative))&&statSync(path.join(dist,relative)).isFile();

if(!present('index.html'))fail('Public homepage missing from staged package');
if(!present('meet/index.html'))fail('Browser Meet must exist at /meet/');
if(!present('member-dashboard/index.html'))fail('Agent Dashboard is missing');
if(!present('account-settings/index.html'))fail('Agent Settings is missing');
if(!present('journey/index.html'))fail('Journey roadmap must be a real page');
if(!present('_redirects'))fail('Netlify redirects missing');
if(!present('_headers'))fail('Netlify security headers missing');
if(!present('public-release.json'))fail('Public release manifest missing');

const homepage=read('index.html'),meet=read('meet/index.html'),account=read('account-settings/index.html'),redirects=read('_redirects');
if(!homepage.includes('Home — No Family Left Behind | DominionStar Leadership Development'))
  fail('Wrong homepage: expected public DominionStar website');
if(homepage.includes('DominionStar Meet'))fail('Meet application leaked into homepage');
if(!meet.includes('DominionStar Meet'))fail('Wrong Meet mount at /meet/');
if(!meet.includes('id="settingsDialog"'))fail('Meet-owned Settings dialog missing');
if(!account.includes('href="/meet/">Open DominionStar Meet</a>'))fail('Agent Settings Meet handoff missing');
if(/^\/journey\/\s+\/opportunity\//m.test(redirects))
  fail('Journey route incorrectly redirected to Opportunity');
if(!/^\/journey\s+\/journey\/\s+301!/m.test(redirects))
  fail('Missing canonical Journey slash normalization');

for(const banned of ['meet-desktop','scripts','supabase','tests','.git','.github','netlify.toml','.env','.env.production']){
  if(existsSync(path.join(dist,banned)))fail('Nonpublic source in staged package: '+banned);
}

const pages=[
  'index.html','member-dashboard/index.html','member-login/index.html',
  'founder-control/index.html','community/index.html','direct-messages/index.html',
  'appointments/index.html','member-directory/index.html','recognition/index.html',
  'professional-profile/index.html','account-settings/index.html','journey/index.html'
];
let count=0;
for(const page of pages){
  const markup=read(page);
  for(const match of markup.matchAll(/\b(?:href|src)\s*=\s*["'](\/[^"']+)["']/g)){
    const raw=match[1];
    const url=new URL(raw,'https://dominionstarld.com');
    const rel=url.pathname.startsWith('/meet/')?
      'meet/'+url.pathname.slice('/meet/'.length):url.pathname.slice(1);
    const normalized=rel===''?'index.html':rel.endsWith('/')?rel+'index.html':rel;
    if(!present(normalized))fail(page+' references missing packaged asset: '+raw);
    count++;
  }
}
if(count<180)fail('Unexpectedly few packaged references checked ('+count+')');
console.log('DOMINIONSTAR_REVIEW_BUILD_OK');
console.log('PUBLIC_ROOT_OK | MEET_ROUTE_OK | JOURNEY_ROUTE_OK | AGENT_SETTINGS_BOUNDARY_OK');
console.log('PACKAGED_REFERENCES_OK '+count);
console.log('NO_TESTS_OR_DESKTOP_SOURCE_PUBLISHED');
