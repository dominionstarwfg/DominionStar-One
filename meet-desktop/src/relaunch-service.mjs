import { app, ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);

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

// Internal prototype recovery only. Ad-hoc-signed rebuilds can leave a stale
// ScreenCapture TCC record for the same bundle name. This action is never run
// automatically; the user must explicitly choose Reset & Reauthorize.
if(!ipcMain.listenerCount('app:reset-screen-permission')){
  ipcMain.handle('app:reset-screen-permission',async()=>{
    if(process.platform!=='darwin')return {ok:false,platform:process.platform};
    try{
      await execFileAsync('/usr/bin/tccutil',['reset','ScreenCapture','com.dominionstar.desktop']);
      return {ok:true};
    }catch(error){
      return {ok:false,error:String(error?.message||error||'tcc_reset_failed')};
    }
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
