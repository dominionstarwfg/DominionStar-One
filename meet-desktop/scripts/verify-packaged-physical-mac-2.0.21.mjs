import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-physical-mac-2.0.21.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10420+Math.floor(Math.random()*120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before 2.0.21 physical Mac gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(160);}throw new Error('Unable to attach to packaged renderer for 2.0.21 physical Mac gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('2.0.21 physical Mac CDP connection timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('2.0.21 physical Mac CDP connection failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},3000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionPhysicalMacRepair&&window.DominionZoomAdaptiveParity&&window.DominionShareIntegration&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionZoomPhysicalAcceptance&&window.DominionApprovedReferenceParity&&window.DominionRuntimeStability",'2.0.21 physical Mac controllers');
  const controller=await evaluate(`({repairVersion:window.DominionPhysicalMacRepair.version,adaptiveVersion:window.DominionZoomAdaptiveParity.version,relaunch:Boolean(window.dominionDesktop?.app?.relaunch),reset:Boolean(window.dominionDesktop?.app?.resetScreenPermission),privacy:Boolean(window.dominionDesktop?.app?.privacyIdentity),shareOpen:Boolean(window.DominionShareIntegration?.open),legacyRecoveryVisible:[...document.querySelectorAll('.ds-share-permission,.ds-219-share-recovery')].some(n=>!n.hidden)})`);
  assert.equal(controller.repairVersion,'2.0.21');assert.equal(controller.adaptiveVersion,'2.0.21');assert.equal(controller.relaunch,true);assert.equal(controller.reset,true);assert.equal(controller.privacy,true);assert.equal(controller.shareOpen,true);assert.equal(controller.legacyRecoveryVisible,false,'No permission recovery dialog may be visible before a real Share failure.');
  const identity=await evaluate(`window.dominionDesktop.app.privacyIdentity()`);
  assert.equal(identity.signingMode,'adhoc');assert.equal(identity.stableAcrossRebuilds,false);assert.equal(identity.screenPermissionPersistence,'not-certified');

  await waitFor("document.querySelector('#newMeetingForm')&&document.querySelector('#newMeetingUsePersonal')&&document.querySelector('#newMeetingPasscode')",'packaged Personal Meeting ID controls');
  const personal=await evaluate(`(()=>{const toggle=document.querySelector('#newMeetingUsePersonal'),pass=document.querySelector('#newMeetingPasscode')?.closest('label');const original=toggle.checked;toggle.checked=true;window.DominionPhysicalMacRepair.syncPersonalChoice();const out={display:getComputedStyle(pass).display,authority:toggle.dataset.ds219Authority,passExists:Boolean(pass)};toggle.checked=original;window.DominionPhysicalMacRepair.syncPersonalChoice();return out;})()`);
  assert.equal(personal.passExists,true,'Packaged New Meeting passcode row is missing.');
  assert.equal(personal.display,'none','Personal Meeting ID selection must hide the unrelated instant passcode field.');assert.equal(personal.authority,'1');

  // Carry forward the old reaction-surface readability checks against the actual
  // current React transaction. 2.0.22 removes the obsolete in-tray Raise Hand
  // because Raise Hand is now a permanent first-class toolbar control.
  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionZoomPhysicalAcceptance.sync();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();return true;})()`);
  await waitFor("document.querySelector('#roomReactions')&&document.querySelector('#roomRaiseHand')",'live React and Raise Hand controls');
  await evaluate(`document.querySelector('#roomReactions').click()`);
  await waitFor("document.querySelector('.meeting-reaction-menu')",'live canonical reaction menu');
  await sleep(40);
  const reaction=await evaluate(`(()=>{const tray=document.querySelector('.meeting-reaction-menu'),visible=[...tray.querySelectorAll('.reaction-emoji-button')].filter(b=>getComputedStyle(b).display!=='none'),hand=tray.querySelector('.reaction-hand-button'),divider=tray.querySelector('.reaction-divider'),dedicated=document.querySelector('#roomRaiseHand');return {reactions:visible.length,legacyTrayAbsent:!document.querySelector('.ds-reaction-tray'),handVisible:Boolean(hand&&getComputedStyle(hand).display!=='none'),dividerVisible:Boolean(divider&&getComputedStyle(divider).display!=='none'),dedicatedVisible:Boolean(dedicated&&!dedicated.hidden&&getComputedStyle(dedicated).display!=='none'),overflow:getComputedStyle(tray).overflow,buttonWidth:visible[0]?.getBoundingClientRect().width||0,font:visible[0]?parseFloat(getComputedStyle(visible[0]).fontSize):0};})()`);
  assert.equal(reaction.reactions,6,'Canonical React menu must retain six standard reactions.');
  assert.equal(reaction.legacyTrayAbsent,true,'Retired ds-reaction-tray must not coexist with the canonical menu.');
  assert.equal(reaction.handVisible,false,'Legacy reaction-menu Raise Hand must not be visible in 2.0.22.');
  assert.equal(reaction.dividerVisible,false,'Unused reaction divider must not be visible with the legacy hand section.');
  assert.equal(reaction.dedicatedVisible,true,'Dedicated Raise Hand toolbar control must remain visible.');
  assert.ok(reaction.buttonWidth>=46&&reaction.font>=24,'Reaction emoji targets must remain compact and readable.');
  assert.equal(reaction.overflow,'hidden');
  await evaluate(`document.querySelector('.meeting-reaction-menu')?.remove()`);

  const settings=await evaluate(`(()=>{const host=document.createElement('div');host.style.position='fixed';host.style.left='-9999px';host.innerHTML='<div class="settings-modal av-video-settings-open"><form><section id="avSettingsDetail"><div class="av-detail-head"><div><h3>Video</h3><p>Preview your camera</p></div></div><div class="av-zoom-group"><div class="av-zoom-group-head"><strong>Appearance</strong><small>Readable guidance</small></div><label class="av-toggle-row"><span>Mirror my video</span><input type="checkbox"></label><label class="av-range-row"><span>Touch up intensity</span><input type="range"></label></div></section></form></div>';document.body.append(host);const toggle=host.querySelector('.av-toggle-row'),label=toggle.querySelector('span'),check=toggle.querySelector('input'),range=host.querySelector('.av-range-row input'),copy=host.querySelector('.av-detail-head p'),small=host.querySelector('.av-zoom-group-head small');const out={label:parseFloat(getComputedStyle(label).fontSize),copy:parseFloat(getComputedStyle(copy).fontSize),small:parseFloat(getComputedStyle(small).fontSize),checkRight:check.getBoundingClientRect().left>label.getBoundingClientRect().right,rangeWidth:range.getBoundingClientRect().width};host.remove();return out;})()`);
  assert.ok(settings.label>=13&&settings.copy>=12.5&&settings.small>=11.5,'Video Settings typography is still undersized.');assert.equal(settings.checkRight,true,'Video Settings checkbox is not aligned as a desktop row.');assert.ok(settings.rangeWidth<=425,'Video Settings slider remains excessively wide.');

  await waitFor("document.querySelector('#participantRoster')&&document.querySelector('#participantRoster').closest('.room-side')",'packaged participant roster');
  const participant=await evaluate(`(()=>{const roster=document.querySelector('#participantRoster'),panel=roster.closest('.room-side'),original=roster.innerHTML;roster.innerHTML='<div data-participant-id="a"></div><div data-participant-id="b"></div>';window.DominionPhysicalMacRepair.syncParticipantCount();const heading=panel.querySelector('.room-side-head strong')||panel.querySelector('section h3');const text=heading?.textContent||'';roster.innerHTML=original;window.DominionPhysicalMacRepair.syncParticipantCount();return {text,headingFound:Boolean(heading)};})()`);
  assert.equal(participant.headingFound,true,'Packaged Participants panel heading is missing.');
  assert.equal(participant.text,'Participants (2)','Participants must expose live count in the actual roster panel.');

  // Approved-reference video dock: a normal two-person Speaker-view meeting must
  // expose a vertical filmstrip on the right before the user moves it. Then prove
  // that whole-surface manual dragging still overrides the default geometry.
  const videoReady=await evaluate(`(()=>{try{localStorage.removeItem('ds_zoom_video_dock_geometry_v1');localStorage.setItem('ds_meet_view_mode','speaker');}catch{}document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;window.DominionMeetingParity?.install?.();overlay.dataset.viewMode='speaker';overlay.classList.remove('share-active');document.body.classList.remove('remote-share-active');window.DominionMeetingParity?.syncVideoDock?.();const roster=document.querySelector('#participantRoster');roster.innerHTML='<div data-participant-id="self"></div><div data-participant-id="p2"></div>';const dock=document.querySelector('#participantVideoDock');const body=dock?.querySelector('.participant-video-dock-body');if(!dock||!body)return false;body.querySelectorAll('.remote-peer-tile:not(#localVideoDockTile)').forEach(n=>n.remove());const tile=document.createElement('article');tile.id='tile-a';tile.className='remote-peer-tile';tile.style.minHeight='76px';tile.innerHTML='<div class="remote-peer-fallback"><span>p2</span></div>';body.append(tile);dock.classList.remove('user-positioned','user-resized');dock.removeAttribute('style');window.DominionApprovedReferenceParity.syncVideoPanel();window.DominionMeetingParity?.syncVideoDock?.();window.DominionPhysicalMacRepair.syncVideoDockPolicy();window.DominionZoomAdaptiveParity.installVideoDockDrag();return !dock.hidden&&dock.dataset.zoomThreshold==='available'&&dock.dataset.dsAdaptiveWholePanelDrag==='1';})()`);
  assert.equal(videoReady,true,'Two-person Speaker-view participant video filmstrip did not become available.');
  await waitFor("(()=>{const dock=document.querySelector('#participantVideoDock'),tile=dock?.querySelector('#tile-a'),stage=document.querySelector('.stage');if(!dock||!tile||!stage)return false;const dr=dock.getBoundingClientRect(),sr=stage.getBoundingClientRect(),tr=tile.getBoundingClientRect();return Math.abs(tr.width-176)<28&&(sr.right-dr.right)>=8&&(sr.right-dr.right)<=22;})()",'stable right-side 176px participant filmstrip',1600);
  const dragStart=await evaluate(`(()=>{const dock=document.querySelector('#participantVideoDock'),tile=dock.querySelector('#tile-a'),stage=document.querySelector('.stage'),dr=dock.getBoundingClientRect(),sr=stage.getBoundingClientRect(),tr=tile.getBoundingClientRect();return {left:dr.left,top:dr.top,rightGap:Math.round(sr.right-dr.right),tileWidth:Math.round(tr.width),vertical:Math.abs(tr.width-176)<28,x:tr.left+Math.max(8,Math.min(tr.width-8,tr.width*.5)),y:tr.top+Math.max(8,Math.min(tr.height-8,tr.height*.5)),cursor:getComputedStyle(tile).cursor,grip:getComputedStyle(dock.querySelector('.dock-grip')).display};})()`);
  assert.ok(dragStart.rightGap>=8&&dragStart.rightGap<=22,`Default participant video filmstrip must sit on the right edge; measured gap ${dragStart.rightGap}px.`);
  assert.equal(dragStart.vertical,true,`Default desktop participant video filmstrip must use the vertical Zoom-style tile width; measured ${dragStart.tileWidth}px.`);
  assert.equal(dragStart.grip,'none','Video dock grip must remain hidden.');
  assert.ok(['default','auto'].includes(dragStart.cursor),'Video tile surface must show a normal arrow cursor, not a grabbing hand.');
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x,y:dragStart.y});
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:dragStart.x,y:dragStart.y,button:'left',buttons:1,clickCount:1});
  for(const [dx,dy] of [[-16,8],[-32,17],[-48,26],[-64,34]]){
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x+dx,y:dragStart.y+dy,button:'left',buttons:1});
    await sleep(20);
  }
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragStart.x-64,y:dragStart.y+34,button:'left',buttons:0,clickCount:1});
  await sleep(120);
  const videoDragged=await evaluate(`(()=>{const dock=document.querySelector('#participantVideoDock'),r=dock.getBoundingClientRect();return {dx:Math.round(r.left-${dragStart.left}),dy:Math.round(r.top-${dragStart.top}),cursor:getComputedStyle(dock).cursor,whole:dock.dataset.dsAdaptiveWholePanelDrag,userPositioned:dock.classList.contains('user-positioned'),left:dock.style.left,top:dock.style.top,right:dock.style.right};})()`);
  console.log('VIDEO_DOCK_DRAG_DIAGNOSTIC '+JSON.stringify(videoDragged));
  assert.equal(videoDragged.userPositioned,true,'Floating participant video panel must enter user-positioned state from a real mouse drag started on a video tile.');
  assert.ok(Math.abs(videoDragged.dx)>=24||Math.abs(videoDragged.dy)>=18,'Floating participant video panel must move from a real multi-event mouse drag started on a video tile.');
  assert.equal(videoDragged.cursor,'default','Floating video panel must keep the normal arrow cursor while movable.');
  assert.equal(videoDragged.whole,'1','Whole-panel video drag authority was lost at runtime.');

  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer emitted an uncaught JavaScript error.');
  console.log('DOMINIONSTAR_PACKAGED_PHYSICAL_MAC_2_0_21_OK repair-loaded adaptive-loaded native-share-entry recovery-not-preemptive adhoc-not-certified actual-personal-ui-authority live-reaction-six-only dedicated-raise-hand settings-aligned actual-participant-count two-person-right-video-filmstrip video-tile-real-mouse-drag normal-arrow-no-grip');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('2.0.21 physical Mac gate shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);