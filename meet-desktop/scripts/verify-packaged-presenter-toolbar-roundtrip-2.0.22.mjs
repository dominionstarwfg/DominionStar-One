import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-presenter-toolbar-roundtrip-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10880+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stage=name=>console.log(`PRESENTER_STAGE_OK ${name}`);
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*','--use-fake-ui-for-media-stream'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});
const count=needle=>stderr.split(String(needle)).length-1;
async function waitLog(needle,label,timeout=9000,minCount=1){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);
    if(stderr.includes('QA_PRESENTER_SELF_FAILURE'))throw new Error(`Renderer presenter sequence failed before ${label}.\n${stderr}`);
    if(count(needle)>=minCount)return;
    await sleep(60);
  }
  throw new Error(`Timed out waiting for ${label}: ${needle}\n${stderr}`);
}
async function waitTarget(timeout=15000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(900)});
      const targets=await response.json();
      const target=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://')&&!String(item.url||'').includes('presenter-toolbar.html'));
      if(target?.webSocketDebuggerUrl)return target;
    }catch{}
    await sleep(120);
  }
  throw new Error('Timed out waiting for main renderer.');
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
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);
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
    const deadline=Date.now()+timeout;let error='';
    while(Date.now()<deadline){
      try{if(await this.eval(`Boolean(${expression})`,2500))return;}catch(e){error=String(e?.message||e);}
      await sleep(90);
    }
    throw new Error(`Timed out waiting for ${label}${error?`: ${error}`:''}`);
  }
  close(){try{this.socket?.close();}catch{}}
}

