import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const TRUSTED_HOSTS=new Set(['dominionstarld.com','www.dominionstarld.com']);
let dockWindow=null;

function trustedSender(event){
  try{
    const url=new URL(String(event?.sender?.getURL?.()||''));
    const route=url.pathname.length>1?url.pathname.replace(/\/+$/,''):url.pathname;
    return url.protocol==='https:'&&TRUSTED_HOSTS.has(url.hostname.toLowerCase())&&route==='/meet';
  }catch{return false;}
}

function sanitizeFrame(value){
  const text=String(value||'');
  return /^data:image\/(?:jpeg|png|webp);base64,/i.test(text)?text:'';
}

function sanitizeAvatar(value){
  const text=String(value||'');
  if(/^data:image\/(?:jpeg|png|webp);base64,/i.test(text))return text;
  try{const url=new URL(text);return url.protocol==='https:'?url.toString():'';}catch{return'';}
}

function sanitizeState(payload={}){
  const tiles=Array.isArray(payload?.tiles)?payload.tiles.slice(0,5):[];
  return {tiles:tiles.map(tile=>({
    id:String(tile?.id||'').slice(0,160),
    name:String(tile?.name||'Participant').slice(0,120),
    role:String(tile?.role||'').slice(0,32),
    audio:tile?.audio!==false,
    video:Boolean(tile?.video),
    speaking:Boolean(tile?.speaking),
    avatarUrl:sanitizeAvatar(tile?.avatarUrl),
    frame:sanitizeFrame(tile?.frame)
  }))};
}

function zoomClassDockSize(){
  const display=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area=display.workArea;
  // Match the practical footprint of Zoom's stacked participant strip rather
  // than a fixed thumbnail rail. Keep the ratio stable across Mac displays.
  const width=Math.round(Math.min(360,Math.max(300,area.width*0.18)));
  const height=Math.round(Math.min(720,Math.max(560,area.height*0.74)));
  return {width,height};
}

function createDock(){
  if(dockWindow&&!dockWindow.isDestroyed())return dockWindow;
  const initial=zoomClassDockSize();
  dockWindow=new BrowserWindow({
    width:initial.width,
    height:initial.height,
    minWidth:280,
    minHeight:420,
    maxWidth:620,
    maxHeight:900,
    show:false,
    frame:false,
    transparent:true,
    resizable:true,
    movable:true,
    alwaysOnTop:true,
    skipTaskbar:true,
    hasShadow:true,
    backgroundColor:'#00000000',
    webPreferences:{
      preload:path.join(__dirname,'presenter-dock-preload.cjs'),
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:true
    }
  });
  dockWindow.setContentProtection(true);
  dockWindow.setAlwaysOnTop(true,'floating');
  dockWindow.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  void dockWindow.loadFile(path.join(__dirname,'presenter-dock.html'));
  dockWindow.on('closed',()=>{dockWindow=null;});
  return dockWindow;
}

function placeDock(win){
  const display=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area=display.workArea;
  const [width,height]=win.getSize();
  const x=Math.round(area.x+area.width-width-16);
  const y=Math.round(area.y+92);
  win.setPosition(x,Math.min(y,area.y+area.height-height),false);
}

function hideDock(){
  if(dockWindow&&!dockWindow.isDestroyed())dockWindow.hide();
}

ipcMain.on('desktop:presenter-dock-update',(event,payload={})=>{
  if(!trustedSender(event))return;
  const win=createDock();
  const state=sanitizeState(payload);
  if(!win.isVisible()){
    placeDock(win);
    win.showInactive();
  }
  if(!win.webContents.isDestroyed())win.webContents.send('desktop:presenter-dock-state',state);
  // Zoom-class sharing keeps the participant video strip visible for the
  // duration of presentation. Do not auto-hide the dock between frame/state
  // updates; only an explicit presenter-hide/share-stop command may hide it.
});

ipcMain.on('desktop:presenter-hide',hideDock);

export const presenterDockStatus=()=>({visible:Boolean(dockWindow&&!dockWindow.isDestroyed()&&dockWindow.isVisible())});
