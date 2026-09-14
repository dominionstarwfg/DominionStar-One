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
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1',DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN:'1'},
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
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(800)});
      if(response.ok){
        const targets=await response.json();
        const found=targets.find(item=>item.type==='page'&&predicate(String(item.url||''))&&item.webSocketDebuggerUrl);
        if(found)return found;
      }
    }catch{}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}.\n${stderr}`);
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
  async wait(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,2500))return;}catch{}await sleep(80);}throw new Error(`Timed out waiting for ${label}.`);}
  close(){try{this.socket?.close();}catch{}}
}

let main=null,failure=null;
try{
  const mainTarget=await target(url=>url.startsWith('file://')&&url.includes('/ui/index.html'),'main meeting renderer');
  main=new Cdp(mainTarget.webSocketDebuggerUrl);await main.connect();
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.dominionDesktop?.share",'share controllers');

  // Deliberately DO NOT call dominionDesktop.macShare.prepare(). This control
  // isolates whether the mere existence of the secondary native presenter
  // BrowserWindows is what causes the hosted macOS renderer scheduler stall.
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

    window.DominionShareController.onChange(state=>console.error('QA_MAC_SHARE_STATE active='+(state.active?1:0)+' paused='+(state.paused?1:0)+' source='+encodeURIComponent(state.sourceName||'')));

    const makeTrack=(kind='video')=>({kind,id:'qa-no-prepare-'+kind+'-'+Math.random().toString(36).slice(2),label:'QA No Prepare '+kind,readyState:'live',enabled:true,contentHint:'',addEventListener(){},removeEventListener(){},stop(){this.readyState='ended';},clone(){return makeTrack(kind);}});
    const makeStream=(kind='video')=>{
      const tracks=[makeTrack(kind)];
      return {
        getVideoTracks:()=>tracks.filter(track=>track.kind==='video'),
        getAudioTracks:()=>tracks.filter(track=>track.kind==='audio'),
        getTracks:()=>[...tracks],
        addTrack(track){if(track&&!tracks.includes(track))tracks.push(track);},
        removeTrack(track){const index=tracks.indexOf(track);if(index>=0)tracks.splice(index,1);}
      };
    };
    const nativeSrcObject=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'srcObject');
    Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{
      configurable:true,
      get(){return Object.prototype.hasOwnProperty.call(this,'__qaLogicalSrcObject')?this.__qaLogicalSrcObject:nativeSrcObject?.get?.call(this)||null;},
      set(value){if(value&&!(value instanceof MediaStream)){this.__qaLogicalSrcObject=value;return;}delete this.__qaLogicalSrcObject;if(nativeSrcObject?.set)nativeSrcObject.set.call(this,value);}
    });
    HTMLCanvasElement.prototype.captureStream=function(){return makeStream('video');};

    window.__qaRunNoPrepareShare=async()=>{
      try{
        const stream=makeStream('video');
        const frameCanvas=document.createElement('canvas');frameCanvas.width=640;frameCanvas.height=360;
        const ctx=frameCanvas.getContext('2d',{alpha:false});ctx.fillStyle='#07111f';ctx.fillRect(0,0,640,360);ctx.fillStyle='#d6b25e';ctx.fillRect(70,70,210,130);
        Object.defineProperty(window,'ImageCapture',{configurable:true,value:class{async grabFrame(){return createImageBitmap(frameCanvas);}}});
        Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>stream});
        console.error('QA_MAC_NO_PREPARE_STREAM logical-hosted-fixture');
        const state=await window.DominionShareController.start({name:'QA Mac Floating Share',options:{shareAudio:false,optimizeVideo:false}});
        console.error('QA_MAC_NO_PREPARE_RESOLVED active='+(state.active?1:0));
        requestAnimationFrame(()=>console.error('QA_MAC_NO_PREPARE_RAF'));
        setTimeout(()=>console.error('QA_MAC_NO_PREPARE_TICK'),120);
      }catch(error){console.error('QA_MAC_FLOATING_SHARE_FAILURE '+String(error?.stack||error));}
    };
    setTimeout(()=>{void window.__qaRunNoPrepareShare();},30);
    return true;
  })()`,3000);
  assert.equal(armed,true,'No-preprepare scheduler control was not armed.');

  await waitLog('QA_MAC_NO_PREPARE_STREAM logical-hosted-fixture','logical no-preprepare media fixture',5000);
  await waitLog('QA_MAC_CAPTURE_STARTED_ACK_ONLY','QA capture-start bypass',5000);
  await waitLog('QA_MAC_NO_PREPARE_RESOLVED active=1','resolved no-preprepare share',5000);
  await waitLog('QA_MAC_NO_PREPARE_TICK','renderer scheduling without native presenter BrowserWindows',3000);
  console.error('QA_MAC_NO_PREPARE_SCHEDULER_ALIVE');

  // This is deliberately a diagnostic failure, not a certification pass.
  throw new Error('DIAGNOSTIC_CONFIRMED_NO_PREPARE_SCHEDULER_ALIVE');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}
finally{
  main?.close();
  if(child.exitCode===null){try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
}
if(failure)throw failure;
