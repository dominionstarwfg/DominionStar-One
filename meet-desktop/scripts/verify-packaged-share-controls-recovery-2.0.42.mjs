import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-share-controls-recovery-2.0.42.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=12480+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1',DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function findTarget(predicate,label,timeout=18000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`App exited before ${label}.\n${stderr}`);
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
      const msg=JSON.parse(String(event.data));if(!msg.id)return;
      const waiter=this.pending.get(msg.id);if(!waiter)return;
      this.pending.delete(msg.id);clearTimeout(waiter.timer);
      msg.error?waiter.reject(new Error(msg.error.message||'CDP error')):waiter.resolve(msg.result);
    });
    await this.call('Runtime.enable');
  }
  call(method,params={},timeout=8000){return new Promise((resolve,reject)=>{
    const id=++this.next,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);
    this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));
  });}
  async eval(expression,timeout=8000){
    const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');
    return result.result?.value;
  }
  async wait(expression,label,timeout=12000){
    const deadline=Date.now()+timeout;
    while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,3000))return;}catch{}await sleep(70);}
    throw new Error(`Timed out waiting for ${label}.\n${stderr}`);
  }
  close(){try{this.socket?.close();}catch{}}
}

let main=null,toolbar=null,video=null,picker=null,failure=null;
try{
  main=new Cdp((await findTarget(url=>url.startsWith('file://')&&url.includes('/ui/index.html'),'meeting renderer')).webSocketDebuggerUrl);
  await main.connect();
  await main.wait("document.readyState==='complete'&&window.DominionMediaController&&window.DominionShareController&&window.DominionShareIntegration&&window.__DominionPresenterDispatch",'meeting/share controllers');

  const prepared=await main.eval(`(async()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;
    document.querySelector('#roomRole').textContent='Host';
    window.DominionMeetingParity?.install?.();

    const cameraCanvas=document.createElement('canvas');cameraCanvas.width=640;cameraCanvas.height=360;
    const cameraCtx=cameraCanvas.getContext('2d');cameraCtx.fillStyle='#1f6feb';cameraCtx.fillRect(0,0,640,360);cameraCtx.fillStyle='#fff';cameraCtx.font='48px sans-serif';cameraCtx.fillText('CAMERA LIVE',120,190);
    const shareCanvas=document.createElement('canvas');shareCanvas.width=1280;shareCanvas.height=720;
    const shareCtx=shareCanvas.getContext('2d');shareCtx.fillStyle='#232426';shareCtx.fillRect(0,0,1280,720);shareCtx.fillStyle='#fff';shareCtx.font='62px sans-serif';shareCtx.fillText('QA SHARED SCREEN',330,370);
    const cameraBase=cameraCanvas.captureStream(30);
    const shareBase=shareCanvas.captureStream(15);
    const audioContext=new AudioContext();
    const oscillator=audioContext.createOscillator(),destination=audioContext.createMediaStreamDestination();
    oscillator.connect(destination);oscillator.start();

    window.__qaMediaFixtures={cameraCanvas,shareCanvas,cameraBase,shareBase,audioContext,oscillator,destination};
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>new MediaStream([shareBase.getVideoTracks()[0].clone()])});
    window.ImageCapture=class{constructor(track){this.track=track;}async grabFrame(){return createImageBitmap(window.DominionShareController?.snapshot?.().active?shareCanvas:cameraCanvas);}};

    // Build deterministic live camera/microphone state without invoking macOS
    // Camera/Microphone permission UI on the hosted runner. setCamera(false)
    // creates the controller-owned MediaStream without acquisition. We then
    // attach deterministic tracks to that same stream, restore the controller
    // flags, and unmute using the already-live audio track.
    await window.DominionMediaController.setCamera(false);
    const owned=window.DominionMediaController.stream();
    owned.addTrack(cameraBase.getVideoTracks()[0].clone());
    owned.addTrack(destination.stream.getAudioTracks()[0].clone());
    window.DominionMediaController.resetPreferences();
    await window.DominionMediaController.setMicrophone(true);
    const local=document.querySelector('#localMeetingVideo');local.srcObject=owned;void local.play().catch(()=>{});
    return {media:window.DominionMediaController.snapshot()};

  })()`,8000);
  assert.equal(prepared.media.cameraOn,true);assert.equal(prepared.media.micOn,true);assert.equal(prepared.media.videoLive,true);assert.equal(prepared.media.audioLive,true);

  const shareKickoff=await main.eval(`(()=>{
    window.__qaShareStartError='';
    window.__qaShareStartPromise=window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false}})
      .catch(error=>{window.__qaShareStartError=String(error?.message||error||'share-start-failed');});
    return true;
  })()`);
  assert.equal(shareKickoff,true);
  console.log('QA_2042_STAGE share-kickoff-dispatched');

  // Once capture is active, the main meeting renderer is also the source of
  // presenter-camera frames. Do not probe that same renderer with CDP during
  // active sharing: doing so can interfere with the frame-mirror evaluate call
  // and create a false timeout. The native floating toolbar is the user-facing
  // control authority, so verify active-share state through that window.
  toolbar=new Cdp((await findTarget(url=>url.includes('mac-presenter-toolbar.html'),'floating presenter toolbar')).webSocketDebuggerUrl);await toolbar.connect();
  await toolbar.wait("window.DominionMacPresenterToolbar?.transport==='macShare-ack-first'&&document.querySelector('#stopShare')",'2.0.42 acknowledged toolbar');
  await toolbar.wait("window.DominionMacPresenterToolbar.state().sourceName==='QA Synthetic Share'",'synthetic share state on native toolbar',10000);
  console.log('QA_2042_STAGE native-toolbar-share-state');

  video=new Cdp((await findTarget(url=>url.includes('mac-share-video.html'),'floating participant video dock')).webSocketDebuggerUrl);await video.connect();
  await video.wait("document.querySelector('#dock')",'floating participant video dock');
  await video.wait("document.querySelector('#dock')?.dataset.livePreview==='1'&&String(document.querySelector('#cameraMirror')?.src||'').startsWith('data:image/jpeg')",'live presenter camera frame',8000);
  console.log('QA_2042_STAGE presenter-camera-live');

  const click=selector=>toolbar.eval(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw new Error('missing control');node.click();return true;})()`);
  const mainState=()=>main.eval(`(()=>({media:window.DominionMediaController.snapshot(),share:window.DominionShareIntegration.state(),meetingHidden:document.querySelector('#meetingOverlay').hidden,prejoinHidden:document.querySelector('#prejoinOverlay').hidden,appHidden:document.querySelector('#appShell').hidden,companion:String(document.body.dataset.dsShareCompanion||'')}))()`);

  for(let cycle=0;cycle<4;cycle+=1){
    await click('[data-command="audio"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().micOn===false",`audio mute ${cycle+1}`);
    await click('[data-command="audio"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().micOn===true",`audio unmute ${cycle+1}`);
    await click('[data-command="video"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().cameraOn===false",`video off ${cycle+1}`);
    await click('[data-command="video"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().cameraOn===true",`video on ${cycle+1}`);
    await click('[data-command="pause"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().paused===true",`pause ${cycle+1}`,14000);
    await click('[data-command="pause"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().paused===false",`resume ${cycle+1}`,14000);
    console.log(`QA_2042_STAGE control-cycle-${cycle+1}`);
  }
  await video.wait("document.querySelector('#dock')?.dataset.livePreview==='1'",'camera mirror recovered after repeated toggles',8000);
  console.log('QA_2042_STAGE repeated-controls-and-camera-recovery');

  await click('[data-command="layout-gallery"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().videoLayout==='gallery'",'Gallery presenter-video layout');
  await click('[data-command="layout-speaker"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().videoLayout==='speaker'",'Speaker presenter-video layout');

  await click('[data-command="show-meeting"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().meetingVisible===true",'Show meeting');
  await click('[data-command="show-meeting"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().meetingVisible===false",'Hide meeting back to presenter mode');
  console.log('QA_2042_STAGE layout-and-show-meeting');

  await click('[data-command="new-share"]');
  picker=new Cdp((await findTarget(url=>url.includes('/ui/share-picker.html'),'New Share chooser')).webSocketDebuggerUrl);await picker.connect();
  await picker.wait(`document.readyState==='complete'&&document.querySelector('[data-tab="screens"]')&&document.querySelector('#cancelTop')`,'New Share approved chooser');
  assert.equal((await toolbar.eval("window.DominionMacPresenterToolbar.state().sourceName")),'QA Synthetic Share','Opening New Share must retain the current share until a replacement is selected.');
  await picker.eval("document.querySelector('#cancelTop').click()");
  picker.close();picker=null;
  await toolbar.wait("window.DominionMacPresenterToolbar.state().sourceName==='QA Synthetic Share'",'current share retained after cancelling New Share');
  console.log('QA_2042_STAGE new-share-cancel-retained-current-share');

  await click('[data-command="participants"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().companion==='participants'",'Participants command');
  await click('[data-command="chat"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().companion==='chat'",'Chat command');
  await click('[data-command="annotate"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().annotating===true",'Annotate command');
  await click('[data-command="annotate"]');await toolbar.wait("window.DominionMacPresenterToolbar.state().annotating===false",'Annotate off');
  console.log('QA_2042_STAGE participants-chat-annotation');

  await click('#stopShare');
  await sleep(350);
  await main.wait("window.DominionShareIntegration.state().active===false",'Stop Share');
  await main.wait("document.querySelector('#meetingOverlay').hidden===false&&document.querySelector('#prejoinOverlay').hidden===true&&document.querySelector('#appShell').hidden===true",'return to live meeting after Stop Share');
  const stopped=await mainState();assert.equal(stopped.meetingHidden,false);assert.equal(stopped.prejoinHidden,true);assert.equal(stopped.appHidden,true);
  console.log('QA_2042_STAGE stop-returned-live-meeting');

  const reShareKickoff=await main.eval(`(()=>{
    window.__qaReShareError='';
    window.__qaReSharePromise=window.DominionShareController.start({name:'QA Synthetic Re-share',options:{shareAudio:false,optimizeVideo:false}})
      .catch(error=>{window.__qaReShareError=String(error?.message||error||'re-share-failed');});
    return true;
  })()`);
  assert.equal(reShareKickoff,true);
  await toolbar.wait("window.DominionMacPresenterToolbar.state().sourceName==='QA Synthetic Re-share'",'second share state on native toolbar',10000);
  await video.wait("document.querySelector('#dock')?.dataset.livePreview==='1'",'presenter video live after re-share',8000);
  console.log('QA_2042_STAGE reshared-without-relaunch');
  await click('#stopShare');
  await sleep(350);
  await main.wait("window.DominionShareIntegration.state().active===false",'second Stop Share');
  console.log('QA_2042_STAGE second-stop-complete');

  console.log('DOMINIONSTAR_PACKAGED_SHARE_CONTROLS_RECOVERY_2_0_42_OK acknowledged-toolbar 4x-mute-unmute 4x-video-off-on 4x-pause-resume layout show-meeting new-share-cancel participants chat annotate stop-return re-share second-stop camera-mirror-live');
}catch(error){
  failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());
}finally{
  picker?.close();video?.close();toolbar?.close();main?.close();
  if(child.exitCode===null){try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
}
if(failure)throw failure;
