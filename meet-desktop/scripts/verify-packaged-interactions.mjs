import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-interactions.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=9300+Math.floor(Math.random()*300);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';

const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){
  for(let i=0;i<80;i+=1){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before interaction test.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`);
      if(response.ok){
        const targets=await response.json();
        const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));
        if(page?.webSocketDebuggerUrl)return page;
      }
    }catch{}
    await sleep(250);
  }
  throw new Error(`Unable to attach to packaged Electron renderer.\n${stderr}`);
}

function connect(url){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url);
    socket.addEventListener('open',()=>resolve(socket),{once:true});
    socket.addEventListener('error',event=>reject(event?.error||new Error('CDP WebSocket failed.')),{once:true});
  });
}

const page=await target();
const socket=await connect(page.webSocketDebuggerUrl);
let nextId=0;
const pending=new Map();
socket.addEventListener('message',event=>{
  const message=JSON.parse(String(event.data));
  if(!message.id)return;
  const waiter=pending.get(message.id);if(!waiter)return;
  pending.delete(message.id);
  if(message.error)waiter.reject(new Error(message.error.message||'CDP error'));
  else waiter.resolve(message.result);
});
function cdp(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');
  return result.result?.value;
}
async function waitFor(expression,label){
  for(let i=0;i<60;i+=1){
    try{if(await evaluate(`Boolean(${expression})`))return;}catch{}
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

try{
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&document.querySelector('#appShell')&&document.querySelector('#newMeetingDialog')&&window.DominionMeetingParity&&window.DominionMeetingFeatures","desktop UI controllers");

  // Authentication is independently certified. This interaction gate exposes the
  // already-loaded local shell only to exercise packaged controls without a QA account.
  await evaluate(`(()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=false;
    document.querySelector('#meetingOverlay').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    return true;
  })()`);
  await sleep(400);

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-action="new-meeting"]').click();return document.querySelector('#newMeetingDialog').open;})()`),true,'New Meeting did not open its dialog.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#newMeetingUsePersonal')&&document.querySelector('#newMeetingPasscode')?.maxLength===7)`),true,'New Meeting is missing Personal Meeting ID choice or 3–7 digit passcode limit.');
  await evaluate(`document.querySelector('#newMeetingDialog').close()`);

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="join"]').click();return document.querySelector('#joinDialog').open;})()`),true,'Join did not open its dialog.');
  await evaluate(`document.querySelector('#joinDialog').close()`);

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="schedule"]').click();return document.querySelector('#scheduleDialog').open;})()`),true,'Schedule did not open its dialog.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#scheduleMeetingIdMode')&&document.querySelector('#scheduleRepeat'))`),true,'Schedule is missing Meeting ID or recurrence controls.');
  assert.equal(await evaluate(`(()=>{const mode=document.querySelector('#scheduleMeetingIdMode'),repeat=document.querySelector('#scheduleRepeat');mode.value='personal';mode.dispatchEvent(new Event('change',{bubbles:true}));repeat.value='weekly';repeat.dispatchEvent(new Event('change',{bubbles:true}));return mode.value==='personal'&&repeat.value==='never';})()`),true,'Personal Meeting ID did not prevent a fixed recurring series.');
  await evaluate(`document.querySelector('#scheduleDialog').close()`);

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="settings"]').click();return document.querySelector('#settingsDialog').open;})()`),true,'Settings did not open.');
  assert.equal(await evaluate(`Boolean([...document.querySelectorAll('#settingsDialog .settings-row strong')].some(node=>node.textContent.trim()==='Personal Room'))`),true,'Settings is missing Personal Room controls.');
  await evaluate(`document.querySelector('#settingsDialog').close()`);

  assert.equal(await evaluate(`(()=>{document.querySelector('.nav-button[data-section="meetings"]').click();return !document.querySelector('#meetingsSection').hidden;})()`),true,'Meetings navigation did not switch sections.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#personalRoomCard')&&document.querySelector('#scheduledMeetingList'))`),true,'Meetings surface is missing Personal Room or scheduled meetings area.');

  await evaluate(`(()=>{
    document.querySelector('#appShell').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;
    window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);
    return true;
  })()`);
  await sleep(500);
  await waitFor("document.querySelector('#roomParticipants')&&document.querySelector('#roomMore')&&document.querySelector('#roomSettings')&&document.querySelector('#roomChat')&&document.querySelector('#roomReactions')","meeting controls");

  assert.equal(await evaluate(`(()=>{const side=document.querySelector('.room-side');side.hidden=true;document.querySelector('#roomParticipants').click();return side.hidden===false;})()`),true,'Participants control did not open the management panel.');
  assert.equal(await evaluate(`(()=>{const side=document.querySelector('.room-side');document.querySelector('#roomParticipants').click();return side.hidden===true;})()`),true,'Participants control did not close the management panel.');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomChat').click();return document.querySelector('#meetingChatPanel').hidden===false;})()`),true,'Chat control did not open chat.');
  assert.equal(await evaluate(`(()=>{document.querySelector('#roomChat').click();return document.querySelector('#meetingChatPanel').hidden===true;})()`),true,'Chat control did not close chat.');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomReactions').click();return Boolean(document.querySelector('.meeting-reaction-menu'));})()`),true,'Reactions control did not open its menu.');
  await evaluate(`document.querySelector('.meeting-reaction-menu')?.remove()`);

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomMore').click();return Boolean(document.querySelector('.meeting-more-menu'));})()`),true,'More control did not open its menu.');
  await evaluate(`document.querySelector('.meeting-more-menu')?.remove()`);

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomSettings').click();return document.querySelector('#settingsDialog').open;})()`),true,'Meeting Settings control did not open Settings.');
  await evaluate(`document.querySelector('#settingsDialog').close()`);

  const geometry=await evaluate(`(()=>{const body=getComputedStyle(document.querySelector('.meeting-body'));const stage=getComputedStyle(document.querySelector('.stage'));const side=getComputedStyle(document.querySelector('.room-side'));return {bodyDisplay:body.display,stagePosition:stage.position,sidePosition:side.position};})()`);
  assert.equal(geometry.bodyDisplay,'block','Meeting body must be full-stage block layout.');
  assert.equal(geometry.stagePosition,'absolute','Meeting stage must fill the meeting canvas.');
  assert.equal(geometry.sidePosition,'absolute','Participant management panel must overlay the stage.');

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
  assert.ok(String(dock.grid).split(' ').filter(Boolean).length>=2,'Four participant tiles must render as an internal multi-column grid.');

  console.log('DOMINIONSTAR_PACKAGED_INTERACTIONS_OK home-dialogs settings personal-room schedule recurrence meeting-panels chat reactions more adaptive-full-stage-dock');
}finally{
  try{socket.close();}catch{}
  try{child.kill('SIGTERM');}catch{}
  await sleep(300);
  if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}
}
