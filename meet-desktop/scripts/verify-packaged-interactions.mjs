import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-interactions.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=9300+Math.floor(Math.random()*300),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deadlineMs=45000;let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});
const watchdog=setTimeout(()=>{try{child.kill('SIGKILL');}catch{};console.error(stderr);process.exit(124);},deadlineMs);watchdog.unref?.();

async function targets(){try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)});return response.ok?await response.json():[];}catch{return [];}}
async function waitTarget(predicate,label,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){if(child.exitCode!==null)throw new Error(`Packaged app exited while waiting for ${label}.\n${stderr}`);const item=(await targets()).find(predicate);if(item?.webSocketDebuggerUrl)return item;await sleep(180);}throw new Error(`Timed out waiting for ${label}.\n${stderr}`);}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('CDP socket timeout')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',event=>{clearTimeout(timer);reject(event?.error||new Error('CDP socket error'));},{once:true});});}
function session(socket){let id=0;const pending=new Map();socket.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(!msg.id)return;const item=pending.get(msg.id);if(!item)return;pending.delete(msg.id);clearTimeout(item.timer);msg.error?item.reject(new Error(msg.error.message||'CDP error')):item.resolve(msg.result);});const call=(method,params={})=>new Promise((resolve,reject)=>{const callId=++id,timer=setTimeout(()=>{pending.delete(callId);reject(new Error(`CDP ${method} timeout`));},2500);pending.set(callId,{resolve,reject,timer});socket.send(JSON.stringify({id:callId,method,params}));});const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');return result.result?.value;};return {call,evaluate};}
async function waitFor(evaluate,expression,label,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(180);}throw new Error(`Timed out waiting for ${label}`);}
const mark=value=>console.log(`INTERACTION_STAGE_OK ${value}`);

let socket;
try{
  const page=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('/ui/index.html'),'main desktop renderer');mark('main-target');
  socket=await connect(page.webSocketDebuggerUrl);const {call,evaluate}=session(socket);await call('Runtime.enable');mark('runtime-enabled');
  await waitFor(evaluate,"document.readyState==='complete'&&document.querySelector('#appShell')&&document.querySelector('#meetingOverlay')&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionShareIntegration&&window.DominionPhysicalZoomParity&&window.dominionDesktop?.participants","physical desktop controllers");mark('controllers-loaded');

  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;document.querySelector('#meetingOverlay').hidden=false;window.DominionMeetingParity.install();window.DominionPhysicalZoomParity.normalizeToolbar();return true;})()`);
  await sleep(500);mark('meeting-surface');

  const visibleToolbar=await evaluate(`[...document.querySelector('.meeting-footer').children].filter(n=>n.id&&getComputedStyle(n).display!=='none').map(n=>n.id)`);
  assert.deepEqual(visibleToolbar,['roomMic','roomCamera','roomShare','roomParticipants','roomChat','roomReactions','roomMore','roomExitButton'],'Primary toolbar order changed.');
  assert.equal(await evaluate(`(()=>{const mic=document.querySelector('#roomMic'),cam=document.querySelector('#roomCamera');return mic?.nextElementSibling?.classList.contains('av-device-caret')&&mic.nextElementSibling.dataset.controlFor==='roomMic'&&cam?.nextElementSibling?.classList.contains('av-device-caret')&&cam.nextElementSibling.dataset.controlFor==='roomCamera';})()`),true,'Mic/Video device carets are not physically attached to their controls.');
  assert.equal(await evaluate(`document.querySelectorAll('.meeting-footer>.av-device-caret').length===2`),true,'Toolbar contains orphan/duplicate device-option carets.');
  const before=await evaluate(`['roomMic','roomCamera','roomShare','roomParticipants','roomChat','roomReactions','roomMore','roomExitButton'].map(id=>{const r=document.querySelector('#'+id).getBoundingClientRect();return [id,Math.round(r.left),Math.round(r.width)];})`);await sleep(2300);
  const after=await evaluate(`['roomMic','roomCamera','roomShare','roomParticipants','roomChat','roomReactions','roomMore','roomExitButton'].map(id=>{const r=document.querySelector('#'+id).getBoundingClientRect();return [id,Math.round(r.left),Math.round(r.width)];})`);assert.deepEqual(after,before,'Primary toolbar moved while idle.');mark('stable-attached-toolbar');

  await evaluate(`document.querySelector('#roomParticipants').click()`);
  const participantTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('/ui/participants-window.html'),'floating Participants utility');
  assert.ok(participantTarget,'Participants utility target did not open.');
  assert.equal(await evaluate(`document.querySelector('.room-side')?.hidden===true`),true,'Obsolete inline Participants panel became visible.');mark('native-participants-window');
  await evaluate(`window.dominionDesktop.participants.close()`);await sleep(250);

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomChat').click();return document.querySelector('#meetingChatPanel')?.hidden===false;})()`),true,'Chat did not open.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#meetingChatRecipient')&&document.querySelector('#meetingChatInput'))`),true,'Chat is missing recipient/message controls.');
  await evaluate(`document.querySelector('#roomChat').click()`);mark('chat');
  assert.equal(await evaluate(`(()=>{document.querySelector('#roomReactions').click();return Boolean(document.querySelector('.meeting-reaction-menu'));})()`),true,'Reactions did not open.');await evaluate(`document.querySelector('.meeting-reaction-menu')?.remove()`);mark('reactions');
  assert.equal(await evaluate(`(()=>{document.querySelector('#roomMore').click();return Boolean(document.querySelector('.meeting-more-menu'));})()`),true,'More did not open.');await evaluate(`document.querySelector('.meeting-more-menu')?.remove()`);mark('more');

  await evaluate(`document.querySelector('#roomShare').click()`);
  const pickerTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('/ui/share-picker.html'),'Share source picker');
  assert.ok(pickerTarget,'Independent Share source picker did not open.');
  assert.equal(await evaluate(`!document.querySelector('#screenPermissionDialog')||document.querySelector('#screenPermissionDialog').hidden===true`),true,'Stale Screen Recording permission dialog blocked the source picker.');mark('share-picker-opens-before-permission-recovery');
  await evaluate(`window.dominionDesktop.sharePicker.cancel()`);await sleep(250);

  assert.equal(await evaluate(`Boolean(document.querySelector('#stageAvatar')&&window.DominionPhysicalZoomParity?.syncLocalProfile)`),true,'Camera-off profile fallback is not active.');mark('profile-fallback');
  console.log('DOMINIONSTAR_PACKAGED_INTERACTIONS_OK stable-toolbar attached-carets native-participants chat reactions more direct-share-picker profile-fallback');
}catch(error){console.error(error?.stack||error);if(stderr.trim())console.error(stderr.trim());process.exitCode=1;}
finally{clearTimeout(watchdog);try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null){try{child.kill('SIGKILL');}catch{}}}
