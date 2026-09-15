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
      const payload=await main.webContents.executeJavaScript(`(()=>{
        const video=document.querySelector('#localMeetingVideo');
        const stream=video?.srcObject instanceof MediaStream?video.srcObject:null;
        const track=stream?.getVideoTracks?.()[0]||null;
        const cameraLive=Boolean(track&&track.readyState==='live'&&track.enabled!==false);
        if(!cameraLive||!video||video.readyState<2||video.videoWidth<2||video.videoHeight<2)return {cameraLive:false,frame:''};
        const maxWidth=320,width=Math.min(maxWidth,Math.max(2,Number(video.videoWidth)||320));
        const height=Math.max(2,Math.round(width*(Number(video.videoHeight)||180)/Math.max(2,Number(video.videoWidth)||320)));
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d',{alpha:false});if(!context)return {cameraLive:false,frame:''};
        context.drawImage(video,0,0,width,height);
        return {cameraLive:true,frame:canvas.toDataURL('image/jpeg',0.62),mirrored:Boolean(getComputedStyle(video).transform&&getComputedStyle(video).transform!=='none')};
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
