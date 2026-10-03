import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const pkg=JSON.parse(read('package.json'));
const participants=read('ui/zoom-participants-reference-2.0.41.js');
const videoHtml=read('ui/mac-share-video.html');
const videoCss=read('ui/mac-share-video.css');
const videoJs=read('ui/mac-share-video.js');
const presenter=read('src/mac-share-presenter-overlay.mjs');

assert(pkg.version==='2.0.51','package version is not 2.0.51');

assert(participants.includes('placeholder="Search participants"'),'participant search placeholder is not explicit');
assert(participants.includes('ds-participant-search-clear'),'participant search lacks a dedicated clear control');
assert(participants.includes("row.dataset.participantRole||'participant'"),'participant search does not index role');
assert(participants.includes("row.dataset.participantSelf==='1'?'me you self':''"),'participant search does not index self aliases');
assert(!participants.includes("searchWrap.hidden=rows.length<7"),'participant search is still hidden for smaller meetings');
assert(!participants.includes("search.hidden=rows.length<7"),'participant search input is still hidden for smaller meetings');
assert(participants.includes("if(searchWrap)searchWrap.hidden=false"),'participant search is not permanently visible');
assert(participants.includes("if(search)search.hidden=false"),'participant search input is not permanently visible');
assert(participants.includes("empty.textContent='No participants found'"),'participant search lacks the empty-result state');
assert(participants.includes('flex-direction:row!important'),'Mac traffic lights are not locked horizontally');
assert(participants.includes('.ds-traffic-close{order:1!important')&&participants.includes('.ds-traffic-minimize{order:2!important')&&participants.includes('.ds-traffic-restore{order:3!important'),'Mac traffic lights are not locked red-yellow-green');

assert(videoHtml.includes('id="videoScrollUp"')&&videoHtml.includes('id="videoScrollDown"'),'video strip lacks top/bottom navigation');
assert(videoCss.includes('overflow-y:hidden'),'video strip still exposes scrolling before overflow');
assert(videoCss.includes('.video-stack.has-overflow{overflow-y:auto'),'video strip does not activate internal scrolling on overflow');
assert(videoCss.includes('.video-stack::-webkit-scrollbar{display:none!important'),'native video scrollbar is still visible');
assert(videoJs.includes("videoLayout==='strip'&&participants.length>5"),'video strip scrolling does not wait until participant six');
assert(videoJs.includes("stack.classList.toggle('has-overflow',active)"),'video strip overflow state is not explicit');
assert(videoJs.includes("stack.scrollBy({top:direction*step,behavior:'smooth'})"),'video strip arrows do not navigate by participant tile');
assert(videoJs.includes("q('#videoScrollUp')?.addEventListener")&&videoJs.includes("q('#videoScrollDown')?.addEventListener"),'video strip arrows are not wired');
assert(videoJs.includes('data-video-primary')&&videoJs.includes('data-video-more'),'video tiles lack direct action plus ellipsis');
assert(presenter.includes('Math.max(1,Math.min(5,Array.isArray(shareState.participants)?shareState.participants.length:1))'),'native share video height is not capped to five visible participants');

console.log('PASS intelligent panels 2.0.51');
