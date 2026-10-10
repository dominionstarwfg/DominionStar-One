import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-runtime-stability-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='',stdoutLog='',stdoutBuffer='',rpcId=0;
const rpcPending=new Map();
const child=spawn(executable,[],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},
  stdio:['pipe','pipe','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});
child.stdout.on('data',chunk=>{
  const text=String(chunk);stdoutLog+=text;stdoutBuffer+=text;
  while(stdoutBuffer.includes('\n')){
    const cut=stdoutBuffer.indexOf('\n'),line=stdoutBuffer.slice(0,cut).trim();stdoutBuffer=stdoutBuffer.slice(cut+1);
    if(!line.startsWith('DOMINIONSTAR_QA_RPC '))continue;
    let message=null;try{message=JSON.parse(line.slice('DOMINIONSTAR_QA_RPC '.length));}catch{continue;}
    const waiter=rpcPending.get(Number(message?.id)||0);if(!waiter)continue;
    rpcPending.delete(Number(message.id));clearTimeout(waiter.timer);
    message.ok?waiter.resolve(message.value):waiter.reject(new Error(String(message.error||'qa_rpc_failed')));
  }
});

function rpc(method,payload={},timeout=4500){
  return new Promise((resolve,reject)=>{
    if(child.exitCode!==null)return reject(new Error(`Packaged app exited before QA RPC ${method}.\n${stderr}`));
    const id=++rpcId,timer=setTimeout(()=>{rpcPending.delete(id);reject(new Error(`QA RPC timeout ${method}`));},timeout);
    rpcPending.set(id,{resolve,reject,timer});
    try{child.stdin.write(JSON.stringify({id,method,...payload})+'\n');}
    catch(error){clearTimeout(timer);rpcPending.delete(id);reject(error);}
  });
}
async function evaluate(expression,retry=true){
  try{return await rpc('evaluate',{expression},5000);}
  catch(error){
    if(/DOMINIONSTAR_RENDERER_GONE/.test(stderr))throw new Error(`Renderer crashed during packaged runtime gate.\n${stderr}`);
    if(!retry)throw error;
    await sleep(120);
    return evaluate(expression,false);
  }
}
async function waitForMainRenderer(timeout=15000){
  const deadline=Date.now()+timeout;let lastState=null,lastError='';
  while(Date.now()<deadline){
    try{
      lastState=await rpc('state',{},1800);
      if(lastState?.crashed)throw new Error('renderer_crashed');
      if(lastState?.domReady&&/\/index\.html(?:[?#]|$)/i.test(String(lastState?.url||'')))return lastState;
    }catch(error){lastError=String(error?.message||error);}
    await sleep(90);
  }
  throw new Error(`Timed out waiting for packaged main renderer DOM readiness. lastError=${lastError||'none'} state=${JSON.stringify(lastState)}`);
}
async function waitFor(expression,label,timeout=12000){
  const deadline=Date.now()+timeout;let lastError='';
  while(Date.now()<deadline){
    try{if(await evaluate(`Boolean(${expression})`))return;}catch(error){lastError=String(error?.message||error);if(/Renderer crashed/.test(lastError))throw error;}
    await sleep(90);
  }
  let state=null;try{state=await rpc('state',{},1500);}catch{}
  throw new Error(`Timed out waiting for ${label}. lastError=${lastError||'none'} state=${JSON.stringify(state)}`);
}
async function cdp(method,params={}){
  if(method!=='Input.dispatchMouseEvent')throw new Error(`Unsupported packaged QA command ${method}`);
  return rpc('input',{event:params});
}

let failure=null;
try{
  await waitForMainRenderer();
  await waitFor("document.readyState==='interactive'||document.readyState==='complete'",'packaged renderer document readiness');
  try{
    await waitFor("document.readyState==='complete'&&window.DominionRuntimeStability&&window.DominionWebRTCController&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&document.querySelector('#meetingOverlay')",'stable live meeting and transport controllers');
  }catch(error){
    const readiness=await evaluate(`(()=>({readyState:document.readyState,runtime:Boolean(window.DominionRuntimeStability),webrtc:Boolean(window.DominionWebRTCController),parity:Boolean(window.DominionMeetingParity),features:Boolean(window.DominionMeetingFeatures),overlay:Boolean(document.querySelector('#meetingOverlay')),webrtcScript:Boolean([...document.scripts].some(s=>String(s.src||'').endsWith('/webrtc-controller.js'))),runtimeScript:Boolean([...document.scripts].some(s=>String(s.src||'').endsWith('/runtime-stability.js')))}))()`).catch(()=>null);
    throw new Error(`${error.message} readiness=${JSON.stringify(readiness)}`);
  }
  await waitFor("Array.from(document.styleSheets).some(sheet=>String(sheet.href||'').endsWith('/runtime-motion.css'))",'runtime motion stylesheet');
  await waitFor("Array.from(document.styleSheets).some(sheet=>String(sheet.href||'').endsWith('/webrtc.css'))&&Array.from(document.styleSheets).some(sheet=>String(sheet.href||'').endsWith('/runtime-stability.css'))",'live WebRTC and runtime stability stylesheets');
  const liveRuntimeWiring=await evaluate(`(()=>({webrtc:Boolean(window.DominionWebRTCController),runtime:Boolean(window.DominionRuntimeStability),webrtcScript:[...document.scripts].filter(s=>String(s.src||'').endsWith('/webrtc-controller.js')).length,runtimeScript:[...document.scripts].filter(s=>String(s.src||'').endsWith('/runtime-stability.js')).length,webrtcCss:[...document.styleSheets].filter(s=>String(s.href||'').endsWith('/webrtc.css')).length,runtimeCss:[...document.styleSheets].filter(s=>String(s.href||'').endsWith('/runtime-stability.css')).length,lastStyle:String([...document.querySelectorAll('link[rel="stylesheet"]')].at(-1)?.getAttribute('href')||'')}))()`);
  assert.deepEqual({webrtc:liveRuntimeWiring.webrtc,runtime:liveRuntimeWiring.runtime,webrtcScript:liveRuntimeWiring.webrtcScript,runtimeScript:liveRuntimeWiring.runtimeScript,webrtcCss:liveRuntimeWiring.webrtcCss,runtimeCss:liveRuntimeWiring.runtimeCss},{webrtc:true,runtime:true,webrtcScript:1,runtimeScript:1,webrtcCss:1,runtimeCss:1},`Packaged live meeting runtime wiring is incomplete or duplicated. ${JSON.stringify(liveRuntimeWiring)}`);
  assert.equal(liveRuntimeWiring.lastStyle,'./runtime-stability.css',`Runtime stability stylesheet must own the final packaged meeting cascade. ${JSON.stringify(liveRuntimeWiring)}`);

  await evaluate(`(()=>{for(const dialog of document.querySelectorAll('dialog[open]')){try{dialog.close();}catch{dialog.removeAttribute('open');}}document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row" data-participant-id="self" data-participant-role="host" data-participant-name="QA Host"><span class="person-badge">QH</span><span class="person-copy"><strong>QA Host</strong><small>You</small></span></div>';window.DominionRuntimeStability.sync();return true;})()`);
  await waitFor("document.querySelector('#meetingOverlay').dataset.dsRuntimeStable==='1'&&document.querySelector('#roomParticipants')&&document.querySelector('#roomChat')",'runtime-stable meeting');

  const viewport=await evaluate(`(()=>{window.DominionRuntimeStability.sync();const overlay=document.querySelector('#meetingOverlay').getBoundingClientRect(),shell=document.querySelector('.meeting-shell').getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect();return {innerWidth,innerHeight,overlay:{x:Math.round(overlay.x),y:Math.round(overlay.y),w:Math.round(overlay.width),h:Math.round(overlay.height)},shell:{w:Math.round(shell.width),h:Math.round(shell.height)},body:{w:Math.round(body.width),h:Math.round(body.height)}};})()`);
  assert.ok(Math.abs(viewport.overlay.w-viewport.innerWidth)<=1,`Meeting overlay must fill the Electron viewport width. ${JSON.stringify(viewport)}`);
  assert.ok(Math.abs(viewport.overlay.h-viewport.innerHeight)<=1,`Meeting overlay must fill the Electron viewport height. ${JSON.stringify(viewport)}`);
  assert.equal(viewport.overlay.x,0);assert.equal(viewport.overlay.y,0);
  assert.ok(Math.abs(viewport.shell.w-viewport.innerWidth)<=1,'Meeting shell must expand with the window.');

  await evaluate(`document.querySelector('#roomParticipants').click()`);await sleep(45);
  const participantsImmediate=await evaluate(`(()=>{const side=document.querySelector('.room-side'),chat=document.querySelector('#meetingChatPanel'),stage=document.querySelector('.stage'),body=document.querySelector('.meeting-body');const sr=side.getBoundingClientRect(),st=stage.getBoundingClientRect(),br=body.getBoundingClientRect();return {participantsOpen:!side.hidden,chatClosed:chat.hidden,mode:side.dataset.dsRuntimeMode,rightGap:Math.round(br.right-sr.right),inside:sr.left>=br.left+10&&sr.right<=br.right-10&&sr.top>=br.top+10&&sr.bottom<=br.bottom-10,stageRightGap:Math.round(br.right-st.right),panelWidth:Math.round(sr.width),panelHeight:Math.round(sr.height),centerDeltaX:Math.round((sr.left+sr.width/2)-(br.left+br.width/2)),centerDeltaY:Math.round((sr.top+sr.height/2)-(br.top+br.height/2)),count:side.querySelector('.room-side-head strong')?.textContent||'',animation:getComputedStyle(side).animationName,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,motionSheetLoaded:Array.from(document.styleSheets).some(sheet=>String(sheet.href||'').endsWith('/runtime-motion.css'))};})()`);
  assert.equal(participantsImmediate.participantsOpen,true,'Participants must open immediately on Participants click.');
  assert.equal(participantsImmediate.chatClosed,true,'Opening Participants must keep Chat closed.');
  assert.equal(participantsImmediate.mode,'floating','Participants must open as a floating Zoom-style window at desktop width.');
  assert.equal(participantsImmediate.inside,true,'Floating Participants must remain inside the meeting body.');
  assert.ok(Math.abs(participantsImmediate.centerDeltaX)<=2&&Math.abs(participantsImmediate.centerDeltaY)<=2,'Participants must open centered in the meeting body before user movement.');
  assert.equal(participantsImmediate.panelWidth,318,'Participants must open at the approved 318px width.');
  assert.ok(participantsImmediate.panelHeight>=388&&participantsImmediate.panelHeight<=390,'Participants must open at the approved 390px-class height.');
  assert.ok(Math.abs(participantsImmediate.stageRightGap)<=2,'Floating Participants must not reserve the right edge or shrink the stage.');
  assert.equal(participantsImmediate.count,'Participants (1)');
  assert.equal(participantsImmediate.motionSheetLoaded,true,'Runtime motion stylesheet must be active in the packaged renderer.');
  if(participantsImmediate.reduceMotion)assert.equal(participantsImmediate.animation,'none','Reduce Motion must suppress the Participants entrance animation.');
  else assert.match(participantsImmediate.animation,/dsRuntimePanelIn/,'Participants must use the short runtime entrance motion.');

  const dragStart=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),head=panel.querySelector('.room-side-head'),r=panel.getBoundingClientRect(),h=head.getBoundingClientRect(),x=h.left+Math.min(110,h.width*.45),y=h.top+h.height/2,hit=document.elementFromPoint(x,y);return {left:r.left,top:r.top,x,y,hitTag:hit?.tagName||'',hitId:hit?.id||'',hitClass:String(hit?.className||''),bound:panel.dataset.dsRuntimeDragBound||'',mode:panel.dataset.dsRuntimeMode||''};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x,y:dragStart.y});
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:dragStart.x,y:dragStart.y,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x+64,y:dragStart.y+34,button:'left',buttons:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragStart.x+64,y:dragStart.y+34,button:'left',buttons:0,clickCount:1});
  await sleep(50);
  const dragged=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),r=panel.getBoundingClientRect(),br=body.getBoundingClientRect();return {dx:Math.round(r.left-${dragStart.left}),dy:Math.round(r.top-${dragStart.top}),begin:Number(panel.dataset.dsRuntimeDragBegin||0),move:Number(panel.dataset.dsRuntimeDragMove||0),end:Number(panel.dataset.dsRuntimeDragEnd||0),user:panel.dataset.dsRuntimeUserPositioned||'',left:panel.style.left,top:panel.style.top,right:panel.style.right,bottom:panel.style.bottom,width:Math.round(r.width),height:Math.round(r.height),bodyWidth:Math.round(br.width),bodyHeight:Math.round(br.height),animation:getComputedStyle(panel).animationName,hitTag:${JSON.stringify(dragStart.hitTag)},hitId:${JSON.stringify(dragStart.hitId)},hitClass:${JSON.stringify(dragStart.hitClass)}};})()`);
  assert.ok(Math.abs(dragged.dx)>=24||Math.abs(dragged.dy)>=18,`Participants must be movable with real pointer input. ${JSON.stringify(dragged)}`);

  await evaluate(`document.querySelector('#roomChat').click()`);await sleep(60);
  const chat=await evaluate(`(()=>{const panel=document.querySelector('#meetingChatPanel'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=stage.getBoundingClientRect();return {participantsClosed:document.querySelector('.room-side').hidden,chatOpen:!panel.hidden,mode:panel.dataset.dsRuntimeMode,inside:pr.left>=br.left+10&&pr.right<=br.right-10&&pr.top>=br.top+10&&pr.bottom<=br.bottom-10,stageRightGap:Math.round(br.right-sr.right)};})()`);
  assert.equal(chat.participantsClosed,true,'Chat click must close Participants immediately.');
  assert.equal(chat.chatOpen,true,'Chat must open on the Chat click itself.');
  assert.equal(chat.mode,'floating','Chat must use the same floating window model.');
  assert.equal(chat.inside,true,'Floating Chat must remain inside the meeting body.');
  assert.ok(Math.abs(chat.stageRightGap)<=2,'Floating Chat must leave the full meeting stage available.');

  await evaluate(`document.querySelector('#roomChat').click()`);await sleep(60);
  assert.equal(await evaluate(`document.querySelector('#meetingChatPanel').hidden===true&&document.querySelector('.room-side').hidden===true`),true,'Chat must close immediately and leave no stale side panel open.');

  await evaluate(`(()=>{const p=document.querySelector('#roomParticipants'),c=document.querySelector('#roomChat');p.click();p.click();p.click();c.click();return true;})()`);await sleep(90);
  let settled=await evaluate(`(()=>({p:!document.querySelector('.room-side').hidden,c:!document.querySelector('#meetingChatPanel').hidden}))()`);
  assert.deepEqual(settled,{p:false,c:true},'Rapid Participants → Chat sequence must settle to Chat immediately.');
  await sleep(1800);
  settled=await evaluate(`(()=>({p:!document.querySelector('.room-side').hidden,c:!document.querySelector('#meetingChatPanel').hidden}))()`);
  assert.deepEqual(settled,{p:false,c:true},'Side panels changed after the interaction settled; delayed reconciliation is still active.');

  // Share routing regression: 2.0.41 deliberately moved the approved physical
  // chooser in front of the older element-capture smart picker. The packaged
  // click must surface the new Screens/Files/More authority (or its truthful
  // macOS recovery if the runner cannot enumerate a display) and no legacy UI.
  await waitFor("window.DominionShareRuntimeAuthority2041&&document.querySelector('#roomShare')",'approved runtime Share authority');
  await evaluate(`(()=>{document.querySelector('#dsSmartSharePicker')?.remove();document.querySelector('.ds-share-permission')?.remove();document.querySelector('.ds-219-share-recovery')?.remove();document.querySelector('#screenPermissionDialog')?.remove();return true;})()`);
  await evaluate(`document.querySelector('#roomShare').click()`);await sleep(220);
  const shareRoute=await evaluate(`(()=>({approvedAuthority:Boolean(window.DominionShareRuntimeAuthority2041),approvedPickerOpen:Boolean(document.querySelector('.ds2041-share-root')&&!document.querySelector('.ds2041-share-root').hidden),approvedRecoveryOpen:Boolean(document.querySelector('.ds2041-recovery')&&!document.querySelector('.ds2041-recovery').hidden),legacyPickerOpen:Boolean(document.querySelector('#dsSmartSharePicker')&&!document.querySelector('#dsSmartSharePicker').hidden),legacyPermissionOpen:Boolean(document.querySelector('.ds-share-permission')&&!document.querySelector('.ds-share-permission').hidden),legacyRecoveryOpen:Boolean(document.querySelector('.ds-219-share-recovery')&&!document.querySelector('.ds-219-share-recovery').hidden),checking:Boolean(document.querySelector('#roomShare')?.classList.contains('ds-share-checking'))}))()`);
  assert.equal(shareRoute.approvedAuthority,true,`Approved runtime Share authority must be loaded in the packaged app. ${JSON.stringify(shareRoute)}`);
  assert.equal(shareRoute.approvedPickerOpen||shareRoute.approvedRecoveryOpen,true,`Share Screen must route into the approved 2.0.41 chooser or its truthful macOS recovery. ${JSON.stringify(shareRoute)}`);
  assert.equal(shareRoute.legacyPickerOpen,false,'Legacy smart Share picker must not open from the packaged Share button.');
  assert.equal(shareRoute.legacyPermissionOpen,false,'Legacy physical permission surface must not open from the packaged Share button.');
  assert.equal(shareRoute.legacyRecoveryOpen,false,'Physical compatibility recovery must not steal the normal Share click.');
  assert.equal(shareRoute.checking,false,'Share progress state must not leave the old integration checking state stuck.');

  const responsiveness=await evaluate(`new Promise(resolve=>{const started=performance.now();setTimeout(()=>resolve(Math.round(performance.now()-started)),80);})`);
  assert.ok(responsiveness<500,`Renderer event loop is still starved; 80 ms timer took ${responsiveness} ms.`);

  const finalLoadDeadline=Date.now()+8000;let finalLoadState=null;
  while(Date.now()<finalLoadDeadline){
    try{finalLoadState=await rpc('state',{},1800);}catch{}
    if(finalLoadState?.didFinishLoad&&!finalLoadState?.loading)break;
    await sleep(120);
  }
  assert.equal(Boolean(finalLoadState?.didFinishLoad&&!finalLoadState?.loading),true,`Packaged index.html never completed its normal load lifecycle. state=${JSON.stringify(finalLoadState)}`);
  assert.doesNotMatch(stderr,/DOMINIONSTAR_RENDERER_GONE|Uncaught\s+(?:RangeError|TypeError|ReferenceError|SyntaxError)/i,'Runtime-stability gate detected a renderer crash or uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_RUNTIME_STABILITY_2_0_22_OK live-webrtc canonical-runtime final-css-owner full-window centered-participants accessible-smooth-stage-settle immediate-chat last-click-wins no-delayed-panel-flip approved-runtime-share responsive-event-loop floating-panels-draggable-full-stage');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());if(stdoutLog.trim())console.error(stdoutLog.trim());}finally{for(const [,waiter] of rpcPending){clearTimeout(waiter.timer);waiter.reject(new Error('runtime-stability shutdown'));}rpcPending.clear();try{child.stdin.end();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
