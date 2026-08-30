import { app, ipcMain } from 'electron';

// Screen Recording grants can require a full process restart before the same
// installed application can enumerate readable screen sources. Keep this
// restart path in the main process so the renderer never has to fake a reload.
if(!ipcMain.listenerCount('app:relaunch')){
  ipcMain.handle('app:relaunch',()=>{
    setImmediate(()=>{
      app.relaunch();
      app.exit(0);
    });
    return {ok:true};
  });
}

if(!ipcMain.listenerCount('app:privacy-identity')){
  ipcMain.handle('app:privacy-identity',()=>({
    platform:process.platform,
    signingMode:'adhoc',
    stableAcrossRebuilds:false,
    screenPermissionPersistence:'not-certified'
  }));
}
