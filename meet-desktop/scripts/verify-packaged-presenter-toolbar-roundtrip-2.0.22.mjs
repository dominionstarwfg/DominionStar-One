import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-presenter-toolbar-roundtrip-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10880+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stage=name=>console.log('PRESENTER_STAGE_OK '+name);
let stderr='';
const child=spawn(executable,['--remote-debugging-port='+port,'--remote-allow-origins=*','--use-fake-ui-for-media-stream'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function listTargets(){
  const response=await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(900)});
  return response.json();
}
async function waitTarget(predicate,label,timeout=16000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error('Packaged app exited while waiting for '+label+'.\n'+stderr);
    try{
      const targets=await listTargets();
      const target=targets.find(item=>item.type==='page'&&predicate(item));
      if(target?.webSocketDebuggerUrl)return target;
    }catch{}
    await sleep(120);
  }
  throw new Error('Timed out waiting for '+label+'.\n'+stderr);
}
class Cdp{
  constructor(url){this.url=url;this.socket=null;this.nextId=0;this.pending=new Map();}
  async connect(){
    this.socket=await new Promise((resolve,reject)=>{
      const socket=new WebSocket(this.url);
      const timer=setTimeout(()=>reject(new Error('CDP connect timeout')),5000);
      socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
      socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connect failed'));},{once:true});
    });
    this.socket.addEventListener('message',event=>{
      const message=JSON.parse(String(event.data));
      if(!message.id)return;
      const waiter=this.pending.get(message.id);
      if(!waiter)return;
      this.pending.delete(message.id);clearTimeout(waiter.timer);
      message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);
    });
    await this.call('Runtime.enable');
  }
  call(method,params={},timeout=8000){
    return new Promise((resolve,reject)=>{
      const id=++this.nextId;
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout '+method));},timeout);
      this.pending.set(id,{resolve,reject,timer});
      this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  async eval(expression,timeout=8000){
    const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');
    return result.result?.value;
  }
  async wait(expression,label,timeout=9000){
    const deadline=Date.now()+timeout;let last='';
    while(Date.now()<deadline){
      if(child.exitCode!==null)throw new Error('Packaged app exited before '+label+'.\n'+stderr);
      try{if(await this.eval('Boolean('+expression+')',2500))return;}catch(error){last=String(error?.message||error);}
      await sleep(90);
    }
    throw new Error('Timed out waiting for '+label+(last?': '+last:'')+'.\n'+stderr);
  }
  async click(selector){
    await this.eval("document.querySelector('#toolbar')?.classList.remove('auto-hidden'); true");
    const point=await this.eval('(()=>{const el=document.querySelector('+JSON.stringify(selector)+');if(!el)throw new Error("Missing control");const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
    await this.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y,button:'none'});
    await this.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
    await this.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  }
  close(){try{this.socket?.close();}catch{}}
}

async function setupRenderer(skipShareLayout=false){
  window.__DOMINION_QA_SKIP_SHARE_LAYOUT=Boolean(skipShareLayout);
  window.__DOMINION_QA_SUPPRESS_SHARE_LISTENERS=Boolean(skipShareLayout);
  document.querySelector('#bootScreen').hidden=true;
  document.querySelector('#authGate').hidden=true;
  document.querySelector('#appShell').hidden=true;
  document.querySelector('#prejoinOverlay').hidden=true;
  document.querySelector('#waitingOverlay').hidden=true;
  const overlay=document.querySelector('#meetingOverlay');
  overlay.hidden=false;overlay.dataset.viewMode='speaker';
  const role=document.querySelector('#roomRole');if(role)role.textContent='Host';
  window.DominionMeetingParity.install();
  window.DominionMeetingFeatures.toggleChat(false);
  window.DominionRuntimeStability.sync();
  window.DominionRuntimeStability.ensureToolbarZones();

  const shareCanvas=document.createElement('canvas');shareCanvas.width=640;shareCanvas.height=360;
  const shareContext=shareCanvas.getContext('2d',{alpha:false});
  shareContext.fillStyle='#07111f';shareContext.fillRect(0,0,640,360);
  shareContext.fillStyle='#d6b25e';shareContext.fillRect(80,80,180,120);
  shareContext.fillStyle='#fff';shareContext.font='28px sans-serif';shareContext.fillText('DominionStar QA Share',40,260);
  const displayMaster=shareCanvas.captureStream(15);

  const cameraCanvas=document.createElement('canvas');cameraCanvas.width=640;cameraCanvas.height=360;
  const cameraContext=cameraCanvas.getContext('2d',{alpha:false});
  cameraContext.fillStyle='#112a3f';cameraContext.fillRect(0,0,640,360);
  cameraContext.fillStyle='#f0c769';cameraContext.beginPath();cameraContext.arc(320,180,90,0,Math.PI*2);cameraContext.fill();
  cameraContext.fillStyle='#fff';cameraContext.font='24px sans-serif';cameraContext.fillText('LIVE CAMERA',240,190);
  const cameraMaster=cameraCanvas.captureStream(8);

  const audioContext=new AudioContext();
  const audioDestination=audioContext.createMediaStreamDestination();
  Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>displayMaster.clone()});
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{
    const tracks=[];
    if(constraints?.video){const track=cameraMaster.getVideoTracks()[0]?.clone();if(track)tracks.push(track);}
    if(constraints?.audio){const track=audioDestination.stream.getAudioTracks()[0]?.clone();if(track)tracks.push(track);}
    return new MediaStream(tracks);
  }});
  Object.defineProperty(window,'ImageCapture',{configurable:true,value:class{async grabFrame(){return createImageBitmap(cameraCanvas);}}});

  // Match the production sequence exactly: native presenter surfaces are
  // constructed while the meeting renderer is idle, before display capture
  // begins. Creating BrowserWindows after capture starts is a separate macOS
  // compositor hazard and is not how DominionStar enters sharing.
  const nativePrepared=await window.dominionDesktop?.macShare?.prepare?.();
  if(!nativePrepared?.ok)throw new Error('Native presenter surfaces did not pre-prepare before capture.');

  // Do not call startPreview in the headless Mac gate: its device
  // enumeration can block even when getUserMedia is stubbed. Seed the real
  // MediaController stream directly, then emit through a normal controller
  // preference mutation so app.js attaches the live track to its video surfaces.
  await window.DominionMediaController.setCamera(false);
  window.DominionMediaController.resetPreferences();
  const cameraTrack=cameraMaster.getVideoTracks()[0]?.clone();
  if(!cameraTrack)throw new Error('Synthetic live camera track is unavailable.');
  window.DominionMediaController.stream().addTrack(cameraTrack);
  window.DominionMediaController.setMirror(true);
  const mediaState=window.DominionMediaController.snapshot();
  if(!mediaState.videoLive||!mediaState.cameraOn)throw new Error('Synthetic live camera did not initialize.');
  setTimeout(()=>{
    void (async()=>{
      try{
        if(skipShareLayout){
          // Controller isolation with every applyLayout entry point disabled.
          console.error('QA_CONTROLLER_NO_LAYOUT_BEGIN');
          const state=await window.DominionShareController.start({name:'QA Controller No Layout',options:{shareAudio:false,optimizeVideo:false}});
          console.error('QA_CONTROLLER_NO_LAYOUT_READY active='+(state.active?1:0));
          return;
        }
        console.error('QA_REAL_PRESENTER_SHARE_BEGIN');
        const shareState=await window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false}});
        window.DominionShareIntegration.commitPresenterMode();
        console.error('QA_REAL_PRESENTER_SHARE_READY active='+(shareState.active?1:0));
      }catch(error){console.error((skipShareLayout?'QA_RAW_DISPLAY_FAILURE ':'QA_REAL_PRESENTER_SHARE_FAILURE ')+String(error?.stack||error));}
    })();
  },30);
  return {
    cameraOn:window.DominionMediaController.snapshot().cameraOn,
    videoLive:window.DominionMediaController.snapshot().videoLive,
    micOn:window.DominionMediaController.snapshot().micOn,
    chatReady:Boolean(document.querySelector('#meetingChatPanel'))
  };
}

