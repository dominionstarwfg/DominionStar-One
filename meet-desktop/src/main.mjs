import { app, BrowserWindow, desktopCapturer, ipcMain, Notification, powerMonitor, session, shell, systemPreferences } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesktopAuth } from './auth-service.mjs';
import { createMeetingService } from './meeting-service.mjs';
import { createShareService } from './share-service.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const uiDir=path.join(__dirname,'..','ui');
const preloadPath=path.join(__dirname,'preload.cjs');
const qaFixtureRequested=process.argv.includes('--qa-interaction-fixtures')||process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';
const qaInteractionFixtures=app.isPackaged&&app.getVersion().includes('-')&&qaFixtureRequested;
let mainWindow=null;
let desktopAuth=null;
let meetingService=null;
let shareService=null;
let qaPersonalRoom={roomId:'qa-personal-room',roomCode:'2468013579',passcode:'360',title:'Personal Meeting Room',useForInstant:true,waitingRoomEnabled:true,externalGuestsAllowed:true,status:'ready'};
let qaSchedules=[];

function qaSchedule(input={}){
  const scheduleId=`qa-schedule-${qaSchedules.length+1}`;
  const item={scheduleId,roomId:`qa-room-${qaSchedules.length+1}`,roomCode:String(81000000000+qaSchedules.length+1),passcode:String(input.passcode||'360'),title:String(input.title||'DominionStar Meeting'),scheduledStart:String(input.scheduledStart||new Date(Date.now()+3600000).toISOString()),durationMinutes:Number(input.durationMinutes)||60,recurrence:input.recurrence||null,waitingRoomEnabled:input.waitingRoomEnabled!==false,externalGuestsAllowed:input.externalGuestsAllowed!==false,status:'scheduled'};
  qaSchedules.push(item);return item;
}
function qaCancelSchedule(scheduleId){const item=qaSchedules.find(value=>String(value.scheduleId)===String(scheduleId));if(item)item.status='cancelled';return item||null;}
function qaStartSchedule(scheduleId){const item=qaSchedules.find(value=>String(value.scheduleId)===String(scheduleId));if(!item)throw new Error('qa_schedule_not_found');item.status='started';return {...item};}

const localRendererUrl=value=>String(value||'').startsWith('file://');
const permissionStatus=kind=>{if(process.platform!=='darwin')return 'granted';try{return systemPreferences.getMediaAccessStatus(kind);}catch{return 'unknown';}};
const nativeMediaPermissions=()=>({platform:process.platform,camera:permissionStatus('camera'),microphone:permissionStatus('microphone'),screen:permissionStatus('screen')});

async function requestNativeMediaPermissions(kinds=[]){
  if(process.platform!=='darwin')return {...nativeMediaPermissions(),ok:true};
  const requested=new Set(Array.isArray(kinds)?kinds.map(String):[]);
  for(const kind of ['camera','microphone']){
    if(!requested.has(kind))continue;
    if(permissionStatus(kind)!=='not-determined')continue;
    try{await systemPreferences.askForMediaAccess(kind);}catch{}
  }
  const status=nativeMediaPermissions();
  return {...status,ok:[...requested].every(kind=>!['denied','restricted'].includes(String(status[kind]||'')))};
}

async function requestScreenPermission(){
  if(process.platform!=='darwin')return {ok:true,status:'granted',restartRequired:false};
  // Physical-Mac rule: clicking Share must never probe desktopCapturer merely to
  // discover permission state. That native call can block Electron's main loop
  // while macOS/TCC is transitioning. Read TCC passively; the picker remains
  // responsive and explains how to grant access when permission is not active.
  const status=permissionStatus('screen');
  return {
    ok:status==='granted',
    status,
    restartRequired:false,
    passive:true
  };
}

