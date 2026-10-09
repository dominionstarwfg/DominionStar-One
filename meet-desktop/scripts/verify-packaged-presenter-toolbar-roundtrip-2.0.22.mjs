import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-presenter-toolbar-roundtrip-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10880+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stage=name=>console.log('PRESENTER_STAGE_OK '+name);
async function waitStderr(match,label,timeout=8000,startAt=0){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const hay=stderr.slice(startAt);
    if(typeof match==='string'?hay.includes(match):match.test(hay))return hay;
    if(child.exitCode!==null)throw new Error('Packaged app exited while waiting for '+label+'.\n'+stderr);
    await sleep(80);
  }
  throw new Error('Timed out waiting for '+label+'.\n'+stderr);
}
const ackPattern=command=>new RegExp('QA_MAC_PRESENTER_ACK\\s+delivery=\\d+\\s+command='+command+'\\s+accepted=1');
async function terminatePackagedApp(){
  if(child.exitCode!==null)return;
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{child.kill('SIGTERM');}catch{}
  await Promise.race([exited,sleep(2200)]);
  if(child.exitCode===null){
    try{child.kill('SIGKILL');}catch{}
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1200)]);
  }
}
let stderr='';
const qaUserData=path.join('/tmp','dominionstar-presenter-qa-'+process.pid+'-'+port);
const child=spawn(executable,['--user-data-dir='+qaUserData,'--remote-debugging-port='+port,'--remote-allow-origins=*','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1',DOMINIONSTAR_QA_DEFER_MAC_PRESENTER_SHOW:'1'},
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
    const hasPresenterToolbar=await this.eval("Boolean(document.querySelector('#toolbar'))");
    if(hasPresenterToolbar){
      // Exercise the same reveal path as a real pointer entering the collapsed
      // native toolbar. CSS visibility is not enough: wait until the macOS
      // BrowserWindow has physically expanded before hit-testing any control.
      await this.eval("window.dispatchEvent(new PointerEvent('pointerenter')); true");
      await this.wait("window.innerHeight>=80&&!document.querySelector('#toolbar')?.classList.contains('auto-hidden')",'native presenter toolbar reveal before click',2500);
    }
    const selectorJson=JSON.stringify(selector);
    await this.wait('(()=>{const el=document.querySelector('+selectorJson+');if(!el||el.disabled||el.getAttribute("aria-busy")==="true")return false;const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return r.width>0&&r.height>0&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&Boolean(hit&&(hit===el||el.contains(hit)));})()','hit-testable control '+selector,2500);
    let point=await this.eval('(()=>{const el=document.querySelector('+selectorJson+');if(!el)throw new Error("Missing control");const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
    await this.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y,button:'none'});
    await sleep(70);
    // Pointer movement can reveal/reflow native presenter chrome. Re-measure
    // after that transition so the press/release land on the current control.
    point=await this.eval('(()=>{const el=document.querySelector('+selectorJson+');if(!el)throw new Error("Missing control");const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);if(!hit||!(hit===el||el.contains(hit)))throw new Error("Control lost hit-test ownership");return {x,y};})()');
    await this.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
    await this.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  }
  close(){try{this.socket?.close();}catch{}}
}

