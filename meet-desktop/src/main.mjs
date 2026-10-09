import {app, BrowserWindow, desktopCapturer, ipcMain, Notification, powerMonitor, session, shell, systemPreferences, screen} from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { createDesktopAuth } from './auth-service.mjs';
import { createMeetingService } from './meeting-service.mjs';
import { createShareService } from './share-service.mjs';

if(process.platform==='darwin'){
  // A presenter app must keep the meeting/control renderer scheduled while its
  // window is occluded or reduced during display sharing. backgroundThrottling
  // on BrowserWindow is not sufficient on macOS once Chromium classifies the
  // window as occluded; disable the renderer/timer occlusion policies before
  // Electron creates any renderer process.
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
}

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const uiDir=path.join(__dirname,'..','ui');
const preloadPath=path.join(__dirname,'preload.cjs');
const qaFixtureRequested=process.argv.includes('--qa-interaction-fixtures')||process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';
const qaInteractionFixtures=app.isPackaged&&qaFixtureRequested;
let mainWindow=null;
let qaInteractionBridgeInstalled=false;
let qaRendererDomReady=false;
let qaRendererDidFinishLoad=false;
let qaRequestTraceInstalled=false;
const qaPendingRequests=new Map();
let desktopAuth=null;
let meetingService=null;
let shareService=null;
let qaPersonalRoom={roomId:'qa-personal-room',roomCode:'2468013579',passcode:'360',title:'Personal Meeting Room',useForInstant:true,waitingRoomEnabled:true,externalGuestsAllowed:true,status:'ready'};
let qaSchedules=[];
const pendingJoinUrls=globalThis.__dominionPendingJoinUrls=globalThis.__dominionPendingJoinUrls||[];
const validJoinUrl=value=>{
  try{
    const url=new URL(String(value||''));
    if(url.protocol!=='dominionstar-meet:'||url.hostname!=='join')return '';
    const meetingId=String(url.searchParams.get('meetingId')||url.searchParams.get('mid')||'').replace(/\D/g,'');
    const passcode=String(url.searchParams.get('passcode')||url.searchParams.get('pwd')||'').replace(/\D/g,'');
    if(!/^\d{10,11}$/.test(meetingId)||!/^\d{3,7}$/.test(passcode))return '';
    return `dominionstar-meet://join?meetingId=${encodeURIComponent(meetingId)}&passcode=${encodeURIComponent(passcode)}`;
  }catch{return '';}
};
const pushJoinUrl=value=>{
  const url=validJoinUrl(value);if(!url)return false;
  if(!pendingJoinUrls.includes(url))pendingJoinUrls.push(url);
  if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('app:join-url',url);
  return true;
};
app.on('dominion:join-url',url=>pushJoinUrl(url));

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
  if(process.platform!=='darwin')return {ok:true,status:'granted',restartRequired:false,detectedBy:'platform'};
  const reportedStatus=permissionStatus('screen');
  // Electron/macOS can keep reporting a stale denied Screen Recording state
  // after the user has enabled the app in System Settings. Treat this status as
  // advisory only. Opening Share is an explicit user action, and real desktop
  // source enumeration is the authoritative test of whether capture is usable.
  // If permission is genuinely absent, macOS owns the native consent prompt.
  return {
    ok:true,
    status:reportedStatus,
    reportedStatus,
    restartRequired:false,
    detectedBy:reportedStatus==='granted'?'tcc-status':'tcc-advisory',
    advisory:reportedStatus!=='granted'
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

async function qaEvaluateInMainWorld(win,expression){
  if(!qaRendererDomReady)throw new Error('renderer_not_dom_ready');
  const dbg=win.webContents.debugger;
  try{if(!dbg.isAttached())dbg.attach('1.3');}catch(error){if(!dbg.isAttached())throw error;}
  const result=await dbg.sendCommand('Runtime.evaluate',{expression:String(expression||''),awaitPromise:true,returnByValue:true,userGesture:true});
  if(result?.exceptionDetails){
    const description=result.exceptionDetails.exception?.description||result.exceptionDetails.text||'qa_renderer_evaluation_failed';
    throw new Error(String(description));
  }
  return result?.result?.value===undefined?null:result.result.value;
}
function installQaRequestTrace(win){
  if(qaRequestTraceInstalled||!qaFixtureRequested||!win?.webContents?.session)return;
  qaRequestTraceInstalled=true;
  const targetId=win.webContents.id;
  const scoped=details=>!details?.webContentsId||Number(details.webContentsId)===Number(targetId);
  win.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
    try{
      if(scoped(details))qaPendingRequests.set(String(details.id),{url:String(details.url||''),resourceType:String(details.resourceType||''),startedAt:Date.now()});
    }catch{}
    callback({});
  });
  win.webContents.session.webRequest.onCompleted(details=>{try{if(scoped(details))qaPendingRequests.delete(String(details.id));}catch{}});
  win.webContents.session.webRequest.onErrorOccurred(details=>{try{if(scoped(details))qaPendingRequests.delete(String(details.id));}catch{}});
}

