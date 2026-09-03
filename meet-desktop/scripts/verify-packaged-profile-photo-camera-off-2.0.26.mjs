import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-profile-photo-camera-off-2.0.26.mjs <DominionStar Meet.app>');
const absoluteApp=path.resolve(appPath);
const executable=path.join(absoluteApp,'Contents','MacOS','DominionStar Meet');
const asarPath=path.join(absoluteApp,'Contents','Resources','app.asar');
const asarBin=path.resolve('node_modules/@electron/asar/bin/asar.js');
assert.ok(fs.existsSync(asarPath),'Packaged 2.0.26 identity verifier requires app.asar.');
const listing=execFileSync(process.execPath,[asarBin,'list',asarPath],{encoding:'utf8'});
assert.ok(listing.includes('/ui/profile-photo-fallback.js'),'Packaged ASAR is missing profile-photo-fallback.js.');
assert.ok(listing.includes('/scripts/verify-profile-photo-camera-off-2.0.26.mjs'),'Packaged ASAR is missing the 2.0.26 source gate.');

const auditDir=path.resolve('.profile-photo-camera-off-2.0.26-audit');
fs.rmSync(auditDir,{recursive:true,force:true});
execFileSync(process.execPath,[asarBin,'extract',asarPath,auditDir]);
const packedModule=fs.readFileSync(path.join(auditDir,'ui','profile-photo-fallback.js'),'utf8');
assert.ok(packedModule.includes('function syncLocalGalleryIdentity()'),'Packaged app is missing local camera-off identity correction.');
assert.ok(packedModule.includes("if(sharing||!['gallery','multi'].includes(mode))return;"),'Packaged identity correction must stay out of the share path.');

const port=11400+Math.floor(Math.random()*160);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{
  env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},
  stdio:['ignore','ignore','pipe']
});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before 2.0.26 identity QA attached.\n${stderr}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(800)});
      if(response.ok){
        const items=await response.json();
        const page=items.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://')&&String(item.url||'').includes('/ui/index.html'));
        if(page?.webSocketDebuggerUrl)return page;
      }
    }catch{}
    await sleep(120);
  }
  throw new Error(`Unable to attach to packaged 2.0.26 identity renderer.\n${stderr}`);
}

function connect(url){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url);
    const timer=setTimeout(()=>reject(new Error('2.0.26 identity CDP connection timeout.')),5000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('2.0.26 identity CDP connection failed.'));},{once:true});
  });
}

