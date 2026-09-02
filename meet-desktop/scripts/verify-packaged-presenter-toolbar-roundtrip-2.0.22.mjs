import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-presenter-toolbar-roundtrip-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10880+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stage=name=>console.log(`PRESENTER_STAGE_OK ${name}`);
const stageBegin=name=>console.log(`PRESENTER_STAGE_BEGIN ${name}`);
let stderr='';
const mainErrors=[];
const toolbarErrors=[];
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function targets(){
  const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(900)});
  if(!response.ok)throw new Error(`DevTools target list failed: ${response.status}`);
  return response.json();
}
async function waitTarget(predicate,label,timeout=15000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);
    try{const found=(await targets()).find(predicate);if(found?.webSocketDebuggerUrl)return found;}catch{}
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

class CdpClient{
  constructor(url,errorSink){this.url=url;this.errorSink=errorSink;this.socket=null;this.nextId=0;this.pending=new Map();}
  async connect(){
    this.socket=await new Promise((resolve,reject)=>{const socket=new WebSocket(this.url),timer=setTimeout(()=>reject(new Error('CDP connection timeout.')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connection failed.'));},{once:true});});
    this.socket.addEventListener('message',event=>{
      const message=JSON.parse(String(event.data));
      if(message.method==='Runtime.exceptionThrown'){this.errorSink.push(message.params?.exceptionDetails?.exception?.description||message.params?.exceptionDetails?.text||'Runtime exception');return;}
      if(!message.id)return;const waiter=this.pending.get(message.id);if(!waiter)return;this.pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);
    });
    await this.call('Runtime.enable',{},8000);
  }
  call(method,params={},timeoutMs=8000){return new Promise((resolve,reject)=>{const id=++this.nextId,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method} after ${timeoutMs}ms`));},timeoutMs);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async eval(expression,timeoutMs=8000){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeoutMs);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
  async wait(expression,label,timeout=12000){const deadline=Date.now()+timeout;let lastError='';while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,3000))return;}catch(error){lastError=String(error?.message||error);}await sleep(100);}throw new Error(`Timed out waiting for ${label}.${lastError?` Last probe: ${lastError}`:''}`);}
  close(){for(const [,waiter] of this.pending){clearTimeout(waiter.timer);waiter.reject(new Error('CDP shutdown'));}this.pending.clear();try{this.socket?.close();}catch{}}
}

let main=null,toolbar=null,failure=null;
try{
  stageBegin('main-target');
  const mainTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').startsWith('file://')&&!String(item.url||'').includes('presenter-toolbar.html'),'main meeting renderer');
  main=new CdpClient(mainTarget.webSocketDebuggerUrl,mainErrors);await main.connect();stage('main-connected');
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.DominionRuntimeStability&&window.DominionMeetingParity&&window.DominionShareAnnotation&&window.dominionDesktop?.share?.captureStarted&&window.dominionDesktop?.share?.presenterCommitted",'share controllers',15000);stage('controllers-loaded');

  // Prepare the meeting and a synthetic Chromium MediaStream. Capture start must
  // complete BEFORE presenter mode is committed/hides the meeting. This directly
  // guards the physical bug where the toolbar appeared while its owning renderer
  // was stranded in an unfinished ShareController.start transaction.
  stageBegin('synthetic-prepare');
  const prepared=await main.eval(`(()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';
    const role=document.querySelector('#roomRole');if(role)role.textContent='Host';
    window.DominionMeetingParity.install();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();
    window.__qaPresenterCommands=[];
    window.__qaPresenterOff=window.dominionDesktop.share.onPresenterCommand(command=>window.__qaPresenterCommands.push(String(command?.command||command||'')));
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.style.display='none';document.body.append(canvas);window.__qaShareCanvas=canvas;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#17304b';ctx.fillRect(0,0,640,360);ctx.fillStyle='#fff';ctx.font='28px sans-serif';ctx.fillText('DominionStar presenter QA',120,180);
    const stream=canvas.captureStream(12);window.__qaShareStream=stream;
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>stream});
    window.__qaShareStartResult=null;window.__qaShareStartError='';
    return {tracks:stream.getTracks().length,meetingVisible:!overlay.hidden};
  })()`);
  assert.equal(prepared.meetingVisible,true);assert.ok(prepared.tracks>=1,'Synthetic share stream has no capture track.');stage('synthetic-prepared');

  stageBegin('share-start-dispatch');
  await main.eval(`(()=>{window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false}}).then(state=>{window.__qaShareStartResult={active:state.active,sourceName:state.sourceName};}).catch(error=>{window.__qaShareStartError=String(error?.stack||error?.message||error);});return true;})()`);stage('share-start-dispatched');
  await main.wait("Boolean(window.__qaShareStartResult||window.__qaShareStartError)",'synthetic ShareController.start completion',20000);
  const startOutcome=await main.eval(`({result:window.__qaShareStartResult,error:window.__qaShareStartError,state:window.DominionShareController.snapshot(),visibility:document.visibilityState})`);
  assert.equal(startOutcome.error,'',`Synthetic ShareController.start failed: ${startOutcome.error}`);
  assert.equal(startOutcome.result?.active,true,'Synthetic packaged share did not become active.');
  assert.equal(startOutcome.result?.sourceName,'QA Synthetic Share');stage('share-start-complete-before-hide');
  await main.wait("document.querySelector('#meetingOverlay').classList.contains('share-active')&&document.querySelector('#sharedContentVideo')&&!document.querySelector('#sharedContentVideo').hidden",'active shared-content stage',12000);stage('shared-stage-active-before-hide');

  // Mirror the real Share Integration path: once capture and the stage are fully
  // committed, send a one-way presenter-ready signal. No promise is allowed to
  // depend on the meeting remaining visible after this point.
  stageBegin('presenter-commit');
  await main.eval(`(()=>{window.dominionDesktop.share.presenterCommitted({sourceName:'QA Synthetic Share',paused:false});return true;})()`);stage('presenter-commit-sent');
  await sleep(250);
  await main.wait("window.DominionShareController.snapshot().active===true",'hidden meeting renderer remains live after presenter commit',12000);stage('hidden-renderer-responsive');

  stageBegin('toolbar-target');
  const toolbarTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('presenter-toolbar.html'),'floating presenter toolbar',18000);
  toolbar=new CdpClient(toolbarTarget.webSocketDebuggerUrl,toolbarErrors);await toolbar.connect();stage('toolbar-connected');
  await toolbar.wait("document.readyState==='complete'&&document.querySelector('[data-command=\"stop\"]')&&document.querySelector('[data-command=\"chat\"]')&&document.querySelector('[data-command=\"participants\"]')&&document.querySelector('[data-command=\"annotate\"]')",'presenter controls',12000);stage('toolbar-controls-ready');
  await toolbar.wait("document.querySelector('#shareSourceLabel')?.textContent==='QA Synthetic Share'",'presenter share state',12000);stage('toolbar-state-ready');

  stageBegin('pause');
  await toolbar.eval(`document.querySelector('[data-command="pause"]').click();true`);
  await main.wait("window.__qaPresenterCommands.includes('pause')",'Pause command delivery');
  await main.wait("window.DominionShareController.snapshot().paused===true",'Pause command acknowledgement',12000);
  await toolbar.wait("document.querySelector('#pauseLabel')?.textContent==='Resume'",'Pause toolbar state');stage('pause');

  stageBegin('resume');
  await toolbar.eval(`document.querySelector('[data-command="pause"]').click();true`);
  await main.wait("window.DominionShareController.snapshot().paused===false",'Resume command acknowledgement',12000);stage('resume');

  stageBegin('chat');
  await toolbar.eval(`document.querySelector('[data-command="chat"]').click();true`);
  await main.wait("window.__qaPresenterCommands.includes('chat')",'Chat command delivery');
  await main.wait("document.body.dataset.dsShareCompanion==='chat'&&!document.querySelector('#meetingChatPanel').hidden",'Chat share companion',12000);
  const chat=await main.eval(`(()=>({command:window.__qaPresenterCommands.includes('chat'),companion:document.body.dataset.dsShareCompanion,header:getComputedStyle(document.querySelector('.meeting-head')).display,footer:getComputedStyle(document.querySelector('.meeting-footer')).display,stage:getComputedStyle(document.querySelector('.stage')).display,chat:getComputedStyle(document.querySelector('#meetingChatPanel')).display}))()`);
  assert.equal(chat.command,true,'Chat toolbar command never reached the meeting renderer.');assert.equal(chat.companion,'chat');assert.equal(chat.header,'none','Chat companion must not resurrect normal meeting header.');assert.equal(chat.footer,'none','Chat companion must not resurrect normal meeting toolbar.');assert.equal(chat.stage,'none','Chat companion must not expose full meeting video stage.');assert.notEqual(chat.chat,'none','Chat companion itself must remain visible.');stage('chat');
  await main.eval(`window.DominionRuntimeStability.setChat(false);true`);await main.wait("!document.body.dataset.dsShareCompanion",'Chat companion close',12000);stage('chat-close');

  stageBegin('participants');
  await toolbar.eval(`document.querySelector('[data-command="participants"]').click();true`);
  await main.wait("window.__qaPresenterCommands.includes('participants')",'Participants command delivery');
  await main.wait("document.body.dataset.dsShareCompanion==='participants'&&!document.querySelector('.room-side').hidden",'Participants share companion',12000);
  const participants=await main.eval(`(()=>({command:window.__qaPresenterCommands.includes('participants'),header:getComputedStyle(document.querySelector('.meeting-head')).display,footer:getComputedStyle(document.querySelector('.meeting-footer')).display,stage:getComputedStyle(document.querySelector('.stage')).display,panel:getComputedStyle(document.querySelector('.room-side')).display}))()`);
  assert.equal(participants.command,true,'Participants toolbar command never reached the meeting renderer.');assert.equal(participants.header,'none');assert.equal(participants.footer,'none');assert.equal(participants.stage,'none');assert.notEqual(participants.panel,'none');stage('participants');
  await main.eval(`window.DominionRuntimeStability.setParticipants(false);true`);await main.wait("!document.body.dataset.dsShareCompanion",'Participants companion close',12000);stage('participants-close');

  stageBegin('annotate');
  await toolbar.eval(`document.querySelector('[data-command="annotate"]').click();true`);
  await main.wait("window.__qaPresenterCommands.includes('annotate')",'Annotate command delivery');
  await main.wait("document.body.dataset.dsShareCompanion==='annotate'&&window.DominionShareAnnotation.snapshot().active===true",'Annotation share companion',12000);
  const annotate=await main.eval(`(()=>({command:window.__qaPresenterCommands.includes('annotate'),active:window.DominionShareAnnotation.snapshot().active,header:getComputedStyle(document.querySelector('.meeting-head')).display,footer:getComputedStyle(document.querySelector('.meeting-footer')).display,canvasVisible:getComputedStyle(document.querySelector('.share-annotation-overlay')).display!=='none'}))()`);
  assert.equal(annotate.command,true,'Annotate toolbar command never reached the meeting renderer.');assert.equal(annotate.active,true);assert.equal(annotate.header,'none');assert.equal(annotate.footer,'none');assert.equal(annotate.canvasVisible,true);stage('annotate');
  await toolbar.eval(`document.querySelector('[data-command="annotate"]').click();true`);
  await main.wait("window.DominionShareAnnotation.snapshot().active===false&&!document.body.dataset.dsShareCompanion",'Annotation companion close',12000);stage('annotate-close');

  stageBegin('audio-video');
  await toolbar.eval(`document.querySelector('[data-command="audio"]').click();document.querySelector('[data-command="video"]').click();true`);
  await main.wait("window.__qaPresenterCommands.includes('audio')&&window.__qaPresenterCommands.includes('video')",'Audio/video presenter command round-trip',12000);stage('audio-video-command-path');

  stageBegin('stop');
  await toolbar.eval(`document.querySelector('[data-command="stop"]').click();true`);
  await main.wait("window.__qaPresenterCommands.includes('stop')",'Stop Share presenter command',12000);stage('stop-command-delivered');
  await main.wait("window.DominionShareController.snapshot().active===false",'Stop Share controller completion',15000);stage('stop-controller-complete');
  await main.wait("!document.querySelector('#meetingOverlay').classList.contains('share-active')&&document.querySelector('#sharedContentVideo').hidden",'Stop Share UI restoration',12000);stage('stop-ui-restored');
  const stopped=await main.eval(`(()=>({active:window.DominionShareController.snapshot().active,trackStates:(window.__qaShareStream?.getTracks?.()||[]).map(track=>track.readyState),companion:document.body.dataset.dsShareCompanion||'',commands:[...window.__qaPresenterCommands]}))()`);
  assert.equal(stopped.active,false);assert.ok(stopped.trackStates.every(state=>state==='ended'),'Stop Share must end every synthetic capture track.');assert.equal(stopped.companion,'');for(const required of ['pause','chat','participants','annotate','audio','video','stop'])assert.ok(stopped.commands.includes(required),`Presenter command ${required} did not round-trip.`);stage('stop');

  await sleep(250);
  assert.deepEqual(mainErrors,[],'Main meeting renderer emitted exceptions:\n'+mainErrors.join('\n'));
  assert.deepEqual(toolbarErrors,[],'Presenter toolbar renderer emitted exceptions:\n'+toolbarErrors.join('\n'));
  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged presenter round-trip wrote an uncaught JavaScript error to stderr.');
  console.log('DOMINIONSTAR_PACKAGED_PRESENTER_TOOLBAR_ROUNDTRIP_2_0_22_OK capture-completes-before-hide integration-style-one-way-commit hidden-renderer-responsive toolbar-ipc pause-resume compact-chat compact-participants annotation-companion audio-video-command-path stop-share-ends-track restores-meeting no-renderer-errors');
}catch(error){
  failure=error;console.error('PRESENTER_STAGE_FAILURE',error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());
}finally{
  try{await main?.eval(`window.__qaPresenterOff?.();window.__qaShareStream?.getTracks?.().forEach(track=>{try{track.stop()}catch{}});document.querySelector('#meetingOverlay')?.classList.remove('share-active');delete document.body.dataset.dsShareCompanion;true`,3000);}catch{}
  toolbar?.close();main?.close();
  try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}
}
process.exit(failure?1:0);