/* Real Chromium visual verification of the Founder Email review panel.
 * Preview-only. No Supabase, real member accounts, emails or production writes.
 * Run after scripts/build-public-netlify.sh with ephemeral Playwright Chromium.
 */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const root=path.resolve('public-dist');
const output=path.resolve('artifacts','founder-email-health');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const local=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  let rel=decodeURIComponent(url.pathname);
  if(rel.endsWith('/'))rel+='index.html';
  const resolved=path.resolve(root,'.'+rel);
  if(!resolved.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{
    const bytes=await readFile(resolved);
    res.writeHead(200,{'content-type':types[path.extname(resolved)]||'application/octet-stream',
      'cache-control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('not found');}
});
const fakeCase=id=>({
  case_id:'90000000-0000-4000-8000-00000000000'+id,
  status:id===1?'processing':id===2?'failed':'pending',
  reason:id===1?'processing_stalled':id===2?'manual_review':'pending_overdue',
  attempts:id===1?2:5,age_minutes:id===1?18:145,queue_age_minutes:220,
  has_provider_acknowledgement:id===2,
  // Unknown private fields are deliberately placed into the fake response:
  recipient_email:'SECRET_PERSON@example.invalid',
  body:'SECRET_EMAIL_BODY',provider_message_id:'SECRET_PROVIDER_ID'
});
const fakeReport={
  status:'review_only',as_of:'2026-11-08T20:00:00Z',
  totals:{processing_stalled:2,failed:1,pending_overdue:3},
  cases:[fakeCase(1),fakeCase(2),fakeCase(3)],
  truncated:false
};
await mkdir(output,{recursive:true});
await new Promise(resolve=>local.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  for(const width of [1360,390]){
    const label=width===1360?'desktop':'mobile';
    const page=await browser.newPage({viewport:{width,height:850},
      deviceScaleFactor:1});
    let mode='ok',calls=[];
    try{
      await page.addInitScript(()=>{
        window.DSAuth={
          ready:true,
          init:async()=>({
            auth:{getSession:async()=>({
              data:{session:{access_token:'SYNTHETIC-TEST-TOKEN'}},
              error:null
            })}
          })
        };
      });
      // The review preview is backend-free and authenticated page data is
      // intentionally unavailable. Stub the unrelated Founder management
      // renderer and Auth bootstrap, then exercise the actual page+panel.
      await page.route(/\/assets\/js\/(founder-email\.js|member-auth\.js|supabase-config\.js)(?:\?.*)?$/,
        route=>route.fulfill({status:200,contentType:'text/javascript',body:'// synthetic browser fixture'}));
      await page.route('**/.netlify/functions/email-outbox-health',route=>{
        calls.push({
          method:route.request().method(),
          auth:route.request().headers()['authorization']
        });
        const status=mode==='ok'?200:mode==='denied'?403:404;
        return route.fulfill({status,contentType:'application/json',
          body:JSON.stringify(status===200?fakeReport:{error:'Not available'})});
      });
      await page.goto('http://127.0.0.1:'+local.address().port+'/founder-email/',{
        waitUntil:'networkidle'
      });
      await page.addStyleTag({content:
        '#emailHealthPanel button{pointer-events:auto!important;}'
      });
      await page.evaluate(()=>{
        document.querySelector('#emailAdminApp')?.classList.remove('member-hidden');
        document.querySelector('#emailAdminGate')?.classList.add('member-hidden');
      });
      const panel=page.locator('#emailHealthPanel');
      assert.equal(await panel.count(),1,'Real Founder Email review panel missing');
      const button=panel.locator('#emailHealthRefresh');
      await button.click();
      await panel.locator('#emailHealthProcessing').getByText('2').waitFor();
      assert.equal(await panel.locator('.ds-email-health-case').count(),3);
      const raw=await panel.innerText();
      for(const secret of ['SECRET_PERSON@example.invalid','SECRET_EMAIL_BODY','SECRET_PROVIDER_ID']){
        assert.ok(!raw.includes(secret),'Sensitive data displayed in Founder health panel');
      }
      assert.match(raw,/Manual verification needed/);
      assert.equal(calls.length,1);
      assert.equal(calls[0].method,'GET');
      assert.equal(calls[0].auth,'Bearer SYNTHETIC-TEST-TOKEN');
      const metrics=await panel.evaluate(element=>{
        const bounds=element.getBoundingClientRect();
        const stats=[...element.querySelectorAll('.ds-email-health-stats>div')];
        const cards=[...element.querySelectorAll('.ds-email-health-case')];
        return {
          viewport:innerWidth,
          bounds:{left:bounds.left,right:bounds.right,width:bounds.width},
          stats:stats.map(e=>({width:e.getBoundingClientRect().width,
            height:e.getBoundingClientRect().height})),
          cards:cards.map(e=>({right:e.getBoundingClientRect().right,
            width:e.getBoundingClientRect().width})),
          overflow:document.documentElement.scrollWidth
        };
      });
      assert.ok(metrics.overflow<=width+3,
        'Horizontal document overflow at '+label+': '+metrics.overflow);
      assert.ok(metrics.stats.every(s=>s.width>=55&&s.height>=55),
        'Counters are too small');
      assert.ok(metrics.cards.every(c=>c.width>150&&c.right<=width+2),
        'Review cases exceed viewport');
      await panel.screenshot({path:path.join(output,'founder-email-'+label+'.png'),
        animations:'disabled'});

      // A previously authorized report is immediately cleared when
      // subsequent server access is denied or feature flag is disabled.
      mode='denied';
      await button.click();
      await panel.getByText('The signed-in account is not authorized for this Founder report.').waitFor();
      assert.equal(await panel.locator('.ds-email-health-case').count(),0);
      assert.equal((await panel.locator('#emailHealthProcessing').innerText()).trim(),'—');
      mode='disabled';
      await button.click();
      await panel.getByText('Email delivery monitoring is not enabled for this release.').waitFor();
      assert.equal(await panel.locator('.ds-email-health-case').count(),0);
      assert.ok(calls.every(c=>c.method==='GET'&&c.auth==='Bearer SYNTHETIC-TEST-TOKEN'));
      process.stdout.write(JSON.stringify({
        label,width,cases:3,renderedPII:false,
        scrollWidth:metrics.overflow,requests:calls.length,readonly:true
      })+'\n');
    }finally{await page.close();}
  }
  process.stdout.write('FOUNDER_EMAIL_HEALTH_BROWSER_PASS — synthetic page, no real provider\n');
}finally{
  await browser.close();
  await new Promise(resolve=>local.close(resolve));
}
