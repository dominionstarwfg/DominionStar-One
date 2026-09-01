import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-physical-acceptance.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=9920+Math.floor(Math.random()*150);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const runtimeErrors=[];
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before physical acceptance gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(180);}throw new Error('Unable to attach to packaged renderer for physical acceptance gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Physical acceptance WebSocket timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Physical acceptance WebSocket failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},2400);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown'){const details=message.params?.exceptionDetails;runtimeErrors.push(details?.exception?.description||details?.text||'Uncaught renderer exception');return;}if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionZoomProductionPolish&&window.DominionZoomPhysicalAcceptance&&window.DominionApprovedReferenceParity&&window.DominionRuntimeStability&&window.DominionZoomReactionParity&&window.DominionShareIntegration",'final physical acceptance controllers');
  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionMeetingParity.decorateControls();window.DominionZoomProductionPolish.sync();window.DominionZoomPhysicalAcceptance.sync();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();window.DominionZoomReactionParity.mount();return true;})()`);
  await waitFor("['roomShare','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomHostTools','roomMore','meetingViewButton'].every(id=>document.querySelector('#'+id))",'physical acceptance controls');
  await sleep(160);

  // View must remain a real clickable command surface and update the actual meeting layout state.
  await evaluate(`document.querySelector('#meetingViewButton').click()`);
  await waitFor("document.querySelector('.ds-command-menu')&&/View/.test(document.querySelector('.ds-command-menu').textContent)",'View menu');
  const viewMenu=await evaluate(`(()=>{const m=document.querySelector('.ds-command-menu'),f=document.querySelector('.meeting-footer').getBoundingClientRect(),r=m.getBoundingClientRect();return {z:parseInt(getComputedStyle(m).zIndex)||0,bottom:r.bottom,footerTop:f.top,items:[...m.querySelectorAll('button')].map(b=>b.textContent.trim())};})()`);
  assert.ok(viewMenu.z>=2500,'View menu must render above meeting chrome.');
  assert.ok(viewMenu.bottom<=viewMenu.footerTop+2,'View menu must open above the toolbar rather than behind it.');
  assert.ok(viewMenu.items.includes('Gallery'),'View menu is missing Gallery.');
  await evaluate(`[...document.querySelectorAll('.ds-command-menu button')].find(b=>/Gallery/.test(b.textContent||''))?.click()`);
  await waitFor("document.querySelector('#meetingOverlay').dataset.viewMode==='gallery'",'working Gallery action');

  // Host Tools and More remain primary/secondary desktop command surfaces.
  await evaluate(`document.querySelector('#roomHostTools').click()`);
  await waitFor("document.querySelector('.ds-command-menu')&&/Host Tools/.test(document.querySelector('.ds-command-menu').textContent)",'Host Tools menu');
  const hostMenu=await evaluate(`(()=>{const m=document.querySelector('.ds-command-menu'),f=document.querySelector('.meeting-footer').getBoundingClientRect(),r=m.getBoundingClientRect();return {z:parseInt(getComputedStyle(m).zIndex)||0,bottom:r.bottom,footerTop:f.top,items:[...m.querySelectorAll('button')].map(b=>b.textContent.trim())};})()`);
  assert.ok(hostMenu.z>=2500&&hostMenu.bottom<=hostMenu.footerTop+2,'Host Tools must stay clickable above the toolbar.');
  assert.ok(hostMenu.items.some(v=>/Open Participants/i.test(v))&&hostMenu.items.some(v=>/Lock Meeting/i.test(v)),'Host Tools is missing live host actions.');
  await evaluate(`document.querySelector('.ds-command-menu')?.remove()`);

  await evaluate(`document.querySelector('#roomMore').click()`);
  await waitFor("document.querySelector('.ds-command-menu')&&/More/.test(document.querySelector('.ds-command-menu').textContent)",'More menu');
  const more=await evaluate(`[...document.querySelectorAll('.ds-command-menu button')].map(b=>b.textContent.trim())`);
  assert.ok(more.some(v=>/Meeting settings/i.test(v)),'More must expose Meeting settings.');
  assert.ok(!more.some(v=>/^Host Tools$/i.test(v)),'Host Tools must not be duplicated inside More.');
  await evaluate(`document.querySelector('.ds-command-menu')?.remove()`);

  // Participants: final desktop authority is a right-side application panel with
  // modern mic/video state and row ellipsis. It must resize the stage, not cover it.
  await evaluate(`(()=>{document.querySelector('#roomParticipants').click();const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row" data-participant-id="qa-guest" data-participant-role="participant" data-participant-name="Taylor Participant" data-recording-allowed="0" data-record-eligible="1"><span class="person-badge">TP</span><span class="person-copy"><strong>Taylor Participant</strong><small>Participant</small></span></div>';window.DominionZoomPhysicalAcceptance.decorateParticipantRows();window.DominionRuntimeStability.syncParticipantsSurface();window.DominionRuntimeStability.layoutSideSurface();return true;})()`);
  await waitFor("document.querySelector('#participantRoster .ds-modern-participant-row .ds-participant-media')",'participant media indicators');
  await waitFor("document.querySelector('#participantRoster [data-participant-more]')",'participant ellipsis');
  const participantRow=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const row=document.querySelector('#participantRoster .ds-modern-participant-row'),states=[...row.querySelectorAll('.ds-media-state')],more=row.querySelector('[data-participant-more]'),panel=document.querySelector('.room-side'),pr=panel.getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect(),stage=document.querySelector('.stage').getBoundingClientRect();return {height:row.getBoundingClientRect().height,stateCount:states.length,moreText:more?.textContent||'',nameFont:parseFloat(getComputedStyle(row.querySelector('.person-copy strong')).fontSize),moreWidth:more?.getBoundingClientRect().width||0,mode:panel.dataset.dsRuntimeMode||'',rightGap:Math.round(body.right-pr.right),panelWidth:Math.round(pr.width),stageRightGap:Math.round(body.right-stage.right)};})()`);
  assert.ok(participantRow.height>=50&&participantRow.nameFont>=12.5,'Participant row is below the final readable runtime scale.');
  assert.equal(participantRow.stateCount,2,'Participant row must show microphone and video status.');
  assert.equal(participantRow.moreText,'•••','Participant management must use a three-dot control.');
  assert.ok(participantRow.moreWidth>=27,'Participant ellipsis target is too small.');
  assert.equal(participantRow.mode,'docked','Desktop Participants must use the right-side dock.');
  assert.ok(Math.abs(participantRow.rightGap)<=2,'Participants must sit flush on the right edge.');
  assert.ok(participantRow.stageRightGap>=participantRow.panelWidth-2,'Participants must resize the stage rather than overlap it.');
  await evaluate(`document.querySelector('#roomParticipants').click()`);

  // Chat uses the same final runtime dock and must remain readable and contained.
  await evaluate(`document.querySelector('#roomChat').click()`);await waitFor("!document.querySelector('#meetingChatPanel').hidden",'Chat panel');
  const chat=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const p=document.querySelector('#meetingChatPanel'),r=p.getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect(),more=p.querySelector('.zoom-chat-more'),input=document.querySelector('#meetingChatInput');return {width:Math.round(r.width),mode:p.dataset.dsRuntimeMode||'',rightGap:Math.round(body.right-r.right),head:parseFloat(getComputedStyle(p.querySelector('header strong')).fontSize),input:parseFloat(getComputedStyle(input).fontSize),more:Boolean(more&&getComputedStyle(more).display!=='none')};})()`);
  assert.ok(chat.width>=320&&chat.width<=400&&chat.head>=14.5&&chat.input>=12.5,'Chat is not at the approved compact readable runtime scale.');
  assert.equal(chat.mode,'docked','Desktop Chat must use the same right-side dock.');
  assert.ok(Math.abs(chat.rightGap)<=2,'Chat must sit flush on the right edge.');
  assert.equal(chat.more,true,'Chat options ellipsis is missing.');
  await evaluate(`document.querySelector('#roomChat').click()`);

  // React contains six reactions only. Raise Hand is a separate toolbar control.
  await evaluate(`document.querySelector('#roomReactions').click()`);await waitFor("document.querySelector('.ds-reaction-tray')",'reaction tray');
  const reactionTray=await evaluate(`(()=>{const tray=document.querySelector('.ds-reaction-tray'),buttons=[...tray.querySelectorAll('button')],hand=tray.querySelector('.ds-raise-hand'),dedicated=document.querySelector('#roomRaiseHand');return {z:parseInt(getComputedStyle(tray).zIndex)||0,reactions:buttons.filter(b=>!b.classList.contains('ds-raise-hand')&&getComputedStyle(b).display!=='none').length,legacyHandHidden:Boolean(hand&&getComputedStyle(hand).display==='none'),dedicatedHand:Boolean(dedicated&&!dedicated.hidden&&getComputedStyle(dedicated).display!=='none'),pointer:getComputedStyle(tray).pointerEvents};})()`);
  assert.ok(reactionTray.z>=2700&&reactionTray.pointer!=='none','Reaction tray is behind another layer or cannot receive clicks.');
  assert.equal(reactionTray.reactions,6,'Reaction tray must expose six standard reaction buttons.');
  assert.equal(reactionTray.legacyHandHidden,true,'Raise Hand must not be duplicated inside React.');
  assert.equal(reactionTray.dedicatedHand,true,'Dedicated Raise Hand toolbar control is missing.');
  await evaluate(`document.querySelector('.ds-reaction-tray')?.remove()`);

  // Final reaction animator: ten-second left-side rise with name support and bounded blossoms.
  await evaluate(`(()=>{window.DominionZoomReactionParity.mount();const layer=document.querySelector('#meetingReactionLayer');const bubble=document.createElement('div');bubble.className='meeting-reaction-bubble';bubble.innerHTML='<b>❤️</b><span>Taylor Participant</span>';layer.append(bubble);return true;})()`);
  await waitFor("document.querySelector('.ds-zoom-floating-reaction[data-ds-reaction-parity=\"10s\"]')",'canonical ten-second reaction float');
  const float=await evaluate(`(()=>{const n=document.querySelector('.ds-zoom-floating-reaction[data-ds-reaction-parity="10s"]'),style=getComputedStyle(n),label=n.querySelector('span');return {duration:parseFloat(style.animationDuration),left:n.getBoundingClientRect().left,viewport:innerWidth,name:label?.hidden?'':label?.textContent||'',font:parseFloat(getComputedStyle(n.querySelector('b')).fontSize),lane:n.dataset.dsReactionLane};})()`);
  assert.ok(float.duration>=9.9,'Reaction float must remain visible for the final ten-second parity window.');
  assert.ok(float.left<=float.viewport*.30,'Reaction float must originate in the left-side lane.');
  assert.ok(float.font>=40,'Reaction emoji is below readable Zoom-like scale.');
  assert.ok(Number.isFinite(Number(float.lane)),'Reaction lane assignment is missing.');

  // Settings/A-V typography cannot regress to tiny utility text.
  const settingsType=await evaluate(`(()=>{const host=document.createElement('div');host.style.position='fixed';host.style.left='-9999px';host.innerHTML='<div class="settings-modal"><form><div class="av-detail-head"><div><h3>Video</h3><p>Camera description</p></div></div><label class="av-toggle-row">Mirror my video</label><div class="av-quick-menu"><button>Audio & Video Settings</button></div></form></div>';document.body.append(host);const out={copy:parseFloat(getComputedStyle(host.querySelector('.av-detail-head p')).fontSize),toggle:parseFloat(getComputedStyle(host.querySelector('.av-toggle-row')).fontSize),quick:parseFloat(getComputedStyle(host.querySelector('.av-quick-menu button')).fontSize)};host.remove();return out;})()`);
  assert.ok(settingsType.copy>=12&&settingsType.toggle>=12.5&&settingsType.quick>=12.5,'A/V settings typography is still below readable production scale.');

  // Effective Share authority belongs to the final runtime + isolated native-first integration.
  const shareAuthority=await evaluate(`(()=>({runtime:Boolean(window.DominionRuntimeStability?.openShare),integration:Boolean(window.DominionShareIntegration?.open),button:Boolean(document.querySelector('#roomShare')),checkingClass:Boolean(document.querySelector('#roomShare')?.classList)}))()`);
  assert.equal(shareAuthority.runtime,true,'Final runtime Share authority is missing.');
  assert.equal(shareAuthority.integration,true,'Native-first Share integration is missing.');
  assert.equal(shareAuthority.button,true,'Share Screen toolbar control is missing.');

  const toolbarZones=await evaluate(`(()=>{const footer=document.querySelector('.meeting-footer');return {stable:footer?.dataset.dsRuntimeToolbarZones==='1',zones:footer?.querySelectorAll(':scope > .ds-runtime-toolbar-zone').length||0};})()`);
  assert.equal(toolbarZones.stable,true,'Physical acceptance lost the stable toolbar layout authority.');
  assert.equal(toolbarZones.zones,3,'Physical acceptance must retain three independent toolbar zones.');

  await sleep(100);assert.deepEqual(runtimeErrors,[],'Physical acceptance emitted uncaught renderer exceptions:\n'+runtimeErrors.join('\n'));assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer wrote an uncaught JavaScript error to stderr.');
  console.log('DOMINIONSTAR_PACKAGED_PHYSICAL_ACCEPTANCE_OK view-click host-tools-click more-click participant-media right-docked-participants compact-right-chat reaction-six-only dedicated-raise-hand ten-second-left-reactions settings-readable runtime-owned-native-share stable-toolbar no-renderer-errors');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('physical acceptance shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
