import updater from 'electron-updater';
const {autoUpdater}=updater;
let status={state:'idle',version:'',progress:0,error:''};

export function initializeDesktopUpdater({app,windowProvider,notify}){
  if(!app.isPackaged){status={...status,state:'development'};return;}
  autoUpdater.autoDownload=true;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.allowPrerelease=false;
  const publish=next=>{status={...status,...next};const win=windowProvider();if(win&&!win.isDestroyed())win.webContents.send('desktop:update-status',status);};
  autoUpdater.on('checking-for-update',()=>publish({state:'checking',error:''}));
  autoUpdater.on('update-available',info=>publish({state:'downloading',version:info.version,progress:0}));
  autoUpdater.on('update-not-available',()=>publish({state:'current',version:app.getVersion(),progress:100}));
  autoUpdater.on('download-progress',progress=>publish({state:'downloading',progress:Math.round(progress.percent||0)}));
  autoUpdater.on('update-downloaded',info=>{publish({state:'ready',version:info.version,progress:100});notify?.(`DominionStar Meet ${info.version} is ready. It will install when you close the app.`);});
  autoUpdater.on('error',error=>publish({state:'error',error:String(error?.message||error).slice(0,240)}));
  setTimeout(()=>autoUpdater.checkForUpdates().catch(()=>{}),12000);
}
export const desktopUpdateStatus=()=>Object.freeze({...status});
export const checkForDesktopUpdate=()=>autoUpdater.checkForUpdates();
export const installDesktopUpdate=()=>{if(status.state!=='ready')return false;setImmediate(()=>autoUpdater.quitAndInstall(false,true));return true;};

