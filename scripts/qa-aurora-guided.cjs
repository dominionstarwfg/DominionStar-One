#!/usr/bin/env node
// DominionStar public chatbot regression tests. No API keys, browser, or network required.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const full=fs.readFileSync(path.join(__dirname,'../assets/js/dominionstar-public-v5.js'),'utf8');
const start=full.indexOf('const createAnswer='),end=full.indexOf('\nconst launcher=',start);
assert.ok(start>=0&&end>start,'Locate guided answer engine in public script');
const createAnswer=new Function(full.slice(start,end)+'\nreturn createAnswer;')();
const cases=[
 ['Tell me about a trust','','/financial-services/probate-estate/','living-trust','/financial-services/living-trust/'],
 ['What is a trust?','','/','living-trust','/financial-services/living-trust/'],
 ['Explain a trust','','/','living-trust','/financial-services/living-trust/'],
 ['How does a revocable living trust work?','','/','living-trust','/financial-services/living-trust/'],
 ['Can a trust help avoid probate?','','/','living-trust','/financial-services/living-trust/'],
 ['Tell me about InheritGuard','','/','living-trust','/financial-services/living-trust/'],
 ['What is trust funding?','','/','living-trust','/financial-services/living-trust/'],
 ['Tell me about a trust','','/','living-trust','/financial-services/living-trust/'],
 ['What are living benefits?','','/','living-benefits','/financial-services/living-benefits/'],
 ['Explain accelerated death benefits','','/','living-benefits','/financial-services/living-benefits/'],
 ['Can I trust DominionStar?','','/','unmatched','/financial-services/discovery/'],
 ['Tell me about Prince estate','','/','probate-stories','/financial-services/probate-estate/'],
 ['What can you tell mew?','','/','overview','/financial-services/discovery/'],
 ['What can you tell me?','','/financial-services/annuities/','overview-annuity','/financial-services/annuities/#annuity-calculator'],
 ['Who might need life insurance?','','/','life-why','/financial-services/discovery/'],
 ['Tell me more','living-trust','/','living-trust-more','/financial-services/living-trust/']
];
let passed=0;
for(const [question,previous,page,topic,url] of cases){
 const answer=createAnswer(question,previous,page);
 try{assert.equal(answer.topic,topic);assert.equal(answer.url,url);assert.ok(answer.message.length>40);}
 catch(e){console.error('FAIL',JSON.stringify({question,previous,page,expected:topic,got:answer.topic,url:answer.url}));throw e;}
 passed++;
}
assert.ok(full.includes("name:'Probate & Legacy'"),'Recognize probate page context');
assert.ok(full.includes('Aurora <em>12.2</em>'),'Correct Aurora version');
assert.ok(full.includes('const links=new Set();'),'Deduplicate action links');
assert.ok(full.includes('minimumMs=3400'),'Truthful response pacing');
console.log('AURORA_GUIDED_QA_OK '+passed+' cases');
