import { BrowserWindow, ipcMain } from 'electron';

// Mirror the already-owned local camera preview into the floating macOS share
// dock. This module never calls getUserMedia and never acquires a second camera
// track. The meeting renderer remains the sole camera owner; the presenter dock
// receives low-rate JPEG preview frames only while a share is active.
if(process.platform==='darwin'){
  const FRAME_INTERVAL_MS=180;
  let frameTimer=null;
  let frameBusy=false;
  let shareActive=false;

  const alive=win=>Boolean(win&&!win.isDestroyed());
  const mainWindow=()=>BrowserWindow.getAllWindows().find(win=>{
    try{return alive(win)&&String(win.webContents?.getURL?.()||'').includes('/ui/index.html');}
    catch{return false;}
  })||null;
  const videoWindow=()=>BrowserWindow.getAllWindows().find(win=>{
    try{return alive(win)&&String(win.webContents?.getURL?.()||'').includes('/ui/mac-share-video.html');}
    catch{return false;}
  })||null;

  const publish=payload=>{
    const target=videoWindow();if(!alive(target))return false;
    try{target.webContents.send('mac-share:video-frame',payload);return true;}catch{return false;}
  };

  async function captureFrame(){
    if(!shareActive||frameBusy)return;
    const main=mainWindow();if(!alive(main)||main.webContents?.isDestroyed?.())return;
    frameBusy=true;
    try{
      const payload=await main.webContents.executeJavaScript(`(async()=>{
        const media=window.DominionMediaController||null;
        const snapshot=media?.snapshot?.()||{};
        const stream=media?.stream?.()||null;
        const track=stream?.getVideoTracks?.()[0]||null;
        const cameraLive=Boolean(snapshot.cameraOn!==false&&snapshot.videoLive!==false&&track&&track.readyState==='live'&&track.enabled!==false);
        if(!cameraLive)return {cameraLive:false,frame:'',mirrored:snapshot.mirror!==false};
        const renderFrame=(source,sourceWidth,sourceHeight)=>{
          const width=Math.min(320,Math.max(2,Number(sourceWidth)||320));
          const height=Math.max(2,Math.round(width*(Number(sourceHeight)||180)/Math.max(2,Number(sourceWidth)||320)));
          const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
          const context=canvas.getContext('2d',{alpha:false});if(!context)return '';
          context.drawImage(source,0,0,width,height);
          return canvas.toDataURL('image/jpeg',0.68);
        };
        if(typeof ImageCapture==='function'){
          try{
            const bitmap=await new ImageCapture(track).grabFrame();
            try{
              const frame=renderFrame(bitmap,bitmap.width,bitmap.height);
              if(frame)return {cameraLive:true,frame,mirrored:snapshot.mirror!==false,source:'media-track'};
            }finally{bitmap.close?.();}
          }catch{}
        }
        let video=document.querySelector('#localMeetingVideo');
        let temporary=false;
        if(!(video&&video.srcObject===stream&&video.readyState>=2&&video.videoWidth>1&&video.videoHeight>1)){
          video=document.createElement('video');temporary=true;video.autoplay=true;video.muted=true;video.playsInline=true;video.srcObject=stream;
          try{await video.play();}catch{}
          const deadline=Date.now()+320;
          while(Date.now()<deadline&&(video.readyState<2||video.videoWidth<2||video.videoHeight<2))await new Promise(resolve=>setTimeout(resolve,20));
        }
        try{
          if(video&&video.readyState>=2&&video.videoWidth>1&&video.videoHeight>1){
            const frame=renderFrame(video,video.videoWidth,video.videoHeight);
            if(frame)return {cameraLive:true,frame,mirrored:snapshot.mirror!==false,source:temporary?'media-stream-fallback':'local-video'};
          }
        }finally{if(temporary){try{video.pause();video.srcObject=null;}catch{}}}
        return {cameraLive:false,frame:'',mirrored:snapshot.mirror!==false};
      })()`,true).catch(()=>({cameraLive:false,frame:''}));
      if(shareActive)publish(payload||{cameraLive:false,frame:''});
    }finally{frameBusy=false;}
  }

  function start(){
    shareActive=true;
    if(frameTimer)clearInterval(frameTimer);
    void captureFrame();
    frameTimer=setInterval(()=>{void captureFrame();},FRAME_INTERVAL_MS);
  }
  function stop(){
    shareActive=false;frameBusy=false;
    if(frameTimer){clearInterval(frameTimer);frameTimer=null;}
    publish({cameraLive:false,frame:''});
  }

  ipcMain.on('share:capture-started',start);
  ipcMain.on('mac-share:capture-stopped',stop);
}
