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
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionZoomProductionPolish&&window.DominionZoomAdaptiveParity&&window.DominionApprovedReferenceParity&&document.querySelector('#meetingOverlay')",'approved reference controllers');

  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionZoomProductionPolish.sync();window.DominionZoomAdaptiveParity.sync();window.DominionApprovedReferenceParity.sync();return true;})()`);
  await waitFor("document.querySelector('#roomRaiseHand')&&document.querySelector('#roomHostTools')&&document.querySelector('#meetingViewButton')&&document.querySelector('.ds-approved-encryption')",'approved meeting chrome');

  // ---------- Header / brand / View / truthful encryption ----------
  const header=await evaluate(`(()=>{const brand=document.querySelector('.ds-meeting-brand'),security=document.querySelector('.ds-approved-encryption'),view=document.querySelector('#meetingViewButton');return {brand:Boolean(brand?.querySelector('img')&&/DominionStar Meet/i.test(brand.textContent||'')),security:String(security?.textContent||'').trim(),securityLabel:security?.getAttribute('aria-label')||'',securityTitle:security?.title||'',view:String(view?.textContent||'').trim()};})()`);
  assert.equal(header.brand,true,'Approved reference requires real DominionStar meeting branding.');
  assert.equal(header.view,'View','Approved reference requires the View control in the meeting header.');
  assert.equal(header.security,'Encrypted','Header must show the truthful encrypted-transport state.');
  assert.equal(header.securityLabel,'Encrypted media transport');
  assert.doesNotMatch(header.security,/end-to-end/i,'UI must not falsely claim E2EE.');
  assert.match(header.securityTitle,/DTLS-SRTP/i,'Encrypted indicator must explain the actual transport security.');

  await evaluate(`document.querySelector('#meetingViewButton').click()`);await waitFor("document.querySelector('.view-menu')",'View menu');
  const viewModes=await evaluate(`(()=>[...document.querySelectorAll('.view-menu button')].map(button=>String(button.textContent||'').replace(/^✓\s*/,'')))()`);
  assert.ok(viewModes.some(label=>/^Speaker$/i.test(label)),'View menu must expose Speaker.');
  assert.ok(viewModes.some(label=>/^Gallery$/i.test(label)),'View menu must expose Gallery.');
  assert.ok(viewModes.some(label=>/^Multi-speaker$/i.test(label)),'View menu must expose Multi-speaker.');
  await evaluate(`document.body.click()`);await sleep(30);

  // ---------- Toolbar order / dedicated Raise hand ----------
  const toolbar=await evaluate(`(()=>{window.DominionZoomProductionPolish.sync();window.DominionApprovedReferenceParity.sync();const expected=window.DominionApprovedReferenceParity.toolbarOrder;const footer=document.querySelector('.meeting-footer');const entries=expected.map(id=>{const node=document.querySelector('#'+id);return {id,order:Number.parseInt(getComputedStyle(node).order,10)||0,visible:Boolean(node&&!node.hidden&&getComputedStyle(node).display!=='none')};});const visual=[...entries].sort((a,b)=>a.order-b.order).map(entry=>entry.id);const raise=document.querySelector('#roomRaiseHand'),reactLabel=document.querySelector('#roomReactions .ds-control-label');return {visual,expected,orders:entries,marker:footer.dataset.approvedToolbarOrder||'',raiseVisible:Boolean(raise&&!raise.hidden&&getComputedStyle(raise).display!=='none'),raiseLabel:raise?.querySelector('.ds-control-label')?.textContent||'',raiseMarker:raise?.dataset.approvedDedicatedRaiseHand||'',reactVisual:String(getComputedStyle(reactLabel,'::after').content||'').replace(/[\"']/g,'')};})()`);
  assert.deepEqual(toolbar.visual,toolbar.expected,'Visual toolbar order must be Audio → Video → Participants → Chat → React → Raise hand → Share → Host tools → More → End.');
  assert.equal(toolbar.marker,toolbar.expected.join('|'),'Final toolbar authority marker is missing or stale.');
  assert.equal(toolbar.raiseVisible,true,'Dedicated Raise hand control must be visible.');
  assert.equal(toolbar.raiseLabel,'Raise hand');
  assert.equal(toolbar.raiseMarker,'1');
  assert.equal(toolbar.reactVisual,'React','Reaction control must remain visually labeled React even when hand state changes.');

  await evaluate(`document.querySelector('#roomRaiseHand').click()`);await sleep(100);
  const raised=await evaluate(`(()=>{window.DominionApprovedReferenceParity.sync();const react=document.querySelector('#roomReactions .ds-control-label');return {state:window.DominionMeetingFeatures.snapshot().handRaised,label:document.querySelector('#roomRaiseHand .ds-control-label')?.textContent||'',pressed:document.querySelector('#roomRaiseHand')?.getAttribute('aria-pressed'),react:String(getComputedStyle(react,'::after').content||'').replace(/[\"']/g,'')};})()`);
  assert.equal(raised.state,true,'Dedicated Raise hand button must change the real hand state.');
  assert.equal(raised.label,'Lower hand');assert.equal(raised.pressed,'true');assert.equal(raised.react,'React','Raising a hand must not rename the React control.');
  await evaluate(`document.querySelector('#roomRaiseHand').click()`);await sleep(80);

  await evaluate(`document.querySelector('#roomReactions').click()`);await waitFor("document.querySelector('.meeting-reaction-menu')",'reaction tray');await sleep(50);
  const reactions=await evaluate(`(()=>{window.DominionApprovedReferenceParity.sync();const menu=document.querySelector('.meeting-reaction-menu');return {buttons:[...menu.querySelectorAll('button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent.trim()),handVisible:Boolean(menu.querySelector('.reaction-hand-button')&&getComputedStyle(menu.querySelector('.reaction-hand-button')).display!=='none'),marker:menu.dataset.approvedReactionOnly||''};})()`);
  assert.equal(reactions.handVisible,false,'Reaction tray must not duplicate the dedicated Raise hand control.');
  assert.equal(reactions.buttons.length,6,'Reaction tray should contain the six standard reactions only.');
  assert.equal(reactions.marker,'1');

  // ---------- Chat: clean Zoom-style chrome without duplicate To: row ----------
  await evaluate(`(()=>{window.DominionMeetingFeatures.toggleChat(true);const select=document.querySelector('#meetingChatRecipient');if(![...select.options].some(o=>o.value==='peer-1')){const option=document.createElement('option');option.value='peer-1';option.textContent='Jordan Lee · Direct Message';select.append(option);}window.DominionZoomAdaptiveParity.syncChat();window.DominionApprovedReferenceParity.sync();return true;})()`);
  await waitFor("!document.querySelector('#meetingChatPanel').hidden&&document.querySelector('#meetingChatPanel .ds-adaptive-chat-nav')",'approved Chat');
  const chat=await evaluate(`(()=>{const panel=document.querySelector('#meetingChatPanel'),recipient=panel.querySelector('.meeting-chat-recipient'),nav=panel.querySelector('.ds-adaptive-chat-nav'),send=panel.querySelector('#meetingChatForm button[type="submit"]');return {recipientDisplay:recipient?getComputedStyle(recipient).display:'missing',recipientAria:recipient?.getAttribute('aria-hidden')||'',everyone:nav?.querySelector('[data-chat-everyone]')?.textContent?.trim()||'',newChat:nav?.querySelector('[data-chat-new]')?.textContent?.trim()||'',send:send?.textContent?.trim()||'',formatting:Boolean(panel.querySelector('.ql-toolbar,[data-chat-format],.chat-format-toolbar'))};})()`);
  assert.equal(chat.recipientDisplay,'none','Legacy To: row must not duplicate the approved Chat navigation.');
  assert.equal(chat.recipientAria,'true');
  assert.equal(chat.everyone,'Everyone');assert.match(chat.newChat,/New chat/);assert.equal(chat.send,'➤');
  assert.equal(chat.formatting,false,'Approved Chat must not introduce an unnecessary formatting toolbar.');

  await evaluate(`document.querySelector('#meetingChatPanel [data-chat-new]').click()`);await waitFor("document.querySelector('.ds-approved-chat-target-menu')",'direct-message target menu');
  const dm=await evaluate(`(()=>{const menu=document.querySelector('.ds-approved-chat-target-menu'),button=menu.querySelector('button');const label=button?.textContent?.trim()||'';button?.click();return {label,value:document.querySelector('#meetingChatRecipient')?.value||''};})()`);
  assert.equal(dm.label,'Jordan Lee');assert.equal(dm.value,'peer-1','New chat must still select a real direct-message recipient.');

  // ---------- Floating participant video filmstrip ----------
  const video=await evaluate(`(()=>{window.DominionMeetingParity.syncVideoDock();window.DominionZoomAdaptiveParity.sync();const dock=document.querySelector('#participantVideoDock');dock.hidden=false;let body=dock.querySelector('.participant-video-dock-body');if(!body){body=document.createElement('div');body.className='participant-video-dock-body';dock.append(body);}let tile=body.querySelector('.remote-peer-tile');if(!tile){tile=document.createElement('div');tile.className='remote-peer-tile active-speaker';tile.dataset.peerId='peer-visual';tile.innerHTML='<div class="remote-peer-name">Jordan Lee</div>';body.append(tile);}tile.classList.add('active-speaker');window.DominionZoomAdaptiveParity.sync();window.DominionApprovedReferenceParity.syncVideoPanel();const head=dock.querySelector('.participant-video-dock-head'),grip=dock.querySelector('.dock-grip');return {marker:dock.dataset.approvedFilmstrip||'',wholeDrag:dock.dataset.dsAdaptiveWholePanelDrag||'',cursor:getComputedStyle(dock).cursor,headDisplay:head?getComputedStyle(head).display:'none',gripDisplay:grip?getComputedStyle(grip).display:'none',radius:parseFloat(getComputedStyle(tile).borderRadius)||0,tileCursor:getComputedStyle(tile).cursor,activeBorder:getComputedStyle(tile).borderTopColor};})()`);
  assert.equal(video.marker,'1');assert.equal(video.wholeDrag,'1','Video panel must remain draggable from the whole non-control surface.');
  assert.equal(video.cursor,'default');assert.equal(video.tileCursor,'default');assert.equal(video.headDisplay,'none','Video filmstrip must not expose a dedicated grip/title bar.');assert.equal(video.gripDisplay,'none');
  assert.ok(video.radius>=8,'Video tiles must retain the approved rounded filmstrip geometry.');
  assert.match(video.activeBorder,/66\D+212\D+108/,'Active speaker must retain the approved green filmstrip emphasis.');

  await sleep(80);
  assert.deepEqual(runtimeErrors,[],'Approved-reference gate emitted uncaught renderer exceptions:\n'+runtimeErrors.join('\n'));
  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer wrote an uncaught JavaScript error to stderr.');
  console.log('DOMINIONSTAR_PACKAGED_APPROVED_REFERENCE_2_0_22_OK brand view-modes truthful-encryption visual-toolbar-order dedicated-raise-hand react-stable reactions-only clean-chat direct-messages no-formatting floating-filmstrip active-speaker whole-panel-drag no-grip no-renderer-errors');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('approved-reference shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
