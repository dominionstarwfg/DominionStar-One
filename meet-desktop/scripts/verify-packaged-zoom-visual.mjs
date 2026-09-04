import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-zoom-visual.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=9650+Math.floor(Math.random()*200);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const runtimeErrors=[];
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before visual gate.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});
      if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}
    }catch{}
    await sleep(180);
  }
  throw new Error('Unable to attach to packaged renderer for Zoom visual gate.');
}

function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Visual gate WebSocket timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Visual gate WebSocket failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},1800);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(180);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(message.method==='Runtime.exceptionThrown'){
      const details=message.params?.exceptionDetails;runtimeErrors.push(details?.exception?.description||details?.text||'Uncaught renderer exception');return;
    }
    if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);
  });
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionZoomProductionPolish&&window.DominionZoomAdaptiveParity&&window.DominionApprovedReferenceParity&&window.DominionRuntimeStability&&window.DominionShareIntegration&&document.querySelector('#meetingOverlay')",'final meeting visual controllers');
  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionMeetingParity.decorateControls();const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionZoomProductionPolish.sync();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();return true;})()`);
  await waitFor("['roomMic','roomCamera','roomShare','roomParticipants','roomChat','roomReactions','roomMore','roomExitButton'].every(id=>document.querySelector('#'+id))",'complete packaged meeting controls');
  assert.equal(await evaluate(`(()=>{window.DominionRuntimeStability.ensureToolbarZones();const footer=document.querySelector('.meeting-footer');return footer?.dataset.dsRuntimeToolbarZones||'';})()`),'1','Final runtime did not commit the stable three-zone toolbar before visual measurement.');
  await evaluate(`window.DominionMeetingParity.decorateControls();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();true`);
  await waitFor("document.querySelector('#roomHostTools')&&!document.querySelector('#roomHostTools').hidden",'host tools control');
  await sleep(120);

  const toolbar=await evaluate(`(()=>{const footer=document.querySelector('.meeting-footer'),fr=footer.getBoundingClientRect();const info=id=>{const b=document.querySelector('#'+id);if(!b)return {missing:true,left:0,right:0,width:0,height:0,icon:0,label:0,color:''};const r=b.getBoundingClientRect(),icon=b.querySelector('.ds-control-icon'),label=b.querySelector('.ds-control-label');return {missing:false,left:r.left,right:r.right,width:r.width,height:r.height,icon:icon?parseFloat(getComputedStyle(icon).width):0,label:label?parseFloat(getComputedStyle(label).fontSize):0,color:label?getComputedStyle(label).color:''};};const zones=[...footer.querySelectorAll(':scope > .ds-runtime-toolbar-zone')].map(node=>node.className);return {footer:{left:fr.left,right:fr.right,height:fr.height},zones,mic:info('roomMic'),camera:info('roomCamera'),share:info('roomShare'),participants:info('roomParticipants'),chat:info('roomChat'),reactions:info('roomReactions'),more:info('roomMore'),end:info('roomExitButton'),host:info('roomHostTools')};})()`);
  for(const key of ['mic','camera','share','participants','chat','reactions','more','end','host'])assert.equal(toolbar[key].missing,false,`${key} control was not mounted before visual measurement.`);
  assert.equal(toolbar.zones.length,3,'Meeting toolbar must retain independent left, center, and right runtime zones.');
  assert.ok(toolbar.footer.height>=55&&toolbar.footer.height<=57,`Meeting toolbar must remain at the approved 2.0.41 Zoom-reference height; received ${toolbar.footer.height}px.`);
  for(const key of ['mic','camera','share','participants','chat','reactions','more']){assert.ok(toolbar[key].icon>=20.5,`${key} icon is below the approved 2.0.41 reference size.`);assert.ok(toolbar[key].label>=9.5,`${key} label is below the approved 2.0.41 reference size.`);}
  assert.ok(toolbar.mic.left-toolbar.footer.left<=24,'Audio must anchor the left toolbar zone.');
  assert.ok(toolbar.camera.left-toolbar.mic.right<=45,'Video must remain grouped with Audio.');
  assert.ok(toolbar.share.left-toolbar.camera.right>=60,'Primary meeting actions need Zoom-like separation from Audio/Video.');
  assert.ok(toolbar.footer.right-toolbar.end.right<=24,'End must anchor the far-right toolbar zone.');
  assert.match(toolbar.share.color,/rgb\((53, 198, 106|46, 204, 113|35, 198, 106)\)/,'Share Screen must use green primary-action emphasis.');
  assert.ok(toolbar.host.label>=9.5,'Host Tools must retain the approved compact Zoom-reference label size.');

  await evaluate(`document.querySelector('#roomParticipants').click();true`);await sleep(190);
  const participants=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('.room-side'),pr=panel.getBoundingClientRect(),br=document.querySelector('.meeting-body').getBoundingClientRect(),sr=document.querySelector('.stage').getBoundingClientRect(),searchWrap=panel.querySelector('.zoom-participant-search'),search=searchWrap?.querySelector('input'),head=panel.querySelector('.room-side-head strong'),footer=panel.querySelector('.zoom-participant-footer'),count=panel.querySelectorAll('#participantRoster [data-participant-id]').length;return {count,width:Math.round(pr.width),height:Math.round(pr.height),position:getComputedStyle(panel).position,mode:panel.dataset.dsRuntimeMode||'',inside:pr.left>=br.left+10&&pr.right<=br.right-10&&pr.top>=br.top+10&&pr.bottom<=br.bottom-10,centerDelta:Math.round(Math.abs((pr.left+pr.width/2)-(br.left+br.width/2))),searchVisible:Boolean(searchWrap&&!searchWrap.hidden&&getComputedStyle(searchWrap).display!=='none'),searchFont:search?parseFloat(getComputedStyle(search).fontSize):0,searchHeight:search?search.getBoundingClientRect().height:0,headFont:head?parseFloat(getComputedStyle(head).fontSize):0,footerVisible:Boolean(footer&&!footer.hidden),legacyVisible:Boolean(document.querySelector('#participantBulkActions')&&!document.querySelector('#participantBulkActions').hidden),stageRightGap:Math.round(br.right-sr.right)};})()`);
  assert.equal(participants.position,'absolute','Participants must remain a floating desktop application surface.');
  assert.equal(participants.mode,'floating','Normal desktop-width Participants must use the floating Zoom-style window.');
  assert.equal(participants.inside,true,'Participants must remain inside the current meeting body.');
  assert.ok(participants.centerDelta<=48,'Participants must open near the meeting center before the user moves it.');
  assert.ok(participants.width>=300&&participants.width<=420,'Desktop Participants width must stay readable and bounded.');
  assert.ok(Math.abs(participants.stageRightGap)<=2,'Opening Participants must not shrink the full-width live stage.');
  assert.ok(participants.headFont>=11.5,'Participants heading is below the approved 2.0.41 compact reference size.');
  assert.equal(participants.footerVisible,true,'Zoom-style Participants Invite / Mute All / More footer is missing.');
  assert.equal(participants.legacyVisible,false,'Legacy bulk-control strip must not be visible.');
  assert.equal(participants.searchVisible,participants.count>=7,'Participant Search visibility must follow the useful-count threshold.');
  if(participants.searchVisible)assert.ok(participants.searchFont>=9.5&&participants.searchHeight>=28,'Participant search is below the approved compact reference size.');
  await evaluate(`document.querySelector('#roomParticipants').click()`);

  await evaluate(`document.querySelector('#roomChat').click();true`);await sleep(190);
  const chat=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('#meetingChatPanel'),r=panel.getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect(),stage=document.querySelector('.stage').getBoundingClientRect(),head=panel.querySelector('header strong'),input=document.querySelector('#meetingChatInput'),policy=document.querySelector('#meetingChatPolicy'),more=panel.querySelector('.zoom-chat-more');return {inside:r.left>=body.left+10&&r.right<=body.right-10&&r.top>=body.top+10&&r.bottom<=body.bottom-10,width:Math.round(r.width),mode:panel.dataset.dsRuntimeMode||'',centerDelta:Math.round(Math.abs((r.left+r.width/2)-(body.left+body.width/2))),stageRightGap:Math.round(body.right-stage.right),headFont:head?parseFloat(getComputedStyle(head).fontSize):0,inputFont:input?parseFloat(getComputedStyle(input).fontSize):0,policyVisible:Boolean(policy&&getComputedStyle(policy).display!=='none'),moreVisible:Boolean(more&&getComputedStyle(more).display!=='none')};})()`);
  assert.ok(chat.width>=300&&chat.width<=420,'Chat width must remain compact and readable instead of becoming an oversized form panel.');
  assert.equal(chat.inside,true,'Chat must remain inside the meeting surface.');
  assert.equal(chat.mode,'floating','Normal desktop-width Chat must use the same floating application window model.');
  assert.ok(chat.centerDelta<=48,'Chat must open near the meeting center before the user moves it.');
  assert.ok(Math.abs(chat.stageRightGap)<=2,'Floating Chat must not shrink the full-width live stage.');
  assert.ok(chat.headFont>=11.5&&chat.inputFont>=9.5,'Chat typography is below the approved compact 2.0.41 reference size.');
  assert.equal(chat.policyVisible,false,'Chat policy must not permanently occupy the panel header.');
  assert.equal(chat.moreVisible,true,'Host chat options must be behind the More control.');
  await evaluate(`document.querySelector('#roomChat').click()`);

  await evaluate(`document.querySelector('#roomReactions').click()`);
  await sleep(80);
  const reaction=await evaluate(`(()=>{const menus=[...document.querySelectorAll('.ds-reaction-tray,.meeting-reaction-menu')],menu=menus[0],r=menu?.getBoundingClientRect?.()||{left:0,bottom:innerHeight},button=menu?.querySelector('button:not(.reaction-hand-button):not(.ds-raise-hand)'),br=button?.getBoundingClientRect?.(),cs=button?getComputedStyle(button):null,mcs=menu?getComputedStyle(menu):null;const ancestors=[];for(let node=button?.parentElement;node&&ancestors.length<6;node=node.parentElement){const s=getComputedStyle(node);ancestors.push({tag:node.tagName,class:node.className||'',display:s.display,visibility:s.visibility,opacity:s.opacity});}return {menuCount:menus.length,menuClass:menu?.className||'',menuConnected:Boolean(menu?.isConnected),menuDisplay:mcs?.display||'',menuVisibility:mcs?.visibility||'',menuOpacity:mcs?.opacity||'',menuWidth:r?.width||0,menuHeight:r?.height||0,buttonClass:button?.className||'',buttonConnected:Boolean(button?.isConnected),buttonDisplay:cs?.display||'',buttonVisibility:cs?.visibility||'',buttonOpacity:cs?.opacity||'',hasOffsetParent:Boolean(button?.offsetParent),left:Math.round(r.left||0),bottom:Math.round(innerHeight-(r.bottom||innerHeight)),buttonWidth:br?.width||0,buttonHeight:br?.height||0,font:cs?parseFloat(cs.fontSize):0,computedWidth:cs?.width||'',computedMinWidth:cs?.minWidth||'',computedTransform:cs?.transform||'',inlineStyle:button?.getAttribute('style')||'',ancestors};})()`);
  console.log('REACTION_VISUAL_DIAGNOSTIC',JSON.stringify(reaction));
  assert.ok(reaction.left<=30,'Reactions tray must anchor on the left side.');
  assert.ok(reaction.buttonWidth>=46&&reaction.font>=24,`Reaction controls are undersized. ${JSON.stringify(reaction)}`);
  await evaluate(`document.querySelector('.ds-reaction-tray,.meeting-reaction-menu')?.remove()`);

  await evaluate(`document.querySelector('#roomMore').click();true`);
  // The final transient-menu bridge uses a MutationObserver. Mutation delivery
  // happens at the microtask checkpoint before paint, so inspect the paint-ready
  // menu state rather than the same synchronous click stack.
  await sleep(0);
  const more=await evaluate(`(()=>{const menu=document.querySelector('.meeting-more-menu,.ds-command-menu'),buttons=[...menu.querySelectorAll('button')];return {font:buttons.length?Math.min(...buttons.map(b=>parseFloat(getComputedStyle(b).fontSize)||99)):0,hasSettings:buttons.some(b=>String(b.textContent||'').trim()==='Settings'),hasHostDuplicate:buttons.some(b=>String(b.textContent||'').trim()==='Host tools')};})()`);
  assert.ok(more.font>=8.5,'More menu text is below the approved 2.0.41 compact reference size.');
  assert.equal(more.hasSettings,true,'Settings must remain in More.');
  assert.equal(more.hasHostDuplicate,false,'Host Tools must not be duplicated in More when it has a primary toolbar control.');
  await sleep(120);
  assert.deepEqual(runtimeErrors,[],'Packaged meeting emitted uncaught renderer exceptions:\n'+runtimeErrors.join('\n'));
  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer wrote an uncaught JavaScript error to stderr.');

  console.log('DOMINIONSTAR_PACKAGED_ZOOM_VISUAL_OK stable-three-zone-toolbar reference-footer-56 icons-21 labels-10 audio-left video-left actions-centered end-right share-green host-tools participants-floating compact-reference-text reactions-left more-reference-text no-uncaught-renderer-errors');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('visual gate shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);