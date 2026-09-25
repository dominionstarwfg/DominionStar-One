import { BrowserWindow, ipcMain } from 'electron';

// The meeting renderer is the single owner of camera truth. During an active
// macOS share it publishes low-rate JPEG preview frames through
// mac-share:camera-frame. The floating presenter video window only mirrors
// those frames; this module never polls the renderer and never acquires a
// second camera track.
if(process.platform==='darwin'){
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

  ipcMain.on('share:capture-started',()=>{shareActive=true;});
  ipcMain.on('mac-share:camera-frame',(event,payload={})=>{
    const main=mainWindow();
    if(!shareActive||!alive(main)||event.sender!==main.webContents)return;
    publish({
      cameraLive:payload?.cameraLive!==false,
      bytes:payload?.bytes||null,
      mime:String(payload?.mime||'image/jpeg'),
      frame:String(payload?.frame||''),
      mirrored:payload?.mirrored!==false
    });
  });
  ipcMain.on('mac-share:capture-stopped',()=>{
    shareActive=false;
    publish({cameraLive:false,bytes:null,mime:'',frame:'',mirrored:true});
  });
}
