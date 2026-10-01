import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-reference-command-routing-2.0.41.mjs <DominionStar Meet.app>');

const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=11880+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){
  const deadline=Date.now()+18000;
  let lastTargets=[];
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before command-routing proof.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(800)});
      if(response.ok){
        const targets=await response.json();
        lastTargets=targets.filter(item=>item.type==='page').map(item=>String(item.url||''));
        const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://')&&String(item.url||'').includes('/ui/index.html'));
        if(page?.webSocketDebuggerUrl)return page;
      }
    }catch{}
    await sleep(150);
  }
  throw new Error(`Unable to attach to packaged main meeting renderer for 2.0.41 command-routing proof. Targets=${JSON.stringify(lastTargets)}\n${stderr}`);
}

function connect(url){return new Promise((resolve,reject)=>{
  const socket=new WebSocket(url);
  const timer=setTimeout(()=>reject(new Error('Command-routing CDP connection timeout.')),3500);
  socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
  socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Command-routing CDP connection failed.'));},{once:true});
});}

let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{
  const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},6000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){
  const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');
  return result.result?.value;
}
async function waitFor(expression,label,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(100);}
  throw new Error(`Timed out waiting for ${label}.`);
}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));if(!message.id)return;
    const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);
    message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);
  });
  await cdp('Runtime.enable');

  // Host Tools is dynamically decorated. Prove the stable meeting controllers
  // first, then mount/decorate the toolbar before asserting the real commands.
  await waitFor("document.readyState==='complete'&&window.DominionZoomScreenshotReference&&window.DominionMeetingParity&&window.DominionApprovedReferenceParity&&window.DominionRuntimeStability&&document.querySelector('#meetingOverlay')&&document.querySelector('#roomMore')",'2.0.41 meeting controllers');

  await evaluate(`(()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;
    document.querySelector('#roomRole').textContent='Host';
    window.DominionMeetingParity.install();
    window.DominionMeetingParity.decorateControls?.();
    window.DominionApprovedReferenceParity.sync();
    window.DominionRuntimeStability.sync();
    window.DominionZoomScreenshotReference.sync();
    return true;
  })()`);
  await waitFor("document.querySelector('#roomHostTools')&&!document.querySelector('#roomHostTools').hidden",'decorated Host Tools control');

  await evaluate(`document.querySelector('#roomMore').click()`);
  await waitFor("document.querySelector('.ds-ref-meeting-more-grid')",'2.0.41 More grid from real toolbar click');
  const more=await evaluate(`(()=>({buttons:document.querySelectorAll('.ds-ref-meeting-more-items button').length,text:document.querySelector('.ds-ref-meeting-more-grid')?.innerText||''}))()`);
  if(more.buttons<10||!/Record/.test(more.text)||!/Settings/.test(more.text))throw new Error(`More toolbar routing failed ${JSON.stringify(more)}`);

  await evaluate(`(()=>{const stage=document.querySelector('#meetingOverlay .stage')||document.body;stage.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true}));return true;})()`);
  await waitFor("!document.querySelector('.ds-ref-meeting-more-grid')",'More grid close');

  await evaluate(`document.querySelector('#roomHostTools').click()`);
  await waitFor("document.querySelector('.ds-ref-host-tools-panel')",'2.0.41 Host Tools panel from real toolbar click');
  const host=await evaluate(`(()=>({text:document.querySelector('.ds-ref-host-tools-panel')?.innerText||'',right:Math.round(innerWidth-document.querySelector('.ds-ref-host-tools-panel').getBoundingClientRect().right)}))()`);
  if(!/Lock meeting/.test(host.text)||!/Enable waiting room/.test(host.text)||!/Participants/.test(host.text))throw new Error(`Host Tools toolbar routing failed ${JSON.stringify(host)}`);

  console.log(`DOMINIONSTAR_REFERENCE_COMMAND_ROUTING_2_0_41_OK moreButtons=${more.buttons} hostRight=${host.right}`);
}catch(error){failure=error;}finally{
  try{socket?.close();}catch{}
  if(child.exitCode===null){try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null){try{child.kill('SIGKILL');}catch{}}}
}
if(failure)throw failure;
