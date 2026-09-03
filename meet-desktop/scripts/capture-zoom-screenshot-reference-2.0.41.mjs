import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
const outputDir=path.resolve(process.argv[3]||'../zoom-reference-proof-2.0.41');
if(!appPath)throw new Error('Usage: node capture-zoom-screenshot-reference-2.0.41.mjs <DominionStar Meet.app> [output-dir]');
fs.mkdirSync(outputDir,{recursive:true});

const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=11620+Math.floor(Math.random()*160);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){
  const deadline=Date.now()+18000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before visual proof.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(800)});
      if(response.ok){
        const targets=await response.json();
        const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));
        if(page?.webSocketDebuggerUrl)return page;
      }
    }catch{}
    await sleep(150);
  }
  throw new Error('Unable to attach to packaged renderer for 2.0.41 visual proof.');
}

function connect(url){return new Promise((resolve,reject)=>{
  const socket=new WebSocket(url);
  const timer=setTimeout(()=>reject(new Error('Visual proof CDP connection timeout.')),3500);
  socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
  socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Visual proof CDP connection failed.'));},{once:true});
});}

let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{
  const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},6000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){
  const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');
  return result.result?.value;
}
async function waitFor(expression,label,timeout=12000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}
  throw new Error(`Timed out waiting for ${label}.`);
}
async function screenshot(name){
  const result=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
  const file=path.join(outputDir,name);fs.writeFileSync(file,Buffer.from(result.data,'base64'));return file;
}
async function settle(ms=220){await sleep(ms);}

