import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const social=read('assets/js/dashboard-social.js');
const css=read('assets/css/dominionstar-feed-flow.css');
const feed=read('feed/index.html');
const dashboard=read('member-dashboard/index.html');

function makeFeedTarget(id) {
  return {
    id,innerHTML:'',listeners:{},
    insertAdjacentElement(){},setAttribute(){},removeAttribute(){},
    querySelectorAll(){return []},
    addEventListener(event,fn){this.listeners[event]=fn}
  };
}

async function renderSample(target,body,options={}) {
  const post={
    id:'post-full-1',title:options.title||'A complete training announcement',
    body,author_full_name:'Approved Member',post_type:options.postType||'announcement',
    created_at:'2026-11-04T18:30:00Z'
  };
  const client={
    async rpc(){return {data:[post],error:null}},
    from(){return {
      select(){return this},in(){return this},eq(){return this},
      then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}
    }}
  };
  const fakeDocument={
    createElement:()=>({
      className:'',textContent:'',setAttribute(){},
      classList:{toggle(){}}
    }),
    addEventListener(){}
  };
  const context={
    window:{},document:fakeDocument,navigator:{},
    location:{origin:'https://dominionstarld.com',href:'https://dominionstarld.com/feed/'+(options.search||'')},URL
  };
  vm.runInNewContext(social,context);
  await context.window.DSDashboardSocial.mount({
    client,memberId:'member-test-1',target
  });
  return target.innerHTML;
}

test('Full Feed and Dashboard render every character of a long post with natural height',async()=>{
  const body='Original post starts.\n'+('Long-form agent training information stays visible. '.repeat(35))+'\nThe final paragraph is preserved.';
  assert.ok(body.length>900);
  const full=await renderSample(makeFeedTarget('feedPageStream'),body);
  assert.ok(full.includes('The final paragraph is preserved.'),'Full Feed must show final paragraph');
  assert.ok(full.includes('Original post starts.'),'Full Feed must show opening paragraph');
  assert.ok(full.includes('Long-form agent training information stays visible.'),'Full Feed must show middle paragraph');
  assert.ok(!full.includes('Read full post'),'Full Feed must never insert a truncation link');
  const preview=await renderSample(makeFeedTarget('dashboardSocialPreview'),body);
  assert.ok(preview.includes('The final paragraph is preserved.'),'Dashboard must not truncate content either');
  assert.ok(!preview.includes('Read full post'),'Dashboard must not add an artificial excerpt');
  assert.match(preview,/data-post-length="long"/);
});

