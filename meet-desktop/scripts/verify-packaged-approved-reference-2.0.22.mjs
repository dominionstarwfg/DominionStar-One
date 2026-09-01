import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-approved-reference-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10780+Math.floor(Math.random()*120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const runtimeErrors=[];
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before approved-reference gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(150);}throw new Error('Unable to attach to packaged renderer for approved-reference gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Approved-reference CDP connection timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Approved-reference CDP connection failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},4000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown'){runtimeErrors.push(message.params?.exceptionDetails?.exception?.description||message.params?.exceptionDetails?.text||'Runtime exception');return;}if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionZoomProductionPolish&&window.DominionApprovedReferenceParity&&window.DominionRuntimeStability&&window.DominionZoomReactionParity&&window.DominionPhysicalMacRepair&&window.DominionShareIntegration&&document.querySelector('#meetingOverlay')",'final approved reference controllers');

  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionZoomProductionPolish.sync();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();window.DominionZoomReactionParity.mount();return true;})()`);
  await waitFor("document.querySelector('#roomRaiseHand')&&document.querySelector('#roomHostTools')&&document.querySelector('#meetingViewButton')&&document.querySelector('.ds-approved-encryption')&&document.querySelector('.meeting-footer')?.dataset.dsRuntimeToolbarZones==='1'",'approved meeting chrome');

  const header=await evaluate(`(()=>{const brand=document.querySelector('.ds-meeting-brand'),security=document.querySelector('.ds-approved-encryption'),view=document.querySelector('#meetingViewButton');return {brand:Boolean(brand?.querySelector('img')&&/DominionStar Meet/i.test(brand.textContent||'')),security:String(security?.textContent||'').trim(),securityLabel:security?.getAttribute('aria-label')||'',securityTitle:security?.title||'',view:String(view?.textContent||'').trim()};})()`);
  assert.equal(header.brand,true,'Approved reference requires real DominionStar meeting branding.');
  assert.equal(header.view,'View','Approved reference requires the View control in the meeting header.');
  assert.equal(header.security,'Encrypted','Header must show the truthful encrypted-transport state.');
  assert.equal(header.securityLabel,'Encrypted media transport');
  assert.doesNotMatch(header.security,/end-to-end/i,'UI must not falsely claim E2EE.');
  assert.match(header.securityTitle,/DTLS-SRTP/i,'Encrypted indicator must explain the actual transport security.');

  // View remains a real command surface regardless of which legacy helper
  // originally installed its click handler.
  await evaluate(`document.querySelector('#meetingViewButton').click()`);
  await waitFor("document.querySelector('.view-menu,.ds-command-menu')",'View menu');
  const viewModes=await evaluate(`(()=>{const menu=[...document.querySelectorAll('.view-menu,.ds-command-menu')].find(m=>/Speaker|Gallery|Multi-speaker/.test(m.textContent||''));return [...(menu?.querySelectorAll('button')||[])].map(button=>String(button.textContent||'').replace(/^✓\\s*/,'').trim());})()`);
  assert.ok(viewModes.some(label=>/(?:^|:\s*)Speaker$/i.test(label)),`View menu must expose Speaker. Found ${JSON.stringify(viewModes)}`);
  assert.ok(viewModes.some(label=>/(?:^|:\s*)Gallery$/i.test(label)),`View menu must expose Gallery. Found ${JSON.stringify(viewModes)}`);
  assert.ok(viewModes.some(label=>/(?:^|:\s*)Multi-speaker$/i.test(label)),`View menu must expose Multi-speaker. Found ${JSON.stringify(viewModes)}`);
  await evaluate(`document.querySelectorAll('.view-menu,.ds-command-menu').forEach(n=>n.remove())`);

  const toolbar=await evaluate(`(()=>{window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.ensureToolbarZones();const expected=window.DominionApprovedReferenceParity.hostToolbarOrder,footer=document.querySelector('.meeting-footer');const geometry=expected.map(id=>{const n=document.querySelector('#'+id),r=n?.getBoundingClientRect();return {id,left:r?.left??-1,visible:Boolean(n&&!n.hidden&&getComputedStyle(n).display!=='none')};});const visual=[...geometry].filter(x=>x.visible).sort((a,b)=>a.left-b.left).map(x=>x.id);const raise=document.querySelector('#roomRaiseHand'),host=document.querySelector('#roomHostTools'),reactLabel=document.querySelector('#roomReactions .ds-control-label');return {visual,expected,marker:footer.dataset.approvedToolbarOrder||'',stable:footer.dataset.dsRuntimeToolbarZones||'',zones:footer.querySelectorAll(':scope > .ds-runtime-toolbar-zone').length,hostVisible:Boolean(host&&!host.hidden&&getComputedStyle(host).display!=='none'),raiseVisible:Boolean(raise&&!raise.hidden&&getComputedStyle(raise).display!=='none'),raiseLabel:raise?.querySelector('.ds-control-label')?.textContent||'',raiseMarker:raise?.dataset.approvedDedicatedRaiseHand||'',reactText:String(reactLabel?.textContent||'').trim(),reactFont:reactLabel?parseFloat(getComputedStyle(reactLabel).fontSize):0};})()`);
  assert.deepEqual(toolbar.visual,toolbar.expected,'Visible host toolbar order must be Audio → Video → Participants → Chat → React → Raise hand → Share → Host tools → More → End.');
  assert.equal(toolbar.marker,toolbar.expected.join('|'),'Final host toolbar authority marker is missing or stale.');
  assert.equal(toolbar.stable,'1','Stable toolbar zoning marker is missing.');
  assert.equal(toolbar.zones,3,'Approved toolbar must retain independent left, center, and right zones.');
  assert.equal(toolbar.hostVisible,true,'Host Tools must be visible for the Host reference scenario.');
  assert.equal(toolbar.raiseVisible,true,'Dedicated Raise hand control must be visible.');
  assert.equal(toolbar.raiseLabel,'Raise hand');
  assert.equal(toolbar.raiseMarker,'1');
  assert.equal(toolbar.reactText,'React','Reaction control must use the real React label.');
  assert.ok(toolbar.reactFont>=11.5,'Real React label must remain readable.');

  await evaluate(`document.querySelector('#roomRaiseHand').click()`);await sleep(100);
  const raised=await evaluate(`(()=>{window.DominionApprovedReferenceParity.sync();const react=document.querySelector('#roomReactions .ds-control-label');return {state:window.DominionMeetingFeatures.snapshot().handRaised,label:document.querySelector('#roomRaiseHand .ds-control-label')?.textContent||'',pressed:document.querySelector('#roomRaiseHand')?.getAttribute('aria-pressed'),react:String(react?.textContent||'').trim()};})()`);
  assert.equal(raised.state,true,'Dedicated Raise hand button must change the real hand state.');
  assert.equal(raised.label,'Lower hand');
  assert.equal(raised.pressed,'true');
  assert.equal(raised.react,'React','Raising a hand must not rename React.');
  await evaluate(`document.querySelector('#roomRaiseHand').click()`);await sleep(70);

  await evaluate(`document.querySelector('#roomReactions').click()`);
  await waitFor("document.querySelector('.ds-reaction-tray,.meeting-reaction-menu')",'reaction tray');await sleep(40);
  const reactions=await evaluate(`(()=>{const menu=document.querySelector('.ds-reaction-tray,.meeting-reaction-menu'),buttons=[...menu.querySelectorAll('button')].filter(b=>getComputedStyle(b).display!=='none'),hand=menu.querySelector('.ds-raise-hand,.reaction-hand-button');return {buttons:buttons.filter(b=>!b.matches('.ds-raise-hand,.reaction-hand-button')).map(b=>b.textContent.trim()),handVisible:Boolean(hand&&getComputedStyle(hand).display!=='none')};})()`);
  assert.equal(reactions.handVisible,false,'Reaction tray must not duplicate the dedicated Raise hand control.');
  assert.equal(reactions.buttons.length,6,'Reaction tray must contain six standard reactions only.');
  await evaluate(`document.querySelectorAll('.ds-reaction-tray,.meeting-reaction-menu').forEach(n=>n.remove())`);

  // Final Chat authority: exercise the real toolbar click so the same one-shot
  // adaptive structure used by the user path mounts Everyone / New chat before
  // approved-reference wiring takes ownership of labels and direct messages.
  await evaluate(`(async()=>{document.querySelector('#roomChat').click();await new Promise(resolve=>setTimeout(resolve,250));await window.DominionZoomBehavior?.refreshChatRecipients?.();window.DominionZoomAdaptiveParity?.syncChat?.();window.DominionApprovedReferenceParity.syncChatNavigation();window.DominionRuntimeStability.layoutSideSurface();return true;})()`);
  await waitFor("!document.querySelector('#meetingChatPanel').hidden&&document.querySelector('#meetingChatPanel .ds-adaptive-chat-nav')",'approved Chat');
  await evaluate(`(()=>{const select=document.querySelector('#meetingChatRecipient');const prior=[...select.options].find(o=>o.value==='peer-1');if(prior)prior.remove();const option=document.createElement('option');option.value='peer-1';option.textContent='Jordan Lee · Direct Message';select.append(option);select.value='everyone';window.DominionApprovedReferenceParity.syncChatNavigation();return true;})()`);
  await waitFor("[...document.querySelector('#meetingChatRecipient').options].some(option=>option.value==='peer-1'&&/Jordan Lee/.test(option.textContent||''))",'stable direct-message fixture');

  const chat=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('#meetingChatPanel'),recipient=panel.querySelector('.meeting-chat-recipient'),nav=panel.querySelector('.ds-adaptive-chat-nav'),send=panel.querySelector('#meetingChatForm button[type="submit"]'),r=panel.getBoundingClientRect(),body=document.querySelector('.meeting-body').getBoundingClientRect();return {recipientDisplay:recipient?getComputedStyle(recipient).display:'missing',recipientAria:recipient?.getAttribute('aria-hidden')||'',everyone:nav?.querySelector('[data-chat-everyone]')?.textContent?.trim()||'',newChat:nav?.querySelector('[data-chat-new]')?.textContent?.trim()||'',send:send?.textContent?.trim()||'',formatting:Boolean(panel.querySelector('.ql-toolbar,[data-chat-format],.chat-format-toolbar')),mode:panel.dataset.dsRuntimeMode||'',rightGap:Math.round(body.right-r.right)};})()`);
  assert.equal(chat.recipientDisplay,'none','Legacy To: row must not duplicate the approved Chat navigation.');
  assert.equal(chat.recipientAria,'true');
  assert.equal(chat.everyone,'Everyone');
  assert.match(chat.newChat,/New chat/);
  assert.equal(chat.send,'➤');
  assert.equal(chat.formatting,false,'Approved Chat must not introduce an unnecessary formatting toolbar.');
  assert.equal(chat.mode,'docked','Approved desktop Chat must use final right-side runtime geometry.');
  assert.ok(Math.abs(chat.rightGap)<=2,'Approved Chat must sit flush to the meeting right edge.');

  await evaluate(`document.querySelector('#meetingChatPanel [data-chat-new]').click()`);
  await waitFor("document.querySelector('.ds-approved-chat-target-menu button')&&/Jordan Lee/.test(document.querySelector('.ds-approved-chat-target-menu button').textContent||'')",'direct-message target menu');
  const dm=await evaluate(`(()=>{const menu=document.querySelector('.ds-approved-chat-target-menu'),button=menu.querySelector('button');const label=button?.textContent?.trim()||'';button?.click();return {label,value:document.querySelector('#meetingChatRecipient')?.value||''};})()`);
  assert.equal(dm.label,'Jordan Lee');
  assert.equal(dm.value,'peer-1','New chat must still select a real direct-message recipient.');
  await evaluate(`window.DominionRuntimeStability.setChat(false)`);

  // Final floating participant-video surface keeps whole-surface drag without a grip.
  const video=await evaluate(`(()=>{window.DominionMeetingParity.applyViewMode('speaker');const overlay=document.querySelector('#meetingOverlay'),dock=document.querySelector('#participantVideoDock');let body=dock.querySelector('.participant-video-dock-body');if(!body){body=document.createElement('div');body.className='participant-video-dock-body';dock.append(body);}let tile=body.querySelector('.remote-peer-tile');if(!tile){tile=document.createElement('div');tile.className='remote-peer-tile active-speaker';tile.dataset.peerId='peer-visual';tile.innerHTML='<div class="remote-peer-name">Jordan Lee</div>';body.append(tile);}tile.classList.add('active-speaker');dock.hidden=false;window.DominionApprovedReferenceParity.syncVideoPanel();window.DominionRuntimeStability.sync();const head=dock.querySelector('.participant-video-dock-head'),grip=dock.querySelector('.dock-grip');return {marker:dock.dataset.approvedFilmstrip||'',wholeDrag:dock.dataset.dsRuntimeWholePanelDrag||'',cursor:getComputedStyle(dock).cursor,headDisplay:head?getComputedStyle(head).display:'none',gripDisplay:grip?getComputedStyle(grip).display:'none',radius:parseFloat(getComputedStyle(tile).borderRadius)||0,tileCursor:getComputedStyle(tile).cursor,activeBorder:getComputedStyle(tile).borderTopColor};})()`);
  assert.equal(video.marker,'1');
  assert.equal(video.wholeDrag,'1','Video panel must remain draggable from the whole non-control surface.');
  assert.equal(video.cursor,'default');
  assert.equal(video.tileCursor,'default');
  assert.equal(video.headDisplay,'none','Video filmstrip must not expose a dedicated grip/title bar.');
  assert.equal(video.gripDisplay,'none');
  assert.ok(video.radius>=8,'Video tiles must retain the approved rounded filmstrip geometry.');
  assert.match(video.activeBorder,/66\D+212\D+108/,'Active speaker must retain the approved green filmstrip emphasis.');

  await sleep(80);
  assert.deepEqual(runtimeErrors,[],'Approved-reference gate emitted uncaught renderer exceptions:\n'+runtimeErrors.join('\n'));
  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer wrote an uncaught JavaScript error to stderr.');
  console.log('DOMINIONSTAR_PACKAGED_APPROVED_REFERENCE_2_0_22_OK brand view-modes truthful-encryption stable-host-toolbar host-tools dedicated-raise-hand real-react-label reactions-six-only clean-runtime-chat direct-messages no-formatting floating-filmstrip active-speaker whole-panel-drag no-grip no-renderer-errors');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('approved-reference shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
