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
const postBody='Long-form training: every detail matters.\\n'+
  ('Recruit → study → exam → licensing → compliance → product training. '.repeat(38))+
  '\\nEND-OF-POST: this paragraph must remain visible.';
const longUrl='https://example.org/resources/'+('verylongprofessionalarticle'.repeat(20));
const records=[
  {id:'short',title:'Quick recognition',body:'Congratulations on your progress.',
   author_full_name:'Agent One',author_rank:'Associate',post_type:'discussion',
   created_at:'2026-11-04T18:00:00Z'},
  {id:'long',title:'Complete training announcement',body:postBody,
   author_full_name:'Agent Two',author_rank:'Marketing Director',post_type:'announcement',
   created_at:'2026-11-04T18:05:00Z'},
  {id:'link',title:'Useful licensing resource',
   body:'Please review this link before the next session:\\n'+longUrl,
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
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      await page.waitForTimeout(100);
      const y=await page.evaluate(()=>window.scrollY);
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
  process.stdout.write('FEED_BROWSER_GEOMETRY_PASS — synthetic posts only; backend disabled\n');
}finally{
  await browser.close();
  await new Promise(resolve=>local.close(resolve));
}
