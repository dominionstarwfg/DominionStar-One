(()=>{
  if(window.DominionShareController)return;
  const bridge=window.dominionDesktop?.share;
  const state={liveStream:null,frozenStream:null,freezeCanvas:null,paused:false,busy:false,sourceName:'',options:{}};
  const listeners=new Set();
  const snapshot=()=>({active:Boolean(state.liveStream),paused:state.paused,busy:state.busy,sourceName:state.sourceName,options:{...state.options}});
  const emit=()=>{const value=snapshot();for(const listener of listeners){try{listener(value);}catch{}}};
  const stopTracks=stream=>{for(const track of stream?.getTracks?.()||[]){if(track.readyState!=='ended'){try{track.stop();}catch{}}}};

  async function start({name='',options={}}={}){
    if(state.busy||state.liveStream)return snapshot();
    if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable on this device.');
    state.busy=true;emit();
    try{
      const optimize=Boolean(options.optimizeVideo);
      const stream=await navigator.mediaDevices.getDisplayMedia({audio:false,video:{frameRate:optimize?{ideal:30,max:30}:{ideal:15,max:30}}});
      const track=stream.getVideoTracks()[0];
      if(!track)throw new Error('No screen capture track was returned.');
      state.liveStream=stream;state.sourceName=String(name||track.label||'Shared content');state.options={...options};state.paused=false;
      track.addEventListener('ended',()=>{if(state.liveStream===stream)void stop();},{once:true});
      await bridge?.captureStarted?.({sourceName:state.sourceName,paused:false});
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
    state.freezeCanvas=canvas;state.frozenStream=frozen;state.paused=true;emit();await bridge?.captureState?.({sourceName:state.sourceName,paused:true});return snapshot();
  }

  async function resume(){if(!state.liveStream||!state.paused)return snapshot();stopTracks(state.frozenStream);state.frozenStream=null;state.freezeCanvas=null;state.paused=false;emit();await bridge?.captureState?.({sourceName:state.sourceName,paused:false});return snapshot();}
  async function togglePause(videoElement){return state.paused?resume():pause(videoElement);}
  function outputStream(){return state.paused&&state.frozenStream?state.frozenStream:state.liveStream;}
  async function stop(){const hadShare=Boolean(state.liveStream||state.frozenStream);stopTracks(state.frozenStream);stopTracks(state.liveStream);state.liveStream=null;state.frozenStream=null;state.freezeCanvas=null;state.paused=false;state.busy=false;state.sourceName='';state.options={};emit();if(hadShare)await bridge?.captureStopped?.();return snapshot();}
  const api=Object.freeze({start,pause,resume,togglePause,stop,outputStream,snapshot,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}});
  window.DominionShareController=api;
})();
