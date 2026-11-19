// Real production page markup, CSS and renderer; isolated fake client, no backend.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),origin='https://agent-layout.invalid';
const browser=await chromium.launch({headless:true});
const long=Array.from({length:12},(_,i)=>'Paragraph '+(i+1)+': Read the complete update, preserve line breaks, and review the team training material.').join('\n\n')+'\n\nEND OF COMPLETE POST';
const seed=[
  {id:'short',body:'A short real-renderer test update.',author_full_name:'Layout Test Member',author_rank:'SMD',author_avatar_path:'test/portrait.jpg',author_exclusive_number:1},
  {id:'long',body:long,author_full_name:'Layout Test Member',author_rank:'SMD'},
  {id:'link',body:'Join our meeting at https://zoom.us/j/1234567890.\nThank you for your support.',author_full_name:'Layout Test Member',author_rank:'Associate'}
];
await mkdir('artifacts/live-feed-layout',{recursive:true});
try{
  for(const surface of ['feed','member-dashboard'])for(const width of [1536,1180,1080,1024,768,390]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin)return route.abort();
        if(url.pathname==='/synthetic-portrait.svg')return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320"><rect width="160" height="320" fill="#315d88"/><circle cx="80" cy="100" r="45" fill="#e8c895"/></svg>'});
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
        const state=window.__layoutTest={liked:false,comments:[],reposts:[],failRefresh:false,copied:''};
        Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
        Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{state.copied=value;}}});
        const client={
          storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:location.origin+'/synthetic-portrait.svg'},error:null})})},
          rpc:async(name,args)=>{
            if(name==='community_toggle_reaction'){state.liked=!state.liked;return {data:state.liked,error:null};}
            if(name!=='list_community_feed')throw Error('Unexpected RPC '+name);
            if(state.failRefresh)return {data:null,error:new Error('Simulated refresh failure')};
            return {data:seed,error:null};
          },
          from:name=>({
            select:()=>({in:()=>name==='community_comments'?{eq:async()=>({data:state.comments.map(c=>({message_id:c.message_id})),error:null})}:Promise.resolve({data:state.liked?[{message_id:'short',user_id:'layout-test-member',reaction:'like'}]:[],error:null})}),
            insert:async value=>{if(name==='community_comments')state.comments.push(value);else if(name==='community_messages')state.reposts.push(value);else throw Error('Unexpected insert '+name);return {error:null};}
          })
        };
        await window.DSDashboardSocial.mount({client,memberId:'layout-test-member',target:document.getElementById(target),resultLimit:8});
      },{seed,target});
      const realCard=page.locator('#'+target+' [data-post-id="short"]');
      await realCard.locator('.ds30-author-photo').evaluate(img=>img.decode());
      const identity=await realCard.evaluate(card=>{
        const avatar=card.querySelector('.ds30-author-avatar'),photo=card.querySelector('.ds30-author-photo');
        const rank=card.querySelector('.ds30-post-rank'),menu=card.querySelector('.ds30-more-button');
        const r=n=>n.getBoundingClientRect();
        return {avatar:[r(avatar).width,r(avatar).height],photo:[r(photo).width,r(photo).height],
          natural:[photo.naturalWidth,photo.naturalHeight],fit:getComputedStyle(photo).objectFit,
          rankBg:getComputedStyle(rank).backgroundColor,rankColor:getComputedStyle(rank).color,
          menu:[r(menu).width,r(menu).height],menuBg:getComputedStyle(menu).backgroundColor,
          icons:[...card.querySelectorAll('.ds30-post-actions svg')].map(n=>[r(n).width,r(n).height]),
          copyBg:getComputedStyle(card.querySelector('.ds30-post-copy')).backgroundColor,
          badge:card.querySelector('.ds30-post-founding')?.textContent};
      });
      assert.deepEqual(identity.avatar,[42,42]);assert.ok(identity.photo.every(n=>n>=36&&n<=42));
      assert.deepEqual(identity.natural,[160,320]);assert.equal(identity.fit,'cover');
      assert.equal(identity.rankBg,'rgba(0, 0, 0, 0)');assert.equal(identity.rankColor,'rgb(193, 208, 225)');
      assert.deepEqual(identity.menu,[34,34]);assert.equal(identity.menuBg,'rgb(22, 49, 78)');
      assert.ok(identity.icons.every(pair=>pair.every(n=>n===18)));
      assert.equal(identity.copyBg,'rgba(0, 0, 0, 0)');
      assert.match(identity.badge,/Founding Member #1/);
      console.log('REAL_PROFILE_GEOMETRY_PASS',surface,width,JSON.stringify(identity));
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
      // Exercise the existing authenticated-renderer event handlers.
      if(width===1536||width===390){
        const card=page.locator('#'+target+' [data-post-id="short"]');
        const like=card.locator('[data-social="like"]');
        await like.click();
        await page.waitForFunction(target=>document.querySelector('#'+target+' [data-post-id="short"] [data-social="like"]')?.getAttribute('aria-pressed')==='true',target);
        await like.click();
        await page.waitForFunction(target=>document.querySelector('#'+target+' [data-post-id="short"] [data-social="like"]')?.getAttribute('aria-pressed')==='false',target);
        await card.locator('[data-social="comment"]').click();
        await card.locator('textarea').fill('A real-handler comment test');
        await card.locator('.ds30-comment-form button[type="submit"]').click();
        await page.waitForFunction(()=>window.__layoutTest.comments.length===1);
        await page.waitForFunction(()=>document.querySelector('.ds30-social-status')?.textContent==='Comment posted.');
        await card.locator('[data-social="share"]').click();
        await page.waitForFunction(()=>window.__layoutTest.copied.includes('/community/?post=short'));
        await page.waitForFunction(()=>document.querySelector('.ds30-social-status')?.textContent==='Post link copied.');
        page.once('dialog',dialog=>dialog.accept());
        await card.locator('[data-social="repost"]').click();
        await page.waitForFunction(()=>window.__layoutTest.reposts.length===1);
        await page.waitForFunction(()=>document.querySelector('.ds30-social-status')?.textContent==='Reposted to the community.');
        await card.locator('[data-social="comment"]').click();
        await card.locator('textarea').fill('Saved even while refresh fails');
        await page.evaluate(()=>window.__layoutTest.failRefresh=true);
        await card.locator('.ds30-comment-form button[type="submit"]').click();
        await page.waitForFunction(()=>document.querySelector('.ds30-social-status')?.textContent.includes('Comment posted. Refresh'));
        assert.equal(await page.evaluate(()=>window.__layoutTest.comments.length),2);
        assert.equal(await card.locator('textarea').inputValue(),'');
        await page.evaluate(()=>window.__layoutTest.failRefresh=false);
        await page.evaluate(async target=>{await document.getElementById(target).__ds30Controller.refresh();},target);
        console.log('LIVE_RENDERER_INTERACTIONS_PASS',surface,width);
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
