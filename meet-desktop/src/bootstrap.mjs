import { app } from 'electron';

const isCi=String(process.env.CI||'').toLowerCase()==='true';

async function canonicalizeMacInstall(){
  if(process.platform!=='darwin'||!app.isPackaged||isCi||app.isInApplicationsFolder())return {moved:false,skipped:true};
  try{
    const moved=app.moveToApplicationsFolder({
      conflictHandler:conflictType=>conflictType==='exists'
    });
    return {moved:Boolean(moved),skipped:false};
  }catch(error){
    console.error('[DominionStar Meet] Could not move app to /Applications.',error);
    return {moved:false,skipped:false,error:String(error?.message||error||'move_failed')};
  }
}

async function launch(){
  await app.whenReady();
  const install=await canonicalizeMacInstall();
  if(install.moved)return;
  await import('./relaunch-service.mjs');
  await import('./main.mjs');
}

void launch();