test('Feed layout does not clip cards and preserves line breaks and long URLs',()=>{
  assert.match(css,/#feedPageStream \.ds30-social-post\{[\s\S]*height:auto!important;min-height:0!important;[\s\S]*max-height:none!important;overflow:visible!important/);
  assert.match(css,/#feedPageStream \.ds30-post-copy\{[\s\S]*height:auto!important;min-height:0!important;max-height:none!important;[\s\S]*white-space:pre-wrap!important;overflow-wrap:anywhere!important/);
  assert.match(css,/#feedPageStream\{[\s\S]*grid-auto-rows:max-content!important/);
  assert.match(css,/#feedPageStream \.ds30-social-post>h3\{[\s\S]*overflow-wrap:anywhere!important/);
  assert.doesNotMatch(css,/#feedPageStream[^\n]*\{[^}]*overflow-y:auto/);
});

test('Feed action controls have an independent 4-column flex-button layout',()=>{
  assert.match(css,/#feedPageStream \.ds30-post-actions\{[\s\S]*display:grid!important;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
  assert.match(css,/#feedPageStream \.ds30-post-actions>button,[\s\S]*?font:750 12px\/1\.25/);
  assert.match(css,/#feedPageStream \.ds30-post-actions \.ds30-action-icon,[\s\S]*?width:17px!important;height:17px!important/);
  assert.match(css,/#feedPageStream \.ds30-react-main\.has-reaction\.reaction-like\{color:#85baff/);
  assert.match(css,/#feedPageStream \.ds30-post-authorbar\{[\s\S]*display:flex!important/);
  assert.match(css,/#feedPageStream \.ds30-author-photo\{[\s\S]*object-fit:cover!important/);
});

test('Feed text and attachment controls remain readable on navy, never white-on-white',()=>{
  assert.match(css,/#feedPageStream \.ds30-post-copy\{[\s\S]*background:transparent!important;color:#e6eef8!important/);
  assert.match(css,/#feedApp #feedComposerBody\{[\s\S]*background:#071e39!important/);
  assert.match(css,/#feedApp #feedComposerBody::placeholder\{color:#b2c7dd!important/);
  assert.match(css,/#feedApp \.dsmedia-attach-hint,[\s\S]*color:#c7d8e9!important/);
  assert.match(css,/#feedApp \.dsos-screenreader\{[\s\S]*clip:rect\(0,0,0,0\)!important/);
  assert.match(css,/#feedPageStream \.ds30-comment-form\[hidden\]\{display:none!important/);
});

test('Feed fills main stage on wide screens, stacks right rail before narrow layouts',()=>{
  assert.match(css,/#feedApp \.dsx-feed-workspace\{[\s\S]*grid-template-columns:minmax\(0,1fr\) minmax\(250px,300px\)!important/);
  assert.match(css,/@media\(max-width:1180px\)\{[\s\S]*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css,/@media\(max-width:690px\)\{[\s\S]*flex-direction:column!important/);
  assert.match(css,/#feedApp \.dsx-feed-aside\{min-width:0!important/);
});

test('Feed repair stylesheet loads last and updated social script avoids stale cached version',()=>{
  for(const [path,html] of [['feed/index.html',feed],['member-dashboard/index.html',dashboard]]){
    assert.ok(html.indexOf('dominionstar-feed-flow.css?v=natural-flow-20261104')>html.indexOf('dominionstar-cinematic-os.css'),path+' must load after cinematic');
    assert.match(html,/dashboard-social\.js\?v=organic-20261111/);
  }
  assert.match(feed,/id="feedPageStream"/);
  assert.match(dashboard,/id="dashboardSocialPreview"/);
});


test('Short and long posts get length-specific styling without fixed-height truncation',async()=>{
  const short=await renderSample(makeFeedTarget('feedPageStream'),'One short sentence.');
  const long=await renderSample(makeFeedTarget('feedPageStream'),'Long agent update. '.repeat(45));
  assert.match(short,/data-post-length="short"/);
  assert.match(long,/data-post-length="long"/);
  assert.match(short,/data-post-kind="announcement"/);
  assert.match(long,/Long agent update/);
  const organic=read('assets/css/dominionstar-organic-posts.css');
  assert.match(organic,/max-height:none!important/);
  assert.match(organic,/line-height:1\.85!important/);
});

test('Real posts safely linkify Zoom, ordinary links and hashtags, with a readable message bubble',async()=>{
  const body='Join on Zoom https://us06web.zoom.us/j/7443001370 today.\n#SavingYourFuture #DominionStar';
  const html=await renderSample(makeFeedTarget('feedPageStream'),body);
  assert.match(html,/data-post-kind="meeting"/);
  assert.match(html,/ds30-post-message-bubble/);
  assert.match(html,/Shared Zoom meeting link/);
  assert.match(html,/href="https:\/\/us06web\.zoom\.us\/j\/7443001370"/);
  assert.match(html,/class="ds30-hashtag" href="\/feed\/\?tag=SavingYourFuture"/);
  assert.match(html,/class="ds30-hashtag" href="\/feed\/\?tag=DominionStar"/);
  assert.match(html,/rel="noopener noreferrer nofollow"/);
  assert.doesNotMatch(html,/Read full post/);
  const general=await renderSample(makeFeedTarget('feedPageStream'),'Read https://dominionstarld.com for more. #Leadership');
  assert.match(general,/data-post-kind="link"/);
  assert.match(general,/href="https:\/\/dominionstarld\.com\/"/);
  assert.doesNotMatch(general,/Shared Zoom meeting link/);
});

test('Hashtag links select the latest matching posts and allow returning to full Feed',async()=>{
  const body='Progress for #Leadership every day.';
  const matched=await renderSample(makeFeedTarget('feedPageStream'),body,{search:'?tag=Leadership'});
  assert.match(matched,/Latest posts tagged/);
  assert.match(matched,/Progress for/);
  assert.match(matched,/Show all posts/);
  const missed=await renderSample(makeFeedTarget('feedPageStream'),body,{search:'?tag=Licensing'});
  assert.match(missed,/No matching posts in the latest network updates/);
  assert.doesNotMatch(missed,/>Progress for/);
});

test('User-entered markup and unsafe schemes cannot become executable HTML links',async()=>{
  const body='Notice <img src=x onerror=alert(1)> & <script>alert(1)</script> javascript:alert(1) #Safe';
  const html=await renderSample(makeFeedTarget('feedPageStream'),body);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>|<img src=x/);
  assert.doesNotMatch(html,/href="javascript:/);
  assert.match(html,/href="\/feed\/\?tag=Safe"/);
});
