import { app, ipcMain, systemPreferences } from 'electron';

const TRUSTED_HOSTS=new Set(['dominionstarld.com','www.dominionstarld.com']);
const QA_PREVIEW_HOST=/^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;

function isTrustedDesktopRenderer(event){
  try{const url=new URL(String(event?.sender?.getURL?.()||''));if(url.protocol!=='https:')return false;const host=url.hostname.toLowerCase();return TRUSTED_HOSTS.has(host)||QA_PREVIEW_HOST.test(host);}catch{return false;}
}
function rawScreenPermission(){if(process.platform!=='darwin')return 'granted';try{return String(systemPreferences.getMediaAccessStatus('screen')||'unknown').toLowerCase();}catch{return 'unknown';}}
const initialScreenPermission=rawScreenPermission();

function snapshot(raw,{requiresRestart=false}={}){
  return {ok:true,platform:process.platform,screen:raw,rawScreen:raw,initialScreen:initialScreenPermission,changedSinceLaunch:raw!==initialScreenPermission,requiresRestart:Boolean(requiresRestart),captureReady:false,captureProbed:false,sourceCount:0,screenCount:0,windowCount:0,previewCount:0,captureError:''};
}

// This API is intentionally side-effect free. It only reads macOS permission
// state. Actual capture-source enumeration happens once, after the user presses
// Share Screen and the branded picker confirms that macOS reports access granted.
async function readScreenPermission(){
  const raw=rawScreenPermission();
  if(process.platform!=='darwin')return snapshot('granted');
  if(raw!=='granted')return snapshot(raw);
  if(initialScreenPermission!=='granted')return {...snapshot('granted',{requiresRestart:true}),captureError:'restart-required-after-screen-permission-change'};
  return snapshot('granted');
}

ipcMain.handle('desktop:screen-permission-status',async event=>{
  if(!isTrustedDesktopRenderer(event))return {ok:false,platform:process.platform,screen:'denied',rawScreen:'denied',initialScreen:initialScreenPermission,changedSinceLaunch:false,requiresRestart:false,captureReady:false,captureProbed:false,sourceCount:0,screenCount:0,windowCount:0,previewCount:0,captureError:'untrusted-renderer'};
  return readScreenPermission();
});

ipcMain.handle('desktop:relaunch-for-permissions',event=>{
  if(!isTrustedDesktopRenderer(event)||process.platform!=='darwin')return false;
  app.relaunch();setImmediate(()=>app.exit(0));return true;
});

export { readScreenPermission };
export const DominionScreenPermissionLifecycle=Object.freeze({readScreenPermission});