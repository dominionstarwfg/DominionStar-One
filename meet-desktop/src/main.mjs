import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesktopAuth } from './auth-service.mjs';
import { createMeetingService } from './meeting-service.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
let mainWindow=null;
let desktopAuth=null;
let meetingService=null;

function createMainWindow(){
  mainWindow=new BrowserWindow({width:1280,height:820,minWidth:960,minHeight:640,show:false,backgroundColor:'#07111f',title:'DominionStar Meet',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',trafficLightPosition:process.platform==='darwin'?{x:18,y:18}:undefined,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:!app.isPackaged}});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//i.test(url))void shell.openExternal(url);return {action:'deny'};});
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url.startsWith('file://'))return;event.preventDefault();if(/^https:\/\//i.test(url))void shell.openExternal(url);});
  mainWindow.once('ready-to-show',()=>mainWindow?.show());
  void mainWindow.loadFile(path.join(__dirname,'..','ui','index.html'));
  mainWindow.on('closed',()=>{mainWindow=null;});
}

ipcMain.handle('app:get-environment',()=>({platform:process.platform,version:app.getVersion(),packaged:app.isPackaged,surface:'local-desktop-home'}));
ipcMain.handle('auth:get-state',()=>desktopAuth?.getState?.()||{ready:false,signedIn:false,user:null});
ipcMain.handle('auth:start-google',()=>desktopAuth?.startGoogle?.());
ipcMain.handle('auth:sign-out',()=>desktopAuth?.signOut?.());
ipcMain.handle('meeting:create',(_event,input)=>meetingService?.createRoom(input));
ipcMain.handle('meeting:request-join',(_event,input)=>meetingService?.requestJoin(input));
ipcMain.handle('meeting:join-status',(_event,{participantId,joinToken})=>meetingService?.joinStatus(participantId,joinToken));
ipcMain.handle('meeting:mark-joined',(_event,{participantId,joinToken})=>meetingService?.markJoined(participantId,joinToken));
ipcMain.handle('meeting:leave',(_event,{participantId,joinToken})=>meetingService?.leaveRoom(participantId,joinToken));
ipcMain.handle('meeting:host-queue',(_event,{roomId})=>meetingService?.hostQueue(roomId));
ipcMain.handle('meeting:decide',(_event,{participantId,decision})=>meetingService?.decide(participantId,decision));
ipcMain.handle('meeting:snapshot',(_event,{roomId})=>meetingService?.snapshot(roomId));
ipcMain.handle('meeting:end',(_event,{roomId})=>meetingService?.endRoom(roomId));

app.whenReady().then(async()=>{desktopAuth=createDesktopAuth({app,shell,getMainWindow:()=>mainWindow});await desktopAuth.initialize();meetingService=createMeetingService({auth:desktopAuth});createMainWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
