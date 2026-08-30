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
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},2200);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown'){const details=message.params?.exceptionDetails;runtimeErrors.push(details?.exception?.description||details?.text||'Uncaught renderer exception');return;}if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionMeetingParity&&window.DominionZoomProductionPolish&&window.DominionZoomPhysicalAcceptance",'physical acceptance controller');
  await evaluate(`(()=>{document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity.install();window.DominionZoomProductionPolish.sync();window.DominionZoomPhysicalAcceptance.sync();return true;})()`);
  await waitFor("['roomShare','roomParticipants','roomChat','roomReactions','roomHostTools','roomMore','meetingViewButton'].every(id=>document.querySelector('#'+id))",'physical acceptance controls');
  await sleep(180);

  // View must open a real clickable command surface and change actual layout state.
  await evaluate(`document.querySelector('#meetingViewButton').click()`);
  await waitFor("document.querySelector('.ds-command-menu')&&/View/.test(document.querySelector('.ds-command-menu').textContent)",'View menu');
  const viewMenu=await evaluate(`(()=>{const m=document.querySelector('.ds-command-menu'),f=document.querySelector('.meeting-footer').getBoundingClientRect(),r=m.getBoundingClientRect();return {z:parseInt(getComputedStyle(m).zIndex)||0,bottom:r.bottom,footerTop:f.top,items:[...m.querySelectorAll('button')].map(b=>b.textContent.trim())};})()`);
  assert.ok(viewMenu.z>=2500,'View menu must render above meeting chrome.');
  assert.ok(viewMenu.bottom<=viewMenu.footerTop+2,'View menu must open above the toolbar rather than sinking behind it.');
  assert.ok(viewMenu.items.includes('Gallery'),'View menu is missing Gallery.');
  await evaluate(`[...document.querySelectorAll('.ds-command-menu button')].find(b=>/Gallery/.test(b.textContent||''))?.click()`);
  await waitFor("document.querySelector('#meetingOverlay').dataset.viewMode==='gallery'",'working Gallery action');

  // Host Tools must be directly interactive and above the toolbar.
  await evaluate(`document.querySelector('#roomHostTools').click()`);
  await waitFor("document.querySelector('.ds-command-menu')&&/Host Tools/.test(document.querySelector('.ds-command-menu').textContent)",'Host Tools menu');
  const hostMenu=await evaluate(`(()=>{const m=document.querySelector('.ds-command-menu'),f=document.querySelector('.meeting-footer').getBoundingClientRect(),r=m.getBoundingClientRect();return {z:parseInt(getComputedStyle(m).zIndex)||0,bottom:r.bottom,footerTop:f.top,items:[...m.querySelectorAll('button')].map(b=>b.textContent.trim())};})()`);
  assert.ok(hostMenu.z>=2500&&hostMenu.bottom<=hostMenu.footerTop+2,'Host Tools must stay clickable above the toolbar.');
  assert.ok(hostMenu.items.some(v=>/Open Participants/i.test(v))&&hostMenu.items.some(v=>/Lock Meeting/i.test(v)),'Host Tools is missing live host actions.');
  await evaluate(`document.querySelector('.ds-command-menu')?.remove()`);

  // More must respond and retain actual secondary actions.
  await evaluate(`document.querySelector('#roomMore').click()`);
  await waitFor("document.querySelector('.ds-command-menu')&&/More/.test(document.querySelector('.ds-command-menu').textContent)",'More menu');
  const more=await evaluate(`[...document.querySelectorAll('.ds-command-menu button')].map(b=>b.textContent.trim())`);
  assert.ok(more.some(v=>/Meeting settings/i.test(v)),'More must expose Meeting settings.');
  assert.ok(!more.some(v=>/^Host Tools$/i.test(v)),'Host Tools must not be duplicated inside More.');
  await evaluate(`document.querySelector('.ds-command-menu')?.remove()`);

  // Participants must expose modern row media status + ellipsis, not just name/role text.
  await evaluate(`(()=>{document.querySelector('#roomParticipants').click();const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row" data-participant-id="qa-guest" data-participant-role="participant" data-participant-name="Taylor Participant" data-recording-allowed="0" data-record-eligible="1"><span class="person-badge">TP</span><span class="person-copy"><strong>Taylor Participant</strong><small>Participant</small></span></div>';window.DominionZoomPhysicalAcceptance.decorateParticipantRows();setTimeout(()=>window.DominionZoomPhysicalAcceptance.decorateParticipantRows(),40);return true;})()`);
  await waitFor("document.querySelector('#participantRoster .ds-modern-participant-row .ds-participant-media')",'participant media indicators');
  await waitFor("document.querySelector('#participantRoster [data-participant-more]')",'participant ellipsis');
  const participantRow=await evaluate(`(()=>{const row=document.querySelector('#participantRoster .ds-modern-participant-row'),states=[...row.querySelectorAll('.ds-media-state')],more=row.querySelector('[data-participant-more]');return {height:row.getBoundingClientRect().height,stateCount:states.length,moreText:more?.textContent||'',nameFont:parseFloat(getComputedStyle(row.querySelector('.person-copy strong')).fontSize),moreWidth:more?.getBoundingClientRect().width||0};})()`);
  assert.ok(participantRow.height>=56&&participantRow.nameFont>=13.5,'Participant row remains undersized.');
  assert.equal(participantRow.stateCount,2,'Participant row must show microphone and video status.');
  assert.equal(participantRow.moreText,'•••','Participant management must use a three-dot control.');
  assert.ok(participantRow.moreWidth>=30,'Participant ellipsis target is too small.');
  await evaluate(`document.querySelector('#roomParticipants').click()`);

  // Chat must be readable and its More action must be clickable.
  await evaluate(`document.querySelector('#roomChat').click()`);await waitFor("!document.querySelector('#meetingChatPanel').hidden",'Chat panel');
  const chat=await evaluate(`(()=>{window.DominionZoomProductionPolish.sync();const p=document.querySelector('#meetingChatPanel'),more=p.querySelector('.zoom-chat-more'),input=document.querySelector('#meetingChatInput');return {width:p.getBoundingClientRect().width,head:parseFloat(getComputedStyle(p.querySelector('header strong')).fontSize),input:parseFloat(getComputedStyle(input).fontSize),more:Boolean(more&&getComputedStyle(more).display!=='none')};})()`);
  assert.ok(chat.width>=390&&chat.head>=15.5&&chat.input>=13.5,'Chat is not at the approved readable panel scale.');
  assert.equal(chat.more,true,'Chat options ellipsis is missing.');
  await evaluate(`document.querySelector('#roomChat').click()`);

  // Reaction tray: six clickable standards + hand, and emitted bubble must be upgraded to long upward glass motion.
  await evaluate(`document.querySelector('#roomReactions').click()`);await waitFor("document.querySelector('.ds-reaction-tray')",'reaction tray');
  const reactionTray=await evaluate(`(()=>{const tray=document.querySelector('.ds-reaction-tray'),buttons=[...tray.querySelectorAll('button')];return {z:parseInt(getComputedStyle(tray).zIndex)||0,reactions:buttons.filter(b=>!b.classList.contains('ds-raise-hand')).length,hand:Boolean(tray.querySelector('.ds-raise-hand')),pointer:getComputedStyle(tray).pointerEvents};})()`);
  assert.ok(reactionTray.z>=2700&&reactionTray.pointer!=='none','Reaction tray is behind another layer or cannot receive clicks.');
  assert.equal(reactionTray.reactions,6,'Reaction tray must expose six standard reaction buttons.');assert.equal(reactionTray.hand,true,'Raise Hand is missing from reactions.');
  await evaluate(`(()=>{document.querySelector('.ds-reaction-tray')?.remove();const layer=document.querySelector('#meetingReactionLayer');const bubble=document.createElement('div');bubble.className='meeting-reaction-bubble';bubble.innerHTML='<b>❤️</b><span>Taylor Participant</span>';layer.append(bubble);return true;})()`);
  await waitFor("document.querySelector('.ds-reaction-float')",'upgraded reaction float');
  const float=await evaluate(`(()=>{const n=document.querySelector('.ds-reaction-float'),style=getComputedStyle(n);return {direction:style.flexDirection,duration:style.animationDuration,left:n.getBoundingClientRect().left,name:n.querySelector('span')?.textContent||'',font:parseFloat(getComputedStyle(n.querySelector('b')).fontSize)};})()`);
  assert.equal(float.direction,'column','Reaction name must sit below the emoji.');
  assert.ok(parseFloat(float.duration)>=6,'Reaction float disappears too quickly.');
  assert.ok(float.left<=50&&float.font>=40,'Reaction float must originate visibly on the left at a readable size.');

  // Settings/A-V typography cannot regress to 8–10px. Measure the actual loaded CSS authority.
  const settingsType=await evaluate(`(()=>{const host=document.createElement('div');host.style.position='fixed';host.style.left='-9999px';host.innerHTML='<div class="settings-modal"><form><div class="av-detail-head"><div><h3>Video</h3><p>Camera description</p></div></div><label class="av-toggle-row">Mirror my video</label><div class="av-quick-menu"><button>Audio & Video Settings</button></div></form></div>';document.body.append(host);const out={copy:parseFloat(getComputedStyle(host.querySelector('.av-detail-head p')).fontSize),toggle:parseFloat(getComputedStyle(host.querySelector('.av-toggle-row')).fontSize),quick:parseFloat(getComputedStyle(host.querySelector('.av-quick-menu button')).fontSize)};host.remove();return out;})()`);
  assert.ok(settingsType.copy>=12&&settingsType.toggle>=12.5&&settingsType.quick>=12.5,'A/V settings typography is still below readable production scale.');

  // Screen Share button must be owned by the real-source authority, not the old permission-only bubble path.
  const shareAuthority=await evaluate(`(()=>{const b=document.querySelector('#roomShare');return {bound:b?.dataset.dsPhysicalShareAuthority||'',api:Boolean(window.DominionZoomPhysicalAcceptance?.openSmartSharePicker),presenter:Boolean(String(document.documentElement.innerHTML).length)};})()`);
  assert.equal(shareAuthority.bound,'1','Share Screen button is not owned by the physical real-source authority.');assert.equal(shareAuthority.api,true,'Real-source share picker API is missing.');

  await sleep(100);assert.deepEqual(runtimeErrors,[],'Physical acceptance emitted uncaught renderer exceptions:\n'+runtimeErrors.join('\n'));assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'Packaged renderer wrote an uncaught JavaScript error to stderr.');
  console.log('DOMINIONSTAR_PACKAGED_PHYSICAL_ACCEPTANCE_OK view-click host-tools-click more-click participant-media participant-ellipsis modern-chat reactions-clickable reaction-six-seconds settings-readable share-real-source-authority no-renderer-errors');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('physical acceptance shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
