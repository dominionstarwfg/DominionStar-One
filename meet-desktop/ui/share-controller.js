(()=>{
  if(window.DominionShareController)return;
  const bridge=window.dominionDesktop?.share;
  const captureBridge=window.dominionDesktop?.shareCapture||null;
  const macLike=/Mac/i.test(String(navigator.platform||navigator.userAgent||''));
  let macCapturePeer=null,macCaptureUnsubs=[],macCaptureSignalGeneration=0;
  const state={_liveStream:null,frozenStream:null,freezeCanvas:null,paused:false,busy:false,sourceName:'',options:{},annotationCanvas:null,compositeCanvas:null,compositeStream:null,compositeVideo:null,compositeRaf:0};
  // Physical-Mac liveness authority: a raw display stream held directly on
  // window remains responsive under ScreenCaptureKit, while the old closure-
  // owned stream path repeatedly starved the renderer after activation.
  // Preserve the public state.liveStream API through an accessor so every
  // existing controller/transport call remains unchanged.
  Object.defineProperty(state,'liveStream',{
    configurable:false,enumerable:false,
    get(){return macLike?(window.__DOMINION_MAC_ACTIVE_SHARE_STREAM||null):state._liveStream;},
    set(value){
      if(macLike)window.__DOMINION_MAC_ACTIVE_SHARE_STREAM=value||null;
      else state._liveStream=value||null;
    }
  });
  const listeners=new Set();
  let displayRequestGeneration=0;
  const snapshot=()=>({active:Boolean(state.liveStream),paused:state.paused,busy:state.busy,sourceName:state.sourceName,options:{...state.options},annotating:Boolean(state.annotationCanvas)});
  const emit=()=>{
    // A suppressed physical-Mac diagnostic must execute zero observer/snapshot
    // work. This distinguishes controller transaction bookkeeping from the
    // already-proven healthy raw display stream.
    if(window.__DOMINION_QA_SUPPRESS_SHARE_LISTENERS)return null;
    const value=snapshot();
    for(const listener of [...listeners]){
      try{listener(value);}catch(error){console.error('[DominionStar Meet] Share state listener failed.',error);}
    }
    return value;
  };
  const stopTracks=stream=>{for(const track of stream?.getTracks?.()||[]){if(track.readyState!=='ended'){try{track.stop();}catch{}}}};
  const baseOutputStream=()=>state.paused&&state.frozenStream?state.frozenStream:state.liveStream;

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


  function disposeMacCaptureClient({stopWorker=false}={}){
    const peer=macCapturePeer;macCapturePeer=null;macCaptureSignalGeneration=0;
    for(const off of macCaptureUnsubs.splice(0)){try{off?.();}catch{}}
    try{peer?.close?.();}catch{}
    if(stopWorker&&captureBridge?.stop){
      try{const pending=captureBridge.stop();void Promise.resolve(pending).catch(()=>{});}catch{}
    }
  }

  async function acquireMacWorkerDisplay(options={},generation){
    if(!captureBridge?.start)throw new Error('Dedicated Mac screen-capture worker is unavailable.');
    disposeMacCaptureClient({stopWorker:false});
    try{await captureBridge.stop?.();}catch{}

    const pc=new RTCPeerConnection({iceServers:[]});
    macCapturePeer=pc;
    const stream=new MediaStream(),pendingCandidates=[];
    let settled=false,resolveReady,rejectReady;
    const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const rejectOnce=error=>{if(settled)return;settled=true;rejectReady(error instanceof Error?error:new Error(String(error||'capture_worker_failed')));};
    const resolveIfReady=()=>{
      if(settled)return;
      const track=stream.getVideoTracks()[0]||null;
      if(track){settled=true;resolveReady({stream,track});}
    };

    pc.ontrack=event=>{
      const track=event.track;
      if(track&&!stream.getTracks().some(item=>item.id===track.id))stream.addTrack(track);
      resolveIfReady();
    };
    pc.onicecandidate=event=>{
      if(!event.candidate||pc!==macCapturePeer)return;
      try{const pending=captureBridge.candidate({generation:macCaptureSignalGeneration,candidate:event.candidate.toJSON?.()||event.candidate});void Promise.resolve(pending).catch(()=>{});}catch{}
    };
    pc.onconnectionstatechange=()=>{
      if(pc!==macCapturePeer)return;
      if(['failed','closed'].includes(pc.connectionState)&&!settled)rejectOnce(new Error('Dedicated Mac screen-capture transport failed.'));
    };

    macCaptureUnsubs=[
      captureBridge.onOffer?.(payload=>{void (async()=>{
        if(pc!==macCapturePeer)return;
        try{
          macCaptureSignalGeneration=Number(payload?.generation||0)||0;
          if(!payload?.sdp)throw new Error('Capture worker offer is missing.');
          await pc.setRemoteDescription(payload.sdp);
          while(pendingCandidates.length)await pc.addIceCandidate(pendingCandidates.shift()).catch(()=>{});
          const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
          await captureBridge.answer({generation:macCaptureSignalGeneration,sdp:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
        }catch(error){rejectOnce(error);}
      })();}),
      captureBridge.onCandidate?.(payload=>{void (async()=>{
        if(pc!==macCapturePeer||!payload?.candidate)return;
        if(Number(payload?.generation||0)!==macCaptureSignalGeneration&&macCaptureSignalGeneration)return;
        if(!pc.remoteDescription){pendingCandidates.push(payload.candidate);return;}
        await pc.addIceCandidate(payload.candidate).catch(()=>{});
      })();}),
      captureBridge.onError?.(payload=>{
        const message=String(payload?.error||'Dedicated Mac screen capture failed.');
        if(!settled)rejectOnce(new Error(message));
        else if(state.liveStream===stream&&!state.busy)void stop();
      }),
      captureBridge.onStopped?.(()=>{
        if(!settled)rejectOnce(new Error('Dedicated Mac screen capture stopped before it was ready.'));
        else if(state.liveStream===stream&&!state.busy)void stop();
      })
    ].filter(Boolean);

    const started=await captureBridge.start({
      shareAudio:Boolean(options.shareAudio),
      optimizeVideo:Boolean(options.optimizeVideo),
      qaSynthetic:Boolean(options.__qaSyntheticWorker)
    });
    if(!started?.ok){disposeMacCaptureClient({stopWorker:false});throw new Error(started?.error||'Dedicated Mac screen-capture worker could not start.');}
    let acquired;
    try{
      acquired=await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Dedicated Mac screen capture did not connect within 6 seconds.')),6000))]);
    }catch(error){disposeMacCaptureClient({stopWorker:true});throw error;}
    if(generation!==displayRequestGeneration){stopTracks(acquired.stream);disposeMacCaptureClient({stopWorker:true});throw new DOMException('Screen share request was replaced.','AbortError');}
    return acquired;
  }

  async function acquireDisplay(options={}){
    const optimize=Boolean(options.optimizeVideo),shareAudio=Boolean(options.shareAudio),generation=++displayRequestGeneration;
    if(macLike){
      // ScreenCaptureKit ownership is isolated in a dedicated renderer. The
      // meeting renderer receives only a local WebRTC track, keeping presenter
      // controls, media controls, chat and participants independently alive.
      return acquireMacWorkerDisplay(options,generation);
    }
    if(!macLike&&!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable on this device.');
    const capturePromise=navigator.mediaDevices.getDisplayMedia({audio:shareAudio,video:{frameRate:optimize?{ideal:30,max:30}:{ideal:15,max:30}}});
    let timeoutId=0,stream=null,timedOut=false;
    const timeoutPromise=new Promise((_,reject)=>{timeoutId=setTimeout(()=>{timedOut=true;const error=new Error('Screen sharing did not start within 5 seconds. Please choose the source again.');error.code='share_start_timeout';reject(error);},5000);});
    try{stream=await Promise.race([capturePromise,timeoutPromise]);}
    catch(error){if(timedOut){displayRequestGeneration+=1;void capturePromise.then(lateStream=>stopTracks(lateStream)).catch(()=>{});}throw error;}
    finally{if(timeoutId)clearTimeout(timeoutId);}
    if(generation!==displayRequestGeneration){stopTracks(stream);throw new DOMException('Screen share request was replaced.','AbortError');}
    const track=stream.getVideoTracks()[0];
    if(!track){stopTracks(stream);throw new Error('No screen capture track was returned.');}
    try{track.contentHint=optimize?'motion':'detail';}catch{}
    for(const audioTrack of stream.getAudioTracks?.()||[]){try{audioTrack.contentHint='music';}catch{}}
    return {stream,track};
  }

  async function start({name='',options={}}={}){
    if(state.busy||state.liveStream)return snapshot();
    if(!macLike&&!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable on this device.');
    state.busy=true;emit();
    try{
      const {stream,track}=await acquireDisplay(options);
      state.liveStream=stream;state.sourceName=String(name||track.label||'Shared content');state.options={...options};state.paused=false;
      if(!options?.__qaSkipEndedListener){
        track.addEventListener('ended',()=>{if(!state.busy&&state.liveStream===stream)void stop();},{once:true});
      }else{
        console.error('QA_SHARE_TRACK_ENDED_LISTENER_SUPPRESSED');
      }
      if(options?.__qaSkipPresenterHandshake){
        console.error('QA_SHARE_PRESENTER_HANDSHAKE_SUPPRESSED');
        return snapshot();
      }
      let presenter=null;
      try{
        const qaSkipCaptureStarted=Boolean(window.__DOMINION_QA_SUPPRESS_SHARE_LISTENERS&&options?.__qaSkipCaptureStarted);
        const acknowledgement=qaSkipCaptureStarted
          ? Promise.resolve({ok:true,toolbarReady:true,qaSkipped:true})
          : Promise.resolve(bridge?.captureStarted?.({sourceName:state.sourceName,displayId:String(state.options?.displayId||''),paused:false}));
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
    const previousLive=state.liveStream,previousFrozen=state.frozenStream;
    try{
      const {stream,track}=await acquireDisplay(options);
      stopComposite();
      state.annotationCanvas=null;
      state.liveStream=stream;state.frozenStream=null;state.freezeCanvas=null;state.paused=false;
      state.sourceName=String(name||track.label||'Shared content');state.options={...options};
      track.addEventListener('ended',()=>{if(!state.busy&&state.liveStream===stream)void stop();},{once:true});
      stopTracks(previousFrozen);stopTracks(previousLive);
      try{await bridge?.captureState?.({sourceName:state.sourceName,displayId:String(state.options?.displayId||''),paused:false});}catch{}
      return snapshot();
    }finally{state.busy=false;emit();}
  }

  async function captureFreezeFrame(videoElement){
    const track=state.liveStream?.getVideoTracks?.()[0];
    if(!track)throw new Error('Unable to freeze the shared frame.');
    const drawSource=async()=>{
      if(Number(videoElement?.videoWidth)>1&&Number(videoElement?.videoHeight)>1)return {source:videoElement,width:Number(videoElement.videoWidth),height:Number(videoElement.videoHeight),close:null};
      if(typeof ImageCapture==='function'){
        try{
          const bitmap=await new ImageCapture(track).grabFrame();
          return {source:bitmap,width:Math.max(2,Number(bitmap.width)||1280),height:Math.max(2,Number(bitmap.height)||720),close:()=>bitmap.close?.()};
        }catch{}
      }
      if(typeof MediaStreamTrackProcessor==='function'){
        const processor=new MediaStreamTrackProcessor({track}),reader=processor.readable.getReader();
        try{
          const {value:frame,done}=await reader.read();
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

  async function resume(){if(!state.liveStream||!state.paused)return snapshot();stopTracks(state.frozenStream);state.frozenStream=null;state.freezeCanvas=null;state.paused=false;if(state.annotationCanvas)startComposite();emit();publishPauseState(false);return snapshot();}
  async function togglePause(videoElement){return state.paused?resume():pause(videoElement);}
  function outputStream(){return state.annotationCanvas&&state.compositeStream?state.compositeStream:baseOutputStream();}
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
  async function stop(){displayRequestGeneration+=1;const hadShare=Boolean(state.liveStream||state.frozenStream);
    state.annotationCanvas=null;
    stopComposite();
    // Zoom-style Stop Share is local-first: terminate the display tracks and
    // publish inactive state immediately. Main-process chrome restoration is
    // a follow-up notification and must never hold capture open on a slow IPC.
    stopTracks(state.frozenStream);stopTracks(state.liveStream);
    state.liveStream=null;state.frozenStream=null;state.freezeCanvas=null;state.paused=false;state.busy=false;state.sourceName='';state.options={};
    if(macLike){disposeMacCaptureClient({stopWorker:true});}
    emit();
    if(hadShare){
      try{
        const pending=bridge?.captureStopped?.();
        void Promise.resolve(pending).catch(error=>console.warn('[DominionStar Meet] Share-stop chrome cleanup failed.',error));
      }catch(error){console.warn('[DominionStar Meet] Share-stop chrome cleanup failed.',error);}
    }
    return snapshot();
  }
  const api=Object.freeze({start,replaceSource,pause,resume,togglePause,stop,outputStream,setAnnotationCanvas,snapshot,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}});
  window.DominionShareController=api;
})();