function installQaInteractionBridge(){
  if(qaInteractionBridgeInstalled||!app.isPackaged||!qaFixtureRequested)return;
  qaInteractionBridgeInstalled=true;
  const reply=(payload={})=>{try{process.stdout.write(`DOMINIONSTAR_QA_RPC ${JSON.stringify(payload)}\n`);}catch{}};
  const interfaceReader=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  interfaceReader.on('line',async line=>{
    let request=null;
    try{request=JSON.parse(String(line||''));}catch{return;}
    const id=Number(request?.id)||0;if(!id)return;
    try{
      const win=mainWindow;
      if(!win||win.isDestroyed()||!win.webContents||win.webContents.isDestroyed())throw new Error('main_window_unavailable');
      const method=String(request.method||'');
      if(method==='evaluate'){
        const value=await qaEvaluateInMainWorld(win,String(request.expression||''));
        reply({id,ok:true,value:value===undefined?null:value});return;
      }
      if(method==='input'){
        const raw=request.event||{},type=String(raw.type||'');
        const typeMap={mouseMoved:'mouseMove',mousePressed:'mouseDown',mouseReleased:'mouseUp'};
        const mapped=typeMap[type]||type;
        if(!['mouseMove','mouseDown','mouseUp'].includes(mapped))throw new Error('unsupported_input_type');
        const event={type:mapped,x:Math.round(Number(raw.x)||0),y:Math.round(Number(raw.y)||0)};
        if(mapped!=='mouseMove'){event.button=String(raw.button||'left');event.clickCount=Math.max(1,Number(raw.clickCount)||1);}
        if(mapped==='mouseMove'){event.movementX=Math.round(Number(raw.movementX)||0);event.movementY=Math.round(Number(raw.movementY)||0);}
        win.webContents.sendInputEvent(event);
        reply({id,ok:true,value:true});return;
      }
      if(method==='state'){
        const now=Date.now(),pendingRequests=[...qaPendingRequests.values()].map(item=>({...item,ageMs:Math.max(0,now-Number(item.startedAt||now))})).sort((a,b)=>b.ageMs-a.ageMs).slice(0,20);
        reply({id,ok:true,value:{url:win.webContents.getURL(),loading:win.webContents.isLoadingMainFrame(),domReady:qaRendererDomReady,didFinishLoad:qaRendererDidFinishLoad,debuggerAttached:Boolean(win.webContents.debugger?.isAttached?.()),crashed:Boolean(win.webContents.isCrashed?.()),destroyed:win.webContents.isDestroyed(),qaInteractionFixtures,pendingRequests}});return;
      }
      throw new Error('unsupported_qa_method');
    }catch(error){reply({id,ok:false,error:String(error?.message||error||'qa_rpc_failed')});}
  });
  interfaceReader.on('error',()=>{});
}

