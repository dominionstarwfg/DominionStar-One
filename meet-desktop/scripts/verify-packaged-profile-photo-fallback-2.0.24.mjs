import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-profile-photo-fallback-2.0.24.mjs <DominionStar Meet.app>');
const absoluteApp=path.resolve(appPath);
const executable=path.join(absoluteApp,'Contents','MacOS','DominionStar Meet');
const asarPath=path.join(absoluteApp,'Contents','Resources','app.asar');
const asarBin=path.resolve('node_modules/@electron/asar/bin/asar.js');
assert.ok(fs.existsSync(asarPath),'Packaged profile-photo verifier requires app.asar.');
const listing=execFileSync(process.execPath,[asarBin,'list',asarPath],{encoding:'utf8'});
assert.ok(listing.includes('/ui/profile-photo-fallback.js'),'Packaged ASAR is missing /ui/profile-photo-fallback.js.');
const auditDir=path.resolve('.profile-photo-package-audit');
fs.rmSync(auditDir,{recursive:true,force:true});
execFileSync(process.execPath,[asarBin,'extract',asarPath,auditDir]);
const packedHtml=fs.readFileSync(path.join(auditDir,'ui','index.html'),'utf8');
const packedModule=fs.readFileSync(path.join(auditDir,'ui','profile-photo-fallback.js'),'utf8');
assert.ok(packedHtml.includes('<script src="./profile-photo-fallback.js"></script>'),'Packaged index.html does not reference profile-photo-fallback.js.');
assert.ok(packedModule.includes('window.DominionProfilePhotoFallback=api'),'Packaged profile-photo module does not expose its API.');

