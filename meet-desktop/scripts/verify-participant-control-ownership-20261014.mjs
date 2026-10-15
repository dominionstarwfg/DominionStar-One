import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const controls=read('ui/participant-controls.js');
const styles=read('ui/participant-controls.css');
const reference=read('ui/zoom-participants-reference-2.0.41.js');
const runtime=read('ui/runtime-stability.js');
const app=read('ui/app.js');
const fragment=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Missing function boundary: '+start);
  return source.slice(a,b);
};
function testRosterProfileAccess(){
  const rows=[],syncs=[];
  const makeRow=(role,self=false)=>{
    const listeners=new Map(),buttons=[];
    const row={
      dataset:{participantId:role+'-id',participantName:role,participantRole:role,participantSelf:self?'1':'0'},
      querySelector(selector){
        if(selector==='[data-participant-more]')return buttons[0]||null;
        if(selector==='.participant-actions')return {append(node){buttons.push(node);}};
        return null;
      },
      addEventListener(type,cb){listeners.set(type,cb);},
      setAttribute(name,value){this[name]=value;},
      listeners,buttons
    };
    rows.push(row);
    return row;
  };
  const guest=makeRow('participant'),host=makeRow('host');
  const doc={createElement(){return {dataset:{},setAttribute(name,value){this[name]=value;}}}};
  const code=fragment(controls,'  function syncRoster(){','  function syncPanelActions(){');
  const sync=new Function('inMeeting','qa','canManage','document','openParticipantMenu','openParticipantProfile',
    'syncRowMedia',code+';return syncRoster;')
    (()=>true,()=>rows,()=>false,doc,()=>{},()=>{},row=>syncs.push(row.dataset.participantId));
  sync();
  for(const row of [guest,host]){
    assert.equal(row.buttons.length,1,'guest and host rows need a functional More menu');
    assert.equal(row.buttons[0].dataset.dsParticipantMenuBound,'1','menu must bind once');
    assert.equal(row.dataset.dsParticipantProfileBound,'1','every row needs a click-able identity profile');
    assert.equal(typeof row.listeners.get('click'),'function');
    assert.equal(typeof row.listeners.get('keydown'),'function');
  }
  assert.equal(syncs.length,2,'media indicators must bind on all rows');
  sync();
  assert.equal(guest.buttons.length,1,'refresh must not duplicate More button');
}
async function testGuestMenuIsChatOnly(){
  const roster={dataset:{participantId:'another',participantRole:'host',participantName:'Room Host',participantSelf:'0'}};
  const rootButton={closest:()=>roster,getBoundingClientRect:()=>({right:300,bottom:100})};
  let opened=null,menu=null;
  const document={
    createElement(){
      return {children:[],style:{},setAttribute(){},append(child){this.children.push(child);}};
    },
    body:{append(value){menu=value;}}
  };
  const src=fragment(controls,'  async function openParticipantMenu(button){','  function setMediaIcon(node,on,kind){');
  let closeCalls=0;
  const run=new Function('closeMenu','document','canManage','openParticipantChat','send','renameParticipant','meeting',
    'localRole','spotlightParticipantIds','peers','toast','window','navigator','innerWidth','innerHeight',src+';return openParticipantMenu')
    (()=>{closeCalls++;},document,()=>false,id=>{opened=id;},()=>{throw Error('guest cannot moderate')},
      ()=>{}, {},()=> 'participant',[],async()=>[],()=>{}, {dispatchEvent:()=>{}},
      {clipboard:{writeText:async()=>{}}},1200,800);
  await run(rootButton);
  assert.ok(menu,'guest should receive a participant menu');
  assert.deepEqual(menu.children.map(button=>button.textContent),['Chat privately'],
    'guest must not see mute, stop-video, rename, cohost, or remove');
  menu.children[0].onclick();
  await Promise.resolve();
  assert.equal(opened,'another');
  assert.ok(closeCalls>=1);
}
function testIndependentCameraMicSignals(){
  const listeners={};const remoteMedia=new Map(),touched=[];
  const portion=fragment(controls,"  window.addEventListener('dominion:remote-media-state',","  localMediaUnsub=media()");
  new Function('window','remoteMedia','q','CSS','syncRowMedia',portion)(
    {addEventListener:(name,callback)=>{listeners[name]=callback}},
    remoteMedia,()=>({dataset:{}}),{escape:id=>id},row=>touched.push(row));
  const emit=detail=>listeners['dominion:remote-media-state']({detail});
  emit({participantId:'guest',cameraOn:true});
  assert.deepEqual(remoteMedia.get('guest'),{cameraOn:true});
  emit({participantId:'guest',micOn:true});
  assert.deepEqual(remoteMedia.get('guest'),{cameraOn:true,micOn:true});
  emit({participantId:'guest',cameraOn:false});
  assert.deepEqual(remoteMedia.get('guest'),{cameraOn:false,micOn:true},
    'camera-off event cannot turn a known live microphone off');
  emit({participantId:'guest',disconnected:true});
  assert.equal(remoteMedia.has('guest'),false);
  assert.equal(touched.length,4);
}
function testSingleRosterSorterAndMuteSlash(){
  assert.ok(!runtime.includes('    sortParticipants();'),'runtime cannot reorder roster');
  assert.ok(!reference.includes('sorted.forEach(row=>fragment.append(row))'),'reference cannot reorder roster');
  assert.ok(app.includes('const speaking=speakerRank(a.participantId)-speakerRank(b.participantId);'),
    'snapshot ordering must match speaker ordering in its first pass');
  assert.ok(styles.includes('.ds-media-state.off::after{content:none!important;display:none!important}'),
    'no CSS-generated second muted slash');
  assert.ok(reference.includes('class="ds-single-status-slash"'), 'one mute slash should remain in the SVG');
  assert.ok(controls.includes("add('Chat privately',()=>openParticipantChat(id))"),
    'guest menu must provide direct message access');
  assert.ok(controls.includes('if(canManage()&&role!==\'host\')'),
    'moderation controls must stay host/co-host only');
}
testRosterProfileAccess();
await testGuestMenuIsChatOnly();
testIndependentCameraMicSignals();
testSingleRosterSorterAndMuteSlash();
console.log('PASS participant access and stable ordering: guest chat/profile, restricted host controls, independent media state and single mute slash (mock only)');
