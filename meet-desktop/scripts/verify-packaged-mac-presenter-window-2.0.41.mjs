import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
const proofPath=process.argv[3]?path.resolve(process.argv[3]):'';
if(!appPath)throw new Error('Usage: node verify-packaged-mac-presenter-window-2.0.41.mjs <DominionStar Meet.app> [toolbar-proof.png]');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=12140+Math.floor(Math.random()*120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1',DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});
const count=needle=>stderr.split(String(needle)).length-1;
async function waitLog(needle,label,timeout=9000,minCount=1){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`App exited before ${label}.\n${stderr}`);if(count(needle)>=minCount)return;await sleep(60);}throw new Error(`Timed out waiting for ${label}: ${needle}\n${stderr}`);}
async function target(predicate,label,timeout=15000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`App exited before ${label}.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(800)});if(response.ok){const targets=await response.json();const found=targets.find(item=>item.type==='page'&&predicate(String(item.url||''))&&item.webSocketDebuggerUrl);if(found)return found;}}catch{}await sleep(100);}throw new Error(`Timed out waiting for ${label}.\n${stderr}`);}
class Cdp{constructor(url){this.url=url;this.socket=null;this.next=0;this.pending=new Map();}async connect(){this.socket=await new Promise((resolve,reject)=>{const socket=new WebSocket(this.url),timer=setTimeout(()=>reject(new Error('CDP connect timeout')),4000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connect failed'));},{once:true});});this.socket.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(!msg.id)return;const waiter=this.pending.get(msg.id);if(!waiter)return;this.pending.delete(msg.id);clearTimeout(waiter.timer);msg.error?waiter.reject(new Error(msg.error.message||'CDP error')):waiter.resolve(msg.result);});await this.call('Runtime.enable');await this.call('Page.enable');}call(method,params={},timeout=7000){return new Promise((resolve,reject)=>{const id=++this.next,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}async eval(expression,timeout=7000){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');return result.result?.value;}async wait(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,2500))return;}catch{}await sleep(80);}throw new Error(`Timed out waiting for ${label}.`);}async screenshot(file){const result=await this.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(result.data,'base64'));}close(){try{this.socket?.close();}catch{}}}

let main=null,toolbar=null,video=null,failure=null;
try{
  const mainTarget=await target(url=>url.startsWith('file://')&&url.includes('/ui/index.html'),'meeting renderer');main=new Cdp(mainTarget.webSocketDebuggerUrl);await main.connect();
  await main.wait("document.readyState==='complete'&&window.DominionShareController&&window.DominionShareIntegration&&window.__DominionPresenterDispatch&&window.dominionDesktop?.macShare?.prepare",'share/presenter controllers');
  const armed=await main.eval(`(()=>{
    document.querySelector('#bootScreen').hidden=true;document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').hidden=true;document.querySelector('#prejoinOverlay').hidden=true;document.querySelector('#waitingOverlay').hidden=true;const overlay=document.querySelector('#meetingOverlay');overlay.hidden=false;const role=document.querySelector('#roomRole');if(role)role.textContent='Host';window.DominionMeetingParity?.install?.();window.DominionMeetingFeatures?.toggleChat?.(false);window.DominionRuntimeStability?.sync?.();
    window.addEventListener('dominion:presenter-command-dispatch',event=>console.error('QA_MAC_NATIVE_COMMAND '+String(event.detail?.command||'')));
    window.__qaNativeCompanion='';new MutationObserver(()=>{const kind=String(document.body.dataset.dsShareCompanion||'none');if(kind!==window.__qaNativeCompanion){window.__qaNativeCompanion=kind;console.error('QA_MAC_NATIVE_COMPANION '+kind);}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-ds-share-companion','hidden']});
    console.error('QA_MAC_NATIVE_RENDERER_READY');return true;
  })()`,4000);assert.equal(armed,true,'Native presenter transport fixture was not armed.');
  const prepared=await main.eval(`window.dominionDesktop.macShare.prepare()`,12000);assert.equal(prepared?.ok,true,'Native macOS presenter surfaces did not prepare.');
  toolbar=new Cdp((await target(url=>url.includes('mac-presenter-toolbar.html'),'floating presenter toolbar')).webSocketDebuggerUrl);await toolbar.connect();await toolbar.wait("document.readyState==='complete'&&document.querySelector('#stopShare')&&window.DominionMacPresenterToolbar?.transport==='macShare-ack'",'acknowledged native presenter bridge');
  video=new Cdp((await target(url=>url.includes('mac-share-video.html'),'floating participant video dock')).webSocketDebuggerUrl);await video.connect();await video.wait("document.readyState==='complete'&&document.querySelector('#dock')",'floating participant video dock');
  const surface=await toolbar.eval(`(()=>({brand:document.querySelector('.brand span')?.textContent||'',stop:document.querySelector('#stopShare')?.textContent||'',transport:window.DominionMacPresenterToolbar?.transport||'',commands:[...document.querySelectorAll('[data-command]')].map(n=>n.dataset.command)}))()`);assert.equal(surface.brand,'DominionStar');assert.match(surface.stop,/Stop share/i);assert.equal(surface.transport,'macShare-ack');for(const command of ['participants','chat','pause','annotate','show-meeting'])assert.ok(surface.commands.includes(command),`Missing ${command} on native toolbar.`);if(proofPath)await toolbar.screenshot(proofPath);
  main.close();main=null;
  await waitLog('QA_MAC_NATIVE_RENDERER_READY','native renderer command fixture');

  await toolbar.eval(`document.querySelector('[data-command="pause"]').click()`);await waitLog('QA_MAC_NATIVE_COMMAND pause','Pause native delivery');await waitLog('command=pause accepted=1','Pause native acknowledgement');
  await toolbar.eval(`document.querySelector('[data-command="participants"]').click()`);await waitLog('QA_MAC_NATIVE_COMMAND participants','Participants native delivery');await waitLog('command=participants accepted=1','Participants native acknowledgement');await waitLog('QA_MAC_NATIVE_COMPANION participants','Participants companion');
  await toolbar.eval(`document.querySelector('[data-command="chat"]').click()`);await waitLog('QA_MAC_NATIVE_COMMAND chat','Chat native delivery');await waitLog('command=chat accepted=1','Chat native acknowledgement');await waitLog('QA_MAC_NATIVE_COMPANION chat','Chat companion');
  await toolbar.eval(`document.querySelector('#stopShare').click()`);await waitLog('QA_MAC_NATIVE_COMMAND stop','Stop Share native delivery');await waitLog('command=stop accepted=1','Stop Share native acknowledgement');

  console.log('DOMINIONSTAR_PACKAGED_MAC_PRESENTER_WINDOW_2_0_41_OK native-toolbar native-video-dock macShare-ack native-command-delivery pause participants chat stop active-share-behavior-certified-by-step19 physical-visible-tcc-required');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}
finally{video?.close();toolbar?.close();main?.close();if(child.exitCode===null){try{child.kill('SIGTERM');}catch{}await sleep(300);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}}
if(failure)throw failure;
