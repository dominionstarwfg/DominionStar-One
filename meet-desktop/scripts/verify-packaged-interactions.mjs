import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-interactions.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=9300+Math.floor(Math.random()*300);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const CDP_TIMEOUT_MS=1500;
const ATTACH_TIMEOUT_MS=15000;
const CONTROLLER_TIMEOUT_MS=12000;
const HARD_TIMEOUT_MS=45000;
let stderr='';

const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});
const watchdog=setTimeout(()=>{
  console.error('ERROR: Packaged interaction gate exceeded hard timeout.');
  if(stderr.trim())console.error(stderr.trim());
  try{child.kill('SIGKILL');}catch{}
  process.exit(124);
},HARD_TIMEOUT_MS);
watchdog.unref?.();

async function target(){
  const deadline=Date.now()+ATTACH_TIMEOUT_MS;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before interaction test.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(750)});
      if(response.ok){
        const targets=await response.json();
        const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));
        if(page?.webSocketDebuggerUrl)return page;
      }
    }catch{}
    await sleep(200);
  }
  throw new Error(`Unable to attach to packaged Electron renderer within ${ATTACH_TIMEOUT_MS}ms.\n${stderr}`);
}

function connect(url){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url);
    const timer=setTimeout(()=>{try{socket.close();}catch{}reject(new Error('Timed out opening DevTools WebSocket.'));},3000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
    socket.addEventListener('error',event=>{clearTimeout(timer);reject(event?.error||new Error('CDP WebSocket failed.'));},{once:true});
  });
}

