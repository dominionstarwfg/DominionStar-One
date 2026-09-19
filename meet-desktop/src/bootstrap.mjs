import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';

// The meeting renderer remains the authoritative owner of media and presenter
// commands while native macOS sharing surfaces float above it. Prevent Chromium
// from backgrounding or occlusion-throttling that renderer during active share;
// otherwise toolbar IPC can arrive in the main process while Pause/Stop/Chat
// never reaches the meeting renderer until sharing ends.
if(process.platform==='darwin'){
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
}

// Physical-Mac capture baseline guard.
// The known-good capture path requires the main meeting BrowserWindow to remain
// fully visible while the user chooses a source and while getDisplayMedia starts.
// That requirement is a startup constraint, not an all-share constraint. After
// a short stabilization interval the renderer remains scheduled but the meeting
// is parked at near-zero opacity so the shared desktop looks like Zoom instead
// of recursively showing the meeting itself.
let physicalShareActive=false;
let physicalShareStartupUntil=0;
let physicalShareParkTimer=null;
const PHYSICAL_SHARE_STARTUP_MS=1900;
const sharePickerVisible=()=>BrowserWindow.getAllWindows().some(win=>{
  try{return !win.isDestroyed()&&win.isVisible?.()&&String(win.getTitle?.()||'')==='Share Screen';}
  catch{return false;}
});
const isMainMeetingWindow=win=>{
  try{return Boolean(win&&!win.isDestroyed()&&String(win.webContents?.getURL?.()||'').includes('/ui/index.html'));}
  catch{return false;}
};
const mainMeetingWindow=()=>BrowserWindow.getAllWindows().find(isMainMeetingWindow)||null;
const captureMutationProtected=()=>sharePickerVisible()||(physicalShareActive&&Date.now()<physicalShareStartupUntil);
if(process.platform==='darwin'){
  const originalSetOpacity=BrowserWindow.prototype.setOpacity;
  const originalSetIgnoreMouseEvents=BrowserWindow.prototype.setIgnoreMouseEvents;
  const originalUnmaximize=BrowserWindow.prototype.unmaximize;
  const originalSetFullScreen=BrowserWindow.prototype.setFullScreen;
  const originalSetAlwaysOnTop=BrowserWindow.prototype.setAlwaysOnTop;

  ipcMain.on('share:capture-started',()=>{
    physicalShareActive=true;
    physicalShareStartupUntil=Date.now()+PHYSICAL_SHARE_STARTUP_MS;
    if(physicalShareParkTimer)clearTimeout(physicalShareParkTimer);
    physicalShareParkTimer=setTimeout(()=>{
      physicalShareParkTimer=null;
      if(!physicalShareActive)return;
      const main=mainMeetingWindow();if(!main||main.isDestroyed())return;
      // Bypass only our startup guard here. Do not hide or minimize the
      // capture-owning renderer; keeping it visible at 2% opacity preserves
      // Chromium scheduling while clearing it from the presenter's desktop.
      try{main.webContents?.setBackgroundThrottling?.(false);}catch{}
      try{originalSetIgnoreMouseEvents.call(main,true);}catch{}
      try{originalSetOpacity.call(main,0.02);}catch{}
    },PHYSICAL_SHARE_STARTUP_MS);
  });
  ipcMain.on('mac-share:capture-stopped',()=>{
    physicalShareActive=false;physicalShareStartupUntil=0;
    if(physicalShareParkTimer){clearTimeout(physicalShareParkTimer);physicalShareParkTimer=null;}
  });

  BrowserWindow.prototype.setOpacity=function(value,...rest){
    if(isMainMeetingWindow(this)&&captureMutationProtected()&&Number(value)<0.99)return;
    return originalSetOpacity.call(this,value,...rest);
  };
  BrowserWindow.prototype.setIgnoreMouseEvents=function(ignore,...rest){
    if(isMainMeetingWindow(this)&&captureMutationProtected()&&Boolean(ignore))return;
    return originalSetIgnoreMouseEvents.call(this,ignore,...rest);
  };
  BrowserWindow.prototype.unmaximize=function(...args){
    if(isMainMeetingWindow(this)&&sharePickerVisible())return;
    return originalUnmaximize.apply(this,args);
  };
  BrowserWindow.prototype.setFullScreen=function(flag,...rest){
    if(isMainMeetingWindow(this)&&sharePickerVisible()&&flag===false)return;
    return originalSetFullScreen.call(this,flag,...rest);
  };
  BrowserWindow.prototype.setAlwaysOnTop=function(flag,...rest){
    if(isMainMeetingWindow(this)&&sharePickerVisible()&&Boolean(flag))return;
    return originalSetAlwaysOnTop.call(this,flag,...rest);
  };
}

