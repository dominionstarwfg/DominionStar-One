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
const logCount=needle=>stderr.split(String(needle)).length-1;
async function waitLog(needle,label,timeout=12000,minCount=1){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);
    if(logCount(needle)>=minCount)return;
    await sleep(60);
  }
  throw new Error(`Timed out waiting for ${label}. Missing log marker: ${needle}\n${stderr}`);
}

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

  // Prepare the meeting and a synthetic Chromium MediaStream. During active
  // synthetic capture Chromium's DevTools Runtime.evaluate can stop answering on
  // macOS even though the renderer event loop remains live. Therefore real app
  // events are also emitted to process logging and become the independent
  // observation channel for the active-share portion of this test.
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
    window.__qaPresenterMilestones=[];
    window.__qaPresenterMark=label=>{window.__qaPresenterMilestones.push(String(label));console.log('QA_PRESENTER_MILESTONE '+String(label));};
    window.__qaPresenterDescribe=command=>{
      const share=window.DominionShareController.snapshot();
      const annotation=window.DominionShareAnnotation.snapshot();
      const companion=document.body.dataset.dsShareCompanion||'none';
      const display=selector=>{const node=document.querySelector(selector);return node?getComputedStyle(node).display:'missing';};
      console.log('QA_PRESENTER_EFFECT '+String(command)+' active='+(share.active?1:0)+' paused='+(share.paused?1:0)+' companion='+companion+' annotation='+(annotation.active?1:0)+' header='+display('.meeting-head')+' footer='+display('.meeting-footer')+' stage='+display('.stage')+' chatVisible='+(display('#meetingChatPanel')!=='none'?1:0)+' participantsVisible='+(display('.room-side')!=='none'?1:0));
    };
    window.__qaPresenterOff=window.dominionDesktop.share.onPresenterCommand(command=>{
      const normalized=String(command?.command||command||'');window.__qaPresenterCommands.push(normalized);console.log('QA_PRESENTER_COMMAND '+normalized);
      setTimeout(()=>window.__qaPresenterDescribe(normalized),160);
      if(normalized==='chat')setTimeout(()=>{window.DominionRuntimeStability.setChat(false);console.log('QA_HARNESS_CLOSE chat');},650);
      if(normalized==='participants')setTimeout(()=>{window.DominionRuntimeStability.setParticipants(false);console.log('QA_HARNESS_CLOSE participants');},650);
    });
    window.__qaShareStateOff=window.DominionShareController.onChange(state=>console.log('QA_SHARE_STATE active='+(state.active?1:0)+' paused='+(state.paused?1:0)+' annotating='+(state.annotating?1:0)+' source='+String(state.sourceName||'')));
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.style.display='none';document.body.append(canvas);window.__qaShareCanvas=canvas;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#17304b';ctx.fillRect(0,0,640,360);ctx.fillStyle='#fff';ctx.font='28px sans-serif';ctx.fillText('DominionStar presenter QA',120,180);
    const stream=canvas.captureStream(12);window.__qaShareStream=stream;
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>{window.__qaPresenterMark('getDisplayMedia-enter');await Promise.resolve();window.__qaPresenterMark('getDisplayMedia-return');return stream;}});
    window.__qaShareStartResult=null;window.__qaShareStartError='';window.__qaPresenterMark('prepared');
    return {tracks:stream.getTracks().length,meetingVisible:!overlay.hidden};
  })()`);
  assert.equal(prepared.meetingVisible,true);assert.ok(prepared.tracks>=1,'Synthetic share stream has no capture track.');stage('synthetic-prepared');

  // Start on the renderer's next task so CDP itself is never in the media startup
  // call stack. Once ShareController resolves, the test mirrors Share Integration
  // and commits presenter mode through the real one-way bridge.
  stageBegin('share-start-dispatch');
  await main.eval(`(()=>{setTimeout(()=>{window.__qaPresenterMark('start-task');window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false}}).then(state=>{window.__qaShareStartResult={active:state.active,sourceName:state.sourceName};const video=document.querySelector('#sharedContentVideo');console.log('QA_START_STAGE active='+(state.active?1:0)+' sharedVisible='+(video&&!video.hidden?1:0));window.__qaPresenterMark('start-resolved');window.DominionShareIntegration.commitPresenterMode();window.__qaPresenterMark('presenter-commit-sent');}).catch(error=>{window.__qaShareStartError=String(error?.stack||error?.message||error);window.__qaPresenterMark('start-rejected');});},0);return true;})()`);stage('share-start-dispatched');
  await waitLog('QA_PRESENTER_MILESTONE start-task','scheduled ShareController.start task',6000);
  await waitLog('QA_PRESENTER_MILESTONE getDisplayMedia-return','synthetic getDisplayMedia completion',6000);
  await waitLog('QA_PRESENTER_MILESTONE start-resolved','ShareController.start completion',6000);
  await waitLog('QA_START_STAGE active=1 sharedVisible=1','active shared-content stage before presenter hide',6000);stage('share-start-complete-before-hide');
  await waitLog('QA_PRESENTER_MILESTONE presenter-commit-sent','one-way presenter commit',6000);stage('presenter-commit-sent');

  stageBegin('toolbar-target');
  const toolbarTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('presenter-toolbar.html'),'floating presenter toolbar',18000);
  toolbar=new CdpClient(toolbarTarget.webSocketDebuggerUrl,toolbarErrors);await toolbar.connect();stage('toolbar-connected');
  await toolbar.wait("document.readyState==='complete'&&document.querySelector('[data-command=\"stop\"]')&&document.querySelector('[data-command=\"chat\"]')&&document.querySelector('[data-command=\"participants\"]')&&document.querySelector('[data-command=\"annotate\"]')",'presenter controls',12000);stage('toolbar-controls-ready');
  await toolbar.wait("document.querySelector('#shareSourceLabel')?.textContent==='QA Synthetic Share'",'presenter share state',12000);stage('toolbar-state-ready');

  // During active synthetic capture, prove main-renderer liveness through actual
  // IPC/event effects in stderr rather than CDP Runtime.evaluate.
  stageBegin('pause');
  const pauseCommandsBefore=logCount('QA_PRESENTER_COMMAND pause');
  const pausedTrueBefore=logCount('QA_SHARE_STATE active=1 paused=1');
  await toolbar.eval(`document.querySelector('[data-command="pause"]').click();true`);
  await waitLog('QA_PRESENTER_COMMAND pause','Pause command delivery',8000,pauseCommandsBefore+1);
  await waitLog('QA_SHARE_STATE active=1 paused=1','Pause controller state',10000,pausedTrueBefore+1);
  await toolbar.wait("document.querySelector('#pauseLabel')?.textContent==='Resume'",'Pause toolbar state',10000);stage('pause');

  stageBegin('resume');
  const pauseCommandsResumeBefore=logCount('QA_PRESENTER_COMMAND pause');
  const pausedFalseBefore=logCount('QA_SHARE_STATE active=1 paused=0');
  await toolbar.eval(`document.querySelector('[data-command="pause"]').click();true`);
  await waitLog('QA_PRESENTER_COMMAND pause','Resume command delivery',8000,pauseCommandsResumeBefore+1);
  await waitLog('QA_SHARE_STATE active=1 paused=0','Resume controller state',10000,pausedFalseBefore+1);stage('resume');

  stageBegin('chat');
  const chatCommandsBefore=logCount('QA_PRESENTER_COMMAND chat');
  await toolbar.eval(`document.querySelector('[data-command="chat"]').click();true`);
  await waitLog('QA_PRESENTER_COMMAND chat','Chat command delivery',8000,chatCommandsBefore+1);
  await waitLog('QA_PRESENTER_EFFECT chat active=1 paused=0 companion=chat annotation=0 header=none footer=none stage=none chatVisible=1','compact Chat share companion',8000);stage('chat');
  await waitLog('QA_HARNESS_CLOSE chat','Chat companion harness close',8000);stage('chat-close');

  stageBegin('participants');
  const participantCommandsBefore=logCount('QA_PRESENTER_COMMAND participants');
  await toolbar.eval(`document.querySelector('[data-command="participants"]').click();true`);
  await waitLog('QA_PRESENTER_COMMAND participants','Participants command delivery',8000,participantCommandsBefore+1);
  await waitLog('QA_PRESENTER_EFFECT participants active=1 paused=0 companion=participants annotation=0 header=none footer=none stage=none','compact Participants share companion',8000);stage('participants');
  await waitLog('QA_HARNESS_CLOSE participants','Participants companion harness close',8000);stage('participants-close');

  stageBegin('annotate');
  const annotateCommandsBefore=logCount('QA_PRESENTER_COMMAND annotate');
  await toolbar.eval(`document.querySelector('[data-command="annotate"]').click();true`);
  await waitLog('QA_PRESENTER_COMMAND annotate','Annotate command delivery',8000,annotateCommandsBefore+1);
  await waitLog('QA_PRESENTER_EFFECT annotate active=1 paused=0 companion=annotate annotation=1 header=none footer=none stage=none','Annotation share companion',10000);stage('annotate');
  const annotateCommandsOffBefore=logCount('QA_PRESENTER_COMMAND annotate');
  await toolbar.eval(`document.querySelector('[data-command="annotate"]').click();true`);
  await waitLog('QA_PRESENTER_COMMAND annotate','Annotate-off command delivery',8000,annotateCommandsOffBefore+1);
  await waitLog('QA_PRESENTER_EFFECT annotate active=1 paused=0 companion=none annotation=0','Annotation companion close',10000);stage('annotate-close');

  stageBegin('audio-video');
  const audioBefore=logCount('QA_PRESENTER_COMMAND audio'),videoBefore=logCount('QA_PRESENTER_COMMAND video');
  await toolbar.eval(`document.querySelector('[data-command="audio"]').click();document.querySelector('[data-command="video"]').click();true`);
  await waitLog('QA_PRESENTER_COMMAND audio','Audio presenter command',10000,audioBefore+1);
  await waitLog('QA_PRESENTER_COMMAND video','Video presenter command',10000,videoBefore+1);stage('audio-video-command-path');

  stageBegin('stop');
  const stopBefore=logCount('QA_PRESENTER_COMMAND stop'),inactiveBefore=logCount('QA_SHARE_STATE active=0 paused=0');
  await toolbar.eval(`document.querySelector('[data-command="stop"]').click();true`);
  await waitLog('QA_PRESENTER_COMMAND stop','Stop Share presenter command',10000,stopBefore+1);stage('stop-command-delivered');
  await waitLog('QA_SHARE_STATE active=0 paused=0','Stop Share controller completion',15000,inactiveBefore+1);stage('stop-controller-complete');
  await sleep(500);

  // Once capture has ended CDP should be available again. Reconnect freshly so
  // final restoration assertions cannot inherit a Chromium active-capture CDP stall.
  main.close();main=null;
  const restoredTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').startsWith('file://')&&!String(item.url||'').includes('presenter-toolbar.html'),'restored main renderer',10000);
  main=new CdpClient(restoredTarget.webSocketDebuggerUrl,mainErrors);await main.connect();
  await main.wait("window.DominionShareController.snapshot().active===false&&!document.querySelector('#meetingOverlay').classList.contains('share-active')&&document.querySelector('#sharedContentVideo').hidden",'Stop Share UI restoration',12000);stage('stop-ui-restored');
  const stopped=await main.eval(`(()=>({active:window.DominionShareController.snapshot().active,trackStates:(window.__qaShareStream?.getTracks?.()||[]).map(track=>track.readyState),companion:document.body.dataset.dsShareCompanion||'',commands:[...window.__qaPresenterCommands]}))()`);
  assert.equal(stopped.active,false);assert.ok(stopped.trackStates.every(state=>state==='ended'),'Stop Share must end every synthetic capture track.');assert.equal(stopped.companion,'');for(const required of ['pause','chat','participants','annotate','audio','video','stop'])assert.ok(stopped.commands.includes(required),`Presenter command ${required} did not round-trip.`);stage('stop');

  await sleep(250);
  assert.deepEqual(mainErrors,[],'Main meeting renderer emitted exceptions:\n'+mainErrors.join('\n'));
  assert.deepEqual(toolbarErrors,[],'Presenter toolbar renderer emitted exceptions:\n'+toolbarErrors.join('\n'));
  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged presenter round-trip wrote an uncaught JavaScript error to stderr.');
  console.log('DOMINIONSTAR_PACKAGED_PRESENTER_TOOLBAR_ROUNDTRIP_2_0_22_OK capture-completes-before-hide integration-style-one-way-commit hidden-renderer-event-responsive toolbar-ipc pause-resume compact-chat compact-participants annotation-companion audio-video-command-path stop-share-ends-track restores-meeting no-renderer-errors');
}catch(error){
  failure=error;console.error('PRESENTER_STAGE_FAILURE',error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());
}finally{
  try{await main?.eval(`window.__qaPresenterOff?.();window.__qaShareStateOff?.();window.__qaShareStream?.getTracks?.().forEach(track=>{try{track.stop()}catch{}});document.querySelector('#meetingOverlay')?.classList.remove('share-active');delete document.body.dataset.dsShareCompanion;true`,3000);}catch{}
  toolbar?.close();main?.close();
  try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}
}
process.exit(failure?1:0);