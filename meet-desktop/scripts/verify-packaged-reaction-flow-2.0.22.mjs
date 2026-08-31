import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-reaction-flow-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=11120+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before reaction-flow gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(160);}throw new Error('Unable to attach to packaged renderer for reaction-flow gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Reaction-flow CDP timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Reaction-flow CDP failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},4000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(90);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionZoomReactionParity&&window.DominionMeetingParity&&document.querySelector('#meetingOverlay')",'reaction-flow authorities');
  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;window.DominionMeetingParity.install();window.DominionZoomReactionParity.mount();window.DominionZoomReactionParity.scan();return true;})()`);
  await waitFor("document.querySelector('#meetingReactionLayer')&&document.querySelector('#meetingReactionLayer').parentElement?.classList.contains('stage')",'reaction layer mounted in stage');

  await evaluate(`(()=>{const layer=document.querySelector('#meetingReactionLayer');layer.querySelectorAll('.meeting-reaction-bubble,.ds-reaction-float').forEach(n=>n.remove());const emojis=['❤️','👏','👍'];for(let i=0;i<48;i++){const bubble=document.createElement('div');bubble.className='meeting-reaction-bubble';bubble.innerHTML='<b>'+emojis[i%3]+'</b><span>QA Person '+i+'</span>';layer.append(bubble);}return true;})()`);
  await waitFor("document.querySelectorAll('.ds-zoom-floating-reaction[data-ds-reaction-parity=\"10s\"]').length>=40",'high-volume primary reactions');
  await waitFor("document.querySelectorAll('.ds-reaction-satellite[data-ds-reaction-satellite=\"1\"]').length>0",'selective reaction blossom');

  const geometry=await evaluate(`(()=>{const layer=document.querySelector('#meetingReactionLayer'),lr=layer.getBoundingClientRect();const primary=[...layer.querySelectorAll('.ds-zoom-floating-reaction[data-ds-reaction-parity="10s"]')];const satellites=layer.querySelectorAll('.ds-reaction-satellite[data-ds-reaction-satellite="1"]').length;const ratios=primary.map(n=>(n.getBoundingClientRect().left-lr.left)/Math.max(1,lr.width));return {lane:layer.dataset.dsZoomReactionLane,primary:primary.length,satellites,min:Math.min(...ratios),max:Math.max(...ratios),layerParent:layer.parentElement?.className||''};})()`);
  assert.equal(geometry.lane,'left','Reaction layer must advertise the left-side Zoom reference lane.');
  assert.ok(geometry.primary<=72,`Primary reaction budget must remain bounded; received ${geometry.primary}.`);
  assert.ok(geometry.primary>=40,'High-volume test did not preserve enough simultaneous primary reactions.');
  assert.ok(geometry.satellites>0,'Heart/clap/thumb traffic must occasionally blossom into secondary emojis.');
  assert.ok(geometry.min>=0&&geometry.max<=0.34,`Reactions must remain in the left-side band. ${JSON.stringify(geometry)}`);
  assert.ok(String(geometry.layerParent).includes('stage'),'Reaction layer must live on video/shared-content stage so sharing does not move reactions into a separate page area.');

  const responsiveness=await evaluate(`new Promise(resolve=>{const started=performance.now();setTimeout(()=>resolve(Math.round(performance.now()-started)),80);})`);
  assert.ok(responsiveness<500,`High-volume reactions starved the renderer; 80 ms timer took ${responsiveness} ms.`);
  await evaluate(`document.querySelector('#meetingReactionLayer')?.querySelectorAll('.meeting-reaction-bubble,.ds-reaction-float').forEach(n=>n.remove())`);
  assert.doesNotMatch(stderr,/Uncaught\s+(?:RangeError|TypeError|ReferenceError|SyntaxError)/i,'Reaction-flow gate detected an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_REACTION_FLOW_2_0_22_OK left-stage-lanes bounded-primaries selective-blossoms high-volume-responsive');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('reaction-flow shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);