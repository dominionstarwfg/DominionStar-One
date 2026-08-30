import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-reaction-parity.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10120+Math.floor(Math.random()*150);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const runtimeErrors=[];
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before reaction parity gate.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});
      if(response.ok){
        const targets=await response.json();
        const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));
        if(page?.webSocketDebuggerUrl)return page;
      }
    }catch{}
    await sleep(180);
  }
  throw new Error('Unable to attach to packaged renderer for reaction parity gate.');
}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Reaction parity WebSocket timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Reaction parity WebSocket failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},3000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown'){const details=message.params?.exceptionDetails;runtimeErrors.push(details?.exception?.description||details?.text||'Uncaught renderer exception');return;}if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionZoomPhysicalAcceptance&&window.DominionZoomReactionParity",'reaction parity authorities');
  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionZoomPhysicalAcceptance.sync();window.DominionZoomReactionParity.scan();return true;})()`);
  await waitFor("document.querySelector('#meetingReactionLayer')",'meeting reaction layer');

  const started=Date.now();
  await evaluate(`(()=>{const layer=document.querySelector('#meetingReactionLayer');layer.querySelectorAll('.meeting-reaction-bubble,.ds-reaction-float').forEach(n=>n.remove());const bubble=document.createElement('div');bubble.className='meeting-reaction-bubble';bubble.innerHTML='<b>❤️</b><span>Reaction QA</span>';layer.append(bubble);return true;})()`);
  await waitFor("document.querySelector('.ds-reaction-float[data-ds-reaction-parity=\"10s\"]')",'canonical 10-second reaction');
  const initial=await evaluate(`(()=>{const n=document.querySelector('.ds-reaction-float[data-ds-reaction-parity="10s"]'),s=getComputedStyle(n);return {duration:parseFloat(s.animationDuration),name:n.querySelector('span')?.textContent||'',direction:s.flexDirection};})()`);
  assert.ok(initial.duration>=9.9&&initial.duration<=10.2,`Reaction animation must be 10 seconds, received ${initial.duration}s.`);
  assert.equal(initial.name,'Reaction QA','Reaction identity must remain attached to the emitted reaction.');
  assert.equal(initial.direction,'column','Reaction identity must remain beneath the emoji.');

  // This is the regression boundary that 2.0.16 failed: it removed the reaction at 6.3 seconds.
  await sleep(6700);
  const aliveAtBoundary=await evaluate(`Boolean(document.querySelector('.ds-reaction-float[data-ds-reaction-parity="10s"]'))`);
  assert.equal(aliveAtBoundary,true,'Reaction disappeared at or before the old 6.3-second regression boundary.');

  const elapsed=Date.now()-started;
  if(elapsed<10150)await sleep(10150-elapsed);
  await waitFor("!document.querySelector('.ds-reaction-float[data-ds-reaction-parity=\"10s\"]')",'reaction removal after 10 seconds',1800);

  assert.deepEqual(runtimeErrors,[],'Reaction parity gate emitted uncaught renderer exceptions:\n'+runtimeErrors.join('\n'));
  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer wrote an uncaught JavaScript error during reaction parity.');
  console.log('DOMINIONSTAR_PACKAGED_REACTION_PARITY_OK duration=10s alive-after-6.7s removed-after-10s no-renderer-errors');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{
  for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('reaction parity shutdown'));}pending.clear();
  try{socket?.close();}catch{}
  try{child.kill('SIGTERM');}catch{}
  await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}
}
process.exit(failure?1:0);
