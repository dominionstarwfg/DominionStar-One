import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-interactions.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=9300+Math.floor(Math.random()*300);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const CDP_TIMEOUT_MS=1500;
const ATTACH_TIMEOUT_MS=15000;
const CONTROLLER_TIMEOUT_MS=12000;
const HARD_TIMEOUT_MS=45000;
let stderr='';

const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});
const watchdog=setTimeout(()=>{
  console.error('ERROR: Packaged interaction gate exceeded hard timeout.');
  if(stderr.trim())console.error(stderr.trim());
  try{child.kill('SIGKILL');}catch{}
  process.exit(124);
},HARD_TIMEOUT_MS);
watchdog.unref?.();

async function target(){
  const deadline=Date.now()+ATTACH_TIMEOUT_MS;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before interaction test.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(750)});
      if(response.ok){
        const targets=await response.json();
        const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));
        if(page?.webSocketDebuggerUrl)return page;
      }
    }catch{}
    await sleep(200);
  }
  throw new Error(`Unable to attach to packaged Electron renderer within ${ATTACH_TIMEOUT_MS}ms.\n${stderr}`);
}

function connect(url){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url);
    const timer=setTimeout(()=>{try{socket.close();}catch{}reject(new Error('Timed out opening DevTools WebSocket.'));},3000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
    socket.addEventListener('error',event=>{clearTimeout(timer);reject(event?.error||new Error('CDP WebSocket failed.'));},{once:true});
  });
}

