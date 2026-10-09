import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const controllerSource=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const featureSource=fs.readFileSync(new URL('../ui/meeting-features.js',import.meta.url),'utf8');
const participantControlsSource=fs.readFileSync(new URL('../ui/participant-controls.js',import.meta.url),'utf8');
const roomId='qa-two-client-webrtc-2-0-41';
const ids=['00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000202'];
const names=new Map([[ids[0],'QA Host'],[ids[1],'QA Guest']]);
const roles=new Map([[ids[0],'host'],[ids[1],'participant']]);
const activeIds=new Set(ids);
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
const participants=()=>ids.filter(id=>activeIds.has(id)).map(id=>({participantId:id,displayName:names.get(id),state:'joined',role:roles.get(id)||'participant'}));

const pageServer=http.createServer((_req,res)=>{
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end('<!doctype html><html><body><header class="meeting-head"></header><main id="meetingOverlay"><div class="meeting-body"><section class="stage"><span id="stageName">QA Participant</span></section><aside class="room-side"><div id="participantRoster"></div></aside></div><span id="roomRole">Participant</span><footer class="meeting-footer"><button id="roomMic">Unmute</button><button id="roomCamera">Stop Video</button><button id="roomParticipants">Participants</button><button id="roomExitButton">Leave</button></footer></main><dialog id="foundationDialog"><h2 id="foundationTitle"></h2><p id="foundationCopy"></p></dialog></body></html>');
});
await new Promise((resolve,reject)=>{pageServer.once('error',reject);pageServer.listen(0,'127.0.0.1',resolve);});
const serverAddress=pageServer.address();
assert(serverAddress&&typeof serverAddress==='object','QA page server did not bind.');
const baseURL=`http://127.0.0.1:${serverAddress.port}/`;

async function configurePage(page,id){
  const otherId=ids.find(value=>value!==id);
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error?.message||error)));
  page.on('console',message=>{if(message.type()==='error')pageErrors.push(`console: ${message.text()}`);});

  await page.exposeFunction('__qaSendSignal',(to,type,payload)=>sendSignal(id,String(to),type,payload));
  await page.exposeFunction('__qaPullSignals',(afterId,limit)=>pullSignals(id,afterId,limit));
  await page.exposeFunction('__qaSnapshot',()=>({roomId,status:'live',participants:participants()}));

  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.evaluate(async({id,roomId})=>{
    const mediaListeners=new Set(),shareListeners=new Set();
    const localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:{width:320,height:180,frameRate:15}});
    let micOn=true,cameraOn=true;
    window.__qaSignalEvents=[];
    window.__qaSpotlightEvents=[];
    window.__qaLayoutEvents=[];
    const roleNode=document.querySelector('#roomRole');if(roleNode)roleNode.textContent=id.endsWith('101')?'Host':'Participant';
    const nameNode=document.querySelector('#stageName');if(nameNode)nameNode.textContent=id.endsWith('101')?'QA Host':'QA Guest';
    window.addEventListener('dominion:meeting-signal',event=>window.__qaSignalEvents.push(event.detail));
    window.addEventListener('dominion:spotlight-change',event=>window.__qaSpotlightEvents.push(event.detail));
    window.addEventListener('dominion:host-view-layout',event=>window.__qaLayoutEvents.push(event.detail));
    let shareStream=null;
    window.__qaOwnedStreams=[localStream];
    window.__qaSetShare=async(active=true)=>{
      if(active&&!shareStream){shareStream=await navigator.mediaDevices.getUserMedia({audio:true,video:{width:640,height:360,frameRate:15}});window.__qaOwnedStreams.push(shareStream);}
      if(!active&&shareStream){shareStream.getTracks().forEach(track=>track.stop());shareStream=null;}
      for(const fn of [...shareListeners])fn({active:Boolean(shareStream)});
      return Boolean(shareStream);
    };
    window.__qaStopTracks=()=>{for(const stream of window.__qaOwnedStreams)stream?.getTracks?.().forEach(track=>{if(track.readyState!=='ended')track.stop();});};
    const subscribe=(set,fn)=>{set.add(fn);return()=>set.delete(fn);};
    window.DominionMediaController={
      stream:()=>localStream,
      snapshot:()=>({speakerId:'',micOn,cameraOn}),
      setMicrophone:async enabled=>{micOn=Boolean(enabled);for(const track of localStream.getAudioTracks())track.enabled=micOn;for(const fn of [...mediaListeners])fn({micOn,cameraOn});return micOn;},
      setCamera:async enabled=>{cameraOn=Boolean(enabled);for(const track of localStream.getVideoTracks())track.enabled=cameraOn;for(const fn of [...mediaListeners])fn({micOn,cameraOn});return cameraOn;},
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
  },{id,roomId});

  await page.addScriptTag({content:controllerSource});
  await page.addScriptTag({content:featureSource});
  await page.addScriptTag({content:participantControlsSource});
  await page.waitForFunction(()=>Boolean(window.DominionWebRTCController&&window.DominionMeetingFeatures&&window.DominionParticipantControls));
  return {pageErrors,otherId};
}

