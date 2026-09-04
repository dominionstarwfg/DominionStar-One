import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const controllerSource=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const roomId='qa-two-client-webrtc-2-0-41';
const ids=['00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000202'];
const names=new Map([[ids[0],'QA Host'],[ids[1],'QA Guest']]);
const queues=new Map(ids.map(id=>[id,[]]));
let signalId=0;

const sendSignal=(from,to,type,payload={})=>{
  assert(queues.has(to),`Unknown signaling destination ${to}`);
  const signal={id:++signalId,fromParticipantId:from,type:String(type||''),payload:payload||{},createdAt:new Date().toISOString()};
  queues.get(to).push(signal);
  return {ok:true,id:signal.id};
};
const pullSignals=(to,afterId=0,limit=100)=>{
  const list=(queues.get(to)||[]).filter(item=>item.id>Number(afterId||0)).slice(0,Number(limit)||100);
  return {signals:list,lastId:list.length?list[list.length-1].id:Number(afterId||0)};
};
const participants=()=>ids.map(id=>({participantId:id,displayName:names.get(id),state:'joined',role:id===ids[0]?'host':'participant'}));

async function configurePage(page,id){
  const otherId=ids.find(value=>value!==id);
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error?.message||error)));
  page.on('console',message=>{if(message.type()==='error')pageErrors.push(`console: ${message.text()}`);});

  await page.exposeFunction('__qaSendSignal',(to,type,payload)=>sendSignal(id,String(to),type,payload));
  await page.exposeFunction('__qaPullSignals',(afterId,limit)=>pullSignals(id,afterId,limit));
  await page.exposeFunction('__qaSnapshot',()=>({roomId,status:'live',participants:participants()}));

  await page.setContent(`<!doctype html><html><body><header class="meeting-head"></header><main id="meetingOverlay"><section class="stage"></section></main></body></html>`,{waitUntil:'domcontentloaded'});
  await page.evaluate(({id,roomId,displayName})=>{
    const mediaListeners=new Set(),shareListeners=new Set();
    const makeVideoTrack=(label)=>{
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
      const ctx=canvas.getContext('2d');let frame=0;
      const timer=setInterval(()=>{ctx.fillStyle=`hsl(${(frame++*17)%360} 60% 35%)`;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.fillText(label,20,42);},80);
      const stream=canvas.captureStream(12);const track=stream.getVideoTracks()[0];
      track.addEventListener('ended',()=>clearInterval(timer),{once:true});
      return track;
    };
    const makeAudioTrack=(frequency)=>{
      const ac=new AudioContext();const oscillator=ac.createOscillator();const gain=ac.createGain();const dest=ac.createMediaStreamDestination();
      oscillator.frequency.value=frequency;gain.gain.value=.02;oscillator.connect(gain).connect(dest);oscillator.start();
      const track=dest.stream.getAudioTracks()[0];track.addEventListener('ended',()=>{try{oscillator.stop();}catch{}void ac.close();},{once:true});return track;
    };
    const localStream=new MediaStream([makeAudioTrack(id.endsWith('101')?420:520),makeVideoTrack(displayName)]);
    let shareStream=null;
    window.__qaOwnedStreams=[localStream];
    window.__qaSetShare=(active=true)=>{
      if(active&&!shareStream){shareStream=new MediaStream([makeVideoTrack(`${displayName} screen`),makeAudioTrack(620)]);window.__qaOwnedStreams.push(shareStream);}
      if(!active&&shareStream){shareStream.getTracks().forEach(track=>track.stop());shareStream=null;}
      for(const fn of [...shareListeners])fn({active:Boolean(shareStream)});
      return Boolean(shareStream);
    };
    window.__qaStopTracks=()=>{for(const stream of window.__qaOwnedStreams)stream?.getTracks?.().forEach(track=>{if(track.readyState!=='ended')track.stop();});};
    const subscribe=(set,fn)=>{set.add(fn);return()=>set.delete(fn);};
    window.DominionMediaController={
      stream:()=>localStream,
      snapshot:()=>({speakerId:'',micOn:true,cameraOn:true}),
      onChange:fn=>subscribe(mediaListeners,fn),
      recoverAfterResume:async()=>true
    };
    window.DominionShareController={
      outputStream:()=>shareStream,
      snapshot:()=>({active:Boolean(shareStream),options:{optimizeVideo:true}}),
      onChange:fn=>subscribe(shareListeners,fn)
    };
    window.dominionDesktop={
      isDesktop:true,
      power:{onChanged:()=>()=>{}},
      meeting:{
        context:async()=>({roomId,participantId:id,joinToken:`token-${id}`,state:'joined',role:id.endsWith('101')?'host':'participant'}),
        sendSignal:(to,type,payload)=>window.__qaSendSignal(to,type,JSON.parse(JSON.stringify(payload||{}))),
        pullSignals:(afterId=0,limit=100)=>window.__qaPullSignals(afterId,limit),
        snapshot:()=>window.__qaSnapshot(),
        touchPresence:async()=>({ok:true}),
        iceConfig:async()=>({iceServers:[{urls:['stun:127.0.0.1:9']}],expiresAtMs:Date.now()+60*60*1000,provider:'qa-direct',ttl:3600,qaDirectOnly:true})
      }
    };
  },{id,roomId,displayName:names.get(id)});

  await page.addScriptTag({content:controllerSource});
  await page.waitForFunction(()=>Boolean(window.DominionWebRTCController));
  return {pageErrors,otherId};
}

