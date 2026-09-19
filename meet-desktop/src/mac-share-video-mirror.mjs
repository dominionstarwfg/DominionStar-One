import { BrowserWindow, ipcMain } from 'electron';

//
// macOS presenter video forwarding.
//
// The meeting renderer is the single camera owner and pushes already-decoded
// frames outward. Main never executes JavaScript back into an occluded meeting
// renderer just to obtain video; that cross-renderer pull was the source of the
// persistent "Starting video…" tile on physical Macs.
//
if(process.platform==='darwin'){
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
    const target=videoWindow();if(!alive(target)||target.webContents?.isDestroyed?.())return false;
    try{target.webContents.send('mac-share:video-frame',payload||{});return true;}catch{return false;}
  };

  ipcMain.on('mac-share:video-frame',(event,payload={})=>{
    const main=mainWindow();
    if(!alive(main)||event.sender!==main.webContents)return;
    const frame=typeof payload?.frame==='string'?payload.frame:'';
    // Keep IPC payload bounded. A 640x360 JPEG data URL should be far below
    // this ceiling; oversized data is dropped rather than stalling presenter UI.
    if(frame.length>900000)return;
    publish({
      cameraOn:payload?.cameraOn!==false,
      cameraLive:Boolean(payload?.cameraLive&&frame),
      pending:Boolean(payload?.pending),
      frame,
      mirrored:payload?.mirrored!==false
    });
  });

  ipcMain.on('share:capture-started',event=>{
    const main=mainWindow();if(!alive(main)||event.sender!==main.webContents)return;
    publish({cameraOn:true,cameraLive:false,pending:true,frame:'',mirrored:true});
  });
  ipcMain.on('mac-share:capture-stopped',()=>publish({cameraOn:false,cameraLive:false,pending:false,frame:'',mirrored:true}));
}
