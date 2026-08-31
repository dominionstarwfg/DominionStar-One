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
  await waitFor("document.readyState==='complete'&&window.DominionPhysicalMacRepair&&window.DominionZoomAdaptiveParity&&window.DominionShareIntegration",'2.0.21 physical Mac controllers');
  const controller=await evaluate(`({repairVersion:window.DominionPhysicalMacRepair.version,adaptiveVersion:window.DominionZoomAdaptiveParity.version,relaunch:Boolean(window.dominionDesktop?.app?.relaunch),reset:Boolean(window.dominionDesktop?.app?.resetScreenPermission),privacy:Boolean(window.dominionDesktop?.app?.privacyIdentity),shareOpen:Boolean(window.DominionShareIntegration?.open),legacyRecoveryVisible:[...document.querySelectorAll('.ds-share-permission,.ds-219-share-recovery')].some(n=>!n.hidden)})`);
  assert.equal(controller.repairVersion,'2.0.21');assert.equal(controller.adaptiveVersion,'2.0.21');assert.equal(controller.relaunch,true);assert.equal(controller.reset,true);assert.equal(controller.privacy,true);assert.equal(controller.shareOpen,true);assert.equal(controller.legacyRecoveryVisible,false,'No permission recovery dialog may be visible before a real Share failure.');
  const identity=await evaluate(`window.dominionDesktop.app.privacyIdentity()`);
  assert.equal(identity.signingMode,'adhoc');assert.equal(identity.stableAcrossRebuilds,false);assert.equal(identity.screenPermissionPersistence,'not-certified');

  await waitFor("document.querySelector('#newMeetingForm')&&document.querySelector('#newMeetingUsePersonal')&&document.querySelector('#newMeetingPasscode')",'packaged Personal Meeting ID controls');
  const personal=await evaluate(`(()=>{const toggle=document.querySelector('#newMeetingUsePersonal'),pass=document.querySelector('#newMeetingPasscode')?.closest('label');const original=toggle.checked;toggle.checked=true;window.DominionPhysicalMacRepair.syncPersonalChoice();const out={display:getComputedStyle(pass).display,authority:toggle.dataset.ds219Authority,passExists:Boolean(pass)};toggle.checked=original;window.DominionPhysicalMacRepair.syncPersonalChoice();return out;})()`);
  assert.equal(personal.passExists,true,'Packaged New Meeting passcode row is missing.');
  assert.equal(personal.display,'none','Personal Meeting ID selection must hide the unrelated instant passcode field.');assert.equal(personal.authority,'1');

  const reaction=await evaluate(`(()=>{const tray=document.createElement('div');tray.className='ds-reaction-tray';for(const e of ['👏','👍','❤️','😂','😮','🎉']){const b=document.createElement('button');b.textContent=e;tray.append(b);}const d=document.createElement('span');d.className='ds-reaction-divider';tray.append(d);const hand=document.createElement('button');hand.className='ds-raise-hand';hand.textContent='✋ Raise Hand';tray.append(hand);document.body.append(tray);const hr=hand.getBoundingClientRect(),hs=getComputedStyle(hand);const out={handHeight:hr.height,whiteSpace:hs.whiteSpace,font:parseFloat(hs.fontSize),scroll:hand.scrollWidth,client:hand.clientWidth,overflow:getComputedStyle(tray).overflow};tray.remove();return out;})()`);
  assert.equal(reaction.whiteSpace,'nowrap');assert.ok(reaction.handHeight>=44&&reaction.handHeight<=48,'Raise Hand height is outside the compact tray.');assert.ok(reaction.font>=12.5&&reaction.font<=14,'Raise Hand text size is not controlled.');assert.ok(reaction.scroll<=reaction.client+1,'Raise Hand is wrapping/overflowing.');assert.equal(reaction.overflow,'hidden');

  const settings=await evaluate(`(()=>{const host=document.createElement('div');host.style.position='fixed';host.style.left='-9999px';host.innerHTML='<div class="settings-modal av-video-settings-open"><form><section id="avSettingsDetail"><div class="av-detail-head"><div><h3>Video</h3><p>Preview your camera</p></div></div><div class="av-zoom-group"><div class="av-zoom-group-head"><strong>Appearance</strong><small>Readable guidance</small></div><label class="av-toggle-row"><span>Mirror my video</span><input type="checkbox"></label><label class="av-range-row"><span>Touch up intensity</span><input type="range"></label></div></section></form></div>';document.body.append(host);const toggle=host.querySelector('.av-toggle-row'),label=toggle.querySelector('span'),check=toggle.querySelector('input'),range=host.querySelector('.av-range-row input'),copy=host.querySelector('.av-detail-head p'),small=host.querySelector('.av-zoom-group-head small');const out={label:parseFloat(getComputedStyle(label).fontSize),copy:parseFloat(getComputedStyle(copy).fontSize),small:parseFloat(getComputedStyle(small).fontSize),checkRight:check.getBoundingClientRect().left>label.getBoundingClientRect().right,rangeWidth:range.getBoundingClientRect().width};host.remove();return out;})()`);
  assert.ok(settings.label>=13&&settings.copy>=12.5&&settings.small>=11.5,'Video Settings typography is still undersized.');assert.equal(settings.checkRight,true,'Video Settings checkbox is not aligned as a desktop row.');assert.ok(settings.rangeWidth<=425,'Video Settings slider remains excessively wide.');

  await waitFor("document.querySelector('#participantRoster')&&document.querySelector('#participantRoster').closest('.room-side')",'packaged participant roster');
  const participant=await evaluate(`(()=>{const roster=document.querySelector('#participantRoster'),panel=roster.closest('.room-side'),original=roster.innerHTML;roster.innerHTML='<div data-participant-id="a"></div><div data-participant-id="b"></div>';window.DominionPhysicalMacRepair.syncParticipantCount();const heading=panel.querySelector('.room-side-head strong')||panel.querySelector('section h3');const text=heading?.textContent||'';roster.innerHTML=original;window.DominionPhysicalMacRepair.syncParticipantCount();return {text,headingFound:Boolean(heading)};})()`);
  assert.equal(participant.headingFound,true,'Packaged Participants panel heading is missing.');
  assert.equal(participant.text,'Participants (2)','Participants must expose live count in the actual roster panel.');

  // Approved-reference video dock: prove that a real mouse drag can begin on a
  // video tile/body area, not only on a special header/grip.
  const videoReady=await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';window.DominionMeetingParity?.install?.();window.DominionMeetingParity?.syncVideoDock?.();const roster=document.querySelector('#participantRoster');roster.innerHTML='<div data-participant-id="self"></div><div data-participant-id="p2"></div><div data-participant-id="p3"></div>';const dock=document.querySelector('#participantVideoDock');const body=dock?.querySelector('.participant-video-dock-body');if(!dock||!body)return false;body.querySelectorAll('.remote-peer-tile:not(#localVideoDockTile)').forEach(n=>n.remove());for(const id of ['tile-a','tile-b']){const tile=document.createElement('article');tile.id=id;tile.className='remote-peer-tile';tile.style.minHeight='76px';tile.innerHTML='<div class="remote-peer-fallback"><span>'+id+'</span></div>';body.append(tile);}window.DominionPhysicalMacRepair.syncVideoDockPolicy();window.DominionZoomAdaptiveParity.installVideoDockDrag();return !dock.hidden&&dock.dataset.dsAdaptiveWholePanelDrag==='1';})()`);
  assert.equal(videoReady,true,'Floating participant video dock did not become available for real-drag verification.');
  await sleep(80);
  const dragStart=await evaluate(`(()=>{const dock=document.querySelector('#participantVideoDock'),tile=dock.querySelector('#tile-a'),dr=dock.getBoundingClientRect(),tr=tile.getBoundingClientRect();return {left:dr.left,top:dr.top,x:tr.left+Math.max(8,Math.min(tr.width-8,tr.width*.5)),y:tr.top+Math.max(8,Math.min(tr.height-8,tr.height*.5)),cursor:getComputedStyle(tile).cursor,grip:getComputedStyle(dock.querySelector('.dock-grip')).display};})()`);
  assert.equal(dragStart.grip,'none','Video dock grip must remain hidden.');
  assert.ok(['default','auto'].includes(dragStart.cursor),'Video tile surface must show a normal arrow cursor, not a grabbing hand.');
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x,y:dragStart.y});
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:dragStart.x,y:dragStart.y,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragStart.x-64,y:dragStart.y+34,button:'left',buttons:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragStart.x-64,y:dragStart.y+34,button:'left',buttons:0,clickCount:1});
  await sleep(80);
  const videoDragged=await evaluate(`(()=>{const dock=document.querySelector('#participantVideoDock'),r=dock.getBoundingClientRect();return {dx:Math.round(r.left-${dragStart.left}),dy:Math.round(r.top-${dragStart.top}),cursor:getComputedStyle(dock).cursor,whole:dock.dataset.dsAdaptiveWholePanelDrag};})()`);
  assert.ok(Math.abs(videoDragged.dx)>=24||Math.abs(videoDragged.dy)>=18,'Floating participant video panel must move from a real mouse drag started on a video tile.');
  assert.equal(videoDragged.cursor,'default','Floating video panel must keep the normal arrow cursor while movable.');
  assert.equal(videoDragged.whole,'1','Whole-panel video drag authority was lost at runtime.');

  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer emitted an uncaught JavaScript error.');
  console.log('DOMINIONSTAR_PACKAGED_PHYSICAL_MAC_2_0_21_OK repair-loaded adaptive-loaded native-share-entry recovery-not-preemptive adhoc-not-certified actual-personal-ui-authority reaction-contained settings-aligned actual-participant-count video-tile-real-mouse-drag normal-arrow-no-grip');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('2.0.21 physical Mac gate shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
