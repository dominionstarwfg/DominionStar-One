(()=>{
'use strict';
const bridge=window.dominionShareCapture;if(!bridge)return;
let captureStream=null,generation=0,peer=null,pendingRemoteCandidates=[];
const candidateValue=value=>value?.toJSON?.()||value||null;
function stopTracks(stream){for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}}
function closePeer(){const current=peer;peer=null;pendingRemoteCandidates=[];try{current?.close?.();}catch{}}
function cleanup(notify=false,reason='stopped',activeGeneration=generation){closePeer();stopTracks(captureStream);captureStream=null;if(notify)bridge.stopped({generation:activeGeneration,reason})}
async function flushRemoteCandidates(){if(!peer?.remoteDescription)return;for(const candidate of pendingRemoteCandidates.splice(0)){try{await peer.addIceCandidate(candidate)}catch{}}}
async function acceptAnswer(payload={}){const g=Number(payload?.generation||0)||0;if(!peer||g!==generation||!payload?.sdp)return;try{await peer.setRemoteDescription(payload.sdp);await flushRemoteCandidates()}catch(error){if(g===generation)bridge.error({generation:g,error:String(error?.message||error||'capture_answer_failed')})}}
async function acceptRemoteCandidate(payload={}){const g=Number(payload?.generation||0)||0;if(!peer||g!==generation||!payload?.candidate)return;if(!peer.remoteDescription){pendingRemoteCandidates.push(payload.candidate);return}try{await peer.addIceCandidate(payload.candidate)}catch{}}
bridge.onAnswer(payload=>{void acceptAnswer(payload||{})});bridge.onCandidate(payload=>{void acceptRemoteCandidate(payload||{})});
async function begin(payload={}){
 const current=++generation;cleanup(false,'replaced',current);let stream=null;
 try{
  if(payload?.qaMessageOnly){console.error('QA_CAPTURE_WORKER_MESSAGE_ONLY_RECEIVED');return}
  if(payload?.qaLifecycleOnly){bridge.started({generation:current,video:true,audio:false,label:'QA Lifecycle Share',lifecycleOnly:true});return}
  if(payload?.qaSynthetic)stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
  else{const sourceId=String(payload?.sourceId||'');if(!sourceId)throw new Error('Selected desktop source is unavailable.');const frameRate=payload?.optimizeVideo?30:15;stream=await navigator.mediaDevices.getUserMedia({audio:payload?.shareAudio?{mandatory:{chromeMediaSource:'desktop'}}:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxFrameRate:frameRate}}})}
  if(current!==generation){stopTracks(stream);return}
  const videoTrack=stream.getVideoTracks()[0];if(!videoTrack)throw new Error('No display video track was returned by macOS.');captureStream=stream;
  videoTrack.addEventListener('ended',()=>{if(current===generation){const ended=generation;generation+=1;cleanup(true,'track-ended',ended)}},{once:true});
  const pc=new RTCPeerConnection({iceServers:[]});peer=pc;pendingRemoteCandidates=[];
  for(const track of stream.getTracks())pc.addTrack(track,stream);
  pc.onicecandidate=event=>{if(current!==generation||peer!==pc||!event.candidate)return;bridge.candidate({generation:current,candidate:candidateValue(event.candidate)})};
  pc.onconnectionstatechange=()=>{if(current===generation&&peer===pc&&pc.connectionState==='failed')bridge.error({generation:current,error:'capture_bridge_connection_failed'})};
  const offer=await pc.createOffer();if(current!==generation||peer!==pc)return;await pc.setLocalDescription(offer);
  bridge.offer({generation:current,sdp:{type:pc.localDescription?.type||'offer',sdp:String(pc.localDescription?.sdp||'')}});
  bridge.started({generation:current,video:true,audio:stream.getAudioTracks().length>0,label:String(videoTrack.label||'Shared content'),transport:'isolated-local-webrtc'});
 }catch(error){if(current===generation){cleanup(false,'error',current);bridge.error({generation:current,error:String(error?.message||error||'capture_worker_failed')})}}
}
bridge.onStart(payload=>{void begin(payload||{})});
bridge.onStop(()=>{const stopped=generation;generation+=1;cleanup(true,'requested',stopped)});
window.DominionShareCaptureWorker=Object.freeze({state:()=>({generation,active:Boolean(captureStream),transport:'isolated-local-webrtc'})});
})();