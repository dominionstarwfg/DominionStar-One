import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-share-picker-2.0.23.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10980+Math.floor(Math.random()*100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function targets(){
  const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(900)});
  return response.json();
}
async function waitTarget(predicate,label,timeout=15000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Packaged app exited before ${label}.\n${stderr}`);
    try{const match=(await targets()).find(predicate);if(match?.webSocketDebuggerUrl)return match;}catch{}
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${label}.\n${stderr}`);
}
class Cdp{
  constructor(url){this.url=url;this.socket=null;this.nextId=0;this.pending=new Map();}
  async connect(){
    this.socket=await new Promise((resolve,reject)=>{
      const socket=new WebSocket(this.url),timer=setTimeout(()=>reject(new Error('CDP connect timeout')),5000);
      socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});
      socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connect failed'));},{once:true});
    });
    this.socket.addEventListener('message',event=>{
      const message=JSON.parse(String(event.data));if(!message.id)return;
      const waiter=this.pending.get(message.id);if(!waiter)return;
      this.pending.delete(message.id);clearTimeout(waiter.timer);
      message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);
    });
    await this.call('Runtime.enable');
  }
  call(method,params={},timeout=5000){return new Promise((resolve,reject)=>{const id=++this.nextId,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},timeout);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async eval(expression,timeout=5000){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed');return result.result?.value;}
  async wait(expression,label,timeout=9000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await this.eval(`Boolean(${expression})`,2200))return;}catch{}await sleep(100);}throw new Error(`Timed out waiting for ${label}.`);}
  close(){try{this.socket?.close();}catch{}}
}