let socket=null;
let nextId=0;
let lastPausedEvent=null;
const pauseWaiters=[];
const pending=new Map();
function settlePending(error){for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(error);}pending.clear();}
function cdp(method,params={}){
  return new Promise((resolve,reject)=>{
    if(!socket||socket.readyState!==WebSocket.OPEN)return reject(new Error(`CDP socket is not open for ${method}.`));
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timed out waiting for CDP ${method}.`));},CDP_TIMEOUT_MS);
    pending.set(id,{resolve,reject,timer});
    socket.send(JSON.stringify({id,method,params}));
  });
}
function fireCdp(method,params={}){
  if(!socket||socket.readyState!==WebSocket.OPEN)return;
  socket.send(JSON.stringify({id:++nextId,method,params}));
}
async function evaluate(expression){
  const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');
  return result.result?.value;
}
function formatPausedStack(event){
  const frames=event?.params?.callFrames||[];
  if(!frames.length)return 'Renderer paused without JavaScript call frames.';
  return frames.slice(0,18).map((frame,index)=>{
    const name=frame.functionName||'<anonymous>',url=frame.url||'<inline>',line=(frame.location?.lineNumber??-1)+1,column=(frame.location?.columnNumber??-1)+1;
    return `${index+1}. ${name} — ${url}:${line}:${column}`;
  }).join('\n');
}
function waitPaused(timeoutMs=2500){
  if(lastPausedEvent){const event=lastPausedEvent;lastPausedEvent=null;return Promise.resolve(event);}
  return new Promise(resolve=>{
    const waiter={resolve,timer:0};
    waiter.timer=setTimeout(()=>{const index=pauseWaiters.indexOf(waiter);if(index>=0)pauseWaiters.splice(index,1);resolve(null);},timeoutMs);
    pauseWaiters.push(waiter);
  });
}
async function captureBusyStack(){
  try{
    fireCdp('Debugger.pause');
    const event=await waitPaused();
    const stack=formatPausedStack(event);
    console.error('RENDERER_BUSY_STACK\n'+stack);
    fireCdp('Debugger.resume');
    return stack;
  }catch(error){return `Unable to capture renderer stack: ${error?.message||error}`;}
}
async function evaluateDiagnosed(expression,label){
  try{return await evaluate(expression);}
  catch(error){
    if(String(error?.message||'').includes('Runtime.evaluate')){
      const stack=await captureBusyStack();
      throw new Error(`${label} stalled. ${error.message}\nRenderer busy stack:\n${stack}`);
    }
    throw new Error(`${label} failed. ${error?.message||error}`);
  }
}
async function waitFor(expression,label,timeoutMs=CONTROLLER_TIMEOUT_MS){
  const deadline=Date.now()+timeoutMs;
  let lastError=null;
  while(Date.now()<deadline){
    try{if(await evaluate(`Boolean(${expression})`))return;}catch(error){lastError=error;}
    await sleep(200);
  }
  const busy=lastError&&String(lastError.message).includes('Runtime.evaluate')?await captureBusyStack():'';
  const suffix=lastError?` Last CDP error: ${lastError.message}`:'';
  const stack=busy?`\nRenderer busy stack:\n${busy}`:'';
  throw new Error(`Timed out waiting for ${label} within ${timeoutMs}ms.${suffix}${stack}`);
}
const mark=label=>console.log(`INTERACTION_STAGE_OK ${label}`);

let failure=null;
try{
  const page=await target();mark('renderer-target');
  socket=await connect(page.webSocketDebuggerUrl);mark('debug-socket');
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(message.method==='Debugger.paused'){
      if(pauseWaiters.length){const waiter=pauseWaiters.shift();clearTimeout(waiter.timer);waiter.resolve(message);}else lastPausedEvent=message;
      return;
    }
    if(!message.id)return;
    const waiter=pending.get(message.id);if(!waiter)return;
    pending.delete(message.id);clearTimeout(waiter.timer);
    if(message.error)waiter.reject(new Error(message.error.message||'CDP error'));
    else waiter.resolve(message.result);
  });
  socket.addEventListener('close',()=>settlePending(new Error('CDP WebSocket closed.')));
  await cdp('Runtime.enable');
  await cdp('Debugger.enable');mark('runtime-enabled');
  await waitFor("document.readyState==='complete'&&document.querySelector('#appShell')&&document.querySelector('#newMeetingDialog')&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionShareIntegration&&window.dominionDesktop?.meeting&&window.dominionDesktop?.share","desktop UI + native share controllers");mark('controllers-loaded');

  await evaluate(`(()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=false;
    document.querySelector('#meetingOverlay').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    return true;
  })()`);
  await sleep(250);mark('shell-exposed');

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-action="new-meeting"]').click();return document.querySelector('#newMeetingDialog').open;})()`),true,'New Meeting did not open its dialog.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#newMeetingUsePersonal')&&document.querySelector('#newMeetingPasscode')?.maxLength===7)`),true,'New Meeting is missing Personal Meeting ID choice or 3–7 digit passcode limit.');
  await evaluate(`document.querySelector('#newMeetingDialog').close()`);mark('new-meeting');

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="join"]').click();return document.querySelector('#joinDialog').open;})()`),true,'Join did not open its dialog.');
  await evaluate(`document.querySelector('#joinDialog').close()`);mark('join');

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="schedule"]').click();return document.querySelector('#scheduleDialog').open;})()`),true,'Schedule did not open its dialog.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#scheduleMeetingIdMode')&&document.querySelector('#scheduleRepeat'))`),true,'Schedule is missing Meeting ID or recurrence controls.');
  assert.equal(await evaluate(`(()=>{const mode=document.querySelector('#scheduleMeetingIdMode'),repeat=document.querySelector('#scheduleRepeat');mode.value='personal';mode.dispatchEvent(new Event('change',{bubbles:true}));repeat.value='weekly';repeat.dispatchEvent(new Event('change',{bubbles:true}));return mode.value==='personal'&&repeat.value==='never';})()`),true,'Personal Meeting ID did not prevent a fixed recurring series.');
  await evaluate(`document.querySelector('#scheduleDialog').close()`);mark('schedule');

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="settings"]').click();return document.querySelector('#settingsDialog').open;})()`),true,'Settings did not open.');
  assert.equal(await evaluate(`Boolean([...document.querySelectorAll('#settingsDialog .settings-row strong')].some(node=>node.textContent.trim()==='Personal Room'))`),true,'Settings is missing Personal Room controls.');
  await evaluate(`document.querySelector('#settingsDialog').close()`);mark('settings');

  assert.equal(await evaluate(`(()=>{document.querySelector('.nav-button[data-section="meetings"]').click();return !document.querySelector('#meetingsSection').hidden;})()`),true,'Meetings navigation did not switch sections.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#personalRoomCard')&&document.querySelector('#scheduledMeetingList'))`),true,'Meetings surface is missing Personal Room or scheduled meetings area.');mark('meetings-surface');

  mark('meeting-entry-start');
  await evaluateDiagnosed(`(()=>{
    document.querySelector('#appShell').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;
    window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);
    return true;
  })()`,'meeting-entry transition');
  mark('meeting-entry-complete');
  assert.equal(await evaluate(`Boolean(window.DominionShareIntegration&&document.querySelector('#roomShare'))`),true,'Packaged meeting renderer did not wire the native Share Screen integration.');
  assert.equal(await evaluate(`document.querySelector('#roomShare')?.textContent?.trim()==='Share Screen'`),true,'Packaged meeting Share Screen control is missing or mislabeled.');
  mark('share-integration-wired');
  await sleep(300);
  await waitFor("document.querySelector('#roomParticipants')&&document.querySelector('#roomMore')&&document.querySelector('#roomSettings')&&document.querySelector('#roomChat')&&document.querySelector('#roomReactions')","meeting controls",7000);mark('meeting-controls');

  assert.equal(await evaluate(`(()=>{const side=document.querySelector('.room-side');side.hidden=true;document.querySelector('#roomParticipants').click();return side.hidden===false;})()`),true,'Participants control did not open the management panel.');
  assert.equal(await evaluate(`(()=>{const side=document.querySelector('.room-side');document.querySelector('#roomParticipants').click();return side.hidden===true;})()`),true,'Participants control did not close the management panel.');mark('participants');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomChat').click();return document.querySelector('#meetingChatPanel').hidden===false;})()`),true,'Chat control did not open chat.');
  assert.equal(await evaluate(`(()=>{document.querySelector('#roomChat').click();return document.querySelector('#meetingChatPanel').hidden===true;})()`),true,'Chat control did not close chat.');mark('chat');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomReactions').click();return Boolean(document.querySelector('.meeting-reaction-menu'));})()`),true,'Reactions control did not open its menu.');
  await evaluate(`document.querySelector('.meeting-reaction-menu')?.remove()`);mark('reactions');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomMore').click();return Boolean(document.querySelector('.meeting-more-menu'));})()`),true,'More control did not open its menu.');
  await evaluate(`document.querySelector('.meeting-more-menu')?.remove()`);mark('more');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomSettings').click();return document.querySelector('#settingsDialog').open;})()`),true,'Meeting Settings control did not open Settings.');
  await evaluate(`document.querySelector('#settingsDialog').close()`);mark('meeting-settings');

  const geometry=await evaluate(`(()=>{const body=getComputedStyle(document.querySelector('.meeting-body'));const stage=getComputedStyle(document.querySelector('.stage'));const side=getComputedStyle(document.querySelector('.room-side'));return {bodyDisplay:body.display,stagePosition:stage.position,sidePosition:side.position};})()`);
  assert.equal(geometry.bodyDisplay,'block','Meeting body must be full-stage block layout.');
  assert.equal(geometry.stagePosition,'absolute','Meeting stage must fill the meeting canvas.');
  assert.equal(geometry.sidePosition,'absolute','Participant management panel must overlay the stage.');mark('full-stage-geometry');

  const dock=await evaluate(`(()=>{
    const strip=document.querySelector('#remoteTileStrip')||(()=>{const n=document.createElement('div');n.id='remoteTileStrip';document.querySelector('.stage').append(n);return n;})();
    strip.replaceChildren();
    for(let i=0;i<4;i+=1){const tile=document.createElement('article');tile.className='remote-peer-tile';tile.dataset.participantId='qa-'+i;tile.innerHTML='<video></video><footer><strong>QA</strong></footer>';strip.append(tile);}
    window.DominionMeetingParity.syncVideoDock();
    const node=document.querySelector('#participantVideoDock');
    return {hidden:node.hidden,className:node.className,orientation:node.dataset.orientation,grid:getComputedStyle(node.querySelector('.participant-video-dock-body')).gridTemplateColumns};
  })()`);
  assert.equal(dock.hidden,false,'Four participant tiles must show the floating video dock.');
  assert.match(dock.className,/count-4/,'Four participant tiles must select the four-tile adaptive dock state.');
  assert.ok(String(dock.grid).split(' ').filter(Boolean).length>=2,'Four participant tiles must render as an internal multi-column grid.');mark('adaptive-dock');

  console.log('DOMINIONSTAR_PACKAGED_INTERACTIONS_OK home-dialogs settings personal-room schedule recurrence meeting-panels chat reactions more adaptive-full-stage-dock');
}catch(error){
  failure=error;
  console.error(error?.stack||String(error));
  if(stderr.trim())console.error(stderr.trim());
}finally{
  clearTimeout(watchdog);
  settlePending(new Error('Interaction test shutting down.'));
  try{socket?.close();}catch{}
  try{child.kill('SIGTERM');}catch{}
  await sleep(300);
  if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}
}

process.exit(failure?1:0);
