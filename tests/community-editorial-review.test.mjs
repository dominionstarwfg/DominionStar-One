import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const community = read('assets/js/community-hub.js');
const dashboard = read('assets/js/member-dashboard.js');
const article = read('knowledge/articles/build-a-career-on-trust/index.html');
const articleStyle = read('assets/css/dominionstar-editorial-concept8.css');
const siteIndex = read('knowledge/index.html');
const sitemap = read('sitemap.xml');
const editorialPath = '/knowledge/articles/build-a-career-on-trust/';

test('Community Founder tools do not trust email or browser profile claims',()=>{
  assert.match(community,/supabase\.rpc\('is_dominionstar_founder'\)/);
  assert.match(community,/isFounder=founderResult\.error==null && founderResult\.data===true/);
  assert.doesNotMatch(community,/isFounder\s*=\s*profile\.(?:role|is_founder)/);
  assert.match(community,/is_pinned:isFounder\?/);
  assert.match(dashboard,/supabase\.rpc\('is_dominionstar_founder'\)/);
});

test('Community avoids cross-feed comment and reaction table scans',()=>{
  assert.match(community,/const postIds=posts\.map\(post=>post\.id\)\.filter\(Boolean\)/);
  assert.match(community,/supabase\.from\('community_comments'\)[\s\S]*?\.in\('message_id',postIds\)/);
  assert.match(community,/supabase\.from\('community_reactions'\)[\s\S]*?\.in\('message_id',postIds\)/);
  assert.match(community,/: \[\{data:\[\],error:null\},\{data:\[\],error:null\}\]/);
  assert.match(community,/if\(postsResult\.error\)throw postsResult\.error/);
  assert.match(community,/if\(commentsResult\.error\)throw commentsResult\.error/);
  assert.match(community,/if\(reactionsResult\.error\)throw reactionsResult\.error/);
});

test('Community prevents stale results and keeps avatar images through filtering',()=>{
  assert.match(community,/let feedRequestVersion = 0/);
  assert.match(community,/const requestVersion=\+\+feedRequestVersion/);
  assert.match(community,/if\(requestVersion!==feedRequestVersion\)return/g);
  assert.match(community,/currentAvatarMap=avatarMap/);
  assert.match(community,/function renderFeed\(avatarMap=currentAvatarMap\)/);
});

test('Dynamic feed values are HTML-escaped and reaction types whitelisted',()=>{
  assert.match(community,/data-id="\$\{esc\(post\.id\)\}"/);
  assert.match(community,/src="\$\{esc\(avatar\)\}"/);
  assert.match(community,/src="\$\{esc\(commentAvatar\)\}"/);
  assert.match(community,/Object\.prototype\.hasOwnProperty\.call\(reactionCounts,item\.reaction\)/);
  assert.match(community,/esc\(post\.title\)/);
  // The rendered body passes through linkify, which HTML-escapes plain text
  // and only creates safe HTTP(S) links. Preserve that stronger invariant.
  assert.match(community,/\$\{linkify\(post\.body\)\}/);
  assert.match(community,/if \(!\/\^https\?:\\/\\/i\.test\(part\)\) return esc\(part\)/);
  assert.match(community,/\['http:','https:'\]\.includes\(url\.protocol\)/);
  assert.match(community,/esc\(url\.href\)/);
  assert.match(community,/esc\(candidate\)/);
});

test('Article Concept 8 is an isolated, unindexed staged editorial page',()=>{
  assert.match(article,/<title>Building a Career in Insurance:/);
  assert.match(article,/name="robots" content="noindex,nofollow"/);
  assert.match(article,/href="https:\/\/dominionstarld\.com\/knowledge\/articles\/build-a-career-on-trust\/"/);
  assert.match(article,/property="og:type" content="article"/);
  assert.match(article,/"@type":"Article"/);
  assert.match(article,/assets\/css\/dominionstar-editorial-concept8\.css/);
  assert.doesNotMatch(sitemap,/build-a-career-on-trust/);
  assert.doesNotMatch(siteIndex,/build-a-career-on-trust/);
  assert.match(articleStyle,/\.ds8-article-shell/);
  assert.match(articleStyle,/@media\(max-width:550px\)/);
});

test('Article anchors and approved internal calls to action are present',()=>{
  const ids = [...article.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  const set = new Set(ids);
  assert.equal(ids.length,set.size,'No duplicate DOM IDs');
  for(const anchor of ['license','keep-learning','connect','serve','habits','next']){
    assert.ok(set.has(anchor), 'missing article section '+anchor);
    assert.ok(article.includes('href="#'+anchor+'"'), 'missing TOC anchor '+anchor);
  }
  for(const link of ['/schedule/','/join/','/opportunity/','/mentorship/','/knowledge/']){
    assert.ok(article.includes('href="'+link+'"'), 'missing internal link '+link);
  }
  assert.doesNotMatch(article,/guaranteed (income|earnings|business results)/i);
  assert.match(article,/not legal, tax, investment, product, or individualized financial advice/);
  assert.match(article,/Licensing, appointments, carrier requirements, and permitted activities vary by jurisdiction/);
});

test('Article has an accessible structure and no fake published date',()=>{
  assert.match(article,/<main id="mainArticle">/);
  assert.match(article,/class="ds8-skip"/);
  assert.match(article,/<article class="ds8-article"/);
  assert.match(article,/aria-label="On this page"/);
  assert.match(article,/aria-current="page"/);
  assert.doesNotMatch(article,/"datePublished"\s*:/);
  assert.doesNotMatch(article,/"dateModified"\s*:/);
});
