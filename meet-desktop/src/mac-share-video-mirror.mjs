import { BrowserWindow, ipcMain } from 'electron';

//
// Zoom-style presenter video mirroring for macOS.
//
// The meeting renderer remains the only camera owner. The floating presenter
// panel never calls getUserMedia; it renders frames from the already-owned
// DominionMediaController stream so camera permission/device ownership stays
// with the active meeting.
//
if(process.platform==='darwin'){
  const FRAME_INTERVAL_MS=66;
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
        const track=stream?.getVideoTracks?.().find(track=>track?.readyState==='live')||null;
        const cameraOn=snapshot.cameraOn!==false;
        const cameraLive=Boolean(cameraOn&&snapshot.videoLive!==false&&track&&track.enabled!==false);
        const mirrored=snapshot.mirror!==false;
        if(!cameraLive)return {cameraOn,cameraLive:false,pending:false,frame:'',mirrored};

        let video=window.__dsPresenterMirrorVideo||null;
        if(!video){
          video=document.createElement('video');
          video.autoplay=true;video.muted=true;video.playsInline=true;
          video.setAttribute('aria-hidden','true');
          Object.assign(video.style,{position:'fixed',left:'-10000px',top:'0',width:'640px',height:'360px',opacity:'0.001',pointerEvents:'none',zIndex:'-1'});
          document.body.append(video);
          window.__dsPresenterMirrorVideo=video;
        }
        if(video.srcObject!==stream){video.srcObject=stream;}
        if(video.paused||video.readyState<2){try{await video.play();}catch{}}
        if(video.readyState<2||video.videoWidth<2||video.videoHeight<2)return {cameraOn:true,cameraLive:false,pending:true,frame:'',mirrored};

        const maxWidth=640,width=Math.min(maxWidth,Math.max(2,Number(video.videoWidth)||640));
        const height=Math.max(2,Math.round(width*(Number(video.videoHeight)||360)/Math.max(2,Number(video.videoWidth)||640)));
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d',{alpha:false,desynchronized:true});if(!context)return {cameraOn:true,cameraLive:false,pending:true,frame:'',mirrored};
        context.drawImage(video,0,0,width,height);
        return {cameraOn:true,cameraLive:true,pending:false,frame:canvas.toDataURL('image/jpeg',0.72),mirrored};
      })()`,true).catch(()=>({cameraOn:true,cameraLive:false,pending:true,frame:'',mirrored:true}));
      if(shareActive)publish(payload||{cameraOn:true,cameraLive:false,pending:true,frame:'',mirrored:true});
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
    publish({cameraOn:false,cameraLive:false,pending:false,frame:''});
  }

  ipcMain.on('share:capture-started',start);
  ipcMain.on('mac-share:capture-stopped',stop);
}
