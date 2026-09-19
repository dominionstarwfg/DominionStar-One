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
        const controller=window.DominionMediaController||null;
        const controllerStream=controller?.stream?.();
        const legacyVideo=document.querySelector('#localMeetingVideo');
        const stream=controllerStream instanceof MediaStream?controllerStream:(legacyVideo?.srcObject instanceof MediaStream?legacyVideo.srcObject:null);
        const track=stream?.getVideoTracks?.()[0]||null;
        const cameraLive=Boolean(track&&track.readyState==='live'&&track.enabled!==false);
        if(!cameraLive)return {cameraLive:false,frame:''};
        const candidates=[...document.querySelectorAll('video')].filter(video=>{
          const source=video?.srcObject;
          if(!(source instanceof MediaStream))return false;
          const candidateTrack=source.getVideoTracks?.()[0]||null;
          return candidateTrack?.id===track.id&&video.readyState>=2&&video.videoWidth>1&&video.videoHeight>1;
        });
        const video=candidates.find(item=>item.id==='localMeetingVideo')||candidates[0]||null;
        let source=video,width=Number(video?.videoWidth)||0,height=Number(video?.videoHeight)||0,close=null,mirrored=video?Boolean(getComputedStyle(video).transform&&getComputedStyle(video).transform!=='none'):true;
        if(!source&&typeof ImageCapture==='function'){
          try{
            const bitmap=await new ImageCapture(track).grabFrame();
            source=bitmap;width=Number(bitmap.width)||0;height=Number(bitmap.height)||0;close=()=>bitmap.close?.();
          }catch{}
        }
        if(!source||width<2||height<2)return {cameraLive:true,frame:'',mirrored};
        const maxWidth=320,outWidth=Math.min(maxWidth,Math.max(2,width));
        const outHeight=Math.max(2,Math.round(outWidth*height/Math.max(2,width)));
        const canvas=document.createElement('canvas');canvas.width=outWidth;canvas.height=outHeight;
        const context=canvas.getContext('2d',{alpha:false});if(!context){close?.();return {cameraLive:true,frame:'',mirrored};}
        context.drawImage(source,0,0,outWidth,outHeight);close?.();
        return {cameraLive:true,frame:canvas.toDataURL('image/jpeg',0.68),mirrored};
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
