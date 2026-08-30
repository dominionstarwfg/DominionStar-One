import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-physical-mac-2.0.19.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const port=10420+Math.floor(Math.random()*120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stderr='';
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',chunk=>{stderr+=String(chunk);});

async function target(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Packaged app exited before 2.0.19 physical Mac gate.\n${stderr}`);try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(700)});if(response.ok){const targets=await response.json();const page=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith('file://'));if(page?.webSocketDebuggerUrl)return page;}}catch{}await sleep(160);}throw new Error('Unable to attach to packaged renderer for 2.0.19 gate.');}
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url);const timer=setTimeout(()=>reject(new Error('2.0.19 CDP connection timeout.')),3000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket);},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('2.0.19 CDP connection failed.'));},{once:true});});}
let socket=null,nextId=0;const pending=new Map();
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},3000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Renderer evaluation failed.');return result.result?.value;}
async function waitFor(expression,label,timeout=10000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await sleep(120);}throw new Error(`Timed out waiting for ${label}.`);}

let failure=null;
try{
  const page=await target();socket=await connect(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);clearTimeout(waiter.timer);message.error?waiter.reject(new Error(message.error.message||'CDP error')):waiter.resolve(message.result);});
  await cdp('Runtime.enable');
  await waitFor("document.readyState==='complete'&&window.DominionPhysicalMacRepair",'2.0.19 physical Mac controller');
  const controller=await evaluate(`({version:window.DominionPhysicalMacRepair.version,relaunch:Boolean(window.dominionDesktop?.app?.relaunch),reset:Boolean(window.dominionDesktop?.app?.resetScreenPermission),privacy:Boolean(window.dominionDesktop?.app?.privacyIdentity)})`);
  assert.equal(controller.version,'2.0.19');assert.equal(controller.relaunch,true);assert.equal(controller.reset,true);assert.equal(controller.privacy,true);
  const identity=await evaluate(`window.dominionDesktop.app.privacyIdentity()`);
  assert.equal(identity.signingMode,'adhoc');assert.equal(identity.stableAcrossRebuilds,false);assert.equal(identity.screenPermissionPersistence,'not-certified');

  // Measure the actual packaged New Meeting controls. Do not create duplicate IDs:
  // that would test the fixture rather than the application users actually see.
  await waitFor("document.querySelector('#newMeetingForm')&&document.querySelector('#newMeetingUsePersonal')&&document.querySelector('#newMeetingPasscode')",'packaged Personal Meeting ID controls');
  const personal=await evaluate(`(()=>{const toggle=document.querySelector('#newMeetingUsePersonal'),pass=document.querySelector('#newMeetingPasscode')?.closest('label');const original=toggle.checked;toggle.checked=true;window.DominionPhysicalMacRepair.syncPersonalChoice();const out={display:getComputedStyle(pass).display,authority:toggle.dataset.ds219Authority,passExists:Boolean(pass)};toggle.checked=original;window.DominionPhysicalMacRepair.syncPersonalChoice();return out;})()`);
  assert.equal(personal.passExists,true,'Packaged New Meeting passcode row is missing.');
  assert.equal(personal.display,'none','Personal Meeting ID selection must hide the unrelated instant passcode field.');assert.equal(personal.authority,'1');

  const reaction=await evaluate(`(()=>{const tray=document.createElement('div');tray.className='ds-reaction-tray';for(const e of ['👏','👍','❤️','😂','😮','🎉']){const b=document.createElement('button');b.textContent=e;tray.append(b);}const d=document.createElement('span');d.className='ds-reaction-divider';tray.append(d);const hand=document.createElement('button');hand.className='ds-raise-hand';hand.textContent='✋ Raise Hand';tray.append(hand);document.body.append(tray);const tr=tray.getBoundingClientRect(),hr=hand.getBoundingClientRect(),hs=getComputedStyle(hand);const out={trayWidth:tr.width,handWidth:hr.width,handHeight:hr.height,whiteSpace:hs.whiteSpace,font:parseFloat(hs.fontSize),scroll:hand.scrollWidth,client:hand.clientWidth,overflow:getComputedStyle(tray).overflow};tray.remove();return out;})()`);
  assert.equal(reaction.whiteSpace,'nowrap');assert.ok(reaction.handHeight>=44&&reaction.handHeight<=48,'Raise Hand height is outside the compact tray.');assert.ok(reaction.font>=12.5&&reaction.font<=14,'Raise Hand text size is not controlled.');assert.ok(reaction.scroll<=reaction.client+1,'Raise Hand is wrapping/overflowing.');assert.equal(reaction.overflow,'hidden');

  const settings=await evaluate(`(()=>{const host=document.createElement('div');host.style.position='fixed';host.style.left='-9999px';host.innerHTML='<div class="settings-modal av-video-settings-open"><form><section id="avSettingsDetail"><div class="av-detail-head"><div><h3>Video</h3><p>Preview your camera</p></div></div><div class="av-zoom-group"><div class="av-zoom-group-head"><strong>Appearance</strong><small>Readable guidance</small></div><label class="av-toggle-row"><span>Mirror my video</span><input type="checkbox"></label><label class="av-range-row"><span>Touch up intensity</span><input type="range"></label></div></section></form></div>';document.body.append(host);const toggle=host.querySelector('.av-toggle-row'),label=toggle.querySelector('span'),check=toggle.querySelector('input'),range=host.querySelector('.av-range-row input'),copy=host.querySelector('.av-detail-head p'),small=host.querySelector('.av-zoom-group-head small');const out={label:parseFloat(getComputedStyle(label).fontSize),copy:parseFloat(getComputedStyle(copy).fontSize),small:parseFloat(getComputedStyle(small).fontSize),checkRight:check.getBoundingClientRect().left>label.getBoundingClientRect().right,rangeWidth:range.getBoundingClientRect().width};host.remove();return out;})()`);
  assert.ok(settings.label>=13&&settings.copy>=12.5&&settings.small>=11.5,'Video Settings typography is still undersized.');assert.equal(settings.checkRight,true,'Video Settings checkbox is not aligned as a desktop row.');assert.ok(settings.rangeWidth<=425,'Video Settings slider remains excessively wide.');

  const participant=await evaluate(`(()=>{const panel=document.createElement('div');panel.id='participantPanel';panel.className='room-side';panel.innerHTML='<div class="room-side-head"><strong>Participants</strong></div><div id="participantRoster"><div data-participant-id="a"></div><div data-participant-id="b"></div></div>';document.body.append(panel);window.DominionPhysicalMacRepair.syncParticipantCount();const text=panel.querySelector('.room-side-head strong').textContent;panel.remove();return text;})()`);
  assert.equal(participant,'Participants (2)','Participants must expose live count in the heading.');

  assert.doesNotMatch(stderr,/Uncaught\s+(?:NotFoundError|TypeError|ReferenceError|SyntaxError)/i,'2.0.19 packaged renderer emitted an uncaught JavaScript error.');
  console.log('DOMINIONSTAR_PACKAGED_PHYSICAL_MAC_2_0_19_OK repair-loaded explicit-tcc-recovery adhoc-not-certified actual-personal-ui-authority reaction-contained settings-aligned participant-count');
}catch(error){failure=error;console.error(error?.stack||String(error));if(stderr.trim())console.error(stderr.trim());}finally{for(const [,waiter] of pending){clearTimeout(waiter.timer);waiter.reject(new Error('2.0.19 gate shutdown'));}pending.clear();try{socket?.close();}catch{}try{child.kill('SIGTERM');}catch{}await sleep(250);if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}}
process.exit(failure?1:0);
