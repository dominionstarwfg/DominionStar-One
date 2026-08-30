import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-zoom-window-parity.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10640+Math.floor(Math.random()*120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before Zoom window gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(150);}throw new Error('Unable to attach to packaged renderer for Zoom window gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Zoom window gate CDP connection timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Zoom window gate CDP connection failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},3000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionZoomProductionPolish&&window.DominionPhysicalMacRepair&&document.querySelector('#meetingOverlay')",'Zoom window controllers');
  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;window.DominionMeetingParity.install();window.DominionMeetingParity.decorateControls();const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionZoomProductionPolish.sync();window.DominionPhysicalMacRepair.syncVideoDockPolicy();return true;})()`);
  await waitFor("document.querySelector('#participantVideoDock')&&document.querySelector('.room-side-head')&&document.querySelector('#roomParticipants')",'Participants and video dock');

  await evaluate(`document.querySelector('#roomParticipants').click()`);await sleep(100);
  const docked=await evaluate(`(()=>{window.DominionZoomProductionPolish.sync();const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),head=panel.querySelector('.room-side-head'),button=panel.querySelector('.zoom-participant-layout-button');return {mode:panel.dataset.zoomPanelMode,rightGap:Math.round(br.right-pr.right),headCursor:getComputedStyle(head).cursor,button:Boolean(button)};})()`);
  assert.equal(docked.mode,'docked','Participants must open in Zoom current right-docked mode.');
  assert.ok(Math.abs(docked.rightGap)<=20,'Participants default position must be docked at the right edge.');
  assert.equal(docked.headCursor,'default','Participants title bar must use the normal arrow cursor, not a gripping hand.');
  assert.equal(docked.button,true,'Participants Pop Out control is missing.');

  const popout=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body');panel.querySelector('.zoom-participant-layout-button').click();const action=document.querySelector('.zoom-participant-layout-menu button');const label=action?.textContent||'';action?.click();const pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect();return {label,mode:panel.dataset.zoomPanelMode,centerDelta:Math.round(Math.abs((pr.left+pr.width/2)-(br.left+br.width/2))),left:pr.left,top:pr.top,width:pr.width,height:pr.height};})()`);
  assert.equal(popout.label,'Pop Out','Docked Participants menu must offer Pop Out.');
  assert.equal(popout.mode,'popout','Pop Out must switch Participants to floating mode.');
  assert.ok(popout.centerDelta<=40,'Popped-out Participants should initially float near the center of the meeting stage.');

  // Use Chromium's real input pipeline instead of synthetic DOM PointerEvents.
  // This creates a genuine active pointer so pointer capture behaves exactly as it
  // does for a physical mouse and avoids certifying a test-only drag path.
  const dragStart=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),head=panel.querySelector('.room-side-head'),r=panel.getBoundingClientRect(),h=head.getBoundingClientRect();return {left:r.left,top:r.top,x:h.left+Math.min(90,h.width*.35),y:h.top+h.height/2};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x,y:dragStart.y});
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:dragStart.x,y:dragStart.y,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x+74,y:dragStart.y+42,button:'left',buttons:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragStart.x+74,y:dragStart.y+42,button:'left',buttons:0,clickCount:1});
  await sleep(80);
  const dragged=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),head=panel.querySelector('.room-side-head'),after=panel.getBoundingClientRect();return {dx:Math.round(after.left-${dragStart.left}),dy:Math.round(after.top-${dragStart.top}),cursor:getComputedStyle(head).cursor};})()`);
  assert.ok(Math.abs(dragged.dx)>=30||Math.abs(dragged.dy)>=20,'Popped-out Participants panel must be movable from its title bar.');
  assert.equal(dragged.cursor,'default','Dragging Participants must keep the normal arrow cursor.');

  const merged=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body');panel.querySelector('.zoom-participant-layout-button').click();const action=document.querySelector('.zoom-participant-layout-menu button');const label=action?.textContent||'';action?.click();window.DominionZoomProductionPolish.sync();const pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect();return {label,mode:panel.dataset.zoomPanelMode,rightGap:Math.round(br.right-pr.right)};})()`);
  assert.equal(merged.label,'Merge to Meeting','Floating Participants menu must offer Merge to Meeting.');
  assert.equal(merged.mode,'docked');assert.ok(Math.abs(merged.rightGap)<=20,'Merge to Meeting must restore the right-side panel.');

  const video=await evaluate(`(()=>{const dock=document.querySelector('#participantVideoDock'),body=dock.querySelector('.participant-video-dock-body'),roster=document.querySelector('#participantRoster');roster.innerHTML='<div data-participant-id="a"></div><div data-participant-id="b"></div>';body.querySelectorAll('.remote-peer-tile').forEach(n=>n.remove());const one=document.createElement('div');one.className='remote-peer-tile';body.append(one);document.querySelector('#meetingOverlay').classList.remove('share-active');document.body.classList.remove('remote-share-active');window.DominionPhysicalMacRepair.syncVideoDockPolicy();const under3=dock.hidden;roster.insertAdjacentHTML('beforeend','<div data-participant-id="c"></div>');const two=document.createElement('div');two.className='remote-peer-tile';body.append(two);window.DominionPhysicalMacRepair.syncVideoDockPolicy();const over2=!dock.hidden;const cursor=getComputedStyle(dock.querySelector('.participant-video-dock-head')).cursor;document.querySelector('#meetingOverlay').classList.add('share-active');dock.hidden=true;window.DominionPhysicalMacRepair.syncVideoDockPolicy();const onShare=!dock.hidden;document.querySelector('#meetingOverlay').classList.remove('share-active');return {under3,over2,onShare,cursor,grip:getComputedStyle(dock.querySelector('.dock-grip')).display};})()`);
  assert.equal(video.under3,true,'One- and two-person Speaker meetings must not force a floating video strip.');
  assert.equal(video.over2,true,'Three-or-more-person Speaker meetings must allow the participant video panel.');
  assert.equal(video.onShare,true,'Screen sharing must show the participant video panel when video tiles are available.');
  assert.equal(video.cursor,'default','Video panel title bar must use the normal arrow cursor.');
  assert.equal(video.grip,'none','Legacy gripping-hand affordance must not be visible.');

  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Zoom window gate detected an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_ZOOM_WINDOW_PARITY_OK participants-right-default pop-out real-input-drag-arrow merge-to-meeting video-under3-hidden video-3plus-visible share-video-visible no-grip');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('Zoom window gate shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
