(()=>{
'use strict';
const bridge=window.dominionShareCapture;if(!bridge)return;
let captureStream=null,syntheticCanvas=null,generation=0,peer=null,pendingRemoteCandidates=[],pauseCanvas=null,pauseStream=null,paused=false,lifecycleOnly=false;
const candidateValue=value=>value?.toJSON?.()||value||null;
function stopTracks(stream){for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}}
function clearPauseMedia(){stopTracks(pauseStream);pauseStream=null;pauseCanvas=null;paused=false}
function closePeer(){const current=peer;peer=null;pendingRemoteCandidates=[];try{current?.close?.();}catch{}}
function cleanup(notify=false,reason='stopped',activeGeneration=generation){closePeer();clearPauseMedia();stopTracks(captureStream);captureStream=null;syntheticCanvas=null;lifecycleOnly=false;if(notify)bridge.stopped({generation:activeGeneration,reason})}
async function flushRemoteCandidates(){if(!peer?.remoteDescription)return;for(const candidate of pendingRemoteCandidates.splice(0)){try{await peer.addIceCandidate(candidate)}catch{}}}
async function capturePauseCanvas(){
 const track=captureStream?.getVideoTracks?.()[0];if(!track)throw new Error('capture_video_track_unavailable');
 if(typeof ImageCapture==='function'){
  try{const bitmap=await new ImageCapture(track).grabFrame();const canvas=document.createElement('canvas');canvas.width=Math.max(2,Number(bitmap.width)||1280);canvas.height=Math.max(2,Number(bitmap.height)||720);const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('capture_pause_canvas_unavailable');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();return canvas}catch{}
 }
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.autoplay=true;video.srcObject=captureStream;
 try{
  await Promise.race([new Promise(resolve=>{if(video.readyState>=2&&video.videoWidth>1)return resolve();video.onloadeddata=()=>resolve();}),new Promise(resolve=>setTimeout(resolve,800))]);
  await video.play().catch(()=>{});
  const width=Math.max(2,Number(video.videoWidth)||1280),height=Math.max(2,Number(video.videoHeight)||720),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('capture_pause_canvas_unavailable');ctx.drawImage(video,0,0,width,height);return canvas;
 }finally{video.pause?.();video.srcObject=null;video.remove?.()}
}
async function setPaused(target){
 const want=Boolean(target);if(lifecycleOnly){paused=want;return {ok:true,paused,lifecycleOnly:true};}if(!captureStream||!peer)return {ok:false,paused,error:'capture_not_active'};if(paused===want)return {ok:true,paused};
 const sender=peer.getSenders?.().find(item=>item?.track?.kind==='video');if(!sender)return {ok:false,paused,error:'capture_video_sender_unavailable'};
 if(want){
  const canvas=await capturePauseCanvas(),frozen=canvas.captureStream(1),track=frozen.getVideoTracks()[0];if(!track){stopTracks(frozen);return {ok:false,paused,error:'capture_pause_track_unavailable'};}
  await sender.replaceTrack(track);clearPauseMedia();pauseCanvas=canvas;pauseStream=frozen;paused=true;return {ok:true,paused:true};
 }
 const liveTrack=captureStream.getVideoTracks()[0];if(!liveTrack||liveTrack.readyState!=='live')return {ok:false,paused,error:'capture_live_track_unavailable'};
 await sender.replaceTrack(liveTrack);clearPauseMedia();return {ok:true,paused:false};
}
async function acceptAnswer(payload={}){const g=Number(payload?.generation||0)||0;if(!peer||g!==generation||!payload?.sdp)return;try{await peer.setRemoteDescription(payload.sdp);await flushRemoteCandidates()}catch(error){if(g===generation)bridge.error({generation:g,error:String(error?.message||error||'capture_answer_failed')})}}
async function acceptRemoteCandidate(payload={}){const g=Number(payload?.generation||0)||0;if(!peer||g!==generation||!payload?.candidate)return;if(!peer.remoteDescription){pendingRemoteCandidates.push(payload.candidate);return}try{await peer.addIceCandidate(payload.candidate)}catch{}}
bridge.onAnswer(payload=>{void acceptAnswer(payload||{})});bridge.onCandidate(payload=>{void acceptRemoteCandidate(payload||{})});
async function begin(payload={}){
 const current=++generation;cleanup(false,'replaced',current);let stream=null;
 try{
  if(payload?.qaMessageOnly){console.error('QA_CAPTURE_WORKER_MESSAGE_ONLY_RECEIVED');return}
  if(payload?.qaLifecycleOnly){lifecycleOnly=true;bridge.started({generation:current,video:true,audio:false,label:'QA Lifecycle Share',lifecycleOnly:true});return}
  if(payload?.qaSynthetic){syntheticCanvas=document.createElement('canvas');syntheticCanvas.width=640;syntheticCanvas.height=360;const ctx=syntheticCanvas.getContext('2d');ctx.fillStyle='#07111f';ctx.fillRect(0,0,640,360);ctx.fillStyle='#f5c542';ctx.font='600 28px system-ui';ctx.fillText('DominionStar QA Share',34,64);stream=syntheticCanvas.captureStream(15);}
  else{const sourceId=String(payload?.sourceId||'');if(!sourceId)throw new Error('Selected desktop source is unavailable.');const frameRate=payload?.optimizeVideo?30:15;stream=await navigator.mediaDevices.getUserMedia({audio:payload?.shareAudio?{mandatory:{chromeMediaSource:'desktop'}}:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxFrameRate:frameRate}}})}
  if(current!==generation){stopTracks(stream);return}
  const videoTrack=stream.getVideoTracks()[0];if(!videoTrack)throw new Error('No display video track was returned by macOS.');captureStream=stream;
  videoTrack.addEventListener('ended',()=>{if(current===generation){const ended=generation;generation+=1;cleanup(true,'track-ended',ended)}},{once:true});
  const pc=new RTCPeerConnection({iceServers:[]});peer=pc;pendingRemoteCandidates=[];
  for(const track of stream.getTracks())pc.addTrack(track,stream);
  pc.onicecandidate=event=>{if(current!==generation||peer!==pc||!event.candidate)return;bridge.candidate({generation:current,candidate:candidateValue(event.candidate)})};
  pc.onconnectionstatechange=()=>{if(current===generation&&peer===pc&&pc.connectionState==='failed')bridge.error({generation:current,error:'capture_bridge_connection_failed'})};
  const offer=await pc.createOffer();if(current!==generation||peer!==pc)return;await pc.setLocalDescription(offer);
  bridge.offer({generation:current,sdp:pc.localDescription});
  bridge.started({generation:current,video:true,audio:stream.getAudioTracks().length>0,label:String(videoTrack.label||'Shared content'),transport:'isolated-local-webrtc'});
 }catch(error){if(current===generation){cleanup(false,'error',current);bridge.error({generation:current,error:String(error?.message||error||'capture_worker_failed')})}}
}
bridge.onStart(payload=>{void begin(payload||{})});
bridge.onStop(()=>{const stopped=generation;generation+=1;cleanup(true,'requested',stopped)});
window.DominionShareCaptureWorker=Object.freeze({setPaused,state:()=>({generation,active:Boolean(captureStream),paused,transport:'isolated-local-webrtc'})});
})();