async function waitConnected(page,label){
  await page.waitForFunction(()=>window.DominionWebRTCController?.snapshot?.().peerCount===1,null,{timeout:15000});
  try{
    await page.waitForFunction(()=>[...document.querySelectorAll('.remote-peer-tile small')].some(node=>node.textContent==='Connected'),null,{timeout:20000});
  }catch(error){
    const diagnostics=await page.evaluate(()=>({
      snapshot:window.DominionWebRTCController?.snapshot?.()||{},
      tiles:[...document.querySelectorAll('.remote-peer-tile')].map(tile=>({id:tile.dataset.peerId||'',state:tile.querySelector('small')?.textContent||''})),
      transport:document.querySelector('#transportStatus')?.textContent||''
    }));
    throw new Error(`${label} peer did not reach Connected: ${JSON.stringify(diagnostics)}`,{cause:error});
  }
  await page.waitForFunction(()=>{
    const video=document.querySelector('.remote-peer-tile video');
    return Boolean(video?.srcObject?.getVideoTracks?.().some(track=>track.readyState==='live'));
  },null,{timeout:15000});
  await page.waitForFunction(()=>{
    const audio=document.querySelector('#remoteAudioBin audio[data-audio-peer]');
    return Boolean(audio?.srcObject?.getAudioTracks?.().some(track=>track.readyState==='live'));
  },null,{timeout:15000});
  const snapshot=await page.evaluate(()=>window.DominionWebRTCController.snapshot());
  assert.equal(snapshot.running,true,`${label} controller did not remain running`);
  assert.equal(snapshot.peerCount,1,`${label} did not keep exactly one peer`);
  assert.equal(snapshot.iceReady,true,`${label} lost its ICE configuration`);
}

const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--disable-features=WebRtcHideLocalIpsWithMdns']});
const context=await browser.newContext({viewport:{width:1280,height:800}});
const host=await context.newPage(),guest=await context.newPage();
let hostState,guestState;
try{
  hostState=await configurePage(host,ids[0]);guestState=await configurePage(guest,ids[1]);
  await Promise.all([
    host.evaluate(()=>window.DominionWebRTCController.start()),
    guest.evaluate(()=>window.DominionWebRTCController.start())
  ]);
  await Promise.all([waitConnected(host,'host'),waitConnected(guest,'guest')]);

  const offerSignals=(queues.get(ids[1])||[]).filter(item=>item.type==='offer');
  const answerSignals=(queues.get(ids[0])||[]).filter(item=>item.type==='answer');
  assert.equal(offerSignals.length,1,'Deterministic initiator policy did not produce exactly one initial offer.');
  assert.ok(answerSignals.length>=1,'Remote peer did not answer the initial offer.');
  assert.ok((queues.get(ids[0])||[]).some(item=>item.type==='ice')||(queues.get(ids[1])||[]).some(item=>item.type==='ice'),'No ICE candidate exchange occurred.');

  await host.evaluate(()=>window.__qaSetShare(true));
  await guest.waitForFunction(()=>{
    const video=document.querySelector('#remoteShareVideo');
    return document.body.classList.contains('remote-share-active')&&Boolean(video?.srcObject?.getVideoTracks?.().some(track=>track.readyState==='live'));
  },null,{timeout:15000});
  await guest.waitForFunction(()=>{
    const audio=document.querySelector('#remoteAudioBin audio[data-share-audio-peer]');
    return Boolean(audio?.srcObject?.getAudioTracks?.().some(track=>track.readyState==='live'));
  },null,{timeout:15000});
  const banner=await guest.locator('#remoteShareBanner strong').textContent();
  assert.match(String(banner||''),/QA Host is sharing/,'Viewer did not receive presenter identity on remote share.');

  await host.evaluate(()=>window.__qaSetShare(false));
  await guest.waitForFunction(()=>!document.body.classList.contains('remote-share-active'),null,{timeout:15000});

  for(const [label,state] of [['host',hostState],['guest',guestState]]){
    assert.deepEqual(state.pageErrors,[],`${label} renderer produced runtime errors:\n${state.pageErrors.join('\n')}`);
  }
  console.log('DOMINIONSTAR_TWO_CLIENT_WEBRTC_2_0_41_OK offer-answer-ice mic-camera screen-share share-audio presenter-identity stop-share deterministic-initiator');
}finally{
  for(const page of [host,guest]){
    try{await page.evaluate(async()=>{document.querySelector('#meetingOverlay').hidden=true;await window.DominionWebRTCController?.stop?.();window.__qaStopTracks?.();});}catch{}
  }
  await context.close();await browser.close();
}