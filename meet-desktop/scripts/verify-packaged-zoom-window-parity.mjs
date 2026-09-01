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

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before responsive Zoom gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(150);}throw new Error('Unable to attach to packaged renderer for responsive Zoom gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Responsive Zoom gate CDP connection timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Responsive Zoom gate CDP connection failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},3500);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}
async function setViewport(width,height=760){await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate(`window.dispatchEvent(new Event('resize'));window.DominionRuntimeStability?.sync?.();true`);await sleep(180);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionZoomAdaptiveParity&&window.DominionPhysicalMacRepair&&window.DominionRuntimeStability&&window.DominionApprovedReferenceParity&&window.DominionMeetingFeatures&&document.querySelector('#meetingOverlay')",'responsive meeting controllers');

  // Prejoin keeps the compact desktop reference; adaptive helper is used here
  // only for the pre-meeting surface, not as the in-meeting layout authority.
  const prejoin=await evaluate(`(()=>{const meeting=document.querySelector('#meetingOverlay'),pre=document.querySelector('#prejoinOverlay');meeting.hidden=true;pre.hidden=false;window.DominionZoomAdaptiveParity.syncPrejoin();const win=pre.querySelector('.prejoin-window'),rect=win.getBoundingClientRect();const labels=[...pre.querySelectorAll('.device-grid label')];const visible=labels.filter(label=>!label.hidden&&getComputedStyle(label).display!=='none');const titles=visible.map(label=>label.querySelector('span')?.textContent?.trim()||'');return {width:Math.round(rect.width),titles,visibleCount:visible.length,overflow:win.scrollWidth-win.clientWidth,preference:Boolean(pre.querySelector('.ds-prejoin-always')),backgrounds:Boolean(pre.querySelector('[data-ds-prejoin-backgrounds]'))};})()`);
  assert.ok(prejoin.width<=565,`Prejoin must remain compact; measured ${prejoin.width}px.`);
  assert.equal(prejoin.visibleCount,2,'Prejoin must expose exactly Microphone and Camera selectors.');
  assert.deepEqual(prejoin.titles.map(x=>x.toLowerCase()).sort(),['camera','microphone']);
  assert.ok(prejoin.overflow<=2,'Prejoin must not horizontally clip device controls.');
  assert.equal(prejoin.preference,true,'Prejoin persistent preview preference is missing.');
  assert.equal(prejoin.backgrounds,true,'Prejoin Backgrounds action is missing.');

  await setViewport(1280,760);
  await evaluate(`(()=>{document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';document.querySelector('#waitingOverlay').hidden=true;const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionApprovedReferenceParity.sync();const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row ds-modern-participant-row" data-participant-id="self" data-participant-name="Local Host" data-participant-role="host"><span class="person-copy"><strong>Local Host</strong><small>You</small></span><span class="participant-actions"></span></div>';const waiting=document.querySelector('#waitingQueue');if(waiting)waiting.innerHTML='';window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();return true;})()`);
  await waitFor("document.querySelector('#roomParticipants')&&document.querySelector('.room-side-head')&&document.querySelector('#meetingChatPanel')",'participant and chat surfaces');

  // Normal desktop width: even one participant uses the right dock. This is the
  // physical-Mac behavior approved after the old centered-card implementation failed.
  await evaluate(`document.querySelector('#roomParticipants').click()`);await sleep(190);
  const desktopParticipants=await evaluate(`(()=>{window.DominionRuntimeStability.syncParticipantsSurface();window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=stage.getBoundingClientRect(),search=panel.querySelector('.zoom-participant-search'),waiting=document.querySelector('#waitingQueueSection');return {innerWidth,mode:panel.dataset.dsRuntimeMode,width:Math.round(pr.width),centerDelta:Math.round(Math.abs((pr.left+pr.width/2)-(br.left+br.width/2))),inside:pr.left>=br.left+10&&pr.right<=br.right-10&&pr.top>=br.top+10&&pr.bottom<=br.bottom-10,stageRightGap:Math.round(br.right-sr.right),searchHidden:Boolean(search?.hidden||getComputedStyle(search).display==='none'),waitingHidden:Boolean(waiting?.hidden||getComputedStyle(waiting).display==='none'),heading:panel.querySelector('.room-side-head strong')?.textContent||''};})()`);
  assert.ok(desktopParticipants.innerWidth>=940,'Desktop viewport fixture did not reach normal desktop width.');
  assert.equal(desktopParticipants.mode,'floating','Desktop Participants must remain a floating Zoom-style window regardless of roster size.');
  assert.ok(desktopParticipants.width>=300&&desktopParticipants.width<=420,'Desktop Participants width is outside the readable bounded range.');
  assert.equal(desktopParticipants.inside,true,'Desktop Participants must remain inside the meeting body.');
  assert.ok(desktopParticipants.centerDelta<=48,'Desktop Participants must open near the center before the user moves it.');
  assert.ok(Math.abs(desktopParticipants.stageRightGap)<=2,'Desktop Participants must float over a full-width stage instead of shrinking it.');
  assert.equal(desktopParticipants.searchHidden,true,'Search must remain hidden for a one-person roster.');
  assert.equal(desktopParticipants.waitingHidden,true,'Empty Waiting Room must not consume space.');
  assert.equal(desktopParticipants.heading,'Participants (1)');

  // Constrained window: panel floats and the stage immediately reclaims full width.
  await setViewport(880,700);
  const constrainedParticipants=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=stage.getBoundingClientRect();return {innerWidth,mode:panel.dataset.dsRuntimeMode,width:Math.round(pr.width),height:Math.round(pr.height),inside:pr.left>=br.left+10&&pr.right<=br.right-10&&pr.top>=br.top+10&&pr.bottom<=br.bottom-10,stageRightGap:Math.round(br.right-sr.right)};})()`);
  assert.ok(constrainedParticipants.innerWidth<940,'Constrained viewport fixture did not apply.');
  assert.equal(constrainedParticipants.mode,'floating','Constrained Participants must keep the same floating model.');
  assert.ok(constrainedParticipants.width<=410,'Floating Participants must remain compact.');
  assert.equal(constrainedParticipants.inside,true,'Floating Participants must remain inside the meeting body.');
  assert.ok(Math.abs(constrainedParticipants.stageRightGap)<=2,'Floating Participants must release reserved stage width.');

  // Restore desktop width and validate intelligent roster order + search threshold.
  await setViewport(1280,760);
  const ordering=await evaluate(`(()=>{const roster=document.querySelector('#participantRoster');const make=(id,name,role,small,micOn=false,raised=false)=>'<div class="person-row ds-modern-participant-row" data-participant-id="'+id+'" data-participant-name="'+name+'" data-participant-role="'+role+'"'+(raised?' data-raised-hand="1"':'')+'><span class="person-copy"><strong>'+name+'</strong><small>'+small+'</small></span><span class="participant-actions"><span class="ds-participant-media"><span class="ds-media-state '+(micOn?'on':'off')+'"></span><span class="ds-media-state off"></span></span></span>'+(raised?'<span class="raised-hand-indicator">✋</span>':'')+'</div>';roster.innerHTML=[make('muted','Muted Member','participant','Participant'),make('quiet','Quiet Member','participant','Participant'),make('raised','Raised Member','participant','Participant',false,true),make('co','Co Host','cohost','Co-host'),make('host','Meeting Host','host','Meeting host'),make('talk','Speaking Member','participant','Participant',true),make('self','Local Member','participant','You')].join('');window.DominionRuntimeStability.syncParticipantsSurface();const rows=[...roster.querySelectorAll('[data-participant-id]')];const search=document.querySelector('.room-side .zoom-participant-search');return {ids:rows.map(row=>row.dataset.participantId),searchVisible:Boolean(search&&!search.hidden&&getComputedStyle(search).display!=='none'),heading:document.querySelector('.room-side-head strong')?.textContent||''};})()`);
  assert.deepEqual(ordering.ids,['self','host','co','raised','talk','muted','quiet'],'Participant order must be You → Host → Co-host → raised hand → unmuted → muted.');
  assert.equal(ordering.searchVisible,true,'Search must become available at the useful roster threshold.');
  assert.equal(ordering.heading,'Participants (7)');
  await evaluate(`window.DominionRuntimeStability.setParticipants(false)`);

  // Chat follows the same floating application-surface contract at every width.
  await evaluate(`window.DominionRuntimeStability.setChat(true);true`);
  await waitFor("!document.querySelector('#meetingChatPanel').hidden&&document.querySelector('#meetingChatPanel .ds-adaptive-chat-nav')&&document.querySelector('#meetingChatPanel .ds-chat-privacy')",'deterministic Chat navigation and privacy chrome');
  const desktopChat=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('#meetingChatPanel'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=stage.getBoundingClientRect();return {mode:panel.dataset.dsRuntimeMode,width:Math.round(pr.width),inside:pr.left>=br.left+10&&pr.right<=br.right-10&&pr.top>=br.top+10&&pr.bottom<=br.bottom-10,stageRightGap:Math.round(br.right-sr.right),nav:Boolean(panel.querySelector('.ds-adaptive-chat-nav')),privacy:Boolean(panel.querySelector('.ds-chat-privacy'))};})()`);
  assert.equal(desktopChat.mode,'floating','Desktop Chat must use the floating window model.');
  assert.ok(desktopChat.width>=300&&desktopChat.width<=420,'Desktop Chat width must remain compact and readable.');
  assert.equal(desktopChat.inside,true,'Desktop Chat must remain inside the meeting body.');
  assert.ok(Math.abs(desktopChat.stageRightGap)<=2,'Desktop Chat must float over a full-width stage.');
  assert.equal(desktopChat.nav,true,'Chat Everyone / New chat navigation is missing.');
  assert.equal(desktopChat.privacy,true,'Chat privacy affordance is missing.');

  await setViewport(880,700);
  const constrainedChat=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('#meetingChatPanel'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=stage.getBoundingClientRect();return {mode:panel.dataset.dsRuntimeMode,width:Math.round(pr.width),inside:pr.left>=br.left+10&&pr.right<=br.right-10&&pr.top>=br.top+10&&pr.bottom<=br.bottom-10,stageRightGap:Math.round(br.right-sr.right)};})()`);
  assert.equal(constrainedChat.mode,'floating','Constrained Chat must float instead of crushing the stage.');
  assert.ok(constrainedChat.width<=360,'Floating Chat must remain compact.');
  assert.equal(constrainedChat.inside,true,'Floating Chat must remain inside the meeting body.');
  assert.ok(Math.abs(constrainedChat.stageRightGap)<=2,'Floating Chat must release stage width.');
  await evaluate(`window.DominionRuntimeStability.setChat(false)`);
  await setViewport(1280,760);

  // Participant video panel still follows the approved Speaker/share threshold.
  const video=await evaluate(`(()=>{window.DominionMeetingParity.applyViewMode('speaker');const overlay=document.querySelector('#meetingOverlay'),dock=document.querySelector('#participantVideoDock'),body=dock.querySelector('.participant-video-dock-body'),roster=document.querySelector('#participantRoster');roster.innerHTML='<div data-participant-id="a"></div><div data-participant-id="b"></div>';body.querySelectorAll('.remote-peer-tile').forEach(n=>n.remove());const one=document.createElement('div');one.className='remote-peer-tile';body.append(one);overlay.classList.remove('share-active');document.body.classList.remove('remote-share-active');window.DominionPhysicalMacRepair.syncVideoDockPolicy();const under3=dock.hidden;roster.insertAdjacentHTML('beforeend','<div data-participant-id="c"></div>');const two=document.createElement('div');two.className='remote-peer-tile';body.append(two);window.DominionPhysicalMacRepair.syncVideoDockPolicy();const over2=!dock.hidden;const cursor=getComputedStyle(dock.querySelector('.participant-video-dock-head')).cursor;overlay.classList.add('share-active');dock.hidden=true;window.DominionPhysicalMacRepair.syncVideoDockPolicy();const onShare=!dock.hidden;overlay.classList.remove('share-active');return {view:overlay.dataset.viewMode||'',under3,over2,onShare,cursor,grip:getComputedStyle(dock.querySelector('.dock-grip')).display};})()`);
  assert.equal(video.view,'speaker','Participant video threshold gate must run in Speaker view.');
  assert.equal(video.under3,true,'One- and two-person Speaker meetings must not force a floating video strip.');
  assert.equal(video.over2,true,'Three-or-more-person Speaker meetings must allow the participant video panel.');
  assert.equal(video.onShare,true,'Screen sharing must show the participant video panel when video tiles are available.');
  assert.equal(video.cursor,'default','Video panel title bar must use the normal arrow cursor.');
  assert.equal(video.grip,'none','Legacy gripping-hand affordance must not be visible.');

  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Responsive Zoom gate detected an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_ZOOM_WINDOW_PARITY_OK compact-prejoin floating-participants-chat full-stage participant-priority search-threshold adaptive-chat speaker-authority video-under3-hidden video-3plus-visible share-video-visible no-grip');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('Responsive Zoom gate shutdown'));}pending.clear();try{await cdp('Emulation.clearDeviceMetricsOverride');}catch{}try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);