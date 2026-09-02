import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-presenter-toolbar-roundtrip-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10880+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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
    this.socket=await new Promise((resolve,reject)=>{const socket=new WebSocket(this.url),timer=setTimeout(()=>reject(new Error('CDP connection timeout.')),3500);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connection failed.'));},{once:true});});
    this.socket.addEventListener('message',event=>{
      const message=JSON.parse(String(event.data));
      if(message.method==='Runtime.exceptionThrown'){this.errorSink.push(message.params?.exceptionDetails?.exception?.description||message.params?.exceptionDetails?.text||'Runtime exception');return;}
      if(!message.id)return;const waiter=this.pending.get(message.id);if(!waiter)return;this.pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);
    });
    await this.call('Runtime.enable');
  }
  call(method,params={}){return new Promise((resolve,reject)=>{const id=++this.nextId,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},4500);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
  async wait(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`))return;}catch{}await sleep(100);}throw new Error(`Timed out waiting for ${label}.`);}
  close(){for(const [,waiter] of this.pending){clearTimeout(waiter.timer);waiter.reject(new Error('CDP shutdown'));}this.pending.clear();try{this.socket?.close();}catch{}}
}

let main=null,toolbar=null,failure=null;
try{
  const mainTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').startsWith('file://')&&!String(item.url||'').includes('presenter-toolbar.html'),'main meeting renderer');
  main=new CdpClient(mainTarget.webSocketDebuggerUrl,mainErrors);await main.connect();
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.DominionRuntimeStability&&window.DominionMeetingParity&&window.DominionShareAnnotation&&window.dominionDesktop?.share?.captureStarted",'share controllers');

  // Expose the actual meeting UI and use a synthetic Chromium MediaStream so
  // this gate can exercise the real presenter IPC without requesting macOS TCC.
  const started=await main.eval(`(async()=>{
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
    const state=await window.DominionShareController.start({name:'QA Synthetic Share',options:{shareAudio:false,optimizeVideo:false}});
    return {active:state.active,sourceName:state.sourceName,tracks:stream.getTracks().length};
  })()`);
  assert.equal(started.active,true,'Synthetic packaged share did not become active.');
  assert.equal(started.sourceName,'QA Synthetic Share');
  assert.ok(started.tracks>=1,'Synthetic share stream has no capture track.');
  await main.wait("document.querySelector('#meetingOverlay').classList.contains('share-active')&&document.querySelector('#sharedContentVideo')&&!document.querySelector('#sharedContentVideo').hidden",'active shared-content stage');
  await main.wait("document.querySelector('#sharedContentVideo').readyState>=2",'synthetic shared video frame',8000);

  const toolbarTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('presenter-toolbar.html'),'floating presenter toolbar');
  toolbar=new CdpClient(toolbarTarget.webSocketDebuggerUrl,toolbarErrors);await toolbar.connect();
  await toolbar.wait("document.readyState==='complete'&&document.querySelector('[data-command=\"stop\"]')&&document.querySelector('[data-command=\"chat\"]')&&document.querySelector('[data-command=\"participants\"]')&&document.querySelector('[data-command=\"annotate\"]')",'presenter controls');
  await toolbar.wait("document.querySelector('#shareSourceLabel')?.textContent==='QA Synthetic Share'",'presenter share state');

  // Pause/Resume must round-trip through the actual toolbar -> main IPC -> hidden
  // meeting renderer -> ShareController path.
  await toolbar.eval(`document.querySelector('[data-command="pause"]').click()`);
  await main.wait("window.DominionShareController.snapshot().paused===true",'Pause command acknowledgement');
  await toolbar.wait("document.querySelector('#pauseLabel')?.textContent==='Resume'",'Pause toolbar state');
  await toolbar.eval(`document.querySelector('[data-command="pause"]').click()`);
  await main.wait("window.DominionShareController.snapshot().paused===false",'Resume command acknowledgement');

  // Chat must open only the compact companion state; it may not restore normal
  // meeting chrome while a screen share is active.
  await toolbar.eval(`document.querySelector('[data-command="chat"]').click()`);
  await main.wait("document.body.dataset.dsShareCompanion==='chat'&&!document.querySelector('#meetingChatPanel').hidden",'Chat share companion');
  const chat=await main.eval(`(()=>({command:window.__qaPresenterCommands.includes('chat'),companion:document.body.dataset.dsShareCompanion,header:getComputedStyle(document.querySelector('.meeting-head')).display,footer:getComputedStyle(document.querySelector('.meeting-footer')).display,stage:getComputedStyle(document.querySelector('.stage')).display,chat:getComputedStyle(document.querySelector('#meetingChatPanel')).display}))()`);
  assert.equal(chat.command,true,'Chat toolbar command never reached the meeting renderer.');
  assert.equal(chat.companion,'chat');
  assert.equal(chat.header,'none','Chat companion must not resurrect normal meeting header.');
  assert.equal(chat.footer,'none','Chat companion must not resurrect normal meeting toolbar.');
  assert.equal(chat.stage,'none','Chat companion must not expose full meeting video stage.');
  assert.notEqual(chat.chat,'none','Chat companion itself must remain visible.');
  await main.eval(`window.DominionRuntimeStability.setChat(false)`);
  await main.wait("!document.body.dataset.dsShareCompanion",'Chat companion close');

  // Participants follows the same compact companion contract.
  await toolbar.eval(`document.querySelector('[data-command="participants"]').click()`);
  await main.wait("document.body.dataset.dsShareCompanion==='participants'&&!document.querySelector('.room-side').hidden",'Participants share companion');
  const participants=await main.eval(`(()=>({command:window.__qaPresenterCommands.includes('participants'),header:getComputedStyle(document.querySelector('.meeting-head')).display,footer:getComputedStyle(document.querySelector('.meeting-footer')).display,stage:getComputedStyle(document.querySelector('.stage')).display,panel:getComputedStyle(document.querySelector('.room-side')).display}))()`);
  assert.equal(participants.command,true,'Participants toolbar command never reached the meeting renderer.');
  assert.equal(participants.header,'none');assert.equal(participants.footer,'none');assert.equal(participants.stage,'none');assert.notEqual(participants.panel,'none');
  await main.eval(`window.DominionRuntimeStability.setParticipants(false)`);
  await main.wait("!document.body.dataset.dsShareCompanion",'Participants companion close');

  // Annotation must activate against the live shared-content canvas, not by
  // reopening the ordinary meeting UI.
  await toolbar.eval(`document.querySelector('[data-command="annotate"]').click()`);
  await main.wait("document.body.dataset.dsShareCompanion==='annotate'&&window.DominionShareAnnotation.snapshot().active===true",'Annotation share companion');
  const annotate=await main.eval(`(()=>({command:window.__qaPresenterCommands.includes('annotate'),active:window.DominionShareAnnotation.snapshot().active,header:getComputedStyle(document.querySelector('.meeting-head')).display,footer:getComputedStyle(document.querySelector('.meeting-footer')).display,canvasVisible:getComputedStyle(document.querySelector('.share-annotation-overlay')).display!=='none'}))()`);
  assert.equal(annotate.command,true,'Annotate toolbar command never reached the meeting renderer.');
  assert.equal(annotate.active,true);assert.equal(annotate.header,'none');assert.equal(annotate.footer,'none');assert.equal(annotate.canvasVisible,true);
  await toolbar.eval(`document.querySelector('[data-command="annotate"]').click()`);
  await main.wait("window.DominionShareAnnotation.snapshot().active===false&&!document.body.dataset.dsShareCompanion",'Annotation companion close');

  // Audio/video buttons must at least traverse the real toolbar IPC path. Their
  // device mutation itself is independently certified by media-authority gates.
  await toolbar.eval(`document.querySelector('[data-command="audio"]').click();document.querySelector('[data-command="video"]').click()`);
  await main.wait("window.__qaPresenterCommands.includes('audio')&&window.__qaPresenterCommands.includes('video')",'Audio/video presenter command round-trip');

  // Stop Share is the critical physical regression: a real toolbar click must
  // stop the active MediaStream, clear share UI, call captureStopped, and restore
  // the normal meeting renderer. No manual cleanup is allowed before assertions.
  await toolbar.eval(`document.querySelector('[data-command="stop"]').click()`);
  await main.wait("window.__qaPresenterCommands.includes('stop')",'Stop Share presenter command');
  await main.wait("window.DominionShareController.snapshot().active===false",'Stop Share controller completion',8000);
  await main.wait("!document.querySelector('#meetingOverlay').classList.contains('share-active')&&document.querySelector('#sharedContentVideo').hidden",'Stop Share UI restoration',8000);
  const stopped=await main.eval(`(()=>({active:window.DominionShareController.snapshot().active,trackStates:(window.__qaShareStream?.getTracks?.()||[]).map(track=>track.readyState),companion:document.body.dataset.dsShareCompanion||'',commands:[...window.__qaPresenterCommands]}))()`);
  assert.equal(stopped.active,false);
  assert.ok(stopped.trackStates.every(state=>state==='ended'),'Stop Share must end every synthetic capture track.');
  assert.equal(stopped.companion,'');
  for(const required of ['pause','chat','participants','annotate','audio','video','stop'])assert.ok(stopped.commands.includes(required),`Presenter command ${required} did not round-trip.`);

  await sleep(250);
  assert.deepEqual(mainErrors,[],'Main meeting renderer emitted exceptions:\n'+mainErrors.join('\n'));
  assert.deepEqual(toolbarErrors,[],'Presenter toolbar renderer emitted exceptions:\n'+toolbarErrors.join('\n'));
  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged presenter round-trip wrote an uncaught JavaScript error to stderr.');
  console.log('DOMINIONSTAR_PACKAGED_PRESENTER_TOOLBAR_ROUNDTRIP_2_0_22_OK synthetic-live-share toolbar-ipc pause-resume compact-chat compact-participants annotation-companion audio-video-command-path stop-share-ends-track restores-meeting no-renderer-errors');
}catch(error){
  failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());
}finally{
  try{await main?.eval(`window.__qaPresenterOff?.();window.__qaShareStream?.getTracks?.().forEach(track=>{try{track.stop()}catch{}});document.querySelector('#meetingOverlay')?.classList.remove('share-active');delete document.body.dataset.dsShareCompanion;true`);}catch{}
  toolbar?.close();main?.close();
  try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}
}
process.exit(failure?1:0);
