/* Browser click-through QA for actual DominionStar Feed controls.
 * Everything is synthetic; no production project, account or database call.
 * Prerequisites: review-only public-dist and ephemeral Playwright Chromium.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('public-dist');
const social=readFileSync('assets/js/dashboard-social.js','utf8');
const out=path.resolve('artifacts/feed-geometry');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const route=decodeURIComponent(url.pathname);
  const rel=route.endsWith('/')?route+'index.html':route;
  const absolute=path.resolve(root,'.'+rel);
  if(!absolute.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{
    const bytes=await readFile(absolute);
    res.writeHead(200,{'Content-Type':types[path.extname(absolute)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  await mkdir(out,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const page=await browser.newPage({viewport:{width:1320,height:900},
    bypassCSP:true});
  page.on('dialog',dialog=>dialog.accept());
  try{
    await page.goto('http://127.0.0.1:'+port+'/feed/',{waitUntil:'networkidle'});
    // The public preview deliberately sets pointer-events:none on all inputs.
    // Restore actions ONLY in this isolated Chromium harness; the distributed
    // preview stays backend-free and permanently noninteractive.
    await page.addStyleTag({content:
      '#feedPageStream button,#feedPageStream textarea,#feedPageStream form'+
      '{pointer-events:auto!important}'});
    await page.addScriptTag({content:social});
    await page.evaluate(async()=>{
      const post={id:'post-1234',user_id:'author-123',
        title:'Training update',body:'Short but complete training note',
        author_full_name:'Approved Example Agent',author_rank:'Senior Associate',
        post_type:'discussion',created_at:'2026-11-05T16:00:00Z'};
      const state={posts:[post],reactions:[],comments:[],writes:[],
        clipboard:null,failNextReaction:false};
      window.__socialTest=state;
      Object.defineProperty(navigator,'clipboard',{configurable:true,
        value:{writeText:async text=>{state.clipboard=text;}}});
      const memberId='synthetic-member-A';
      const builder=table=>{
        const query={
          _table:table,_ids:[],_filters:[],
          select(){return this;},
          in(name,ids){this._ids=ids;return this;},
          eq(name,value){this._filters.push([name,value]);return this;},
          then(resolve,reject){
            let data=[];
            if(this._table==='community_reactions'){
              data=state.reactions.filter(r=>this._ids.includes(r.message_id));
            }else if(this._table==='community_comments'){
              data=state.comments.filter(c=>this._ids.includes(c.message_id));
            }
            return Promise.resolve({data,error:null}).then(resolve,reject);
          },
          async insert(payload){
            state.writes.push({table,payload});
            if(table==='community_comments'){
              state.comments.push({message_id:payload.message_id,
                user_id:payload.user_id,body:payload.body,is_deleted:false});
            }else if(table==='community_messages'){
              state.posts.unshift({...payload,id:'repost-1',
                author_full_name:'Synthetic Member A',
                author_rank:'Associate',
                created_at:'2026-11-05T17:00:00Z'});
            }else{
              return {error:new Error('Unexpected table write: '+table)};
            }
            return {error:null};
          }
        };
        return query;
      };
      const client={
        storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:null},error:null})})},
        from:builder,
        async rpc(name,args){
          if(name==='list_community_feed')return {data:state.posts,error:null};
          if(name==='community_toggle_reaction'){
            if(state.failNextReaction){
              state.failNextReaction=false;
              return {data:null,error:{message:'Simulated network/backend rejection'}};
            }
            const type=args.target_reaction;
            if(!['like','love','celebrate','support','insightful'].includes(type))
              return {data:null,error:{message:'Invalid reaction'}};
            state.reactions=state.reactions.filter(r=>!(
              r.message_id===args.target_message_id&&r.user_id===memberId
            )).concat(
              state.reactions.some(r=>r.message_id===args.target_message_id&&
                r.user_id===memberId&&r.reaction===type)?[]:[{
                  message_id:args.target_message_id,user_id:memberId,reaction:type
                }]
            );
            const count=state.reactions.filter(r=>r.message_id===args.target_message_id&&
              r.reaction===type).length;
            state.writes.push({rpc:name,reaction:type});
            return {data:count,error:null};
          }
          return {data:null,error:{message:'Unexpected RPC: '+name}};
        }
      };
      await window.DSDashboardSocial.mount({client,memberId,
        target:document.getElementById('feedPageStream')});
    });

    const first=page.locator('#feedPageStream article.ds30-social-post[data-post-id="post-1234"]');
    const react=first.locator('button[data-social="react"]');
    assert.equal(await first.count(),1,'Original synthetic post renders');
    assert.equal((await react.innerText()).trim(),'Like');
    async function pick(type){
      await react.click();
      const option=first.locator('button[data-social="reaction"][data-reaction="'+type+'"]');
      await option.click();
    }
    await pick('love');
    await page.waitForFunction(()=>window.__socialTest.reactions.some(r=>r.reaction==='love'));
    await page.waitForFunction(()=>document.querySelector(
      'article[data-post-id="post-1234"] button[data-social="react"]').innerText.includes('Love'));
    assert.equal(await page.evaluate(()=>window.__socialTest.reactions.length),1);
    assert.equal((await react.innerText()).trim(),'Love');

    await pick('celebrate');
    await page.waitForFunction(()=>window.__socialTest.reactions.some(r=>r.reaction==='celebrate'));
    assert.equal(await page.evaluate(()=>window.__socialTest.reactions.length),1,
      'Switching reaction replaces rather than adds');
    assert.equal((await react.innerText()).trim(),'Celebrate');

    await pick('celebrate');
    await page.waitForFunction(()=>window.__socialTest.reactions.length===0);
    assert.equal((await react.innerText()).trim(),'Like',
      'Selecting the same reaction again clears it');

    await page.evaluate(()=>{window.__socialTest.failNextReaction=true;});
    await pick('support');
    await page.locator('.ds30-social-status.ds30-social-error').waitFor();
    assert.equal(await page.evaluate(()=>window.__socialTest.reactions.length),0,
      'Failed RPC must not invent a reaction');
    assert.equal((await react.innerText()).trim(),'Like');

    await first.locator('button[data-social="comment"]').click();
    await first.locator('.ds30-comment-form textarea').fill('A useful reply from a synthetic approved agent');
    await first.locator('.ds30-comment-form button[type="submit"]').click();
    await page.waitForFunction(()=>window.__socialTest.comments.length===1);
    assert.match(await first.locator('.ds30-post-engagement').innerText(),/1 comment/);

    await first.locator('button[data-social="share"]').click();
    await page.waitForFunction(()=>Boolean(window.__socialTest.clipboard));
    assert.match(await page.evaluate(()=>window.__socialTest.clipboard),
      /\/community\/\?post=post-1234$/);
    assert.equal(await page.evaluate(()=>window.__socialTest.posts.length),1,
      'Sharing copies a link, it does not repost');

    await first.locator('button[data-social="repost"]').click();
    await page.waitForFunction(()=>window.__socialTest.posts.length===2);
    const repost=page.locator('#feedPageStream article[data-post-id="repost-1"]');
    await repost.waitFor();
    assert.match(await repost.innerText(),/Reposted from Approved Example Agent/);
    assert.equal(await page.evaluate(()=>window.__socialTest.writes.filter(x=>
      x.table==='community_messages').length),1);
    assert.equal(await page.evaluate(()=>window.__socialTest.writes.filter(x=>
      x.table==='community_comments').length),1);
    await page.screenshot({path:path.join(out,'social-interactions.png'),
      fullPage:true,animations:'disabled'});
    process.stdout.write('SOCIAL_INTERACTIONS_BROWSER_PASS '+
      'Love → Celebrate → clear → rejected Support → comment → share → repost\n');
  }finally{await page.close();}
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
