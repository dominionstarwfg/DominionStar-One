(()=>{
  if(window.DominionShareController)return;
  const bridge=window.dominionDesktop?.share;
  const state={liveStream:null,frozenStream:null,freezeCanvas:null,paused:false,busy:false,sourceName:'',options:{},annotationCanvas:null,compositeCanvas:null,compositeStream:null,compositeVideo:null,compositeRaf:0};
  const listeners=new Set();
  const snapshot=()=>({active:Boolean(state.liveStream),paused:state.paused,busy:state.busy,sourceName:state.sourceName,options:{...state.options},annotating:Boolean(state.annotationCanvas)});
  const emit=()=>{const value=snapshot();for(const listener of listeners){try{listener(value);}catch{}}};
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

  async function acquireDisplay(options={}){
    const optimize=Boolean(options.optimizeVideo),shareAudio=Boolean(options.shareAudio);
    const stream=await navigator.mediaDevices.getDisplayMedia({audio:shareAudio,video:{frameRate:optimize?{ideal:30,max:30}:{ideal:15,max:30}}});
    const track=stream.getVideoTracks()[0];
    if(!track){stopTracks(stream);throw new Error('No screen capture track was returned.');}
    try{track.contentHint=optimize?'motion':'detail';}catch{}
    for(const audioTrack of stream.getAudioTracks?.()||[]){try{audioTrack.contentHint='music';}catch{}}
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
      try{presenter=await bridge?.captureStarted?.({sourceName:state.sourceName,paused:false});}
      catch(error){
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
      track.addEventListener('ended',()=>{if(state.liveStream===stream)void stop();},{once:true});
      stopTracks(previousFrozen);stopTracks(previousLive);
      try{await bridge?.captureState?.({sourceName:state.sourceName,paused:false});}catch{}
      return snapshot();
    }finally{state.busy=false;emit();}
  }

  async function pause(videoElement){
    if(!state.liveStream||state.paused)return snapshot();
    const width=Math.max(2,Number(videoElement?.videoWidth)||1280),height=Math.max(2,Number(videoElement?.videoHeight)||720);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('Unable to freeze the shared frame.');
    context.drawImage(videoElement,0,0,width,height);
    const frozen=canvas.captureStream(1);
    for(const audioTrack of state.liveStream.getAudioTracks?.()||[]){try{frozen.addTrack(audioTrack.clone());}catch{}}
    state.freezeCanvas=canvas;state.frozenStream=frozen;state.paused=true;if(state.annotationCanvas)startComposite();emit();await bridge?.captureState?.({sourceName:state.sourceName,paused:true});return snapshot();
  }

  async function resume(){if(!state.liveStream||!state.paused)return snapshot();stopTracks(state.frozenStream);state.frozenStream=null;state.freezeCanvas=null;state.paused=false;if(state.annotationCanvas)startComposite();emit();await bridge?.captureState?.({sourceName:state.sourceName,paused:false});return snapshot();}
  async function togglePause(videoElement){return state.paused?resume():pause(videoElement);}
  function outputStream(){return state.annotationCanvas&&state.compositeStream?state.compositeStream:baseOutputStream();}
  function setAnnotationCanvas(canvas){state.annotationCanvas=canvas||null;if(state.annotationCanvas)startComposite();else{stopComposite();emit();}return snapshot();}
  async function stop(){const hadShare=Boolean(state.liveStream||state.frozenStream);state.annotationCanvas=null;stopComposite();stopTracks(state.frozenStream);stopTracks(state.liveStream);state.liveStream=null;state.frozenStream=null;state.freezeCanvas=null;state.paused=false;state.busy=false;state.sourceName='';state.options={};emit();if(hadShare)await bridge?.captureStopped?.();return snapshot();}
  const api=Object.freeze({start,replaceSource,pause,resume,togglePause,stop,outputStream,setAnnotationCanvas,snapshot,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}});
  window.DominionShareController=api;
})();
