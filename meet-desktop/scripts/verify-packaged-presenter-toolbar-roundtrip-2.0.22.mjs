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
async function waitLog(needle,label,timeout=9000,minCount=1){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);if(count(needle)>=minCount)return;await sleep(60);}throw new Error(`Timed out waiting for ${label}: ${needle}\n${stderr}`);}
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
    return {meetingVisible:!overlay.hidden,tracks:window.__qaLogicalShare.getTracks().length};
  })()`,12000);
  assert.equal(prepared.meetingVisible,true);assert.equal(prepared.tracks,1);stage('logical-media-prepared');

  const started=await main.eval(`(async()=>{const state=await window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false}});window.DominionShareIntegration.commitPresenterMode();const inline=document.querySelector('#inlinePresenterToolbar');return {active:state.active,inlineVisible:Boolean(inline&&!inline.hidden),source:state.sourceName};})()`,12000);
  assert.equal(started.active,true);assert.equal(started.inlineVisible,true);assert.equal(started.source,'QA Synthetic Share');stage('share-active');

  const pauseBefore=count('QA_PRESENTER_COMMAND pause');await main.eval(`document.querySelector('[data-inline-command="pause"]').click();true`);await waitLog('QA_PRESENTER_COMMAND pause','Pause command',5000,pauseBefore+1);await main.wait("window.DominionShareController.snapshot().paused===true&&document.querySelector('[data-inline-command=\"pause\"]')?.textContent==='Resume'",'Pause state');stage('pause');
  const resumeBefore=count('QA_PRESENTER_COMMAND pause');await main.eval(`document.querySelector('[data-inline-command="pause"]').click();true`);await waitLog('QA_PRESENTER_COMMAND pause','Resume command',5000,resumeBefore+1);await main.wait("window.DominionShareController.snapshot().paused===false&&document.querySelector('[data-inline-command=\"pause\"]')?.textContent==='Pause'",'Resume state');stage('resume');

  const chatBefore=count('QA_PRESENTER_COMMAND chat');await main.eval(`document.querySelector('[data-inline-command="chat"]').click();true`);await waitLog('QA_PRESENTER_COMMAND chat','Chat command',5000,chatBefore+1);await main.wait("document.body.dataset.dsShareCompanion==='chat'&&document.querySelector('#meetingChatPanel')?.hidden===false",'Chat companion');stage('chat');await main.eval(`window.DominionRuntimeStability.setChat(false);true`);
  const participantsBefore=count('QA_PRESENTER_COMMAND participants');await main.eval(`document.querySelector('[data-inline-command="participants"]').click();true`);await waitLog('QA_PRESENTER_COMMAND participants','Participants command',5000,participantsBefore+1);await main.wait("document.body.dataset.dsShareCompanion==='participants'&&document.querySelector('.room-side')?.hidden===false",'Participants companion');stage('participants');await main.eval(`window.DominionRuntimeStability.setParticipants(false);true`);

  const annotateBefore=count('QA_PRESENTER_COMMAND annotate');await main.eval(`document.querySelector('[data-inline-command="annotate"]').click();true`);await waitLog('QA_PRESENTER_COMMAND annotate','Annotate command',5000,annotateBefore+1);await main.wait("window.DominionShareAnnotation.snapshot().active===true",'Annotation active');stage('annotate');await main.eval(`document.querySelector('[data-inline-command="annotate"]').click();true`);await main.wait("window.DominionShareAnnotation.snapshot().active===false",'Annotation closed');stage('annotate-close');

  const audioBefore=count('QA_PRESENTER_COMMAND audio');await main.eval(`document.querySelector('[data-inline-command="audio"]').click();true`);await waitLog('QA_PRESENTER_COMMAND audio','Audio command',5000,audioBefore+1);await main.wait("window.DominionMediaController.snapshot().micOn===true&&document.querySelector('[data-inline-command=\"audio\"]')?.textContent==='Mute'",'Presenter audio state');stage('audio');
  const videoBefore=count('QA_PRESENTER_COMMAND video');await main.eval(`document.querySelector('[data-inline-command="video"]').click();true`);await waitLog('QA_PRESENTER_COMMAND video','Video command',5000,videoBefore+1);await main.wait("window.DominionMediaController.snapshot().cameraOn===false&&document.querySelector('[data-inline-command=\"video\"]')?.textContent==='Start Video'",'Presenter video state');stage('video');

  const stopBefore=count('QA_PRESENTER_COMMAND stop');await main.eval(`document.querySelector('[data-inline-command="stop"]').click();true`);await waitLog('QA_PRESENTER_COMMAND stop','Stop Share command',5000,stopBefore+1);await main.wait("window.DominionShareController.snapshot().active===false&&document.querySelector('#inlinePresenterToolbar')?.hidden===true",'Stop Share completion',10000);stage('stop-share');

  assert.equal(child.exitCode,null,'Packaged app exited during presenter round trip.');
  console.log('DOMINIONSTAR_PACKAGED_PRESENTER_TOOLBAR_ROUNDTRIP_2_0_22_OK logical-share pause-resume chat participants annotate audio video stop-share zoom-style-inline-controls');
}catch(error){console.error('PRESENTER_STAGE_FAILURE',error);console.error(stderr);process.exitCode=1;
}finally{try{if(main)await main.eval(`(()=>{try{HTMLCanvasElement.prototype.captureStream=window.__qaOriginalCaptureStream||HTMLCanvasElement.prototype.captureStream;}catch{}try{window.__qaAudioContext?.close?.();}catch{}return true;})()`,1500);}catch{}main?.close();if(child.exitCode===null)child.kill('SIGTERM');await sleep(2000);if(child.exitCode===null)child.kill('SIGKILL');}
