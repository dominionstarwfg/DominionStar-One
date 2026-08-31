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

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before adaptive Zoom gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(150);}throw new Error('Unable to attach to packaged renderer for adaptive Zoom gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Adaptive Zoom gate CDP connection timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Adaptive Zoom gate CDP connection failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},3500);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionZoomProductionPolish&&window.DominionPhysicalMacRepair&&window.DominionZoomAdaptiveParity&&window.DominionMeetingFeatures&&document.querySelector('#meetingOverlay')",'adaptive Zoom controllers');

  // ---------- Prejoin physical reference ----------
  const prejoin=await evaluate(`(()=>{const meeting=document.querySelector('#meetingOverlay'),pre=document.querySelector('#prejoinOverlay');meeting.hidden=true;pre.hidden=false;window.DominionZoomAdaptiveParity.syncPrejoin();const win=pre.querySelector('.prejoin-window'),rect=win.getBoundingClientRect();const labels=[...pre.querySelectorAll('.device-grid label')];const visible=labels.filter(label=>!label.hidden&&getComputedStyle(label).display!=='none');const titles=visible.map(label=>label.querySelector('span')?.textContent?.trim()||'');const preference=pre.querySelector('.ds-prejoin-always');const backgrounds=pre.querySelector('[data-ds-prejoin-backgrounds]');return {width:Math.round(rect.width),height:Math.round(rect.height),titles,visibleCount:visible.length,overflow:win.scrollWidth-win.clientWidth,preference:Boolean(preference),backgrounds:Boolean(backgrounds)};})()`);
  assert.ok(prejoin.width<=565,`Prejoin must remain compact; measured ${prejoin.width}px.`);
  assert.equal(prejoin.visibleCount,2,'Prejoin must expose exactly two compact device selectors, not the clipped three-column layout.');
  assert.deepEqual(prejoin.titles.map(x=>x.toLowerCase()).sort(),['camera','microphone'],'Prejoin visible device selectors must be Microphone and Camera.');
  assert.ok(prejoin.overflow<=2,'Prejoin must not horizontally clip device controls.');
  assert.equal(prejoin.preference,true,'Prejoin must include the persistent preview preference.');
  assert.equal(prejoin.backgrounds,true,'Prejoin must expose Backgrounds from the preview.');

  // ---------- One-participant Zoom reference ----------
  await evaluate(`(()=>{document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';document.querySelector('#waitingOverlay').hidden=true;const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingParity.decorateControls();window.DominionZoomProductionPolish.sync();const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row ds-modern-participant-row" data-participant-id="self" data-participant-name="Levismond Aken" data-participant-role="host"><span class="person-copy"><strong>Levismond Aken</strong><small>You</small></span><span class="participant-actions"></span></div>';const waiting=document.querySelector('#waitingQueue');if(waiting)waiting.innerHTML='';const waitingSection=document.querySelector('#waitingQueueSection');if(waitingSection)waitingSection.hidden=false;const side=document.querySelector('.room-side');side.hidden=true;side.dataset.dsAdaptiveInitialized='';side.dataset.dsAdaptiveMode='';side.dataset.zoomPanelMode='docked';window.DominionZoomAdaptiveParity.sync();return true;})()`);
  await waitFor("document.querySelector('#participantVideoDock')&&document.querySelector('.room-side-head')&&document.querySelector('#roomParticipants')",'participant surfaces');
  await evaluate(`document.querySelector('#roomParticipants').click()`);await sleep(120);
  const one=await evaluate(`(()=>{window.DominionZoomAdaptiveParity.syncParticipants();const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),head=panel.querySelector('.room-side-head'),search=panel.querySelector('.zoom-participant-search'),waiting=document.querySelector('#waitingQueueSection'),layout=panel.querySelector('.zoom-participant-layout-button'),heading=head.querySelector('strong')?.textContent||'';return {mode:panel.dataset.zoomPanelMode,adaptive:panel.dataset.dsAdaptiveMode,width:Math.round(pr.width),height:Math.round(pr.height),centerDelta:Math.round(Math.abs((pr.left+pr.width/2)-(br.left+br.width/2))),headCursor:getComputedStyle(head).cursor,searchHidden:Boolean(search?.hidden||getComputedStyle(search).display==='none'),waitingHidden:Boolean(waiting?.hidden||getComputedStyle(waiting).display==='none'),layout:Boolean(layout),heading,rowText:panel.querySelector('#participantRoster .ds-adaptive-role')?.textContent||''};})()`);
  assert.equal(one.mode,'popout','One-participant physical reference must start as a floating participant panel.');
  assert.equal(one.adaptive,'floating');
  assert.ok(one.width<=345,`One-participant panel is too wide: ${one.width}px.`);
  assert.ok(one.height<=410,`One-participant panel is too tall: ${one.height}px.`);
  assert.ok(one.centerDelta<=45,'One-participant panel should initially float near the meeting center.');
  assert.equal(one.headCursor,'default','Floating participant title bar must use the normal arrow cursor.');
  assert.equal(one.searchHidden,true,'Search must be omitted when only one participant exists.');
  assert.equal(one.waitingHidden,true,'Empty Waiting Room must not consume participant-panel space.');
  assert.equal(one.layout,true,'Participant panel layout control is missing.');
  assert.equal(one.heading,'Participants (1)');
  assert.equal(one.rowText,'(Host, me)','Single local host row must read like the physical Zoom reference.');

  // Small floating panel must still be movable with a real Chromium mouse and
  // retain the normal arrow cursor. The probe records hit-testing and the exact
  // browser event stream without weakening the movement assertion.
  const dragStart=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),head=panel.querySelector('.room-side-head'),r=panel.getBoundingClientRect(),h=head.getBoundingClientRect();const x=h.left+Math.min(100,h.width*.42),y=h.top+h.height/2,hit=document.elementFromPoint(x,y);window.__dsParticipantDragProbe={events:[]};for(const type of ['pointerdown','mousedown','pointermove','mousemove','pointerup','mouseup'])window.addEventListener(type,e=>{if(window.__dsParticipantDragProbe.events.length<24)window.__dsParticipantDragProbe.events.push({type,x:Math.round(e.clientX),y:Math.round(e.clientY),target:String(e.target?.id||e.target?.className||e.target?.tagName||''),mode:panel.dataset.zoomPanelMode,adaptive:panel.dataset.dsAdaptiveMode,marker:head.dataset.dsAdaptiveParticipantDrag||'',left:panel.style.getPropertyValue('left'),top:panel.style.getPropertyValue('top'),dragging:panel.classList.contains('dragging')});},true);return {left:r.left,top:r.top,x,y,hit:String(hit?.id||hit?.className||hit?.tagName||''),hitInHead:Boolean(hit&&head.contains(hit)),hitPointer:hit?getComputedStyle(hit).pointerEvents:'',headPointer:getComputedStyle(head).pointerEvents,panelPointer:getComputedStyle(panel).pointerEvents,z:getComputedStyle(panel).zIndex,marker:head.dataset.dsAdaptiveParticipantDrag||'',mode:panel.dataset.zoomPanelMode,adaptive:panel.dataset.dsAdaptiveMode,leftStyle:panel.style.getPropertyValue('left'),topStyle:panel.style.getPropertyValue('top')};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x,y:dragStart.y});
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:dragStart.x,y:dragStart.y,button:'left',buttons:1,clickCount:1});
  const afterPress=await evaluate(`(()=>{const panel=document.querySelector('.room-side');return {left:panel.getBoundingClientRect().left,top:panel.getBoundingClientRect().top,leftStyle:panel.style.getPropertyValue('left'),topStyle:panel.style.getPropertyValue('top'),dragging:panel.classList.contains('dragging'),user:panel.dataset.dsAdaptiveUserPositioned||''};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x+68,y:dragStart.y+38,button:'left',buttons:1});
  const afterMove=await evaluate(`(()=>{const panel=document.querySelector('.room-side');return {left:panel.getBoundingClientRect().left,top:panel.getBoundingClientRect().top,leftStyle:panel.style.getPropertyValue('left'),topStyle:panel.style.getPropertyValue('top'),dragging:panel.classList.contains('dragging'),user:panel.dataset.dsAdaptiveUserPositioned||''};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragStart.x+68,y:dragStart.y+38,button:'left',buttons:0,clickCount:1});
  await sleep(80);
  const dragged=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),head=panel.querySelector('.room-side-head'),after=panel.getBoundingClientRect();return {dx:Math.round(after.left-${dragStart.left}),dy:Math.round(after.top-${dragStart.top}),cursor:getComputedStyle(head).cursor,leftStyle:panel.style.getPropertyValue('left'),topStyle:panel.style.getPropertyValue('top'),dragging:panel.classList.contains('dragging'),user:panel.dataset.dsAdaptiveUserPositioned||'',events:window.__dsParticipantDragProbe?.events||[]};})()`);
  const dragDiagnostic={dragStart,afterPress,afterMove,dragged};
  assert.ok(Math.abs(dragged.dx)>=25||Math.abs(dragged.dy)>=18,`Floating participant panel must move using real mouse input. Diagnostic=${JSON.stringify(dragDiagnostic)}`);
  assert.equal(dragged.cursor,'default','Moving Participants must keep the normal arrow cursor.');

  // Verify Merge -> right dock -> Pop Out remains available even though small
  // meetings begin floating.
  const merged=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body');panel.querySelector('.zoom-participant-layout-button').click();const first=document.querySelector('.zoom-participant-layout-menu button');const firstLabel=first?.textContent||'';first?.click();window.DominionZoomProductionPolish.sync();const docked=panel.dataset.zoomPanelMode;const pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),rightGap=Math.round(br.right-pr.right);panel.querySelector('.zoom-participant-layout-button').click();const second=document.querySelector('.zoom-participant-layout-menu button');const secondLabel=second?.textContent||'';second?.click();return {firstLabel,docked,rightGap,secondLabel,finalMode:panel.dataset.zoomPanelMode};})()`);
  assert.equal(merged.firstLabel,'Merge to Meeting');
  assert.equal(merged.docked,'docked');
  assert.ok(Math.abs(merged.rightGap)<=20,'Merge to Meeting must restore the right-side dock.');
  assert.equal(merged.secondLabel,'Pop Out');
  assert.equal(merged.finalMode,'popout');

  // ---------- Multi-participant intelligent ordering/search ----------
  const ordering=await evaluate(`(()=>{const roster=document.querySelector('#participantRoster');const make=(id,name,role,small,micOn=false,raised=false)=>'<div class="person-row ds-modern-participant-row" data-participant-id="'+id+'" data-participant-name="'+name+'" data-participant-role="'+role+'"'+(raised?' data-raised-hand="1"':'')+'><span class="person-copy"><strong>'+name+'</strong><small>'+small+'</small></span><span class="participant-actions"><span class="ds-participant-media"><span class="ds-media-state '+(micOn?'on':'off')+'"></span><span class="ds-media-state off"></span></span></span>'+(raised?'<span class="raised-hand-indicator">✋</span>':'')+'</div>';roster.innerHTML=[make('muted','Muted Member','participant','Participant',false,false),make('raised','Raised Member','participant','Participant',false,true),make('co','Co Host','cohost','Co-host',false,false),make('host','Meeting Host','host','Meeting host',false,false),make('talk','Speaking Member','participant','Participant',true,false),make('self','Local Member','participant','You',false,false)].join('');const side=document.querySelector('.room-side');side.dataset.dsAdaptiveInitialized='1';window.DominionZoomAdaptiveParity.syncParticipants();const rows=[...roster.querySelectorAll('[data-participant-id]')];const search=side.querySelector('.zoom-participant-search');return {ids:rows.map(row=>row.dataset.participantId),searchVisible:Boolean(search&&!search.hidden&&getComputedStyle(search).display!=='none'),heading:side.querySelector('.room-side-head strong')?.textContent||''};})()`);
  assert.deepEqual(ordering.ids,['self','host','co','raised','talk','muted'],'Participant order must be You → Host → Co-host → raised hand → unmuted → muted.');
  assert.equal(ordering.searchVisible,true,'Search must become available when the participant list grows.');
  assert.equal(ordering.heading,'Participants (6)');

  // ---------- Adaptive Chat ----------
  const chat=await evaluate(`(()=>{window.DominionMeetingFeatures.toggleChat(true);const panel=document.querySelector('#meetingChatPanel'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage');const oldWidth=body.style.width;body.style.setProperty('width','1200px','important');window.DominionZoomAdaptiveParity.syncChat();const wide={mode:panel.dataset.dsAdaptiveMode,stageMargin:parseFloat(getComputedStyle(stage).marginRight)||0,nav:Boolean(panel.querySelector('.ds-adaptive-chat-nav')),privacy:Boolean(panel.querySelector('.ds-chat-privacy')),send:panel.querySelector('#meetingChatForm button[type="submit"]')?.textContent||''};body.style.setProperty('width','900px','important');window.DominionZoomAdaptiveParity.syncChat();const narrow={mode:panel.dataset.dsAdaptiveMode,stageInline:stage.style.marginRight,panelWidth:Math.round(panel.getBoundingClientRect().width)};if(oldWidth)body.style.width=oldWidth;else body.style.removeProperty('width');window.DominionZoomAdaptiveParity.syncChat();return {wide,narrow};})()`);
  assert.equal(chat.wide.mode,'docked','Wide meeting Chat must dock at the right.');
  assert.ok(chat.wide.stageMargin>=340,'Docked Chat must reserve stage width instead of covering the meeting.');
  assert.equal(chat.wide.nav,true,'Adaptive Chat navigation is missing.');
  assert.equal(chat.wide.privacy,true,'Chat privacy affordance is missing.');
  assert.equal(chat.wide.send,'➤','Chat composer must use the compact send control.');
  assert.equal(chat.narrow.mode,'floating','Constrained meeting Chat must float instead of crushing the stage.');
  assert.equal(chat.narrow.stageInline,'','Floating Chat must release reserved stage width.');
  assert.ok(chat.narrow.panelWidth<=365,'Floating Chat must remain compact.');

  // ---------- Participant video panel ----------
  const video=await evaluate(`(()=>{window.DominionMeetingFeatures.toggleChat(false);const dock=document.querySelector('#participantVideoDock'),body=dock.querySelector('.participant-video-dock-body'),roster=document.querySelector('#participantRoster');roster.innerHTML='<div data-participant-id="a"></div><div data-participant-id="b"></div>';body.querySelectorAll('.remote-peer-tile').forEach(n=>n.remove());const one=document.createElement('div');one.className='remote-peer-tile';body.append(one);document.querySelector('#meetingOverlay').classList.remove('share-active');document.body.classList.remove('remote-share-active');window.DominionPhysicalMacRepair.syncVideoDockPolicy();const under3=dock.hidden;roster.insertAdjacentHTML('beforeend','<div data-participant-id="c"></div>');const two=document.createElement('div');two.className='remote-peer-tile';body.append(two);window.DominionPhysicalMacRepair.syncVideoDockPolicy();const over2=!dock.hidden;const cursor=getComputedStyle(dock.querySelector('.participant-video-dock-head')).cursor;document.querySelector('#meetingOverlay').classList.add('share-active');dock.hidden=true;window.DominionPhysicalMacRepair.syncVideoDockPolicy();const onShare=!dock.hidden;document.querySelector('#meetingOverlay').classList.remove('share-active');return {under3,over2,onShare,cursor,grip:getComputedStyle(dock.querySelector('.dock-grip')).display};})()`);
  assert.equal(video.under3,true,'One- and two-person Speaker meetings must not force a floating video strip.');
  assert.equal(video.over2,true,'Three-or-more-person Speaker meetings must allow the participant video panel.');
  assert.equal(video.onShare,true,'Screen sharing must show the participant video panel when video tiles are available.');
  assert.equal(video.cursor,'default','Video panel title bar must use the normal arrow cursor.');
  assert.equal(video.grip,'none','Legacy gripping-hand affordance must not be visible.');

  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Adaptive Zoom gate detected an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_ZOOM_WINDOW_PARITY_OK compact-prejoin one-person-floating real-input-drag merge-popout participant-priority search-when-useful adaptive-chat video-under3-hidden video-3plus-visible share-video-visible no-grip');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('Adaptive Zoom gate shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);