function createMainWindow(){
  qaRendererDomReady=false;qaRendererDidFinishLoad=false;
  mainWindow=new BrowserWindow({width:1280,height:820,minWidth:960,minHeight:640,show:false,transparent:process.platform==='darwin',backgroundColor:process.platform==='darwin'?'#00000000':'#07111f',title:'DominionStar Meet',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',trafficLightPosition:process.platform==='darwin'?{x:18,y:18}:undefined,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:!app.isPackaged,backgroundThrottling:false}});
  installQaRequestTrace(mainWindow);
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//i.test(url))void shell.openExternal(url);return {action:'deny'};});
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url.startsWith('file://'))return;event.preventDefault();if(/^https:\/\//i.test(url))void shell.openExternal(url);});
  mainWindow.once('ready-to-show',()=>mainWindow?.show());
  mainWindow.webContents.on('did-start-navigation',(_event,_url,isInPlace,isMainFrame)=>{if(isMainFrame&&!isInPlace){qaRendererDomReady=false;qaRendererDidFinishLoad=false;}});
  mainWindow.webContents.once('dom-ready',()=>{qaRendererDomReady=true;});
  mainWindow.webContents.once('did-finish-load',()=>{
    qaRendererDidFinishLoad=true;
    const pending=pendingJoinUrls[0]||'';if(pending)mainWindow?.webContents.send('app:join-url',pending);
  });
  mainWindow.webContents.on('render-process-gone',(_event,details={})=>{
    console.error('[DOMINIONSTAR_RENDERER_GONE]',JSON.stringify({reason:String(details.reason||'unknown'),exitCode:Number(details.exitCode||0)}));
  });
  mainWindow.on('focus',()=>{try{mainWindow?.flashFrame(false);}catch{}});
  void mainWindow.loadFile(path.join(uiDir,'index.html'));
  mainWindow.on('closed',()=>{try{if(mainWindow?.webContents?.debugger?.isAttached?.())mainWindow.webContents.debugger.detach();}catch{}try{shareService?.shutdown?.();}catch{}mainWindow=null;});
}
function focusOrCreateMainWindow(){
  if(mainWindow&&!mainWindow.isDestroyed()){
    let rendererHealthy=true;
    try{rendererHealthy=Boolean(mainWindow.webContents&&!mainWindow.webContents.isDestroyed()&&!mainWindow.webContents.isCrashed?.());}catch{rendererHealthy=false;}
    if(!rendererHealthy){
      try{mainWindow.destroy();}catch{}
      mainWindow=null;
      createMainWindow();
      return;
    }
    if(shareService?.recoverMainWindow?.({focus:true}))return;
    try{if(mainWindow.isMinimized())mainWindow.restore();}catch{}
    try{mainWindow.show();mainWindow.focus();}catch{}
    return;
  }
  createMainWindow();
}

ipcMain.handle('app:get-environment',()=>({platform:process.platform,version:app.getVersion(),packaged:app.isPackaged,surface:'local-desktop-home',releaseChannel:app.getVersion().includes('-')?'qa':'production',qaInteractionFixtures,qaPresenterFixtures:qaFixtureRequested,qaKeepMacPresenterHidden:process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1',installedInApplications:process.platform!=='darwin'||!app.isPackaged||app.isInApplicationsFolder()}));
ipcMain.handle('diagnostics:system-metrics',()=>{
  try{
    return app.getAppMetrics().map(item=>({
      pid:Number(item.pid)||0,
      type:String(item.type||''),
      cpu:Number(item.cpu?.percentCPUUsage)||0,
      idleWakeups:Number(item.cpu?.idleWakeupsPerSecond)||0,
      memory:{
        workingSetSize:Number(item.memory?.workingSetSize)||0,
        peakWorkingSetSize:Number(item.memory?.peakWorkingSetSize)||0,
        privateBytes:Number(item.memory?.privateBytes)||0
      }
    }));
  }catch{return [];}
});
ipcMain.handle('diagnostics:export',async(_event,{report}={})=>{
  try{
    const payload=report&&typeof report==='object'?report:{};
    const raw=JSON.stringify(payload,null,2);
    if(Buffer.byteLength(raw,'utf8')>20*1024*1024)throw new Error('diagnostic_report_too_large');
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const filePath=path.join(app.getPath('downloads'),`DominionStar-Meet-Diagnostic-${stamp}.json`);
    await writeFile(filePath,raw,'utf8');
    try{shell.showItemInFolder(filePath);}catch{}
    return {ok:true,path:filePath,fileName:path.basename(filePath),bytes:Buffer.byteLength(raw,'utf8')};
  }catch(error){
    return {ok:false,error:String(error?.message||error||'diagnostic_export_failed')};
  }
});

ipcMain.handle('app:meeting-ended',()=>{
  try{shareService?.shutdown?.();}catch(error){console.error('[DominionStar Meet] Meeting-end native cleanup failed.',error);}
  focusOrCreateMainWindow();
  return {ok:true};
});
ipcMain.handle('app:consume-join-url',()=>{
  while(pendingJoinUrls.length){const value=validJoinUrl(pendingJoinUrls.shift());if(value)return value;}
  return '';
});
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
ipcMain.handle('meeting:set-waiting-room',(_event,{roomId,enabled})=>meetingService?.setWaitingRoom(roomId,enabled));
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
  shareService=createShareService({BrowserWindow,desktopCapturer,desktopSession:session.defaultSession,ipcMain,path,uiDir,preloadPath,getMainWindow:()=>mainWindow,platform:process.platform,screen,ensureScreenPermission:requestScreenPermission,openPrivacySettings});
  createMainWindow();
  installQaInteractionBridge();
  const sendPowerEvent=(type)=>{
    if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('app:power-event',{type,at:Date.now()});
  };
  powerMonitor.on('suspend',()=>sendPowerEvent('suspend'));
  powerMonitor.on('resume',()=>sendPowerEvent('resume'));
  powerMonitor.on('lock-screen',()=>sendPowerEvent('lock-screen'));
  powerMonitor.on('unlock-screen',()=>sendPowerEvent('unlock-screen'));
  app.on('activate',focusOrCreateMainWindow);
});
app.on('before-quit',()=>{try{shareService?.shutdown?.();}catch{}});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});