let socket=null;
let nextId=0;
let lastPausedEvent=null;
const pauseWaiters=[];
const pending=new Map();
function settlePending(error){for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(error);}pending.clear();}
function cdp(method,params={}){
  return new Promise((resolve,reject)=>{
    if(!socket||socket.readyState!==WebSocket.OPEN)return reject(new Error(`CDP socket is not open for ${method}.`));
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timed out waiting for CDP ${method}.`));},CDP_TIMEOUT_MS);
    pending.set(id,{resolve,reject,timer});
    socket.send(JSON.stringify({id,method,params}));
  });
}
function fireCdp(method,params={}){
  if(!socket||socket.readyState!==WebSocket.OPEN)return;
  socket.send(JSON.stringify({id:++nextId,method,params}));
}
async function evaluate(expression){
  const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');
  return result.result?.value;
}
function formatPausedStack(event){
  const frames=event?.params?.callFrames||[];
  if(!frames.length)return 'Renderer paused without JavaScript call frames.';
  return frames.slice(0,18).map((frame,index)=>{
    const name=frame.functionName||'<anonymous>',url=frame.url||'<inline>',line=(frame.location?.lineNumber??-1)+1,column=(frame.location?.columnNumber??-1)+1;
    return `${index+1}. ${name} — ${url}:${line}:${column}`;
  }).join('\n');
}
function waitPaused(timeoutMs=2500){
  if(lastPausedEvent){const event=lastPausedEvent;lastPausedEvent=null;return Promise.resolve(event);}
  return new Promise(resolve=>{
    const waiter={resolve,timer:0};
    waiter.timer=setTimeout(()=>{const index=pauseWaiters.indexOf(waiter);if(index>=0)pauseWaiters.splice(index,1);resolve(null);},timeoutMs);
    pauseWaiters.push(waiter);
  });
}
async function captureBusyStack(){
  try{
    fireCdp('Debugger.pause');
    const event=await waitPaused();
    const stack=formatPausedStack(event);
    console.error('RENDERER_BUSY_STACK\n'+stack);
    fireCdp('Debugger.resume');
    return stack;
  }catch(error){return `Unable to capture renderer stack: ${error?.message||error}`;}
}
async function evaluateDiagnosed(expression,label){
  try{return await evaluate(expression);}
  catch(error){
    if(String(error?.message||'').includes('Runtime.evaluate')){
      const stack=await captureBusyStack();
      throw new Error(`${label} stalled. ${error.message}\nRenderer busy stack:\n${stack}`);
    }
    throw new Error(`${label} failed. ${error?.message||error}`);
  }
}
async function waitFor(expression,label,timeoutMs=CONTROLLER_TIMEOUT_MS){
  const deadline=Date.now()+timeoutMs;
  let lastError=null;
  while(Date.now()<deadline){
    try{if(await evaluate(`Boolean(${expression})`))return;}catch(error){lastError=error;}
    await sleep(120);
  }
  const busy=lastError&&String(lastError.message).includes('Runtime.evaluate')?await captureBusyStack():'';
  const suffix=lastError?` Last CDP error: ${lastError.message}`:'';
  const stack=busy?`\nRenderer busy stack:\n${busy}`:'';
  throw new Error(`Timed out waiting for ${label} within ${timeoutMs}ms.${suffix}${stack}`);
}
const mark=label=>console.log(`INTERACTION_STAGE_OK ${label}`);

let failure=null;
try{
  const page=await target();mark('renderer-target');
  socket=await connect(page.webSocketDebuggerUrl);mark('debug-socket');
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(message.method==='Debugger.paused'){
      if(pauseWaiters.length){const waiter=pauseWaiters.shift();clearTimeout(waiter.timer);waiter.resolve(message);}else lastPausedEvent=message;
      return;
    }
    if(!message.id)return;
    const waiter=pending.get(message.id);if(!waiter)return;
    pending.delete(message.id);clearTimeout(waiter.timer);
    if(message.error)waiter.reject(new Error(message.error.message||'CDP error'));
    else waiter.resolve(message.result);
  });
  socket.addEventListener('close',()=>settlePending(new Error('CDP WebSocket closed.')));
  await cdp('Runtime.enable');
  await cdp('Debugger.enable');mark('runtime-enabled');
  await waitFor("document.readyState==='complete'&&document.querySelector('#appShell')&&document.querySelector('#newMeetingDialog')&&window.DominionMeetingParity&&window.DominionMeetingFeatures&&window.DominionShareIntegration&&window.DominionZoomAdaptiveParity&&window.DominionApprovedReferenceParity&&window.DominionWebRTCController&&window.DominionRuntimeStability&&window.dominionDesktop?.meeting&&window.dominionDesktop?.share","desktop UI + final physical runtime + native share controllers");mark('controllers-loaded');
  assert.equal(await evaluate(`Boolean(window.DominionWebRTCController?.start&&window.DominionWebRTCController?.stop&&window.DominionWebRTCController?.snapshot&&window.DominionRuntimeStability?.sync)`),true,'Packaged renderer must expose the canonical live WebRTC and runtime-stability authorities.');mark('live-runtime-authority');

  await evaluate(`(()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=false;
    document.querySelector('#meetingOverlay').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    return true;
  })()`);
  await sleep(250);mark('shell-exposed');

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-action="new-meeting"]').click();return document.querySelector('#newMeetingDialog').open;})()`),true,'New Meeting did not open its dialog.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#newMeetingUsePersonal')&&document.querySelector('#newMeetingPasscode')?.maxLength===7)`),true,'New Meeting is missing Personal Meeting ID choice or 3–7 digit passcode limit.');
  await sleep(120);
  const personalPasscode=await evaluate(`(()=>{const toggle=document.querySelector('#newMeetingUsePersonal'),input=document.querySelector('#newMeetingPasscode'),label=input?.closest('label'),summary=document.querySelector('#newMeetingPersonalSummary'),match=String(summary?.textContent||'').match(/Passcode\\s+(\\d{3,7})/i);return {personal:Boolean(toggle?.checked),hidden:Boolean(label?.hidden||getComputedStyle(label).display==='none'),disabled:Boolean(input?.disabled),value:String(input?.value||''),summaryPass:match?.[1]||''};})()`);
  if(personalPasscode.personal){assert.equal(personalPasscode.hidden,true,'Personal Meeting ID mode must hide the unrelated editable instant passcode field.');assert.equal(personalPasscode.disabled,true,'Personal Meeting ID mode must disable the unrelated instant passcode input.');if(personalPasscode.summaryPass)assert.equal(personalPasscode.value,personalPasscode.summaryPass,'Personal Meeting ID must not retain a stale mismatched passcode value.');}
  await evaluate(`document.querySelector('#newMeetingDialog').close()`);mark('new-meeting');

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="join"]').click();return document.querySelector('#joinDialog').open;})()`),true,'Join did not open its dialog.');
  await evaluate(`document.querySelector('#joinDialog').close()`);mark('join');

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="schedule"]').click();return document.querySelector('#scheduleDialog').open;})()`),true,'Schedule did not open its dialog.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#scheduleMeetingIdMode')&&document.querySelector('#scheduleRepeat'))`),true,'Schedule is missing Meeting ID or recurrence controls.');
  assert.equal(await evaluate(`(()=>{const mode=document.querySelector('#scheduleMeetingIdMode'),repeat=document.querySelector('#scheduleRepeat');mode.value='personal';mode.dispatchEvent(new Event('change',{bubbles:true}));repeat.value='weekly';repeat.dispatchEvent(new Event('change',{bubbles:true}));return mode.value==='personal'&&repeat.value==='never';})()`),true,'Personal Meeting ID did not prevent a fixed recurring series.');
  await evaluate(`document.querySelector('#scheduleDialog').close()`);mark('schedule');

  assert.equal(await evaluate(`(()=>{document.querySelector('[data-open="settings"]').click();return document.querySelector('#settingsDialog').open;})()`),true,'Settings did not open.');
  assert.equal(await evaluate(`Boolean([...document.querySelectorAll('#settingsDialog .settings-row strong')].some(node=>node.textContent.trim()==='Personal Room'))`),true,'Settings is missing Personal Room controls.');
  await evaluate(`document.querySelector('#settingsDialog').close()`);mark('settings');

  assert.equal(await evaluate(`(()=>{document.querySelector('.nav-button[data-section="meetings"]').click();return !document.querySelector('#meetingsSection').hidden;})()`),true,'Meetings navigation did not switch sections.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#personalRoomCard')&&document.querySelector('#scheduledMeetingList'))`),true,'Meetings surface is missing Personal Room or scheduled meetings area.');mark('meetings-surface');

  assert.equal(await evaluate(`(()=>{const video=document.querySelector('#prejoinVideo'),avatar=document.querySelector('#prejoinAvatar'),overlay=document.querySelector('#prejoinOverlay');overlay.hidden=false;video.hidden=false;avatar.hidden=true;const hidden=getComputedStyle(avatar).display==='none';overlay.hidden=true;return hidden;})()`),true,'Prejoin profile avatar must stay hidden whenever the live camera preview is active.');mark('prejoin-avatar-safe');

  mark('meeting-entry-start');
  await evaluateDiagnosed(`(()=>{
    document.querySelector('#appShell').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;
    window.DominionMeetingParity.install();window.DominionMeetingFeatures.toggleChat(false);window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();window.DominionZoomScreenshotReference?.sync?.();
    return true;
  })()`,'meeting-entry transition');
  mark('meeting-entry-complete');
  assert.equal(await evaluate(`Boolean(window.DominionShareIntegration&&document.querySelector('#roomShare'))`),true,'Packaged meeting renderer did not wire the native Share integration.');
  assert.equal(await evaluate(`(()=>{const button=document.querySelector('#roomShare');if(!button)return false;const labels=[...button.querySelectorAll('.ds-exec-label,.ds-control-label')];const visible=labels.find(node=>{const style=getComputedStyle(node);return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';});return String(visible?.textContent||'').trim()==='Share';})()`),true,'Packaged meeting Share control is missing or its visible label is incorrect.');
  await evaluate(`window.DominionMeetingParity.install();window.DominionMeetingParity.decorateControls();window.DominionApprovedReferenceParity.sync();window.DominionRuntimeStability.sync();true`);
  assert.equal(await evaluate(`document.querySelector('.room-side')?.hidden===true&&document.querySelector('#meetingOverlay')?.classList.contains('participants-hidden')`),true,'Packaged meeting must start with Participants/Waiting Room closed.');
  assert.equal(await evaluate(`Boolean(document.querySelector('.ds-meeting-brand img')&&document.querySelector('.ds-meeting-brand strong')?.textContent==='DominionStar Meet')`),true,'Packaged live meeting header must contain DominionStar logo and name.');
  assert.equal(await evaluate(`!document.querySelector('.ds-ref-meeting-head-icons')&&getComputedStyle(document.querySelector('#meetingViewButton')).display!=='none'`),true,'Meeting header must remove unexplained glyph controls and retain only the clear View action beside DominionStar branding.');
  const approvedToolbar=await evaluate(`(()=>{const expected=window.DominionApprovedReferenceParity.toolbarOrder;const entries=expected.map(id=>{const node=document.querySelector('#'+id),r=node?.getBoundingClientRect();return {id,left:r?.left??-1,visible:Boolean(node&&!node.hidden&&getComputedStyle(node).display!=='none')};});return {expected,visual:entries.filter(entry=>entry.visible).sort((a,b)=>a.left-b.left).map(entry=>entry.id)};})()`);
  assert.deepEqual(approvedToolbar.visual,approvedToolbar.expected,'Packaged primary toolbar must visually remain Audio, Video, Participants, Chat, React, Raise hand, Share, Host Tools, More, End/Leave.');
  assert.equal(await evaluate(`['roomRecord','roomRecordStop','roomSecurity','roomSettings'].every(id=>{const node=document.querySelector('#'+id);return !node||getComputedStyle(node).display==='none';})`),true,'Record/Security/Settings must not leak back onto the primary meeting toolbar.');
  const toolbarGeometryBefore=await evaluate(`window.DominionApprovedReferenceParity.toolbarOrder.map(id=>{const r=document.querySelector('#'+id).getBoundingClientRect();return [id,Math.round(r.left),Math.round(r.width)];})`);
  await sleep(2300);
  const toolbarGeometryAfter=await evaluate(`window.DominionApprovedReferenceParity.toolbarOrder.map(id=>{const r=document.querySelector('#'+id).getBoundingClientRect();return [id,Math.round(r.left),Math.round(r.width)];})`);
  assert.deepEqual(toolbarGeometryAfter,toolbarGeometryBefore,'Primary toolbar geometry changed while idle; controls must not dance left/right during background activity.');
  assert.equal(await evaluate(`window.DominionApprovedReferenceParity.toolbarOrder.every(id=>id==='roomExitButton'||Boolean(document.querySelector('#'+id+' .ds-control-icon svg'))||(id==='roomReactions'&&Boolean(document.querySelector('#roomReactions .reaction-emoji-glyph'))))`),true,'Every approved primary meeting control must retain a modern icon, with Reactions allowed to use the approved emoji glyph.');
  assert.equal(await evaluate(`document.querySelector('#meetDiagnosticsButton')?.hidden!==false`),true,'Diagnostics must not be visible in the normal production meeting UI.');

  const mediaSlashState=async()=>evaluate(`(()=>{
    const button=document.querySelector('#roomMic');
    const icons=[...button.querySelectorAll(':scope>.ds-control-icon,:scope>.ds-exec-icon')];
    const visibleIcons=icons.filter(icon=>{const s=getComputedStyle(icon);return s.display!=='none'&&s.visibility!=='hidden';});
    const slashCount=visibleIcons.filter(icon=>{const s=getComputedStyle(icon,'::after');return s.display!=='none'&&s.content&&s.content!=='none'&&s.content!=='normal';}).length;
    return {off:button.classList.contains('is-off'),slashCount,label:button.getAttribute('aria-label')||button.textContent};
  })()`);
  let micVisual=await mediaSlashState();
  assert.equal(micVisual.off,true,'Meeting must begin with authoritative muted visual state in packaged interaction fixture.');
  assert.equal(micVisual.slashCount,1,'Muted microphone must render exactly one red slash.');
  await evaluate(`document.querySelector('#roomMic').click();true`);
  await waitFor("!document.querySelector('#roomMic').classList.contains('is-off')",'unmuted local microphone visual state',5000);
  micVisual=await mediaSlashState();
  assert.equal(micVisual.slashCount,0,'Unmuted microphone retained a stale or duplicate red slash.');
  const speakingMicState=await evaluate(`(()=>{window.dispatchEvent(new CustomEvent('dominion:local-voice-level',{detail:{level:.72,speaking:true}}));const button=document.querySelector('#roomMic');const icons=[...button.querySelectorAll(':scope>:is(.ds-control-icon,.ds-exec-icon)')];const visible=icons.find(icon=>{const s=getComputedStyle(icon);return s.display!=='none'&&s.visibility!=='hidden';});const meter=button.querySelector(':scope>.ds-room-mic-meter');const color=visible?getComputedStyle(visible).color.match(/\\d+/g)?.map(Number)||[]:[];const after=visible?getComputedStyle(visible,'::after'):null;const noSlash=!after||!after.content||after.content==='none'||after.content==='normal'||after.content==='""';return {bodySpeaking:document.body.classList.contains('ds-local-speaking'),buttonSpeaking:button.classList.contains('is-speaking'),meterVisible:Boolean(meter&&!meter.hidden&&getComputedStyle(meter).display!=='none'&&Number(getComputedStyle(meter).opacity)>.5),meterLevel:meter?.dataset.level||'',color,noSlash,buttonClass:button.className};})()`);
  console.error('QA_MIC_SPEAKING_STATE '+JSON.stringify(speakingMicState));
  assert.equal(Boolean(speakingMicState.bodySpeaking&&speakingMicState.buttonSpeaking&&speakingMicState.meterVisible&&speakingMicState.meterLevel==='3'&&speakingMicState.noSlash),true,'Live speaking microphone state must show the real three-bar meter with no visible red slash.');
  await evaluate(`window.dispatchEvent(new CustomEvent('dominion:local-voice-level',{detail:{level:0,speaking:false}}));document.querySelector('#roomMic').click();true`);
  await waitFor("document.querySelector('#roomMic').classList.contains('is-off')",'restored muted local microphone visual state',5000);
  micVisual=await mediaSlashState();
  assert.equal(micVisual.slashCount,1,'Muted microphone did not return to exactly one red slash.');
  mark('single-mute-slash');

  // Command-menu compatibility decoration is intentionally done by a narrow
  // direct-body MutationObserver. Do not require that compatibility class in
  // the same JavaScript call stack as the button click.
  await evaluate(`document.querySelector('#roomMore').click();true`);
  await waitFor("document.querySelector('.meeting-more-menu')",'production More menu',2500);
  assert.equal(await evaluate(`(()=>{const menu=document.querySelector('.meeting-more-menu');const text=menu?.textContent||'';menu?.remove();return !text.includes('Diagnostics')&&text.includes('Settings');})()`),true,'Production More menu must contain the approved Settings control without Diagnostics.');
  mark('share-integration-wired');
  await sleep(200);
  await waitFor("document.querySelector('#roomParticipants')&&document.querySelector('#roomMore')&&document.querySelector('#roomSettings')&&document.querySelector('#roomChat')&&document.querySelector('#roomReactions')&&document.querySelector('#roomRaiseHand')","meeting controls",7000);mark('meeting-controls');

  await evaluate(`(()=>{localStorage.removeItem('ds_meet_floating_surface_geometry_v1');const side=document.querySelector('.room-side');if(side){side.dataset.dsRuntimeUserPositioned='0';side.dataset.dsAdaptiveUserPositioned='0';side.style.removeProperty('left');side.style.removeProperty('top');side.style.removeProperty('right');side.style.removeProperty('bottom');side.style.removeProperty('width');side.style.removeProperty('height');}return true;})()`);
  assert.equal(await evaluate(`(()=>{const side=document.querySelector('.room-side');document.querySelector('#roomParticipants').click();window.DominionRuntimeStability.layoutSideSurface();return side.hidden===false&&!document.querySelector('#meetingOverlay').classList.contains('participants-hidden');})()`),true,'Participants control did not open the management panel on demand.');
  await sleep(190);
  const participantPanelGeometry=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const panel=document.querySelector('.room-side'),body=document.querySelector('.meeting-body'),stage=document.querySelector('.stage'),side=panel.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=stage.getBoundingClientRect();return {width:Math.round(side.width),height:Math.round(side.height),position:getComputedStyle(panel).position,runtime:panel.dataset.dsRuntimeMode,inside:side.left>=br.left+10&&side.right<=br.right-10&&side.top>=br.top+10&&side.bottom<=br.bottom-10,centerDeltaX:Math.round((side.left+side.width/2)-(br.left+br.width/2)),centerDeltaY:Math.round((side.top+side.height/2)-(br.top+br.height/2)),stageRightGap:Math.round(br.right-sr.right),stageWidth:Math.round(sr.width),bodyWidth:Math.round(br.width)};})()`);
  assert.equal(participantPanelGeometry.position,'absolute','Participant management panel must remain a floating application surface.');
  assert.equal(participantPanelGeometry.runtime,'floating','Desktop-width Participants must open as a floating Zoom-style window.');
  assert.ok(participantPanelGeometry.width>=312&&participantPanelGeometry.width<=324,`Desktop Participants width must match the compact 318px reference; received ${participantPanelGeometry.width}px.`);
  assert.equal(participantPanelGeometry.inside,true,'Floating Participants must remain inside the current meeting body.');
  const participantReferenceState=await evaluate(`(()=>{const panel=document.querySelector('.room-side'),r=panel.getBoundingClientRect(),roster=panel.querySelector('#participantRoster');let row=roster?.querySelector('[data-participant-id]');if(!row&&roster){row=document.createElement('div');row.className='person-row';row.dataset.participantId='qa-local-host';row.dataset.participantName='QA Local Host';row.innerHTML='<span class="person-badge">QH</span><span class="person-copy"><strong><span class="participant-name-text">QA Local Host</span><em class="participant-you" hidden></em></strong><small></small></span><span class="participant-actions"></span>';roster.append(row);}if(row){row.dataset.participantSelf='1';row.dataset.participantRole='host';window.DominionZoomPhysicalAcceptance?.decorateParticipantRows?.();}const role=row?.querySelector('.participant-you'),footer=panel.querySelector('.ds-ref-participants-footer'),buttons=footer?[...footer.querySelectorAll(':scope>button')]:[];const br=buttons.map(b=>b.getBoundingClientRect().width);return {height:Math.round(r.height),role:String(role?.textContent||''),roleHidden:Boolean(role?.hidden),self:String(row?.dataset.participantSelf||''),participantRole:String(row?.dataset.participantRole||''),footerButtons:buttons.length,footerSpread:br.length?Math.max(...br)-Math.min(...br):999,hasUtility:Boolean(panel.querySelector('.ds-participant-header-action'))};})()`);
  console.error('QA_PARTICIPANT_REFERENCE_STATE '+JSON.stringify(participantReferenceState));
  assert.ok(participantReferenceState.height>=382&&participantReferenceState.height<=400,`Participants height must match the 390px-class reference; received ${participantReferenceState.height}px.`);
  assert.equal(participantReferenceState.self,'1','Synthetic local-host identity was not preserved through participant normalization in the same renderer turn.');
  assert.equal(participantReferenceState.participantRole,'host','Synthetic local-host role was not preserved through participant normalization in the same renderer turn.');
  assert.equal(participantReferenceState.roleHidden,false,'Host/self metadata must remain visible inline.');
  assert.ok(/\(Host, me\)|\(Co-host, me\)|\(me\)/.test(participantReferenceState.role),'Participant self-role label does not match the compact inline reference.');
  assert.equal(participantReferenceState.footerButtons,3,'Participants footer must contain exactly Invite, Mute all, and More.');
  assert.ok(participantReferenceState.footerSpread<=8,'Participants footer buttons must remain visually balanced.');
  assert.equal(participantReferenceState.hasUtility,true,'Participants header utility action is missing.');
  assert.ok(Math.abs(participantPanelGeometry.centerDeltaX)<=2&&Math.abs(participantPanelGeometry.centerDeltaY)<=2,'Participants must open centered in the meeting body before user positioning.');
  assert.ok(participantPanelGeometry.height>=382&&participantPanelGeometry.height<=400,'Participants must preserve the approved 390px-class height.');
  assert.ok(Math.abs(participantPanelGeometry.stageRightGap)<=2,'Floating Participants must not reserve the right edge or shrink the live stage.');
  assert.ok(Math.abs(participantPanelGeometry.stageWidth-participantPanelGeometry.bodyWidth)<=2,'The live stage must remain full width underneath floating Participants.');
  assert.equal(await evaluate(`(()=>{const side=document.querySelector('.room-side'),traffic=side?.querySelector('.ds-panel-traffic[data-ds-runtime-participant-chrome="1"]'),red=traffic?.querySelector('.ds-traffic-close[aria-label="Close participants"]'),yellow=traffic?.querySelector('.ds-traffic-minimize[aria-label="Minimize participants"]'),green=traffic?.querySelector('.ds-traffic-restore[aria-label="Restore participants"]');const visible=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&Number(getComputedStyle(node).opacity)>0);return Boolean(traffic&&visible(red)&&visible(yellow)&&visible(green)&&traffic.querySelectorAll(':scope>button').length===3&&!side.querySelector('.ds-participants-traffic,.ds-participants-popout'));})()`),true,'Mac Participants must expose exactly one visible runtime-owned red/yellow/green traffic-light control set with no legacy duplicate header controls.');
  const participantBeforeDrag=await evaluate(`(()=>{const p=document.querySelector('.room-side').getBoundingClientRect();return {left:p.left,top:p.top};})()`);
  await evaluate(`(()=>{const panel=document.querySelector('.room-side');panel.dataset.dsRuntimeUserPositioned='1';panel.style.setProperty('left','72px','important');panel.style.setProperty('top','86px','important');panel.style.setProperty('right','auto','important');window.DominionRuntimeStability.layoutSideSurface();return true;})()`);
  const participantAfterDrag=await evaluate(`(()=>{const p=document.querySelector('.room-side').getBoundingClientRect();return {left:Math.round(p.left),top:Math.round(p.top),user:document.querySelector('.room-side').dataset.dsRuntimeUserPositioned};})()`);
  assert.equal(participantAfterDrag.user,'1','Participants must preserve user-positioned floating state.');
  assert.ok(Math.abs(participantAfterDrag.left-participantBeforeDrag.left)>10||Math.abs(participantAfterDrag.top-participantBeforeDrag.top)>10,'Participants floating geometry did not move away from its default position.');
  assert.equal(await evaluate(`(()=>{document.querySelector('.room-side .ds-panel-traffic .ds-traffic-close[aria-label="Close participants"]').click();return document.querySelector('.room-side').hidden===true;})()`),true,'Participants canonical red traffic-light Close control did not close the floating panel.');
  await evaluate(`document.querySelector('#roomParticipants').click();true`);
  const participantReopen=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const p=document.querySelector('.room-side').getBoundingClientRect();return {left:Math.round(p.left),top:Math.round(p.top),user:document.querySelector('.room-side').dataset.dsRuntimeUserPositioned};})()`);
  assert.equal(participantReopen.user,'1','Participants forgot dragged geometry after reopening.');
  assert.ok(Math.abs(participantReopen.left-participantAfterDrag.left)<=3&&Math.abs(participantReopen.top-participantAfterDrag.top)<=3,'Participants did not reopen at the remembered floating position.');
  await evaluate(`document.querySelector('#roomParticipants').click();true`);mark('participants-floating');

  assert.equal(await evaluate(`(()=>{document.querySelector('#roomChat').click();return document.querySelector('#meetingChatPanel').hidden===false;})()`),true,'Chat control did not open chat.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#meetingChatRecipient')&&document.querySelector('#meetingChatInput')&&document.querySelector('#meetingChatForm'))`),true,'Chat must retain recipient targeting, message entry, and send controls under the approved clean chrome.');
  assert.equal(await evaluate(`document.querySelector('#meetingChatRecipient')?.options?.[0]?.value==='everyone'`),true,'Chat must default to Everyone while retaining private-recipient support.');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#meetingChatPanel .meeting-chat-recipient')).display==='none'`),true,'Legacy To: row must remain hidden under the approved Chat chrome.');
  assert.equal(await evaluate(`Boolean(document.querySelector('#meetingChatPanel [data-chat-close]'))&&!document.querySelector('#meetingChatPanel .ds-panel-traffic')`),true,'Chat floating surface must expose direct close controls.');
  const chatGeometry=await evaluate(`(()=>{window.DominionRuntimeStability.layoutSideSurface();const p=document.querySelector('#meetingChatPanel').getBoundingClientRect(),b=document.querySelector('.meeting-body').getBoundingClientRect();return {rightGap:Math.round(b.right-p.right),topGap:Math.round(p.top-b.top),mode:document.querySelector('#meetingChatPanel').dataset.dsRuntimeMode};})()`);
  assert.equal(chatGeometry.mode,'floating','Chat must use the floating runtime surface.');
  assert.ok(chatGeometry.rightGap>=18&&chatGeometry.rightGap<=36&&chatGeometry.topGap>=40,'Chat must open inset from the meeting edge rather than docked to it.');
  assert.equal(await evaluate(`(()=>{document.querySelector('#meetingChatPanel [data-chat-close]').click();return document.querySelector('#meetingChatPanel').hidden===true;})()`),true,'Chat direct close control did not close chat.');mark('chat-floating');

  await evaluate(`document.querySelector('#roomReactions').click();true`);
  await waitFor("document.querySelector('.meeting-reaction-menu')",'reaction menu',2500);
  assert.equal(await evaluate(`Boolean(document.querySelector('.meeting-reaction-menu'))`),true,'Reactions control did not open its menu.');
  await evaluate(`document.querySelector('.meeting-reaction-menu')?.remove()`);mark('reactions');

  await evaluate(`document.querySelector('#roomMore').click();true`);
  await waitFor("document.querySelector('.meeting-more-menu')",'More menu',2500);
  assert.equal(await evaluate(`Boolean(document.querySelector('.meeting-more-menu'))`),true,'More control did not open its menu.');
  await evaluate(`document.querySelector('.meeting-more-menu')?.remove()`);mark('more');
  assert.equal(await evaluate(`(()=>{document.querySelector('#roomSettings').click();return document.querySelector('#settingsDialog').open;})()`),true,'Meeting Settings control did not open Settings.');
  await evaluate(`document.querySelector('#settingsDialog').close()`);mark('meeting-settings');

  const geometry=await evaluate(`(()=>{const body=getComputedStyle(document.querySelector('.meeting-body'));const stage=getComputedStyle(document.querySelector('.stage'));const side=getComputedStyle(document.querySelector('.room-side'));return {bodyDisplay:body.display,stagePosition:stage.position,sidePosition:side.position};})()`);
  assert.equal(geometry.bodyDisplay,'block','Meeting body must be full-stage block layout.');
  assert.equal(geometry.stagePosition,'absolute','Meeting stage must fill the meeting canvas.');
  assert.equal(geometry.sidePosition,'absolute','Participant management must remain an absolute responsive side surface.');mark('full-stage-geometry');

  const dock=await evaluate(`(()=>{
    const strip=document.querySelector('#remoteTileStrip')||(()=>{const n=document.createElement('div');n.id='remoteTileStrip';document.querySelector('.stage').append(n);return n;})();
    strip.replaceChildren();
    for(let i=0;i<4;i+=1){const tile=document.createElement('article');tile.className='remote-peer-tile';tile.dataset.participantId='qa-'+i;tile.innerHTML='<video></video><footer><strong>QA</strong></footer>';strip.append(tile);}
    window.DominionMeetingParity.resetVideoDock();
    window.DominionMeetingParity.syncVideoDock();window.DominionZoomAdaptiveParity.sync();window.DominionApprovedReferenceParity.syncVideoPanel();window.DominionRuntimeStability.syncVideoDockGeometry();
    const node=document.querySelector('#participantVideoDock'),stage=document.querySelector('.stage');
    const nr=node.getBoundingClientRect(),sr=stage.getBoundingClientRect();
    return {hidden:node.hidden,className:node.className,orientation:node.dataset.orientation,grid:getComputedStyle(node.querySelector('.participant-video-dock-body')).gridTemplateColumns,rightGap:Math.round(sr.right-nr.right),topGap:Math.round(nr.top-sr.top),columns:Number(node.dataset.dsRuntimeColumns||0),visible:Number(node.dataset.dsRuntimeVisibleCount||0),width:Math.round(nr.width),height:Math.round(nr.height)};
  })()`);
  assert.equal(dock.hidden,false,'Four participant tiles must show the Zoom-style video filmstrip.');
  assert.match(dock.className,/count-4/,'Four participant tiles must retain the four-tile adaptive dock state.');
  assert.equal(dock.orientation,'vertical','Normal Speaker view must keep the participant filmstrip vertical on the right.');
  assert.ok(dock.rightGap>=8&&dock.rightGap<=24,`Default participant video filmstrip must sit against the right edge; received ${dock.rightGap}px.`);
  assert.ok(dock.topGap>=8&&dock.topGap<=24,`Default participant video filmstrip must start near the upper-right corner; received ${dock.topGap}px.`);
  assert.equal(dock.visible,4,'Adaptive participant video panel did not count all visible participant tiles.');
  assert.equal(dock.columns,1,'Four visible participants must remain in the approved one-column right-side filmstrip.');
  assert.equal(String(dock.grid).split(' ').filter(Boolean).length,1,'Four visible participants must render one vertical video column.');
  assert.ok(dock.width>=184&&dock.width<=190&&dock.height>=430,'Four visible participants must extend the right-side filmstrip vertically without widening it.');
  const shareDock=await evaluate(`(()=>{
    const overlay=document.querySelector('#meetingOverlay'),dock=document.querySelector('#participantVideoDock');
    overlay.classList.add('share-active');window.DominionPreferences?.write?.('shareVideoDock',true);window.DominionPreferences?.write?.('shareSideBySide',false);
    window.DominionMeetingParity.syncShareLayout();window.DominionMeetingParity.syncVideoDock();window.DominionZoomAdaptiveParity.sync();window.DominionApprovedReferenceParity.syncVideoPanel();
    const result={floating:overlay.classList.contains('share-panel-floating'),sideBySide:overlay.classList.contains('share-side-by-side'),orientation:dock.dataset.orientation,right:getComputedStyle(dock).right};
    overlay.classList.remove('share-active');window.DominionMeetingParity.syncShareLayout();window.DominionMeetingParity.syncVideoDock();return result;
  })()`);
  assert.equal(shareDock.floating,true,'Screen sharing must default to the floating participant video panel.');
  assert.equal(shareDock.sideBySide,false,'Side-by-side video must not replace the default floating share dock unless explicitly selected.');
  assert.equal(shareDock.orientation,'vertical','Default share-time video panel must start as a vertical right-side dock.');mark('adaptive-dock');

  console.log('DOMINIONSTAR_PACKAGED_INTERACTIONS_OK home-dialogs settings personal-room schedule recurrence approved-toolbar-stable participants-floating chat-floating reactions more zoom-right-filmstrip adaptive-full-stage-dock');
}catch(error){
  failure=error;
  console.error(error?.stack||String(error));
  if(stderr.trim())console.error(stderr.trim());
}finally{
  clearTimeout(watchdog);
  settlePending(new Error('Interaction test shutting down.'));
  try{socket?.close();}catch{}
  try{child.kill('SIGTERM');}catch{}
  await sleep(300);
  if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}
}

process.exit(failure?1:0);