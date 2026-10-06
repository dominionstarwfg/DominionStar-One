(()=>{
  if(window.DominionShareController)return;
  const bridge=window.dominionDesktop?.share;
  const captureBridge=window.dominionDesktop?.shareCapture||null;
  const macLike=/Mac/i.test(String(navigator.platform||navigator.userAgent||''));
  const nativeMacCapture=macLike&&Boolean(captureBridge?.start);
  let macCapturePeer=null,macCaptureUnsubs=[],macCaptureSignalGeneration=0,macWorkerActive=false;
  const state={_liveStream:null,frozenStream:null,freezeCanvas:null,paused:false,busy:false,sourceName:'',options:{},annotationCanvas:null,compositeCanvas:null,compositeStream:null,compositeVideo:null,compositeRaf:0};
  // ScreenCaptureKit stays isolated in its worker renderer. The meeting
  // renderer receives only a local WebRTC copy for participant transport.
  Object.defineProperty(state,'liveStream',{
    configurable:false,enumerable:false,
    get(){return state._liveStream;},
    set(value){state._liveStream=value||null;}
  });
  const listeners=new Set();
  let displayRequestGeneration=0;
  let qaShareEmitSequence=0;
  const qaShareTrace=message=>{if(window.__DOMINION_QA_TRACE_SHARE_TRANSACTION)console.error(message);};
  const snapshot=()=>({active:nativeMacCapture?Boolean(macWorkerActive):Boolean(state.liveStream),paused:state.paused,busy:state.busy,sourceName:state.sourceName,options:{...state.options},annotating:Boolean(state.annotationCanvas)});
  const emit=()=>{
    // A suppressed physical-Mac diagnostic must execute zero observer/snapshot
    // work. This distinguishes controller transaction bookkeeping from the
    // already-proven healthy raw display stream.
    if(window.__DOMINION_QA_SUPPRESS_SHARE_LISTENERS){qaShareTrace('QA_SHARE_EMIT_SUPPRESSED');return null;}
    const value=snapshot(),sequence=++qaShareEmitSequence;
    qaShareTrace(`QA_SHARE_EMIT_BEGIN sequence=${sequence} active=${value.active?1:0} busy=${value.busy?1:0} listeners=${listeners.size}`);
    let index=0;
    for(const listener of [...listeners]){
      index+=1;qaShareTrace(`QA_SHARE_LISTENER_BEGIN sequence=${sequence} index=${index}`);
      try{listener(value);}catch(error){console.error('[DominionStar Meet] Share state listener failed.',error);}
      qaShareTrace(`QA_SHARE_LISTENER_END sequence=${sequence} index=${index}`);
    }
    qaShareTrace(`QA_SHARE_EMIT_END sequence=${sequence}`);
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
    try{peer?.close?.();}catch{}stopTracks(state._liveStream);state._liveStream=null;
    if(stopWorker&&captureBridge?.stop){try{const pending=captureBridge.stop();void Promise.resolve(pending).catch(()=>{});}catch{}}
  }

  async function acquireMacWorkerDisplay(options={},generation){
    if(!captureBridge?.start)throw new Error('Dedicated Mac screen-capture worker is unavailable.');
    disposeMacCaptureClient({stopWorker:false});
    const pc=new RTCPeerConnection({iceServers:[]}),stream=new MediaStream(),pendingCandidates=[];macCapturePeer=pc;state.liveStream=stream;
    const valid=()=>macCapturePeer===pc&&generation===displayRequestGeneration;
    const flush=async()=>{if(!pc.remoteDescription)return;for(const c of pendingCandidates.splice(0)){try{await pc.addIceCandidate(c);}catch{}}};
    const candidate=async payload=>{const g=Number(payload?.generation||0)||0;if(!valid()||!payload?.candidate)return;if(macCaptureSignalGeneration&&g!==macCaptureSignalGeneration)return;if(!macCaptureSignalGeneration)macCaptureSignalGeneration=g;if(!pc.remoteDescription){pendingCandidates.push(payload.candidate);return}try{await pc.addIceCandidate(payload.candidate)}catch{}};
    macCaptureUnsubs=[
      captureBridge.onOffer?.(payload=>{void (async()=>{const g=Number(payload?.generation||0)||0;if(!valid()||!payload?.sdp)return;if(macCaptureSignalGeneration&&g!==macCaptureSignalGeneration)return;macCaptureSignalGeneration=g;await pc.setRemoteDescription(payload.sdp);await flush();const answer=await pc.createAnswer();if(!valid())return;await pc.setLocalDescription(answer);await captureBridge.answer({generation:g,sdp:pc.localDescription})})().catch(error=>{if(valid())console.error('[DominionStar Meet] Mac capture bridge answer failed.',error)})}),
      captureBridge.onCandidate?.(payload=>{void candidate(payload||{})}),
      captureBridge.onError?.(payload=>{if(macWorkerActive&&!state.busy){console.error('[DominionStar Meet] Mac capture worker error.',payload);void stop()}}),
      captureBridge.onStopped?.(()=>{if(macWorkerActive&&!state.busy){macWorkerActive=false;void stop()}})
    ].filter(Boolean);
    pc.onicecandidate=event=>{if(!valid()||!event.candidate)return;const c=event.candidate.toJSON?.()||event.candidate;void Promise.resolve(captureBridge.candidate({generation:macCaptureSignalGeneration,candidate:c})).catch(()=>{})};
    pc.ontrack=event=>{if(!valid())return;const track=event.track;if(track&&!stream.getTracks().some(item=>item.id===track.id))stream.addTrack(track);if(track)track.addEventListener('ended',()=>{if(valid())emit()},{once:true});emit()};
    pc.onconnectionstatechange=()=>{if(valid()&&pc.connectionState==='failed'&&macWorkerActive&&!state.busy)void stop()};
    const started=await captureBridge.start({shareAudio:Boolean(options.shareAudio),optimizeVideo:Boolean(options.optimizeVideo),qaSynthetic:Boolean(options.__qaSyntheticWorker),qaLifecycleOnly:Boolean(options.__qaLifecycleOnlyWorker)});
    if(!started?.ok){disposeMacCaptureClient({stopWorker:false});macWorkerActive=false;throw new Error(started?.error||'Dedicated Mac screen-capture worker could not start.')}
    const g=Number(started?.generation||0)||0;if(macCaptureSignalGeneration&&g&&g!==macCaptureSignalGeneration){disposeMacCaptureClient({stopWorker:true});throw new Error('Mac capture bridge generation mismatch.')}if(!macCaptureSignalGeneration)macCaptureSignalGeneration=g;
    if(options?.__qaReturnBeforeWorkerActivate){console.error('QA_CAPTURE_RETURN_BEFORE_WORKER_ACTIVATE');return {stream,track:{label:String(started?.label||'Shared content'),readyState:'live'}}}
    macWorkerActive=true;if(generation!==displayRequestGeneration){disposeMacCaptureClient({stopWorker:true});macWorkerActive=false;throw new DOMException('Screen share request was replaced.','AbortError')}
    return {stream,track:{label:String(started?.label||'Shared content'),readyState:'live'}};
  }

  async function acquireDisplay(options={}){
    const optimize=Boolean(options.optimizeVideo),shareAudio=Boolean(options.shareAudio),generation=++displayRequestGeneration;
    if(nativeMacCapture){
      // ScreenCaptureKit ownership is isolated in a dedicated renderer. The
      // meeting renderer receives only a local WebRTC track, keeping presenter
      // controls, media controls, chat and participants independently alive.
      return acquireMacWorkerDisplay(options,generation);
    }
    if(!nativeMacCapture&&!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable on this device.');
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
    if(state.busy||(nativeMacCapture?macWorkerActive:Boolean(state.liveStream)))return snapshot();
    if(!nativeMacCapture&&!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable on this device.');
    if(options?.__qaLifecycleOnlyWorker)window.__DOMINION_QA_TRACE_SHARE_TRANSACTION=true;
    qaShareTrace('QA_SHARE_START_ENTER');
    state.busy=true;emit();
    try{
      qaShareTrace('QA_SHARE_START_BEFORE_ACQUIRE');
      const {stream,track}=await acquireDisplay(options);
      qaShareTrace('QA_SHARE_START_AFTER_ACQUIRE');
      if(options?.__qaReturnAfterAcquire){
        console.error('QA_SHARE_RETURN_AFTER_ACQUIRE');
        return {active:nativeMacCapture?Boolean(macWorkerActive):Boolean(stream),paused:false,busy:true,sourceName:'',options:{},annotating:false};
      }
      if(!nativeMacCapture)state.liveStream=stream;
      state.sourceName=String(name||track.label||'Shared content');state.options={...options};state.paused=false;
      if(!nativeMacCapture&&!options?.__qaSkipEndedListener){
        track.addEventListener('ended',()=>{if(!state.busy&&state.liveStream===stream)void stop();},{once:true});
      }else if(options?.__qaSkipEndedListener){
        console.error('QA_SHARE_TRACK_ENDED_LISTENER_SUPPRESSED');
      }
      if(options?.__qaSkipPresenterHandshake){
        console.error('QA_SHARE_PRESENTER_HANDSHAKE_SUPPRESSED');
        return snapshot();
      }
      let presenter=null;
      try{
        const qaSkipCaptureStarted=Boolean(options?.__qaSkipCaptureStarted);
        qaShareTrace('QA_SHARE_START_BEFORE_CAPTURE_STARTED');
        const acknowledgement=qaSkipCaptureStarted
          ? Promise.resolve({ok:true,toolbarReady:true,qaSkipped:true})
          : Promise.resolve(bridge?.captureStarted?.({sourceName:state.sourceName,displayId:String(state.options?.displayId||''),paused:false}));
        qaShareTrace('QA_SHARE_START_AFTER_CAPTURE_STARTED_SEND');
        presenter=await Promise.race([acknowledgement,new Promise(resolve=>setTimeout(()=>resolve({ok:true,toolbarReady:true,pending:true}),900))]);
        qaShareTrace('QA_SHARE_START_AFTER_CAPTURE_STARTED_ACK');
        void acknowledgement.then(result=>{
          if(result?.toolbarReady===false&&(nativeMacCapture?macWorkerActive:state.liveStream===stream))void stop();
        }).catch(error=>{
          console.error('[DominionStar Meet] Presenter toolbar acknowledgement failed.',error);
          if(nativeMacCapture?macWorkerActive:state.liveStream===stream)void stop();
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
      qaShareTrace('QA_SHARE_START_RETURN_READY');
      return snapshot();
    }finally{
      state.busy=false;
      qaShareTrace('QA_SHARE_START_BEFORE_FINAL_EMIT');
      emit();
      qaShareTrace('QA_SHARE_START_AFTER_FINAL_EMIT');
    }
  }

  async function replaceSource({name='',options={}}={}){
    if(state.busy||!(nativeMacCapture?macWorkerActive:Boolean(state.liveStream)))return snapshot();
    if(!nativeMacCapture&&!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable on this device.');
    state.busy=true;emit();const previousLive=state.liveStream,previousFrozen=state.frozenStream;
    try{
      const {stream,track}=await acquireDisplay(options);stopComposite();state.annotationCanvas=null;if(!nativeMacCapture)state.liveStream=stream;
      state.frozenStream=null;state.freezeCanvas=null;state.paused=false;state.sourceName=String(name||track.label||'Shared content');state.options={...options};
      if(!nativeMacCapture&&track?.addEventListener)track.addEventListener('ended',()=>{if(!state.busy&&state.liveStream===stream)void stop()},{once:true});
      stopTracks(previousFrozen);if(!nativeMacCapture)stopTracks(previousLive);
      try{await bridge?.captureState?.({sourceName:state.sourceName,displayId:String(state.options?.displayId||''),paused:false})}catch{}return snapshot();
    }finally{state.busy=false;emit()}
  }

  async function captureFreezeFrame(videoElement){
    const track=state.liveStream?.getVideoTracks?.()[0];
    if(!track)throw new Error('Unable to freeze the shared frame.');
    const drawSource=async()=>{
      if(Number(videoElement?.videoWidth)>1&&Number(videoElement?.videoHeight)>1)return {source:videoElement,width:Number(videoElement.videoWidth),height:Number(videoElement.videoHeight),close:null};
      // Native Mac presenter mode intentionally detaches the visible share
      // preview to avoid recursive capture. Build a short-lived offscreen video
      // from the real worker stream so Pause still has a deterministic frame.
      if(state.liveStream){
        const probe=document.createElement('video');probe.muted=true;probe.playsInline=true;probe.autoplay=true;probe.srcObject=state.liveStream;
        try{
          await Promise.race([
            new Promise(resolve=>{if(probe.readyState>=2&&probe.videoWidth>1)return resolve();probe.onloadeddata=()=>resolve();}),
            new Promise(resolve=>setTimeout(resolve,700))
          ]);
          await probe.play().catch(()=>{});
          if(Number(probe.videoWidth)>1&&Number(probe.videoHeight)>1)return {source:probe,width:Number(probe.videoWidth),height:Number(probe.videoHeight),close:()=>{probe.pause?.();probe.srcObject=null;probe.remove?.();}};
        }catch{}finally{if(!(Number(probe.videoWidth)>1&&Number(probe.videoHeight)>1)){probe.pause?.();probe.srcObject=null;probe.remove?.();}}
      }
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

  async function waitForShareVideoTrack(timeoutMs=1600){const started=Date.now();while(Date.now()-started<timeoutMs){const track=state.liveStream?.getVideoTracks?.()[0];if(track&&track.readyState==='live')return track;await new Promise(resolve=>setTimeout(resolve,40))}return state.liveStream?.getVideoTracks?.()[0]||null}
  async function pause(videoElement){
    if(nativeMacCapture){
      if(!macWorkerActive||state.paused)return snapshot();
      const result=await captureBridge?.setPaused?.(true);
      if(!result?.ok||result?.paused!==true)throw new Error(result?.error||'Native share pause did not complete.');
      state.paused=true;emit();publishPauseState(true);return snapshot();
    }
    if(state.paused)return snapshot();if(!state.liveStream?.getVideoTracks?.()[0])await waitForShareVideoTrack();
    if(!state.liveStream?.getVideoTracks?.()[0])throw new Error('Shared video is still connecting. Try Pause again.');
    const canvas=await captureFreezeFrame(videoElement),frozen=canvas.captureStream(1);for(const audioTrack of state.liveStream.getAudioTracks?.()||[]){try{frozen.addTrack(audioTrack.clone())}catch{}}
    state.freezeCanvas=canvas;state.frozenStream=frozen;state.paused=true;if(state.annotationCanvas)startComposite();emit();publishPauseState(true);return snapshot();
  }
  async function resume(){
    if(nativeMacCapture){
      if(!macWorkerActive||!state.paused)return snapshot();
      const result=await captureBridge?.setPaused?.(false);
      if(!result?.ok||result?.paused!==false)throw new Error(result?.error||'Native share resume did not complete.');
      state.paused=false;emit();publishPauseState(false);return snapshot();
    }
    if(!state.liveStream||!state.paused)return snapshot();stopTracks(state.frozenStream);state.frozenStream=null;state.freezeCanvas=null;state.paused=false;if(state.annotationCanvas)startComposite();emit();publishPauseState(false);return snapshot();
  }
  async function togglePause(videoElement){return state.paused?resume():pause(videoElement)}
  function outputStream(){return state.annotationCanvas&&state.compositeStream?state.compositeStream:baseOutputStream()}
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
  async function stop(options={}){displayRequestGeneration+=1;const hadShare=nativeMacCapture?Boolean(macWorkerActive):Boolean(state.liveStream||state.frozenStream);
    const waitForCleanup=Boolean(options?.waitForCleanup);
    state.annotationCanvas=null;
    stopComposite();
    // Stop Share is local-first: terminate capture immediately, then optionally
    // wait for bounded main-process cleanup when the entire meeting is ending.
    stopTracks(state.frozenStream);stopTracks(state.liveStream);
    state.liveStream=null;state.frozenStream=null;state.freezeCanvas=null;state.paused=false;state.busy=false;state.sourceName='';state.options={};
    if(nativeMacCapture){macWorkerActive=false;disposeMacCaptureClient({stopWorker:true});}
    emit();
    let cleanupPromise=Promise.resolve();
    if(hadShare||nativeMacCapture){
      try{
        cleanupPromise=Promise.resolve(bridge?.captureStopped?.()).catch(error=>{console.warn('[DominionStar Meet] Share-stop chrome cleanup failed.',error);});
      }catch(error){console.warn('[DominionStar Meet] Share-stop chrome cleanup failed.',error);}
    }
    if(waitForCleanup&&(hadShare||nativeMacCapture)){
      await Promise.race([cleanupPromise,new Promise(resolve=>setTimeout(resolve,1800))]);
    }else{
      void cleanupPromise;
    }
    return snapshot();
  }
  const api=Object.freeze({start,replaceSource,pause,resume,togglePause,stop,outputStream,setAnnotationCanvas,snapshot,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}});
  window.DominionShareController=api;
})();