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
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionZoomProductionPolish&&window.DominionZoomPhysicalAcceptance&&window.DominionApprovedReferenceParity&&window.DominionRuntimeStability&&window.DominionZoomReactionParity&&window.DominionShareIntegration&&window.DominionZoomScreenshotReference",'final physical acceptance controllers');
  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionMeetingParity.decorateControls();window.DominionZoomProductionPolish.sync();window.DominionZoomPhysicalAcceptance.sync();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();window.DominionZoomReactionParity.mount();window.DominionZoomScreenshotReference.sync();return true;})()`);
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

  // Host Tools is a single Zoom-style toolbar popover. No second security
  // sheet or compatibility panel may appear behind it.
  await evaluate(`document.querySelector('#roomHostTools').click()`);
  await waitFor("document.querySelector('.ds-command-menu .ds-command-menu-heading')?.textContent==='Host Tools'",'Host Tools menu');
  const hostMenu=await evaluate(`(()=>{const menus=[...document.querySelectorAll('.ds-command-menu')].filter(m=>getComputedStyle(m).display!=='none'),m=menus.find(x=>x.querySelector('.ds-command-menu-heading')?.textContent==='Host Tools'),f=document.querySelector('.meeting-footer').getBoundingClientRect(),r=m.getBoundingClientRect(),items=[...m.querySelectorAll('button')].map(b=>b.textContent.trim());return {commandCount:menus.length,legacyPanels:document.querySelectorAll('.ds-ref-host-tools-panel').length,heading:m.querySelector('.ds-command-menu-heading')?.textContent||'',items,bottom:r.bottom,footerTop:f.top};})()`);
  console.log('HOST_TOOLS_VISUAL_DIAGNOSTIC',JSON.stringify(hostMenu));
  assert.equal(hostMenu.legacyPanels,0,'Legacy Host Tools sheet must not coexist with the canonical popover.');
  assert.equal(hostMenu.commandCount,1,'Exactly one Host Tools popover may be visible.');
  assert.equal(hostMenu.heading,'Host Tools','Host Tools heading is missing.');
  assert.ok(hostMenu.items.some(v=>/Open Participants/i.test(v)),'Host Tools must expose Participants.');
  assert.ok(hostMenu.items.some(v=>/Copy meeting information/i.test(v)),'Host Tools must expose meeting information.');
  assert.ok(hostMenu.items.some(v=>/Lock Meeting|Unlock Meeting/i.test(v)),'Host Tools must expose meeting lock control.');
  assert.ok(hostMenu.items.some(v=>/Mute Participants on Entry/i.test(v)),'Host Tools must expose mute-on-entry.');
  assert.ok(hostMenu.bottom<=hostMenu.footerTop+2,'Host Tools must open above the toolbar.');
  await evaluate(`document.querySelector('.ds-command-menu')?.remove()`);

  // More is the canonical final meeting-more-menu. Host Tools must not be
  // duplicated there when the dedicated Host Tools toolbar button is visible.
  await evaluate(`document.querySelector('#roomMore').click()`);await sleep(0);
  await waitFor("document.querySelector('.ds-ref-meeting-more-grid.meeting-more-menu')",'More menu');
  const more=await evaluate(`(()=>{const m=document.querySelector('.ds-ref-meeting-more-grid.meeting-more-menu');return [...m.querySelectorAll('button')].map(b=>b.textContent.trim());})()`);
  assert.ok(more.some(v=>/^Settings$/i.test(v)),'More must expose the approved Settings control.');
  assert.ok(!more.some(v=>/^Host Tools$/i.test(v)),'Host Tools must not be duplicated inside More.');
  await evaluate(`document.querySelector('.ds-ref-meeting-more-grid.meeting-more-menu')?.remove()`);

  // Participants: 2.0.22 final authority is one floating, draggable desktop
  // application surface at every width. It must stay inside the meeting body,
  // preserve a full-width stage, and retain modern media/ellipsis controls.
  await evaluate(`(async()=>{document.querySelector('#roomParticipants').click();const ctx=await window.dominionDesktop?.meeting?.context?.()||{};const selfId=String(ctx.participantId||'qa-self');const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row" data-participant-id="'+selfId.replace(/"/g,'&quot;')+'" data-participant-role="host" data-participant-self="1" data-participant-name="Taylor Participant" data-recording-allowed="0" data-record-eligible="1"><span class="person-badge">TP</span><span class="person-copy"><strong>Taylor Participant</strong><small>Participant</small></span></div>';window.DominionZoomPhysicalAcceptance.decorateParticipantRows();await new Promise(r=>setTimeout(r,0));window.DominionZoomPhysicalAcceptance.decorateParticipantRows();window.DominionZoomScreenshotReference?.sync?.();window.DominionRuntimeStability.syncParticipantsSurface();window.DominionRuntimeStability.layoutSideSurface();return {selfId};})()`);
  await waitFor("document.querySelector('#participantRoster .ds-modern-participant-row .ds-participant-media')",'participant media indicators');
  await waitFor("document.querySelector('#participantRoster [data-participant-more]')",'participant ellipsis');
  const participantRow=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const row=document.querySelector('#participantRoster .ds-modern-participant-row'),states=[...row.querySelectorAll('.ds-media-state')],more=row.querySelector('[data-participant-more]'),panel=document.querySelector('.room-side'),pr=panel.getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect(),stage=document.querySelector('.stage').getBoundingClientRect(),roles=[...row.querySelectorAll('.ds-canonical-participant-role')],finalFooters=panel.querySelectorAll('.ds-ref-participants-footer'),legacyFooters=panel.querySelectorAll('.zoom-participant-footer,#participantBulkActions');return {height:row.getBoundingClientRect().height,stateCount:states.length,moreText:more?.textContent||'',nameFont:parseFloat(getComputedStyle(row.querySelector('.person-copy strong')).fontSize),moreWidth:more?.getBoundingClientRect().width||0,mode:panel.dataset.dsRuntimeMode||'',inside:pr.left>=body.left+10&&pr.right<=body.right-10&&pr.top>=body.top+10&&pr.bottom<=body.bottom-10,centerDelta:Math.round(Math.abs((pr.left+pr.width/2)-(body.left+body.width/2))),panelWidth:Math.round(pr.width),stageRightGap:Math.round(body.right-stage.right),draggable:panel.dataset.dsRuntimeDragBound==='1',roleCount:roles.length,roleText:roles[0]?.textContent||'',finalFooterCount:finalFooters.length,legacyFooterCount:legacyFooters.length};})()`);
  assert.ok(participantRow.height>=50&&participantRow.nameFont>=12.5,'Participant row is below the final readable runtime scale.');
  assert.equal(participantRow.stateCount,2,'Participant row must show microphone and video status.');
  assert.equal(participantRow.moreText,'•••','Participant management must use a three-dot control.');
  assert.ok(participantRow.moreWidth>=27,'Participant ellipsis target is too small.');
  assert.equal(participantRow.mode,'floating','Participants must use the final floating desktop panel model.');
  assert.equal(participantRow.inside,true,'Participants must remain contained inside the meeting surface.');
  assert.ok(participantRow.centerDelta<=8,'Participants must open at one stable centered floating position.');
  assert.ok(participantRow.panelWidth>=300&&participantRow.panelWidth<=420,'Participants width must remain readable and bounded.');
  assert.ok(Math.abs(participantRow.stageRightGap)<=2,'Floating Participants must not shrink the live stage.');
  assert.equal(participantRow.draggable,true,'Participants floating surface must have a drag authority.');
  assert.equal(participantRow.roleCount,1,'Participant role suffix must render exactly once after repeated synchronization.');
  assert.equal(participantRow.roleText,'(Host, me)','Host self role must use one canonical Zoom-style suffix.');
  assert.equal(participantRow.finalFooterCount,1,'Participants must expose exactly one final action footer.');
  assert.equal(participantRow.legacyFooterCount,0,'Legacy participant action footers must not coexist with the final footer.');
  await evaluate(`document.querySelector('#roomParticipants').click()`);

  // Chat uses the same final floating application-surface model, remains compact,
  // and must leave the meeting stage full width.
  await evaluate(`document.querySelector('#roomChat').click()`);await waitFor("!document.querySelector('#meetingChatPanel').hidden",'Chat panel');
  const chat=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const p=document.querySelector('#meetingChatPanel'),r=p.getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect(),stage=document.querySelector('.stage').getBoundingClientRect(),more=p.querySelector('.zoom-chat-more'),input=document.querySelector('#meetingChatInput');return {width:Math.round(r.width),mode:p.dataset.dsRuntimeMode||'',inside:r.left>=body.left+10&&r.right<=body.right-10&&r.top>=body.top+10&&r.bottom<=body.bottom-10,centerDelta:Math.round(Math.abs((r.left+r.width/2)-(body.left+body.width/2))),stageRightGap:Math.round(body.right-stage.right),head:parseFloat(getComputedStyle(p.querySelector('header strong')).fontSize),input:parseFloat(getComputedStyle(input).fontSize),more:Boolean(more&&getComputedStyle(more).display!=='none'),draggable:p.dataset.dsRuntimeDragBound==='1'};})()`);
  assert.ok(chat.width>=300&&chat.width<=420&&chat.head>=14.5&&chat.input>=12.5,'Chat is not at the approved compact readable runtime scale.');
  assert.equal(chat.mode,'floating','Chat must use the same final floating application-surface model.');
  assert.equal(chat.inside,true,'Chat must remain contained inside the meeting surface.');
  assert.ok(chat.centerDelta<=8,'Chat must open at one stable centered floating position.');
  assert.ok(Math.abs(chat.stageRightGap)<=2,'Floating Chat must not shrink the live stage.');
  assert.equal(chat.more,true,'Chat options ellipsis is missing.');
  assert.equal(chat.draggable,true,'Chat floating surface must have a drag authority.');
  await evaluate(`document.querySelector('#roomChat').click()`);

  // React contains six reactions only. Raise Hand is a separate toolbar control.
  const reactionIcon=await evaluate(`(()=>{window.DominionZoomPhysicalAcceptance.sync();const icon=document.querySelector('#roomReactions .ds-control-icon');return {marker:icon?.dataset.dsReactionIcon||'',svgCount:icon?.querySelectorAll('svg').length||0,pathCount:icon?.querySelectorAll('path').length||0,circleCount:icon?.querySelectorAll('circle').length||0,markup:icon?.innerHTML||''};})()`);
  assert.equal(reactionIcon.marker,'executive-smile','React toolbar must use the canonical smile-and-spark icon.');
  assert.equal(reactionIcon.svgCount,1,'React toolbar must render exactly one icon.');
  assert.ok(reactionIcon.circleCount>=1&&reactionIcon.pathCount>=2,'React toolbar icon is missing its smile/spark geometry.');
  assert.ok(!reactionIcon.markup.includes('M18 15.7'),'Rejected malformed React toolbar glyph returned.');
  await evaluate(`document.querySelector('#roomReactions').click()`);await waitFor("document.querySelector('.meeting-reaction-menu')",'canonical reaction menu');
  const reactionTray=await evaluate(`(()=>{const tray=document.querySelector('.meeting-reaction-menu'),buttons=[...tray.querySelectorAll('.reaction-emoji-button')],dedicated=document.querySelector('#roomRaiseHand');return {z:parseInt(getComputedStyle(tray).zIndex)||0,reactions:buttons.filter(b=>getComputedStyle(b).display!=='none').length,legacyTrayAbsent:!document.querySelector('.ds-reaction-tray'),legacyHandSuppressed:!tray.querySelector('.reaction-hand-button')||getComputedStyle(tray.querySelector('.reaction-hand-button')).display==='none',dedicatedHand:Boolean(dedicated&&!dedicated.hidden&&getComputedStyle(dedicated).display!=='none'),pointer:getComputedStyle(tray).pointerEvents,minWidth:buttons.length?Math.min(...buttons.map(b=>b.getBoundingClientRect().width)):0,minFont:buttons.length?Math.min(...buttons.map(b=>parseFloat(getComputedStyle(b).fontSize)||0)):0};})()`);
  assert.ok(reactionTray.z>=2700&&reactionTray.pointer!=='none','Reaction tray is behind another layer or cannot receive clicks.');
  assert.equal(reactionTray.reactions,6,'Reaction tray must expose six standard reaction buttons.');
  assert.equal(reactionTray.legacyHandSuppressed,true,'Raise Hand must not be duplicated inside React.');
  assert.equal(reactionTray.dedicatedHand,true,'Dedicated Raise Hand toolbar control is missing.');
  await evaluate(`document.querySelector('.meeting-reaction-menu')?.remove()`);

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
  console.log('DOMINIONSTAR_PACKAGED_PHYSICAL_ACCEPTANCE_OK view-click canonical-host-tools-panel more-click participant-media floating-draggable-participants compact-floating-chat full-width-stage reaction-six-only dedicated-raise-hand ten-second-left-reactions settings-readable runtime-owned-native-share stable-toolbar no-renderer-errors');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('physical acceptance shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);