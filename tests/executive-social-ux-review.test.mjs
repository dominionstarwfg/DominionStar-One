import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const dashboard=read('member-dashboard/index.html');
const dashboardCss=read('assets/css/member-dashboard-executive-2030.css');
const dashboardScript=read('assets/js/member-dashboard.js');
const navigation=read('assets/js/dominionstar-os.js');
const community=read('assets/js/community-hub.js');
const communityPage=read('community/index.html');
const communityCss=read('assets/css/community-social-executive-review.css');
const login=read('member-login/index.html');

test('Approved simplified sidebar has clean vector icons and no retired tabs',()=>{
  const nav=dashboard.match(/<nav class="dsos-nav"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav,'sidebar missing');
  assert.doesNotMatch(nav,/\/workspace\/|Workspace|href="\/academy\/"|>Directory</);
  for(const [label,route] of [
    ['Home','/member-dashboard/'],
    ['Messages','/direct-messages/'],
    ['Meet','/meet/'],
    ['Community','/community/'],
    ['Calendar','/appointments/'],
    ['Team Members','/member-directory/'],
    ['Recognition','/recognition/'],
    ['My Profile','/professional-profile/'],
    ['Agent Settings','/account-settings/']]){
     assert.ok(nav.includes('href="'+route+'"'),'Missing '+label+' route');
     assert.ok(nav.includes('<span>'+label+'</span>'),'Missing plain label '+label);
  }
  assert.match(nav,/<svg class="ds30-icon"/);
  assert.match(dashboard,/<symbol id="ds30-message"/);
  assert.match(dashboard,/<symbol id="ds30-trophy"/);
  assert.match(dashboard,/<symbol id="ds30-user"/);
  assert.match(dashboard,/<symbol id="ds30-settings"/);
  assert.match(dashboardCss,/\.dsos-executive-2030 \.ds30-icon/);
});

