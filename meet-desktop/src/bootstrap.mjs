import { app, BrowserWindow, dialog } from 'electron';

const isCi=String(process.env.CI||'').toLowerCase()==='true';
const packagedMac=()=>process.platform==='darwin'&&app.isPackaged&&!isCi;
const JOIN_SCHEME='dominionstar-meet://join';
const pendingJoinUrls=globalThis.__dominionPendingJoinUrls=globalThis.__dominionPendingJoinUrls||[];
const isJoinUrl=value=>String(value||'').toLowerCase().startsWith(JOIN_SCHEME);
const queueJoinUrl=value=>{
  const url=String(value||'').trim();if(!isJoinUrl(url))return false;
  if(!pendingJoinUrls.includes(url))pendingJoinUrls.push(url);
  try{app.emit('dominion:join-url',url);}catch{}
  return true;
};
for(const arg of process.argv)queueJoinUrl(arg);
app.on('open-url',(event,url)=>{event.preventDefault();queueJoinUrl(url);});
const singleInstanceLock=app.requestSingleInstanceLock();

function focusRunningInstance(){
  const win=BrowserWindow.getAllWindows().find(candidate=>candidate&&!candidate.isDestroyed());
  if(!win)return false;
  try{if(win.isMinimized())win.restore();}catch{}
  try{win.show();}catch{}
  try{win.focus();}catch{}
  return true;
}

if(singleInstanceLock){
  app.on('second-instance',(_event,commandLine=[])=>{
    for(const arg of commandLine)queueJoinUrl(arg);
    if(app.isReady())focusRunningInstance();
    else app.once('ready',focusRunningInstance);
  });
}

function rejectDuplicateLaunch(){
  // Electron sends the launch attempt to the lock owner through
  // second-instance. The owner restores/focuses its existing window; the
  // duplicate must exit immediately so no second toolbar, dock, or capture
  // renderer can ever initialize.
  app.quit();
}

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
  const version=app.getVersion();
  const message=running
    ? 'Quit the older DominionStar Meet first'
    : 'DominionStar Meet must run from Applications';
  const detail=running
    ? `Another DominionStar Meet is already running from Applications. Quit that copy completely, then open build ${version} again so it can replace the installed app. This copy will not run from the DMG or Downloads because macOS Screen Recording “Quit & Reopen” could otherwise reopen the wrong build.`
    : `This build (${version}) could not complete installation into Applications${install.error?` (${install.error})`:''}. It will close instead of starting from the DMG or Downloads. Install DominionStar Meet into Applications, then reopen it before granting Camera, Microphone, or Screen & System Audio Recording access.`;
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

if(singleInstanceLock)void launch();
else void rejectDuplicateLaunch();