const port=11080+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function targets(){const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(900)});return response.json();}
async function waitTarget(predicate,label,timeout=15000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);try{const match=(await targets()).find(predicate);if(match?.webSocketDebuggerUrl)return match;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.\n${stderr}`);}
class Cdp{
  constructor(url){this.url=url;this.socket=null;this.nextId=0;this.pending=new Map();}
  async connect(){this.socket=await new Promise((resolve,reject)=>{const socket=new WebSocket(this.url),timer=setTimeout(()=>reject(new Error('CDP connect timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connect failed'));},{once:true});});this.socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=this.pending.get(message.id);if(!waiter)return;this.pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});await this.call('Runtime.enable');}
  call(method,params={},timeout=5000){return new Promise((resolve,reject)=>{const id=++this.nextId,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async eval(expression,timeout=5000){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');return result.result?.value;}
  async wait(expression,label,timeout=9000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,2200))return;}catch{}await sleep(100);}throw new Error(`Timed out waiting for ${label}.`);}
  close(){try{this.socket?.close();}catch{}}
}

let main=null;
try{
  const target=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('/ui/index.html'),'main renderer');
  main=new Cdp(target.webSocketDebuggerUrl);await main.connect();
  await main.wait("document.readyState==='complete'",'main document');
  const startup=await main.eval(`(()=>({
    api:Boolean(window.DominionProfilePhotoFallback?.applyForTesting),
    desktop:Boolean(window.dominionDesktop?.isDesktop),
    script:[...document.scripts].map(node=>node.getAttribute('src')||'').find(src=>src.includes('profile-photo-fallback.js'))||'',
    resource:performance.getEntriesByType('resource').map(entry=>entry.name).find(name=>name.includes('profile-photo-fallback.js'))||''
  }))()`);
  if(!startup.api){
    const manual=await main.eval(`(()=>{try{(0,eval)(${JSON.stringify(packedModule)});return {api:Boolean(window.DominionProfilePhotoFallback?.applyForTesting),error:''};}catch(error){return {api:false,error:String(error?.stack||error?.message||error)}}})()`);
    throw new Error(`Profile-photo module did not initialize from packaged index. startup=${JSON.stringify(startup)} manual=${JSON.stringify(manual)}`);
  }

  const photoUrl='https://10.255.255.1/dominionstar-avatar.png';
  const photoState=await main.eval(`(()=>{
    document.querySelector('#qaProfilePhotoFixture')?.remove();
    const fixture=document.createElement('section');fixture.id='qaProfilePhotoFixture';fixture.innerHTML='\
      <div id="qaLocalDock"><article id="localVideoDockTile" class="remote-peer-tile local-video-dock-tile"><div class="remote-peer-fallback"><span>YOU</span></div></article></div>\
      <article class="remote-peer-tile" data-peer-id="peer-photo"><div class="remote-peer-fallback"><span>RP</span></div></article>\
      <div class="person-row" data-participant-id="peer-photo"><span class="person-badge">RP</span></div>\
      <div class="queue-card" data-wait="wait-photo"><span class="person-badge">WP</span></div>';
    document.body.append(fixture);
    const prejoin=document.querySelector('#prejoinAvatar')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'prejoinAvatar',className:'preview-avatar'}));
    const stage=document.querySelector('#stageAvatar')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'stageAvatar',className:'stage-avatar'}));
    window.DominionProfilePhotoFallback.applyForTesting({
      user:{name:'Local Member',avatarUrl:${JSON.stringify(photoUrl)}},
      participants:[{participantId:'peer-photo',displayName:'Remote Person',avatarUrl:${JSON.stringify(photoUrl)}}],
      waiting:[{participantId:'wait-photo',displayName:'Waiting Person',avatarUrl:${JSON.stringify(photoUrl)}}]
    });
    const localDock=document.querySelector('#localVideoDockTile .remote-peer-fallback');
    const remote=document.querySelector('[data-peer-id="peer-photo"] .remote-peer-fallback');
    const roster=document.querySelector('[data-participant-id="peer-photo"] .person-badge');
    const waiting=document.querySelector('[data-wait="wait-photo"] .person-badge');
    return {
      prejoin:Boolean(prejoin.querySelector('img.ds-profile-fallback-photo')&&prejoin.classList.contains('has-photo')),
      stage:Boolean(stage.querySelector('img.ds-profile-fallback-photo')&&stage.classList.contains('has-photo')),
      localDock:Boolean(localDock?.querySelector('img.ds-profile-fallback-photo')&&localDock.classList.contains('has-photo')&&localDock.querySelector('span')?.hidden),
      remote:Boolean(remote?.querySelector('img.ds-profile-fallback-photo')&&remote.classList.contains('has-photo')&&remote.querySelector('span')?.hidden),
      roster:Boolean(roster?.querySelector('img.ds-profile-fallback-photo')&&roster.classList.contains('has-photo')),
      waiting:Boolean(waiting?.querySelector('img.ds-profile-fallback-photo')&&waiting.classList.contains('has-photo')),
      remoteSrc:remote?.querySelector('img.ds-profile-fallback-photo')?.src||''
    };
  })()`);
  for(const key of ['prejoin','stage','localDock','remote','roster','waiting'])assert.equal(photoState[key],true,`${key} must render a camera-off profile photo.`);
  assert.equal(photoState.remoteSrc,photoUrl,'Remote fallback must use the signed HTTPS photo URL verbatim.');

  const initialsState=await main.eval(`(()=>{
    window.DominionProfilePhotoFallback.applyForTesting({
      user:{name:'Local Member',avatarUrl:''},
      participants:[{participantId:'peer-photo',displayName:'Remote Person',avatarUrl:''}],
      waiting:[{participantId:'wait-photo',displayName:'Waiting Person',avatarUrl:''}]
    });
    const remote=document.querySelector('[data-peer-id="peer-photo"] .remote-peer-fallback');
    const roster=document.querySelector('[data-participant-id="peer-photo"] .person-badge');
    const waiting=document.querySelector('[data-wait="wait-photo"] .person-badge');
    return {
      prejoin:document.querySelector('#prejoinAvatar')?.textContent?.trim(),
      stage:document.querySelector('#stageAvatar')?.textContent?.trim(),
      remote:remote?.querySelector('span')?.textContent?.trim(),
      remotePhoto:Boolean(remote?.querySelector('img.ds-profile-fallback-photo')),
      roster:roster?.textContent?.trim(),
      waiting:waiting?.textContent?.trim()
    };
  })()`);
  assert.deepEqual(initialsState,{prejoin:'LM',stage:'LM',remote:'RP',remotePhoto:false,roster:'RP',waiting:'WP'});

  const brokenState=await main.eval(`(()=>{
    const url=${JSON.stringify(photoUrl)};
    window.DominionProfilePhotoFallback.applyForTesting({participants:[{participantId:'peer-photo',displayName:'Remote Person',avatarUrl:url}]});
    const fallback=document.querySelector('[data-peer-id="peer-photo"] .remote-peer-fallback');
    const img=fallback.querySelector('img.ds-profile-fallback-photo');img.dispatchEvent(new Event('error'));
    return {hasPhoto:fallback.classList.contains('has-photo'),imageHidden:img.hidden,initials:fallback.querySelector('span')?.textContent?.trim(),initialsHidden:fallback.querySelector('span')?.hidden};
  })()`);
  assert.deepEqual(brokenState,{hasPhoto:false,imageHidden:true,initials:'RP',initialsHidden:false});

  assert.doesNotMatch(stderr,/Uncaught\s+(?:TypeError|ReferenceError|SyntaxError)/i,'Packaged profile-photo fallback produced an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_PROFILE_PHOTO_2_0_24_OK asar-module packaged-index executed-module local-prejoin local-stage local-dock remote-tile roster waiting-room photo-first no-photo-initials broken-photo-initials no-renderer-errors');
}catch(error){console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());process.exitCode=1;}finally{main?.close();if(child.exitCode===null)child.kill('SIGTERM');await sleep(500);if(child.exitCode===null)child.kill('SIGKILL');fs.rmSync(auditDir,{recursive:true,force:true});}