test('Real notification and message events drive meaningful status colors',()=>{
  assert.match(dashboard,/id="notificationCount"/);
  assert.match(dashboard,/id="sidebarUnreadMessages"/);
  assert.match(dashboardScript,/const unreadMessages = notifications\.filter/);
  assert.match(dashboardScript,/item\.event_type\.startsWith\('message\.'\)/);
  assert.match(dashboardScript,/messageBadge\.classList\.toggle\('member-hidden', unreadMessages === 0\)/);
  assert.match(dashboardCss,/\.ds30-nav-badge/);
  assert.match(dashboardCss,/#d44758/);
  assert.match(dashboardCss,/#358e96/);
});

test('Approved agents see community first, not profile statistics first',()=>{
  const feedAt=dashboard.indexOf('id="dsosCommunitySection"');
  const profileAt=dashboard.indexOf('class="dsos-profile-card"');
  assert.ok(feedAt>0 && profileAt>feedAt,'feed should precede identity section');
  assert.match(dashboard,/id="dsosCommunitySection" class="[^"]*member-hidden"/);
  assert.match(dashboardScript,/status === 'approved' \? loadDashboardCommunity\(\) : Promise\.resolve\(\)/);
});

test('Post three-dot menu actions copy actual text and a deep link',()=>{
  assert.match(community,/class="community-options-trigger"/);
  assert.match(community,/data-post-action="copy"/);
  assert.match(community,/data-post-action="link"/);
  assert.match(community,/navigator\.clipboard\.writeText/);
  assert.match(community,/new URL\('\/community\/\?post='\+encodeURIComponent\(post\.id\),location\.origin\)/);
  assert.match(community,/const sharedId=new URLSearchParams\(location\.search\)\.get\('post'\)/);
  assert.match(community,/renderFeed\(avatarMap\)/);
  assert.match(communityCss,/\.community-options-menu\[hidden\]\{display:none!important\}/);
  assert.match(communityPage,/aria-live="polite"/);
});

test('Link rendering is escaped and limited to https or http',()=>{
  assert.match(community,/const linkify = value/);
  assert.match(community,/new URL\(candidate\)/);
  assert.match(community,/\['http:','https:'\]\.includes\(url\.protocol\)/);
  assert.match(community,/rel="noopener noreferrer nofollow"/);
  assert.match(community,/\$\{linkify\(post\.body\)\}/);
});

test('Media attachments remain explicitly local drafts until secure upload approval',()=>{
  assert.match(communityPage,/Local preview only\. Secure media publishing is not enabled\./);
  assert.match(communityPage,/data-draft-attach/);
  assert.match(communityPage,/data-draft-file-input/);
  assert.doesNotMatch(communityPage,/data-draft-picker/);
  assert.doesNotMatch(community,/storage\.from\('community-media'\)/);
});

test('Executive login retains mandatory Agent Code and guards optional Google sign-in',()=>{
  assert.match(login,/Where your <em>next chapter<\/em> begins/);
  assert.match(login,/Founder must verify and approve your membership/);
  assert.match(login,/name="full_name"/);
  assert.match(login,/name="agent_code"/);
  assert.match(login,/name="smd_name"/);
  assert.match(login,/name="password"/);
  assert.match(login,/id="memberGoogleSignIn" class="login2-google-section member-hidden"/);
  assert.match(login,/member-login-google-flags\.js/);
  assert.match(login,/id="memberLoginForm"/);
  assert.match(login,/id="memberRegisterForm"/);
  assert.match(login,/id="memberResetForm"/);
});


test('Executive community post action row uses existing Supabase interaction endpoints',()=>{
  const social=read('assets/js/dashboard-social-2030.js');
  assert.match(dashboard,/dashboard-social-2030\.js/);
  for(const action of ['like','comment','repost','share']) {
    assert.match(social,new RegExp('data-social="'+action+'"'));
  }
  assert.match(social,/community_toggle_reaction/);
  assert.match(social,/community_comments/);
  assert.match(social,/community_messages/);
  assert.match(social,/navigator\.clipboard\?\.writeText/);
  assert.match(social,/navigator\.share/);
  assert.match(social,/list_community_feed/);
  assert.match(social,/\.in\('message_id',ids\)/);
  assert.match(social,/\.slice\(0,2000\)/);
  assert.match(social,/const linkify = value/);
  assert.match(social,/escapeHtml\(candidate\)/);
  assert.match(social,/aria-pressed/);
  assert.match(social,/class="ds30-post-actions"/);
  assert.doesNotMatch(social,/Math\.random\(\)/);
});

test('Dashboard engagement counts are actual queried rows and not mock values',async()=>{
  const social=read('assets/js/dashboard-social-2030.js');
  const registered={};
  const rendered={innerHTML:'',insertAdjacentElement(){},setAttribute(){},removeAttribute(){},
    addEventListener(name,handler){registered[name]=handler}};
  const fakeDocument={createElement:()=>({className:'',textContent:'',
    setAttribute(){},classList:{toggle(){}}})};
  const client={
    rpc:async()=>({data:[{id:'post-a',title:'Professional update',
      body:'Growing through mentorship.',author_full_name:'Test Agent',
      post_type:'discussion',created_at:'2026-10-19T18:00:00Z'}],error:null}),
    from(table){
      return {
        select(){return this},in(){return this},eq(){return this},
        then(resolve,reject){
          const rows=table==='community_reactions'
            ? [{message_id:'post-a',user_id:'viewer-a',reaction:'like'},
               {message_id:'post-a',user_id:'viewer-b',reaction:'like'}]
            : [{message_id:'post-a'}];
          return Promise.resolve({data:rows,error:null}).then(resolve,reject);
        }
      };
    }
  };
  const context={window:{},document:fakeDocument,navigator:{},location:{origin:'https://dominionstarld.com'},URL};
  vm.runInNewContext(social,context);
  await context.window.DSDashboardSocial.mount({client,memberId:'viewer-a',target:rendered});
  assert.match(rendered.innerHTML,/2 likes/);
  assert.match(rendered.innerHTML,/1 comment/);
  assert.match(rendered.innerHTML,/data-social="repost"/);
  assert.match(rendered.innerHTML,/data-social="share"/);
  assert.match(rendered.innerHTML,/aria-pressed="true"/);
  assert.equal(typeof registered.click,'function');
  assert.equal(typeof registered.submit,'function');
});
