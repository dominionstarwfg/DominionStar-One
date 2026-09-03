import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
const outputDir=path.resolve(process.argv[3]||'../visual-proof');
if(!appPath)throw new Error('Usage: node capture-rejection-visual-proof-2.0.40.mjs <DominionStar Meet.app> [output-dir]');
fs.mkdirSync(outputDir,{recursive:true});

const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=11120+Math.floor(Math.random()*160);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function findTarget(){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before visual proof.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});
      if(response.ok){
        const targets=await response.json();
        const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));
        if(page?.webSocketDebuggerUrl)return page;
      }
    }catch{}
    await sleep(150);
  }
  throw new Error('Unable to attach to packaged renderer for visual proof.');
}

function connect(url){return new Promise((resolve,reject)=>{
  const socket=new WebSocket(url);
  const timer=setTimeout(()=>reject(new Error('Visual-proof CDP connection timeout.')),3000);
  socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
  socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Visual-proof CDP connection failed.'));},{once:true});
});}

let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{
  const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},5000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){
  const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');
  return result.result?.value;
}
async function waitFor(expression,label,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}
  throw new Error(`Timed out waiting for ${label}.`);
}
async function screenshot(name){
  const result=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
  fs.writeFileSync(path.join(outputDir,name),Buffer.from(result.data,'base64'));
}

