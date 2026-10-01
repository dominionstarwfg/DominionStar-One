import { app, ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);

// Do not hard-gate desktop source enumeration with
// systemPreferences.getMediaAccessStatus('screen'). Electron/macOS can report a
// stale denied state after the user has enabled Screen Recording. The explicit
// Share action is the permission boundary: real desktop source enumeration is
// the authority. If access is already granted, thumbnails load; if it is not,
// macOS owns the native permission flow.

// Screen Recording grants can require a full process restart before the same
// installed application can enumerate readable screen sources. Relaunch the
// exact executable that is currently running so DominionStar never delegates
// this recovery path to a different registered copy of the app.
if(!ipcMain.listenerCount('app:relaunch')){
  ipcMain.handle('app:relaunch',()=>{
    const execPath=process.execPath;
    const args=process.argv.slice(1);
    setImmediate(()=>{
      app.relaunch({execPath,args});
      app.exit(0);
    });
    return {ok:true,execPath};
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

let privacyIdentityPromise=null;
const signatureTarget=()=>{
  const execPath=String(process.execPath||'');
  const marker='.app/Contents/MacOS/';
  const index=execPath.indexOf(marker);
  return index>=0?execPath.slice(0,index+4):execPath;
};

async function detectPrivacyIdentity(){
  if(process.platform!=='darwin')return {platform:process.platform,signingMode:'not-macos',stableAcrossRebuilds:true,teamIdentifier:'',screenPermissionPersistence:'not-applicable'};
  if(!app.isPackaged)return {platform:'darwin',signingMode:'development-runtime',stableAcrossRebuilds:false,teamIdentifier:'',screenPermissionPersistence:'not-certified'};
  try{
    const {stdout='',stderr=''}=await execFileAsync('/usr/bin/codesign',['-dvvv',signatureTarget()]);
    const details=`${stdout}\n${stderr}`;
    const teamIdentifier=String(details.match(/^TeamIdentifier=(.+)$/m)?.[1]||'').trim();
    const authority=String(details.match(/^Authority=(.+)$/m)?.[1]||'').trim();
    const adHoc=/Signature=adhoc/i.test(details)||!teamIdentifier||/^not set$/i.test(teamIdentifier);
    const stable=!adHoc;
    return {
      platform:'darwin',
      signingMode:stable?'stable-apple':'adhoc',
      stableAcrossRebuilds:stable,
      teamIdentifier:stable?teamIdentifier:'',
      signingAuthority:stable?authority:'',
      screenPermissionPersistence:stable?'stable-code-identity':'not-certified'
    };
  }catch(error){
    return {platform:'darwin',signingMode:'unknown',stableAcrossRebuilds:false,teamIdentifier:'',signingAuthority:'',screenPermissionPersistence:'not-certified',error:String(error?.message||error||'codesign_inspection_failed')};
  }
}

// Legacy broad-certification marker: an actual ad-hoc result remains
// signingMode:'adhoc'; the runtime value above is now derived from codesign.
if(!ipcMain.listenerCount('app:privacy-identity')){
  ipcMain.handle('app:privacy-identity',()=>{
    privacyIdentityPromise ||= detectPrivacyIdentity();
    return privacyIdentityPromise;
  });
}