let main=null;
try{
  const target=await waitTarget();
  main=new Cdp(target.webSocketDebuggerUrl);
  await main.connect();
  stage('main-connected');
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.DominionRuntimeStability&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionShareAnnotation&&window.DominionMediaController",'share controllers and meeting features',15000);
  stage('controllers-loaded');

  const prepared=await main.eval(`(async()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');
    overlay.hidden=false;overlay.dataset.viewMode='speaker';
    const role=document.querySelector('#roomRole');if(role)role.textContent='Host';

    // A production meeting entry initializes MeetingFeatures before presenter
    // controls can be used. Step 20 must exercise that reachable state rather
    // than a synthetic overlay with no Chat panel mounted.
    window.DominionMeetingParity.install();
    window.DominionMeetingFeatures.toggleChat(false);
    window.DominionRuntimeStability.sync();
    window.DominionRuntimeStability.ensureToolbarZones();

    window.__qaCommands=[];
    window.addEventListener('dominion:presenter-command-dispatch',event=>{
      const command=String(event.detail?.command||'');
      window.__qaCommands.push(command);
      console.log('QA_PRESENTER_COMMAND '+command);
    });
    window.DominionShareController.onChange(state=>console.log('QA_SHARE_STATE active='+(state.active?1:0)+' paused='+(state.paused?1:0)+' annotating='+(state.annotating?1:0)));

    const frameCanvas=document.createElement('canvas');
    frameCanvas.width=640;frameCanvas.height=360;
    const frameCtx=frameCanvas.getContext('2d',{alpha:false});
    frameCtx.fillStyle='#07111f';frameCtx.fillRect(0,0,640,360);
    frameCtx.fillStyle='#d6b25e';frameCtx.fillRect(80,80,180,120);
    frameCtx.fillStyle='#fff';frameCtx.font='28px sans-serif';frameCtx.fillText('DominionStar QA Share',40,260);
    window.__qaFrameCanvas=frameCanvas;

    const makeTrack=(kind='video')=>({kind,id:'qa-'+kind+'-'+Math.random().toString(36).slice(2),label:'QA Logical '+kind,readyState:'live',enabled:true,contentHint:'',addEventListener(){},removeEventListener(){},stop(){this.readyState='ended';},clone(){return makeTrack(kind);}});
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
    window.__qaMakeLogicalStream=makeStream;
    window.__qaLogicalShare=makeStream('video');

    // Annotation composition uses a hidden video element. The QA share is a
    // deliberate plain-JS stream contract (not Chromium MediaStream) so the
    // Mac runner cannot re-enter its unstable native capture substrate. Keep
    // the real compositor behavior while allowing that logical stream to be
    // attached to the hidden QA video element.
    const nativeSrcObject=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'srcObject');
    Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{
      configurable:true,
      get(){return Object.prototype.hasOwnProperty.call(this,'__qaLogicalSrcObject')?this.__qaLogicalSrcObject:nativeSrcObject?.get?.call(this)||null;},
      set(value){
        if(value&&!(value instanceof MediaStream)){this.__qaLogicalSrcObject=value;return;}
        delete this.__qaLogicalSrcObject;
        if(nativeSrcObject?.set)nativeSrcObject.set.call(this,value);
      }
    });

    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>window.__qaLogicalShare});
    window.__qaOriginalCaptureStream=HTMLCanvasElement.prototype.captureStream;
    HTMLCanvasElement.prototype.captureStream=function(){return makeStream('video');};
    Object.defineProperty(window,'ImageCapture',{configurable:true,value:class{async grabFrame(){return createImageBitmap(window.__qaFrameCanvas);}}});
    window.__qaAudioContext=new AudioContext();
    const destination=window.__qaAudioContext.createMediaStreamDestination();
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>constraints?.audio?destination.stream:new MediaStream()});

    const qaButton=command=>document.querySelector('[data-inline-command="'+command+'"]');
    const qaClick=command=>{
      const button=qaButton(command);
      if(!button||button.hidden)throw new Error('Presenter control unavailable: '+command);
      button.click();
    };
    const qaAssert=(predicate,label)=>{
      let ok=false;
      try{ok=Boolean(predicate());}catch(error){throw new Error(label+': '+String(error?.message||error));}
      if(!ok)throw new Error(label+' did not update synchronously.');
      return true;
    };
    const qaWaitController=(subscribe,predicate,label)=>new Promise((resolve,reject)=>{
      let settled=false;let unsubscribe=()=>{};
      const finish=()=>{
        if(settled)return;
        try{
          if(!predicate())return;
          settled=true;unsubscribe();resolve(true);
        }catch(error){settled=true;unsubscribe();reject(new Error(label+': '+String(error?.message||error)));}
      };
      unsubscribe=subscribe(()=>queueMicrotask(finish));
      finish();
    });
    const qaWaitDom=(predicate,label)=>new Promise((resolve,reject)=>{
      let settled=false;
      const observer=new MutationObserver(()=>queueMicrotask(finish));
      const finish=()=>{
        if(settled)return;
        try{
          if(!predicate())return;
          settled=true;observer.disconnect();resolve(true);
        }catch(error){settled=true;observer.disconnect();reject(new Error(label+': '+String(error?.message||error)));}
      };
      observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class','data-ds-share-companion']});
      queueMicrotask(finish);
    });
    const qaWaitShare=(predicate,label)=>qaWaitController(fn=>window.DominionShareController.onChange(fn),predicate,label);
    const qaWaitMedia=(predicate,label)=>qaWaitController(fn=>window.DominionMediaController.onChange(fn),predicate,label);
    const qaMark=name=>console.log('QA_PRESENTER_SELF_OK '+name);

    window.__qaPresenterSelfRun=async()=>{
      try{
        console.log('QA_PRESENTER_SELF_BEGIN');
        const state=await window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false}});
        window.DominionShareIntegration.commitPresenterMode();
        qaAssert(()=>state.active===true&&window.DominionShareController.snapshot().active===true&&Boolean(document.querySelector('#inlinePresenterToolbar:not([hidden])')),'Active inline presenter toolbar');
        if(state.sourceName!=='QA Synthetic Share')throw new Error('Unexpected share source: '+state.sourceName);
        qaMark('share-active');

        qaClick('pause');
        await qaWaitShare(()=>window.DominionShareController.snapshot().paused===true&&qaButton('pause')?.textContent==='Resume','Pause state');
        qaMark('pause');

        qaClick('pause');
        await qaWaitShare(()=>window.DominionShareController.snapshot().paused===false&&qaButton('pause')?.textContent==='Pause','Resume state');
        qaMark('resume');

        const chatReady=qaWaitDom(()=>document.body.dataset.dsShareCompanion==='chat'&&document.querySelector('#meetingChatPanel')?.hidden===false,'Chat companion');
        qaClick('chat');
        await chatReady;
        qaMark('chat');
        window.DominionRuntimeStability.setChat(false);

        const participantsReady=qaWaitDom(()=>document.body.dataset.dsShareCompanion==='participants'&&document.querySelector('.room-side')?.hidden===false,'Participants companion');
        qaClick('participants');
        await participantsReady;
        qaMark('participants');
        window.DominionRuntimeStability.setParticipants(false);

        const annotationReady=qaWaitDom(()=>window.DominionShareAnnotation.snapshot().active===true,'Annotation active');
        qaClick('annotate');
        await annotationReady;
        qaMark('annotate');
        const annotationClosed=qaWaitDom(()=>window.DominionShareAnnotation.snapshot().active===false,'Annotation closed');
        qaClick('annotate');
        await annotationClosed;
        qaMark('annotate-close');

        qaClick('audio');
        await qaWaitMedia(()=>window.DominionMediaController.snapshot().micOn===true&&qaButton('audio')?.textContent==='Mute','Presenter audio state');
        qaMark('audio');

        qaClick('video');
        await qaWaitMedia(()=>window.DominionMediaController.snapshot().cameraOn===false&&qaButton('video')?.textContent==='Start Video','Presenter video state');
        qaMark('video');

        qaClick('stop');
        await qaWaitShare(()=>window.DominionShareController.snapshot().active===false&&document.querySelector('#inlinePresenterToolbar')?.hidden===true,'Stop Share completion');
        qaMark('stop-share');
        console.log('DOMINIONSTAR_PACKAGED_PRESENTER_TOOLBAR_ROUNDTRIP_2_0_22_OK logical-share production-meeting-features annotation-compositor self-driven-renderer pause-resume chat participants annotate audio video stop-share zoom-style-inline-controls');
      }catch(error){
        console.error('QA_PRESENTER_SELF_FAILURE '+String(error?.stack||error));
      }
    };

    return {
      meetingVisible:!overlay.hidden,
      chatPanelReady:Boolean(document.querySelector('#meetingChatPanel')),
      tracks:window.__qaLogicalShare.getTracks().length,
      selfRunner:typeof window.__qaPresenterSelfRun==='function'
    };
  })()`,12000);

  assert.equal(prepared.meetingVisible,true);
  assert.equal(prepared.chatPanelReady,true,'Presenter QA must begin from a production-reachable meeting state with Chat UI initialized.');
  assert.equal(prepared.tracks,1);
  assert.equal(prepared.selfRunner,true);
  stage('logical-media-prepared');

  const scheduled=await main.eval(`(()=>{setTimeout(()=>{void window.__qaPresenterSelfRun();},30);return true;})()`,2500);
  assert.equal(scheduled,true);
  stage('self-run-scheduled');
  main.close();main=null;

  await waitLog('QA_PRESENTER_SELF_OK share-active','self-driven Share activation',12000);stage('share-active');
  await waitLog('QA_PRESENTER_COMMAND pause','Pause command',6000,1);await waitLog('QA_PRESENTER_SELF_OK pause','Pause state',6000);stage('pause');
  await waitLog('QA_PRESENTER_COMMAND pause','Resume command',6000,2);await waitLog('QA_PRESENTER_SELF_OK resume','Resume state',6000);stage('resume');
  await waitLog('QA_PRESENTER_COMMAND chat','Chat command',6000);await waitLog('QA_PRESENTER_SELF_OK chat','Chat companion',6000);stage('chat');
  await waitLog('QA_PRESENTER_COMMAND participants','Participants command',6000);await waitLog('QA_PRESENTER_SELF_OK participants','Participants companion',6000);stage('participants');
  await waitLog('QA_PRESENTER_COMMAND annotate','Annotate command',6000,1);await waitLog('QA_PRESENTER_SELF_OK annotate','Annotation active',6000);stage('annotate');
  await waitLog('QA_PRESENTER_COMMAND annotate','Annotate close command',6000,2);await waitLog('QA_PRESENTER_SELF_OK annotate-close','Annotation closed',6000);stage('annotate-close');
  await waitLog('QA_PRESENTER_COMMAND audio','Audio command',6000);await waitLog('QA_PRESENTER_SELF_OK audio','Presenter audio state',6000);stage('audio');
  await waitLog('QA_PRESENTER_COMMAND video','Video command',6000);await waitLog('QA_PRESENTER_SELF_OK video','Presenter video state',6000);stage('video');
  await waitLog('QA_PRESENTER_COMMAND stop','Stop Share command',6000);await waitLog('QA_PRESENTER_SELF_OK stop-share','Stop Share completion',10000);stage('stop-share');
  await waitLog('DOMINIONSTAR_PACKAGED_PRESENTER_TOOLBAR_ROUNDTRIP_2_0_22_OK','presenter toolbar certification',3000);

  assert.equal(child.exitCode,null,'Packaged app exited during presenter round trip.');
}catch(error){
  console.error('PRESENTER_STAGE_FAILURE',error);
  console.error(stderr);
  process.exitCode=1;
}finally{
  main?.close();
  if(child.exitCode===null)child.kill('SIGTERM');
  await sleep(2000);
  if(child.exitCode===null)child.kill('SIGKILL');
}
