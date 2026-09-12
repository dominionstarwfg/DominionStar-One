import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-mac-presenter-window-2.0.41.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=12140+Math.floor(Math.random()*120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(predicate,label,timeout=16000){
  const deadline=Date.now()+timeout;let last=[];
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(800)});
      if(response.ok){
        const targets=await response.json();last=targets.filter(item=>item.type==='page').map(item=>String(item.url||''));
        const found=targets.find(item=>item.type==='page'&&predicate(String(item.url||''))&&item.webSocketDebuggerUrl);
        if(found)return found;
      }
    }catch{}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}. Targets=${JSON.stringify(last)}\n${stderr}`);
}

class Cdp{
  constructor(url){this.url=url;this.socket=null;this.next=0;this.pending=new Map();}
  async connect(){
    this.socket=await new Promise((resolve,reject)=>{
      const socket=new WebSocket(this.url),timer=setTimeout(()=>reject(new Error('CDP connect timeout')),4000);
      socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
      socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connect failed'));},{once:true});
    });
    this.socket.addEventListener('message',event=>{
      const msg=JSON.parse(String(event.data));if(!msg.id)return;const waiter=this.pending.get(msg.id);if(!waiter)return;
      this.pending.delete(msg.id);clearTimeout(waiter.timer);msg.error?waiter.reject(new Error(msg.error.message||'CDP error')):waiter.resolve(msg.result);
    });
    await this.call('Runtime.enable');
  }
  call(method,params={},timeout=7000){return new Promise((resolve,reject)=>{
    const id=++this.next,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);
    this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));
  });}
  async eval(expression,timeout=7000){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');return result.result?.value;}
  async wait(expression,label,timeout=10000){const deadline=Date.now()+timeout;let last='';while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,2500))return;}catch(error){last=String(error?.message||error);}await sleep(80);}throw new Error(`Timed out waiting for ${label}${last?`: ${last}`:''}`);}
  close(){try{this.socket?.close();}catch{}}
}

let main=null,toolbar=null,failure=null;
try{
  const mainTarget=await target(url=>url.startsWith('file://')&&url.includes('/ui/index.html'),'main meeting renderer');
  main=new Cdp(mainTarget.webSocketDebuggerUrl);await main.connect();
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.__DominionPresenterDispatch&&window.dominionDesktop?.share",'share controllers');

  const started=await main.eval(`(async()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;
    const role=document.querySelector('#roomRole');if(role)role.textContent='Host';
    window.DominionMeetingParity?.install?.();
    window.DominionMeetingFeatures?.toggleChat?.(false);
    window.DominionRuntimeStability?.sync?.();
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#07111f';ctx.fillRect(0,0,640,360);ctx.fillStyle='#d6b25e';ctx.fillRect(70,70,210,130);
    const stream=canvas.captureStream(12);window.__qaMacPresenterStream=stream;
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>stream});
    const state=await window.DominionShareController.start({name:'QA Mac Floating Share',options:{shareAudio:false,optimizeVideo:false}});
    return {active:state.active,sourceName:state.sourceName,overlayShare:overlay.classList.contains('share-active')};
  })()`,12000);
  assert.equal(started.active,true,'Synthetic share did not become active.');
  assert.equal(started.sourceName,'QA Mac Floating Share');

  const toolbarTarget=await target(url=>url.includes('mac-presenter-toolbar.html'),'floating macOS presenter toolbar',12000);
  toolbar=new Cdp(toolbarTarget.webSocketDebuggerUrl);await toolbar.connect();
  await toolbar.wait("document.readyState==='complete'&&document.querySelector('#stopShare')&&window.dominionDesktop?.presenter?.command",'floating toolbar command bridge');

  const surface=await toolbar.eval(`(()=>({
    sharing:document.querySelector('#shareStateLabel')?.textContent||'',
    stop:document.querySelector('#stopShare')?.textContent||'',
    commands:[...document.querySelectorAll('[data-command]')].map(node=>node.dataset.command),
    presenterBridge:Boolean(window.dominionDesktop?.presenter?.command),
    macBridge:Boolean(window.dominionDesktop?.macShare?.setMenuOpen)
  }))()`);
  assert.match(surface.sharing,/screen sharing/i,'Floating toolbar does not visibly confirm active sharing.');
  assert.match(surface.stop,/Stop share/i,'Floating toolbar is missing Stop share.');
  assert.equal(surface.presenterBridge,true,'Floating toolbar cannot access the certified presenter command bridge.');
  assert.equal(surface.macBridge,true,'Floating toolbar lost its native macShare geometry bridge.');
  for(const command of ['audio','video','participants','chat','new-share','pause','annotate','show-meeting','record']){
    assert.ok(surface.commands.includes(command),`Floating toolbar is missing ${command}.`);
  }

  const menu=await toolbar.eval(`(()=>{document.querySelector('#moreButton').click();return {open:!document.querySelector('#moreMenu').hidden,text:document.querySelector('#moreMenu').innerText};})()`);
  assert.equal(menu.open,true,'Floating More menu did not open from the real toolbar button.');
  assert.match(menu.text,/Record meeting/);assert.match(menu.text,/New Share/);
  await toolbar.eval(`document.querySelector('#moreButton').click()`);

  await toolbar.eval(`document.querySelector('#stopShare').click()`);
  await main.wait("window.DominionShareController.snapshot().active===false&&!document.querySelector('#meetingOverlay').classList.contains('share-active')",'Stop Share round trip',9000);
  const stopped=await main.eval(`(()=>({active:window.DominionShareController.snapshot().active,shareClass:document.querySelector('#meetingOverlay').classList.contains('share-active')}))()`);
  assert.deepEqual(stopped,{active:false,shareClass:false},'Stop Share did not terminate the real share controller state.');

  console.log('DOMINIONSTAR_PACKAGED_MAC_PRESENTER_WINDOW_2_0_41_OK floating-window real-presenter-bridge more-menu stop-share-round-trip');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}
finally{
  toolbar?.close();main?.close();
  if(child.exitCode===null){try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
}
if(failure)throw failure;
