(()=>{
  const bridge=window.dominionShareCapture;
  if(!bridge)return;
  let pc=null,captureStream=null,generation=0,pendingRemoteCandidates=[];

  function stopTracks(stream){for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}}
  function cleanup(notify=false,reason='stopped'){
    const activeGeneration=generation;
    stopTracks(captureStream);captureStream=null;
    try{pc?.close?.();}catch{}pc=null;pendingRemoteCandidates=[];
    if(notify)bridge.stopped({generation:activeGeneration,reason});
  }

  async function begin(payload={}){
    generation+=1;const current=generation;cleanup(false);
    let stream=null;
    try{
      if(payload?.qaSynthetic){
        stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      }else{
        stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:Boolean(payload?.shareAudio)});
      }
      if(current!==generation){stopTracks(stream);return;}
      const videoTrack=stream.getVideoTracks()[0];
      if(!videoTrack)throw new Error('No display video track was returned by macOS.');
      captureStream=stream;
      videoTrack.addEventListener('ended',()=>{if(current===generation)cleanup(true,'track-ended');},{once:true});

      const nextPc=new RTCPeerConnection({iceServers:[]});pc=nextPc;
      nextPc.onicecandidate=event=>{
        if(current!==generation||!event.candidate)return;
        bridge.candidate({generation:current,candidate:event.candidate.toJSON?.()||event.candidate});
      };
      nextPc.onconnectionstatechange=()=>{
        if(current!==generation)return;
        if(['failed','closed'].includes(nextPc.connectionState)&&captureStream)cleanup(true,'transport-'+nextPc.connectionState);
      };
      for(const track of stream.getTracks())nextPc.addTrack(track,stream);
      const offer=await nextPc.createOffer();await nextPc.setLocalDescription(offer);
      if(current!==generation)return;
      bridge.offer({generation:current,sdp:{type:nextPc.localDescription.type,sdp:nextPc.localDescription.sdp}});
      bridge.started({generation:current,video:true,audio:stream.getAudioTracks().length>0,label:String(videoTrack.label||'Shared content')});
    }catch(error){
      if(current===generation){cleanup(false);bridge.error({generation:current,error:String(error?.message||error||'capture_worker_failed')});}
    }
  }

  bridge.onStart(payload=>{void begin(payload||{});});
  bridge.onAnswer(payload=>{void (async()=>{
    if(!pc||Number(payload?.generation||0)!==generation||!payload?.sdp)return;
    try{
      await pc.setRemoteDescription(payload.sdp);
      while(pendingRemoteCandidates.length)await pc.addIceCandidate(pendingRemoteCandidates.shift()).catch(()=>{});
    }catch(error){bridge.error({generation,error:String(error?.message||error||'capture_answer_failed')});}
  })();});
  bridge.onCandidate(payload=>{void (async()=>{
    if(!pc||Number(payload?.generation||0)!==generation||!payload?.candidate)return;
    if(!pc.remoteDescription){pendingRemoteCandidates.push(payload.candidate);return;}
    await pc.addIceCandidate(payload.candidate).catch(()=>{});
  })();});
  bridge.onStop(()=>{generation+=1;cleanup(true,'requested');});
  window.DominionShareCaptureWorker=Object.freeze({state:()=>({generation,active:Boolean(captureStream),connected:pc?.connectionState||'closed'})});
})();