const isCi=String(process.env.CI||'').toLowerCase()==='true';
const packagedMac=()=>process.platform==='darwin'&&app.isPackaged&&!isCi;
const CANONICAL_MAC_APP='/Applications/DominionStar Meet.app';
const currentMacBundlePath=()=>{
  if(process.platform!=='darwin'||!app.isPackaged)return '';
  return path.resolve(path.dirname(process.execPath),'../..');
};
const isCanonicalMacInstall=()=>!packagedMac()||currentMacBundlePath()===CANONICAL_MAC_APP;
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
  const win=BrowserWindow.getAllWindows().find(candidate=>candidate&&!candidate.isDestroyed()&&String(candidate.webContents?.getURL?.()||'').includes('/ui/index.html'))||BrowserWindow.getAllWindows().find(candidate=>candidate&&!candidate.isDestroyed()&&candidate.isVisible?.());
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

function rejectDuplicateLaunch(){app.quit();}

async function canonicalizeMacInstall(){
  if(!packagedMac())return {moved:false,skipped:true,canonical:true,conflictType:'',currentBundlePath:''};
  const currentBundlePath=currentMacBundlePath();
  if(currentBundlePath===CANONICAL_MAC_APP)return {moved:false,skipped:true,canonical:true,conflictType:'',currentBundlePath};
  if(app.isInApplicationsFolder())return {moved:false,skipped:false,canonical:false,conflictType:'duplicateName',currentBundlePath};
  let conflictType='';
  try{
    const moved=app.moveToApplicationsFolder({conflictHandler:type=>{conflictType=String(type||'');return conflictType==='exists';}});
    return {moved:Boolean(moved),skipped:false,canonical:false,conflictType,currentBundlePath};
  }catch(error){
    console.error('[DominionStar Meet] Could not move app to /Applications.',error);
    return {moved:false,skipped:false,canonical:false,conflictType,currentBundlePath,error:String(error?.message||error||'move_failed')};
  }
}

function rejectNonCanonicalLaunch(install={}){
  const running=String(install.conflictType||'')==='existsAndRunning';
  const duplicateName=String(install.conflictType||'')==='duplicateName';
  const version=app.getVersion();
  const message=running?'Quit the older DominionStar Meet first':duplicateName?'Use the canonical DominionStar Meet app':'DominionStar Meet must run from Applications';
  const detail=running
    ? `Another DominionStar Meet is already running from Applications. Quit that copy completely, then open build ${version} again so it can replace the installed app. This copy will not run from the DMG or Downloads because macOS Screen Recording “Quit & Reopen” could otherwise reopen the wrong build.`
    : duplicateName
      ? `This copy is running as ${install.currentBundlePath||'a renamed DominionStar Meet app'}. Quit all DominionStar Meet copies, remove renamed duplicates such as “DominionStar Meet 2.app”, and install this build exactly as ${CANONICAL_MAC_APP}. The meeting runtime will not start from a duplicate app name because macOS can treat it as a separate Screen Recording privacy identity.`
      : `This build (${version}) could not complete installation into Applications${install.error?` (${install.error})`:''}. It will close instead of starting from the DMG or Downloads. Install DominionStar Meet into Applications, then reopen it before granting Camera, Microphone, or Screen & System Audio Recording access.`;
  try{dialog.showMessageBoxSync({type:'warning',title:'Finish installing DominionStar Meet',message,detail,buttons:['Quit this copy'],defaultId:0,noLink:true});}catch{}
  app.quit();
}

async function launch(){
  await app.whenReady();
  const needsCanonicalInstall=packagedMac()&&!isCanonicalMacInstall();
  const install=await canonicalizeMacInstall();
  if(install.moved)return;
  if(needsCanonicalInstall){rejectNonCanonicalLaunch(install);return;}
  await import('./relaunch-service.mjs');
  await import('./main.mjs');
  if(process.platform==='darwin'){
    await import('./mac-share-presenter-overlay.mjs');
    await import('./mac-share-video-mirror.mjs');
  }
}

if(singleInstanceLock)void launch();
else void rejectDuplicateLaunch();