let socket=null,nextId=0;
const pending=new Map();
function cdp(method,params={},timeout=5000){
  return new Promise((resolve,reject)=>{
    const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression,timeout=5000){
  const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');
  return result.result?.value;
}
async function waitFor(expression,label,timeout=16000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`,2500))return;}catch{}await sleep(100);}
  throw new Error(`Timed out waiting for ${label}.`);
}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("window.DominionProfilePhotoFallback?.syncLocalGalleryIdentity&&window.DominionMeetingParity?.applyViewMode&&window.DominionPreferences?.write&&document.querySelector('#meetingOverlay')",'camera-off identity authorities');

  const photoUrl='https://10.255.255.1/dominionstar-local-avatar.png';
  const gallery=await evaluate(`(()=>{
    const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;overlay.classList.remove('share-active');document.body.classList.remove('remote-share-active');
    window.DominionPreferences.write('hideSelfView',false);
    window.DominionMeetingParity.install();window.DominionMeetingParity.applyViewMode('gallery');
    window.DominionProfilePhotoFallback.applyForTesting({user:{name:'Local Member',avatarUrl:${JSON.stringify(photoUrl)}}});
    window.DominionProfilePhotoFallback.syncLocalGalleryIdentity();
    const tile=document.querySelector('#localVideoDockTile'),dock=document.querySelector('#participantVideoDock'),video=tile?.querySelector('video'),fallback=tile?.querySelector('.remote-peer-fallback');
    return {mode:overlay.dataset.viewMode,tileHidden:tile?.hidden,dockHidden:dock?.hidden,videoHidden:video?.hidden,fallbackHidden:fallback?.hidden,photo:Boolean(fallback?.querySelector('img.ds-profile-fallback-photo')),initialsHidden:fallback?.querySelector('span')?.hidden,count:Number(dock?.dataset.count||0),orientation:dock?.dataset.orientation||''};
  })()`);
  assert.equal(gallery.mode,'gallery','QA must be in Gallery view.');
  assert.equal(gallery.tileHidden,false,'Camera-off local participant tile must remain visible in Gallery.');
  assert.equal(gallery.dockHidden,false,'Camera-off local participant must keep the Gallery dock visible.');
  assert.equal(gallery.videoHidden,true,'Camera-off local tile must not paint stale video.');
  assert.equal(gallery.fallbackHidden,false,'Camera-off local fallback must be visible.');
  assert.equal(gallery.photo,true,'Camera-off local fallback must render the profile photo when available.');
  assert.equal(gallery.initialsHidden,true,'Profile photo must take precedence over initials.');
  assert.ok(gallery.count>=1,'Dock count must include the restored local camera-off tile.');
  assert.equal(gallery.orientation,'grid','Gallery identity correction must preserve grid orientation.');

  // Simulate the exact regression: a later layout pass hides both tile and dock.
  // The narrow hidden-attribute observer must restore identity on its bounded task.
  await evaluate(`(()=>{const tile=document.querySelector('#localVideoDockTile'),dock=document.querySelector('#participantVideoDock');tile.hidden=true;dock.hidden=true;return true;})()`);
  await sleep(120);
  const recovered=await evaluate(`(()=>{const tile=document.querySelector('#localVideoDockTile'),dock=document.querySelector('#participantVideoDock'),fallback=tile?.querySelector('.remote-peer-fallback');return {tileHidden:tile?.hidden,dockHidden:dock?.hidden,fallbackHidden:fallback?.hidden};})()`);
  assert.deepEqual(recovered,{tileHidden:false,dockHidden:false,fallbackHidden:false},'Post-layout camera-off identity must recover after a later hidden-state mutation.');

  const multi=await evaluate(`(()=>{window.DominionMeetingParity.applyViewMode('multi');window.DominionProfilePhotoFallback.syncLocalGalleryIdentity();const tile=document.querySelector('#localVideoDockTile'),fallback=tile?.querySelector('.remote-peer-fallback');return {mode:document.querySelector('#meetingOverlay').dataset.viewMode,tileHidden:tile?.hidden,fallbackHidden:fallback?.hidden};})()`);
  assert.deepEqual(multi,{mode:'multi',tileHidden:false,fallbackHidden:false},'Multi-speaker must retain the same camera-off local identity behavior.');

  const initials=await evaluate(`(()=>{window.DominionProfilePhotoFallback.applyForTesting({user:{name:'Local Member',avatarUrl:''}});window.DominionProfilePhotoFallback.syncLocalGalleryIdentity();const fallback=document.querySelector('#localVideoDockTile .remote-peer-fallback');return {photo:Boolean(fallback?.querySelector('img.ds-profile-fallback-photo')),text:fallback?.querySelector('span')?.textContent?.trim(),hidden:fallback?.querySelector('span')?.hidden};})()`);
  assert.deepEqual(initials,{photo:false,text:'LM',hidden:false},'No-photo local camera-off tile must fall back to initials.');

  const hideSelf=await evaluate(`(()=>{window.DominionPreferences.write('hideSelfView',true);window.DominionProfilePhotoFallback.syncLocalGalleryIdentity();return document.querySelector('#localVideoDockTile').hidden;})()`);
  assert.equal(hideSelf,true,'Hide Self View must remain authoritative over profile-photo display.');

  const shareGuard=await evaluate(`(()=>{window.DominionPreferences.write('hideSelfView',false);const overlay=document.querySelector('#meetingOverlay'),tile=document.querySelector('#localVideoDockTile');overlay.classList.add('share-active');tile.hidden=true;window.DominionProfilePhotoFallback.syncLocalGalleryIdentity();const hidden=tile.hidden;overlay.classList.remove('share-active');return hidden;})()`);
  assert.equal(shareGuard,true,'2.0.26 profile identity correction must never mutate the active share layout.');

  assert.doesNotMatch(stderr,/Uncaught\s+(?:RangeError|TypeError|ReferenceError|SyntaxError)/i,'Packaged 2.0.26 identity flow produced an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_PROFILE_PHOTO_CAMERA_OFF_2_0_26_OK gallery-visible multi-visible photo-first initials-fallback post-layout-recovery hide-self-authoritative share-guarded');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}
finally{
  for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('2.0.26 identity verifier shutdown'));}pending.clear();
  try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}
  fs.rmSync(auditDir,{recursive:true,force:true});
}
process.exit(failure?1:0);
