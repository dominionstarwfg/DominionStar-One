import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
const toolbarProofPath=process.argv[3]?path.resolve(process.argv[3]):'';
if(!appPath)throw new Error('Usage: node verify-packaged-mac-presenter-window-2.0.41.mjs <DominionStar Meet.app> [toolbar-proof.png]');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=12140+Math.floor(Math.random()*120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});
const count=needle=>stderr.split(String(needle)).length-1;

async function waitLog(needle,label,timeout=12000,minCount=1){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);
    if(stderr.includes('QA_MAC_FLOATING_SHARE_FAILURE'))throw new Error(`Renderer share lifecycle failed before ${label}.\n${stderr}`);
    if(count(needle)>=minCount)return;
    await sleep(60);
  }
  throw new Error(`Timed out waiting for ${label}: ${needle} count=${count(needle)} expected=${minCount}\n${stderr}`);
}

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
    await this.call('Page.enable');
  }
  call(method,params={},timeout=7000){return new Promise((resolve,reject)=>{
    const id=++this.next,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);
    this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));
  });}
  async eval(expression,timeout=7000){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');return result.result?.value;}
  async wait(expression,label,timeout=10000){const deadline=Date.now()+timeout;let last='';while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,2500))return;}catch(error){last=String(error?.message||error);}await sleep(80);}throw new Error(`Timed out waiting for ${label}${last?`: ${last}`:''}`);}
  async screenshot(file){const result=await this.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},7000);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(result.data,'base64'));}
  close(){try{this.socket?.close();}catch{}}
}

