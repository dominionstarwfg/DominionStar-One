import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-approved-reference-2.0.22.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10780+Math.floor(Math.random()*120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='',stdoutBuffer='',qaRpcId=0;
const runtimeErrors=[],qaRpcPending=new Map();
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['pipe','pipe','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});
child.stdout.on('data',chunk=>{
  stdoutBuffer+=String(chunk);
  while(stdoutBuffer.includes('\n')){
    const cut=stdoutBuffer.indexOf('\n'),line=stdoutBuffer.slice(0,cut).trim();stdoutBuffer=stdoutBuffer.slice(cut+1);
    if(!line.startsWith('DOMINIONSTAR_QA_RPC '))continue;
    let message=null;try{message=JSON.parse(line.slice('DOMINIONSTAR_QA_RPC '.length));}catch{continue;}
    const waiter=qaRpcPending.get(Number(message?.id)||0);if(!waiter)continue;
    qaRpcPending.delete(Number(message.id));clearTimeout(waiter.timer);
    message.ok?waiter.resolve(message.value):waiter.reject(new Error(String(message.error||'qa_rpc_failed')));
  }
});

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before approved-reference gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(150);}throw new Error('Unable to attach to packaged renderer for approved-reference gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('Approved-reference CDP connection timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Approved-reference CDP connection failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},4000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}
function qaRpc(method,payload={},timeout=4500){
  return new Promise((resolve,reject)=>{
    if(child.exitCode!==null)return reject(new Error(`Packaged app exited before QA RPC ${method}.\n${stderr}`));
    const id=++qaRpcId,timer=setTimeout(()=>{qaRpcPending.delete(id);reject(new Error(`QA RPC timeout ${method}`));},timeout);
    qaRpcPending.set(id,{resolve,reject,timer});
    try{child.stdin.write(JSON.stringify({id,method,...payload})+'\n');}
    catch(error){clearTimeout(timer);qaRpcPending.delete(id);reject(error);}
  });
}
async function physicalMouseMove(x,y){
  return qaRpc('input',{event:{type:'mouseMoved',x:Math.round(Number(x)||0),y:Math.round(Number(y)||0)}});
}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown'){runtimeErrors.push(message.params?.exceptionDetails?.exception?.description||message.params?.exceptionDetails?.text||'Runtime exception');return;}if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionZoomProductionPolish&&window.DominionApprovedReferenceParity&&window.DominionRuntimeStability&&window.DominionZoomReactionParity&&window.DominionPhysicalMacRepair&&window.DominionShareIntegration&&document.querySelector('#meetingOverlay')",'final approved reference controllers');

  await evaluate(`(()=>{for(const dialog of document.querySelectorAll('dialog[open]')){try{dialog.close();}catch{dialog.removeAttribute('open');}}document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionZoomProductionPolish.sync();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();window.DominionZoomReactionParity.mount();return true;})()`);
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

  const toolbar=await evaluate(`(()=>{window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.ensureToolbarZones();window.DominionZoomScreenshotReference?.sync?.();const expected=window.DominionApprovedReferenceParity.hostToolbarOrder,footer=document.querySelector('.meeting-footer');const geometry=expected.map(id=>{const n=document.querySelector('#'+id),r=n?.getBoundingClientRect();return {id,left:r?.left??-1,visible:Boolean(n&&!n.hidden&&getComputedStyle(n).display!=='none')};});const visual=[...geometry].filter(x=>x.visible).sort((a,b)=>a.left-b.left).map(x=>x.id);const raise=document.querySelector('#roomRaiseHand'),host=document.querySelector('#roomHostTools'),reactLabel=document.querySelector('#roomReactions .ds-control-label');return {visual,expected,marker:footer.dataset.approvedToolbarOrder||'',stable:footer.dataset.dsRuntimeToolbarZones||'',zones:footer.querySelectorAll(':scope > .ds-runtime-toolbar-zone').length,hostVisible:Boolean(host&&!host.hidden&&getComputedStyle(host).display!=='none'),raiseVisible:Boolean(raise&&!raise.hidden&&getComputedStyle(raise).display!=='none'),raiseLabel:raise?.querySelector('.ds-control-label')?.textContent||'',raiseMarker:raise?.dataset.approvedDedicatedRaiseHand||'',reactText:String(reactLabel?.textContent||'').trim(),reactFont:reactLabel?parseFloat(getComputedStyle(reactLabel).fontSize):0};})()`);
  assert.deepEqual(toolbar.visual,toolbar.expected,'Visible host toolbar order must be Audio → Video → Participants → Chat → React → Raise hand → Share → Host tools → More → End.');
  assert.equal(toolbar.marker,toolbar.expected.join('|'),'Final host toolbar authority marker is missing or stale.');
  assert.equal(toolbar.stable,'1','Stable toolbar zoning marker is missing.');
  assert.equal(toolbar.zones,3,'Approved toolbar must retain independent left, center, and right zones.');
  assert.equal(toolbar.hostVisible,true,'Host Tools must be visible for the Host reference scenario.');
  assert.equal(toolbar.raiseVisible,true,'Dedicated Raise hand control must be visible.');
  assert.equal(toolbar.raiseLabel,'Raise hand');
  assert.equal(toolbar.raiseMarker,'1');
  assert.equal(toolbar.reactText,'React','Reaction control must use the real React label.');
  assert.ok(toolbar.reactFont>=9.5,'Real React label must remain readable at the approved 2.0.41 compact reference size.');

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

  // Single approved illustration: Participants opens centered at the approved
  // default, can restore remembered user geometry, and resets back to center.
  await evaluate(`window.DominionRuntimeStability.setParticipants(true)`);
  await waitFor("document.querySelector('.room-side')&&!document.querySelector('.room-side').hidden",'approved Participants window');
  const participantsDefault=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect();return {width:Math.round(pr.width),height:Math.round(pr.height),centerDx:Math.round((pr.left+pr.width/2)-(br.left+br.width/2)),centerDy:Math.round((pr.top+pr.height/2)-(br.top+br.height/2)),handles:panel.querySelectorAll('.ds-runtime-resize-handle').length,trafficDirection:getComputedStyle(panel.querySelector('.ds-panel-traffic')).flexDirection};})()`);
  assert.ok(Math.abs(participantsDefault.width-318)<=2,`Approved Participants default width must remain 318px. ${JSON.stringify(participantsDefault)}`);
  assert.ok(Math.abs(participantsDefault.height-390)<=2,`Approved Participants default height must remain 390px. ${JSON.stringify(participantsDefault)}`);
  assert.ok(Math.abs(participantsDefault.centerDx)<=3&&Math.abs(participantsDefault.centerDy)<=3,`Approved Participants must open centered. ${JSON.stringify(participantsDefault)}`);
  assert.equal(participantsDefault.handles,8,'Approved floating Participants window must expose eight edge/corner resize hit areas.');
  assert.equal(participantsDefault.trafficDirection,'row','Mac traffic lights must remain horizontal.');
  const participantSearch=await evaluate(`(()=>{const wrap=document.querySelector('.room-side .zoom-participant-search'),input=wrap?.querySelector('input');const s=wrap?getComputedStyle(wrap):null;return {exists:Boolean(wrap&&input),hidden:Boolean(wrap?.hidden),display:s?.display||'',placeholder:input?.getAttribute('placeholder')||''};})()`);
  assert.equal(participantSearch.exists,true,'Approved Participants window must contain its search field.');
  assert.equal(participantSearch.hidden,false,'Participants search must remain stable and visible even with a small roster.');
  assert.notEqual(participantSearch.display,'none','Participants search must not disappear by roster count.');
  assert.equal(participantSearch.placeholder,'Search participants');

  await evaluate(`window.dispatchEvent(new CustomEvent('dominion:waiting-room-update',{detail:{items:[{participantId:'qa-waiting',displayName:'Jordan Lee'}],added:[{participantId:'qa-waiting',displayName:'Jordan Lee'}]}}))`);
  await waitFor("document.querySelector('#meetingEventToast')&&!document.querySelector('#meetingEventToast').hidden",'approved top-center Waiting Room alert');
  const waitingAlert=await evaluate(`(()=>{const node=document.querySelector('#meetingEventToast'),r=node.getBoundingClientRect();return {title:node.querySelector('strong')?.textContent?.trim()||'',body:node.querySelector('span')?.textContent?.trim()||'',centerDx:Math.round((r.left+r.width/2)-(innerWidth/2)),top:Math.round(r.top),leftStyle:getComputedStyle(node).left,rightStyle:getComputedStyle(node).right,transform:getComputedStyle(node).transform};})()`);
  assert.equal(waitingAlert.title,'Waiting Room');
  assert.match(waitingAlert.body,/Jordan Lee is waiting to join/);
  assert.ok(Math.abs(waitingAlert.centerDx)<=2,`Waiting Room alert must be horizontally centered. ${JSON.stringify(waitingAlert)}`);
  assert.ok(waitingAlert.top>=68&&waitingAlert.top<=76,`Waiting Room alert must remain in the approved top-center lane. ${JSON.stringify(waitingAlert)}`);
  await evaluate(`window.DominionMeetingNotifications?.reset?.()`);


  const restoredGeometry=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),br=body.getBoundingClientRect();localStorage.setItem('ds_meet_floating_surface_geometry_v1',JSON.stringify({participants:{left:44,top:58,width:296,height:332}}));panel.dataset.dsRuntimeUserPositioned='0';window.DominionRuntimeStability.layoutSideSurface();const pr=panel.getBoundingClientRect();return {left:Math.round(pr.left-br.left),top:Math.round(pr.top-br.top),width:Math.round(pr.width),height:Math.round(pr.height),user:panel.dataset.dsRuntimeUserPositioned||''};})()`);
  assert.ok(Math.abs(restoredGeometry.left-44)<=2&&Math.abs(restoredGeometry.top-58)<=2,`Participants must restore remembered position. ${JSON.stringify(restoredGeometry)}`);
  assert.ok(Math.abs(restoredGeometry.width-296)<=2&&Math.abs(restoredGeometry.height-332)<=2,`Participants must restore remembered size. ${JSON.stringify(restoredGeometry)}`);
  assert.equal(restoredGeometry.user,'1','Restored Participants geometry must enter explicit user-positioned mode.');

  await evaluate(`document.querySelector('.room-side .ds-traffic-restore').click()`);await sleep(80);
  const resetGeometry=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect();const saved=JSON.parse(localStorage.getItem('ds_meet_floating_surface_geometry_v1')||'{}');return {width:Math.round(pr.width),height:Math.round(pr.height),centerDx:Math.round((pr.left+pr.width/2)-(br.left+br.width/2)),centerDy:Math.round((pr.top+pr.height/2)-(br.top+br.height/2)),saved:Boolean(saved.participants),user:panel.dataset.dsRuntimeUserPositioned||''};})()`);
  assert.equal(resetGeometry.saved,false,'Restore control must clear remembered Participants geometry.');
  assert.equal(resetGeometry.user,'0','Restore control must return Participants to default geometry mode.');
  assert.ok(Math.abs(resetGeometry.width-318)<=2&&Math.abs(resetGeometry.height-390)<=2&&Math.abs(resetGeometry.centerDx)<=3&&Math.abs(resetGeometry.centerDy)<=3,`Restore control must return Participants to the approved centered 318x390 default. ${JSON.stringify(resetGeometry)}`);
  await evaluate(`window.DominionRuntimeStability.setParticipants(false)`);

  // Single approved illustration: top bar fades away on idle and returns on activity.
  await evaluate(`(()=>{const overlay=document.querySelector('#meetingOverlay');overlay.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:240,clientY:160,pointerId:91}));return overlay.dataset.dsRuntimeTopbarHidden;})()`);
  await waitFor("document.querySelector('#meetingOverlay')?.dataset.dsRuntimeTopbarHidden==='1'",'approved idle-hidden meeting top bar',4200);
  await waitFor("parseFloat(getComputedStyle(document.querySelector('#meetingOverlay .meeting-head')).opacity)<0.1",'approved top bar fade-out completion',1200);
  const topbarHidden=await evaluate(`(()=>{const overlay=document.querySelector('#meetingOverlay'),head=overlay.querySelector('.meeting-head'),s=getComputedStyle(head);return {state:overlay.dataset.dsRuntimeTopbarHidden,opacity:parseFloat(s.opacity),pointer:s.pointerEvents};})()`);
  assert.equal(topbarHidden.state,'1');
  assert.ok(topbarHidden.opacity<.1,`Approved idle top bar must fade out. ${JSON.stringify(topbarHidden)}`);
  assert.equal(topbarHidden.pointer,'none');
  await evaluate(`document.querySelector('#meetingOverlay').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:260,clientY:170,pointerId:92}))`);
  await waitFor("document.querySelector('#meetingOverlay')?.dataset.dsRuntimeTopbarHidden==='0'&&parseFloat(getComputedStyle(document.querySelector('#meetingOverlay .meeting-head')).opacity)>0.9",'approved top bar fade-in completion',1200);
  const topbarVisible=await evaluate(`(()=>{const overlay=document.querySelector('#meetingOverlay'),head=overlay.querySelector('.meeting-head'),s=getComputedStyle(head);return {state:overlay.dataset.dsRuntimeTopbarHidden,opacity:parseFloat(s.opacity)};})()`);
  assert.equal(topbarVisible.state,'0','Pointer activity must reveal the approved top bar.');
  assert.ok(topbarVisible.opacity>.9,`Approved top bar must fade back in. ${JSON.stringify(topbarVisible)}`);

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
  assert.equal(chat.mode,'floating','Approved desktop Chat must use the final floating application-surface geometry.');
  assert.ok(chat.rightGap>=10,'Approved floating Chat must remain detached from the meeting right edge rather than reverting to the retired docked model.');

  await evaluate(`document.querySelector('#meetingChatPanel [data-chat-new]').click()`);
  await waitFor("document.querySelector('.ds-approved-chat-target-menu button')&&/Jordan Lee/.test(document.querySelector('.ds-approved-chat-target-menu button').textContent||'')",'direct-message target menu');
  const dm=await evaluate(`(()=>{const menu=document.querySelector('.ds-approved-chat-target-menu'),button=menu.querySelector('button');const label=button?.textContent?.trim()||'';button?.click();return {label,value:document.querySelector('#meetingChatRecipient')?.value||''};})()`);
  assert.equal(dm.label,'Jordan Lee');
  assert.equal(dm.value,'peer-1','New chat must still select a real direct-message recipient.');
  await evaluate(`window.DominionRuntimeStability.setChat(false)`);

  // Approved meeting-state behavior: solo has no strip; with one remote participant,
  // that participant owns the main speaker stage and self remains in the right-side strip.
  const soloVideoState=await evaluate(`(()=>{const parity=window.DominionMeetingParity;parity.applyViewMode('speaker');const dock=document.querySelector('#participantVideoDock'),body=dock.querySelector('.participant-video-dock-body');let strip=document.querySelector('#remoteTileStrip');if(!strip){strip=document.createElement('div');strip.id='remoteTileStrip';strip.className='remote-tile-strip';body.append(strip);}for(const tile of [...strip.querySelectorAll('.remote-peer-tile')])tile.remove();const local=dock.querySelector('#localVideoDockTile');if(local)local.hidden=true;parity.syncVideoDock();const fallback=document.querySelector('#remoteActiveSpeakerFallback');return {dockHidden:Boolean(dock.hidden),localHidden:Boolean(local?.hidden),fallbackHidden:fallback?Boolean(fallback.hidden):true};})()`);
  assert.equal(soloVideoState.dockHidden,true,'Approved one-person meeting must not show a participant video strip.');
  assert.equal(soloVideoState.localHidden,true,'Approved one-person meeting must not create a redundant self strip tile.');
  assert.equal(soloVideoState.fallbackHidden,true,'Approved one-person meeting must not show a remote speaker fallback.');

  const remoteCameraOffState=await evaluate(`(()=>{const parity=window.DominionMeetingParity,dock=document.querySelector('#participantVideoDock'),body=dock.querySelector('.participant-video-dock-body');let strip=document.querySelector('#remoteTileStrip');if(!strip){strip=document.createElement('div');strip.id='remoteTileStrip';strip.className='remote-tile-strip';body.append(strip);}const tile=document.createElement('article');tile.className='remote-peer-tile';tile.dataset.peerId='peer-approved-camera';tile.dataset.participantName='Jordan Lee';tile.innerHTML='<video autoplay playsinline hidden></video><div class="remote-peer-fallback"><span>JL</span></div><footer><strong>Jordan Lee</strong><small>Connected</small></footer>';strip.append(tile);parity.applyViewMode('speaker');parity.syncVideoDock();const local=dock.querySelector('#localVideoDockTile'),fallback=document.querySelector('#remoteActiveSpeakerFallback'),active=document.querySelector('#remoteActiveSpeakerStage'),dr=dock.getBoundingClientRect(),sr=document.querySelector('.stage').getBoundingClientRect();return {dockHidden:Boolean(dock.hidden),orientation:dock.dataset.orientation||'',rightGap:Math.round(sr.right-dr.right),localHidden:Boolean(local?.hidden),remotePromoted:tile.classList.contains('stage-promoted'),fallbackHidden:Boolean(fallback?.hidden),fallbackName:fallback?.querySelector('h3')?.textContent?.trim()||'',fallbackInitials:fallback?.querySelector('.remote-active-speaker-avatar')?.textContent?.trim()||'',activeHidden:Boolean(active?.hidden)};})()`);
  assert.equal(remoteCameraOffState.dockHidden,false,'Approved two-person meeting must show the right-side participant strip.');
  assert.equal(remoteCameraOffState.orientation,'vertical','Approved two-person participant strip must default to the right-side vertical layout.');
  assert.ok(Math.abs(remoteCameraOffState.rightGap-14)<=2,`Approved participant strip must stay on the right edge. ${JSON.stringify(remoteCameraOffState)}`);
  assert.equal(remoteCameraOffState.localHidden,false,'When the remote participant owns the speaker stage, self view must remain available in the right strip.');
  assert.equal(remoteCameraOffState.remotePromoted,true,'The sole remote participant must own the main speaker stage.');
  assert.equal(remoteCameraOffState.fallbackHidden,false,'Remote camera-off state must show the participant profile/initials fallback on the main stage.');
  assert.equal(remoteCameraOffState.fallbackName,'Jordan Lee');
  assert.equal(remoteCameraOffState.fallbackInitials,'JL');
  assert.equal(remoteCameraOffState.activeHidden,true,'Remote camera-off state must not show an empty video element over the fallback.');

  const remoteCameraOnState=await evaluate(`(()=>{const parity=window.DominionMeetingParity,tile=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]'),video=tile.querySelector('video'),stream=new MediaStream();video.srcObject=stream;video.hidden=false;parity.syncVideoDock();const fallback=document.querySelector('#remoteActiveSpeakerFallback'),active=document.querySelector('#remoteActiveSpeakerStage'),alreadyActive=tile.classList.contains('active-speaker');tile.classList.add('active-speaker');const activeBorder=getComputedStyle(tile).borderTopColor;if(!alreadyActive)tile.classList.remove('active-speaker');return {fallbackHidden:Boolean(fallback?.hidden),activeHidden:Boolean(active?.hidden),sameStream:Boolean(active?.srcObject===stream),localHidden:Boolean(document.querySelector('#localVideoDockTile')?.hidden),activeBorder};})()`);
  assert.equal(remoteCameraOnState.fallbackHidden,true,'Remote camera-on state must replace the profile fallback with live video.');
  assert.equal(remoteCameraOnState.activeHidden,false,'Remote camera-on state must show the live remote speaker stage.');
  assert.equal(remoteCameraOnState.sameStream,true,'Main speaker stage must use the remote participant video stream.');
  assert.equal(remoteCameraOnState.localHidden,false,'Self view must remain available in the right strip while the remote participant is on stage.');
  assert.match(remoteCameraOnState.activeBorder,/53\D+208\D+127/,'Real remote active speaker must retain the approved #35d07f green filmstrip emphasis.');

  // Final floating participant-video surface keeps whole-surface drag without a grip.
  // Keep the real two-person meeting state from the camera-on scenario above so
  // hover is certified against the same filmstrip the user actually receives.
  const video=await evaluate(`(()=>{const parity=window.DominionMeetingParity;parity.applyViewMode('speaker');parity.syncVideoDock();const dock=document.querySelector('#participantVideoDock');window.DominionApprovedReferenceParity.syncVideoPanel();window.DominionRuntimeStability.sync();const tile=[...dock.querySelectorAll('.remote-peer-tile')].find(node=>!node.hidden&&!node.classList.contains('stage-promoted'));if(tile)tile.classList.add('active-speaker');const head=dock.querySelector('.participant-video-dock-head'),grip=dock.querySelector('.dock-grip'),modes=dock.querySelectorAll('[data-dock-panel-mode]'),dr=dock.getBoundingClientRect(),hs=head?getComputedStyle(head):null;return {realTile:Boolean(tile),dockHidden:Boolean(dock.hidden),marker:dock.dataset.approvedFilmstrip||'',wholeDrag:dock.dataset.dsRuntimeWholePanelDrag||'',cursor:getComputedStyle(dock).cursor,headDisplay:hs?.display||'none',headCursor:hs?.cursor||'',headOpacity:parseFloat(hs?.opacity||'0'),headVisibility:hs?.visibility||'',headHeight:head?Math.round(head.getBoundingClientRect().height):0,modeCount:modes.length,gripDisplay:grip?getComputedStyle(grip).display:'none',radius:tile?(parseFloat(getComputedStyle(tile).borderRadius)||0):0,tileCursor:tile?getComputedStyle(tile).cursor:'',activeBorder:tile?getComputedStyle(tile).borderTopColor:'',hoverX:Math.round(dr.left+dr.width/2),hoverY:Math.round(dr.top+Math.min(50,dr.height/2))};})()`);
  const approvedStyleOrder=await evaluate(`[...document.styleSheets].map(sheet=>String(sheet.href||'inline'))`);
  console.log('APPROVED_VIDEO_STATE '+JSON.stringify({...video,stylesheets:approvedStyleOrder}));
  assert.equal(video.realTile,true,'Approved hover certification must use the real visible two-person filmstrip tile.');
  assert.equal(video.dockHidden,false,'Approved two-person filmstrip must remain visible through the hover certification.');
  assert.equal(video.marker,'1');
  assert.equal(video.wholeDrag,'1','Video panel must remain draggable from the whole non-control surface.');
  assert.equal(video.cursor,'default');
  assert.equal(video.tileCursor,'default');
  assert.notEqual(video.headDisplay,'none','Video filmstrip must keep the compact speaker/strip/gallery/hide control bar in the DOM.');
  assert.ok(video.headHeight>=27&&video.headHeight<=29,`Approved video-panel hover chrome must stay at the compact 28px height; measured ${video.headHeight}px.`);
  assert.ok(video.headOpacity<0.1&&video.headVisibility==='hidden',`Video-panel controls must stay hidden until interaction. ${JSON.stringify(video)}`);
  const hoverPre=await evaluate(`(()=>{const dock=document.querySelector('#participantVideoDock'),head=dock?.querySelector('.participant-video-dock-head'),r=dock?.getBoundingClientRect(),hit=document.elementFromPoint(${video.hoverX},${video.hoverY});return {meetingOpen:Boolean(document.querySelector('#meetingOverlay')&&!document.querySelector('#meetingOverlay').hidden),dockHidden:Boolean(dock?.hidden),hoverMarker:dock?.dataset.dsRuntimeHoverIntelligence||'',dockPointer:dock?getComputedStyle(dock).pointerEvents:'',headOpacity:head?parseFloat(getComputedStyle(head).opacity):null,headVisibility:head?getComputedStyle(head).visibility:'',rect:r?{left:Math.round(r.left),top:Math.round(r.top),right:Math.round(r.right),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}:null,hitTag:hit?.tagName||'',hitId:hit?.id||'',hitClass:String(hit?.className||''),hitInside:Boolean(hit&&(hit===dock||dock.contains(hit)))}})()`);
  console.log('APPROVED_HOVER_PRE '+JSON.stringify(hoverPre));
  assert.equal(hoverPre.meetingOpen,true,'Approved hover test requires an open meeting.');
  assert.equal(hoverPre.dockHidden,false,'Approved hover test requires a visible video dock.');
  assert.equal(hoverPre.hoverMarker,'1','Runtime hover intelligence must be installed on the approved video dock.');
  assert.equal(hoverPre.hitInside,true,`Approved hover coordinates must resolve inside the video dock. ${JSON.stringify(hoverPre)}`);
  await physicalMouseMove(2,2);await sleep(80);
  await physicalMouseMove(video.hoverX,video.hoverY);await sleep(80);
  const hoverPost=await evaluate(`(()=>{const dock=document.querySelector('#participantVideoDock'),head=dock?.querySelector('.participant-video-dock-head'),hit=document.elementFromPoint(${video.hoverX},${video.hoverY});return {hoverClass:Boolean(dock?.classList.contains('ds-video-chrome-hover')),headOpacity:head?parseFloat(getComputedStyle(head).opacity):null,headVisibility:head?getComputedStyle(head).visibility:'',headPointer:head?getComputedStyle(head).pointerEvents:'',hitTag:hit?.tagName||'',hitId:hit?.id||'',hitClass:String(hit?.className||''),hitInside:Boolean(hit&&(hit===dock||dock.contains(hit)))}})()`);
  console.log('APPROVED_HOVER_POST '+JSON.stringify(hoverPost));
  await waitFor("parseFloat(getComputedStyle(document.querySelector('#participantVideoDock .participant-video-dock-head')).opacity)>0.9&&getComputedStyle(document.querySelector('#participantVideoDock .participant-video-dock-head')).visibility==='visible'",'video-panel hover controls',1500);
  const hoveredVideoChrome=await evaluate(`(()=>{const h=document.querySelector('#participantVideoDock .participant-video-dock-head'),s=getComputedStyle(h);return {opacity:parseFloat(s.opacity),visibility:s.visibility,pointer:s.pointerEvents};})()`);
  assert.ok(hoveredVideoChrome.opacity>0.9&&hoveredVideoChrome.visibility==='visible'&&hoveredVideoChrome.pointer==='auto',`Video-panel controls must reveal on real pointer hover. ${JSON.stringify(hoveredVideoChrome)}`);
  assert.equal(video.headCursor,'default','Video panel control bar must use the normal arrow cursor.');
  assert.ok(video.modeCount>=4,'Video panel control bar must expose speaker, strip, gallery, and hide controls.');
  assert.equal(video.gripDisplay,'none','Legacy visible drag grip must remain hidden.');
  assert.ok(video.radius>=8,'Video tiles must retain the approved rounded filmstrip geometry.');


  // Approved remote-share viewer state: an ordinary participant watching
  // another participant share keeps the normal meeting toolbar, a floating
  // right-side video strip, and a floating Participants surface. Presenter
  // controls and host-only participant actions must not leak into this role.
  const remoteViewer=await evaluate(`(()=>{const overlay=document.querySelector('#meetingOverlay'),stage=document.querySelector('.stage'),role=document.querySelector('#roomRole');if(role)role.textContent='Participant';document.querySelector('#roomHostTools')?.remove();document.querySelector('.ds-ref-participants-footer')?.remove();document.body.classList.add('remote-share-active');overlay.classList.remove('share-active','ds-ref-presenter-visible');window.DominionMeetingParity.applyViewMode('speaker');window.DominionMeetingParity.syncShareLayout();window.DominionMeetingParity.syncVideoDock();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();window.DominionZoomScreenshotReference.sync();window.DominionApprovedReferenceParity.sync();const footer=document.querySelector('.meeting-footer'),expected=window.DominionApprovedReferenceParity.toolbarOrder;const geometry=expected.map(id=>{const node=document.querySelector('#'+id),r=node?.getBoundingClientRect();return {id,left:r?.left??-1,visible:Boolean(node&&!node.hidden&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden')};});const visual=geometry.filter(x=>x.visible).sort((a,b)=>a.left-b.left).map(x=>x.id),dock=document.querySelector('#participantVideoDock'),dr=dock?.getBoundingClientRect(),sr=stage.getBoundingClientRect(),presenter=document.querySelector('#inlinePresenterToolbar'),ps=presenter?getComputedStyle(presenter):null,exit=document.querySelector('#roomExitButton');return {remoteClass:document.body.classList.contains('remote-share-active'),overlayShare:overlay.classList.contains('share-active'),footerDisplay:getComputedStyle(footer).display,footerVisibility:getComputedStyle(footer).visibility,visual,expected,hostExists:Boolean(document.querySelector('#roomHostTools')),presenterVisible:Boolean(presenter&&!presenter.hidden&&ps.display!=='none'&&ps.visibility!=='hidden'&&parseFloat(ps.opacity||'1')>.1),exitLabel:String(exit?.querySelector('.ds-control-label')?.textContent||exit?.textContent||'').trim(),dockHidden:Boolean(dock?.hidden),dockOrientation:dock?.dataset.orientation||'',dockRightGap:dr?Math.round(sr.right-dr.right):null,stage:{width:Math.round(sr.width),height:Math.round(sr.height)}};})()`);
  assert.equal(remoteViewer.remoteClass,true,'Remote-share viewer scenario must use the real remote-share state.');
  assert.equal(remoteViewer.overlayShare,false,'A remote-share viewer must not enter local presenter share-active mode.');
  assert.notEqual(remoteViewer.footerDisplay,'none','Remote-share viewer must retain the normal meeting toolbar.');
  assert.notEqual(remoteViewer.footerVisibility,'hidden','Remote-share viewer toolbar must remain visible.');
  assert.deepEqual(remoteViewer.visual,remoteViewer.expected,'Participant viewer toolbar must remain Audio → Video → Participants → Chat → React → Raise hand → Share → More → Leave.');
  assert.equal(remoteViewer.hostExists,false,'Ordinary participant viewer must not receive Host Tools.');
  assert.equal(remoteViewer.presenterVisible,false,'Ordinary remote-share viewer must not receive presenter toolbar controls.');
  assert.equal(remoteViewer.exitLabel,'Leave','Ordinary participant viewer must see Leave, not End.');
  assert.equal(remoteViewer.dockHidden,false,'Remote-share viewer must retain the participant video strip.');
  assert.equal(remoteViewer.dockOrientation,'vertical','Remote-share viewer video strip must remain the approved right-side vertical strip.');
  assert.ok(Math.abs(remoteViewer.dockRightGap-14)<=2,`Remote-share viewer strip must stay on the approved right edge. ${JSON.stringify(remoteViewer)}`);
  assert.ok(remoteViewer.stage.width>200&&remoteViewer.stage.height>120,`Remote shared content must retain a real primary stage. ${JSON.stringify(remoteViewer.stage)}`);

  const remoteViewerCameraOff=await evaluate(`(()=>{const parity=window.DominionMeetingParity,dock=document.querySelector('#participantVideoDock'),body=dock?.querySelector('.participant-video-dock-body');let strip=document.querySelector('#remoteTileStrip');if(!strip&&body){strip=document.createElement('div');strip.id='remoteTileStrip';strip.className='remote-tile-strip';body.append(strip);}let tile=strip?.querySelector('[data-peer-id="peer-approved-camera"]');if(!tile&&strip){tile=document.createElement('article');tile.className='remote-peer-tile';tile.dataset.peerId='peer-approved-camera';tile.dataset.participantName='Jordan Lee';tile.innerHTML='<video autoplay playsinline hidden></video><div class="remote-peer-fallback"><span>JL</span></div><footer><strong>Jordan Lee</strong><small>Connected</small></footer>';strip.append(tile);}const video=tile?.querySelector('video'),fallback=tile?.querySelector('.remote-peer-fallback');if(video){video.srcObject=null;video.hidden=true;}if(fallback)fallback.hidden=false;if(tile){tile.dataset.cameraOn='0';tile.dataset.micOn='0';tile.classList.remove('active-speaker','stage-promoted');}parity.syncVideoDock();const r=tile?.getBoundingClientRect(),name=tile?.querySelector('footer strong'),primary=tile?.querySelector('.participant-video-hover-primary');return {dockHidden:Boolean(dock?.hidden),orientation:dock?.dataset.orientation||'',tileHidden:Boolean(tile?.hidden),tileWidth:Math.round(r?.width||0),tileHeight:Math.round(r?.height||0),fallbackVisible:Boolean(fallback&&!fallback.hidden&&getComputedStyle(fallback).display!=='none'),name:String(name?.textContent||'').trim(),nameVisible:Boolean(name&&name.getBoundingClientRect().width>0),promoted:Boolean(tile?.classList.contains('stage-promoted')),participantHoverPrimaryVisible:Boolean(primary&&!primary.hidden&&getComputedStyle(primary).display!=='none')};})()`);
  assert.equal(remoteViewerCameraOff.dockHidden,false,'Remote-share camera-off viewer must retain the participant video strip.');
  assert.equal(remoteViewerCameraOff.orientation,'vertical','Remote-share camera-off tile must remain in the right-side vertical strip.');
  assert.equal(remoteViewerCameraOff.tileHidden,false,'Remote-share camera-off participant tile must remain visible.');
  assert.ok(Math.abs(remoteViewerCameraOff.tileWidth-176)<=2&&Math.abs(remoteViewerCameraOff.tileHeight-99)<=2,`Remote-share participant tile must retain approved 176x99 geometry. ${JSON.stringify(remoteViewerCameraOff)}`);
  assert.equal(remoteViewerCameraOff.fallbackVisible,true,'Remote-share camera-off tile must show the participant profile/initials fallback.');
  assert.equal(remoteViewerCameraOff.name,'Jordan Lee','Remote-share participant tile must preserve the participant name.');
  assert.equal(remoteViewerCameraOff.nameVisible,true,'Remote-share participant name must remain visibly rendered.');
  assert.equal(remoteViewerCameraOff.promoted,false,'Remote-share viewer tile must not replace the shared-content primary stage.');
  assert.equal(remoteViewerCameraOff.participantHoverPrimaryVisible,false,'Ordinary participant viewer must not receive host media action on another participant tile.');

  const remoteViewerCameraOnSetup=await evaluate(`(()=>{const parity=window.DominionMeetingParity,tile=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]'),video=tile?.querySelector('video'),fallback=tile?.querySelector('.remote-peer-fallback'),stream=new MediaStream();if(video){video.srcObject=stream;video.hidden=false;}if(fallback)fallback.hidden=true;if(tile){tile.dataset.cameraOn='1';tile.classList.add('active-speaker');}parity.syncVideoDock();const name=tile?.querySelector('footer strong'),primary=tile?.querySelector('.participant-video-hover-primary');return {videoVisible:Boolean(video&&!video.hidden&&getComputedStyle(video).display!=='none'),fallbackHidden:Boolean(fallback?.hidden),sameStream:Boolean(video?.srcObject===stream),name:String(name?.textContent||'').trim(),promoted:Boolean(tile?.classList.contains('stage-promoted')),participantHoverPrimaryVisible:Boolean(primary&&!primary.hidden&&getComputedStyle(primary).display!=='none'),remoteSharePrimary:document.body.classList.contains('remote-share-active')&&!document.querySelector('#meetingOverlay').classList.contains('remote-speaker-stage')};})()`);
  assert.equal(remoteViewerCameraOnSetup.videoVisible,true,'Remote-share camera-on tile must expose its video surface.');
  assert.equal(remoteViewerCameraOnSetup.fallbackHidden,true,'Remote-share camera-on tile must replace its profile fallback with video.');
  assert.equal(remoteViewerCameraOnSetup.sameStream,true,'Remote-share camera-on tile must retain the assigned video stream.');
  assert.equal(remoteViewerCameraOnSetup.name,'Jordan Lee','Participant name must remain stable across camera off/on changes during remote share.');
  assert.equal(remoteViewerCameraOnSetup.promoted,false,'Active speaker must remain in the filmstrip while remote shared content owns the primary stage.');
  assert.equal(remoteViewerCameraOnSetup.participantHoverPrimaryVisible,false,'Participant viewer must not gain host media controls when the remote camera turns on.');
  assert.equal(remoteViewerCameraOnSetup.remoteSharePrimary,true,'Remote shared content must remain primary while participant camera state changes.');
  await waitFor(`(()=>{const tile=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]');if(!tile||!tile.classList.contains('active-speaker'))return false;const border=getComputedStyle(tile).borderTopColor;return /53\\D+208\\D+127/.test(border);})()`,'remote-share active-speaker border transition');
  const remoteViewerActiveBorder=await evaluate(`(()=>{const tile=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]');return {active:Boolean(tile?.classList.contains('active-speaker')),border:tile?getComputedStyle(tile).borderTopColor:''};})()`);
  assert.equal(remoteViewerActiveBorder.active,true,'Remote-share active-speaker state must survive the video-dock synchronization pass.');
  assert.match(remoteViewerActiveBorder.border,/53\D+208\D+127/,'Remote-share active speaker must settle on the approved #35d07f green filmstrip emphasis.');

  // Viewer-owned media changes during somebody else's share must affect only
  // the viewer's own media surfaces. The remote shared content remains primary
  // and the approved right-side filmstrip must not reflow or promote a speaker.
  const viewerOwnMediaPrepared=await evaluate(`(async()=>{const media=window.DominionMediaController,parity=window.DominionMeetingParity;if(!media)throw new Error('DominionMediaController unavailable');await media.setMicrophone(false);await media.setCamera(false);const stream=media.stream();if(!(stream instanceof MediaStream))throw new Error('Viewer media stream unavailable');const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('AudioContext unavailable');const context=new AC(),destination=context.createMediaStreamDestination(),audioTrack=destination.stream.getAudioTracks()[0];if(!audioTrack)throw new Error('Synthetic viewer audio track unavailable');stream.addTrack(audioTrack);window.__dsQaRemoteViewerAudio={context,destination,audioTrack};parity.syncVideoDock();const stage=document.querySelector('.stage').getBoundingClientRect(),dock=document.querySelector('#participantVideoDock').getBoundingClientRect(),self=document.querySelector('#localVideoDockTile'),remote=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]');return {micOn:media.snapshot().micOn,cameraOn:media.snapshot().cameraOn,videoLive:media.snapshot().videoLive,audioLive:media.snapshot().audioLive,micOff:document.querySelector('#roomMic')?.classList.contains('is-off'),cameraOff:document.querySelector('#roomCamera')?.classList.contains('is-off'),selfHidden:Boolean(self?.hidden),remoteName:String(remote?.querySelector('footer strong')?.textContent||'').trim(),remoteActive:Boolean(remote?.classList.contains('active-speaker')),remoteSharePrimary:document.body.classList.contains('remote-share-active')&&!document.querySelector('#meetingOverlay').classList.contains('remote-speaker-stage'),stage:{width:Math.round(stage.width),height:Math.round(stage.height)},dock:{left:Math.round(dock.left),top:Math.round(dock.top),width:Math.round(dock.width),height:Math.round(dock.height)}};})()`);
  assert.equal(viewerOwnMediaPrepared.micOn,false,'Remote-share viewer media fixture must begin muted.');
  assert.equal(viewerOwnMediaPrepared.cameraOn,false,'Remote-share viewer media fixture must begin with camera off.');
  assert.equal(viewerOwnMediaPrepared.micOff,true,'Remote-share viewer Audio control must begin in muted visual state.');
  assert.equal(viewerOwnMediaPrepared.cameraOff,true,'Remote-share viewer Video control must begin in camera-off visual state.');
  assert.equal(viewerOwnMediaPrepared.remoteName,'Jordan Lee','Preparing viewer-owned media must not alter the remote participant identity.');
  assert.equal(viewerOwnMediaPrepared.remoteActive,true,'Preparing viewer-owned media must not clear the remote active-speaker state.');
  assert.equal(viewerOwnMediaPrepared.remoteSharePrimary,true,'Preparing viewer-owned media must not displace the remote shared stage.');

  await evaluate(`document.querySelector('#roomMic').click();true`);
  await waitFor(`window.DominionMediaController.snapshot().micOn===true&&!document.querySelector('#roomMic').classList.contains('is-off')`,'viewer microphone unmute during remote share',5000);
  const viewerMicOn=await evaluate(`(()=>{const media=window.DominionMediaController.snapshot(),stage=document.querySelector('.stage').getBoundingClientRect(),dock=document.querySelector('#participantVideoDock').getBoundingClientRect(),remote=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]');return {micOn:media.micOn,audioLive:media.audioLive,label:String(document.querySelector('#roomMic .ds-control-label')?.textContent||document.querySelector('#roomMic')?.textContent||'').trim(),ariaLabel:String(document.querySelector('#roomMic')?.getAttribute('aria-label')||''),remoteSharePrimary:document.body.classList.contains('remote-share-active')&&!document.querySelector('#meetingOverlay').classList.contains('remote-speaker-stage'),remoteName:String(remote?.querySelector('footer strong')?.textContent||'').trim(),remoteActive:Boolean(remote?.classList.contains('active-speaker')),stage:{width:Math.round(stage.width),height:Math.round(stage.height)},dock:{left:Math.round(dock.left),top:Math.round(dock.top),width:Math.round(dock.width),height:Math.round(dock.height)}};})()`);
  assert.equal(viewerMicOn.micOn,true,'Viewer must be able to unmute while watching a remote share.');
  assert.equal(viewerMicOn.audioLive,true,'Viewer unmute must use a live local audio track.');
  assert.equal(viewerMicOn.label,'Audio','Viewer Audio control must preserve the approved visible Audio caption after unmuting.');
  assert.equal(viewerMicOn.ariaLabel,'Mute','Viewer Audio control must expose the real unmuted state through its accessible label.');
  assert.equal(viewerMicOn.remoteSharePrimary,true,'Viewer microphone change must not displace the remote shared stage.');
  assert.equal(viewerMicOn.remoteName,'Jordan Lee','Viewer microphone change must not alter the remote participant tile.');
  assert.equal(viewerMicOn.remoteActive,true,'Viewer microphone change must not clear remote active-speaker emphasis.');
  assert.deepEqual(viewerMicOn.stage,viewerOwnMediaPrepared.stage,'Viewer microphone change must not resize the shared stage.');
  assert.deepEqual(viewerMicOn.dock,viewerOwnMediaPrepared.dock,'Viewer microphone change must not move or resize the video strip.');

  await evaluate(`document.querySelector('#roomMic').click();true`);
  await waitFor(`window.DominionMediaController.snapshot().micOn===false&&document.querySelector('#roomMic').classList.contains('is-off')`,'viewer microphone mute during remote share',5000);
  const viewerMicOff=await evaluate(`(()=>{const stage=document.querySelector('.stage').getBoundingClientRect(),dock=document.querySelector('#participantVideoDock').getBoundingClientRect();return {label:String(document.querySelector('#roomMic .ds-control-label')?.textContent||document.querySelector('#roomMic')?.textContent||'').trim(),ariaLabel:String(document.querySelector('#roomMic')?.getAttribute('aria-label')||''),remoteSharePrimary:document.body.classList.contains('remote-share-active')&&!document.querySelector('#meetingOverlay').classList.contains('remote-speaker-stage'),stage:{width:Math.round(stage.width),height:Math.round(stage.height)},dock:{left:Math.round(dock.left),top:Math.round(dock.top),width:Math.round(dock.width),height:Math.round(dock.height)}};})()`);
  assert.equal(viewerMicOff.label,'Audio','Viewer Audio control must preserve the approved visible Audio caption after muting.');
  assert.equal(viewerMicOff.ariaLabel,'Unmute','Viewer Audio control must expose the real muted state through its accessible label.');
  assert.equal(viewerMicOff.remoteSharePrimary,true,'Viewer mute must leave the remote shared stage primary.');
  assert.deepEqual(viewerMicOff.stage,viewerOwnMediaPrepared.stage,'Viewer mute must not resize the shared stage.');
  assert.deepEqual(viewerMicOff.dock,viewerOwnMediaPrepared.dock,'Viewer mute must not move or resize the video strip.');

  const viewerVideoFixture=await evaluate(`(async()=>{const media=window.DominionMediaController,stream=media.stream(),canvas=document.createElement('canvas');canvas.width=32;canvas.height=18;const context=canvas.getContext('2d');context.fillRect(0,0,32,18);const videoStream=canvas.captureStream(1),videoTrack=videoStream.getVideoTracks()[0];if(!videoTrack)throw new Error('Synthetic viewer video track unavailable');stream.addTrack(videoTrack);window.__dsQaRemoteViewerVideo={canvas,videoStream,videoTrack};await media.setCamera(false);return {cameraOn:media.snapshot().cameraOn,videoLive:media.snapshot().videoLive,buttonOff:document.querySelector('#roomCamera')?.classList.contains('is-off')};})()`);
  assert.equal(viewerVideoFixture.cameraOn,false,'Synthetic viewer video fixture must preserve camera-off state before toolbar activation.');
  assert.equal(viewerVideoFixture.videoLive,false,'Synthetic viewer video fixture must be held warm rather than exposed before Start Video.');
  assert.equal(viewerVideoFixture.buttonOff,true,'Viewer Video control must remain in Start Video state before activation.');

  await evaluate(`document.querySelector('#roomCamera').click();true`);
  await waitFor(`window.DominionMediaController.snapshot().cameraOn===true&&window.DominionMediaController.snapshot().videoLive===true&&!document.querySelector('#roomCamera').classList.contains('is-off')`,'viewer camera start during remote share',5000);
  await sleep(120);
  const viewerCameraOn=await evaluate(`(()=>{const media=window.DominionMediaController,stage=document.querySelector('.stage').getBoundingClientRect(),dock=document.querySelector('#participantVideoDock').getBoundingClientRect(),self=document.querySelector('#localVideoDockTile'),video=self?.querySelector('video'),fallback=self?.querySelector('.remote-peer-fallback'),remote=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]');return {cameraOn:media.snapshot().cameraOn,videoLive:media.snapshot().videoLive,label:String(document.querySelector('#roomCamera .ds-control-label')?.textContent||document.querySelector('#roomCamera')?.textContent||'').trim(),ariaLabel:String(document.querySelector('#roomCamera')?.getAttribute('aria-label')||''),selfHidden:Boolean(self?.hidden),selfVideoLive:Boolean(video?.srcObject&&video.srcObject===media.stream()),selfFallbackHidden:Boolean(fallback?.hidden),remoteName:String(remote?.querySelector('footer strong')?.textContent||'').trim(),remoteActive:Boolean(remote?.classList.contains('active-speaker')),remoteSharePrimary:document.body.classList.contains('remote-share-active')&&!document.querySelector('#meetingOverlay').classList.contains('remote-speaker-stage'),stage:{width:Math.round(stage.width),height:Math.round(stage.height)},dock:{left:Math.round(dock.left),top:Math.round(dock.top),width:Math.round(dock.width),height:Math.round(dock.height)}};})()`);
  assert.equal(viewerCameraOn.cameraOn,true,'Viewer must be able to start video while watching a remote share.');
  assert.equal(viewerCameraOn.videoLive,true,'Viewer Start Video must restore a live local video track.');
  assert.equal(viewerCameraOn.label,'Video','Viewer Video control must preserve the approved visible Video caption after camera starts.');
  assert.equal(viewerCameraOn.ariaLabel,'Stop Video','Viewer Video control must expose the real camera-on state through its accessible label.');
  assert.equal(viewerCameraOn.selfHidden,false,'Viewer self tile must remain available in the remote-share filmstrip.');
  assert.equal(viewerCameraOn.selfVideoLive,true,'Viewer self tile must follow the live local camera stream during remote share.');
  assert.equal(viewerCameraOn.selfFallbackHidden,true,'Viewer self tile must hide the profile fallback while local camera is live.');
  assert.equal(viewerCameraOn.remoteName,'Jordan Lee','Viewer camera change must not alter the remote participant identity.');
  assert.equal(viewerCameraOn.remoteActive,true,'Viewer camera change must not clear remote active-speaker emphasis.');
  assert.equal(viewerCameraOn.remoteSharePrimary,true,'Viewer camera change must not displace the remote shared stage.');
  assert.deepEqual(viewerCameraOn.stage,viewerOwnMediaPrepared.stage,'Viewer camera start must not resize the shared stage.');
  assert.deepEqual(viewerCameraOn.dock,viewerOwnMediaPrepared.dock,'Viewer camera start must not move or resize the video strip.');

  await evaluate(`document.querySelector('#roomCamera').click();true`);
  await waitFor(`window.DominionMediaController.snapshot().cameraOn===false&&window.DominionMediaController.snapshot().videoLive===false&&document.querySelector('#roomCamera').classList.contains('is-off')`,'viewer camera stop during remote share',5000);
  await sleep(120);
  const viewerCameraOff=await evaluate(`(()=>{const media=window.DominionMediaController,stage=document.querySelector('.stage').getBoundingClientRect(),dock=document.querySelector('#participantVideoDock').getBoundingClientRect(),self=document.querySelector('#localVideoDockTile'),video=self?.querySelector('video'),fallback=self?.querySelector('.remote-peer-fallback'),remote=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]');return {cameraOn:media.snapshot().cameraOn,videoLive:media.snapshot().videoLive,label:String(document.querySelector('#roomCamera .ds-control-label')?.textContent||document.querySelector('#roomCamera')?.textContent||'').trim(),ariaLabel:String(document.querySelector('#roomCamera')?.getAttribute('aria-label')||''),selfHidden:Boolean(self?.hidden),selfVideoCleared:!video?.srcObject,selfFallbackVisible:Boolean(fallback&&!fallback.hidden&&getComputedStyle(fallback).display!=='none'),remoteName:String(remote?.querySelector('footer strong')?.textContent||'').trim(),remoteActive:Boolean(remote?.classList.contains('active-speaker')),remoteSharePrimary:document.body.classList.contains('remote-share-active')&&!document.querySelector('#meetingOverlay').classList.contains('remote-speaker-stage'),stage:{width:Math.round(stage.width),height:Math.round(stage.height)},dock:{left:Math.round(dock.left),top:Math.round(dock.top),width:Math.round(dock.width),height:Math.round(dock.height)}};})()`);
  assert.equal(viewerCameraOff.cameraOn,false,'Viewer must be able to stop video while watching a remote share.');
  assert.equal(viewerCameraOff.videoLive,false,'Viewer Stop Video must remove the live local video track.');
  assert.equal(viewerCameraOff.label,'Video','Viewer Video control must preserve the approved visible Video caption after camera stops.');
  assert.equal(viewerCameraOff.ariaLabel,'Start Video','Viewer Video control must expose the real camera-off state through its accessible label.');
  assert.equal(viewerCameraOff.selfHidden,false,'Viewer self tile must remain available when local camera turns off.');
  assert.equal(viewerCameraOff.selfVideoCleared,true,'Viewer self tile must clear its local video source when camera turns off.');
  assert.equal(viewerCameraOff.selfFallbackVisible,true,'Viewer self tile must return to the profile fallback when local camera turns off.');
  assert.equal(viewerCameraOff.remoteName,'Jordan Lee','Stopping viewer camera must not alter the remote participant identity.');
  assert.equal(viewerCameraOff.remoteActive,true,'Stopping viewer camera must not clear remote active-speaker emphasis.');
  assert.equal(viewerCameraOff.remoteSharePrimary,true,'Stopping viewer camera must leave the remote shared stage primary.');
  assert.deepEqual(viewerCameraOff.stage,viewerOwnMediaPrepared.stage,'Viewer camera stop must not resize the shared stage.');
  assert.deepEqual(viewerCameraOff.dock,viewerOwnMediaPrepared.dock,'Viewer camera stop must not move or resize the video strip.');

  const viewerParticipants=await evaluate(`(()=>{const stage=document.querySelector('.stage'),before=stage.getBoundingClientRect();window.DominionRuntimeStability.setParticipants(true);window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('.room-side'),pr=panel.getBoundingClientRect(),after=stage.getBoundingClientRect(),footer=panel.querySelector('.ds-ref-participants-footer'),buttons=[...(footer?.querySelectorAll('button')||[])].filter(button=>getComputedStyle(button).display!=='none').map(button=>String(button.textContent||'').trim());return {panelHidden:Boolean(panel.hidden),width:Math.round(pr.width),height:Math.round(pr.height),buttons,before:{width:Math.round(before.width),height:Math.round(before.height)},after:{width:Math.round(after.width),height:Math.round(after.height)},hostBulk:Boolean(panel.querySelector('[data-ref-mute-all],[data-ref-participant-more],[data-host-participants]'))};})()`);
  assert.equal(viewerParticipants.panelHidden,false,'Viewer Participants panel must open over the remote shared stage.');
  assert.ok(Math.abs(viewerParticipants.width-318)<=2&&Math.abs(viewerParticipants.height-390)<=2,`Viewer Participants panel must retain the approved 318x390 geometry. ${JSON.stringify(viewerParticipants)}`);
  assert.ok(Math.abs(viewerParticipants.before.width-viewerParticipants.after.width)<=2&&Math.abs(viewerParticipants.before.height-viewerParticipants.after.height)<=2,`Opening Participants must float over remote share instead of squeezing the shared stage. ${JSON.stringify(viewerParticipants)}`);
  assert.deepEqual(viewerParticipants.buttons,['Invite','Unmute me'],'Participant viewer footer must expose Invite and Unmute me only.');
  assert.equal(viewerParticipants.hostBulk,false,'Participant viewer must not receive Mute all, participant More, or host-bulk controls.');

  // Remote-share viewer roster row: real remote media, share, and raised-hand
  // events must decorate the compact approved participant row without changing
  // the 318x390 floating panel or squeezing the shared-content stage.
  const viewerRowPrepared=await evaluate(`(()=>{const roster=document.querySelector('#participantRoster');let row=roster.querySelector('[data-participant-id="peer-approved-camera"]');if(!row){row=document.createElement('div');row.className='person-row';row.dataset.participantId='peer-approved-camera';row.innerHTML='<span class="person-badge">JL</span><span class="person-copy"><strong><span class="participant-name-text">Jordan Lee</span><em class="participant-you" hidden></em></strong><small hidden></small></span><span class="participant-media-state" aria-label="Participant media status"><span class="participant-media-icon participant-mic unknown" data-participant-mic title="Microphone status"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"></path></svg></span><span class="participant-media-icon participant-video unknown" data-participant-video title="Video status"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"></rect><path d="m16 10 5-3v10l-5-3z"></path></svg></span></span><span class="participant-actions"></span>';roster.append(row);}row.dataset.participantRole='participant';row.dataset.participantName='Jordan Lee';row.dataset.participantSelf='0';const shareVideo=document.querySelector('#remoteShareVideo'),shareBanner=document.querySelector('#remoteShareBanner'),shareStream=new MediaStream();window.__dsQaRemoteShareStream=shareStream;if(shareVideo){shareVideo.dataset.peerId='peer-approved-camera';shareVideo.srcObject=shareStream;shareVideo.hidden=false;}if(shareBanner){shareBanner.hidden=false;const label=shareBanner.querySelector('strong');if(label)label.textContent='Jordan Lee is sharing';}document.body.classList.add('remote-share-active');window.DominionZoomPhysicalAcceptance?.sync?.();window.DominionParticipantControls?.syncAllMedia?.();window.DominionRuntimeStability.syncParticipantsSurface();const panel=document.querySelector('.room-side').getBoundingClientRect(),stage=document.querySelector('.stage').getBoundingClientRect();return {panel:{width:Math.round(panel.width),height:Math.round(panel.height)},stage:{width:Math.round(stage.width),height:Math.round(stage.height)},sharePeer:String(shareVideo?.dataset.peerId||'')};})()`);
  await evaluate(`(()=>{window.dispatchEvent(new CustomEvent('dominion:remote-media-state',{detail:{participantId:'peer-approved-camera',micOn:false,cameraOn:false}}));window.dispatchEvent(new CustomEvent('dominion:remote-share-state',{detail:{participantId:'peer-approved-camera',active:true}}));window.dispatchEvent(new CustomEvent('dominion:meeting-signal',{detail:{type:'reaction',fromParticipantId:'peer-approved-camera',fromDisplayName:'Jordan Lee',payload:{kind:'hand',raised:true,name:'Jordan Lee',participantId:'peer-approved-camera'}}}));window.DominionZoomPhysicalAcceptance?.sync?.();window.DominionParticipantControls?.syncAllMedia?.();window.DominionRuntimeStability.syncParticipantsSurface();return true;})()`);
  await sleep(100);
  const viewerRowOff=await evaluate(`(()=>{const row=document.querySelector('#participantRoster [data-participant-id="peer-approved-camera"]'),panel=document.querySelector('.room-side'),stage=document.querySelector('.stage'),mic=row?.querySelector('[data-participant-mic]'),video=row?.querySelector('[data-participant-video]'),share=row?.querySelector('.ds-participant-share-state'),hand=row?.querySelector('.raised-hand-indicator'),rr=row?.getBoundingClientRect(),pr=panel?.getBoundingClientRect(),sr=stage?.getBoundingClientRect(),micBefore=mic?getComputedStyle(mic,'::before'):null,micAfter=mic?getComputedStyle(mic,'::after'):null;const visibleSlash=style=>Boolean(style&&style.display!=='none'&&style.content!=='none'&&style.content!=='normal');return {rowHeight:Math.round(rr?.height||0),name:String(row?.querySelector('.participant-name-text')?.textContent||'').trim(),micOff:Boolean(mic?.classList.contains('off')),videoOff:Boolean(video?.classList.contains('off')),micLabel:mic?.getAttribute('aria-label')||'',videoLabel:video?.getAttribute('aria-label')||'',micBeforeSlash:visibleSlash(micBefore),micAfterSlash:visibleSlash(micAfter),shareVisible:Boolean(share&&getComputedStyle(share).display!=='none'),shareLabel:share?.getAttribute('aria-label')||'',raised:row?.dataset.raisedHand==='1',handVisible:Boolean(hand&&getComputedStyle(hand).display!=='none'),hostRowControls:Boolean(row?.querySelector('[data-participant-more],.ds-host-row-more,[data-host-participant-action]')),panel:{width:Math.round(pr?.width||0),height:Math.round(pr?.height||0)},stage:{width:Math.round(sr?.width||0),height:Math.round(sr?.height||0)}};})()`);
  assert.ok(Math.abs(viewerRowOff.rowHeight-42)<=1,`Remote-share participant row must retain approved 42px height. ${JSON.stringify(viewerRowOff)}`);
  assert.equal(viewerRowOff.name,'Jordan Lee','Remote-share roster row must retain the participant identity.');
  assert.equal(viewerRowOff.micOff,true,'Remote-share muted participant row must show microphone off.');
  assert.equal(viewerRowOff.videoOff,true,'Remote-share camera-off participant row must show video off.');
  assert.equal(viewerRowOff.micLabel,'Microphone muted','Muted roster microphone must expose the real muted status.');
  assert.equal(viewerRowOff.videoLabel,'Video off','Camera-off roster video must expose the real off status.');
  assert.equal(viewerRowOff.micBeforeSlash,false,'Muted roster microphone must not render a duplicate first strike.');
  assert.equal(viewerRowOff.micAfterSlash,true,'Muted roster microphone must render exactly one authoritative strike.');
  assert.equal(viewerRowOff.shareVisible,true,'Remote sharer row must show the sharing-screen indicator.');
  assert.equal(viewerRowOff.shareLabel,'Sharing screen','Remote sharer indicator must expose its sharing state.');
  assert.equal(viewerRowOff.raised,true,'Remote raised-hand state must persist on the participant row.');
  assert.equal(viewerRowOff.handVisible,true,'Remote raised hand must remain visibly indicated while sharing.');
  assert.equal(viewerRowOff.hostRowControls,false,'Ordinary participant viewer must not receive host row-management controls.');
  assert.deepEqual(viewerRowOff.panel,viewerRowPrepared.panel,'Remote row status changes must not resize the approved Participants panel.');
  assert.deepEqual(viewerRowOff.stage,viewerRowPrepared.stage,'Remote row status changes must not squeeze the shared-content stage.');

  await evaluate(`(()=>{window.dispatchEvent(new CustomEvent('dominion:remote-media-state',{detail:{participantId:'peer-approved-camera',micOn:true,cameraOn:true}}));window.DominionZoomPhysicalAcceptance?.sync?.();window.DominionParticipantControls?.syncAllMedia?.();window.DominionRuntimeStability.syncParticipantsSurface();return true;})()`);
  await sleep(80);
  const viewerRowOn=await evaluate(`(()=>{const row=document.querySelector('#participantRoster [data-participant-id="peer-approved-camera"]'),panel=document.querySelector('.room-side'),stage=document.querySelector('.stage'),mic=row?.querySelector('[data-participant-mic]'),video=row?.querySelector('[data-participant-video]'),share=row?.querySelector('.ds-participant-share-state'),hand=row?.querySelector('.raised-hand-indicator'),pr=panel?.getBoundingClientRect(),sr=stage?.getBoundingClientRect(),micBefore=mic?getComputedStyle(mic,'::before'):null,micAfter=mic?getComputedStyle(mic,'::after'):null;const visibleSlash=style=>Boolean(style&&style.display!=='none'&&style.content!=='none'&&style.content!=='normal');return {micOn:Boolean(mic?.classList.contains('on')),videoOn:Boolean(video?.classList.contains('on')),micLabel:mic?.getAttribute('aria-label')||'',videoLabel:video?.getAttribute('aria-label')||'',micBeforeSlash:visibleSlash(micBefore),micAfterSlash:visibleSlash(micAfter),shareVisible:Boolean(share&&getComputedStyle(share).display!=='none'),raised:row?.dataset.raisedHand==='1',handVisible:Boolean(hand&&getComputedStyle(hand).display!=='none'),hostRowControls:Boolean(row?.querySelector('[data-participant-more],.ds-host-row-more,[data-host-participant-action]')),panel:{width:Math.round(pr?.width||0),height:Math.round(pr?.height||0)},stage:{width:Math.round(sr?.width||0),height:Math.round(sr?.height||0)}};})()`);
  assert.equal(viewerRowOn.micOn,true,'Remote-share participant row must update to microphone on.');
  assert.equal(viewerRowOn.videoOn,true,'Remote-share participant row must update to video on.');
  assert.equal(viewerRowOn.micLabel,'Microphone on','Live roster microphone must expose the real on status.');
  assert.equal(viewerRowOn.videoLabel,'Video on','Live roster video must expose the real on status.');
  assert.equal(viewerRowOn.micBeforeSlash,false,'Live roster microphone must not retain a stale first strike.');
  assert.equal(viewerRowOn.micAfterSlash,false,'Live roster microphone must remove the muted strike.');
  assert.equal(viewerRowOn.shareVisible,true,'Remote sharing indicator must survive independent media changes.');
  assert.equal(viewerRowOn.raised,true,'Remote raised-hand state must survive independent media changes.');
  assert.equal(viewerRowOn.handVisible,true,'Remote raised-hand indicator must remain visible after media changes.');
  assert.equal(viewerRowOn.hostRowControls,false,'Media changes must not leak host row controls to an ordinary participant.');
  assert.deepEqual(viewerRowOn.panel,viewerRowPrepared.panel,'Live remote media changes must not resize the Participants panel.');
  assert.deepEqual(viewerRowOn.stage,viewerRowPrepared.stage,'Live remote media changes must not resize the shared-content stage.');

  // Closing the floating Participants window must affect only that surface.
  // Remote shared content, filmstrip geometry, and viewer share state remain
  // untouched when the actual red traffic-light close control is used.
  const viewerCloseBefore=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),close=panel?.querySelector('.ds-panel-traffic .ds-traffic-close'),stage=document.querySelector('.stage').getBoundingClientRect(),dock=document.querySelector('#participantVideoDock'),dr=dock?.getBoundingClientRect(),row=document.querySelector('#participantRoster [data-participant-id="peer-approved-camera"]'),tile=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]'),share=row?.querySelector('.ds-participant-share-state');return {panelHidden:Boolean(panel?.hidden),closeExists:Boolean(close),remoteClass:document.body.classList.contains('remote-share-active'),overlayLocalShare:document.querySelector('#meetingOverlay')?.classList.contains('share-active'),rowSharing:Boolean(share&&getComputedStyle(share).display!=='none'),remoteName:String(tile?.querySelector('footer strong')?.textContent||'').trim(),remoteTileHidden:Boolean(tile?.hidden),stage:{left:Math.round(stage.left),top:Math.round(stage.top),width:Math.round(stage.width),height:Math.round(stage.height)},dock:{left:Math.round(dr?.left||0),top:Math.round(dr?.top||0),width:Math.round(dr?.width||0),height:Math.round(dr?.height||0)},dockOrientation:dock?.dataset.orientation||''};})()`);
  assert.equal(viewerCloseBefore.panelHidden,false,'Viewer Participants panel must be open before exercising the real close control.');
  assert.equal(viewerCloseBefore.closeExists,true,'Viewer Participants panel must expose the approved red traffic-light close control.');
  assert.equal(viewerCloseBefore.remoteClass,true,'Remote-share viewer state must remain active before Participants closes.');
  assert.equal(viewerCloseBefore.overlayLocalShare,false,'Remote-share viewer must remain distinct from local presenter mode before Participants closes.');
  assert.equal(viewerCloseBefore.rowSharing,true,'Remote sharer row must still indicate sharing before Participants closes.');
  assert.equal(viewerCloseBefore.remoteName,'Jordan Lee','Remote sharer identity must remain stable before Participants closes.');
  assert.equal(viewerCloseBefore.remoteTileHidden,false,'Remote sharer tile must remain visible before Participants closes.');
  await evaluate(`document.querySelector('.room-side .ds-panel-traffic .ds-traffic-close').click();true`);
  await waitFor(`document.querySelector('.room-side')?.hidden===true`,'viewer Participants traffic-light close');
  await sleep(60);
  const viewerCloseAfter=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),stage=document.querySelector('.stage').getBoundingClientRect(),dock=document.querySelector('#participantVideoDock'),dr=dock?.getBoundingClientRect(),row=document.querySelector('#participantRoster [data-participant-id="peer-approved-camera"]'),tile=document.querySelector('#remoteTileStrip [data-peer-id="peer-approved-camera"]'),share=row?.querySelector('.ds-participant-share-state');return {panelHidden:Boolean(panel?.hidden),remoteClass:document.body.classList.contains('remote-share-active'),overlayLocalShare:document.querySelector('#meetingOverlay')?.classList.contains('share-active'),rowSharing:Boolean(share&&getComputedStyle(share).display!=='none'),remoteName:String(tile?.querySelector('footer strong')?.textContent||'').trim(),remoteTileHidden:Boolean(tile?.hidden),stage:{left:Math.round(stage.left),top:Math.round(stage.top),width:Math.round(stage.width),height:Math.round(stage.height)},dock:{left:Math.round(dr?.left||0),top:Math.round(dr?.top||0),width:Math.round(dr?.width||0),height:Math.round(dr?.height||0)},dockOrientation:dock?.dataset.orientation||''};})()`);
  assert.equal(viewerCloseAfter.panelHidden,true,'Traffic-light close must hide the Participants window.');
  assert.equal(viewerCloseAfter.remoteClass,true,'Closing Participants must not end or suppress the remote-share viewer state.');
  assert.equal(viewerCloseAfter.overlayLocalShare,false,'Closing Participants must not convert a viewer into local presenter mode.');
  assert.equal(viewerCloseAfter.rowSharing,true,'Closing Participants must not clear the remote sharer status.');
  assert.equal(viewerCloseAfter.remoteName,'Jordan Lee','Closing Participants must not change the remote sharer identity.');
  assert.equal(viewerCloseAfter.remoteTileHidden,false,'Closing Participants must leave the remote sharer tile visible.');
  assert.deepEqual(viewerCloseAfter.stage,viewerCloseBefore.stage,'Closing Participants must not resize or move the remote shared-content stage.');
  assert.deepEqual(viewerCloseAfter.dock,viewerCloseBefore.dock,'Closing Participants must not move or resize the approved right-side filmstrip.');
  assert.equal(viewerCloseAfter.dockOrientation,'vertical','Closing Participants must preserve the approved right-side vertical filmstrip.');

  await evaluate(`(()=>{window.dispatchEvent(new CustomEvent('dominion:meeting-signal',{detail:{type:'reaction',fromParticipantId:'peer-approved-camera',fromDisplayName:'Jordan Lee',payload:{kind:'hand',raised:false,name:'Jordan Lee',participantId:'peer-approved-camera'}}}));window.dispatchEvent(new CustomEvent('dominion:remote-share-state',{detail:{participantId:'peer-approved-camera',active:false}}));const shareVideo=document.querySelector('#remoteShareVideo'),shareBanner=document.querySelector('#remoteShareBanner');if(shareVideo){shareVideo.srcObject=null;shareVideo.hidden=true;delete shareVideo.dataset.peerId;}if(shareBanner)shareBanner.hidden=true;delete window.__dsQaRemoteShareStream;return true;})()`);
  await evaluate(`(()=>{window.DominionRuntimeStability.setParticipants(false);document.body.classList.remove('remote-share-active');window.DominionMeetingParity.syncShareLayout();window.DominionMeetingParity.syncVideoDock();return true;})()`);

  // Approved remote-share host-viewer state: a host watching somebody else's
  // share keeps normal host meeting authority, but must not become the local
  // presenter or receive presenter-only share controls.
  const remoteHostViewer=await evaluate(`(()=>{const overlay=document.querySelector('#meetingOverlay'),stage=document.querySelector('.stage'),role=document.querySelector('#roomRole');if(role)role.textContent='Host';document.querySelector('.ds-ref-participants-footer')?.remove();document.body.classList.add('remote-share-active');overlay.classList.remove('share-active','ds-ref-presenter-visible');window.DominionMeetingParity.applyViewMode('speaker');window.DominionMeetingParity.syncShareLayout();window.DominionMeetingParity.syncVideoDock();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionRuntimeStability.ensureToolbarZones();window.DominionZoomScreenshotReference.sync();window.DominionApprovedReferenceParity.sync();const footer=document.querySelector('.meeting-footer'),expected=window.DominionApprovedReferenceParity.hostToolbarOrder;const geometry=expected.map(id=>{const node=document.querySelector('#'+id),r=node?.getBoundingClientRect();return {id,left:r?.left??-1,visible:Boolean(node&&!node.hidden&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden')};});const visual=geometry.filter(x=>x.visible).sort((a,b)=>a.left-b.left).map(x=>x.id),dock=document.querySelector('#participantVideoDock'),dr=dock?.getBoundingClientRect(),sr=stage.getBoundingClientRect(),presenter=document.querySelector('#inlinePresenterToolbar'),ps=presenter?getComputedStyle(presenter):null,exit=document.querySelector('#roomExitButton');return {remoteClass:document.body.classList.contains('remote-share-active'),overlayShare:overlay.classList.contains('share-active'),footerDisplay:getComputedStyle(footer).display,footerVisibility:getComputedStyle(footer).visibility,visual,expected,hostExists:Boolean(document.querySelector('#roomHostTools')),presenterVisible:Boolean(presenter&&!presenter.hidden&&ps.display!=='none'&&ps.visibility!=='hidden'&&parseFloat(ps.opacity||'1')>.1),exitLabel:String(exit?.querySelector('.ds-control-label')?.textContent||exit?.textContent||'').trim(),dockHidden:Boolean(dock?.hidden),dockOrientation:dock?.dataset.orientation||'',dockRightGap:dr?Math.round(sr.right-dr.right):null,stage:{width:Math.round(sr.width),height:Math.round(sr.height)}};})()`);
  assert.equal(remoteHostViewer.remoteClass,true,'Remote-share host-viewer scenario must use the real remote-share state.');
  assert.equal(remoteHostViewer.overlayShare,false,'Host viewing a remote share must not enter local presenter share-active mode.');
  assert.notEqual(remoteHostViewer.footerDisplay,'none','Remote-share host viewer must retain the normal meeting toolbar.');
  assert.notEqual(remoteHostViewer.footerVisibility,'hidden','Remote-share host toolbar must remain visible.');
  assert.deepEqual(remoteHostViewer.visual,remoteHostViewer.expected,'Host viewer toolbar must retain Audio → Video → Participants → Chat → React → Raise hand → Share → Host Tools → More → End.');
  assert.equal(remoteHostViewer.hostExists,true,'Host viewing a remote share must retain Host Tools.');
  assert.equal(remoteHostViewer.presenterVisible,false,'Host viewing somebody else\'s share must not receive local presenter toolbar controls.');
  assert.equal(remoteHostViewer.exitLabel,'End','Host viewing a remote share must retain End, not Leave.');
  assert.equal(remoteHostViewer.dockHidden,false,'Remote-share host viewer must retain the participant video strip.');
  assert.equal(remoteHostViewer.dockOrientation,'vertical','Remote-share host video strip must remain the approved right-side vertical strip.');
  assert.ok(Math.abs(remoteHostViewer.dockRightGap-14)<=2,`Remote-share host strip must stay on the approved right edge. ${JSON.stringify(remoteHostViewer)}`);
  assert.ok(remoteHostViewer.stage.width>200&&remoteHostViewer.stage.height>120,`Remote shared content must retain a real primary stage for the host viewer. ${JSON.stringify(remoteHostViewer.stage)}`);

  const hostViewerParticipants=await evaluate(`(()=>{const stage=document.querySelector('.stage'),before=stage.getBoundingClientRect();window.DominionRuntimeStability.setParticipants(true);window.DominionApprovedReferenceParity.sync();window.DominionZoomScreenshotReference.sync();window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('.room-side'),pr=panel.getBoundingClientRect(),after=stage.getBoundingClientRect(),footer=panel.querySelector('.ds-ref-participants-footer'),buttons=[...(footer?.querySelectorAll('button')||[])].filter(button=>getComputedStyle(button).display!=='none').map(button=>String(button.textContent||'').trim());return {panelHidden:Boolean(panel.hidden),width:Math.round(pr.width),height:Math.round(pr.height),buttons,before:{width:Math.round(before.width),height:Math.round(before.height)},after:{width:Math.round(after.width),height:Math.round(after.height)},hasMuteAll:Boolean(panel.querySelector('[data-ref-mute-all]')),hasMore:Boolean(panel.querySelector('[data-ref-participant-more]'))};})()`);
  assert.equal(hostViewerParticipants.panelHidden,false,'Host Participants panel must open over the remote shared stage.');
  assert.ok(Math.abs(hostViewerParticipants.width-318)<=2&&Math.abs(hostViewerParticipants.height-390)<=2,`Host Participants panel must retain the approved 318x390 geometry. ${JSON.stringify(hostViewerParticipants)}`);
  assert.ok(Math.abs(hostViewerParticipants.before.width-hostViewerParticipants.after.width)<=2&&Math.abs(hostViewerParticipants.before.height-hostViewerParticipants.after.height)<=2,`Opening host Participants must float over remote share instead of squeezing the shared stage. ${JSON.stringify(hostViewerParticipants)}`);
  assert.deepEqual(hostViewerParticipants.buttons,['Invite','Mute all','More'],'Host viewer footer must retain Invite, Mute all, and More.');
  assert.equal(hostViewerParticipants.hasMuteAll,true,'Host viewer must retain Mute all authority.');
  assert.equal(hostViewerParticipants.hasMore,true,'Host viewer must retain participant More controls.');
  await evaluate(`(()=>{window.DominionRuntimeStability.setParticipants(false);document.body.classList.remove('remote-share-active');window.DominionMeetingParity.syncShareLayout();window.DominionMeetingParity.syncVideoDock();window.DominionZoomScreenshotReference.sync();return true;})()`);

  await sleep(80);
  assert.deepEqual(runtimeErrors,[],'Approved-reference gate emitted uncaught renderer exceptions:\n'+runtimeErrors.join('\n'));
  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer wrote an uncaught JavaScript error to stderr.');
  console.log('DOMINIONSTAR_PACKAGED_APPROVED_REFERENCE_2_0_22_OK brand view-modes truthful-encryption stable-host-toolbar host-tools dedicated-raise-hand real-react-label reactions-six-only clean-runtime-chat direct-messages no-formatting centered-participants remembered-panel-geometry edge-corner-resize horizontal-mac-traffic stable-participant-search top-center-waiting-alert topbar-idle-fade solo-no-strip two-person-right-strip camera-off-main-fallback camera-on-main-video floating-filmstrip active-speaker smart-hover-chrome whole-panel-drag no-grip no-renderer-errors');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('approved-reference shutdown'));}pending.clear();for(const [,waiter] of qaRpcPending){clearTimeout(waiter.timer);waiter.reject(new Error('approved-reference qa-rpc shutdown'));}qaRpcPending.clear();try{child.stdin.end();}catch{}try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);