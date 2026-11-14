/* Browser geometry regression for the real DominionStar visual-review Feed.
 * Zero production data: the preview is locally built with auth/backend disabled.
 * Run: node scripts/review-feed-browser-geometry.mjs
 * Requires: local public-dist review package and ephemeral Playwright Chromium.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=path.resolve(process.cwd(),'public-dist');
const social=readFileSync('assets/js/dashboard-social.js','utf8');
const out=path.resolve(process.cwd(),'artifacts','feed-geometry');
const postBody='Long-form training: every detail matters.\n'+
  ('Recruit → study → exam → licensing → compliance → product training. '.repeat(38))+
  '\nEND-OF-POST: this paragraph must remain visible.';
const longUrl='https://example.org/resources/'+('verylongprofessionalarticle'.repeat(20));
const records=[
  {id:'short',title:'Quick recognition',body:'Congratulations on your progress.',
   author_full_name:'Agent One',author_rank:'Associate',post_type:'discussion',
   created_at:'2026-11-04T18:00:00Z'},
  {id:'long',title:'Complete training announcement',body:postBody,
   author_full_name:'Agent Two',author_rank:'Marketing Director',post_type:'announcement',
   created_at:'2026-11-04T18:05:00Z'},
  {id:'link',title:'Useful licensing resource',
   body:'Please review this link before the next session:\n'+longUrl,
   author_full_name:'Agent Three',author_rank:'Senior Associate',
   post_type:'discussion',created_at:'2026-11-04T18:10:00Z'}
];
function syntheticMarkup(){
  const target={id:'feedPageStream',innerHTML:'',
    insertAdjacentElement(){},setAttribute(){},removeAttribute(){},
    querySelectorAll(){return []},addEventListener(){}};
  const doc={createElement:()=>({setAttribute(){},classList:{toggle(){}},textContent:''}),
    addEventListener(){}};
  const fakeClient={
    rpc:async(name)=>name==='list_community_feed'
      ? {data:records,error:null}:{data:null,error:new Error('Unexpected RPC')},
    from(name){
      if(!['community_reactions','community_comments'].includes(name)){
        throw Error('Unexpected table '+name);
      }
      return {select(){return this},in(){return this},eq(){return this},
        then(resolve,reject){
          return Promise.resolve({data:[],error:null}).then(resolve,reject);
        }
      };
    }
  };
  const scope={window:{},document:doc,navigator:{},URL,
    location:{origin:'http://127.0.0.1'}};
  vm.runInNewContext(social,scope);
  return scope.window.DSDashboardSocial.mount({
    client:fakeClient,memberId:'synthetic-viewer',target
  }).then(()=>target.innerHTML);
}
function server(){
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
    '.js':'text/javascript; charset=utf-8','.jpeg':'image/jpeg','.jpg':'image/jpeg',
    '.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
  return createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    let rel=decodeURIComponent(url.pathname);
    if(rel.endsWith('/'))rel+='index.html';
    const resolved=path.resolve(root,'.'+rel);
    if(!resolved.startsWith(root+path.sep)){
      res.writeHead(403);res.end('Forbidden');return;
    }
    try{
      const data=await readFile(resolved);
      res.writeHead(200,{'Content-Type':types[path.extname(resolved)]||'application/octet-stream',
        'Cache-Control':'no-store'});
      res.end(data);
    }catch{
      res.writeHead(404);res.end('Not found');
    }
  });
}
const supportedSizes=[
  {width:1536,height:900,label:'desktop'},
  {width:1180,height:850,label:'tablet-edge'},
  {width:1024,height:850,label:'tablet'},
  {width:768,height:850,label:'small-tablet'},
  {width:390,height:844,label:'mobile'}
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const local=server();
try{
  await mkdir(out,{recursive:true});
  const markup=await syntheticMarkup();
  assert.ok(markup.includes('END-OF-POST:'),'Synthetic long post must be fully rendered');
  await new Promise(resolve=>local.listen(0,'127.0.0.1',resolve));
  const port=local.address().port;
  for(const v of supportedSizes){
    const page=await browser.newPage({viewport:{width:v.width,height:v.height},
      deviceScaleFactor:1});
    try{
      const missing=[];
      page.on('response',response=>{
        if(response.status()>=400 && new URL(response.url()).hostname==='127.0.0.1')
          missing.push(response.status()+' '+new URL(response.url()).pathname);
      });
      await page.goto('http://127.0.0.1:'+port+'/feed/',{waitUntil:'networkidle'});

      if(v.label==='desktop'||v.label==='mobile'){
        // Real Feed composer markup + inert review script. This must work even
        // with CSP connect-src none and all publishing/auth scripts removed.
        const composer=page.locator('#feedComposerBody');
        const previewToggle=page.locator('#feedComposerPreviewToggle');
        const preview=page.locator('#feedComposerPreview');
        await composer.fill([
          'Our next Wednesday meeting:','','Join https://zoom.us/j/7443001370',
          'Meeting ID: 744 300 1370','','#SavingYourFuture #DominionStar'
        ].join(String.fromCharCode(10)));
        await previewToggle.click();
        await preview.waitFor({state:'visible'});
        assert.equal(await previewToggle.getAttribute('aria-expanded'),'true',
          v.label+' Preview post toggle did not open');
        const p=await page.evaluate(()=>{
          const text=document.getElementById('feedComposerPreviewText');
          const card=document.getElementById('feedComposerPreview');
          const rect=text.getBoundingClientRect();
          return {
            kind:card.dataset.postKind,
            display:getComputedStyle(text).display,
            whiteSpace:getComputedStyle(text).whiteSpace,
            text:text.innerText,
            href:text.querySelector('a[href^="https://zoom.us/"]')?.href,
            tags:[...text.querySelectorAll('a.ds30-hashtag')].map(a=>a.textContent),
            width:rect.width,scrollWidth:text.scrollWidth,
            scrollWidthPage:document.documentElement.scrollWidth,
            count:document.getElementById('feedComposerCharacterCount')?.textContent,
            publisherEnabled:!document.getElementById('feedComposerPublish')?.disabled
          };
        });
        assert.equal(p.kind,'meeting',v.label+' Zoom link not recognized');
        assert.equal(p.display,'block',v.label+' preview text must be block-flow');
        assert.equal(p.whiteSpace,'pre-wrap',v.label+' lost original line breaks');
        assert.match(p.text,/Meeting ID: 744 300 1370/);
        assert.equal(p.href,'https://zoom.us/j/7443001370');
        assert.equal(p.tags.length,2);
        assert.ok(p.scrollWidth<=p.width+3,
          v.label+' long preview link exceeds the paragraph width');
        assert.ok(p.scrollWidthPage<=v.width+3,
          v.label+' preview creates horizontal page overflow');
        assert.ok(p.count.includes(' / 2000 characters'),'Character counter not updated');
        await composer.fill('<script>alert(1)</script> #Leadership https://dominionstarld.com');
        const safe=await page.evaluate(()=>{
          const node=document.getElementById('feedComposerPreviewText');
          return {scriptCount:node.querySelectorAll('script').length,
            rawText:node.innerText,linkCount:node.querySelectorAll('a').length,
            html:node.innerHTML};
        });
        assert.equal(safe.scriptCount,0,'User markup must never be executable');
        assert.ok(safe.rawText.includes('<script>alert(1)</script>'), 'Markup must be displayed as plain text');
        assert.equal(safe.linkCount,2,'Ordinary URL and hashtag must be clickable');
        assert.match(safe.html,/&lt;script&gt;/,'User markup must be escaped');
        await previewToggle.click();
        assert.equal(await preview.isVisible(),false,
          v.label+' post preview should be collapsible');
        process.stdout.write('FEED_COMPOSER_PREVIEW_BROWSER_PASS '+v.label+
          ' — local text, Zoom link, hashtag and XSS checks; backend off\\n');
      }

      if(v.label==='desktop'){
        // Exercise only the isolated preview controls, never real Supabase actions.
        const like=page.locator('#feedPageStream .ds-review-zoom-post [data-preview-action="like"]');
        await like.waitFor();
        await like.click();
        assert.equal(await like.getAttribute('aria-pressed'),'true',
          'Sample Like should visibly toggle locally');
        const comment=page.locator('#feedPageStream .ds-review-zoom-post [data-preview-action="comment"]');
        await comment.click();
        const input=page.locator('#feedPageStream .ds-review-zoom-post .ds-review-preview-comments input');
        await input.fill('Preview-only comment test');
        await page.locator('#feedPageStream .ds-review-zoom-post .ds-review-preview-comments button').click();
        const localText=await page.locator('#feedPageStream .ds-review-zoom-post .ds-review-local-comment').innerText();
        assert.match(localText,/Preview-only comment test/);
        assert.match(await page.locator('#feedPageStream .ds-review-zoom-post .ds-review-preview-feedback').innerText(),
          /Nothing was published/i);
        process.stdout.write('SAMPLE_SOCIAL_CONTROLS_BROWSER_PASS — local only, no persistence\\n');
      }
      await page.evaluate(html=>{
        const feed=document.getElementById('feedPageStream');
        if(!feed)throw Error('Real Feed stage missing');
        feed.innerHTML=html;
      },markup);
      await page.locator('#feedPageStream .ds30-social-post').first().waitFor();
      const m=await page.evaluate(()=>{
        const feed=document.getElementById('feedPageStream');
        const cards=[...feed.querySelectorAll('.ds30-social-post')];
        const rect=el=>{const r=el.getBoundingClientRect();return {
          left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        const arr=cards.map(card=>{
          const actions=card.querySelector('.ds30-post-actions');
          const buttons=[...actions.querySelectorAll(':scope > button,:scope > .ds30-react-wrap > button')];
          const icons=buttons.map(b=>b.querySelector('.ds30-action-icon'));
          const content=card.querySelector('.ds30-post-copy');
          return {
            id:card.dataset.postId,card:rect(card),content:rect(content),
            text:content.innerText,whiteSpace:getComputedStyle(content).whiteSpace,
            actions:rect(actions),actionDisplay:getComputedStyle(actions).display,
            buttons:buttons.map(b=>rect(b)),
            icons:icons.map(el=>el?rect(el):null),
            avatar:rect(card.querySelector('.ds30-author-avatar')),
            textColor:getComputedStyle(content).color,
            textBackground:getComputedStyle(content).backgroundColor
          };
        });
        return {
          viewport:innerWidth,bodyWidth:document.documentElement.scrollWidth,
          scrollHeight:document.documentElement.scrollHeight,
          pageHeight:innerHeight,
          cards:arr,stage:rect(feed),
          columns:getComputedStyle(document.querySelector('.dsx-feed-workspace')).gridTemplateColumns,
          main:rect(document.querySelector('.dsx-feed-main'))
        };
      });
      assert.equal(m.cards.length,3,'Three genuine social cards must render');
      assert.ok(m.bodyWidth<=v.width+3,
        v.label+' horizontally overflows viewport: '+m.bodyWidth+' > '+v.width);
      assert.ok(m.scrollHeight>m.pageHeight+100,
        v.label+' needs document vertical scrolling');
      assert.ok(m.cards[1].card.height>m.cards[0].card.height*1.5,
        v.label+' long post must be taller than short post');
      assert.ok(m.cards[1].text.includes('END-OF-POST:'),
        v.label+' long post final paragraph must be visible');
      assert.ok(m.cards[2].text.includes('verylongprofessionalarticle'),
        v.label+' long URL must not be cut off');
      for(const c of m.cards){
        assert.ok(c.card.height>80&&c.card.height<5000,
          v.label+' post card has invalid natural height: '+c.card.height);
        assert.ok(c.content.bottom<c.actions.top+1,
          v.label+' post content overlaps engagement/actions');
        assert.ok(c.card.bottom>=c.actions.bottom-1,
          v.label+' action row extends beyond post card');
        assert.ok(c.card.left>=m.stage.left-3 && c.card.right<=m.stage.right+3,
          v.label+' post exceeds feed stage');
        assert.equal(c.actionDisplay,'grid',v.label+' controls must use actual grid layout');
        assert.equal(c.buttons.length,4,v.label+' missing social action');
        for(const b of c.buttons){
          assert.ok(b.height>=34&&b.height<=65,
            v.label+' oversized or undersized social action: '+b.height);
          assert.ok(b.width<Math.max(160,c.card.width*.30),
            v.label+' action stretches across card');
        }
        for(const icon of c.icons){
          assert.ok(icon&&icon.width>=15&&icon.width<=21 &&icon.height>=15&&icon.height<=21,
            v.label+' icon too large or too small: '+JSON.stringify(icon));
        }
        assert.ok(c.avatar.width>=37&&c.avatar.width<=46,
          v.label+' avatar size incorrect: '+c.avatar.width);
        assert.equal(c.whiteSpace,'pre-wrap',v.label+' must retain original line breaks');
      }
      // Scroll is on the document: there must be no fixed-height feed viewport.
      await page.evaluate(()=>window.scrollTo({
        top:document.documentElement.scrollHeight,behavior:'instant'
      }));
      await page.waitForTimeout(80);
      const scroll=await page.evaluate(()=>({
        y:window.scrollY,htmlY:document.documentElement.scrollTop,
        bodyY:document.body.scrollTop,
        htmlOverflow:getComputedStyle(document.documentElement).overflowY,
        bodyOverflow:getComputedStyle(document.body).overflowY
      }));
      process.stdout.write('SCROLL_DIAGNOSTIC '+v.label+' '+JSON.stringify(scroll)+'\\n');
      const y=scroll.y;
      assert.ok(y>100,v.label+' document did not scroll');
      assert.equal(missing.length,0,v.label+' missing preview assets: '+missing.join(', '));
      if(v.label==='desktop'||v.label==='mobile'){
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:path.join(out,'feed-'+v.label+'.png'),fullPage:true,
          animations:'disabled'});
      }
      process.stdout.write(JSON.stringify({
        viewport:v.label,width:v.width,cards:m.cards.map(c=>({id:c.id,
          cardHeight:Math.round(c.card.height),iconWidth:Math.round(c.icons[0].width)})),
        documentScrollable:y>100,scrollWidth:m.bodyWidth,grid:m.columns
      })+'\n');
    }finally{await page.close();}
  }

  // Social-first Dashboard: the actual backend-free preview must bring the
  // composer and network updates into the first viewport, not four KPI cards.
  for (const view of [
    {label:'desktop',width:1536,height:900},
    {label:'tablet',width:768,height:850},
    {label:'mobile',width:390,height:844}
  ]) {
    const page=await browser.newPage({viewport:{width:view.width,height:view.height},
      deviceScaleFactor:1});
    try {
      const missing=[];
      page.on('response',response=>{
        if(response.status()>=400 && new URL(response.url()).hostname==='127.0.0.1')
          missing.push(response.status()+' '+new URL(response.url()).pathname);
      });
      await page.goto('http://127.0.0.1:'+port+'/member-dashboard/',
        {waitUntil:'networkidle'});
      await page.locator('#dashboardSocialPreview .ds-review-post').first().waitFor();
      const before=await page.evaluate(()=>{
        const box=sel=>{
          const r=document.querySelector(sel).getBoundingClientRect();
          return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};
        };
        const overview=document.querySelector('.dsx-overview-drawer');
        const stages=['.dsos-topbar','.dsos-page','.dsx-hero','.dsx-overview-drawer',
          '.dsx-dashboard-grid','.dsx-dashboard-tabs','.dsx-dashboard-composer',
          '.dsx-dashboard-feed-head'].map(selector=>{
          const el=document.querySelector(selector);
          const r=el?.getBoundingClientRect();
          return {selector,top:r?.top,bottom:r?.bottom,height:r?.height};
        });
        return {
          closed:!overview.open,
          stages,
          firstPost:box('#dashboardSocialPreview .ds-review-post'),
          composer:box('.dsx-dashboard-composer'),
          insights:box('.dsx-overview-drawer'),
          stage:box('.dsx-dashboard-social'),
          scrollWidth:document.documentElement.scrollWidth,
          viewport:window.innerWidth,
          postCount:document.querySelectorAll('#dashboardSocialPreview .ds-review-post').length
        };
      });
      process.stdout.write('DASHBOARD_FOLD_DIAGNOSTIC '+view.label+' '+JSON.stringify(before.stages)+'\\n');
      assert.equal(before.closed,true,view.label+' metrics should default closed');
      assert.ok(before.postCount>=2,view.label+' representative feed missing');
      assert.ok(before.composer.top<view.height,
        view.label+' composer must be in the initial viewport');
      assert.ok(before.firstPost.top<view.height+80,
        view.label+' first network update should not be buried below KPI cards (top='+Math.round(before.firstPost.top)+', viewport='+view.height+')');
      assert.ok(before.scrollWidth<=view.width+3,
        view.label+' Dashboard horizontal overflow: '+before.scrollWidth);
      assert.ok(before.stage.right<=view.width+3,
        view.label+' network feed extends beyond viewport');
      assert.ok(before.insights.bottom<before.composer.top+2,
        view.label+' insights toggle should precede the composer');
      // Content decides each post's vertical size. No uniform-height cards,
      // and each content category must have a readable, differentiated surface.
      const postGeometry=await page.evaluate(()=>{
        const kind=klass=>{
          const card=document.querySelector('#dashboardSocialPreview .'+klass);
          const r=card.getBoundingClientRect();
          const body=card.querySelector('.ds-review-post-body,.ds-review-message-bubble,.ds-review-photo-layout');
          const b=body?.getBoundingClientRect();
          return {height:r.height,background:getComputedStyle(card).backgroundImage,
            bottom:r.bottom,bodyBottom:b?.bottom||r.top};
        };
        const photo=document.querySelector('#dashboardSocialPreview .ds-review-photo-layout img');
        return {short:kind('ds-review-text-post'),long:kind('ds-review-long-post'),
          zoom:kind('ds-review-zoom-post'),quote:kind('ds-review-quote-post'),
          photo:kind('ds-review-photo-post'),
          photoFit:getComputedStyle(photo).objectFit,
          photoLoaded:photo.complete&&photo.naturalWidth>0,
          zoomHref:document.querySelector('#dashboardSocialPreview .ds-review-zoom-post .ds-review-post-body a[href^="https://zoom.us/"]')?.href
        };
      });
      const textFlow=await page.evaluate(()=>{
        const audit=(cardClass)=>{
          const p=document.querySelector('#dashboardSocialPreview .'+cardClass+' .ds-review-post-body');
          const style=getComputedStyle(p);
          const anchor=p.querySelector('a');
          const linkStyle=anchor?getComputedStyle(anchor):null;
          const bounds=p.getBoundingClientRect();
          return {display:style.display,whiteSpace:style.whiteSpace,
            width:bounds.width,scrollWidth:p.scrollWidth,
            linkDisplay:linkStyle?.display||null,
            linkInside:!anchor||(anchor.getBoundingClientRect().left<=bounds.right+1),
            plainText:p.innerText,
            tagCount:p.querySelectorAll('a.ds-review-tag').length};
        };
        return {short:audit('ds-review-text-post'),long:audit('ds-review-long-post'),
          zoom:audit('ds-review-zoom-post')};
      });
      for(const [postKind,flow] of Object.entries(textFlow)){
        assert.equal(flow.display,'block',
          view.label+' '+postKind+' post paragraph is being rendered as flex/grid columns');
        assert.equal(flow.whiteSpace,'pre-wrap',
          view.label+' '+postKind+' post lost natural paragraph breaks');
        assert.ok(flow.width>120,view.label+' '+postKind+' paragraph was squeezed');
        assert.ok(flow.scrollWidth<=flow.width+3,
          view.label+' '+postKind+' paragraph has horizontal overflow');
        assert.equal(flow.linkDisplay,'inline',
          view.label+' '+postKind+' link/hashtag must flow in text, not a flex column');
        assert.ok(flow.linkInside,
          view.label+' '+postKind+' link escaped its content bounds');
      }
      assert.match(textFlow.zoom.plainText,/Meeting ID: 744 300 1370/);
      assert.match(textFlow.zoom.plainText,/Passcode: 360/);
      assert.match(textFlow.long.plainText,/Everyone moves at a different pace/);
      assert.ok(textFlow.long.tagCount>=3,'long post should expose all hashtags');
      process.stdout.write('FEED_TEXT_FLOW_PASS '+view.label+' '+
        JSON.stringify(Object.fromEntries(Object.entries(textFlow).map(
          ([kind,flow])=>[kind,{display:flow.display,linkDisplay:flow.linkDisplay,
            width:Math.round(flow.width),tags:flow.tagCount}])))+'\\n');
      assert.ok(postGeometry.long.height>postGeometry.short.height*1.6,
        view.label+' longer text should produce a substantially taller post');
      assert.ok(postGeometry.zoom.height>postGeometry.short.height,
        view.label+' Zoom message should have natural room for complete details');
      assert.ok(postGeometry.long.bodyBottom<=postGeometry.long.bottom+1,
        view.label+' long text runs outside its post card');
      assert.ok(new Set([postGeometry.short.background,postGeometry.zoom.background,
        postGeometry.photo.background,postGeometry.quote.background]).size>=3,
        view.label+' different post types should not all share the same surface');
      assert.equal(postGeometry.photoFit,'contain',
        view.label+' photo must preserve original proportions');
      assert.equal(postGeometry.photoLoaded,true,view.label+' sample photograph did not load');
      assert.match(postGeometry.zoomHref||'',/^https:\/\/zoom\.us\/j\//,
        view.label+' Zoom link should be a visible clickable URL');
      process.stdout.write('ORGANIC_POST_GEOMETRY '+view.label+' '+JSON.stringify({
        short:Math.round(postGeometry.short.height),long:Math.round(postGeometry.long.height),
        zoom:Math.round(postGeometry.zoom.height),photoLoaded:postGeometry.photoLoaded
      })+'\\n');
      await page.locator('.dsx-overview-drawer>summary').click();
      const expanded=await page.evaluate(()=>{
        const details=document.querySelector('.dsx-overview-drawer');
        return {
          open:details.open,
          cards:[...details.querySelectorAll('.dsx-stat')].filter(el=>
            getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0).length,
          scrollWidth:document.documentElement.scrollWidth
        };
      });
      assert.equal(expanded.open,true,view.label+' insights disclosure did not open');
      assert.equal(expanded.cards,4,view.label+' KPI cards unavailable on expand');
      assert.ok(expanded.scrollWidth<=view.width+3,
        view.label+' expanded KPIs overflow horizontally');
      await page.locator('.dsx-overview-drawer>summary').click();
      assert.equal(await page.locator('.dsx-overview-drawer').evaluate(el=>el.open),false,
        view.label+' insights disclosure did not close');
      if(view.label==='desktop'||view.label==='mobile'){
        await page.screenshot({path:path.join(out,'dashboard-social-first-'+view.label+'.png'),
          fullPage:true,animations:'disabled'});
      }
      assert.equal(missing.length,0,
        view.label+' missing dashboard preview assets: '+missing.join(', '));
      process.stdout.write('SOCIAL_FIRST_DASHBOARD '+JSON.stringify({
        view:view.label,composerTop:Math.round(before.composer.top),
        firstPostTop:Math.round(before.firstPost.top),
        initialViewport:view.height,metricsInitiallyHidden:before.closed,
        kpiCardsOnExpand:expanded.cards
      })+'\\n');
    } finally { await page.close(); }
  }
  process.stdout.write('SOCIAL_FIRST_DASHBOARD_BROWSER_PASS — visual sample only; backend disabled\\n');

  // Private Team Groups: creation, chat, invitations and responsive geometry
  // must work in-memory while Supabase/auth scripts are absent.
  for(const view of [{label:'desktop',width:1536,height:900},
                     {label:'mobile',width:390,height:844}]){
    const page=await browser.newPage({viewport:{width:view.width,height:view.height},
      deviceScaleFactor:1});
    const blocked=[];
    page.on('response',response=>{
      if(response.status()>=400&&new URL(response.url()).hostname==='127.0.0.1')
        blocked.push(response.status()+' '+new URL(response.url()).pathname);
    });
    try{
      await page.goto('http://127.0.0.1:'+port+'/team-groups/',{waitUntil:'networkidle'});
      await page.locator('#teamGroupsApp').waitFor({state:'visible'});
      assert.match(await page.locator('#dsgModeNotice').innerText(),
        /INTERACTIVE VISUAL PREVIEW/);
      assert.equal(await page.locator('#dsgGroupList .dsg-group-item').count(),3,
        view.label+' initial groups plus pending invitation missing');
      const initial=await page.locator('#dsgActiveName').innerText();
      assert.equal(initial,'DominionStar Leadership');
      assert.equal(await page.locator('#dsgUnreadTotal').innerText(),'2');
      assert.equal(await page.locator('#dsgSimulateButton').isVisible(),true);
      await page.locator('#dsgSimulateButton').click();
      assert.equal(await page.locator('#dsgUnreadTotal').innerText(),'3');
      assert.match(await page.locator('#dsgIncomingNotice').innerText(),
        /New Agent Training/);
      await page.locator('#dsgSoundToggle').click();
      assert.equal(await page.locator('#dsgSoundToggle').getAttribute('aria-pressed'),'true');
      await page.locator('#dsgGroupList .dsg-group-item')
        .filter({hasText:'New Agent Training'}).click();
      assert.equal(await page.locator('#dsgUnreadTotal').isVisible(),false);
      assert.match(await page.locator('#dsgMessages').innerText(),
        /Wednesday coaching starts at 8 PM CT/);
      await page.locator('#dsgGroupList .dsg-group-item')
        .filter({hasText:'DominionStar Leadership'}).click();
      assert.match(await page.locator('#dsgMessages').innerText(),
        /Saving Your Future session/);
      const zoom=page.locator('#dsgMessages a[href^="https://zoom.us/"]');
      assert.equal(await zoom.count(),1,'Zoom link should be clickable in group chat');
      await page.locator('#dsgGroupList .dsg-group-item')
        .filter({hasText:'Regional Growth Circle'}).click();
      assert.equal(await page.locator('#dsgMessageInput').isDisabled(),true);
      assert.match(await page.locator('#dsgMessages').innerText(),/invited to this private group/);
      assert.ok(!(await page.locator('#dsgMessages').innerText()).includes('Welcome to our regional mentorship'));
      // The same synthetic invitation can be accepted or declined depending
      // on viewport, verifying that it never exposes messages before joining.
      if(view.label==='desktop'){
        await page.locator('#dsgMessages button').filter({hasText:'Accept invitation'}).click();
        assert.equal(await page.locator('#dsgMessageInput').isEnabled(),true);
        assert.match(await page.locator('#dsgMessages').innerText(),/regional mentorship circle/);
      }else{
        page.once('dialog',dialog=>dialog.accept());
        await page.locator('#dsgMessages button').filter({hasText:'Decline invitation'}).click();
        assert.equal(await page.locator('#dsgGroupList .dsg-group-item').count(),2);
      }
      await page.locator('#dsgCreateButton').click();
      await page.locator('#dsgCreateDialog').waitFor({state:'visible'});
      await page.locator('#dsgNewName').fill('Texas Growth Team');
      await page.locator('#dsgNewTopic').fill('Licensing, training, and recognition');
      await page.locator('#dsgCreateForm button[type="submit"]').click();
      assert.equal(await page.locator('#dsgActiveName').innerText(),'Texas Growth Team');
      assert.equal(await page.locator('#dsgGroupList .dsg-group-item').count(),
        view.label==='desktop'?4:3);
      await page.locator('#dsgEditButton').click();
      await page.locator('#dsgEditDialog').waitFor({state:'visible'});
      await page.locator('#dsgEditName').fill('Texas Growth Alliance');
      await page.locator('#dsgEditTopic').fill('Updated licensing and coaching plans');
      await page.locator('#dsgEditForm button[type="submit"]').click();
      assert.equal(await page.locator('#dsgActiveName').innerText(),'Texas Growth Alliance');
      assert.match(await page.locator('#dsgActiveTopic').innerText(),/Updated licensing/);
      await page.locator('#dsgMuteButton').click();
      assert.equal(await page.locator('#dsgMuteButton').innerText(),'Unmute');
      await page.locator('#dsgMessageInput').fill('Welcome #team\\nJoin https://zoom.us/j/7443001370');
      await page.locator('#dsgSendButton').click();
      const chat=page.locator('#dsgMessages .dsg-chat-message');
      await chat.first().waitFor();
      assert.equal(await chat.count(),1);
      assert.match(await chat.first().innerText(),/Welcome #team/);
      assert.equal(await chat.first().locator('a[href^="https://zoom.us/"]').count(),1);
      await page.locator('#dsgInviteButton').click();
      await page.locator('#dsgInviteDialog').waitFor({state:'visible'});
      await page.locator('#dsgInviteSearch').fill('Alex');
      const option=page.locator('#dsgInviteChoices .dsg-invite-choice');
      assert.equal(await option.count(),1);
      await option.first().click();
      assert.match(await page.locator('#dsgMemberList').innerText(),
        /Invitation pending/);
      page.once('dialog',dialog=>dialog.accept());
      await page.locator('#dsgMemberList .dsg-member-remove')
        .filter({hasText:'Cancel invitation'}).click();
      assert.doesNotMatch(await page.locator('#dsgMemberList').innerText(),
        /Invitation pending/);
      await page.locator('#dsgInviteButton').click();
      await page.locator('#dsgInviteSearch').fill('Alex');
      await page.locator('#dsgInviteChoices .dsg-invite-choice').click();
      assert.match(await page.locator('#dsgMemberList').innerText(),/Invitation pending/);
      await page.locator('#dsgSearch').fill('Texas');
      assert.equal(await page.locator('#dsgGroupList .dsg-group-item').count(),1);
      const geometry=await page.evaluate(()=>({
        viewport:innerWidth,
        scrollWidth:document.documentElement.scrollWidth,
        appWidth:document.getElementById('teamGroupsApp').getBoundingClientRect().width,
        groupCount:document.querySelectorAll('.dsg-group-item').length,
        messageCount:document.querySelectorAll('.dsg-chat-message').length,
        preview:document.getElementById('dsgModeNotice').innerText
      }));
      assert.ok(geometry.scrollWidth<=view.width+3,
        view.label+' team groups overflow horizontally: '+JSON.stringify(geometry));
      assert.equal(blocked.length,0,
        view.label+' missing Team Groups static assets: '+blocked.join(','));
      await page.screenshot({path:path.join(out,'team-groups-'+view.label+'.png'),
        fullPage:true,animations:'disabled'});
      process.stdout.write('TEAM_GROUPS_VISUAL_BROWSER_PASS '+view.label+' '+
        JSON.stringify({groupCount:geometry.groupCount,chatMessages:geometry.messageCount,
          viewport:geometry.viewport})+'\\n');
    }finally{await page.close();}
  }

  process.stdout.write('FEED_BROWSER_GEOMETRY_PASS — synthetic posts only; backend disabled\n');
}finally{
  await browser.close();
  await new Promise(resolve=>local.close(resolve));
}