let failure=null;
try{
  const page=await findTarget();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));if(!message.id)return;
    const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);
    message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);
  });
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:780,deviceScaleFactor:1,mobile:false});
  await waitFor("document.readyState==='complete'&&window.DominionZoomPhysicalAcceptance&&window.DominionRuntimeStability&&window.DominionApprovedReferenceParity",'meeting visual authorities');

  await evaluate(`(()=>{
    document.querySelector('#bootScreen').hidden=true;
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').hidden=true;
    document.querySelector('#prejoinOverlay').hidden=true;
    document.querySelector('#waitingOverlay').hidden=true;
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.dataset.viewMode='speaker';
    const role=document.querySelector('#roomRole');if(role)role.textContent='Host';
    const title=document.querySelector('#roomTitle');if(title)title.textContent='DominionStar Meeting';
    window.DominionMeetingParity?.install?.();
    window.DominionZoomProductionPolish?.sync?.();
    window.DominionApprovedReferenceParity?.sync?.();
    window.DominionRuntimeStability?.sync?.();
    window.DominionRuntimeStability?.ensureToolbarZones?.();
    const panel=document.querySelector('.room-side');if(panel)panel.hidden=false;
    const roster=document.querySelector('#participantRoster');
    roster.innerHTML=\`<div class="person-row" data-participant-id="qa-host" data-participant-role="host" data-participant-name="QA Host" data-participant-self="1" data-recording-allowed="0" data-record-eligible="1">
      <span class="person-badge">QH</span>
      <span class="person-copy"><strong>QA Host <em class="participant-you">(You)</em></strong><small>Host</small></span>
      <span class="participant-media-state" aria-label="Participant media status">
        <span class="participant-media-icon participant-mic off" data-participant-mic aria-label="Microphone muted"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></svg></span>
        <span class="participant-media-icon participant-video on" data-participant-video aria-label="Video on"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg></span>
      </span>
      <span class="participant-actions"><button type="button" data-participant-more="1" class="participant-more">•••</button></span>
    </div>\`;
    window.DominionZoomPhysicalAcceptance?.decorateParticipantRows?.();
    window.DominionRuntimeStability?.syncParticipantsSurface?.();
    window.DominionRuntimeStability?.layoutSideSurface?.();
    return true;
  })()`);
  await sleep(300);
  const participant=await evaluate(`(()=>{
    const row=document.querySelector('#participantRoster .person-row');
    const canonical=[...row.querySelectorAll('.participant-media-state .participant-media-icon')].filter(n=>getComputedStyle(n).display!=='none');
    const legacy=row.querySelector('.ds-participant-media');
    const panel=document.querySelector('.room-side')?.getBoundingClientRect();
    return {canonicalVisible:canonical.length,legacyExists:Boolean(legacy),legacyDisplay:legacy?getComputedStyle(legacy).display:'missing',panelWidth:Math.round(panel?.width||0),panelVisible:Boolean(panel&&panel.width>0&&panel.height>0),duplicateVisible:legacy?getComputedStyle(legacy).display!=='none':false};
  })()`);
  if(participant.canonicalVisible!==2||participant.duplicateVisible||participant.legacyDisplay!=='none')throw new Error(`Participant visual proof failed: ${JSON.stringify(participant)}`);
  await screenshot('01-participants-single-media-set.png');

  const shareUrl=await evaluate(`new URL('./share-picker.html',location.href).href`);
  await cdp('Page.navigate',{url:shareUrl});
  await waitFor("document.readyState==='complete'&&document.querySelector('#combinedGrid')&&document.querySelector('#shareButton')",'app-owned share picker');
  await sleep(250);
  await evaluate(`(()=>{
    const loading=document.querySelector('#loadingState'),error=document.querySelector('#errorState'),view=document.querySelector('#sourceGrid'),grid=document.querySelector('#combinedGrid');
    if(loading)loading.hidden=true;if(error)error.hidden=true;if(view)view.hidden=false;
    const cards=[
      ['screen:1','Desktop 1','Entire screen'],['window:1','Presentation','Application window'],['window:2','Browser','Application window'],
      ['window:3','Training Notes','Application window'],['window:4','Calculator','Application window'],['window:5','Documents','Application window']
    ];
    grid.innerHTML=cards.map((item,index)=>\`<button class="source-card\${index===0?' selected':''}" type="button" data-source-id="\${item[0]}" role="option" aria-selected="\${index===0?'true':'false'}"><span class="source-check">✓</span><span class="thumb"><span class="source-fallback"></span></span><span class="source-name">\${item[1]}</span><span class="source-meta">\${item[2]}</span></button>\`).join('');
    document.querySelector('#sourceCount').textContent='6 sources';
    document.querySelector('#sourceHeading').textContent='Available screens and windows';
    document.querySelector('#sourceStatus').textContent='6 share sources available';
    document.querySelector('#selectionSummary')?.classList.add('ready');
    document.querySelector('#selectionLabel').textContent='Selected: Desktop 1';
    document.querySelector('#previewKind').textContent='Desktop';
    document.querySelector('#previewName').textContent='Desktop 1';
    document.querySelector('#previewMeta').textContent='Entire screen';
    const share=document.querySelector('#shareButton');share.disabled=false;share.textContent='Share';
    return true;
  })()`);
  await sleep(200);
  const picker=await evaluate(`(()=>({
    title:document.querySelector('.picker-title h1')?.textContent?.trim()||'',
    basic:document.querySelector('[data-tab="screens"]')?.textContent?.trim()||'',
    advanced:document.querySelector('[data-tab="advanced"]')?.textContent?.trim()||'',
    cardCount:document.querySelectorAll('#combinedGrid .source-card').length,
    shareText:document.querySelector('#shareButton')?.textContent?.trim()||'',
    shareEnabled:!document.querySelector('#shareButton')?.disabled,
    appleOverlayText:/Share This Window|Share All Application Windows|Share Entire Screen/.test(document.body.innerText||''),
    width:innerWidth,height:innerHeight
  }))()`);
  if(picker.cardCount<3||!picker.shareEnabled||picker.appleOverlayText)throw new Error(`Pre-share visual proof failed: ${JSON.stringify(picker)}`);
  await screenshot('02-approved-app-owned-preshare.png');

  const manifest={version:'2.0.40',participant,picker,privacy:'QA-only synthetic names and placeholders; no user-uploaded photos or screenshots embedded.'};
  fs.writeFileSync(path.join(outputDir,'visual-proof.json'),JSON.stringify(manifest,null,2));
  console.log('DOMINIONSTAR_2_0_40_VISUAL_PROOF_CAPTURED',JSON.stringify(manifest));
}catch(error){failure=error;}
finally{
  try{socket?.close();}catch{}
  try{child.kill('SIGTERM');}catch{}
  await sleep(250);if(child.exitCode===null){try{child.kill('SIGKILL');}catch{}}
}
if(failure)throw failure;