const proof={version:'2.0.41',screens:{},privacy:'Synthetic QA identity only. No user-uploaded photo or screenshot is embedded in the package or proof fixture.'};
let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));if(!message.id)return;
    const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);
    message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);
  });
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1512,height:900,deviceScaleFactor:1,mobile:false});
  await waitFor("document.readyState==='complete'&&window.DominionZoomScreenshotReference&&document.querySelector('#appShell')&&document.querySelector('#meetingOverlay')&&document.querySelector('#prejoinOverlay')",'2.0.41 screenshot reference authority');

  // 01 HOME — synthetic account; no personal photo fixture.
  await evaluate(`(()=>{
    document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;
    const app=document.querySelector('#appShell');app.hidden=false;
    document.querySelector('#homeSection').hidden=false;document.querySelector('#meetingsSection').hidden=true;
    document.querySelector('#meetingOverlay').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;
    document.querySelector('#profileName').textContent='QA Member';const avatar=document.querySelector('#profileAvatar');avatar.textContent='QM';avatar.classList.remove('has-photo');
    document.querySelector('#clockTime').textContent='4:40 PM';document.querySelector('#clockDate').textContent='Thursday, September 3';
    window.DominionZoomScreenshotReference.sync();return true;
  })()`);await settle();
  proof.screens.home=await evaluate(`(()=>{const shell=document.querySelector('#appShell'),actions=[...document.querySelectorAll('#homeSection .action-card strong')].map(n=>n.textContent.trim());return {visible:!shell.hidden,actions,rail:Math.round(document.querySelector('.sidebar').getBoundingClientRect().width),notes:actions.includes('My Notes'),search:Boolean(document.querySelector('.ds-ref-search'))};})()`);
  if(!proof.screens.home.visible||proof.screens.home.rail<76||!proof.screens.home.notes||!proof.screens.home.search)throw new Error(`Home proof failed ${JSON.stringify(proof.screens.home)}`);
  await screenshot('01-home.png');

  // 02 PREJOIN.
  await evaluate(`(()=>{
    document.querySelector('#appShell').hidden=false;document.querySelector('#homeSection').hidden=false;
    const p=document.querySelector('#prejoinOverlay');p.hidden=false;document.querySelector('#meetingOverlay').hidden=true;
    document.querySelector('#prejoinTitle').textContent='QA Member’s Personal Meeting Room';
    const video=document.querySelector('#prejoinVideo');video.hidden=true;const av=document.querySelector('#prejoinAvatar');av.hidden=false;av.textContent='QM';
    for(const [id,text] of [['#prejoinMic','Audio'],['#prejoinCamera','Video']]){const b=document.querySelector(id),l=b?.querySelector('.ds-control-label');if(l)l.textContent=text;}
    window.DominionZoomScreenshotReference.sync();return true;
  })()`);await settle();
  proof.screens.prejoin=await evaluate(`(()=>{const w=document.querySelector('#prejoinOverlay .prejoin-window').getBoundingClientRect();return {visible:!document.querySelector('#prejoinOverlay').hidden,width:Math.round(w.width),pref:Boolean(document.querySelector('.ds-ref-prejoin-pref')),backgrounds:document.querySelector('#prejoinBackgrounds strong')?.textContent||''};})()`);
  if(!proof.screens.prejoin.visible||proof.screens.prejoin.width<500||!proof.screens.prejoin.pref)throw new Error(`Prejoin proof failed ${JSON.stringify(proof.screens.prejoin)}`);
  await screenshot('02-prejoin.png');

  // Common meeting fixture, intentionally synthetic.
  await evaluate(`(()=>{
    document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#appShell').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.classList.remove('share-active');
    document.querySelector('#roomTitle').textContent='QA Member’s Personal Meeting Room';document.querySelector('#roomRole').textContent='Host';
    const v=document.querySelector('#localMeetingVideo');v.hidden=true;const f=document.querySelector('#stageFallback');f.hidden=false;document.querySelector('#stageAvatar').textContent='QM';document.querySelector('#stageName').textContent='QA Member';
    window.DominionMeetingParity?.install?.();window.DominionApprovedReferenceParity?.sync?.();window.DominionRuntimeStability?.sync?.();window.DominionZoomScreenshotReference.sync();return true;
  })()`);await settle(300);

  // 03 MEETING.
  proof.screens.meeting=await evaluate(`(()=>({toolbar:[...document.querySelectorAll('#meetingOverlay .meeting-footer .ds-control-label')].map(n=>n.textContent.trim()),head:Boolean(document.querySelector('.ds-ref-meeting-head-icons')),footerHeight:Math.round(document.querySelector('.meeting-footer').getBoundingClientRect().height)}))()`);
  if(!proof.screens.meeting.head||proof.screens.meeting.footerHeight<50)throw new Error(`Meeting proof failed ${JSON.stringify(proof.screens.meeting)}`);
  await screenshot('03-meeting.png');

  // 04 PARTICIPANTS — one canonical media set only.
  await evaluate(`(()=>{
    const side=document.querySelector('.room-side');side.hidden=false;
    const roster=document.querySelector('#participantRoster');roster.innerHTML='<div class="person-row" data-participant-id="qa-host" data-participant-role="host" data-participant-name="QA Member" data-participant-self="1"><span class="person-badge">QM</span><span class="person-copy"><strong>QA Member <em class="participant-you">(Host, me)</em></strong><small>Host</small></span><span class="participant-media-state"><span class="participant-media-icon participant-mic off" data-participant-mic aria-label="Microphone muted">⌁</span><span class="participant-media-icon participant-video on" data-participant-video aria-label="Video on">▣</span></span><span class="participant-actions"><button type="button" class="participant-more" data-participant-more>•••</button></span></div>';
    window.DominionZoomScreenshotReference.sync();return true;
  })()`);await settle();
  proof.screens.participants=await evaluate(`(()=>{const row=document.querySelector('#participantRoster .person-row');return {visible:!document.querySelector('.room-side').hidden,canonical:[...row.querySelectorAll('.participant-media-state .participant-media-icon')].filter(n=>getComputedStyle(n).display!=='none').length,legacyVisible:[...row.querySelectorAll('.ds-participant-media')].some(n=>getComputedStyle(n).display!=='none'),footer:Boolean(document.querySelector('.ds-ref-participants-footer'))};})()`);
  if(!proof.screens.participants.visible||proof.screens.participants.canonical!==2||proof.screens.participants.legacyVisible||!proof.screens.participants.footer)throw new Error(`Participants proof failed ${JSON.stringify(proof.screens.participants)}`);
  await screenshot('04-participants.png');

  // 05 PARTICIPANTS MORE.
  await evaluate(`document.querySelector('.ds-ref-participants-footer [data-ref-participant-more]').click()`);await waitFor("document.querySelector('.ds-ref-participant-bulk-menu')",'Participants More popup');await settle();
  proof.screens.participantsMore=await evaluate(`(()=>({text:document.querySelector('.ds-ref-participant-bulk-menu')?.innerText||'',toggles:document.querySelectorAll('.ds-ref-participant-bulk-menu input').length}))()`);
  if(!/Ask all to unmute/.test(proof.screens.participantsMore.text)||proof.screens.participantsMore.toggles<2)throw new Error(`Participants More proof failed ${JSON.stringify(proof.screens.participantsMore)}`);
  await screenshot('05-participants-more.png');

  // 06 HOST TOOLS.
  await evaluate(`window.DominionZoomScreenshotReference.openHostToolsPanel()`);await waitFor("document.querySelector('.ds-ref-host-tools-panel')",'Host tools panel');await settle();
  proof.screens.hostTools=await evaluate(`(()=>({text:document.querySelector('.ds-ref-host-tools-panel')?.innerText||'',right:Math.round(innerWidth-document.querySelector('.ds-ref-host-tools-panel').getBoundingClientRect().right)}))()`);
  if(!/Lock meeting/.test(proof.screens.hostTools.text)||!/Enable waiting room/.test(proof.screens.hostTools.text)||!/Hide profile pictures/.test(proof.screens.hostTools.text))throw new Error(`Host tools proof failed ${JSON.stringify(proof.screens.hostTools)}`);
  await screenshot('06-host-tools.png');

  // 07 MORE.
  await evaluate(`document.querySelector('#roomMore').click()`);await waitFor("document.querySelector('.ds-ref-meeting-more-grid')",'Meeting More grid');await settle();
  proof.screens.more=await evaluate(`(()=>({text:document.querySelector('.ds-ref-meeting-more-grid')?.innerText||'',buttons:document.querySelectorAll('.ds-ref-meeting-more-items button').length}))()`);
  if(proof.screens.more.buttons<9||!/Record/.test(proof.screens.more.text)||!/Settings/.test(proof.screens.more.text))throw new Error(`More proof failed ${JSON.stringify(proof.screens.more)}`);
  await screenshot('07-more.png');

  // 08 PRE-SHARE — navigate to the packaged chooser itself. Do not use Apple picker.
  const shareUrl=await evaluate(`new URL('./share-picker.html',location.href).href`);await cdp('Page.navigate',{url:shareUrl});
  await waitFor("document.readyState==='complete'&&document.querySelector('#combinedGrid')&&document.querySelector('#shareButton')",'2.0.41 app-owned share picker');await settle(700);
  proof.screens.preshare=await evaluate(`(()=>({tabs:[...document.querySelectorAll('.source-tabs .tab')].map(n=>n.textContent.trim()),screenHeadings:[...document.querySelectorAll('.source-section>strong')].map(n=>n.textContent.trim()),cards:document.querySelectorAll('.source-card').length,presenter:Boolean(document.querySelector('.presenter-layout')),shareEnabled:!document.querySelector('#shareButton').disabled,apple:/Share This Window|Share All Application Windows|Share Entire Screen/.test(document.body.innerText||'')}))()`);
  if(proof.screens.preshare.apple||!proof.screens.preshare.presenter||!proof.screens.preshare.tabs.includes('Screens'))throw new Error(`Preshare proof failed ${JSON.stringify(proof.screens.preshare)}`);
  await screenshot('08-preshare.png');

  // Return to meeting page for active-share visual state. Functional capture is
  // certified separately; this fixture proves only packaged presenter geometry.
  const meetingUrl=await evaluate(`new URL('./index.html',location.href).href`);await cdp('Page.navigate',{url:meetingUrl});
  await waitFor("document.readyState==='complete'&&window.DominionZoomScreenshotReference&&document.querySelector('#meetingOverlay')",'meeting page after preshare proof');
  await evaluate(`(()=>{
    document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.classList.add('share-active');document.querySelector('#roomRole').textContent='Host';document.querySelector('#roomTitle').textContent='QA Member’s Personal Meeting Room';
    window.DominionMeetingParity?.install?.();window.DominionApprovedReferenceParity?.sync?.();window.DominionRuntimeStability?.sync?.();
    let toolbar=document.querySelector('#inlinePresenterToolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.id='inlinePresenterToolbar';toolbar.className='inline-presenter-toolbar';toolbar.innerHTML='<div class="inline-presenter-status"></div><div class="inline-presenter-actions"><button data-inline-command="audio">Audio</button><button data-inline-command="video">Video</button><button data-inline-command="participants">Participants</button><button data-inline-command="chat">Chat</button><button data-inline-command="pause">Pause</button><button data-inline-command="annotate">Annotate</button><button data-inline-command="new-share">Share</button><button class="stop" data-inline-command="stop">Stop Share</button></div>';overlay.append(toolbar);}
    window.DominionZoomScreenshotReference.sync();overlay.classList.add('ds-ref-presenter-visible');
    let dock=document.querySelector('#participantVideoDock');if(dock){dock.hidden=false;let body=dock.querySelector('.participant-video-dock-body')||dock;body.innerHTML='<div class="remote-peer-tile" data-peer-id="qa"><div class="remote-peer-fallback">QM</div><div class="remote-peer-name">QA Member</div></div>';}
    return true;
  })()`);await settle(300);
  proof.screens.activeShare=await evaluate(`(()=>({toolbarVisible:getComputedStyle(document.querySelector('#inlinePresenterToolbar')).opacity,banner:Boolean(document.querySelector('.ds-ref-share-banner:not([hidden])')),labels:[...document.querySelectorAll('#inlinePresenterToolbar button')].map(n=>n.textContent.trim()),dock:Boolean(document.querySelector('#participantVideoDock')&&!document.querySelector('#participantVideoDock').hidden)}))()`);
  if(Number(proof.screens.activeShare.toolbarVisible)<.9||!proof.screens.activeShare.banner||!proof.screens.activeShare.labels.includes('Layout'))throw new Error(`Active share proof failed ${JSON.stringify(proof.screens.activeShare)}`);
  await screenshot('09-active-share-toolbar.png');

  // 10 ACTIVE SHARE IDLE — toolbar must disappear when pointer is idle.
  await evaluate(`document.querySelector('#meetingOverlay').classList.remove('ds-ref-presenter-visible')`);await settle(180);
  proof.screens.activeShareIdle=await evaluate(`(()=>({opacity:getComputedStyle(document.querySelector('#inlinePresenterToolbar')).opacity,pointer:getComputedStyle(document.querySelector('#inlinePresenterToolbar')).pointerEvents,dock:Boolean(document.querySelector('#participantVideoDock')&&!document.querySelector('#participantVideoDock').hidden)}))()`);
  if(Number(proof.screens.activeShareIdle.opacity)>.1||proof.screens.activeShareIdle.pointer!=='none')throw new Error(`Active share idle proof failed ${JSON.stringify(proof.screens.activeShareIdle)}`);
  await screenshot('10-active-share-idle.png');

  fs.writeFileSync(path.join(outputDir,'visual-proof.json'),JSON.stringify(proof,null,2));
  console.log('DOMINIONSTAR_ZOOM_SCREENSHOT_REFERENCE_VISUAL_PROOF_CAPTURED',JSON.stringify(proof));
}catch(error){failure=error;}
finally{
  try{socket?.close();}catch{}
  try{child.kill('SIGTERM');}catch{}
  await sleep(300);if(child.exitCode===null){try{child.kill('SIGKILL');}catch{}}
}
if(failure)throw failure;
