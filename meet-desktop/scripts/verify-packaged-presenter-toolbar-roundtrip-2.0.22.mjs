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
async function waitLog(needle,label,timeout=9000,minCount=1){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);if(stderr.includes('QA_PRESENTER_SELF_FAILURE'))throw new Error(`Renderer presenter sequence failed before ${label}.\n${stderr}`);if(count(needle)>=minCount)return;await sleep(60);}throw new Error(`Timed out waiting for ${label}: ${needle}\n${stderr}`);}
async function waitTarget(timeout=15000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(900)});const targets=await response.json();const target=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://')&&!String(item.url||'').includes('presenter-toolbar.html'));if(target?.webSocketDebuggerUrl)return target;}catch{}await sleep(120);}throw new Error('Timed out waiting for main renderer.');}
class Cdp{
  constructor(url){this.url=url;this.socket=null;this.nextId=0;this.pending=new Map();}
  async connect(){this.socket=await new Promise((resolve,reject)=>{const socket=new WebSocket(this.url);const timer=setTimeout(()=>reject(new Error('CDP connect timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connect failed'));},{once:true});});this.socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=this.pending.get(message.id);if(!waiter)return;this.pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});await this.call('Runtime.enable');}
  call(method,params={},timeout=8000){return new Promise((resolve,reject)=>{const id=++this.nextId;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async eval(expression,timeout=8000){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');return result.result?.value;}
  async wait(expression,label,timeout=9000){const deadline=Date.now()+timeout;let error='';while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,2500))return;}catch(e){error=String(e?.message||e);}await sleep(90);}throw new Error(`Timed out waiting for ${label}${error?`: ${error}`:''}`);}
  close(){try{this.socket?.close();}catch{}}
}
let main=null;
try{
  const target=await waitTarget();main=new Cdp(target.webSocketDebuggerUrl);await main.connect();stage('main-connected');
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.DominionRuntimeStability&&window.DominionMeetingParity&&window.DominionShareAnnotation",'share controllers',15000);stage('controllers-loaded');
  const prepared=await main.eval(`(async()=>{
    document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';const role=document.querySelector('#roomRole');if(role)role.textContent='Host';
    window.DominionMeetingParity.install();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();
    window.__qaCommands=[];window.addEventListener('dominion:presenter-command-dispatch',event=>{const command=String(event.detail?.command||'');window.__qaCommands.push(command);console.log('QA_PRESENTER_COMMAND '+command);});
    window.DominionShareController.onChange(state=>console.log('QA_SHARE_STATE active='+(state.active?1:0)+' paused='+(state.paused?1:0)+' annotating='+(state.annotating?1:0)));
    const frameCanvas=document.createElement('canvas');frameCanvas.width=640;frameCanvas.height=360;const frameCtx=frameCanvas.getContext('2d',{alpha:false});frameCtx.fillStyle='#07111f';frameCtx.fillRect(0,0,640,360);frameCtx.fillStyle='#d6b25e';frameCtx.fillRect(80,80,180,120);frameCtx.fillStyle='#fff';frameCtx.font='28px sans-serif';frameCtx.fillText('DominionStar QA Share',40,260);window.__qaFrameCanvas=frameCanvas;
    const makeTrack=(kind='video')=>({kind,id:'qa-'+kind+'-'+Math.random().toString(36).slice(2),label:'QA Logical '+kind,readyState:'live',enabled:true,contentHint:'',addEventListener(){},removeEventListener(){},stop(){this.readyState='ended';},clone(){return makeTrack(kind);}});
    const makeStream=(kind='video')=>{const stream=new MediaStream();const track=makeTrack(kind);Object.defineProperties(stream,{getVideoTracks:{configurable:true,value:()=>kind==='video'?[track]:[]},getAudioTracks:{configurable:true,value:()=>kind==='audio'?[track]:[]},getTracks:{configurable:true,value:()=>[track]}});return stream;};
    window.__qaMakeLogicalStream=makeStream;window.__qaLogicalShare=makeStream('video');
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>window.__qaLogicalShare});
    window.__qaOriginalCaptureStream=HTMLCanvasElement.prototype.captureStream;HTMLCanvasElement.prototype.captureStream=function(){return makeStream('video');};
    Object.defineProperty(window,'ImageCapture',{configurable:true,value:class{async grabFrame(){return createImageBitmap(window.__qaFrameCanvas);}}});
    window.__qaAudioContext=new AudioContext();const destination=window.__qaAudioContext.createMediaStreamDestination();Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>constraints?.audio?destination.stream:new MediaStream()});

    const qaSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const qaWait=async(predicate,label,timeout=7000)=>{const deadline=Date.now()+timeout;let last='';while(Date.now()<deadline){try{if(predicate())return true;}catch(error){last=String(error?.message||error);}await qaSleep(40);}throw new Error('Timed out waiting for '+label+(last?': '+last:''));};
    const qaButton=command=>document.querySelector('[data-inline-command="'+command+'"]');
    const qaClick=command=>{const button=qaButton(command);if(!button||button.hidden)throw new Error('Presenter control unavailable: '+command);button.click();};
    const qaMark=name=>console.log('QA_PRESENTER_SELF_OK '+name);

    window.__qaPresenterSelfRun=async()=>{
      try{
        console.log('QA_PRESENTER_SELF_BEGIN');
        const state=await window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false}});
        window.DominionShareIntegration.commitPresenterMode();
        await qaWait(()=>state.active===true&&window.DominionShareController.snapshot().active===true&&Boolean(document.querySelector('#inlinePresenterToolbar:not([hidden])')),'active inline presenter toolbar');
        if(state.sourceName!=='QA Synthetic Share')throw new Error('Unexpected share source: '+state.sourceName);
        qaMark('share-active');

        qaClick('pause');
        await qaWait(()=>window.DominionShareController.snapshot().paused===true&&qaButton('pause')?.textContent==='Resume','Pause state');
        qaMark('pause');
        qaClick('pause');
        await qaWait(()=>window.DominionShareController.snapshot().paused===false&&qaButton('pause')?.textContent==='Pause','Resume state');
        qaMark('resume');

        qaClick('chat');
        await qaWait(()=>document.body.dataset.dsShareCompanion==='chat'&&document.querySelector('#meetingChatPanel')?.hidden===false,'Chat companion');
        qaMark('chat');window.DominionRuntimeStability.setChat(false);
        qaClick('participants');
        await qaWait(()=>document.body.dataset.dsShareCompanion==='participants'&&document.querySelector('.room-side')?.hidden===false,'Participants companion');
        qaMark('participants');window.DominionRuntimeStability.setParticipants(false);

        qaClick('annotate');
        await qaWait(()=>window.DominionShareAnnotation.snapshot().active===true,'Annotation active');
        qaMark('annotate');qaClick('annotate');
        await qaWait(()=>window.DominionShareAnnotation.snapshot().active===false,'Annotation closed');
        qaMark('annotate-close');

        qaClick('audio');
        await qaWait(()=>window.DominionMediaController.snapshot().micOn===true&&qaButton('audio')?.textContent==='Mute','Presenter audio state');
        qaMark('audio');
        qaClick('video');
        await qaWait(()=>window.DominionMediaController.snapshot().cameraOn===false&&qaButton('video')?.textContent==='Start Video','Presenter video state');
        qaMark('video');

        qaClick('stop');
        await qaWait(()=>window.DominionShareController.snapshot().active===false&&document.querySelector('#inlinePresenterToolbar')?.hidden===true,'Stop Share completion',10000);
        qaMark('stop-share');
        console.log('DOMINIONSTAR_PACKAGED_PRESENTER_TOOLBAR_ROUNDTRIP_2_0_22_OK logical-share self-driven-renderer pause-resume chat participants annotate audio video stop-share zoom-style-inline-controls');
      }catch(error){console.error('QA_PRESENTER_SELF_FAILURE '+String(error?.stack||error));}
    };
    return {meetingVisible:!overlay.hidden,tracks:window.__qaLogicalShare.getTracks().length,selfRunner:typeof window.__qaPresenterSelfRun==='function'};
  })()`,12000);
  assert.equal(prepared.meetingVisible,true);assert.equal(prepared.tracks,1);assert.equal(prepared.selfRunner,true);stage('logical-media-prepared');

  // Schedule the real presenter transaction inside the renderer and return from
  // CDP before Share becomes active. On physical Mac Chromium, Runtime.evaluate
  // can stop servicing debugger calls after the active-share transition even
  // while the renderer's own UI/event handlers remain live. The certification
  // below therefore observes renderer console milestones only after this point.
  const scheduled=await main.eval(`(()=>{setTimeout(()=>{void window.__qaPresenterSelfRun();},30);return true;})()`,2500);
  assert.equal(scheduled,true);stage('self-run-scheduled');main.close();main=null;

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
}catch(error){console.error('PRESENTER_STAGE_FAILURE',error);console.error(stderr);process.exitCode=1;
}finally{main?.close();if(child.exitCode===null)child.kill('SIGTERM');await sleep(2000);if(child.exitCode===null)child.kill('SIGKILL');}
