import { app, dialog } from 'electron';

const isCi=String(process.env.CI||'').toLowerCase()==='true';
const packagedMac=()=>process.platform==='darwin'&&app.isPackaged&&!isCi;

async function canonicalizeMacInstall(){
  if(!packagedMac()||app.isInApplicationsFolder())return {moved:false,skipped:true,conflictType:''};
  let conflictType='';
  try{
    const moved=app.moveToApplicationsFolder({
      conflictHandler:type=>{
        conflictType=String(type||'');
        // A non-running stale copy may be replaced. Never continue through an
        // existsAndRunning conflict: doing so leaves two runnable copies and
        // macOS privacy relaunch can reopen the older /Applications binary.
        return conflictType==='exists';
      }
    });
    return {moved:Boolean(moved),skipped:false,conflictType};
  }catch(error){
    console.error('[DominionStar Meet] Could not move app to /Applications.',error);
    return {moved:false,skipped:false,conflictType,error:String(error?.message||error||'move_failed')};
  }
}

function rejectNonCanonicalLaunch(install={}){
  const running=String(install.conflictType||'')==='existsAndRunning';
  const message=running
    ? 'Quit the older DominionStar Meet first'
    : 'DominionStar Meet must run from Applications';
  const detail=running
    ? 'Another DominionStar Meet is already running from Applications. Quit that copy completely, then open this 2.0.22 build again so it can replace the installed app. This copy will not run from the DMG or Downloads because macOS Screen Recording “Quit & Reopen” could otherwise reopen the wrong build.'
    : `This packaged copy could not complete installation into Applications${install.error?` (${install.error})`:''}. It will close instead of starting from the DMG or Downloads. Install DominionStar Meet into Applications, then reopen it before granting Camera, Microphone, or Screen & System Audio Recording access.`;
  try{
    dialog.showMessageBoxSync({
      type:'warning',
      title:'Finish installing DominionStar Meet',
      message,
      detail,
      buttons:['Quit this copy'],
      defaultId:0,
      noLink:true
    });
  }catch{}
  app.quit();
}

async function launch(){
  await app.whenReady();
  const needsCanonicalInstall=packagedMac()&&!app.isInApplicationsFolder();
  const install=await canonicalizeMacInstall();
  if(install.moved)return;
  if(needsCanonicalInstall){
    rejectNonCanonicalLaunch(install);
    return;
  }
  await import('./relaunch-service.mjs');
  await import('./main.mjs');
}

void launch();
