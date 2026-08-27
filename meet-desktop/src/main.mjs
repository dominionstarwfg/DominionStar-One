import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
let mainWindow=null;

function createMainWindow(){
  mainWindow=new BrowserWindow({
    width:1280,
    height:820,
    minWidth:960,
    minHeight:640,
    show:false,
    backgroundColor:'#07111f',
    title:'DominionStar Meet',
    titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',
    trafficLightPosition:process.platform==='darwin'?{x:18,y:18}:undefined,
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:true,
      devTools:!app.isPackaged
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    if(/^https:\/\//i.test(url))void shell.openExternal(url);
    return {action:'deny'};
  });
  mainWindow.webContents.on('will-navigate',(event,url)=>{
    if(url.startsWith('file://'))return;
    event.preventDefault();
    if(/^https:\/\//i.test(url))void shell.openExternal(url);
  });
  mainWindow.once('ready-to-show',()=>mainWindow?.show());
  void mainWindow.loadFile(path.join(__dirname,'..','ui','index.html'));
  mainWindow.on('closed',()=>{mainWindow=null;});
}

ipcMain.handle('app:get-environment',()=>({
  platform:process.platform,
  version:app.getVersion(),
  packaged:app.isPackaged,
  surface:'local-desktop-home'
}));

app.whenReady().then(()=>{
  createMainWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
});

app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
