import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const companion=read('ui/mac-share-video.js'),presenter=read('ui/share-integration.js');
const slice=(s,start,end)=>{
  const i=s.indexOf(start),j=s.indexOf(end,i);
  assert.ok(i>=0&&j>i,'Missing source boundary: '+start);
  return s.slice(i,j);
};
assert.ok(!companion.includes('navigator.mediaDevices.getUserMedia('),'native presenter cannot open a second camera');
assert.ok(presenter.includes('const current=media.stream?.()'),'main renderer must reuse original camera stream');
assert.ok(presenter.includes('sendCompanionFrame(existingLocalCameraVideo(),self.participantId)'),'main renderer must forward its own camera frames');
assert.ok(presenter.includes('clearCompanionLocalVideo();'),'local forwarding surface must clean up on stop');
assert.ok(companion.includes('<canvas class="remote-frame" width="176" height="99" hidden></canvas>'),'persistent tile canvas must match approved footprint');
assert.ok(!companion.includes('img.src=dataUrl'),'old image-src flicker must not be reintroduced');

const fakeImages=[],drawn=[],fallback={hidden:false};
const canvas={hidden:true,width:176,height:99,getContext:()=>({
  setTransform(){},translate(){},scale(){},drawImage(image){drawn.push(image.src);}
})};
const tile={dataset:{participantId:'self'},querySelector:(selector)=>
  selector==='canvas.remote-frame'?canvas:selector==='.video-fallback'?fallback:null};
const document={querySelectorAll:()=>[tile]};
class Image {
  constructor(){fakeImages.push(this);}
}
const participants=[{participantId:'self',self:true,cameraOn:true}];
const remoteFrames=new Map();
const source=slice(companion,'  const frameEpoch=new Map();','  const localRole=()=>')+
  slice(companion,'  function applyRemoteFrame(payload={}){','  async function presenterCommand(')+
  '\nreturn {applyRemoteFrame,invalidateFrame,drawFrame};';
const actions=new Function('participants','remoteFrames','document','Image','mirrored',source)
  (participants,remoteFrames,document,Image,true);
const frame=(at,contents)=>({participantId:'self',dataUrl:'data:image/jpeg;base64,'+contents,at});

actions.applyRemoteFrame(frame(100,'AA'));
assert.equal(canvas.hidden,true,'do not reveal partially decoded frame');
assert.equal(fakeImages.length,1);
actions.applyRemoteFrame(frame(101,'BB'));
fakeImages[0].onload();
assert.deepEqual(drawn,[],'older decoding result may not replace newer frame');
fakeImages[1].onload();
assert.deepEqual(drawn,['data:image/jpeg;base64,BB']);
assert.equal(canvas.hidden,false);assert.equal(fallback.hidden,true);

participants[0].cameraOn=false;
actions.invalidateFrame('self');
actions.applyRemoteFrame(frame(102,'CC'));
assert.equal(fakeImages.length,2,'camera off must not start decoding new frames');
assert.equal(remoteFrames.size,0,'camera off clears last frame cache');

participants[0].cameraOn=true;
actions.applyRemoteFrame(frame(103,'DD'));
participants[0].cameraOn=false;
actions.invalidateFrame('self');
fakeImages[2].onload();
assert.deepEqual(drawn,['data:image/jpeg;base64,BB'],'late frame cannot reappear after video off');
console.log('PASS native companion uses one camera owner and ordered, decode-before-display frame updates (mock only)');