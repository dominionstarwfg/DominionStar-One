import { createShareSourceAuthority } from './share-source-authority.mjs';

export function createShareService({BrowserWindow,desktopCapturer,desktopSession,ipcMain,path,uiDir,preloadPath,getMainWindow,platform,ensureScreenPermission,openPrivacySettings}){
  let pickerWindow=null;
  let toolbarWindow=null;
  let pendingSelection=null;
  let shareActive=false;
  let savedMainWindowState=null;
  let mainMinimizeHandler=null;
  let displayPickerMode='';
  let stopRetryTimer=null;
  let lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true};

  const macVersion=platform==='darwin'&&typeof process.getSystemVersion==='function'?String(process.getSystemVersion()||''):'';
  const macMajor=Number.parseInt(macVersion.split('.')[0]||'0',10)||0;
  const nativeSystemPicker=platform==='darwin'&&macMajor>=15;

  const authority=createShareSourceAuthority({
    timeoutMs:4500,
    enumerateSources:async options=>{
      const includeDominionStar=Boolean(options?.includeDominionStar);
      const kind=String(options?.kind||'screen')==='window'?'window':'screen';
      const sources=await desktopCapturer.getSources({
        types:[kind],
        thumbnailSize:{width:320,height:180},
        fetchWindowIcons:false
      });
      return sources.filter(source=>includeDominionStar||!/DominionStar Meet/i.test(String(source.name||'')));
    }
  });

  const serialize=source=>({
    id:String(source.id),
    name:String(source.name||'Untitled source'),
    kind:String(source.id||'').startsWith('screen:')?'screen':'window',
    thumbnail:source.thumbnail?.isEmpty?.()?'' : source.thumbnail?.toDataURL?.()||'',
    icon:source.appIcon?.isEmpty?.()?'' : source.appIcon?.toDataURL?.()||''
  });

  const publishToolbarState=()=>{
    if(toolbarWindow&&!toolbarWindow.isDestroyed())toolbarWindow.webContents.send('share:toolbar-state',lastToolbarState);
  };

  function positionNearMain(win,width,height){
    const main=getMainWindow?.();
    if(!main||main.isDestroyed())return;
    const bounds=savedMainWindowState?.bounds||main.getBounds();
    win.setBounds({x:Math.round(bounds.x+(bounds.width-width)/2),y:Math.max(24,bounds.y+18),width,height});
  }

  function protectMeetingChrome(win,enabled=true){
    if(!win||win.isDestroyed())return;
    try{win.setContentProtection(Boolean(enabled));}catch{}
  }

  function rememberMainWindow(){
    const main=getMainWindow?.();
    if(!main||main.isDestroyed()||savedMainWindowState)return main||null;
    const maximized=main.isMaximized?.()||false;
    const fullScreen=main.isFullScreen?.()||false;
    let bounds=main.getBounds();
    if((maximized||fullScreen)&&typeof main.getNormalBounds==='function'){
      try{const normal=main.getNormalBounds();if(normal?.width&&normal?.height)bounds=normal;}catch{}
    }
    let minimumSize=[960,640];
    try{minimumSize=main.getMinimumSize();}catch{}
    savedMainWindowState={bounds:{...bounds},minimumSize,maximized,fullScreen,alwaysOnTop:main.isAlwaysOnTop?.()||false};
    return main;
  }

  function hideMeetingWindowForShare(){
    if(!shareActive)return false;
    const main=rememberMainWindow();
    if(!main||main.isDestroyed())return false;
    protectMeetingChrome(main,true);
    try{main.webContents?.setBackgroundThrottling?.(false);}catch{}
    try{main.setAlwaysOnTop(false);}catch{}
    try{main.hide();}catch{}
    lastToolbarState={...lastToolbarState,meetingVisible:false};
    publishToolbarState();
    return true;
  }

  function showMeetingWindow({focus=true}={}){
    const main=getMainWindow?.();
    if(!main||main.isDestroyed())return false;
    const saved=savedMainWindowState;
    try{main.webContents?.setBackgroundThrottling?.(false);}catch{}
    try{if(main.isMinimized?.())main.restore();}catch{}
    try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}
    try{if(main.isMaximized?.())main.unmaximize();}catch{}
    if(saved){
      try{main.setMinimumSize(...saved.minimumSize);}catch{}
      try{main.setBounds(saved.bounds,true);}catch{}
    }
    try{main.setAlwaysOnTop(false);}catch{}
    protectMeetingChrome(main,shareActive);
    main.show();
    if(focus)main.focus();
    lastToolbarState={...lastToolbarState,meetingVisible:true};
    publishToolbarState();
    return true;
  }

  function restoreMainWindowAfterShare(){
    const main=getMainWindow?.();
    const saved=savedMainWindowState;
    if(!main||main.isDestroyed()){savedMainWindowState=null;return;}
    try{if(main.isMinimized?.())main.restore();}catch{}
    try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}
    try{if(main.isMaximized?.())main.unmaximize();}catch{}
    if(saved){
      try{main.setMinimumSize(...saved.minimumSize);}catch{}
      try{main.setBounds(saved.bounds,true);}catch{}
      try{main.setAlwaysOnTop(Boolean(saved.alwaysOnTop));}catch{}
      try{if(saved.maximized)main.maximize();else if(saved.fullScreen)main.setFullScreen(true);}catch{}
    }else{
      try{main.setMinimumSize(960,640);}catch{}
      try{main.setAlwaysOnTop(false);}catch{}
    }
    protectMeetingChrome(main,false);
    try{main.webContents?.setBackgroundThrottling?.(true);}catch{}
    main.show();
    savedMainWindowState=null;
  }

  function attachShareWindowLifecycle(){
    const main=getMainWindow?.();
    if(!main||main.isDestroyed()||mainMinimizeHandler)return;
    mainMinimizeHandler=event=>{
      if(!shareActive)return;
      event?.preventDefault?.();
      hideMeetingWindowForShare();
    };
    main.on('minimize',mainMinimizeHandler);
  }

  function detachShareWindowLifecycle(){
    const main=getMainWindow?.();
    if(main&&!main.isDestroyed()&&mainMinimizeHandler)main.removeListener('minimize',mainMinimizeHandler);
    mainMinimizeHandler=null;
  }

  function openPicker(){
    if(pickerWindow&&!pickerWindow.isDestroyed()){pickerWindow.show();pickerWindow.focus();return {opened:true,reused:true,nativeSystemPicker:false};}
    pickerWindow=new BrowserWindow({width:900,height:620,minWidth:760,minHeight:520,show:false,backgroundColor:'#16181b',title:'Share Screen',resizable:true,fullscreenable:false,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
    positionNearMain(pickerWindow,900,620);
    pickerWindow.removeMenu?.();
    protectMeetingChrome(pickerWindow,true);
    pickerWindow.once('ready-to-show',()=>{pickerWindow?.show();pickerWindow?.focus();});
    void pickerWindow.loadFile(path.join(uiDir,'share-picker.html'));
    pickerWindow.on('closed',()=>{pickerWindow=null;});
    return {opened:true,reused:false,nativeSystemPicker:false};
  }

  function closePicker(){if(pickerWindow&&!pickerWindow.isDestroyed())pickerWindow.close();pickerWindow=null;}

  function openToolbar(){
    if(toolbarWindow&&!toolbarWindow.isDestroyed()){
      toolbarWindow.show();
      toolbarWindow.moveTop?.();
      publishToolbarState();
      return;
    }
    toolbarWindow=new BrowserWindow({width:930,height:82,minWidth:760,minHeight:82,maxHeight:82,show:false,frame:false,transparent:false,backgroundColor:'#15181c',resizable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,focusable:true,type:platform==='darwin'?'panel':undefined,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false}});
    positionNearMain(toolbarWindow,930,82);
    try{toolbarWindow.setAlwaysOnTop(true,'floating');}catch{}
    if(platform==='darwin'){
      try{toolbarWindow.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    }
    protectMeetingChrome(toolbarWindow,true);
    toolbarWindow.webContents.once('did-finish-load',()=>publishToolbarState());
    toolbarWindow.once('ready-to-show',()=>{
      if(!toolbarWindow||toolbarWindow.isDestroyed())return;
      toolbarWindow.show();
      toolbarWindow.moveTop?.();
    });
    void toolbarWindow.loadFile(path.join(uiDir,'presenter-toolbar.html'));
    toolbarWindow.on('closed',()=>{toolbarWindow=null;});
  }

  function closeToolbar(){if(toolbarWindow&&!toolbarWindow.isDestroyed()){try{toolbarWindow.setClosable?.(true);}catch{}toolbarWindow.close();}toolbarWindow=null;}
  const sendMain=(channel,payload)=>{const main=getMainWindow?.();if(main&&!main.isDestroyed())main.webContents.send(channel,payload);};

  const displayMediaHandler=(_request,callback)=>{
    const selection=pendingSelection;
    pendingSelection=null;
    if(!selection?.source){callback({});return;}
    const response={video:selection.source};
    if(selection.options?.shareAudio&&(platform==='win32'||platform==='darwin'))response.audio='loopback';
    callback(response);
  };

  function configureDisplayMediaHandler(useSystemPicker){
    const mode=useSystemPicker?'native':'dominionstar';
    if(displayPickerMode===mode)return;
    desktopSession.setDisplayMediaRequestHandler(displayMediaHandler,{useSystemPicker:Boolean(useSystemPicker)});
    displayPickerMode=mode;
  }

  // First-time macOS permission stays native-first. Once TCC reports granted,
  // DominionStar owns source selection so the presenter gets the same compact
  // chooser every time instead of Apple's full-screen system preview.
  configureDisplayMediaHandler(nativeSystemPicker);

  ipcMain.handle('share:open-picker',async(_event,{permission='unknown'}={})=>{
    const status=String(permission||'unknown').toLowerCase();
    if(nativeSystemPicker&&status!=='granted'){
      configureDisplayMediaHandler(true);
      return {opened:false,nativeSystemPicker:true,status:'system-picker'};
    }
    configureDisplayMediaHandler(false);
    if(platform==='darwin'&&!nativeSystemPicker&&typeof ensureScreenPermission==='function'){
      const permissionResult=await ensureScreenPermission();
      if(!permissionResult?.ok){
        return {
          opened:false,
          nativeSystemPicker:false,
          permissionRequired:true,
          status:String(permissionResult?.status||'unknown'),
          restartRequired:Boolean(permissionResult?.restartRequired),
          passive:true
        };
      }
    }
    return openPicker();
  });
  ipcMain.handle('share:list-sources',async(_event,options={})=>{
    try{
      const result=await authority.list(options);
      if(result.timedOut)return {ok:false,timedOut:true,sources:[]};
      return {ok:true,timedOut:false,sources:result.sources.map(serialize)};
    }catch(error){return {ok:false,timedOut:false,sources:[],error:String(error?.message||error)};}
  });
  ipcMain.handle('share:select-source',(_event,{sourceId,options={}}={})=>{
    const source=authority.get(sourceId);
    if(!source)return {ok:false,error:'share_source_not_available'};
    const normalizedOptions={optimizeVideo:Boolean(options.optimizeVideo),shareAudio:Boolean(options.shareAudio)};
    pendingSelection={source,options:normalizedOptions};
    closePicker();
    queueMicrotask(()=>sendMain('share:source-selected',{sourceId:String(source.id),name:String(source.name||'Shared content'),options:normalizedOptions}));
    return {ok:true};
  });
  ipcMain.handle('share:cancel-picker',()=>{closePicker();return {ok:true};});
  ipcMain.handle('share:capture-started',(_event,state={})=>{
    shareActive=true;
    rememberMainWindow();
    attachShareWindowLifecycle();
    lastToolbarState={...lastToolbarState,...state,meetingVisible:false};
    openToolbar();
    hideMeetingWindowForShare();
    return {ok:true};
  });
  ipcMain.handle('share:capture-state',(_event,state={})=>{lastToolbarState={...lastToolbarState,...state};publishToolbarState();return {ok:true};});
  ipcMain.handle('share:capture-stopped',()=>{
    shareActive=false;
    if(stopRetryTimer){clearTimeout(stopRetryTimer);stopRetryTimer=null;}
    detachShareWindowLifecycle();
    restoreMainWindowAfterShare();
    lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true};
    closeToolbar();
    return {ok:true};
  });
  ipcMain.handle('share:presenter-command',(_event,command)=>{
    const normalized=String(command||'');
    if(normalized==='show-meeting'&&shareActive){
      if(lastToolbarState.meetingVisible)hideMeetingWindowForShare();
      else showMeetingWindow({focus:true});
    }else if(['participants','chat'].includes(normalized)&&shareActive){
      showMeetingWindow({focus:true});
    }else if(['show-meeting','participants','chat'].includes(normalized)){
      const main=getMainWindow?.();if(main&&!main.isDestroyed()){main.show();main.focus();}
    }
    sendMain('share:presenter-command',normalized);
    if(normalized==='stop'&&shareActive){
      if(stopRetryTimer)clearTimeout(stopRetryTimer);
      stopRetryTimer=setTimeout(()=>{
        stopRetryTimer=null;
        if(shareActive)sendMain('share:presenter-command','stop');
      },700);
    }
    return {ok:true};
  });

  return Object.freeze({openPicker,closePicker,closeToolbar,sourceAuthority:authority,nativeSystemPicker});
}
