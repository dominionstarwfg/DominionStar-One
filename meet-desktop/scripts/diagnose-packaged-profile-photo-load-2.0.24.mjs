import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node diagnose-packaged-profile-photo-load-2.0.24.mjs <DominionStar Meet.app>');
const absoluteApp=path.resolve(appPath);
const executable=path.join(absoluteApp,'Contents','MacOS','DominionStar Meet');
const asarPath=path.join(absoluteApp,'Contents','Resources','app.asar');
const asarBin=path.resolve('node_modules/@electron/asar/bin/asar.js');
const auditDir=path.resolve('.profile-photo-load-diagnostic');
fs.rmSync(auditDir,{recursive:true,force:true});
execFileSync(process.execPath,[asarBin,'extract',asarPath,auditDir]);
const packedModule=fs.readFileSync(path.join(auditDir,'ui','profile-photo-fallback.js'),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=11400+Math.floor(Math.random()*140);
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function findTarget(){
  const deadline=Date.now()+18000;
  while(Date.now()<deadline){
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(800)});
      if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').includes('/ui/index.html'));if(page?.webSocketDebuggerUrl)return page;}
    }catch{}
    await sleep(120);
  }
  throw new Error(`No packaged main renderer target.\n${stderr}`);
}

let socket=null,nextId=0;const pending=new Map();
function call(method,params={},timeout=5000){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression,timeout=5000){const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}

try{
  const target=await findTarget();
  socket=await new Promise((resolve,reject)=>{const ws=new WebSocket(target.webSocketDebuggerUrl),timer=setTimeout(()=>reject(new Error('Diagnostic CDP connect timeout')),5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve(ws);},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Diagnostic CDP connect failed'));},{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await call('Runtime.enable');
  await sleep(1800);

  let snapshot;
  try{
    snapshot=await evaluate(`(()=>({
      href:location.href,
      readyState:document.readyState,
      body:Boolean(document.body),
      api:Boolean(window.DominionProfilePhotoFallback),
      app:Boolean(window.dominionDesktop?.isDesktop),
      scripts:[...document.scripts].map(node=>node.getAttribute('src')||''),
      resources:performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>/profile-photo|schedule-controller|personal-room|preferences/.test(name)),
      lastScripts:[...document.scripts].slice(-5).map(node=>node.getAttribute('src')||''),
      globals:{schedule:Boolean(window.DominionScheduleController),personal:Boolean(window.DominionPersonalRoom),preferences:Boolean(window.DominionPreferences)}
    }))()`,8000);
  }catch(error){
    throw new Error(`Renderer diagnostic evaluation failed: ${error.message}\n${stderr}`);
  }

  let manual={attempted:false,api:false,error:''};
  if(!snapshot.api){
    manual=await evaluate(`(()=>{try{(0,eval)(${JSON.stringify(packedModule)});return {attempted:true,api:Boolean(window.DominionProfilePhotoFallback),error:''};}catch(error){return {attempted:true,api:Boolean(window.DominionProfilePhotoFallback),error:String(error?.stack||error?.message||error)}}})()`,10000);
  }
  console.error(`PROFILE_PHOTO_LOAD_DIAGNOSTIC ${JSON.stringify({snapshot,manual})}`);
  if(!snapshot.api)throw new Error('Packaged profile-photo module did not initialize automatically.');
  console.log('DOMINIONSTAR_PACKAGED_PROFILE_PHOTO_LOAD_OK');
}catch(error){console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());process.exitCode=1;}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('diagnostic shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}fs.rmSync(auditDir,{recursive:true,force:true});}
