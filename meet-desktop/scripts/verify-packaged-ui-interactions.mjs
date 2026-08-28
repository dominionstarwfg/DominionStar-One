import assert from 'node:assert/strict';

const port=Number(process.argv[2]||9222);
const base=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function targets(){
  const response=await fetch(`${base}/json/list`);
  if(!response.ok)throw new Error(`DevTools target discovery failed: ${response.status}`);
  return response.json();
}

async function waitForTarget(){
  for(let i=0;i<50;i++){
    try{
      const list=await targets();
      const target=list.find(item=>item.type==='page'&&String(item.url||'').startsWith('file:'))||list.find(item=>item.type==='page');
      if(target?.webSocketDebuggerUrl)return target;
    }catch{}
    await sleep(200);
  }
  throw new Error('Packaged DominionStar renderer DevTools target was not available.');
}

const target=await waitForTarget();
const ws=new WebSocket(target.webSocketDebuggerUrl);
let seq=0;
const pending=new Map();
ws.addEventListener('message',event=>{
  const message=JSON.parse(String(event.data));
  if(!message.id)return;
  const item=pending.get(message.id);if(!item)return;
  pending.delete(message.id);
  if(message.error)item.reject(new Error(message.error.message||'DevTools protocol error'));
  else item.resolve(message.result);
});
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});

function send(method,params={}){
  const id=++seq;
  return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
}

async function evaluate(expression){
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Renderer evaluation failed.');
  return result.result?.value;
}

await send('Runtime.enable');
for(let i=0;i<40;i++){
  const ready=await evaluate("document.readyState==='complete'&&Boolean(window.DominionMeetingParity)&&Boolean(window.DominionMeetingFeatures)");
  if(ready)break;
  if(i===39)throw new Error('Packaged renderer did not finish loading meeting interaction modules.');
  await sleep(200);
}

const boot=await evaluate(`(()=>{
  const app=document.querySelector('#appShell');if(app)app.hidden=false;
  const auth=document.querySelector('#authView');if(auth)auth.hidden=true;
  const overlay=document.querySelector('#meetingOverlay');if(overlay)overlay.hidden=false;
  window.DominionMeetingParity?.install?.();
  window.DominionMeetingFeatures?.toggleChat?.(false);
  return {
    local:location.protocol==='file:',
    parity:window.DominionMeetingParity?.version||'',
    features:Boolean(window.DominionMeetingFeatures),
    overlay:Boolean(overlay&&!overlay.hidden),
    controls:['roomParticipants','roomSettings','roomMore','roomChat','roomReactions'].every(id=>Boolean(document.getElementById(id)))
  };
})()`);
assert.equal(boot.local,true,'Packaged desktop renderer must run from a local file.');
assert.match(boot.parity,/zoom-adaptive-dock/,'Adaptive meeting chrome must be active.');
assert.equal(boot.features,true,'Meeting feature controller must be active.');
assert.equal(boot.overlay,true,'Meeting overlay must be testable.');
assert.equal(boot.controls,true,'Required meeting controls must exist in packaged renderer.');

async function clickAndRead(clickExpression,readExpression,label){
  await evaluate(clickExpression);
  await sleep(80);
  const value=await evaluate(readExpression);
  assert.equal(value,true,label);
}

await clickAndRead(
  "document.querySelector('#roomParticipants').click();true",
  "(()=>{const panel=document.querySelector('.room-side');return Boolean(panel&&!panel.hidden&&document.querySelector('#roomParticipants').getAttribute('aria-pressed')==='true')})()",
  'Participants control must open the participant management panel.'
);
await clickAndRead(
  "document.querySelector('.room-side [aria-label=\"Close participants\"]')?.click();true",
  "Boolean(document.querySelector('.room-side')?.hidden)",
  'Participant management panel close control must work.'
);
await clickAndRead(
  "document.querySelector('#roomSettings').click();true",
  "Boolean(document.querySelector('#settingsDialog')?.open)",
  'Settings control must open the real Settings dialog.'
);
await evaluate("document.querySelector('#settingsDialog')?.close();true");
await clickAndRead(
  "document.querySelector('#roomMore').click();true",
  "Boolean(document.querySelector('.meeting-more-menu'))",
  'More control must open the meeting menu.'
);
await evaluate("document.querySelector('.meeting-more-menu')?.remove();true");
await clickAndRead(
  "document.querySelector('#roomChat').click();true",
  "Boolean(document.querySelector('#meetingChatPanel')&&!document.querySelector('#meetingChatPanel').hidden)",
  'Chat control must open meeting chat.'
);
await clickAndRead(
  "document.querySelector('#roomReactions').click();true",
  "Boolean(document.querySelector('.meeting-reaction-menu'))",
  'Reactions control must open the reaction picker.'
);

await evaluate("document.querySelector('#meetingOverlay').hidden=true;true");
for(const [selector,dialogId,label] of [
  ['[data-action="new-meeting"]','newMeetingDialog','New Meeting'],
  ['[data-action="join"]','joinDialog','Join'],
  ['[data-action="schedule"]','scheduleDialog','Schedule']
]){
  const exists=await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  assert.equal(exists,true,`${label} Home action must exist.`);
  await evaluate(`(()=>{const d=document.getElementById(${JSON.stringify(dialogId)});if(d?.open)d.close();document.querySelector(${JSON.stringify(selector)}).click();return true;})()`);
  await sleep(80);
  const opened=await evaluate(`Boolean(document.getElementById(${JSON.stringify(dialogId)})?.open)`);
  assert.equal(opened,true,`${label} Home action must open its real dialog.`);
  await evaluate(`document.getElementById(${JSON.stringify(dialogId)})?.close();true`);
}

ws.close();
console.log('DOMINIONSTAR_PACKAGED_UI_INTERACTIONS_OK local-home participants settings more chat reactions new-meeting join schedule');