async function openPrivacySettings(kind='screen'){
  if(process.platform!=='darwin')return {ok:false,platform:process.platform};
  const pane={screen:'Privacy_ScreenCapture',camera:'Privacy_Camera',microphone:'Privacy_Microphone'}[String(kind)]||'Privacy_ScreenCapture';
  try{await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`);return {ok:true};}
  catch{try{await shell.openPath('/System/Applications/System Settings.app');return {ok:true};}catch{return {ok:false};}}
}

function ipMainHandleChatPolicy(){
  if(ipcMain.listenerCount('meeting:set-chat-policy'))return;
  ipcMain.handle('meeting:set-chat-policy',(_event,{roomId,policy})=>meetingService?.setChatPolicy(roomId,policy));
}

function ipMainHandleCaptions(){
  if(!ipcMain.listenerCount('meeting:set-caption-state'))ipcMain.handle('meeting:set-caption-state',(_event,{roomId,options})=>meetingService?.setCaptionState(roomId,options));
  if(!ipcMain.listenerCount('meeting:publish-caption'))ipcMain.handle('meeting:publish-caption',(_event,{participantId,text,speakerName})=>meetingService?.publishCaption(participantId,text,speakerName));
  if(!ipcMain.listenerCount('meeting:get-transcript'))ipcMain.handle('meeting:get-transcript',(_event,{roomId})=>meetingService?.transcript(roomId));
}

function installLocalPermissionPolicy(desktopSession){
  const allowed=new Set(['media','camera','microphone','audioCapture','videoCapture','display-capture','notifications','fullscreen']);
  desktopSession.setPermissionRequestHandler((webContents,permission,callback,details={})=>{
    const source=details.requestingUrl||webContents?.getURL()||'';
    callback(localRendererUrl(source)&&allowed.has(permission));
  });
  desktopSession.setPermissionCheckHandler((webContents,permission,requestingOrigin)=>{
    const source=requestingOrigin||webContents?.getURL()||'';
    return localRendererUrl(source)&&allowed.has(permission);
  });
}

function createMainWindow(){
  mainWindow=new BrowserWindow({width:1280,height:820,minWidth:960,minHeight:640,show:false,backgroundColor:'#07111f',title:'DominionStar Meet',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',trafficLightPosition:process.platform==='darwin'?{x:18,y:18}:undefined,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:!app.isPackaged}});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//i.test(url))void shell.openExternal(url);return {action:'deny'};});
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url.startsWith('file://'))return;event.preventDefault();if(/^https:\/\//i.test(url))void shell.openExternal(url);});
  mainWindow.once('ready-to-show',()=>mainWindow?.show());
  mainWindow.on('focus',()=>{try{mainWindow?.flashFrame(false);}catch{}});
  void mainWindow.loadFile(path.join(uiDir,'index.html'));
  mainWindow.on('closed',()=>{shareService?.closePicker?.();shareService?.closeToolbar?.();mainWindow=null;});
}

ipcMain.handle('app:get-environment',()=>({platform:process.platform,version:app.getVersion(),packaged:app.isPackaged,surface:'local-desktop-home',releaseChannel:app.getVersion().includes('-')?'qa':'production',qaInteractionFixtures}));
ipcMain.handle('auth:get-state',()=>desktopAuth?.getState?.()||{ready:false,signedIn:false,user:null});
ipcMain.handle('auth:start-google',()=>desktopAuth?.startGoogle?.());
ipcMain.handle('auth:sign-in-password',(_event,{email,password}={})=>desktopAuth?.signInPassword?.(email,password));
ipcMain.handle('auth:update-avatar',(_event,{dataUrl}={})=>desktopAuth?.updateAvatar?.(dataUrl));
ipcMain.handle('auth:sign-out',()=>desktopAuth?.signOut?.());
ipcMain.handle('media:get-permissions',()=>nativeMediaPermissions());
ipcMain.handle('media:request-permissions',(_event,{kinds=[]}={})=>requestNativeMediaPermissions(kinds));
ipcMain.handle('media:request-screen',()=>requestScreenPermission());
ipcMain.handle('media:open-privacy',(_event,{kind='screen'}={})=>openPrivacySettings(kind));
ipcMain.handle('notifications:set-waiting-count',(_event,{count=0,attention=false}={})=>{
  const value=Math.max(0,Math.min(999,Number(count)||0));
  try{app.setBadgeCount?.(value);}catch{}
  if(process.platform==='darwin'&&app.dock){
    try{app.dock.setBadge(value?String(value):'');}catch{}
    if(attention&&value>0&&mainWindow&&!mainWindow.isFocused()){try{app.dock.bounce('informational');}catch{}}
  }
  if(mainWindow&&!mainWindow.isDestroyed()){
    try{mainWindow.flashFrame(Boolean(attention&&value>0&&!mainWindow.isFocused()));}catch{}
  }
  return {count:value};
});
ipcMain.handle('notifications:meeting',(_event,{title='DominionStar Meet',body='Meeting update'}={})=>{
  if(!Notification?.isSupported?.())return {shown:false};
  const notification=new Notification({title:String(title||'DominionStar Meet').slice(0,80),body:String(body||'Meeting update').slice(0,220),silent:true});
  notification.on('click',()=>{if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();try{mainWindow.flashFrame(false);}catch{}}});
  notification.show();return {shown:true};
});
ipcMain.handle('meeting:create',(_event,input)=>meetingService?.createRoom(input));
ipcMain.handle('meeting:personal-room',()=>qaInteractionFixtures?{...qaPersonalRoom}:meetingService?.personalRoom());
ipcMain.handle('meeting:update-personal-room',(_event,input)=>{if(!qaInteractionFixtures)return meetingService?.updatePersonalRoom(input);qaPersonalRoom={...qaPersonalRoom,...input,passcode:String(input?.passcode||qaPersonalRoom.passcode)};return {...qaPersonalRoom};});
ipcMain.handle('meeting:start-personal-room',()=>qaInteractionFixtures?{...qaPersonalRoom}:meetingService?.startPersonalRoom());
ipcMain.handle('meeting:start-host-room',(_event,{roomId})=>meetingService?.startHostRoom(roomId));
ipcMain.handle('meeting:schedule',(_event,input)=>qaInteractionFixtures?qaSchedule(input):meetingService?.scheduleRoom(input));
ipcMain.handle('meeting:list-schedules',()=>qaInteractionFixtures?qaSchedules.filter(item=>item.status!=='cancelled').map(item=>({...item})):meetingService?.listSchedules());
ipcMain.handle('meeting:cancel-schedule',(_event,{scheduleId})=>qaInteractionFixtures?qaCancelSchedule(scheduleId):meetingService?.cancelSchedule(scheduleId));
ipcMain.handle('meeting:start-schedule',(_event,{scheduleId})=>qaInteractionFixtures?qaStartSchedule(scheduleId):meetingService?.startSchedule(scheduleId));
ipcMain.handle('meeting:update-room-passcode',(_event,{roomId,passcode})=>meetingService?.updateRoomPasscode(roomId,passcode));
ipcMain.handle('meeting:request-join',(_event,input)=>meetingService?.requestJoin(input));
ipcMain.handle('meeting:join-status',(_event,{participantId,joinToken})=>meetingService?.joinStatus(participantId,joinToken));
ipcMain.handle('meeting:mark-joined',(_event,{participantId,joinToken})=>meetingService?.markJoined(participantId,joinToken));
ipcMain.handle('meeting:leave',(_event,{participantId,joinToken})=>meetingService?.leaveRoom(participantId,joinToken));
ipcMain.handle('meeting:host-queue',(_event,{roomId})=>meetingService?.hostQueue(roomId));
ipcMain.handle('meeting:decide',(_event,{participantId,decision})=>meetingService?.decide(participantId,decision));
ipcMain.handle('meeting:snapshot',(_event,{roomId})=>meetingService?.snapshot(roomId));
ipcMain.handle('meeting:touch-presence',(_event,{participantId,joinToken})=>meetingService?.touchPresence(participantId,joinToken));
ipcMain.handle('meeting:set-cohost',(_event,{participantId,enabled})=>meetingService?.setCohost(participantId,enabled));
ipcMain.handle('meeting:remove-participant',(_event,{participantId})=>meetingService?.removeParticipant(participantId));
ipcMain.handle('meeting:rename-participant',(_event,{participantId,displayName})=>meetingService?.renameParticipant(participantId,displayName));
ipcMain.handle('meeting:set-recording-permission',(_event,{participantId,enabled})=>meetingService?.setRecordingPermission(participantId,enabled));
ipcMain.handle('meeting:set-recording-state',(_event,{participantId,active,paused})=>meetingService?.setRecordingState(participantId,active,paused));
ipcMain.handle('meeting:set-security',(_event,{roomId,options})=>meetingService?.setSecurity(roomId,options));
ipMainHandleChatPolicy();
ipMainHandleCaptions();
ipcMain.handle('meeting:transfer-host-and-leave',(_event,{participantId})=>meetingService?.transferHostAndLeave(participantId));
ipcMain.handle('meeting:end',(_event,{roomId})=>meetingService?.endRoom(roomId));
ipcMain.handle('meeting:context',()=>meetingService?.context?.()||{});
ipcMain.handle('meeting:signal-send',(_event,{toParticipantId,type,payload})=>meetingService?.sendSignal(toParticipantId,type,payload));
ipcMain.handle('meeting:signal-pull',(_event,{afterId,limit})=>meetingService?.pullSignals(afterId,limit));
ipcMain.handle('meeting:signal-prune',(_event,{roomId})=>meetingService?.pruneSignals(roomId));
ipcMain.handle('meeting:ice-config',(_event,{force=false,ttl=7200}={})=>meetingService?.iceConfig({force:Boolean(force),ttl:Number(ttl)||7200}));

app.whenReady().then(async()=>{
  installLocalPermissionPolicy(session.defaultSession);
  desktopAuth=createDesktopAuth({app,shell,getMainWindow:()=>mainWindow});
  await desktopAuth.initialize();
  meetingService=createMeetingService({auth:desktopAuth,allowDirectQa:app.getVersion().includes('-')});
  shareService=createShareService({BrowserWindow,desktopCapturer,desktopSession:session.defaultSession,ipcMain,path,uiDir,preloadPath,getMainWindow:()=>mainWindow,platform:process.platform,ensureScreenPermission:requestScreenPermission,openPrivacySettings});
  createMainWindow();
  const sendPowerEvent=(type)=>{
    if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('app:power-event',{type,at:Date.now()});
  };
  powerMonitor.on('suspend',()=>sendPowerEvent('suspend'));
  powerMonitor.on('resume',()=>sendPowerEvent('resume'));
  powerMonitor.on('lock-screen',()=>sendPowerEvent('lock-screen'));
  powerMonitor.on('unlock-screen',()=>sendPowerEvent('unlock-screen'));
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
