(()=>{
  const bridge=window.dominionShareCapture;
  if(!bridge)return;
  let captureStream=null,generation=0;

  function stopTracks(stream){for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}}
  function cleanup(notify=false,reason='stopped'){
    const activeGeneration=generation;
    stopTracks(captureStream);captureStream=null;
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

      // The worker is the terminal owner of the macOS capture track. Do not
      // create an RTP sender, offer, ICE candidate, ImageBitmap, canvas mirror,
      // or any other track transport back to the meeting/control renderer.
      // The meeting renderer receives logical lifecycle only and must remain
      // independently responsive for presenter controls, media, chat and UI.
      bridge.started({
        generation:current,
        video:true,
        audio:stream.getAudioTracks().length>0,
        label:String(videoTrack.label||'Shared content')
      });
    }catch(error){
      if(current===generation){cleanup(false);bridge.error({generation:current,error:String(error?.message||error||'capture_worker_failed')});}
    }
  }

  bridge.onStart(payload=>{void begin(payload||{});});
  bridge.onStop(()=>{generation+=1;cleanup(true,'requested');});
  window.DominionShareCaptureWorker=Object.freeze({state:()=>({generation,active:Boolean(captureStream),transport:'lifecycle-only'})});
})();