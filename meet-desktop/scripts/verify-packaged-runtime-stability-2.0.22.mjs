import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-runtime-stability-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10920+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before runtime-stability gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(150);}throw new Error('Unable to attach to packaged renderer for runtime-stability gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Runtime-stability CDP connection timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Runtime-stability CDP connection failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},4500);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(80);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionRuntimeStability&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&document.querySelector('#meetingOverlay')",'stable runtime controllers');
  await waitFor("Array.from(document.styleSheets).some(sheet=>String(sheet.href||'').endsWith('/runtime-motion.css'))",'runtime motion stylesheet');

  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row" data-participant-id="self" data-participant-role="host" data-participant-name="QA Host"><span class="person-badge">QH</span><span class="person-copy"><strong>QA Host</strong><small>You</small></span></div>';window.DominionRuntimeStability.sync();return true;})()`);
  await waitFor("document.querySelector('#meetingOverlay').dataset.dsRuntimeStable==='1'&&document.querySelector('#roomParticipants')&&document.querySelector('#roomChat')",'runtime-stable meeting');

  const viewport=await evaluate(`(()=>{window.DominionRuntimeStability.sync();const overlay=document.querySelector('#meetingOverlay').getBoundingClientRect(),shell=document.querySelector('.meeting-shell').getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect();return {innerWidth,innerHeight,overlay:{x:Math.round(overlay.x),y:Math.round(overlay.y),w:Math.round(overlay.width),h:Math.round(overlay.height)},shell:{w:Math.round(shell.width),h:Math.round(shell.height)},body:{w:Math.round(body.width),h:Math.round(body.height)}};})()`);
  assert.ok(Math.abs(viewport.overlay.w-viewport.innerWidth)<=1,`Meeting overlay must fill the Electron viewport width. ${JSON.stringify(viewport)}`);
  assert.ok(Math.abs(viewport.overlay.h-viewport.innerHeight)<=1,`Meeting overlay must fill the Electron viewport height. ${JSON.stringify(viewport)}`);
  assert.equal(viewport.overlay.x,0);assert.equal(viewport.overlay.y,0);
  assert.ok(Math.abs(viewport.shell.w-viewport.innerWidth)<=1,'Meeting shell must expand with the window.');

  await evaluate(`document.querySelector('#roomParticipants').click()`);await sleep(45);
  const participantsImmediate=await evaluate(`(()=>{const side=document.querySelector('.room-side'),chat=document.querySelector('#meetingChatPanel'),stage=document.querySelector('.stage'),body=document.querySelector('.meeting-body');const sr=side.getBoundingClientRect(),st=stage.getBoundingClientRect(),br=body.getBoundingClientRect();return {participantsOpen:!side.hidden,chatClosed:chat.hidden,mode:side.dataset.dsRuntimeMode,centerDelta:Math.round(Math.abs((sr.left+sr.width/2)-(br.left+br.width/2))),inside:sr.left>=br.left+10&&sr.right<=br.right-10&&sr.top>=br.top+10&&sr.bottom<=br.bottom-10,stageRightGap:Math.round(br.right-st.right),panelWidth:Math.round(sr.width),count:side.querySelector('.room-side-head strong')?.textContent||'',animation:getComputedStyle(side).animationName,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,motionSheetLoaded:Array.from(document.styleSheets).some(sheet=>String(sheet.href||'').endsWith('/runtime-motion.css'))};})()`);
  assert.equal(participantsImmediate.participantsOpen,true,'Participants must open immediately on Participants click.');
  assert.equal(participantsImmediate.chatClosed,true,'Opening Participants must keep Chat closed.');
  assert.equal(participantsImmediate.mode,'floating','Participants must open as a floating Zoom-style window at desktop width.');
  assert.equal(participantsImmediate.inside,true,'Floating Participants must remain inside the meeting body.');
  assert.ok(participantsImmediate.centerDelta<=48,'Participants must open near the meeting center before the user moves it.');
  assert.ok(Math.abs(participantsImmediate.stageRightGap)<=2,'Floating Participants must not reserve the right edge or shrink the stage.');
  assert.equal(participantsImmediate.count,'Participants (1)');
  assert.equal(participantsImmediate.motionSheetLoaded,true,'Runtime motion stylesheet must be active in the packaged renderer.');
  if(participantsImmediate.reduceMotion)assert.equal(participantsImmediate.animation,'none','Reduce Motion must suppress the Participants entrance animation.');
  else assert.match(participantsImmediate.animation,/dsRuntimePanelIn/,'Participants must use the short runtime entrance motion.');

  const dragStart=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),head=panel.querySelector('.room-side-head'),r=panel.getBoundingClientRect(),h=head.getBoundingClientRect();return {left:r.left,top:r.top,x:h.left+Math.min(110,h.width*.45),y:h.top+h.height/2};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x,y:dragStart.y});
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:dragStart.x,y:dragStart.y,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x+64,y:dragStart.y+34,button:'left',buttons:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragStart.x+64,y:dragStart.y+34,button:'left',buttons:0,clickCount:1});
  await sleep(50);
  const dragged=await evaluate(`(()=>{const r=document.querySelector('.room-side').getBoundingClientRect();return {dx:Math.round(r.left-${dragStart.left}),dy:Math.round(r.top-${dragStart.top})};})()`);
  assert.ok(Math.abs(dragged.dx)>=24||Math.abs(dragged.dy)>=18,`Participants must be movable with real pointer input. ${JSON.stringify(dragged)}`);

  await evaluate(`document.querySelector('#roomChat').click()`);await sleep(60);
  const chat=await evaluate(`(()=>{const panel=document.querySelector('#meetingChatPanel'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=stage.getBoundingClientRect();return {participantsClosed:document.querySelector('.room-side').hidden,chatOpen:!panel.hidden,mode:panel.dataset.dsRuntimeMode,inside:pr.left>=br.left+10&&pr.right<=br.right-10&&pr.top>=br.top+10&&pr.bottom<=br.bottom-10,stageRightGap:Math.round(br.right-sr.right)};})()`);
  assert.equal(chat.participantsClosed,true,'Chat click must close Participants immediately.');
  assert.equal(chat.chatOpen,true,'Chat must open on the Chat click itself.');
  assert.equal(chat.mode,'floating','Chat must use the same floating window model.');
  assert.equal(chat.inside,true,'Floating Chat must remain inside the meeting body.');
  assert.ok(Math.abs(chat.stageRightGap)<=2,'Floating Chat must leave the full meeting stage available.');

  await evaluate(`document.querySelector('#roomChat').click()`);await sleep(60);
  assert.equal(await evaluate(`document.querySelector('#meetingChatPanel').hidden===true&&document.querySelector('.room-side').hidden===true`),true,'Chat must close immediately and leave no stale side panel open.');

  await evaluate(`(()=>{const p=document.querySelector('#roomParticipants'),c=document.querySelector('#roomChat');p.click();p.click();p.click();c.click();return true;})()`);await sleep(90);
  let settled=await evaluate(`(()=>({p:!document.querySelector('.room-side').hidden,c:!document.querySelector('#meetingChatPanel').hidden}))()`);
  assert.deepEqual(settled,{p:false,c:true},'Rapid Participants → Chat sequence must settle to Chat immediately.');
  await sleep(1800);
  settled=await evaluate(`(()=>({p:!document.querySelector('.room-side').hidden,c:!document.querySelector('#meetingChatPanel').hidden}))()`);
  assert.deepEqual(settled,{p:false,c:true},'Side panels changed after the interaction settled; delayed reconciliation is still active.');
  // Share routing regression: the final document-capture runtime authority must
  // win before the legacy button-capture smart picker. Stub only the final
  // integration endpoint; one click must produce one call and no legacy UI.
  await waitFor("window.DominionShareIntegration&&document.querySelector('#roomShare')",'final Share integration');
  await evaluate(`(()=>{window.__qaOriginalShareIntegration=window.DominionShareIntegration;window.__qaShareOpenCount=0;Object.defineProperty(window,'DominionShareIntegration',{configurable:true,writable:true,value:Object.freeze({open:()=>{window.__qaShareOpenCount+=1;return Promise.resolve(true);}})});document.querySelector('#dsSmartSharePicker')?.remove();document.querySelector('.ds-share-permission')?.remove();document.querySelector('.ds-219-share-recovery')?.remove();return true;})()`);
  await evaluate(`document.querySelector('#roomShare').click()`);await sleep(220);
  const shareRoute=await evaluate(`(()=>({calls:window.__qaShareOpenCount,legacyPickerOpen:Boolean(document.querySelector('#dsSmartSharePicker')&&!document.querySelector('#dsSmartSharePicker').hidden),legacyPermissionOpen:Boolean(document.querySelector('.ds-share-permission')&&!document.querySelector('.ds-share-permission').hidden),legacyRecoveryOpen:Boolean(document.querySelector('.ds-219-share-recovery')&&!document.querySelector('.ds-219-share-recovery').hidden),checking:Boolean(document.querySelector('#roomShare')?.classList.contains('ds-share-checking'))}))()`);
  assert.equal(shareRoute.calls,1,`Share Screen must route exactly once through the final intelligent integration. ${JSON.stringify(shareRoute)}`);
  assert.equal(shareRoute.legacyPickerOpen,false,'Legacy smart Share picker must not open from the packaged Share button.');
  assert.equal(shareRoute.legacyPermissionOpen,false,'Legacy physical permission surface must not open from the packaged Share button.');
  assert.equal(shareRoute.legacyRecoveryOpen,false,'Physical compatibility recovery must not steal the normal Share click.');
  assert.equal(shareRoute.checking,false,'Share progress state must release after the final integration settles.');
  await evaluate(`(()=>{Object.defineProperty(window,'DominionShareIntegration',{configurable:true,writable:true,value:window.__qaOriginalShareIntegration});delete window.__qaOriginalShareIntegration;delete window.__qaShareOpenCount;return true;})()`);

  const responsiveness=await evaluate(`new Promise(resolve=>{const started=performance.now();setTimeout(()=>resolve(Math.round(performance.now()-started)),80);})`);
  assert.ok(responsiveness<500,`Renderer event loop is still starved; 80 ms timer took ${responsiveness} ms.`);

  assert.doesNotMatch(stderr,/Uncaught\s+(?:RangeError|TypeError|ReferenceError|SyntaxError)/i,'Runtime-stability gate detected an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_RUNTIME_STABILITY_2_0_22_OK full-window immediate-participants accessible-smooth-stage-settle immediate-chat last-click-wins no-delayed-panel-flip single-owner-share responsive-event-loop floating-panels-draggable-full-stage');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('runtime-stability shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
