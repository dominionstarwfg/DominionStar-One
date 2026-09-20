(()=>{
  if(window.DominionShareController)return;
  const bridge=window.dominionDesktop?.share;
  const state={liveStream:null,frozenStream:null,freezeCanvas:null,paused:false,busy:false,sourceName:'',options:{},annotationCanvas:null,compositeCanvas:null,compositeStream:null,compositeVideo:null,compositeRaf:0};
  const listeners=new Set();
  let displayRequestGeneration=0;
  const snapshot=()=>({active:Boolean(state.liveStream),paused:state.paused,busy:state.busy,sourceName:state.sourceName,options:{...state.options},annotating:Boolean(state.annotationCanvas),capturedShareAudio:Boolean(state.liveStream?.getAudioTracks?.().some(track=>track.readyState==='live'))});
  const emit=()=>{
    const value=snapshot();
    for(const listener of [...listeners]){
      try{listener(value);}catch(error){console.error('[DominionStar Meet] Share state listener failed.',error);}
    }
  };
  const stopTracks=stream=>{for(const track of stream?.getTracks?.()||[]){if(track.readyState!=='ended'){try{track.stop();}catch{}}}};
  const baseOutputStream=()=>state.paused&&state.frozenStream?state.frozenStream:state.liveStream;

  const normalizeAudioMode=value=>String(value||'mono')==='stereo'?'stereo':'mono';
  async function applyShareAudioMode(track,mode){
    if(!track)return false;const normalized=normalizeAudioMode(mode);
    try{track.contentHint='music';}catch{}
    try{await track.applyConstraints?.({channelCount:normalized==='stereo'?{ideal:2}:{ideal:1}});}catch{}
    return true;
  }

  function stopComposite(){cancelAnimationFrame(state.compositeRaf);state.compositeRaf=0;stopTracks(state.compositeStream);state.compositeStream=null;state.compositeCanvas=null;if(state.compositeVideo){state.compositeVideo.pause?.();state.compositeVideo.srcObject=null;state.compositeVideo.remove?.();state.compositeVideo=null;}}
  function compositeFrame(){
    if(!state.annotationCanvas||!state.liveStream||!state.compositeCanvas||!state.compositeVideo)return;
    const base=baseOutputStream();if(state.compositeVideo.srcObject!==base){state.compositeVideo.srcObject=base;void state.compositeVideo.play().catch(()=>{});}
    const video=state.compositeVideo,canvas=state.compositeCanvas,ctx=canvas.getContext('2d',{alpha:false});
    const width=Math.max(2,Number(video.videoWidth)||Number(state.annotationCanvas.width)||1280),height=Math.max(2,Number(video.videoHeight)||Number(state.annotationCanvas.height)||720);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);if(video.readyState>=2)ctx.drawImage(video,0,0,width,height);ctx.drawImage(state.annotationCanvas,0,0,state.annotationCanvas.width,state.annotationCanvas.height,0,0,width,height);
    state.compositeRaf=requestAnimationFrame(compositeFrame);
  }
  function startComposite(){
    stopComposite();if(!state.annotationCanvas||!state.liveStream)return;
    const canvas=document.createElement('canvas');canvas.width=Math.max(2,state.annotationCanvas.width||1280);canvas.height=Math.max(2,state.annotationCanvas.height||720);state.compositeCanvas=canvas;
    const video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;video.style.display='none';document.body.append(video);state.compositeVideo=video;video.srcObject=baseOutputStream();void video.play().catch(()=>{});
    const stream=canvas.captureStream(30);for(const track of baseOutputStream()?.getAudioTracks?.()||[]){try{stream.addTrack(track.clone());}catch{}}state.compositeStream=stream;compositeFrame();emit();
  }

  async function acquireDisplay(options={}){
    const optimize=Boolean(options.optimizeVideo),shareAudio=Boolean(options.shareAudio),generation=++displayRequestGeneration;
    const capturePromise=navigator.mediaDevices.getDisplayMedia({audio:shareAudio,video:{frameRate:optimize?{ideal:30,max:30}:{ideal:15,max:30}}});
    let timeoutId=0,stream=null,timedOut=false;
    const timeoutPromise=new Promise((_,reject)=>{timeoutId=setTimeout(()=>{timedOut=true;const error=new Error('Screen sharing did not start within 5 seconds. Please choose the source again.');error.code='share_start_timeout';reject(error);},5000);});
    try{
      stream=await Promise.race([capturePromise,timeoutPromise]);
    }catch(error){
      if(timedOut){displayRequestGeneration+=1;void capturePromise.then(lateStream=>stopTracks(lateStream)).catch(()=>{});}
      throw error;
    }finally{if(timeoutId)clearTimeout(timeoutId);}
    if(generation!==displayRequestGeneration){stopTracks(stream);throw new DOMException('Screen share request was replaced.','AbortError');}
    const track=stream.getVideoTracks()[0];
    if(!track){stopTracks(stream);throw new Error('No screen capture track was returned.');}
    try{track.contentHint=optimize?'motion':'detail';}catch{}
    for(const audioTrack of stream.getAudioTracks?.()||[])await applyShareAudioMode(audioTrack,options.shareAudioMode);
    return {stream,track};
  }

  async function start({name='',options={}}={}){
    if(state.busy||state.liveStream)return snapshot();
    if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable on this device.');
    state.busy=true;emit();
    try{
      const {stream,track}=await acquireDisplay(options);
      state.liveStream=stream;state.sourceName=String(name||track.label||'Shared content');state.options={...options};state.paused=false;
      track.addEventListener('ended',()=>{if(state.liveStream===stream)void stop();},{once:true});
      let presenter=null;
      try{
        const acknowledgement=Promise.resolve(bridge?.captureStarted?.({sourceName:state.sourceName,paused:false,shareAudio:Boolean(state.options?.shareAudio),shareAudioMode:normalizeAudioMode(state.options?.shareAudioMode),optimizeVideo:Boolean(state.options?.optimizeVideo),includeMeetWindows:Boolean(state.options?.includeMeetWindows)}));
        presenter=await Promise.race([acknowledgement,new Promise(resolve=>setTimeout(()=>resolve({ok:true,toolbarReady:true,pending:true}),900))]);
        void acknowledgement.then(result=>{
          if(result?.toolbarReady===false&&state.liveStream===stream)void stop();
        }).catch(error=>{
          console.error('[DominionStar Meet] Presenter toolbar acknowledgement failed.',error);
          if(state.liveStream===stream)void stop();
        });
      }catch(error){
        state.liveStream=null;state.sourceName='';state.options={};state.paused=false;
        stopTracks(stream);
        try{await bridge?.captureStopped?.();}catch{}
        throw error;
      }
      if(presenter?.toolbarReady===false){
        state.liveStream=null;state.sourceName='';state.options={};state.paused=false;
        stopTracks(stream);
        try{await bridge?.captureStopped?.();}catch{}
        throw new Error('Presenter controls could not start. Screen sharing was cancelled safely.');
      }
      return snapshot();
    }finally{state.busy=false;emit();}
  }

  async function replaceSource({name='',options={}}={}){
    if(state.busy||!state.liveStream)return snapshot();
    if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable on this device.');
    state.busy=true;emit();
    const previous={
      liveStream:state.liveStream,
      frozenStream:state.frozenStream,
      freezeCanvas:state.freezeCanvas,
      paused:state.paused,
      sourceName:state.sourceName,
      options:{...state.options},
      annotationCanvas:state.annotationCanvas,
      compositeStream:state.compositeStream
    };
    let nextStream=null,transitionStarted=false,committed=false;
    try{
      const {stream,track}=await acquireDisplay(options);nextStream=stream;
      transitionStarted=true;
      // Keep the participant-facing old stream alive while the replacement
      // capture is being acquired. If annotations are composited, suspend the
      // compositor without ending its MediaStream so viewers retain the last
      // old frame until WebRTC commits the new sender track.
      cancelAnimationFrame(state.compositeRaf);state.compositeRaf=0;
      if(state.compositeVideo){state.compositeVideo.pause?.();state.compositeVideo.srcObject=null;state.compositeVideo.remove?.();state.compositeVideo=null;}
      state.compositeStream=null;state.compositeCanvas=null;state.annotationCanvas=null;
      state.liveStream=stream;state.frozenStream=null;state.freezeCanvas=null;state.paused=false;
      state.sourceName=String(name||track.label||'Shared content');state.options={...options};
      track.addEventListener('ended',()=>{if(state.liveStream===stream)void stop();},{once:true});

      // This is the transactional commit point. Do not stop the old live,
      // frozen, or composite stream until every current WebRTC sender has had
      // a bounded chance to replace its screen track with the new source.
      const syncSenders=window.DominionWebRTCController?.syncLocalTracks;
      if(typeof syncSenders!=='function')throw new Error('Screen-share transport is not ready to switch sources.');
      await syncSenders({strict:true});
      committed=true;
      stopTracks(previous.compositeStream);stopTracks(previous.frozenStream);stopTracks(previous.liveStream);
      try{await bridge?.captureState?.({sourceName:state.sourceName,paused:false,shareAudio:Boolean(state.options?.shareAudio),shareAudioMode:normalizeAudioMode(state.options?.shareAudioMode),optimizeVideo:Boolean(state.options?.optimizeVideo),includeMeetWindows:Boolean(state.options?.includeMeetWindows)});}catch{}
      return snapshot();
    }catch(error){
      if(!committed&&transitionStarted){
        // Roll back atomically only after replacement state was actually
        // staged. If capture acquisition was cancelled/denied, the existing
        // share was never touched and must remain completely undisturbed.
        state.liveStream=previous.liveStream;state.frozenStream=previous.frozenStream;state.freezeCanvas=previous.freezeCanvas;state.paused=previous.paused;
        state.sourceName=previous.sourceName;state.options={...previous.options};state.annotationCanvas=previous.annotationCanvas;
        if(previous.annotationCanvas)startComposite();
        try{await window.DominionWebRTCController?.syncLocalTracks?.({strict:true});}catch{}
        stopTracks(previous.compositeStream);
        stopTracks(nextStream);
      }else if(!committed){
        stopTracks(nextStream);
      }
      throw error;
    }finally{state.busy=false;emit();}
  }

  async function captureFreezeFrame(videoElement){
    const track=state.liveStream?.getVideoTracks?.()[0];
    if(!track)throw new Error('Unable to freeze the shared frame.');
    const bounded=async(promise,ms)=>{
      let timer=0;
      try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),ms);})]);}
      finally{if(timer)clearTimeout(timer);}
    };
    const drawSource=async()=>{
      // The local shared-video surface is the cheapest and most reliable source.
      // Give it a short bounded chance to expose a decoded frame before using
      // lower-level capture APIs.
      for(let attempt=0;attempt<5;attempt+=1){
        if(Number(videoElement?.videoWidth)>1&&Number(videoElement?.videoHeight)>1)return {source:videoElement,width:Number(videoElement.videoWidth),height:Number(videoElement.videoHeight),close:null};
        await new Promise(resolve=>setTimeout(resolve,40));
      }
      if(typeof ImageCapture==='function'){
        try{
          const bitmap=await bounded(new ImageCapture(track).grabFrame(),650);
          if(bitmap)return {source:bitmap,width:Math.max(2,Number(bitmap.width)||1280),height:Math.max(2,Number(bitmap.height)||720),close:()=>bitmap.close?.()};
        }catch{}
      }
      if(typeof MediaStreamTrackProcessor==='function'){
        const processor=new MediaStreamTrackProcessor({track}),reader=processor.readable.getReader();
        try{
          const packet=await bounded(reader.read(),650);
          const frame=packet?.value,done=Boolean(packet?.done);
          if(!done&&frame)return {source:frame,width:Math.max(2,Number(frame.displayWidth||frame.codedWidth)||1280),height:Math.max(2,Number(frame.displayHeight||frame.codedHeight)||720),close:()=>frame.close?.()};
        }finally{try{await reader.cancel();}catch{}try{reader.releaseLock();}catch{}}
      }
      throw new Error('Unable to capture the current shared frame.');
    };
    const captured=await drawSource();
    const canvas=document.createElement('canvas');canvas.width=captured.width;canvas.height=captured.height;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context){captured.close?.();throw new Error('Unable to freeze the shared frame.');}
    try{context.drawImage(captured.source,0,0,captured.width,captured.height);}finally{captured.close?.();}
    return canvas;
  }

  function publishPauseState(paused){
    try{
      const pending=bridge?.captureState?.({sourceName:state.sourceName,paused:Boolean(paused)});
      void Promise.resolve(pending).catch(error=>console.warn('[DominionStar Meet] Presenter state publish failed.',error));
    }catch(error){console.warn('[DominionStar Meet] Presenter state publish failed.',error);}
  }

  async function pause(videoElement){
    if(!state.liveStream||state.paused)return snapshot();
    const canvas=await captureFreezeFrame(videoElement);
    const frozen=canvas.captureStream(1);
    for(const audioTrack of state.liveStream.getAudioTracks?.()||[]){try{frozen.addTrack(audioTrack.clone());}catch{}}
    state.freezeCanvas=canvas;state.frozenStream=frozen;state.paused=true;if(state.annotationCanvas)startComposite();emit();publishPauseState(true);return snapshot();
  }

  async function resume(){
    if(!state.liveStream||!state.paused)return snapshot();
    const previousFrozen=state.frozenStream;
    state.frozenStream=null;state.freezeCanvas=null;state.paused=false;
    if(state.annotationCanvas)startComposite();
    emit();publishPauseState(false);
    // Keep the participant-facing frozen track alive until WebRTC has
    // replaced it with the live display track. Ending it first can expose a
    // transient black/ended frame during Resume, which breaks Zoom-style
    // frozen-frame privacy semantics.
    try{await window.DominionWebRTCController?.syncLocalTracks?.();}catch{}
    stopTracks(previousFrozen);
    return snapshot();
  }
  async function togglePause(videoElement){return state.paused?resume():pause(videoElement);}
  async function exportImage(){
    if(!state.liveStream)throw new Error('There is no active shared screen to save.');
    let baseCanvas=null;
    if(state.paused&&state.freezeCanvas){
      baseCanvas=state.freezeCanvas;
    }else{
      baseCanvas=await captureFreezeFrame(null);
    }
    const width=Math.max(2,Number(baseCanvas?.width)||1280),height=Math.max(2,Number(baseCanvas?.height)||720);
    const output=document.createElement('canvas');output.width=width;output.height=height;
    const ctx=output.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Unable to prepare the annotated screen for saving.');
    ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
    ctx.drawImage(baseCanvas,0,0,width,height);
    if(state.annotationCanvas)ctx.drawImage(state.annotationCanvas,0,0,state.annotationCanvas.width,state.annotationCanvas.height,0,0,width,height);
    return output.toDataURL('image/png');
  }
  function outputStream(){return state.annotationCanvas&&state.compositeStream?state.compositeStream:baseOutputStream();}

  async function setOptimizeVideo(enabled){
    if(!state.liveStream)return snapshot();
    const next=Boolean(enabled);state.options={...state.options,optimizeVideo:next};
    const track=state.liveStream.getVideoTracks?.()[0]||null;
    if(track){
      try{track.contentHint=next?'motion':'detail';}catch{}
      try{await track.applyConstraints?.({frameRate:next?{ideal:30,max:30}:{ideal:15,max:30}});}catch{}
    }
    emit();
    try{await window.DominionWebRTCController?.syncLocalTracks?.({strict:false});}catch{}
    return snapshot();
  }
  async function setShareAudioEnabled(enabled,{mode}={}){
    if(!state.liveStream)return snapshot();
    const next=Boolean(enabled),normalizedMode=normalizeAudioMode(mode||state.options?.shareAudioMode);
    const audioTrack=state.liveStream.getAudioTracks?.().find(track=>track.readyState==='live')||null;
    if(next&&!audioTrack){
      const error=new Error('Current screen capture has no system-audio track. Reacquire this source with Share Sound enabled.');
      error.code='share_audio_recapture_required';throw error;
    }
    if(audioTrack)await applyShareAudioMode(audioTrack,normalizedMode);
    state.options={...state.options,shareAudio:next,shareAudioMode:normalizedMode};emit();
    try{await window.DominionWebRTCController?.syncLocalTracks?.({strict:false});}catch{}
    return snapshot();
  }
  async function setShareAudioMode(mode){
    if(!state.liveStream)return snapshot();const normalized=normalizeAudioMode(mode);
    const audioTrack=state.liveStream.getAudioTracks?.().find(track=>track.readyState==='live')||null;
    if(audioTrack)await applyShareAudioMode(audioTrack,normalized);
    state.options={...state.options,shareAudioMode:normalized};emit();
    try{await window.DominionWebRTCController?.syncLocalTracks?.({strict:false});}catch{}
    return snapshot();
  }
  function setAnnotationCanvas(canvas){
    const next=canvas||null;
    if(state.annotationCanvas===next){
      if(next&&state.liveStream&&!state.compositeStream)startComposite();
      return snapshot();
    }
    state.annotationCanvas=next;
    if(next)startComposite();
    else{stopComposite();emit();}
    return snapshot();
  }
  async function stop(){displayRequestGeneration+=1;const hadShare=Boolean(state.liveStream||state.frozenStream||state.compositeStream);
    const previous={liveStream:state.liveStream,frozenStream:state.frozenStream,compositeStream:state.compositeStream};
    // Stop painting annotation/composite frames immediately, but preserve the
    // participant-facing stream itself until WebRTC has detached the screen
    // sender. This prevents a black/ended frame between Stop Share and the
    // meeting view returning on participant devices.
    cancelAnimationFrame(state.compositeRaf);state.compositeRaf=0;
    if(state.compositeVideo){state.compositeVideo.pause?.();state.compositeVideo.srcObject=null;state.compositeVideo.remove?.();state.compositeVideo=null;}
    state.annotationCanvas=null;state.compositeStream=null;state.compositeCanvas=null;
    state.liveStream=null;state.frozenStream=null;state.freezeCanvas=null;state.paused=false;state.busy=false;state.sourceName='';state.options={};
    emit();

    if(hadShare){
      // Zoom-style Stop Share returns viewers to the meeting before retiring
      // the old capture objects. Use both RTP sender detachment and an explicit
      // share-state signal so the remote UI does not depend on browser-specific
      // MediaStreamTrack mute/ended timing.
      try{
        const syncSenders=window.DominionWebRTCController?.syncLocalTracks;
        if(typeof syncSenders==='function'){
          await Promise.race([
            syncSenders({strict:true}),
            new Promise((_,reject)=>setTimeout(()=>reject(new Error('share_stop_sender_timeout')),450))
          ]);
        }
      }catch(error){console.warn('[DominionStar Meet] Share-stop sender detach fallback.',error);}
      try{void window.DominionWebRTCController?.announceShareStopped?.();}catch{}
      stopTracks(previous.compositeStream);stopTracks(previous.frozenStream);stopTracks(previous.liveStream);

      // Capture is physically stopped before native presenter chrome cleanup.
      // Wait only a bounded interval so Stop Share can never hang on IPC.
      try{
        const cleanup=Promise.resolve(bridge?.captureStopped?.());
        await Promise.race([cleanup,new Promise(resolve=>setTimeout(resolve,650))]);
      }catch(error){console.warn('[DominionStar Meet] Share-stop chrome cleanup failed.',error);}
    }
    return snapshot();
  }
  const api=Object.freeze({start,replaceSource,pause,resume,togglePause,exportImage,stop,outputStream,setOptimizeVideo,setShareAudioEnabled,setShareAudioMode,setAnnotationCanvas,snapshot,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}});
  window.DominionShareController=api;
})();