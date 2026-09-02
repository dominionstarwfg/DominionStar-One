import { createShareSourceAuthority } from './share-source-authority.mjs';

export function createShareService({BrowserWindow,desktopCapturer,desktopSession,ipcMain,path,uiDir,preloadPath,getMainWindow,platform,ensureScreenPermission,openPrivacySettings}){
  let pickerWindow=null;
  let toolbarWindow=null;
  let pendingSelection=null;
  let shareActive=false;
  let toolbarReadyForShare=false;
  let presenterCommitPending=false;
  let toolbarOpenTimer=null;
  let savedMainWindowState=null;
  let mainMinimizeHandler=null;
  let displayPickerMode='';
  let stopRetryTimer=null;
  let qaPresenterCommandSeq=0;
  let lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true,companion:''};

  const macVersion=platform==='darwin'&&typeof process.getSystemVersion==='function'?String(process.getSystemVersion()||''):'';
  const macMajor=Number.parseInt(macVersion.split('.')[0]||'0',10)||0;
  const nativeSystemPicker=platform==='darwin'&&macMajor>=15;
  const presenterParkPoint={x:-32000,y:-32000};
  const qaPresenterTrace=process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';

  const authority=createShareSourceAuthority({
    timeoutMs:4500,
    enumerateSources:async options=>{
      const includeDominionStar=Boolean(options?.includeDominionStar);
      const kind=String(options?.kind||'screen')==='window'?'window':'screen';
      const sources=await desktopCapturer.getSources({types:[kind],thumbnailSize:{width:320,height:180},fetchWindowIcons:false});
      return sources.filter(source=>includeDominionStar||!/DominionStar Meet/i.test(String(source.name||'')));
    }
  });

  const serialize=source=>({id:String(source.id),name:String(source.name||'Untitled source'),kind:String(source.id||'').startsWith('screen:')?'screen':'window',thumbnail:source.thumbnail?.isEmpty?.()?'' : source.thumbnail?.toDataURL?.()||'',icon:source.appIcon?.isEmpty?.()?'' : source.appIcon?.toDataURL?.()||''});
  const publishToolbarState=()=>{if(toolbarWindow&&!toolbarWindow.isDestroyed())toolbarWindow.webContents.send('share:toolbar-state',lastToolbarState);};
  const presenterRendererMeta=()=>{
    const main=getMainWindow?.(),webContents=main?.webContents;
    let webContentsDestroyed=true,crashed=false,osPid=0,url='',visible=false;
    try{webContentsDestroyed=!webContents||webContents.isDestroyed();}catch{}
    try{crashed=Boolean(webContents?.isCrashed?.());}catch{}
    try{osPid=Number(webContents?.getOSProcessId?.()||0)||0;}catch{}
    try{url=String(webContents?.getURL?.()||'');}catch{}
    try{visible=Boolean(main?.isVisible?.());}catch{}
    return {windowDestroyed:!main||main.isDestroyed(),webContentsId:Number(webContents?.id||0)||0,webContentsDestroyed,crashed,osPid,url,visible};
  };
  const qaPresenterLog=(marker,fields={})=>{
    if(!qaPresenterTrace)return;
    const pairs=Object.entries(fields).map(([key,value])=>`${key}=${String(value??'').replace(/\s+/g,'_')}`);
    console.log(`QA_PRESENTER_${marker}${pairs.length?` ${pairs.join(' ')}`:''}`);
  };

  function positionNearMain(win,width,height){const main=getMainWindow?.();if(!main||main.isDestroyed())return;const bounds=savedMainWindowState?.bounds||main.getBounds();win.setBounds({x:Math.round(bounds.x+(bounds.width-width)/2),y:Math.max(24,bounds.y+18),width,height});}
  function protectMeetingChrome(win,enabled=true){if(!win||win.isDestroyed())return;try{win.setContentProtection(Boolean(enabled));}catch{}}
  function rememberMainWindow(){
    const main=getMainWindow?.();if(!main||main.isDestroyed()||savedMainWindowState)return main||null;
    const maximized=main.isMaximized?.()||false,fullScreen=main.isFullScreen?.()||false;let bounds=main.getBounds();
    if((maximized||fullScreen)&&typeof main.getNormalBounds==='function'){try{const normal=main.getNormalBounds();if(normal?.width&&normal?.height)bounds=normal;}catch{}}
    let minimumSize=[960,640];try{minimumSize=main.getMinimumSize();}catch{}
    savedMainWindowState={bounds:{...bounds},minimumSize,maximized,fullScreen,alwaysOnTop:main.isAlwaysOnTop?.()||false};return main;
  }
  function keepMeetingRendererLive(){const main=getMainWindow?.();if(!main||main.isDestroyed())return false;try{main.webContents?.setBackgroundThrottling?.(false);}catch{}return true;}
  function hideMeetingWindowForShare(){
    if(!shareActive)return false;const main=rememberMainWindow();if(!main||main.isDestroyed())return false;
    // Never BrowserWindow.hide() the renderer that owns capture. Keep it alive,
    // content-protected, non-interactive and parked off-screen while the floating
    // presenter toolbar remains visible above the shared application.
    const qaSyntheticShare=qaPresenterTrace&&String(lastToolbarState.sourceName||'')==='QA Synthetic Share';
    if(!qaSyntheticShare)protectMeetingChrome(main,true);keepMeetingRendererLive();
    try{if(main.isMinimized?.())main.restore();}catch{}try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}try{if(main.isMaximized?.())main.unmaximize();}catch{}
    try{main.setAlwaysOnTop(false);}catch{}try{main.setIgnoreMouseEvents(true);}catch{}
    const saved=savedMainWindowState?.bounds||main.getBounds();
    try{main.setBounds({x:presenterParkPoint.x,y:presenterParkPoint.y,width:Math.max(320,saved.width),height:Math.max(240,saved.height)},false);}catch{}
    try{main.showInactive?.();}catch{try{main.show();}catch{}}
    lastToolbarState={...lastToolbarState,meetingVisible:false,companion:''};publishToolbarState();return true;
  }
  function showMeetingWindow({focus=true}={}){
    const main=getMainWindow?.();if(!main||main.isDestroyed())return false;const saved=savedMainWindowState;keepMeetingRendererLive();
    try{main.setIgnoreMouseEvents(false);}catch{}try{if(main.isMinimized?.())main.restore();}catch{}try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}try{if(main.isMaximized?.())main.unmaximize();}catch{}
    if(saved){try{main.setMinimumSize(...saved.minimumSize);}catch{}try{main.setBounds(saved.bounds,true);}catch{}}
    try{main.setAlwaysOnTop(false);}catch{}protectMeetingChrome(main,shareActive);main.show();if(focus)main.focus();lastToolbarState={...lastToolbarState,meetingVisible:true,companion:''};publishToolbarState();return true;
  }
  function showCompanionWindow(kind='chat'){
    if(!shareActive)return false;const main=rememberMainWindow();if(!main||main.isDestroyed())return false;const base=savedMainWindowState?.bounds||main.getBounds();const annotation=kind==='annotate';
    const width=annotation?Math.min(960,Math.max(720,base.width-120)):410,height=annotation?Math.min(660,Math.max(500,base.height-120)):Math.min(620,Math.max(500,base.height-100));
    const x=annotation?Math.round(base.x+(base.width-width)/2):Math.round(base.x+base.width-width-18),y=annotation?Math.round(base.y+(base.height-height)/2):Math.round(base.y+70);
    try{main.setIgnoreMouseEvents(false);}catch{}try{if(main.isMinimized?.())main.restore();}catch{}try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}try{if(main.isMaximized?.())main.unmaximize();}catch{}
    try{main.setMinimumSize(annotation?640:330,annotation?460:420);}catch{}try{main.setBounds({x,y,width,height},false);}catch{}keepMeetingRendererLive();
    try{main.setAlwaysOnTop(true,'floating');}catch{try{main.setAlwaysOnTop(true);}catch{}}protectMeetingChrome(main,true);main.show();main.focus();
    lastToolbarState={...lastToolbarState,meetingVisible:true,companion:String(kind||'')};publishToolbarState();return true;
  }
  function restoreMainWindowAfterShare(){
    const main=getMainWindow?.(),saved=savedMainWindowState;if(!main||main.isDestroyed()){savedMainWindowState=null;return;}
    try{main.setIgnoreMouseEvents(false);}catch{}try{if(main.isMinimized?.())main.restore();}catch{}try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}try{if(main.isMaximized?.())main.unmaximize();}catch{}
    if(saved){try{main.setMinimumSize(...saved.minimumSize);}catch{}try{main.setBounds(saved.bounds,true);}catch{}try{main.setAlwaysOnTop(Boolean(saved.alwaysOnTop));}catch{}try{if(saved.maximized)main.maximize();else if(saved.fullScreen)main.setFullScreen(true);}catch{}}
    else{try{main.setMinimumSize(960,640);}catch{}try{main.setAlwaysOnTop(false);}catch{}}
    protectMeetingChrome(main,false);try{main.webContents?.setBackgroundThrottling?.(true);}catch{}main.show();savedMainWindowState=null;
  }
  function attachShareWindowLifecycle(){const main=getMainWindow?.();if(!main||main.isDestroyed()||mainMinimizeHandler)return;mainMinimizeHandler=event=>{if(!shareActive)return;event?.preventDefault?.();hideMeetingWindowForShare();};main.on('minimize',mainMinimizeHandler);}
  function detachShareWindowLifecycle(){const main=getMainWindow?.();if(main&&!main.isDestroyed()&&mainMinimizeHandler)main.removeListener('minimize',mainMinimizeHandler);mainMinimizeHandler=null;}

  function openPicker(){
    if(pickerWindow&&!pickerWindow.isDestroyed()){pickerWindow.show();pickerWindow.focus();return {opened:true,reused:true,nativeSystemPicker:false};}
    pickerWindow=new BrowserWindow({width:900,height:620,minWidth:760,minHeight:520,show:false,backgroundColor:'#16181b',title:'Share Screen',resizable:true,fullscreenable:false,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
    positionNearMain(pickerWindow,900,620);pickerWindow.removeMenu?.();protectMeetingChrome(pickerWindow,true);pickerWindow.once('ready-to-show',()=>{pickerWindow?.show();pickerWindow?.focus();});void pickerWindow.loadFile(path.join(uiDir,'share-picker.html'));pickerWindow.on('closed',()=>{pickerWindow=null;});
    return {opened:true,reused:false,nativeSystemPicker:false};
  }
  function closePicker(){if(pickerWindow&&!pickerWindow.isDestroyed())pickerWindow.close();pickerWindow=null;}

  async function openToolbar(){
    if(toolbarWindow&&!toolbarWindow.isDestroyed()){toolbarWindow.show();toolbarWindow.moveTop?.();publishToolbarState();return true;}
    const created=new BrowserWindow({width:930,height:82,minWidth:760,minHeight:82,maxHeight:310,show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,focusable:true,acceptFirstMouse:true,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false}});
    toolbarWindow=created;positionNearMain(created,930,82);try{created.setAlwaysOnTop(true,'floating');}catch{}
    if(platform==='darwin'){try{created.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}}
    protectMeetingChrome(created,true);created.on('closed',()=>{if(toolbarWindow===created)toolbarWindow=null;});
    try{await created.loadFile(path.join(uiDir,'presenter-toolbar.html'));if(created.isDestroyed()||toolbarWindow!==created)return false;created.show();created.moveTop?.();publishToolbarState();return true;}
    catch(error){try{created.setClosable?.(true);created.close();}catch{}if(toolbarWindow===created)toolbarWindow=null;console.error('[DominionStar Meet] Presenter toolbar failed to load.',error);return false;}
  }
  function closeToolbar(){if(toolbarWindow&&!toolbarWindow.isDestroyed()){try{toolbarWindow.setClosable?.(true);}catch{}toolbarWindow.close();}toolbarWindow=null;}
  const sendMain=(channel,payload)=>{const main=getMainWindow?.();if(main&&!main.isDestroyed()){main.webContents.send(channel,payload);return true;}return false;};
  const sendPresenterCommand=(command,toolbarSenderId=0)=>{
    const normalized=String(command?.command||command||'');
    const qaCommandId=qaPresenterTrace?++qaPresenterCommandSeq:0;
    const outbound=qaCommandId?{command:normalized,qaCommandId}:normalized;
    const meta=presenterRendererMeta();
    qaPresenterLog('MAIN_ACCEPT',{id:qaCommandId,command:normalized,toolbar:toolbarSenderId,target:meta.webContentsId,pid:meta.osPid,destroyed:meta.webContentsDestroyed?1:0,crashed:meta.crashed?1:0,visible:meta.visible?1:0,url:encodeURIComponent(meta.url)});
    const sent=sendMain('share:presenter-command',outbound);
    qaPresenterLog('MAIN_SENT',{id:qaCommandId,command:normalized,sent:sent?1:0,target:meta.webContentsId,pid:meta.osPid});
    return {sent,qaCommandId};
  };

  function cancelToolbarOpen(){if(toolbarOpenTimer){clearTimeout(toolbarOpenTimer);toolbarOpenTimer=null;}}
  function scheduleToolbarForShare(){
    cancelToolbarOpen();
    toolbarOpenTimer=setTimeout(async()=>{
      toolbarOpenTimer=null;if(!shareActive)return;
      const ready=await openToolbar();if(!shareActive)return;
      toolbarReadyForShare=Boolean(ready);publishToolbarState();
      if(!ready){presenterCommitPending=false;showMeetingWindow({focus:false});sendMain('share:presenter-command','stop');return;}
      if(presenterCommitPending){presenterCommitPending=false;hideMeetingWindowForShare();}
    },75);
  }

  const displayMediaHandler=(_request,callback)=>{const selection=pendingSelection;pendingSelection=null;if(!selection?.source){callback({});return;}const response={video:selection.source};if(selection.options?.shareAudio&&(platform==='win32'||platform==='darwin'))response.audio='loopback';callback(response);};
  function configureDisplayMediaHandler(useSystemPicker){const mode=useSystemPicker?'native':'dominionstar';if(displayPickerMode===mode)return;desktopSession.setDisplayMediaRequestHandler(displayMediaHandler,{useSystemPicker:Boolean(useSystemPicker)});displayPickerMode=mode;}
  configureDisplayMediaHandler(nativeSystemPicker);

  ipcMain.handle('share:open-picker',async(_event,{permission='unknown'}={})=>{
    const status=String(permission||'unknown').toLowerCase();if(nativeSystemPicker&&status!=='granted'){configureDisplayMediaHandler(true);return {opened:false,nativeSystemPicker:true,status:'system-picker'};}
    configureDisplayMediaHandler(false);
    if(platform==='darwin'&&!nativeSystemPicker&&typeof ensureScreenPermission==='function'){const permissionResult=await ensureScreenPermission();if(!permissionResult?.ok)return {opened:false,nativeSystemPicker:false,permissionRequired:true,status:String(permissionResult?.status||'unknown'),restartRequired:Boolean(permissionResult?.restartRequired),passive:true};}
    return openPicker();
  });
  ipcMain.handle('share:probe-access',async()=>{try{const result=await authority.list({kind:'screen'});if(result.timedOut)return {ok:false,status:'timeout'};const readable=result.sources.some(source=>!source.thumbnail?.isEmpty?.());return {ok:readable,status:readable?'granted':'unavailable',sourceCount:result.sources.length};}catch(error){return {ok:false,status:'error',error:String(error?.message||error)};}});
  ipcMain.handle('share:list-sources',async(_event,options={})=>{try{const result=await authority.list(options);if(result.timedOut)return {ok:false,timedOut:true,sources:[]};return {ok:true,timedOut:false,sources:result.sources.map(serialize)};}catch(error){return {ok:false,timedOut:false,sources:[],error:String(error?.message||error)};}});
  ipcMain.handle('share:select-source',(_event,{sourceId,options={}}={})=>{const source=authority.get(sourceId);if(!source)return {ok:false,error:'share_source_not_available'};const normalizedOptions={optimizeVideo:Boolean(options.optimizeVideo),shareAudio:Boolean(options.shareAudio)};pendingSelection={source,options:normalizedOptions};closePicker();queueMicrotask(()=>sendMain('share:source-selected',{sourceId:String(source.id),name:String(source.name||'Shared content'),options:normalizedOptions}));return {ok:true};});
  ipcMain.handle('share:cancel-picker',()=>{closePicker();return {ok:true};});

  ipcMain.on('share:capture-started',(event,state={})=>{
    const main=getMainWindow?.();if(!main||main.isDestroyed()||event.sender!==main.webContents)return;
    shareActive=true;toolbarReadyForShare=false;presenterCommitPending=false;rememberMainWindow();keepMeetingRendererLive();attachShareWindowLifecycle();
    lastToolbarState={...lastToolbarState,...state,meetingVisible:true,companion:''};
    const meta=presenterRendererMeta();qaPresenterLog('CAPTURE_STARTED',{sender:Number(event.sender?.id||0),target:meta.webContentsId,pid:meta.osPid,url:encodeURIComponent(meta.url)});
    // Fire-and-forget only: capture start must never depend on a main-process
    // response before ShareController can publish its active state.
  });
  ipcMain.handle('share:capture-state',(_event,state={})=>{const priorCompanion=String(lastToolbarState.companion||'');lastToolbarState={...lastToolbarState,...state};if(shareActive&&priorCompanion&&state.companionOpen===false)hideMeetingWindowForShare();else publishToolbarState();return {ok:true};});
  ipcMain.on('share:presenter-committed',(event,state={})=>{
    if(!shareActive)return;const main=getMainWindow?.();if(!main||main.isDestroyed()||event.sender!==main.webContents)return;lastToolbarState={...lastToolbarState,...state};
    const meta=presenterRendererMeta();qaPresenterLog('COMMITTED',{sender:Number(event.sender?.id||0),target:meta.webContentsId,pid:meta.osPid,url:encodeURIComponent(meta.url)});
    presenterCommitPending=true;
    if(!toolbarReadyForShare){scheduleToolbarForShare();return;}
    presenterCommitPending=false;
    setImmediate(()=>{if(shareActive&&toolbarReadyForShare)hideMeetingWindowForShare();});
  });
  ipcMain.on('share:presenter-preload-ack',(event,payload={})=>{
    const main=getMainWindow?.();const meta=presenterRendererMeta();const accepted=Boolean(main&&!main.isDestroyed()&&event.sender===main.webContents);
    qaPresenterLog('PRELOAD_ACK',{id:Number(payload?.qaCommandId||0)||0,command:String(payload?.command||''),accepted:accepted?1:0,sender:Number(event.sender?.id||0),target:meta.webContentsId,pid:meta.osPid});
  });
  ipcMain.handle('share:capture-stopped',()=>{
    shareActive=false;toolbarReadyForShare=false;presenterCommitPending=false;cancelToolbarOpen();if(stopRetryTimer){clearTimeout(stopRetryTimer);stopRetryTimer=null;}detachShareWindowLifecycle();restoreMainWindowAfterShare();
    lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true,companion:''};closeToolbar();return {ok:true};
  });
  ipcMain.handle('share:presenter-menu-state',(_event,{open=false}={})=>{
    if(!toolbarWindow||toolbarWindow.isDestroyed())return {ok:false};
    const bounds=toolbarWindow.getBounds();
    const nextHeight=open?300:82;
    if(bounds.height!==nextHeight){try{toolbarWindow.setBounds({...bounds,height:nextHeight},false);}catch{}}
    return {ok:true,height:nextHeight};
  });
  ipcMain.handle('share:presenter-command',(_event,command)=>{
    const normalized=String(command?.command||command||'');let sent=false,delivery=null;const toolbarSenderId=Number(_event?.sender?.id||0)||0;
    if(normalized==='show-meeting'&&shareActive){if(lastToolbarState.meetingVisible)hideMeetingWindowForShare();else showMeetingWindow({focus:true});}
    else if(['participants','chat','annotate'].includes(normalized)&&shareActive){delivery=sendPresenterCommand(normalized,toolbarSenderId);sent=delivery.sent;setTimeout(()=>{if(shareActive)showCompanionWindow(normalized);},45);}
    else if(['show-meeting','participants','chat','annotate'].includes(normalized)){const main=getMainWindow?.();if(main&&!main.isDestroyed()){main.show();main.focus();}}
    if(!sent){delivery=sendPresenterCommand(normalized,toolbarSenderId);sent=delivery.sent;}
    if(normalized==='stop'&&shareActive){if(stopRetryTimer)clearTimeout(stopRetryTimer);stopRetryTimer=setTimeout(()=>{stopRetryTimer=null;if(shareActive){showMeetingWindow({focus:false});sendMain('share:presenter-command','stop');}},700);}
    return qaPresenterTrace?{ok:true,qaCommandId:Number(delivery?.qaCommandId||0),sent:Boolean(sent)}:{ok:true};
  });

  return Object.freeze({openPicker,closePicker,closeToolbar,sourceAuthority:authority,nativeSystemPicker});
}