async function setupRenderer(skipShareLayout=false,diagnosticMode=''){
  const diagnostic=String(diagnosticMode||'');
  window.__DOMINION_QA_SKIP_SHARE_LAYOUT=Boolean(skipShareLayout);
  window.__DOMINION_QA_SUPPRESS_SHARE_LISTENERS=Boolean(skipShareLayout||diagnostic);
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

  // Fail immediately if the meeting renderer tries to own display capture.
  // The dedicated capture worker is the only Mac ScreenCaptureKit authority.
  Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>{throw new Error('meeting_renderer_display_capture_forbidden');}});

  const cameraCanvas=document.createElement('canvas');cameraCanvas.width=640;cameraCanvas.height=360;
  const cameraContext=cameraCanvas.getContext('2d',{alpha:false});
  cameraContext.fillStyle='#112a3f';cameraContext.fillRect(0,0,640,360);
  cameraContext.fillStyle='#f0c769';cameraContext.beginPath();cameraContext.arc(320,180,90,0,Math.PI*2);cameraContext.fill();
  cameraContext.fillStyle='#fff';cameraContext.font='24px sans-serif';cameraContext.fillText('LIVE CAMERA',240,190);
  const cameraMaster=cameraCanvas.captureStream(8);

  const audioContext=new AudioContext();
  const audioDestination=audioContext.createMediaStreamDestination();
  const qaVoiceOscillator=audioContext.createOscillator(),qaVoiceGain=audioContext.createGain();
  qaVoiceOscillator.frequency.value=220;qaVoiceGain.gain.value=0;
  qaVoiceOscillator.connect(qaVoiceGain);qaVoiceGain.connect(audioDestination);qaVoiceOscillator.start();
  void audioContext.resume().catch(()=>{});
  window.__DOMINION_QA_VOICE_GAIN=qaVoiceGain;
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
          // Hidden-surface preflight deliberately does not start the synthetic
          // canvas display stream. Electron's macOS runner can starve isolated
          // worlds on CanvasCaptureMediaStream even though production
          // ScreenCaptureKit is not using that path. The authoritative active-
          // share test is the non-hidden presenter ACK loop below.
          console.error('QA_HIDDEN_PRESENTER_PREFLIGHT_READY');
          return;
        }
        if(diagnostic==='worker-prepare-only'){
          const prepared=await window.dominionDesktop?.shareCapture?.qaPrepare?.();
          if(!prepared?.ok)throw new Error(prepared?.error||'QA worker prepare failed.');
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=worker-prepare-only active=prepared');
          return;
        }
        if(diagnostic==='worker-message-only'){
          const sent=await window.dominionDesktop?.shareCapture?.qaMessageOnly?.();
          if(!sent?.ok)throw new Error(sent?.error||'QA worker message probe failed.');
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=worker-message-only active=message-only');
          return;
        }
        if(diagnostic==='worker-detached-lifecycle'){
          const sent=await window.dominionDesktop?.shareCapture?.qaDetachedLifecycle?.();
          if(!sent?.ok)throw new Error(sent?.error||'QA detached lifecycle probe failed.');
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=worker-detached-lifecycle active=detached');
          return;
        }
        if(diagnostic==='worker-ack-only'){
          const started=await window.dominionDesktop?.shareCapture?.start?.({qaLifecycleOnly:true});
          if(!started?.ok)throw new Error(started?.error||'QA acknowledged worker lifecycle failed.');
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=worker-ack-only active=acknowledged');
          return;
        }
        if(diagnostic==='worker-ack-with-listeners'){
          const offError=window.dominionDesktop?.shareCapture?.onError?.(()=>{});
          const offStopped=window.dominionDesktop?.shareCapture?.onStopped?.(()=>{});
          const started=await window.dominionDesktop?.shareCapture?.start?.({qaLifecycleOnly:true});
          if(!started?.ok)throw new Error(started?.error||'QA acknowledged worker lifecycle with listeners failed.');
          window.__DOMINION_QA_CAPTURE_LISTENER_CLEANUP=()=>{try{offError?.();}catch{}try{offStopped?.();}catch{}};
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=worker-ack-with-listeners active=acknowledged');
          return;
        }
        if(diagnostic==='controller-after-acquire'){
          const shareState=await window.DominionShareController.start({
            name:'QA Controller After Acquire',
            options:{shareAudio:false,optimizeVideo:false,__qaLifecycleOnlyWorker:true,__qaReturnAfterAcquire:true}
          });
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=controller-after-acquire active='+(shareState.active?1:0));
          return;
        }
        if(diagnostic==='controller-before-worker-active'){
          const shareState=await window.DominionShareController.start({
            name:'QA Controller Before Worker Active',
            options:{shareAudio:false,optimizeVideo:false,__qaLifecycleOnlyWorker:true,__qaReturnBeforeWorkerActivate:true,__qaReturnAfterAcquire:true}
          });
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=controller-before-worker-active active='+(shareState.active?1:0));
          return;
        }
        if(diagnostic==='controller-worker-no-handshake'){
          const shareState=await window.DominionShareController.start({
            name:'QA Controller Worker No Handshake',
            options:{shareAudio:false,optimizeVideo:false,__qaLifecycleOnlyWorker:true,__qaSkipPresenterHandshake:true}
          });
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=controller-worker-no-handshake active='+(shareState.active?1:0));
          return;
        }
        if(diagnostic==='capture-event-only'){
          window.dominionDesktop?.share?.captureStarted?.({sourceName:'QA Capture Event Only',displayId:'',paused:false});
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode=capture-event-only active=event-only');
          return;
        }
        if(diagnostic==='worker-only'||diagnostic==='worker-plus-event'||diagnostic==='worker-plus-event-plus-state'){
          const options={shareAudio:false,optimizeVideo:false,__qaLifecycleOnlyWorker:true};
          if(diagnostic==='worker-only')options.__qaSkipCaptureStarted=true;
          const shareState=await window.DominionShareController.start({name:'QA '+diagnostic,options});
          if(diagnostic==='worker-plus-event-plus-state'){
            await window.dominionDesktop?.share?.captureState?.({
              paused:false,micOn:false,cameraOn:true,cameraId:'',mirror:true,
              sourceName:'QA State Sync',shareAudio:false,optimizeVideo:false,
              handRaised:false,recording:false,recordingPaused:false,companion:'',companionOpen:false
            });
          }
          console.error('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode='+diagnostic+' active='+(shareState.active?1:0));
          return;
        }
        console.error('QA_REAL_PRESENTER_SHARE_BEGIN');
        const shareState=await window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false,__qaSyntheticWorker:true}});
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
  const diagnosticMode=String(process.env.DOMINIONSTAR_QA_ACTIVE_SHARE_DIAGNOSTIC||'');
  const prepared=await main.eval('('+setupRenderer.toString()+')('+JSON.stringify(skipShareLayout)+','+JSON.stringify(diagnosticMode)+')',15000);
  assert.equal(prepared.cameraOn,true);
  assert.equal(prepared.videoLive,true);
  assert.equal(prepared.micOn,false);
  assert.equal(prepared.chatReady,true);
  stage('live-camera-prepared');
  if(diagnosticMode){
    await waitStderr('QA_ACTIVE_SHARE_DIAGNOSTIC_READY mode='+diagnosticMode,'active-share diagnostic '+diagnosticMode,10000);
    let responsive=false,error='';
    try{
      await sleep(550);
      const result=await main.eval("(()=>({ready:document.readyState,dispatcher:typeof window.__DominionPresenterDispatch==='function'}))()",2500);
      responsive=result?.ready==='complete'&&result?.dispatcher===true;
    }catch(reason){error=String(reason?.message||reason||'probe-failed').replace(/\s+/g,'_');}
    console.log('DOMINIONSTAR_ACTIVE_SHARE_DIAGNOSTIC_RESULT mode='+diagnosticMode+' responsive='+(responsive?1:0)+(error?' error='+error:''));
    main.close();
    await terminatePackagedApp();
    process.exit(0);
  }
  if(process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1'){
    await waitStderr('QA_HIDDEN_PRESENTER_PREFLIGHT_READY','hidden presenter preflight marker',5000);
    await waitStderr(/QA_PRESENTER_RENDERER_PULSE accepted=1 index=(1|2)/,'renderer preload heartbeat with presenter surfaces hidden',6000);
    stage('hidden-presenter-preflight-responsive');
    console.log('DOMINIONSTAR_HIDDEN_PRESENTER_PREFLIGHT_OK controllers-loaded renderer-process-heartbeat no-synthetic-canvas-capture');
    main.close();
    await terminatePackagedApp();
    process.exit(0);
  }

  await waitStderr('QA_REAL_PRESENTER_SHARE_READY active=1','synthetic share activation',10000);
  stage('share-started');
  const rendererShareChrome=await main.eval("(()=>({inlineHidden:document.querySelector('#inlinePresenterToolbar')?.hidden!==false,labelHidden:document.querySelector('#shareStageLabel')?.hidden!==false,shareActive:document.querySelector('#meetingOverlay')?.classList.contains('share-active')===true}))()");
  assert.equal(rendererShareChrome.inlineHidden,true,'Legacy inline presenter toolbar is visible during native Mac sharing.');
  assert.equal(rendererShareChrome.labelHidden,true,'Legacy renderer share-status label is visible during native Mac sharing.');
  assert.equal(rendererShareChrome.shareActive,false,'Meeting renderer entered legacy share-active layout during native Mac presenter mode.');
  stage('legacy-share-chrome-suppressed');
  await sleep(1500);
  const delayedRendererChrome=await main.eval("(()=>{const shell=document.querySelector('#meetingOverlay>.meeting-shell');const footer=document.querySelector('#meetingOverlay .meeting-footer');const appShell=document.querySelector('#appShell');const appStyle=appShell?getComputedStyle(appShell):null;return {native:document.body.classList.contains('ds-native-mac-presenter-share'),shareActive:document.querySelector('#meetingOverlay')?.classList.contains('share-active')===true,inlineHidden:document.querySelector('#inlinePresenterToolbar')?.hidden!==false,banner:Boolean(document.querySelector('.ds-ref-share-banner')),shellVisibility:shell?getComputedStyle(shell).visibility:'missing',footerDisplay:footer?getComputedStyle(footer).display:'missing',bodyBackground:getComputedStyle(document.body).backgroundColor,appShellVisibility:appStyle?.visibility||'missing',appShellOpacity:appStyle?.opacity||'missing'};})()");
  assert.equal(delayedRendererChrome.native,true,'Native Mac presenter visual authority disappeared after final-reference reconciliation.');
  assert.equal(delayedRendererChrome.shareActive,false,'Final-reference reconciliation recreated legacy share-active state.');
  assert.equal(delayedRendererChrome.inlineHidden,true,'Final-reference reconciliation recreated the inline share toolbar.');
  assert.equal(delayedRendererChrome.banner,false,'Final-reference reconciliation recreated the duplicate green share banner.');
  assert.equal(delayedRendererChrome.shellVisibility,'hidden','Dark meeting shell is still physically visible behind native sharing.');
  assert.ok(/rgba\(0, 0, 0, 0\)|transparent/i.test(String(delayedRendererChrome.bodyBackground)),'Meeting renderer body is not transparent during native Mac share: '+delayedRendererChrome.bodyBackground);
  assert.equal(delayedRendererChrome.appShellVisibility,'hidden','DominionStar application workspace remains visible behind the shared desktop.');
  assert.ok(Number(delayedRendererChrome.appShellOpacity)===0,'DominionStar application workspace did not become visually transparent during native share.');
  stage('full-app-shell-suppressed');
  stage('delayed-share-reconciliation-clean');

  // Follow the physical user path after share activation. Hidden/occluded
  // renderer timers are not a reliable macOS liveness oracle: Chromium may
  // throttle those timers even while the real presenter IPC path remains
  // functional. Reveal the actual DominionStar presenter surface, then let the
  // first real control ACK prove whether the meeting renderer is responsive.
  // A genuinely stalled renderer still fails immediately on the Audio command
  // below, so this does not weaken the runtime gate.
  const probeMeetingRenderer=async label=>{
    await sleep(350);
    const result=await main.eval("(()=>({ready:document.readyState,dispatcher:typeof window.__DominionPresenterDispatch==='function',stamp:Date.now()}))()",2500);
    assert.equal(result?.ready,'complete',label+' changed meeting renderer readiness.');
    assert.equal(result?.dispatcher,true,label+' lost presenter dispatcher.');
    stage(label+'-main-responsive');
  };

  const toolbarReveal=await main.eval("window.dominionDesktop?.macShare?.qaRevealStage?.('toolbar')");
  assert.equal(toolbarReveal?.ok,true,'Native presenter toolbar did not reveal on command.');
  await waitStderr(/QA_MAC_PRESENTER_PROCESS_BOUNDARY mainPid=\d+ toolbarPid=\d+ videoPid=\d+ isolated=1/,'isolated presenter renderer process boundary',6000);
  stage('presenter-toolbar-revealed');
  stage('presenter-processes-isolated');
  await probeMeetingRenderer('toolbar-reveal');

  const videoReveal=await main.eval("window.dominionDesktop?.macShare?.qaRevealStage?.('video')");
  assert.equal(videoReveal?.ok,true,'Native presenter video surface did not reveal on command.');
  stage('presenter-video-revealed');
  await probeMeetingRenderer('video-reveal');

  const borderReveal=await main.eval("window.dominionDesktop?.macShare?.qaRevealStage?.('border')");
  assert.equal(borderReveal?.ok,true,'Native share perimeter stage did not complete.');
  stage('presenter-perimeter-revealed');
  await probeMeetingRenderer('perimeter-reveal');
  stage('presenter-revealed-after-share');
  main.close();main=null;

  const presenterTargets=await listTargets();
  const nativeToolbarTargets=presenterTargets.filter(item=>item.type==='page'&&String(item.url||'').includes('/ui/mac-presenter-toolbar.html'));
  const legacyToolbarTargets=presenterTargets.filter(item=>item.type==='page'&&String(item.url||'').includes('/ui/presenter-toolbar.html'));
  assert.equal(nativeToolbarTargets.length,1,'Exactly one native Mac presenter toolbar must exist.');
  assert.equal(legacyToolbarTargets.length,0,'Legacy presenter-toolbar window must not coexist with native Mac presenter toolbar.');
  stage('single-presenter-toolbar');

  const toolbarTarget=await waitTarget(item=>String(item.url||'').includes('/ui/mac-presenter-toolbar.html'),'actual floating Mac presenter toolbar');
  toolbar=new Cdp(toolbarTarget.webSocketDebuggerUrl);await toolbar.connect();
  await toolbar.wait("window.DominionMacPresenterToolbar&&document.querySelector('[data-command=\"audio\"]')",'floating toolbar runtime');
  stage('real-floating-toolbar-connected');

  const videoTarget=await waitTarget(item=>String(item.url||'').includes('/ui/mac-share-video.html'),'floating presenter video panel');
  video=new Cdp(videoTarget.webSocketDebuggerUrl);await video.connect();
  await video.wait("(()=>{const tile=document.querySelector('.video-tile[data-self=\"1\"]'),preview=tile?.querySelector('video'),fallback=tile?.querySelector('.video-fallback'),track=preview?.srcObject?.getVideoTracks?.()[0];return Boolean(tile&&preview&&!preview.hidden&&fallback?.hidden&&track?.readyState==='live');})()", 'live camera preview in presenter video',9000);
  const liveVideo=await video.eval("(()=>{const tile=document.querySelector('.video-tile[data-self=\"1\"]'),preview=tile?.querySelector('video'),fallback=tile?.querySelector('.video-fallback'),track=preview?.srcObject?.getVideoTracks?.()[0];return {previewHidden:Boolean(preview?.hidden),fallbackHidden:Boolean(fallback?.hidden),trackState:track?.readyState||''};})()");
  assert.equal(liveVideo.previewHidden,false);
  assert.equal(liveVideo.fallbackHidden,true);
  assert.equal(liveVideo.trackState,'live','Presenter video must own a live preview track while camera state is on.');
  stage('presenter-video-live');

  await video.wait("document.querySelector('.video-tile[data-self=\"1\"] [data-video-primary]')&&document.querySelector('.video-tile[data-self=\"1\"] [data-video-more]')&&document.querySelector('#videoActionMenu')",'presenter video hover-controls shell',5000);
  await video.click('.video-tile[data-self="1"] [data-video-more]');
  await video.wait("document.querySelector('#videoActionMenu')?.hidden===false",'presenter video quick-controls open',4000);
  const videoMenuLabels=await video.eval("[...document.querySelectorAll('#videoActionMenu button')].map(button=>button.textContent.trim())");
  assert.deepEqual(videoMenuLabels,['Unmute','Stop Video','Speaker View','Participant Strip','Gallery View','Hide Video Panel'],'Presenter video quick controls are incomplete or mislabeled.');
  await video.eval("document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  await video.wait("document.querySelector('#videoActionMenu')?.hidden===true",'presenter video quick-controls dismiss on outside interaction',4000);
  stage('presenter-video-hover-controls');

  await toolbar.wait("document.querySelector('[data-command=\"audio\"]')?.classList.contains('is-off')&&document.querySelector('#audioLabel')?.textContent==='Unmute'",'initial muted toolbar state');
  let logStart=stderr.length;
  await toolbar.click('[data-command="audio"]');
  await waitStderr(ackPattern('audio-on'),'renderer ACK for Audio',8000,logStart);
  await toolbar.wait("window.DominionMacPresenterToolbar.state().micOn===true&&!document.querySelector('[data-command=\"audio\"]')?.classList.contains('is-off')&&document.querySelector('#audioLabel')?.textContent==='Mute'",'floating Audio state synchronized from real media',8000);
  stage('audio-real-toolbar');

  const voiceMainTarget=await waitTarget(item=>String(item.url||'').includes('/ui/index.html'),'meeting renderer for microphone-level bridge');
  const voiceMain=new Cdp(voiceMainTarget.webSocketDebuggerUrl);await voiceMain.connect();
  assert.equal(await voiceMain.eval("(()=>{if(!window.DominionShareIntegration||!window.DominionShareController?.snapshot?.().active||!window.__DOMINION_QA_VOICE_GAIN)return false;window.__DOMINION_QA_VOICE_GAIN.gain.value=.22;return true;})()"),true,'Meeting renderer must have the active share integration and a controllable real microphone fixture.');
  await toolbar.wait("document.querySelector('[data-command=\"audio\"]')?.dataset.voiceLevel==='3'&&document.querySelector('[data-command=\"audio\"]')?.classList.contains('is-speaking')",'presenter toolbar microphone activity meter',5000);
  await video.wait("document.querySelector('.video-tile[data-self=\"1\"]')?.classList.contains('speaking')",'presenter video green speaking state',5000);
  assert.equal(await voiceMain.eval("(()=>{window.__DOMINION_QA_VOICE_GAIN.gain.value=0;return true;})()"),true,'Meeting renderer must be able to return the real microphone fixture to silence.');
  await toolbar.wait("document.querySelector('[data-command=\"audio\"]')?.dataset.voiceLevel==='0'&&!document.querySelector('[data-command=\"audio\"]')?.classList.contains('is-speaking')",'presenter toolbar microphone meter idle',5000);
  await video.wait("!document.querySelector('.video-tile[data-self=\"1\"]')?.classList.contains('speaking')",'presenter video speaking state idle',5000);
  voiceMain.close();
  stage('live-microphone-meter-roundtrip');

  logStart=stderr.length;
  await toolbar.click('[data-command="video"]');
  await waitStderr(ackPattern('video-off'),'renderer ACK for Video',8000,logStart);
  await toolbar.wait("window.DominionMacPresenterToolbar.state().cameraOn===false&&document.querySelector('[data-command=\"video\"]')?.classList.contains('is-off')&&document.querySelector('#videoLabel')?.textContent==='Start Video'",'floating Video state synchronized from real media',8000);
  await video.wait("(()=>{const tile=document.querySelector('.video-tile[data-self=\"1\"]'),preview=tile?.querySelector('video'),fallback=tile?.querySelector('.video-fallback');return Boolean(tile&&preview?.hidden&&!fallback?.hidden);})()", 'presenter panel camera-off fallback',6000);
  const fallbackWidth=await video.eval("Math.round(document.querySelector('.video-tile[data-self=\"1\"] .video-fallback')?.getBoundingClientRect().width||0)");
  assert.ok(fallbackWidth>=100,'Presenter camera-off profile fallback is still undersized: '+fallbackWidth+'px');
  stage('video-real-toolbar');

  logStart=stderr.length;
  await toolbar.click('[data-command="pause"]');
  await waitStderr(ackPattern('pause'),'renderer ACK for Pause',8000,logStart);
  await toolbar.wait("window.DominionMacPresenterToolbar.state().paused===true&&document.querySelector('#pauseLabel')?.textContent==='Resume'&&document.querySelector('#toolbar')?.classList.contains('is-paused')&&document.querySelector('#pauseGlyph path')?.getAttribute('d')==='M8 5.5 18 12 8 18.5z'",'Pause state returned to floating toolbar with amber share state and Resume/play glyph',8000);
  const pausedChrome=await toolbar.eval("(()=>{const strip=getComputedStyle(document.querySelector('.share-strip'));return {paused:document.querySelector('#toolbar')?.classList.contains('is-paused'),label:document.querySelector('#shareStateLabel')?.textContent||'',background:strip.backgroundColor};})()");
  assert.equal(pausedChrome.paused,true,'Paused presenter toolbar did not expose its paused visual state.');
  assert.match(pausedChrome.label,/paused/i,'Paused presenter status strip did not announce paused sharing.');
  stage('pause-real-toolbar');

  logStart=stderr.length;
  await toolbar.click('[data-command="pause"]');
  await waitStderr(ackPattern('pause'),'renderer ACK for Resume',8000,logStart);
  await toolbar.wait("window.DominionMacPresenterToolbar.state().paused===false&&document.querySelector('#pauseLabel')?.textContent==='Pause'&&!document.querySelector('#toolbar')?.classList.contains('is-paused')&&document.querySelector('#pauseGlyph path')?.getAttribute('d')==='M8 5v14M16 5v14'",'Resume state returned to floating toolbar with active-share chrome restored',8000);
  stage('resume-real-toolbar');

  logStart=stderr.length;
  await toolbar.click('[data-command="participants"]');
  await waitStderr(ackPattern('participants'),'renderer ACK for Participants',8000,logStart);
  await toolbar.wait("window.DominionMacPresenterToolbar.state().companion==='participants'",'Participants companion state returned to toolbar',8000);
  stage('participants-real-toolbar');

  logStart=stderr.length;
  await toolbar.click('[data-command="chat"]');
  await waitStderr(ackPattern('chat'),'renderer ACK for Chat',8000,logStart);
  await toolbar.wait("window.DominionMacPresenterToolbar.state().companion==='chat'",'Chat companion state returned to toolbar',8000);
  stage('chat-real-toolbar');

  await toolbar.click('[data-command="annotate"]');
  await toolbar.wait("window.DominionMacPresenterToolbar.state().companion==='annotate'",'Annotate companion state returned to toolbar',8000);
  stage('annotate-real-toolbar');

  const annotationTarget=await waitTarget(item=>String(item.url||'').includes('/ui/mac-annotation-toolbar.html'),'left-side native annotation palette',8000);
  const annotation=new Cdp(annotationTarget.webSocketDebuggerUrl);await annotation.connect();
  await annotation.wait("window.DominionMacAnnotationPalette&&document.visibilityState==='visible'&&document.querySelector('[data-command=\"annotate-pen\"]')",'visible native annotation palette',5000);
  const annotationGeometry=await annotation.eval("(()=>({x:window.screenX,availLeft:window.screen.availLeft||0,width:window.innerWidth,flex:getComputedStyle(document.querySelector('.annotation-palette')).flexDirection}))()");
  assert.ok(annotationGeometry.width>=176&&annotationGeometry.width<=192,'Annotation palette is not the approved professional width: '+annotationGeometry.width+'px');
  assert.equal(annotationGeometry.flex,'column','Annotation palette is not vertically arranged.');
  assert.ok(Math.abs(Number(annotationGeometry.x)-Number(annotationGeometry.availLeft))<=28,'Annotation palette is not positioned on the left edge of the shared display.');

  const annotationCanvasTarget=await waitTarget(item=>String(item.url||'').includes('/ui/mac-annotation-canvas.html'),'native annotation canvas',8000);
  const annotationCanvas=new Cdp(annotationCanvasTarget.webSocketDebuggerUrl);await annotationCanvas.connect();
  await annotationCanvas.wait("window.DominionNativeAnnotationCanvas?.snapshot?.().mode==='select'&&document.visibilityState==='visible'",'visible native annotation canvas',5000);

  await annotation.click('[data-command="annotate-laser"]');
  await annotation.wait("document.querySelector('[data-command=\"annotate-laser\"]')?.classList.contains('active')",'native Laser palette selection',5000);
  await annotationCanvas.wait("window.DominionNativeAnnotationCanvas?.snapshot?.().mode==='laser'",'native annotation canvas Laser mode',5000);

  await annotation.click('[data-command="annotate-width-thick"]');
  await annotation.wait("document.querySelector('[data-command=\"annotate-width-thick\"]')?.classList.contains('active')",'native annotation thick-width selection',5000);
  await annotationCanvas.wait("Math.abs((window.DominionNativeAnnotationCanvas?.snapshot?.().width||0)-1.45)<0.02",'native annotation canvas thick drawing width',5000);

  await annotation.click('[data-command="annotate-shape-rect"]');
  await annotation.wait("document.querySelector('[data-command=\"annotate-shape-rect\"]')?.classList.contains('active')",'native rectangle palette selection',5000);
  await annotationCanvas.wait("window.DominionNativeAnnotationCanvas?.snapshot?.().mode==='rect'",'native annotation canvas rectangle mode',5000);
  annotationCanvas.close();
  stage('annotation-professional-palette');

  logStart=stderr.length;
  await toolbar.click('[data-command="annotate"]');
  await toolbar.wait("!window.DominionMacPresenterToolbar.state().companion",'Annotate close state returned to toolbar',8000);
  await waitStderr('QA_MAC_ANNOTATION_VISIBILITY visible=0','native annotation BrowserWindow hidden after Annotate closes',5000,logStart);
  annotation.close();
  stage('annotate-close-real-toolbar');

  logStart=stderr.length;
  await toolbar.click('[data-command="new-share"]');
  await waitStderr(ackPattern('new-share'),'renderer ACK for New Share',8000,logStart);
  const pickerTarget=await waitTarget(item=>String(item.url||'').includes('/ui/share-picker.html'),'New Share picker from floating toolbar',8000);
  const picker=new Cdp(pickerTarget.webSocketDebuggerUrl);await picker.connect();
  await picker.wait("document.querySelector('#cancelTop')",'New Share picker controls',5000);
  await picker.click('#cancelTop');picker.close();
  stage('new-share-real-toolbar');

  logStart=stderr.length;
  await toolbar.click('#stopShare');
  await waitStderr(ackPattern('stop'),'renderer ACK for Stop Share',10000,logStart);
  await waitStderr('QA_MAC_PRESENTER_RESET reason=capture-stopped','native capture-stopped presenter reset',10000,logStart);
  await waitStderr('QA_MAC_PRESENTER_DESTROY reason=capture-stopped remaining=0','native capture-stopped presenter hard destroy',10000,logStart);
  stage('stop-share-real-toolbar');
  assert.equal(child.exitCode,null,'Packaged app exited during physical presenter control loop.');
  console.log('DOMINIONSTAR_PACKAGED_MAC_PRESENTER_CONTROL_LOOP_2_0_52_OK actual-floating-toolbar cdp-pointer-clicks renderer-acks audio video pause resume participants chat native-annotation-authority new-share stop-share live-camera-panel dedicated-preview toolbar-state-roundtrip');
}catch(error){
  console.error('PRESENTER_STAGE_FAILURE',error);
  console.error(stderr);
  process.exitCode=1;
}finally{
  video?.close();toolbar?.close();main?.close();
  await terminatePackagedApp();
}