let main=null,toolbar=null,video=null;
try{
  const mainTarget=await waitTarget(item=>String(item.url||'').includes('/ui/index.html'),'main meeting renderer');
  main=new Cdp(mainTarget.webSocketDebuggerUrl);await main.connect();stage('main-connected');
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.DominionRuntimeStability&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionShareAnnotation&&window.DominionMediaController",'meeting/share controllers',15000);
  stage('controllers-loaded');

  const skipShareLayout=process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1';
  const prepared=await main.eval('('+setupRenderer.toString()+')('+JSON.stringify(skipShareLayout)+')',15000);
  assert.equal(prepared.cameraOn,true);
  assert.equal(prepared.videoLive,true);
  assert.equal(prepared.micOn,false);
  assert.equal(prepared.chatReady,true);
  stage('live-camera-prepared');
  if(process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1'){
    await main.wait("window.DominionShareController.snapshot().active===true",'controller share activation with layout disabled',10000);
    stage('controller-no-layout-share-started');
    await sleep(3600);
    const health=await main.eval("(()=>({active:window.DominionShareController.snapshot().active,media:Boolean(window.DominionMediaController),skip:Boolean(window.__DOMINION_QA_SKIP_SHARE_LAYOUT),now:Date.now()}))()",5000);
    assert.equal(health.active,true,'No-layout controller diagnostic lost active share state.');
    assert.equal(health.media,true,'No-layout controller diagnostic lost media controller.');
    assert.equal(health.skip,true,'No-layout controller diagnostic lost its layout suppression flag.');
    stage('controller-no-layout-renderer-remained-responsive');
    console.log('DOMINIONSTAR_CONTROLLER_NO_LISTENER_LIVENESS_OK share-controller capture-started listeners-suppressed no-layout no-window-park');
    main.close();
    if(child.exitCode===null)child.kill('SIGTERM');
    await sleep(1000);
    process.exit(0);
  }

  await main.wait("window.DominionShareController.snapshot().active===true",'synthetic share activation',10000);
  stage('share-started');

  // Wait beyond the physical-Mac startup parking interval. The exact controls
  // below must still mutate the capture-owning renderer after it is parked.
  await sleep(2700);

  const toolbarTarget=await waitTarget(item=>String(item.url||'').includes('/ui/mac-presenter-toolbar.html'),'actual floating Mac presenter toolbar');
  toolbar=new Cdp(toolbarTarget.webSocketDebuggerUrl);await toolbar.connect();
  await toolbar.wait("window.DominionMacPresenterToolbar&&document.querySelector('[data-command=\"audio\"]')",'floating toolbar runtime');
  stage('real-floating-toolbar-connected');

  const videoTarget=await waitTarget(item=>String(item.url||'').includes('/ui/mac-share-video.html'),'floating presenter video panel');
  video=new Cdp(videoTarget.webSocketDebuggerUrl);await video.connect();
  await video.wait("document.querySelector('#dock')?.dataset.livePreview==='1'&&!document.querySelector('#cameraMirror')?.hidden",'live camera frame in presenter video',9000);
  const liveVideo=await video.eval("(()=>({live:document.querySelector('#dock').dataset.livePreview,mirrorHidden:document.querySelector('#cameraMirror').hidden,fallbackHidden:document.querySelector('#cameraFallback').hidden,src:String(document.querySelector('#cameraMirror').src||'').slice(0,22)}))()");
  assert.equal(liveVideo.live,'1');
  assert.equal(liveVideo.mirrorHidden,false);
  assert.equal(liveVideo.fallbackHidden,true);
  assert.ok(liveVideo.src.startsWith('blob:')||liveVideo.src.startsWith('data:image/jpeg'),'Presenter video must receive a real mirrored camera frame.');
  stage('presenter-video-live');

  await toolbar.wait("document.querySelector('[data-command=\"audio\"]')?.classList.contains('is-off')&&document.querySelector('#audioLabel')?.textContent==='Unmute'",'initial muted toolbar state');
  await toolbar.click('[data-command="audio"]');
  await main.wait("window.DominionMediaController.snapshot().micOn===true&&!document.querySelector('#roomMic')?.classList.contains('is-off')",'floating Audio command changed real media and canonical UI',8000);
  await toolbar.wait("!document.querySelector('[data-command=\"audio\"]')?.classList.contains('is-off')&&document.querySelector('#audioLabel')?.textContent==='Mute'",'floating Audio visual state');
  stage('audio-real-toolbar');

  await toolbar.click('[data-command="video"]');
  await main.wait("window.DominionMediaController.snapshot().cameraOn===false&&document.querySelector('#roomCamera')?.classList.contains('is-off')",'floating Video command changed real media and canonical UI',8000);
  await toolbar.wait("document.querySelector('[data-command=\"video\"]')?.classList.contains('is-off')&&document.querySelector('#videoLabel')?.textContent==='Start Video'",'floating Video visual state');
  await video.wait("document.querySelector('#dock')?.dataset.cameraOn==='0'&&!document.querySelector('#cameraFallback')?.hidden",'presenter panel camera-off fallback',6000);
  const fallbackWidth=await video.eval("Math.round(document.querySelector('#profileInitials').getBoundingClientRect().width)");
  assert.ok(fallbackWidth>=100,'Presenter camera-off profile fallback is still undersized: '+fallbackWidth+'px');
  stage('video-real-toolbar');

  await toolbar.click('[data-command="pause"]');
  await main.wait("window.DominionShareController.snapshot().paused===true",'real floating Pause command',8000);
  await toolbar.wait("document.querySelector('#pauseLabel')?.textContent==='Resume'",'Pause label switched to Resume');
  stage('pause-real-toolbar');

  await toolbar.click('[data-command="pause"]');
  await main.wait("window.DominionShareController.snapshot().paused===false",'real floating Resume command',8000);
  await toolbar.wait("document.querySelector('#pauseLabel')?.textContent==='Pause'",'Resume label switched to Pause');
  stage('resume-real-toolbar');

  await toolbar.click('[data-command="participants"]');
  await main.wait("document.body.dataset.dsShareCompanion==='participants'&&document.querySelector('.room-side')?.hidden===false",'real floating Participants command',8000);
  stage('participants-real-toolbar');
  await main.eval("window.DominionRuntimeStability.setParticipants(false)");
  await main.wait("!document.body.dataset.dsShareCompanion",'Participants companion closure synchronized',8000);

  await toolbar.click('[data-command="chat"]');
  await main.wait("document.body.dataset.dsShareCompanion==='chat'&&document.querySelector('#meetingChatPanel')?.hidden===false",'real floating Chat command',8000);
  stage('chat-real-toolbar');
  await main.eval("window.DominionRuntimeStability.setChat(false)");
  await main.wait("!document.body.dataset.dsShareCompanion",'Chat companion closure synchronized',8000);

  await toolbar.click('[data-command="annotate"]');
  await main.wait("window.DominionShareAnnotation.snapshot().active===true&&document.body.dataset.dsShareCompanion==='annotate'",'real floating Annotate command',8000);
  stage('annotate-real-toolbar');
  await toolbar.click('[data-command="annotate"]');
  await main.wait("window.DominionShareAnnotation.snapshot().active===false&&!document.body.dataset.dsShareCompanion",'real floating Annotate close command',8000);
  stage('annotate-close-real-toolbar');

  await toolbar.click('[data-command="new-share"]');
  await waitTarget(item=>String(item.url||'').includes('/ui/share-picker.html'),'New Share picker from floating toolbar',8000);
  await main.eval("window.dominionDesktop.sharePicker.cancel()");
  stage('new-share-real-toolbar');

  await toolbar.click('#stopShare');
  await main.wait("window.DominionShareController.snapshot().active===false",'real floating Stop Share command',10000);
  await main.wait("document.querySelector('#meetingOverlay')?.classList.contains('share-active')===false",'meeting restored after Stop Share',6000);
  stage('stop-share-real-toolbar');

  assert.equal(child.exitCode,null,'Packaged app exited during physical presenter control loop.');
  console.log('DOMINIONSTAR_PACKAGED_MAC_PRESENTER_CONTROL_LOOP_2_0_44_OK actual-floating-toolbar cdp-pointer-clicks parked-renderer audio video pause resume participants chat annotate new-share stop-share live-camera-panel canonical-av-state');
}catch(error){
  console.error('PRESENTER_STAGE_FAILURE',error);
  console.error(stderr);
  process.exitCode=1;
}finally{
  video?.close();toolbar?.close();main?.close();
  if(child.exitCode===null)child.kill('SIGTERM');
  await sleep(1800);
  if(child.exitCode===null)child.kill('SIGKILL');
}