let main=null,picker=null;
try{
  const mainTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('/ui/index.html'),'main renderer');
  main=new Cdp(mainTarget.webSocketDebuggerUrl);await main.connect();
  await main.wait("document.readyState==='complete'&&window.dominionDesktop?.share?.openPicker",'desktop share bridge');
  const openResult=await main.eval(`window.dominionDesktop.share.openPicker('granted')`,7000);
  assert.equal(Boolean(openResult?.opened),true,`Packaged share picker did not open: ${JSON.stringify(openResult)}`);

  const pickerTarget=await waitTarget(item=>item.type==='page'&&String(item.url||'').includes('/ui/share-picker.html'),'share picker renderer');
  picker=new Cdp(pickerTarget.webSocketDebuggerUrl);await picker.connect();
  await picker.wait("document.readyState==='complete'&&document.querySelector('#screenGrid')&&document.querySelector('#windowGrid')",'picker chrome');

  const chrome=await picker.eval(`(()=>({
    title:document.querySelector('.picker-title h1')?.textContent?.trim(),
    brand:document.querySelector('.picker-brand span')?.textContent?.trim(),
    logo:Boolean(document.querySelector('#pickerLogo')?.src),
    tabs:[...document.querySelectorAll('.source-tabs .tab')].map(node=>node.textContent.trim()),
    sound:document.querySelector('#shareAudioRow span')?.textContent?.trim(),
    optimize:document.querySelector('label.option-row:not(#shareAudioRow) span')?.textContent?.trim(),
    optimizeVisibleCount:[...document.querySelectorAll('label.option-row span')].filter(node=>node.textContent.includes('Optimize for sharing video')).length
  }))()`);
  assert.equal(chrome.title,'Share Screen');
  assert.equal(chrome.brand,'DominionStar Meet');
  assert.equal(chrome.logo,true,'Packaged picker must display the DominionStar logo.');
  assert.deepEqual(chrome.tabs,['Basic','Advanced','Files']);
  assert.equal(chrome.sound,'Share sound');
  assert.equal(chrome.optimize,'Optimize for sharing video');
  assert.equal(chrome.optimizeVisibleCount,1,'Packaged picker must expose one visible video optimization option.');

  await picker.wait("document.querySelector('#sourceGrid')?.hidden===false&&!document.querySelector('#loadingState')?.hidden",'source enumeration attempt',9000).catch(()=>{});
  await picker.wait("document.querySelectorAll('#screenGrid .source-card,#windowGrid .source-card').length>0||document.querySelector('#errorState')?.hidden===false",'source enumeration result',9000);
  const sourceState=await picker.eval(`(()=>({
    errorVisible:document.querySelector('#errorState')?.hidden===false,
    screens:document.querySelectorAll('#screenGrid .source-card').length,
    windows:document.querySelectorAll('#windowGrid .source-card').length,
    previews:[...document.querySelectorAll('#screenGrid img.preview,#windowGrid img.preview')].filter(node=>Boolean(node.src)).length,
    selected:document.querySelectorAll('#sourceGrid .source-card.selected').length,
    shareDisabled:Boolean(document.querySelector('#shareButton')?.disabled)
  }))()`);
  assert.equal(sourceState.errorVisible,false,`Packaged picker source discovery failed. ${stderr}`);
  assert.ok(sourceState.screens+sourceState.windows>0,'Packaged picker must render at least one real share source.');
  assert.ok(sourceState.previews>0,'Packaged picker must render at least one native source preview.');
  assert.equal(sourceState.selected,1,'Exactly one Basic source must be selected.');
  assert.equal(sourceState.shareDisabled,false,'Share must enable after a source is selected.');

  const selection=await picker.eval(`(()=>{
    const cards=[...document.querySelectorAll('#sourceGrid .source-card:not([disabled])')];
    const target=cards.length>1?cards[1]:cards[0];
    target.click();
    return {id:target.dataset.sourceId,label:document.querySelector('#selectionLabel')?.textContent||'',selected:document.querySelectorAll('#sourceGrid .source-card.selected').length,aria:target.getAttribute('aria-selected')};
  })()`);
  assert.equal(selection.selected,1,'Single-click selection must remain exclusive.');
  assert.equal(selection.aria,'true','Selected card must expose aria-selected=true.');
  assert.match(selection.label,/^Selected:/,'Selection summary must update after a click.');

  const advanced=await picker.eval(`(()=>{
    document.querySelector('[data-tab="advanced"]').click();
    return {basicHidden:document.querySelector('#sourceGrid').hidden,advancedVisible:!document.querySelector('#advancedGrid').hidden,count:document.querySelectorAll('#advancedGrid .source-card').length,disabled:[...document.querySelectorAll('#advancedGrid .source-card')].every(node=>node.disabled),shareDisabled:document.querySelector('#shareButton').disabled};
  })()`);
  assert.equal(advanced.basicHidden,true);
  assert.equal(advanced.advancedVisible,true);
  assert.equal(advanced.count,4);
  assert.equal(advanced.disabled,true,'Unimplemented Advanced modes must be visibly non-interactive rather than pretending to work.');
  assert.equal(advanced.shareDisabled,true,'Share must disable when no Basic source is active.');

  const restored=await picker.eval(`(()=>{document.querySelector('[data-tab="basic"]').click();return {selected:document.querySelectorAll('#sourceGrid .source-card.selected').length,label:document.querySelector('#selectionLabel')?.textContent||'',shareDisabled:document.querySelector('#shareButton').disabled};})()`);
  assert.equal(restored.selected,1,'Basic source selection must persist across tabs.');
  assert.match(restored.label,/^Selected:/);
  assert.equal(restored.shareDisabled,false);

  await picker.eval(`document.querySelector('#cancelBottom').click();true`);
  const deadline=Date.now()+5000;let closed=false;
  while(Date.now()<deadline){try{closed=!(await targets()).some(item=>String(item.url||'').includes('/ui/share-picker.html'));if(closed)break;}catch{}await sleep(100);}
  assert.equal(closed,true,'Cancel must close the packaged share picker.');
  assert.doesNotMatch(stderr,/Uncaught\s+(?:TypeError|ReferenceError|SyntaxError)/i,'Packaged picker produced an uncaught renderer error.');
  console.log('DOMINIONSTAR_PACKAGED_SHARE_PICKER_2_0_23_OK real-window branded basic-advanced-files screens-windows native-previews single-selection selection-summary tab-persistence cancel no-renderer-errors');
}catch(error){
  console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());process.exitCode=1;
}finally{
  picker?.close();main?.close();
  if(child.exitCode===null)child.kill('SIGTERM');
  await sleep(500);
  if(child.exitCode===null)child.kill('SIGKILL');
}
