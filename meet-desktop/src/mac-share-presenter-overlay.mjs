import {app,BrowserWindow,ipcMain,screen} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

if(process.platform==='darwin'){
  const here=path.dirname(fileURLToPath(import.meta.url));
  const uiDir=path.resolve(here,'../ui');
  const preloadPath=path.join(here,'preload.cjs');
  let toolbarWindow=null;
  let borderWindow=null;
  let shareActive=false;
  let toolbarReady=false;
  let toolbarMenuOpen=false;
  let preparing=null;
  let shareState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true};

  const isAlive=win=>Boolean(win&&!win.isDestroyed());
  const mainWindow=()=>{
    const windows=BrowserWindow.getAllWindows().filter(isAlive);
    return windows.find(win=>String(win.webContents?.getURL?.()||'').includes('/ui/index.html'))
      ||windows.find(win=>win!==toolbarWindow&&win!==borderWindow&&!String(win.webContents?.getURL?.()||'').includes('mac-presenter-toolbar.html')&&win.isVisible?.())
      ||null;
  };
  const displayForMain=()=>{const main=mainWindow();try{return main?screen.getDisplayMatching(main.getBounds()):screen.getPrimaryDisplay();}catch{return screen.getPrimaryDisplay();}};
  const isDisplayShare=()=>/screen|desktop|display|entire/i.test(String(shareState.sourceName||''));

  function protect(win){if(!isAlive(win))return;try{win.setContentProtection(true);}catch{}}
  function positionToolbar(){
    if(!isAlive(toolbarWindow))return;
    const display=displayForMain(),area=display.workArea||display.bounds;
    const width=Math.min(920,Math.max(720,area.width-24));
    const height=toolbarMenuOpen?286:92;
    const x=Math.round(area.x+(area.width-width)/2),y=Math.round(area.y+4);
    try{toolbarWindow.setBounds({x,y,width,height},false);}catch{}
  }
  function positionBorder(){
    if(!isAlive(borderWindow))return;
    const display=displayForMain(),bounds=display.bounds;
    try{borderWindow.setBounds({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},false);}catch{}
  }
  function publishState(){if(toolbarReady&&isAlive(toolbarWindow))toolbarWindow.webContents.send('share:toolbar-state',shareState);}

  async function prepareToolbar(){
    if(isAlive(toolbarWindow))return toolbarWindow;
    toolbarReady=false;
    const win=new BrowserWindow({
      width:920,height:92,minWidth:720,minHeight:92,maxHeight:286,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
      resizable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,
      focusable:false,acceptFirstMouse:true,
      webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false}
    });
    toolbarWindow=win;protect(win);
    try{win.setAlwaysOnTop(true,'floating');}catch{try{win.setAlwaysOnTop(true);}catch{}}
    try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('closed',()=>{if(toolbarWindow===win){toolbarWindow=null;toolbarReady=false;}});
    positionToolbar();
    try{
      await win.loadFile(path.join(uiDir,'mac-presenter-toolbar.html'));
      if(!isAlive(win)||toolbarWindow!==win)return null;
      toolbarReady=true;publishState();
      if(shareActive){positionToolbar();win.showInactive?.();win.moveTop?.();}
      return win;
    }catch(error){
      console.error('[DominionStar Meet] macOS presenter toolbar failed to prepare.',error);
      try{win.setClosable?.(true);win.close();}catch{}
      if(toolbarWindow===win)toolbarWindow=null;
      return null;
    }
  }

  async function prepareBorder(){
    if(isAlive(borderWindow))return borderWindow;
    const win=new BrowserWindow({width:2,height:2,show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,movable:false,fullscreenable:false,minimizable:false,maximizable:false,closable:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false}});
    borderWindow=win;protect(win);try{win.setIgnoreMouseEvents(true,{forward:true});}catch{}try{win.setAlwaysOnTop(true,'floating');}catch{}try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('closed',()=>{if(borderWindow===win)borderWindow=null;});
    const html='<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{border:4px solid #2ed573;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}</style>';
    try{await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);}catch(error){console.error('[DominionStar Meet] share border failed to prepare.',error);}
    positionBorder();return win;
  }

  async function prepare(){
    if(preparing)return preparing;
    preparing=Promise.allSettled([prepareToolbar(),prepareBorder()]).then(()=>({ok:Boolean(isAlive(toolbarWindow)&&isAlive(borderWindow))})).finally(()=>{preparing=null;});
    return preparing;
  }
  function showMeeting(){
    const main=mainWindow();if(!isAlive(main))return false;
    try{main.webContents.send('mac-share:show-meeting');}catch{}
    try{if(main.isMinimized?.())main.restore();}catch{}
    try{main.show();main.focus();}catch{}
    return true;
  }
  function showOverlays(){
    if(!shareActive)return;
    void prepare().then(()=>{
      if(!shareActive)return;
      positionToolbar();positionBorder();
      if(isAlive(toolbarWindow)){toolbarWindow.showInactive?.();toolbarWindow.moveTop?.();publishState();}
      if(isAlive(borderWindow)){if(isDisplayShare()){borderWindow.showInactive?.();borderWindow.moveTop?.();}else borderWindow.hide();}
    });
  }
  function hideOverlays(){
    toolbarMenuOpen=false;
    if(isAlive(toolbarWindow)){try{toolbarWindow.setBounds({...toolbarWindow.getBounds(),height:92},false);}catch{}toolbarWindow.hide();}
    if(isAlive(borderWindow))borderWindow.hide();
  }

  ipcMain.handle('mac-share:prepare',()=>prepare());
  ipcMain.on('share:capture-started',(_event,state={})=>{
    shareActive=true;shareState={...shareState,...state,meetingVisible:true};showOverlays();
  });
  ipcMain.on('mac-share:state',(_event,state={})=>{
    if(!shareActive)return;shareState={...shareState,...state};publishState();
    if(isAlive(borderWindow)){if(isDisplayShare()){positionBorder();borderWindow.showInactive?.();borderWindow.moveTop?.();}else borderWindow.hide();}
  });
  ipcMain.on('mac-share:capture-stopped',()=>{shareActive=false;shareState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true};hideOverlays();});

  ipcMain.handle('mac-share:presenter-command',async(_event,{command}={})=>{
    const normalized=String(command||'').replace(/^toolbar:/,'');
    const main=mainWindow();if(!isAlive(main))return {ok:false,error:'meeting_window_unavailable'};
    if(normalized==='show-meeting'){showMeeting();return {ok:true};}
    if(['participants','chat','annotate'].includes(normalized))showMeeting();
    try{main.webContents.send('share:presenter-command',normalized);return {ok:true};}catch(error){return {ok:false,error:String(error?.message||error||'presenter_command_failed')};}
  });
  ipcMain.handle('mac-share:menu-state',(_event,{open=false}={})=>{
    toolbarMenuOpen=Boolean(open);positionToolbar();return {ok:true,height:toolbarMenuOpen?286:92};
  });
  ipcMain.handle('mac-share:show-meeting',()=>({ok:showMeeting()}));

  screen.on('display-metrics-changed',()=>{if(shareActive){positionToolbar();positionBorder();}});
  app.on('before-quit',()=>{shareActive=false;hideOverlays();for(const win of [toolbarWindow,borderWindow]){if(isAlive(win)){try{win.setClosable?.(true);win.close();}catch{}}}});

  // Preparation is intentionally source-enumeration-driven, before capture but
  // after the meeting renderer is already authoritative. Do not auto-create a
  // hidden file:// presenter target at app launch.
  globalThis.__dominionMacSharePresenterOverlay=Object.freeze({showMeeting,showOverlays,hideOverlays,prepare,state:()=>({shareActive,prepared:Boolean(isAlive(toolbarWindow)&&isAlive(borderWindow)),shareState:{...shareState}})});
}
