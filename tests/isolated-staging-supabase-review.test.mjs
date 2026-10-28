import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stageReviewPackage} from '../scripts/prepare-isolated-staging.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=file=>readFileSync(path.join(root,file),'utf8');
const stagingRef='abcdefghijabcdefghij'; // Synthetic project ID, never an actual staging account.
const fakeKey='sb_publishable_NOT_A_REAL_STAGING_KEY_FOR_QA_2026';
function fixture(){
 const dir=mkdtempSync(path.join(tmpdir(),'ds-isolated-staging-'));
 for(const folder of ['assets/js','meet'])mkdirSync(path.join(dir,folder),{recursive:true});
 writeFileSync(path.join(dir,'assets/js/supabase-config.js'),source('assets/js/supabase-config.js'));
 writeFileSync(path.join(dir,'meet/browser-bridge.js'),source('meet-desktop/ui/browser-bridge.js'));
 writeFileSync(path.join(dir,'_headers'),'/meet/*\n  Cache-Control: no-store\n');
 writeFileSync(path.join(dir,'index.html'),'<html><title>DominionStar</title></html>');
 return dir;
}
const opts={
 DOMINIONSTAR_STAGING_NETLIFY_SITE_ID:'test-isolated-netlify-site',
 DOMINIONSTAR_PRODUCTION_NETLIFY_SITE_ID:'production-netlify-site',
 DOMINIONSTAR_STAGING_SITE_URL:'https://dominionstar-stage-test.netlify.app',
 DOMINIONSTAR_STAGING_SUPABASE_URL:'https://'+stagingRef+'.supabase.co',
 DOMINIONSTAR_STAGING_SUPABASE_PUBLISHABLE_KEY:fakeKey,
 DOMINIONSTAR_STAGING_ISOLATION_APPROVED:'STAGING_ONLY',
 NETLIFY_SITE_ID:'test-isolated-netlify-site'
};
async function withFixture(fn){
 const dir=fixture();
 try{return await fn(dir)}finally{rmSync(dir,{recursive:true,force:true})}
}
test('Staging rewrite changes both browser integrations and blocks indexing',()=>withFixture(dir=>{
 const result=stageReviewPackage({env:opts,dist:dir,rehearsal:false});
 assert.equal(result.isolated,true);
 const agent=readFileSync(path.join(dir,'assets/js/supabase-config.js'),'utf8');
 const meet=readFileSync(path.join(dir,'meet/browser-bridge.js'),'utf8');
 assert.match(agent,new RegExp(stagingRef));
 assert.match(meet,new RegExp(stagingRef));
 assert.doesNotMatch(agent,/ckmurvhjumzlhsegncba/);
 assert.doesNotMatch(meet,/ckmurvhjumzlhsegncba/);
 assert.match(readFileSync(path.join(dir,'robots.txt'),'utf8'),/Disallow: \//);
 assert.match(readFileSync(path.join(dir,'_headers'),'utf8'),/X-Robots-Tag: noindex, nofollow, noarchive/);
}));
test('Staging cannot reuse the production Supabase project',()=>withFixture(dir=>{
 assert.throws(()=>stageReviewPackage({dist:dir,env:{...opts,DOMINIONSTAR_STAGING_SUPABASE_URL:'https://ckmurvhjumzlhsegncba.supabase.co'}}),/production Supabase project/);
}));
test('Staging cannot deploy through production Netlify identity',()=>withFixture(dir=>{
 assert.throws(()=>stageReviewPackage({dist:dir,env:{...opts,NETLIFY_SITE_ID:'production-netlify-site'}}),/Current Netlify site ID/);
 assert.throws(()=>stageReviewPackage({dist:dir,env:{...opts,DOMINIONSTAR_PRODUCTION_NETLIFY_SITE_ID:'test-isolated-netlify-site'}}),/distinct production and staging/);
}));
test('Missing staging credentials and permission flag are rejected',()=>withFixture(dir=>{
 assert.throws(()=>stageReviewPackage({dist:dir,env:{...opts,DOMINIONSTAR_STAGING_SUPABASE_PUBLISHABLE_KEY:''}}),/publishable Supabase key/);
 assert.throws(()=>stageReviewPackage({dist:dir,env:{...opts,DOMINIONSTAR_STAGING_ISOLATION_APPROVED:''}}),/staging-only build approval/);
}));
test('Extra production backend reference prevents any partial rewrite',()=>withFixture(dir=>{
 writeFileSync(path.join(dir,'index.html'),'https://ckmurvhjumzlhsegncba.supabase.co');
 assert.throws(()=>stageReviewPackage({dist:dir,env:opts}),/Production Supabase project reference remains/);
 assert.match(readFileSync(path.join(dir,'assets/js/supabase-config.js'),'utf8'),/ckmurvhjumzlhsegncba/);
}));
test('Staging must use an HTTPS Netlify preview hostname',()=>withFixture(dir=>{
 assert.throws(()=>stageReviewPackage({dist:dir,env:{...opts,DOMINIONSTAR_STAGING_SITE_URL:'https://dominionstarld.com'}}),/production-domain site/);
 assert.throws(()=>stageReviewPackage({dist:dir,env:{...opts,DOMINIONSTAR_STAGING_SITE_URL:'http://dominionstar-stage-test.netlify.app'}}),/must use HTTPS/);
}));
