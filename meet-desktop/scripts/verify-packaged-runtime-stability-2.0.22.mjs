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

  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row" data-participant-id="self" data-participant-role="host" data-participant-name="QA Host"><span class="person-badge">QH</span><span class="person-copy"><strong>QA Host</strong><small>You</small></span></div>';window.DominionRuntimeStability.sync();return true;})()`);
  await waitFor("document.querySelector('#meetingOverlay').dataset.dsRuntimeStable==='1'&&document.querySelector('#roomParticipants')&&document.querySelector('#roomChat')",'runtime-stable meeting');

  const viewport=await evaluate(`(()=>{window.DominionRuntimeStability.sync();const overlay=document.querySelector('#meetingOverlay').getBoundingClientRect(),shell=document.querySelector('.meeting-shell').getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect();return {innerWidth,innerHeight,overlay:{x:Math.round(overlay.x),y:Math.round(overlay.y),w:Math.round(overlay.width),h:Math.round(overlay.height)},shell:{w:Math.round(shell.width),h:Math.round(shell.height)},body:{w:Math.round(body.width),h:Math.round(body.height)}};})()`);
  assert.ok(Math.abs(viewport.overlay.w-viewport.innerWidth)<=1,`Meeting overlay must fill the Electron viewport width. ${JSON.stringify(viewport)}`);
  assert.ok(Math.abs(viewport.overlay.h-viewport.innerHeight)<=1,`Meeting overlay must fill the Electron viewport height. ${JSON.stringify(viewport)}`);
  assert.equal(viewport.overlay.x,0);assert.equal(viewport.overlay.y,0);
  assert.ok(Math.abs(viewport.shell.w-viewport.innerWidth)<=1,'Meeting shell must expand with the window.');

  // Participants must respond to the click that was actually made, not to a
  // later Chat click after the renderer catches up. Visibility is immediate;
  // stage geometry then settles through the intentional 140 ms motion window.
  await evaluate(`document.querySelector('#roomParticipants').click()`);await sleep(45);
  const participantsImmediate=await evaluate(`(()=>{const side=document.querySelector('.room-side'),chat=document.querySelector('#meetingChatPanel'),stage=document.querySelector('.stage'),body=document.querySelector('.meeting-body');const sr=side.getBoundingClientRect(),st=stage.getBoundingClientRect(),br=body.getBoundingClientRect();return {participantsOpen:!side.hidden,chatClosed:chat.hidden,mode:side.dataset.dsRuntimeMode,rightGap:Math.round(br.right-sr.right),stageRightGap:Math.round(br.right-st.right),panelWidth:Math.round(sr.width),count:side.querySelector('.room-side-head strong')?.textContent||'',animation:getComputedStyle(side).animationName,stageTransition:getComputedStyle(stage).transitionDuration};})()`);
  assert.equal(participantsImmediate.participantsOpen,true,'Participants must open immediately on Participants click.');
  assert.equal(participantsImmediate.chatClosed,true,'Opening Participants must keep Chat closed.');
  assert.equal(participantsImmediate.mode,'docked','Desktop-width Participants must use the approved right-side dock.');
  assert.ok(Math.abs(participantsImmediate.rightGap)<=2,'Docked Participants must sit on the right edge immediately.');
  assert.equal(participantsImmediate.count,'Participants (1)');
  assert.match(participantsImmediate.animation,/dsRuntimePanelIn/,'Participants must use the short runtime entrance motion.');
  assert.ok(parseFloat(participantsImmediate.stageTransition)>0&&parseFloat(participantsImmediate.stageTransition)<=0.2,'Stage resize transition must remain short.');

  await sleep(170);
  const participantsSettled=await evaluate(`(()=>{const side=document.querySelector('.room-side'),stage=document.querySelector('.stage'),body=document.querySelector('.meeting-body');const sr=side.getBoundingClientRect(),st=stage.getBoundingClientRect(),br=body.getBoundingClientRect();return {panelWidth:Math.round(sr.width),stageRightGap:Math.round(br.right-st.right),stageWidth:Math.round(st.width),bodyWidth:Math.round(br.width)};})()`);
  assert.ok(participantsSettled.stageRightGap>=participantsSettled.panelWidth-2,`Stage must settle around the participant panel after the short transition. ${JSON.stringify(participantsSettled)}`);
  assert.ok(participantsSettled.stageWidth<=participantsSettled.bodyWidth-participantsSettled.panelWidth+2,'Docked Participants must reduce usable stage width rather than overlaying a full-width stage.');

  await evaluate(`document.querySelector('#roomChat').click()`);await sleep(60);
  const chat=await evaluate(`(()=>({participantsClosed:document.querySelector('.room-side').hidden,chatOpen:!document.querySelector('#meetingChatPanel').hidden,mode:document.querySelector('#meetingChatPanel').dataset.dsRuntimeMode}))()`);
  assert.equal(chat.participantsClosed,true,'Chat click must close Participants immediately.');
  assert.equal(chat.chatOpen,true,'Chat must open on the Chat click itself.');
  assert.equal(chat.mode,'docked','Desktop-width Chat must use the same right-side application surface.');

  await evaluate(`document.querySelector('#roomChat').click()`);await sleep(60);
  assert.equal(await evaluate(`document.querySelector('#meetingChatPanel').hidden===true&&document.querySelector('.room-side').hidden===true`),true,'Chat must close immediately and leave no stale side panel open.');

  // Reproduce the physical click pattern that failed: repeated participants,
  // then Chat. The last explicit action must win and must not flip later when
  // legacy 600/650/700/900/1200 ms reconciliation intervals would have fired.
  await evaluate(`(()=>{const p=document.querySelector('#roomParticipants'),c=document.querySelector('#roomChat');p.click();p.click();p.click();c.click();return true;})()`);await sleep(90);
  let settled=await evaluate(`(()=>({p:!document.querySelector('.room-side').hidden,c:!document.querySelector('#meetingChatPanel').hidden}))()`);
  assert.deepEqual(settled,{p:false,c:true},'Rapid Participants → Chat sequence must settle to Chat immediately.');
  await sleep(1800);
  settled=await evaluate(`(()=>({p:!document.querySelector('.room-side').hidden,c:!document.querySelector('#meetingChatPanel').hidden}))()`);
  assert.deepEqual(settled,{p:false,c:true},'Side panels changed after the interaction settled; delayed reconciliation is still active.');

  // Event-loop responsiveness probe. A self-triggering MutationObserver/RAF
  // storm prevents this short timer from completing in a reasonable window.
  const responsiveness=await evaluate(`new Promise(resolve=>{const started=performance.now();setTimeout(()=>resolve(Math.round(performance.now()-started)),80);})`);
  assert.ok(responsiveness<500,`Renderer event loop is still starved; 80 ms timer took ${responsiveness} ms.`);

  assert.doesNotMatch(stderr,/Uncaught\s+(?:RangeError|TypeError|ReferenceError|SyntaxError)/i,'Runtime-stability gate detected an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_RUNTIME_STABILITY_2_0_22_OK full-window immediate-participants smooth-stage-settle immediate-chat last-click-wins no-delayed-panel-flip responsive-event-loop right-docked-stage-resize');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('runtime-stability shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);