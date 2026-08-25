import { app, desktopCapturer, ipcMain, systemPreferences } from 'electron';

const TRUSTED_HOSTS=new Set(['dominionstarld.com','www.dominionstarld.com']);
const QA_PREVIEW_HOST=/^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;
const CAPTURE_PROBE_TIMEOUT_MS=1800;

function isTrustedDesktopRenderer(event){
  try{const url=new URL(String(event?.sender?.getURL?.()||''));if(url.protocol!=='https:')return false;const host=url.hostname.toLowerCase();return TRUSTED_HOSTS.has(host)||QA_PREVIEW_HOST.test(host);}catch{return false;}
}
function rawScreenPermission(){if(process.platform!=='darwin')return 'granted';try{return String(systemPreferences.getMediaAccessStatus('screen')||'unknown').toLowerCase();}catch{return 'unknown';}}
const initialScreenPermission=rawScreenPermission();

function snapshot(raw,{requiresRestart=false}={}){
  return {ok:true,platform:process.platform,screen:raw,rawScreen:raw,initialScreen:initialScreenPermission,changedSinceLaunch:raw!==initialScreenPermission,requiresRestart:Boolean(requiresRestart),captureReady:false,captureProbed:false,sourceCount:0,screenCount:0,windowCount:0,previewCount:0,captureError:''};
}

async function probeScreenCapture(){
  if(process.platform!=='darwin')return {captureReady:true,captureProbed:false,sourceCount:0,screenCount:0,windowCount:0,previewCount:0,captureError:''};
  let timer=null;
  try{
    const sources=await Promise.race([
      desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:8,height:8},fetchWindowIcons:false}),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('capture-probe-timeout')),CAPTURE_PROBE_TIMEOUT_MS);})
    ]);
    const list=Array.isArray(sources)?sources:[];
    const previewCount=list.filter(source=>{try{return source.thumbnail&&!source.thumbnail.isEmpty();}catch{return false;}}).length;
    return {
      captureReady:previewCount>0,
      captureProbed:true,
      sourceCount:list.length,
      screenCount:list.filter(source=>String(source.id||'').startsWith('screen:')).length,
      windowCount:list.filter(source=>String(source.id||'').startsWith('window:')).length,
      previewCount,
      captureError:previewCount>0?'':'capture-preview-unavailable'
    };
  }catch(error){
    return {captureReady:false,captureProbed:true,sourceCount:0,screenCount:0,windowCount:0,previewCount:0,captureError:String(error?.message||'capture-probe-failed')};
  }finally{clearTimeout(timer);}
}

// macOS permission strings can lag behind an unsigned QA app. A successful
// capture preview is stronger evidence than stale TCC text, so the fallback
// custom picker uses both signals. Modern macOS uses the native system picker
// and normally never needs this path.
async function readScreenPermission(){
  const raw=rawScreenPermission();
  if(process.platform!=='darwin')return snapshot('granted');
  const probe=await probeScreenCapture();
  if(probe.captureReady)return {...snapshot('granted'),rawScreen:raw,changedSinceLaunch:raw!==initialScreenPermission,...probe,requiresRestart:false};
  if(raw!=='granted')return {...snapshot(raw),...probe};
  return {...snapshot('granted',{requiresRestart:initialScreenPermission!=='granted'}),...probe};
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