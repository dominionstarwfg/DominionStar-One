// Real production page markup, CSS and renderer; isolated fake client, no backend.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),origin='https://agent-layout.invalid';
const browser=await chromium.launch({headless:true});
const long=Array.from({length:12},(_,i)=>'Paragraph '+(i+1)+': Read the complete update, preserve line breaks, and review the team training material.').join('\n\n')+'\n\nEND OF COMPLETE POST';
const seed=[
  {id:'short',body:'A short real-renderer test update.',author_full_name:'Layout Test Member',author_rank:'SMD'},
  {id:'long',body:long,author_full_name:'Layout Test Member',author_rank:'SMD'},
  {id:'link',body:'Join our meeting at https://zoom.us/j/1234567890.\nThank you for your support.',author_full_name:'Layout Test Member',author_rank:'Associate'}
];
await mkdir('artifacts/live-feed-layout',{recursive:true});
try{
  for(const surface of ['feed','member-dashboard'])for(const width of [1536,1180,1024,768,390]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin)return route.abort();
        let relative=url.pathname.replace(/^\/+/,'');
        if(relative.endsWith('/'))relative+='index.html';
        const file=path.resolve(root,relative);
        if(!file.startsWith(root+path.sep))return route.abort();
        try{
          let body=await readFile(file);
          const mime=file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.jpeg')?'image/jpeg':file.endsWith('.png')?'image/png':'application/octet-stream';
          if(file.endsWith('.html'))body=Buffer.from(body.toString().replace(/<script\b(?=[^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi,''));
          await route.fulfill({status:200,contentType:mime,body});
        }catch{return route.fulfill({status:404,body:''});}
      });
      await page.goto(origin+'/'+surface+'/');
      if(surface==='feed'){
        await page.evaluate(()=>{document.getElementById('feedGate').classList.add('member-hidden');document.getElementById('feedApp').classList.remove('member-hidden');});
        await page.addScriptTag({url:origin+'/assets/js/dominionstar-agent-nav-shell.js'});
      }
      await page.addScriptTag({url:origin+'/assets/js/dashboard-social.js'});
      const target=surface==='feed'?'feedPageStream':'dashboardSocialPreview';
      await page.evaluate(async ({seed,target})=>{
        const client={
          rpc:async(name)=>{if(name!=='list_community_feed')throw Error('Unexpected RPC '+name);return {data:seed,error:null};},
          from:name=>({select:()=>({in:()=>name==='community_comments'?{eq:async()=>({data:[],error:null})}:Promise.resolve({data:[],error:null})})})
        };
        await window.DSDashboardSocial.mount({client,memberId:'layout-test-member',target:document.getElementById(target),resultLimit:8});
      },{seed,target});
      const m=await page.evaluate(target=>{
        const stream=document.getElementById(target),r=n=>n.getBoundingClientRect();
        const cards=[...stream.querySelectorAll('.ds30-social-post')];
        return {width:r(stream).width,scroll:document.documentElement.scrollWidth,
          cards:cards.map(n=>{const p=n.querySelector('.ds30-post-copy');return {
            height:r(n).height,top:r(n).top,bottom:r(n).bottom,copy:p.textContent,
            font:parseFloat(getComputedStyle(p).fontSize),whiteSpace:getComputedStyle(p).whiteSpace,
            scroll:p.scrollWidth,copyWidth:r(p).width,copyBottom:r(p).bottom,maxHeight:getComputedStyle(p).maxHeight,
            actions:[...n.querySelectorAll('.ds30-post-actions button')].map(b=>r(b).height)
          };}),links:stream.querySelectorAll('a[href^="https://zoom.us/"]').length,fixture:stream.querySelectorAll('.ds-review-post').length};
      },target);
      console.log('LIVE_RENDERER_METRICS',surface,width,JSON.stringify({short:m.cards[0]?.height,long:m.cards[1]?.height,width:m.width,scroll:m.scroll}));
      assert.equal(m.cards.length,3);assert.equal(m.fixture,0);assert.equal(m.cards[1].copy,long);assert.equal(m.links,1);
      assert.ok(m.width<=801&&m.width>250,surface+' width '+width+': '+m.width);
      assert.ok(m.scroll<=width+3,surface+' horizontal overflow '+width+': '+m.scroll);
      assert.ok(m.cards[1].height>m.cards[0].height*1.5,'long post failed to expand');
      assert.ok(m.cards[0].height<300,'short post oversized '+m.cards[0].height);
      for(const [i,c] of m.cards.entries()){
        assert.ok(c.font>=15&&c.whiteSpace==='pre-wrap'&&c.maxHeight==='none');
        assert.ok(c.copyBottom<c.bottom&&c.scroll<=c.copyWidth+3,'clipped text');
        assert.ok(c.actions.every(h=>h>=38&&h<=60),'oversized controls '+JSON.stringify(c.actions));
        if(i)assert.ok(c.top-m.cards[i-1].bottom>=12&&c.top-m.cards[i-1].bottom<=20,'inconsistent post spacing');
      }
      if(surface==='member-dashboard'){
        assert.equal(await page.locator('.dsx-overview-drawer').evaluate(n=>n.open),false);
        await page.locator('.dsx-overview-drawer summary').click();
        assert.equal(await page.locator('.dsx-overview-drawer').evaluate(n=>n.open),true);
        await page.locator('.dsx-overview-drawer summary').click();
      }
      if(width===1536||width===390)await page.screenshot({path:'artifacts/live-feed-layout/'+surface+'-'+width+'.png',fullPage:true});
      console.log('LIVE_RENDERER_LAYOUT_PASS',surface,width);
    }finally{await page.close();}
  }
}finally{await browser.close();}
