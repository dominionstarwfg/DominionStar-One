import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime=fs.readFileSync(new URL('../ui/runtime-stability.js',import.meta.url),'utf8');
const parity=fs.readFileSync(new URL('../ui/meeting-parity.js',import.meta.url),'utf8');
const snippet=(start,end)=>{
  const a=runtime.indexOf(start),b=runtime.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Dock authority function missing: '+start);
  return runtime.slice(a,b);
};
const code=snippet('  function chooseDockOrientation(', '  let syncRunning=false');
const makeController=new Function('q','clamp',code+';return {chooseDockOrientation,syncVideoDockGeometry}');

function scenario({width,height,count,previous='right',userPositioned=false,sideBySide=false}){
  let winWidth=width,winHeight=height;
  const style=()=>({
    values:{},
    setProperty(name,value){this.values[name]=String(value);},
    removeProperty(name){delete this.values[name];}
  });
  const tiles=Array.from({length:count},()=>({hidden:false,classList:{contains:()=>false}}));
  const body={style:style()};
  const dock={
    hidden:false,dataset:{dsRuntimeDockMode:previous},style:style(),offsetWidth:188,offsetHeight:130,
    classList:{contains(name){return userPositioned&&name==='user-positioned';}},
    querySelector(name){return name==='.participant-video-dock-body'?body:null;},
    querySelectorAll(name){return name==='.remote-peer-tile'?tiles:[];}
  };
  const overlay={classList:{contains:name=>sideBySide&&name==='share-side-by-side'}};
  const stage={getBoundingClientRect:()=>({width:winWidth,height:winHeight}),clientWidth:winWidth,clientHeight:winHeight};
  const q=name=>name==='#meetingOverlay'?overlay:name==='.stage'?stage:name==='#participantVideoDock'?dock:null;
  const f=makeController(q,(v,a,b)=>Math.max(a,Math.min(b,v)));
  const run=()=>{assert.equal(f.syncVideoDockGeometry(),true);return {mode:dock.dataset.dsRuntimeDockMode,orientation:dock.dataset.orientation,x:body.style.values['overflow-x'],y:body.style.values['overflow-y'],cols:dock.dataset.dsRuntimeColumns,width:dock.style.values.width,height:dock.style.values.height}};
  return {dock,body,run,resize:(w,h)=>{winWidth=w;winHeight=h;}};
}

const tall=scenario({width:1440,height:850,count:7}),wide=tall.run();
assert.equal(wide.mode,'right');assert.equal(wide.orientation,'vertical');
assert.equal(wide.y,'auto');assert.equal(wide.x,'hidden');assert.equal(wide.width,'188px');
assert.equal(wide.cols,'1');

const narrow=scenario({width:820,height:660,count:7}),horizontal=narrow.run();
assert.equal(horizontal.mode,'top');assert.equal(horizontal.orientation,'horizontal');
assert.equal(horizontal.x,'auto');assert.equal(horizontal.y,'hidden');assert.equal(horizontal.cols,'4');
assert.equal(narrow.body.style.values['grid-auto-flow'],'column');
assert.equal(narrow.body.style.values['grid-auto-columns'],'176px');
assert.equal(horizontal.height,'139px');

narrow.resize(950,590);
assert.equal(narrow.run().mode,'top','hysteresis: a slight resize must not cause oscillation');
narrow.resize(1120,780);
assert.equal(narrow.run().mode,'right','large stage restores right strip');

const two=scenario({width:830,height:660,count:2}),shortStrip=two.run();
assert.equal(shortStrip.mode,'top');
assert.equal(shortStrip.x,'hidden','no internal horizontal scroll when all participants fit');
assert.equal(two.dock.style.values.width,'369px');

const veryShort=scenario({width:1500,height:470,count:6});
assert.equal(veryShort.run().mode,'top','height constraints must matter, not only width');

const pinned=scenario({width:780,height:500,count:6,userPositioned:true});
assert.equal(pinned.run().mode,'user','manual position cannot be overridden');

const split=scenario({width:780,height:500,count:6,sideBySide:true});
assert.equal(split.run().mode,'right','explicit side-by-side sharing retains its panel allocation');

assert.ok(parity.includes('if(dock.dataset.dsRuntimeDockMode&&!dock.classList.contains'), 'meeting parity cannot overwrite runtime orientation');
assert.ok(parity.includes('else if(!dock.dataset.dsRuntimeDockMode)'), 'sharing parity cannot pin a runtime-managed strip right');

console.log('PASS responsive dock: wide-right, narrow-top, 5-tile capacity, internal overflow, hysteresis, manual position, share layout (mock only)');