async function runtimeDiagnostics(page){
  return page.evaluate(()=>({
    snapshot:window.DominionWebRTCController?.snapshot?.()||{},
    tiles:[...document.querySelectorAll('.remote-peer-tile')].map(tile=>({id:tile.dataset.peerId||'',state:tile.querySelector('small')?.textContent||'',videoTracks:tile.querySelector('video')?.srcObject?.getVideoTracks?.().map(track=>({readyState:track.readyState,muted:track.muted}))||[]})),
    audio:[...document.querySelectorAll('#remoteAudioBin audio')].map(node=>({peer:node.dataset.audioPeer||node.dataset.shareAudioPeer||'',tracks:node.srcObject?.getAudioTracks?.().map(track=>({readyState:track.readyState,muted:track.muted}))||[]})),
    transport:document.querySelector('#transportStatus')?.textContent||''
  }));
}

async function waitConnected(page,label){
  await page.waitForFunction(()=>window.DominionWebRTCController?.snapshot?.().peerCount===1,null,{timeout:15000});
  try{
    await page.waitForFunction(()=>[...document.querySelectorAll('.remote-peer-tile small')].some(node=>node.textContent==='Connected'),null,{timeout:20000});
  }catch(error){throw new Error(`${label} peer did not reach Connected: ${JSON.stringify(await runtimeDiagnostics(page))}`,{cause:error});}
  try{
    await page.waitForFunction(()=>{
      const video=document.querySelector('.remote-peer-tile video');
      return Boolean(video?.srcObject?.getVideoTracks?.().some(track=>track.readyState==='live'));
    },null,{timeout:15000});
  }catch(error){throw new Error(`${label} remote camera did not become live: ${JSON.stringify(await runtimeDiagnostics(page))}`,{cause:error});}
  try{
    await page.waitForFunction(()=>{
      const audio=document.querySelector('#remoteAudioBin audio[data-audio-peer]');
      return Boolean(audio?.srcObject?.getAudioTracks?.().some(track=>track.readyState==='live'));
    },null,{timeout:15000});
  }catch(error){throw new Error(`${label} remote microphone did not become live: ${JSON.stringify(await runtimeDiagnostics(page))}`,{cause:error});}
  const snapshot=await page.evaluate(()=>window.DominionWebRTCController.snapshot());
  assert.equal(snapshot.running,true,`${label} controller did not remain running`);
  assert.equal(snapshot.peerCount,1,`${label} did not keep exactly one peer`);
  assert.equal(snapshot.iceReady,true,`${label} lost its ICE configuration`);
}

