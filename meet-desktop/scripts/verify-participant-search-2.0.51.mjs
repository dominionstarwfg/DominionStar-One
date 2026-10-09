import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const pkg=JSON.parse(read('package.json'));
const ref=read('ui/zoom-participants-reference-2.0.41.js');

assert(['2.0.51','2.0.52'].includes(pkg.version),'package version is outside the certified 2.0.51+ participant-search line');
assert(ref.includes('placeholder="Search participants"'),'Participants search placeholder is missing.');
assert(ref.includes('aria-label="Clear participant search"'),'Participants search clear control is missing.');
assert(ref.includes("if(wrap.hidden)wrap.hidden=false"),'Participants search wrapper is not being kept visible idempotently.');
assert(ref.includes("if(search?.hidden)search.hidden=false"),'Participants search input is not being kept visible idempotently.');
assert(!ref.includes("rows.length<7"),'Participants search still depends on participant count.');
assert(ref.includes("const role=String(row.dataset.participantRole||'')"),'Participants search does not match role metadata.');
assert(ref.includes("const self=row.dataset.participantSelf==='1'?'me you self':''"),'Participants search does not match self aliases.');
assert(ref.includes("empty.textContent='No participants found'"),'Participants search has no empty-state message.');
assert(ref.includes("#participantRoster{flex:1 1 auto!important;min-height:0!important;max-height:331px!important;overflow-x:hidden!important;overflow-y:auto!important"),'Only the roster must own vertical scrolling.');
assert(ref.includes(".ds-ref-participants-footer{position:relative!important"),'Participants footer is not fixed outside roster scrolling.');
assert(ref.includes(".ds-participant-search-wrap{flex:0 0 auto"),'Search row is not fixed above the scrollable roster.');

console.log('PASS participant search 2.0.51 always-visible clearable fixed-header-footer');
