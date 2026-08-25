import { app, ipcMain, systemPreferences } from 'electron';

const TRUSTED_HOSTS=new Set(['dominionstarld.com','www.dominionstarld.com']);
const QA_PREVIEW_HOST=/^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;

function isTrustedDesktopRenderer(event){
  try{const url=new URL(String(event?.sender?.getURL?.()||''));if(url.protocol!=='https:')return false;const host=url.hostname.toLowerCase();return TRUSTED_HOSTS.has(host)||QA_PREVIEW_HOST.test(host);}catch{return false;}
}

function rawScreenPermission(){
  if(process.platform!=='darwin')return 'granted';
  try{return String(systemPreferences.getMediaAccessStatus('screen')||'unknown').toLowerCase();}catch{return 'unknown';}
}

const initialScreenPermission=rawScreenPermission();

function snapshot(raw){
  const granted=raw==='granted';
  return {
    ok:true,
    platform:process.platform,
    screen:raw,
    rawScreen:raw,
    initialScreen:initialScreenPermission,
    changedSinceLaunch:raw!==initialScreenPermission,
    requiresRestart:process.platform==='darwin'&&granted&&initialScreenPermission!=='granted',
    captureReady:granted,
    captureProbed:false,
    sourceCount:0,
    screenCount:0,
    windowCount:0,
    previewCount:0,
    captureError:granted?'':'screen-permission-not-granted'
  };
}

// IMPORTANT: permission status must never enumerate desktop capture sources.
// On macOS, desktopCapturer.getSources() can stall while Screen Recording
// permission is being changed. Source enumeration happens only after this
// lightweight TCC status gate reports granted.
async function readScreenPermission(){
  return snapshot(rawScreenPermission());
}

async function probeScreenCapture(){
  const state=await readScreenPermission();
  return {
    captureReady:state.captureReady,
    captureProbed:false,
    sourceCount:0,
    screenCount:0,
    windowCount:0,
    previewCount:0,
    captureError:state.captureError
  };
}

ipcMain.handle('desktop:screen-permission-status',async event=>{
  if(!isTrustedDesktopRenderer(event))return {ok:false,platform:process.platform,screen:'denied',rawScreen:'denied',initialScreen:initialScreenPermission,changedSinceLaunch:false,requiresRestart:false,captureReady:false,captureProbed:false,sourceCount:0,screenCount:0,windowCount:0,previewCount:0,captureError:'untrusted-renderer'};
  return readScreenPermission();
});

ipcMain.handle('desktop:relaunch-for-permissions',event=>{
  if(!isTrustedDesktopRenderer(event)||process.platform!=='darwin')return false;
  app.relaunch();setImmediate(()=>app.exit(0));return true;
});

export { readScreenPermission, probeScreenCapture };
export const DominionScreenPermissionLifecycle=Object.freeze({readScreenPermission,probeScreenCapture});