const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--disable-features=WebRtcHideLocalIpsWithMdns']});
const context=await browser.newContext({viewport:{width:1280,height:800},permissions:['camera','microphone']});
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


  // Cross-client communication proof: this is intentionally beyond WebRTC transport.
  await host.evaluate(({guestId})=>window.dominionDesktop.meeting.sendSignal(guestId,'chat',{text:'Host to guest communication proof',name:'QA Host',at:new Date().toISOString(),private:true,toParticipantId:guestId,toName:'QA Guest'}),{guestId:ids[1]});
  await guest.waitForFunction(()=>window.DominionMeetingFeatures?.snapshot?.().messageCount>=1,null,{timeout:6000});
  assert.match(String(await guest.locator('#meetingChatMessages').textContent()||''),/Host to guest communication proof/,'Guest did not render the host chat message delivered through meeting signaling.');

  await guest.evaluate(()=>window.DominionMeetingFeatures.sendReaction('👍'));
  await host.waitForFunction(guestId=>window.DominionMeetingFeatures?.snapshot?.().reactions?.some(item=>item.participantId===guestId&&item.emoji==='👍'),ids[1],{timeout:6000});

  await guest.evaluate(()=>window.DominionMeetingFeatures.setLocalHand(true,{broadcastChange:true}));
  await host.waitForFunction(guestId=>window.DominionMeetingFeatures?.snapshot?.().raisedHands?.includes(guestId),ids[1],{timeout:6000});

  await host.evaluate(({guestId})=>window.dominionDesktop.meeting.sendSignal(guestId,'host:mute',{at:new Date().toISOString()}),{guestId:ids[1]});
  await guest.waitForFunction(()=>window.DominionMediaController.snapshot().micOn===false,null,{timeout:6000});
  await host.evaluate(({guestId})=>window.dominionDesktop.meeting.sendSignal(guestId,'host:stop-video',{at:new Date().toISOString()}),{guestId:ids[1]});
  await guest.waitForFunction(()=>window.DominionMediaController.snapshot().cameraOn===false,null,{timeout:6000});

  await host.evaluate(({guestId,hostId})=>window.dominionDesktop.meeting.sendSignal(guestId,'recording-state',{active:true,paused:false,name:'QA Host',participantId:hostId,at:new Date().toISOString()}),{guestId:ids[1],hostId:ids[0]});
  await guest.waitForFunction(()=>document.querySelector('#meetingRecordingIndicator')?.hidden===false&&document.querySelector('#meetingRecordingOwner')?.textContent==='QA Host',null,{timeout:6000});
  await host.evaluate(({guestId,hostId})=>window.dominionDesktop.meeting.sendSignal(guestId,'recording-state',{active:false,paused:false,name:'QA Host',participantId:hostId,at:new Date().toISOString()}),{guestId:ids[1],hostId:ids[0]});
  await guest.waitForFunction(()=>document.querySelector('#meetingRecordingIndicator')?.hidden===true,null,{timeout:6000});

  // Direct chat must work in the reverse direction too, not just host -> guest.
  await guest.evaluate(({hostId})=>window.dominionDesktop.meeting.sendSignal(hostId,'chat',{text:'Guest to host direct communication proof',name:'QA Guest',at:new Date().toISOString(),private:true,toParticipantId:hostId,toName:'QA Host'}),{hostId:ids[0]});
  await host.waitForFunction(()=>window.DominionMeetingFeatures?.snapshot?.().messageCount>=1,null,{timeout:6000});
  assert.match(String(await host.locator('#meetingChatMessages').textContent()||''),/Guest to host direct communication proof/,'Host did not render the guest direct message delivered through meeting signaling.');

  // Host-directed stage controls must propagate to the participant renderer.
  await host.evaluate(({guestId})=>window.dominionDesktop.meeting.sendSignal(guestId,'host:spotlight',{participantIds:[guestId],at:new Date().toISOString()}),{guestId:ids[1]});
  await guest.waitForFunction(guestId=>window.__qaSpotlightEvents.some(event=>event?.participantIds?.includes(guestId)),ids[1],{timeout:6000});
  await host.evaluate(({guestId})=>window.dominionDesktop.meeting.sendSignal(guestId,'host:view-layout',{mode:'gallery',sharing:false,at:new Date().toISOString()}),{guestId:ids[1]});
  await guest.waitForFunction(()=>window.__qaLayoutEvents.some(event=>event?.mode==='gallery'),null,{timeout:6000});

  // Snapshot reconciliation is the authority for participant identity and role.
  names.set(ids[1],'QA Guest Renamed');
  roles.set(ids[1],'cohost');
  await host.waitForFunction(guestId=>{
    const tile=document.querySelector(`.remote-peer-tile[data-peer-id="${CSS.escape(guestId)}"]`);
    return tile?.dataset.participantRole==='cohost'&&tile?.querySelector('strong')?.textContent==='QA Guest Renamed';
  },ids[1],{timeout:7000});

  const guestSignalTypes=await guest.evaluate(()=>window.__qaSignalEvents.map(item=>item.type));
  for(const required of ['chat','host:mute','host:stop-video','recording-state','host:spotlight','host:view-layout'])assert.ok(guestSignalTypes.includes(required),`Guest never received ${required} through the shared meeting signaling channel.`);

  await host.evaluate(()=>window.__qaSetShare(true));
  try{
    await guest.waitForFunction(()=>{
      const video=document.querySelector('#remoteShareVideo');
      return document.body.classList.contains('remote-share-active')&&Boolean(video?.srcObject?.getVideoTracks?.().some(track=>track.readyState==='live'));
    },null,{timeout:15000});
  }catch(error){throw new Error(`guest remote screen share did not become live: ${JSON.stringify(await runtimeDiagnostics(guest))}`,{cause:error});}
  try{
    await guest.waitForFunction(()=>{
      const audio=document.querySelector('#remoteAudioBin audio[data-share-audio-peer]');
      return Boolean(audio?.srcObject?.getAudioTracks?.().some(track=>track.readyState==='live'));
    },null,{timeout:15000});
  }catch(error){throw new Error(`guest remote shared audio did not become live: ${JSON.stringify(await runtimeDiagnostics(guest))}`,{cause:error});}
  const banner=await guest.locator('#remoteShareBanner strong').textContent();
  assert.match(String(banner||''),/QA Host is sharing/,'Viewer did not receive presenter identity on remote share.');

  await host.evaluate(()=>window.__qaSetShare(false));
  await guest.waitForFunction(()=>!document.body.classList.contains('remote-share-active'),null,{timeout:15000});

  // Leaving must remove the peer and its media surface instead of leaving a ghost participant.
  activeIds.delete(ids[1]);
  await guest.evaluate(()=>window.DominionWebRTCController.stop());
  await host.waitForFunction(guestId=>window.DominionWebRTCController?.snapshot?.().peerCount===0&&!document.querySelector(`.remote-peer-tile[data-peer-id="${CSS.escape(guestId)}"]`),ids[1],{timeout:6000});

  for(const [label,state] of [['host',hostState],['guest',guestState]])assert.deepEqual(state.pageErrors,[],`${label} renderer produced runtime errors:\n${state.pageErrors.join('\n')}`);
  console.log('DOMINIONSTAR_TWO_CLIENT_WEBRTC_2_0_52_OK offer-answer-ice mic-camera dm-bidirectional reaction raise-hand host-mute host-stop-video recording-state spotlight host-layout rename-role-sync screen-share share-audio presenter-identity stop-share participant-leave deterministic-initiator');
}finally{
  for(const page of [host,guest]){
    try{await page.evaluate(async()=>{document.querySelector('#meetingOverlay').hidden=true;await window.DominionWebRTCController?.stop?.();window.__qaStopTracks?.();});}catch{}
  }
  await context.close();await browser.close();
  await new Promise(resolve=>pageServer.close(()=>resolve()));
}