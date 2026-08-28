(()=>{
  if(window.DominionVideoEffects)return;
  const STORAGE=Object.freeze({autoFrame:'ds_meet_auto_frame',autoFrameStrength:'ds_meet_auto_frame_strength',backgroundBlur:'ds_meet_background_blur',blurStrength:'ds_meet_background_blur_strength'});
  const read=(key,fallback='')=>{try{const v=localStorage.getItem(STORAGE[key]);return v===null?fallback:v;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(STORAGE[key],String(value));}catch{}};
  const state={enabled:read('autoFrame','0')==='1',strength:Number(read('autoFrameStrength','55'))||55,backgroundBlur:read('backgroundBlur','0')==='1',blurStrength:Number(read('blurStrength','55'))||55,sourceTrack:null,canvas:null,ctx:null,video:null,stream:null,frameHandle:0,faceDetector:null,lastFace:null,lastDetectAt:0};
  const listeners=new Set();
  const emit=()=>{const snap=api.snapshot();for(const fn of listeners){try{fn(snap);}catch{}}};

  function supported(){return typeof HTMLCanvasElement!=='undefined'&&typeof document!=='undefined';}
  function faceDetectionSupported(){return typeof window.FaceDetector==='function';}
  function ensureSurface(){
    if(state.canvas)return;
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    const video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;
    state.canvas=canvas;state.ctx=canvas.getContext('2d',{alpha:false});state.video=video;
    if(faceDetectionSupported()){try{state.faceDetector=new FaceDetector({fastMode:true,maxDetectedFaces:1});}catch{}}
  }
  function stopLoop(){if(state.frameHandle)cancelAnimationFrame(state.frameHandle);state.frameHandle=0;}
  function stopOutput(){stopLoop();for(const track of state.stream?.getTracks?.()||[]){try{track.stop();}catch{}}state.stream=null;state.video&&(state.video.srcObject=null);}
  async function detectFace(){
    if(!state.faceDetector||!state.video||state.video.readyState<2)return;
    if(performance.now()-state.lastDetectAt<220)return;
    state.lastDetectAt=performance.now();
    try{
      const faces=await state.faceDetector.detect(state.video);
      const box=faces?.[0]?.boundingBox;
      if(box&&Number.isFinite(box.x)&&Number.isFinite(box.width)){
        const next={x:box.x,y:box.y,width:box.width,height:box.height};
        if(state.lastFace){
          const a=.72,b=.28;
          state.lastFace={x:state.lastFace.x*a+next.x*b,y:state.lastFace.y*a+next.y*b,width:state.lastFace.width*a+next.width*b,height:state.lastFace.height*a+next.height*b};
        }else state.lastFace=next;
      }
    }catch{}
  }
  function cropForFrame(sw,sh){
    const targetAspect=16/9;
    let cropW=sw,cropH=sh;
    if(sw/sh>targetAspect)cropW=sh*targetAspect;else cropH=sw/targetAspect;
    let sx=(sw-cropW)/2,sy=(sh-cropH)/2;
    if(state.enabled&&state.lastFace){
      const face=state.lastFace,strength=Math.max(0,Math.min(100,state.strength))/100;
      const desiredW=Math.max(face.width*2.25,sw*(.72-.18*strength));
      const desiredH=desiredW/targetAspect;
      cropW=Math.min(sw,Math.max(face.width*1.7,desiredW));
      cropH=Math.min(sh,Math.max(face.height*2.1,desiredH));
      if(cropW/cropH>targetAspect)cropW=cropH*targetAspect;else cropH=cropW/targetAspect;
      const cx=face.x+face.width/2,cy=face.y+face.height*.46;
      sx=Math.max(0,Math.min(sw-cropW,cx-cropW/2));
      sy=Math.max(0,Math.min(sh-cropH,cy-cropH*.42));
    }
    return {sx,sy,cropW,cropH};
  }
  function draw(){
    if(!state.stream||!state.sourceTrack||state.sourceTrack.readyState!=='live')return;
    const v=state.video,ctx=state.ctx,c=state.canvas;
    if(v.readyState>=2){
      const sw=v.videoWidth||1280,sh=v.videoHeight||720;
      if(c.width!==1280||c.height!==720){c.width=1280;c.height=720;}
      void detectFace();
      const {sx,sy,cropW,cropH}=cropForFrame(sw,sh);
      if(state.backgroundBlur&&state.lastFace){
        const blurPx=8+Math.round((Math.max(0,Math.min(100,state.blurStrength))/100)*24);
        ctx.save();ctx.filter=`blur(${blurPx}px)`;ctx.drawImage(v,sx,sy,cropW,cropH,-18,-18,c.width+36,c.height+36);ctx.restore();
        const face=state.lastFace;
        const fx=((face.x+face.width/2-sx)/cropW)*c.width;
        const fy=((face.y+face.height*.52-sy)/cropH)*c.height;
        const fw=(face.width/cropW)*c.width;
        const fh=(face.height/cropH)*c.height;
        const personW=Math.max(fw*2.8,c.width*.28),personH=Math.max(fh*5.3,c.height*.72);
        ctx.save();
        ctx.beginPath();ctx.ellipse(fx,fy+personH*.27,personW*.5,personH*.5,0,0,Math.PI*2);ctx.clip();
        ctx.filter='none';ctx.drawImage(v,sx,sy,cropW,cropH,0,0,c.width,c.height);ctx.restore();
      }else{
        ctx.filter='none';ctx.drawImage(v,sx,sy,cropW,cropH,0,0,c.width,c.height);
      }
    }
    state.frameHandle=requestAnimationFrame(draw);
  }
  async function attach(track){
    if(state.sourceTrack===track&&state.stream)return state.stream;
    stopOutput();state.sourceTrack=track||null;state.lastFace=null;
    if(!track||!supported())return null;
    ensureSurface();
    state.video.srcObject=new MediaStream([track]);
    await state.video.play().catch(()=>{});
    const capture=state.canvas.captureStream?.(30);if(!capture)return null;
    state.stream=capture;draw();emit();return state.stream;
  }
  const api=Object.freeze({
    async attach(track){return attach(track);},
    async outputStream(track){if(!state.enabled&&!state.backgroundBlur)return track?new MediaStream([track]):null;return attach(track);},
    setAutoFrame(on){state.enabled=Boolean(on);write('autoFrame',state.enabled?'1':'0');state.lastFace=null;emit();return api.snapshot();},
    setStrength(value){state.strength=Math.max(0,Math.min(100,Number(value)||0));write('autoFrameStrength',state.strength);emit();return api.snapshot();},
    setBackgroundBlur(on){state.backgroundBlur=Boolean(on);write('backgroundBlur',state.backgroundBlur?'1':'0');state.lastFace=null;emit();return api.snapshot();},
    setBlurStrength(value){state.blurStrength=Math.max(0,Math.min(100,Number(value)||0));write('blurStrength',state.blurStrength);emit();return api.snapshot();},
    stop(){stopOutput();state.sourceTrack=null;state.lastFace=null;emit();},
    snapshot(){return {autoFrame:state.enabled,strength:state.strength,backgroundBlur:state.backgroundBlur,blurStrength:state.blurStrength,faceDetectionSupported:faceDetectionSupported(),processing:Boolean(state.stream)};},
    onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  });
  window.DominionVideoEffects=api;
})();