(()=>{
  'use strict';
  if(window.DominionLocalRecording)return;

  const state={recorder:null,chunks:[],stream:null,canvas:null,frame:0,audioContext:null,startedAt:0,recording:false};
  const $=id=>document.getElementById(id);
  const uniqueTracks=(kind)=>{
    const seen=new Set();const tracks=[];
    document.querySelectorAll('video').forEach(video=>{
      const stream=video.srcObject;
      if(!(stream instanceof MediaStream))return;
      stream.getTracks().filter(track=>track.kind===kind&&track.readyState==='live').forEach(track=>{
        if(seen.has(track.id))return;seen.add(track.id);tracks.push(track);
      });
    });
    return tracks;
  };
  const mimeType=()=>[
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ].find(type=>window.MediaRecorder?.isTypeSupported?.(type))||'';
  const safeFileTime=()=>new Date().toISOString().replace(/[:.]/g,'-');
  const fire=(type,detail={})=>window.dispatchEvent(new CustomEvent(`dominion:recording-${type}`,{detail}));
  const drawCover=(ctx,video,x,y,w,h)=>{
    if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return false;
    const scale=Math.max(w/video.videoWidth,h/video.videoHeight);
    const sw=w/scale,sh=h/scale,sx=(video.videoWidth-sw)/2,sy=(video.videoHeight-sh)/2;
    try{ctx.drawImage(video,sx,sy,sw,sh,x,y,w,h);return true;}catch{return false;}
  };
  const renderFrame=()=>{
    if(!state.recording||!state.canvas)return;
    const canvas=state.canvas,ctx=canvas.getContext('2d',{alpha:false});
    const stage=$('stageVideo');
    ctx.fillStyle='#05070b';ctx.fillRect(0,0,canvas.width,canvas.height);
    const drew=drawCover(ctx,stage,0,0,canvas.width,canvas.height);
    if(!drew){
      const self=$('selfVideo');
      if(!drawCover(ctx,self,0,0,canvas.width,canvas.height)){
        ctx.fillStyle='#111827';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#f4c95d';ctx.font='700 34px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';ctx.textAlign='center';ctx.fillText('DOMINIONSTAR MEET',canvas.width/2,canvas.height/2);
      }
    }
    const name=String($('speakerName')?.textContent||$('stageName')?.textContent||'').trim();
    if(name){
      ctx.font='600 22px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
      const pad=12,textWidth=Math.min(canvas.width-40,ctx.measureText(name).width+pad*2);
      ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(18,canvas.height-58,textWidth,38);
      ctx.fillStyle='#fff';ctx.textAlign='left';ctx.fillText(name,18+pad,canvas.height-32);
    }
    state.frame=requestAnimationFrame(renderFrame);
  };
  const createAudioTrack=async()=>{
    const tracks=uniqueTracks('audio');
    if(!tracks.length)return null;
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return tracks[0]||null;
    const context=new AudioCtx();state.audioContext=context;
    try{if(context.state==='suspended')await context.resume();}catch{}
    const destination=context.createMediaStreamDestination();
    tracks.forEach(track=>{
      try{
        const source=context.createMediaStreamSource(new MediaStream([track]));
        const gain=context.createGain();gain.gain.value=1;
        source.connect(gain).connect(destination);
      }catch{}
    });
    return destination.stream.getAudioTracks()[0]||tracks[0]||null;
  };
  const download=blob=>{
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
    anchor.href=url;anchor.download=`DominionStar-Meet-${safeFileTime()}.webm`;anchor.style.display='none';
    document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  const stop=()=>new Promise(resolve=>{
    if(!state.recording||!state.recorder){resolve(false);return;}
    state.recording=false;cancelAnimationFrame(state.frame);
    const recorder=state.recorder;
    recorder.addEventListener('stop',()=>{
      try{
        const blob=new Blob(state.chunks,{type:recorder.mimeType||'video/webm'});
        if(blob.size>0)download(blob);
        fire('stopped',{durationMs:Date.now()-state.startedAt,bytes:blob.size});
      }finally{
        state.stream?.getTracks().forEach(track=>track.stop());
        state.audioContext?.close?.().catch?.(()=>{});
        Object.assign(state,{recorder:null,chunks:[],stream:null,canvas:null,frame:0,audioContext:null,startedAt:0,recording:false});
        resolve(true);
      }
    },{once:true});
    try{recorder.stop();}catch{resolve(false);}
  });
  const start=async()=>{
    if(state.recording)return true;
    if(!window.MediaRecorder)throw new Error('Recording is not supported on this desktop runtime.');
    const canvas=document.createElement('canvas');
    const stage=$('stageVideo');
    const sourceWidth=Math.max(1280,Number(stage?.videoWidth)||0),sourceHeight=Math.max(720,Number(stage?.videoHeight)||0);
    const ratio=Math.min(1,1920/sourceWidth,1080/sourceHeight);
    canvas.width=Math.max(1280,Math.round(sourceWidth*ratio));canvas.height=Math.max(720,Math.round(sourceHeight*ratio));
    const canvasStream=canvas.captureStream(30);const audioTrack=await createAudioTrack();
    const stream=new MediaStream([...canvasStream.getVideoTracks(),...(audioTrack?[audioTrack]:[])]);
    const type=mimeType();const recorder=new MediaRecorder(stream,type?{mimeType:type,videoBitsPerSecond:4500000}: {videoBitsPerSecond:4500000});
    state.recorder=recorder;state.stream=stream;state.canvas=canvas;state.chunks=[];state.startedAt=Date.now();state.recording=true;
    recorder.addEventListener('dataavailable',event=>{if(event.data?.size)state.chunks.push(event.data);});
    recorder.addEventListener('error',event=>{fire('error',{message:String(event.error?.message||'Recording error')});void stop();});
    renderFrame();recorder.start(1000);fire('started',{hasAudio:Boolean(audioTrack)});return true;
  };
  const toggle=()=>state.recording?stop():start();
  addEventListener('beforeunload',()=>{if(state.recording){try{state.recorder?.stop();}catch{}}});

  window.DominionLocalRecording=Object.freeze({
    version:'1.0.0',start,stop,toggle,isRecording:()=>state.recording,snapshot:()=>({recording:state.recording,startedAt:state.startedAt,chunks:state.chunks.length})
  });
})();