let main=null,toolbar=null,videoDock=null,failure=null;
try{
  const mainTarget=await target(url=>url.startsWith('file://')&&url.includes('/ui/index.html'),'main meeting renderer');
  main=new Cdp(mainTarget.webSocketDebuggerUrl);await main.connect();
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.__DominionPresenterDispatch&&window.dominionDesktop?.share&&window.dominionDesktop?.macShare?.prepare",'share controllers');

  // Production prepares the native macOS presenter windows before source
  // enumeration/capture. Reproduce that exact lifecycle here. Creating those
  // BrowserWindows after capture has already started can stall Chromium on a
  // hosted Mac and is not the shipping path.
  const prepared=await main.eval(`window.dominionDesktop.macShare.prepare()`,12000);
  assert.equal(prepared?.ok,true,'macOS presenter surfaces were not prepared before capture.');

  // Establish inspector channels to the native presenter windows BEFORE active
  // display capture. Hosted macOS Chromium can refuse new Runtime.enable calls
  // against an already-sharing renderer even while the product renderer and
  // native presenter windows remain healthy. Keeping these channels open tests
  // the real BrowserWindows without depending on a post-capture reattach.
  const toolbarTarget=await target(url=>url.includes('mac-presenter-toolbar.html'),'pre-capture floating macOS presenter toolbar',12000);
  toolbar=new Cdp(toolbarTarget.webSocketDebuggerUrl);await toolbar.connect();
  await toolbar.wait("document.readyState==='complete'&&document.querySelector('#stopShare')&&window.DominionMacPresenterToolbar?.transport==='macShare-ack'",'pre-capture acknowledged floating toolbar command bridge');

  const videoTarget=await target(url=>url.includes('mac-share-video.html'),'pre-capture floating macOS participant video dock',12000);
  videoDock=new Cdp(videoTarget.webSocketDebuggerUrl);await videoDock.connect();
  await videoDock.wait("document.readyState==='complete'&&document.querySelector('#dock')",'pre-capture floating participant video dock');

  // Drive the production share lifecycle from inside the renderer and install
  // fail-closed state observers before active capture. The main-renderer CDP
  // channel stays connected but is deliberately idle after arming: no Runtime,
  // Page, or DOM command is sent to the share-owning renderer while capture is
  // active. This isolates a hosted-macOS scheduling variable without allowing
  // the inspector to manufacture any presenter state transition.
  const armed=await main.eval(`(()=>{
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

    window.__qaMacPreviousShareState={active:false,paused:false};
    window.DominionShareController.onChange(state=>{
      const previous=window.__qaMacPreviousShareState||{active:false,paused:false};
      console.error('QA_MAC_SHARE_STATE active='+(state.active?1:0)+' paused='+(state.paused?1:0)+' source='+encodeURIComponent(state.sourceName||''));
      if(state.active&&state.paused&&!previous.paused)console.error('QA_MAC_PAUSE_STATE paused=1');
      if(state.active&&!state.paused&&previous.paused)console.error('QA_MAC_PAUSE_STATE paused=0');
      if(!state.active&&previous.active)console.error('QA_MAC_STOP_STATE active=0');
      window.__qaMacPreviousShareState={active:Boolean(state.active),paused:Boolean(state.paused)};
    });
    window.addEventListener('dominion:presenter-command-dispatch',event=>{
      console.error('QA_MAC_COMMAND '+String(event.detail?.command||''));
    });
    window.__qaMacLastCompanion='__unset__';
    const reportCompanion=()=>{
      const kind=String(document.body.dataset.dsShareCompanion||'none');
      if(kind===window.__qaMacLastCompanion)return;
      window.__qaMacLastCompanion=kind;
      console.error('QA_MAC_COMPANION '+kind);
    };
    new MutationObserver(reportCompanion).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-ds-share-companion','hidden']});
    reportCompanion();

    window.__qaRunMacFloatingShare=async()=>{
      try{
        const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
        const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#07111f';ctx.fillRect(0,0,640,360);ctx.fillStyle='#d6b25e';ctx.fillRect(70,70,210,130);
        const stream=canvas.captureStream(12);window.__qaMacPresenterStream=stream;
        Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>stream});
        const state=await window.DominionShareController.start({name:'QA Mac Floating Share',options:{shareAudio:false,optimizeVideo:false}});
        console.error('QA_MAC_FLOATING_SHARE_RESOLVED active='+(state.active?1:0)+' source='+encodeURIComponent(state.sourceName||'')+' overlay='+(overlay.classList.contains('share-active')?1:0));
      }catch(error){
        console.error('QA_MAC_FLOATING_SHARE_FAILURE '+String(error?.stack||error));
      }
    };
    setTimeout(()=>{void window.__qaRunMacFloatingShare();},30);
    return true;
  })()`,3000);
  assert.equal(armed,true,'Real floating presenter share lifecycle was not armed.');

  // Keep the already-established main inspector transport open but completely
  // idle throughout active sharing. Closing it on hosted macOS may suspend the
  // synthetic capture renderer; issuing new CDP work would contaminate the
  // command-path proof. Renderer stderr remains the sole state acceptance lane.
  await waitLog('QA_MAC_FLOATING_SHARE_RESOLVED active=1','resolved real Mac floating share',12000);
  await waitLog('QA_MAC_SHARE_STATE active=1 paused=0 source=QA%20Mac%20Floating%20Share','active real share state',5000);

  await toolbar.wait("document.querySelector('#shareStateLabel')?.textContent?.toLowerCase().includes('screen sharing')",'visible active sharing state on native toolbar',7000);
  const surface=await toolbar.eval(`(()=>({
    sharing:document.querySelector('#shareStateLabel')?.textContent||'',
    stop:document.querySelector('#stopShare')?.textContent||'',
    brand:document.querySelector('.brand span')?.textContent||'',
    commands:[...document.querySelectorAll('[data-command]')].map(node=>node.dataset.command),
    presenterBridge:Boolean(window.dominionDesktop?.presenter?.command),
    macBridge:Boolean(window.dominionDesktop?.macShare?.command),
    transport:window.DominionMacPresenterToolbar?.transport||''
  }))()`);
  assert.match(surface.sharing,/screen sharing/i,'Floating toolbar does not visibly confirm active sharing.');
  assert.match(surface.stop,/Stop share/i,'Floating toolbar is missing Stop share.');
  assert.equal(surface.brand,'DominionStar','Floating toolbar brand label drifted from approved compact reference.');
  assert.equal(surface.presenterBridge,true,'Floating toolbar cannot access the presenter fallback bridge.');
  assert.equal(surface.macBridge,true,'Floating toolbar lost its native macShare command bridge.');
  assert.equal(surface.transport,'macShare-ack','Floating toolbar is not using acknowledged native Mac command delivery.');
  for(const command of ['audio','video','participants','chat','new-share','pause','annotate','show-meeting','record']){
    assert.ok(surface.commands.includes(command),`Floating toolbar is missing ${command}.`);
  }

  // Prove the acknowledged command path immediately after active share, before
  // menu expansion, toolbar resize, or screenshot work can contaminate the
  // renderer scheduling test.
  await toolbar.eval(`document.querySelector('[data-command="pause"]').click()`);
  await waitLog('QA_MAC_COMMAND pause','real Pause command delivery',5000,1);
  await waitLog('QA_MAC_PAUSE_STATE paused=1','real Pause state round trip',7000);
  await toolbar.wait("document.querySelector('#pauseLabel')?.textContent==='Resume'",'Pause label state feedback',5000);

  await toolbar.eval(`document.querySelector('[data-command="pause"]').click()`);
  await waitLog('QA_MAC_COMMAND pause','real Resume command delivery',5000,2);
  await waitLog('QA_MAC_PAUSE_STATE paused=0','real Resume state round trip',7000);
  await toolbar.wait("document.querySelector('#pauseLabel')?.textContent==='Pause'",'Resume label state feedback',5000);

  const menu=await toolbar.eval(`(()=>{document.querySelector('#moreButton').click();return {open:!document.querySelector('#moreMenu').hidden,text:document.querySelector('#moreMenu').innerText};})()`);
  assert.equal(menu.open,true,'Floating More menu did not open from the real toolbar button.');
  assert.match(menu.text,/Record meeting/);assert.match(menu.text,/New Share/);
  await toolbar.eval(`document.querySelector('#moreButton').click()`);

  if(toolbarProofPath)await toolbar.screenshot(toolbarProofPath);

  await toolbar.eval(`document.querySelector('[data-command="participants"]').click()`);
  await waitLog('QA_MAC_COMMAND participants','Participants command delivery',5000);
  await waitLog('QA_MAC_COMPANION participants','Participants companion state',7000);

  await toolbar.eval(`document.querySelector('[data-command="chat"]').click()`);
  await waitLog('QA_MAC_COMMAND chat','Chat command delivery',5000);
  await waitLog('QA_MAC_COMPANION chat','Chat companion state',7000);

  await toolbar.eval(`document.querySelector('#stopShare').click()`);
  await waitLog('QA_MAC_COMMAND stop','Stop Share command delivery',5000);
  await waitLog('QA_MAC_STOP_STATE active=0','Stop Share state round trip',9000);

  console.log('DOMINIONSTAR_PACKAGED_MAC_PRESENTER_WINDOW_2_0_41_OK preconnected-native-inspector idle-main-inspector renderer-self-driven-share resolved-real-share floating-window completed-macShare-ack immediate-pause-resume participant-dock more-menu participants-chat stop-share-round-trip no-post-capture-main-eval');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}
finally{
  videoDock?.close();toolbar?.close();main?.close();
  if(child.exitCode===null){try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
}
if(failure)throw failure;