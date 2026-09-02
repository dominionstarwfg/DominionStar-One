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
    await sleep(120);
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
  await waitFor("document.readyState==='complete'&&document.querySelector('#appShell')&&document.querySelector('#newMeetingDialog')&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionShareIntegration&&window.DominionZoomAdaptiveParity&&window.DominionApprovedReferenceParity&&window.DominionRuntimeStability&&window.dominionDesktop?.meeting&&window.dominionDesktop?.share","desktop UI + final physical runtime + native share controllers");mark('controllers-loaded');

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
    window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();
    return true;
  })()`,'meeting-entry transition');
  mark('meeting-entry-complete');
  assert.equal(await evaluate(`Boolean(window.DominionShareIntegration&&document.querySelector('#roomShare'))`),true,'Packaged meeting renderer did not wire the native Share Screen integration.');
  assert.equal(await evaluate(`document.querySelector('#roomShare')?.textContent?.trim()==='Share Screen'`),true,'Packaged meeting Share Screen control is missing or mislabeled.');
  await evaluate(`window.DominionMeetingParity.install();window.DominionMeetingParity.decorateControls();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();true`);
  assert.equal(await evaluate(`document.querySelector('.room-side')?.hidden===true&&document.querySelector('#meetingOverlay')?.classList.contains('participants-hidden')`),true,'Packaged meeting must start with Participants/Waiting Room closed.');
  assert.equal(await evaluate(`Boolean(document.querySelector('.ds-meeting-brand img')&&document.querySelector('.ds-meeting-brand strong')?.textContent==='DominionStar Meet')`),true,'Packaged live meeting header must contain DominionStar logo and name.');
  const approvedToolbar=await evaluate(`(()=>{const expected=window.DominionApprovedReferenceParity.toolbarOrder;const entries=expected.map(id=>{const node=document.querySelector('#'+id),r=node?.getBoundingClientRect();return {id,left:r?.left??-1,visible:Boolean(node&&!node.hidden&&getComputedStyle(node).display!=='none')};});return {expected,visual:entries.filter(entry=>entry.visible).sort((a,b)=>a.left-b.left).map(entry=>entry.id)};})()`);
  assert.deepEqual(approvedToolbar.visual,approvedToolbar.expected,'Packaged primary toolbar must visually remain Audio, Video, Participants, Chat, React, Raise hand, Share, Host Tools, More, End/Leave.');
  assert.equal(await evaluate(`['roomRecord','roomRecordStop','roomSecurity','roomSettings'].every(id=>{const node=document.querySelector('#'+id);return !node||getComputedStyle(node).display==='none';})`),true,'Record/Security/Settings must not leak back onto the primary meeting toolbar.');
  const toolbarGeometryBefore=await evaluate(`window.DominionApprovedReferenceParity.toolbarOrder.map(id=>{const r=document.querySelector('#'+id).getBoundingClientRect();return [id,Math.round(r.left),Math.round(r.width)];})`);
  await sleep(2300);
  const toolbarGeometryAfter=await evaluate(`window.DominionApprovedReferenceParity.toolbarOrder.map(id=>{const r=document.querySelector('#'+id).getBoundingClientRect();return [id,Math.round(r.left),Math.round(r.width)];})`);
  assert.deepEqual(toolbarGeometryAfter,toolbarGeometryBefore,'Primary toolbar geometry changed while idle; controls must not dance left/right during background activity.');
  assert.equal(await evaluate(`window.DominionApprovedReferenceParity.toolbarOrder.every(id=>Boolean(document.querySelector('#'+id+' .ds-control-icon svg'))||id==='roomExitButton')`),true,'Every approved primary meeting control must retain a modern icon.');
  assert.equal(await evaluate(`document.querySelector('#meetDiagnosticsButton')?.hidden!==false`),true,'Diagnostics must not be visible in the normal production meeting UI.');

  // Command-menu compatibility decoration is intentionally done by a narrow
  // direct-body MutationObserver. Do not require that compatibility class in
  // the same JavaScript call stack as the button click.
  await evaluate(`document.querySelector('#roomMore').click();true`);
  await waitFor("document.querySelector('.meeting-more-menu')",'production More menu',2500);
  assert.equal(await evaluate(`(()=>{const menu=document.querySelector('.meeting-more-menu');const text=menu?.textContent||'';menu?.remove();return !text.includes('Diagnostics')&&text.includes('Meeting settings');})()`),true,'Production More menu must contain working secondary controls without Diagnostics.');
  mark('share-integration-wired');
  await sleep(200);
  await waitFor("document.querySelector('#roomParticipants')&&document.querySelector('#roomMore')&&document.querySelector('#roomSettings')&&document.querySelector('#roomChat')&&document.querySelector('#roomReactions')&&document.querySelector('#roomRaiseHand')","meeting controls",7000);mark('meeting-controls');

  assert.equal(await evaluate(`(()=>{const side=document.querySelector('.room-side');document.querySelector('#roomParticipants').click();return side.hidden===false&&!document.querySelector('#meetingOverlay').classList.contains('participants-hidden');})()`),true,'Participants control did not open the management panel on demand.');
  await sleep(190);
  const participantPanelGeometry=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage'),side=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=stage.getBoundingClientRect();return {width:Math.round(side.width),position:getComputedStyle(panel).position,runtime:panel.dataset.dsRuntimeMode,inside:side.left>=br.left+10&&side.right<=br.right-10&&side.top>=br.top+10&&side.bottom<=br.bottom-10,centerDelta:Math.round(Math.abs((side.left+side.width/2)-(br.left+br.width/2))),stageRightGap:Math.round(br.right-sr.right),stageWidth:Math.round(sr.width),bodyWidth:Math.round(br.width)};})()`);
  assert.equal(participantPanelGeometry.position,'absolute','Participant management panel must remain a floating application surface.');
  assert.equal(participantPanelGeometry.runtime,'floating','Desktop-width Participants must open as a floating Zoom-style window.');
  assert.ok(participantPanelGeometry.width>=300&&participantPanelGeometry.width<=420,`Desktop Participants width must remain bounded; received ${participantPanelGeometry.width}px.`);
  assert.equal(participantPanelGeometry.inside,true,'Floating Participants must remain inside the current meeting body.');
  assert.ok(participantPanelGeometry.centerDelta<=48,'Participants must open near the center before the user moves the panel.');
  assert.ok(Math.abs(participantPanelGeometry.stageRightGap)<=2,'Floating Participants must not reserve the right edge or shrink the live stage.');
  assert.ok(Math.abs(participantPanelGeometry.stageWidth-participantPanelGeometry.bodyWidth)<=2,'The live stage must remain full width underneath floating Participants.');
  assert.equal(await evaluate(`(()=>{const side=document.querySelector('.room-side');document.querySelector('#roomParticipants').click();return side.hidden===true;})()`),true,'Participants control did not close the management panel.');mark('participants-floating');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomChat').click();return document.querySelector('#meetingChatPanel').hidden===false;})()`),true,'Chat control did not open chat.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#meetingChatRecipient')&&document.querySelector('#meetingChatInput')&&document.querySelector('#meetingChatForm'))`),true,'Chat must retain recipient targeting, message entry, and send controls under the approved clean chrome.');
  assert.equal(await evaluate(`document.querySelector('#meetingChatRecipient')?.options?.[0]?.value==='everyone'`),true,'Chat must default to Everyone while retaining private-recipient support.');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#meetingChatPanel .meeting-chat-recipient')).display==='none'`),true,'Legacy To: row must remain hidden under the approved Chat chrome.');
  assert.equal(await evaluate(`(()=>{document.querySelector('#roomChat').click();return document.querySelector('#meetingChatPanel').hidden===true;})()`),true,'Chat control did not close chat.');mark('chat');

  await evaluate(`document.querySelector('#roomReactions').click();true`);
  await waitFor("document.querySelector('.meeting-reaction-menu')",'reaction menu',2500);
  assert.equal(await evaluate(`Boolean(document.querySelector('.meeting-reaction-menu'))`),true,'Reactions control did not open its menu.');
  await evaluate(`document.querySelector('.meeting-reaction-menu')?.remove()`);mark('reactions');

  await evaluate(`document.querySelector('#roomMore').click();true`);
  await waitFor("document.querySelector('.meeting-more-menu')",'More menu',2500);
  assert.equal(await evaluate(`Boolean(document.querySelector('.meeting-more-menu'))`),true,'More control did not open its menu.');
  await evaluate(`document.querySelector('.meeting-more-menu')?.remove()`);mark('more');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomSettings').click();return document.querySelector('#settingsDialog').open;})()`),true,'Meeting Settings control did not open Settings.');
  await evaluate(`document.querySelector('#settingsDialog').close()`);mark('meeting-settings');

  const geometry=await evaluate(`(()=>{const body=getComputedStyle(document.querySelector('.meeting-body'));const stage=getComputedStyle(document.querySelector('.stage'));const side=getComputedStyle(document.querySelector('.room-side'));return {bodyDisplay:body.display,stagePosition:stage.position,sidePosition:side.position};})()`);
  assert.equal(geometry.bodyDisplay,'block','Meeting body must be full-stage block layout.');
  assert.equal(geometry.stagePosition,'absolute','Meeting stage must fill the meeting canvas.');
  assert.equal(geometry.sidePosition,'absolute','Participant management must remain an absolute responsive side surface.');mark('full-stage-geometry');

  const dock=await evaluate(`(()=>{
    const strip=document.querySelector('#remoteTileStrip')||(()=>{const n=document.createElement('div');n.id='remoteTileStrip';document.querySelector('.stage').append(n);return n;})();
    strip.replaceChildren();
    for(let i=0;i<4;i+=1){const tile=document.createElement('article');tile.className='remote-peer-tile';tile.dataset.participantId='qa-'+i;tile.innerHTML='<video></video><footer><strong>QA</strong></footer>';strip.append(tile);}
    window.DominionMeetingParity.resetVideoDock();
    window.DominionMeetingParity.syncVideoDock();window.DominionZoomAdaptiveParity.sync();window.DominionApprovedReferenceParity.syncVideoPanel();
    const node=document.querySelector('#participantVideoDock'),stage=document.querySelector('.stage');
    const nr=node.getBoundingClientRect(),sr=stage.getBoundingClientRect();
    return {hidden:node.hidden,className:node.className,orientation:node.dataset.orientation,grid:getComputedStyle(node.querySelector('.participant-video-dock-body')).gridTemplateColumns,rightGap:Math.round(sr.right-nr.right),topGap:Math.round(nr.top-sr.top)};
  })()`);
  assert.equal(dock.hidden,false,'Four participant tiles must show the Zoom-style video filmstrip.');
  assert.match(dock.className,/count-4/,'Four participant tiles must retain the four-tile adaptive dock state.');
  assert.equal(dock.orientation,'vertical','Normal Speaker view must keep the participant filmstrip vertical on the right.');
  assert.ok(dock.rightGap>=8&&dock.rightGap<=24,`Default participant video filmstrip must sit against the right edge; received ${dock.rightGap}px.`);
  assert.ok(dock.topGap>=8&&dock.topGap<=24,`Default participant video filmstrip must start near the upper-right corner; received ${dock.topGap}px.`);
  assert.equal(String(dock.grid).split(' ').filter(Boolean).length,1,'Normal Speaker view must remain a single-column right filmstrip rather than inventing a grid.');
  const shareDock=await evaluate(`(()=>{
    const overlay=document.querySelector('#meetingOverlay'),dock=document.querySelector('#participantVideoDock');
    overlay.classList.add('share-active');window.DominionPreferences?.write?.('shareVideoDock',true);window.DominionPreferences?.write?.('shareSideBySide',false);
    window.DominionMeetingParity.syncShareLayout();window.DominionMeetingParity.syncVideoDock();window.DominionZoomAdaptiveParity.sync();window.DominionApprovedReferenceParity.syncVideoPanel();
    const result={floating:overlay.classList.contains('share-panel-floating'),sideBySide:overlay.classList.contains('share-side-by-side'),orientation:dock.dataset.orientation,right:getComputedStyle(dock).right};
    overlay.classList.remove('share-active');window.DominionMeetingParity.syncShareLayout();window.DominionMeetingParity.syncVideoDock();return result;
  })()`);
  assert.equal(shareDock.floating,true,'Screen sharing must default to the floating participant video panel.');
  assert.equal(shareDock.sideBySide,false,'Side-by-side video must not replace the default floating share dock unless explicitly selected.');
  assert.equal(shareDock.orientation,'vertical','Default share-time video panel must start as a vertical right-side dock.');mark('adaptive-dock');

  console.log('DOMINIONSTAR_PACKAGED_INTERACTIONS_OK home-dialogs settings personal-room schedule recurrence approved-toolbar-stable participants-right-docked clean-chat reactions more zoom-right-filmstrip adaptive-full-stage-dock');
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