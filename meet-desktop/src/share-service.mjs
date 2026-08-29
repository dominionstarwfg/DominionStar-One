import { createShareSourceAuthority } from './share-source-authority.mjs';

export function createShareService({BrowserWindow,desktopCapturer,desktopSession,ipcMain,path,uiDir,preloadPath,getMainWindow,platform,ensureScreenPermission,openPrivacySettings}){
  let pickerWindow=null;
  let toolbarWindow=null;
  let pendingSelection=null;
  let shareActive=false;
  let savedMainWindowState=null;
  let mainMinimizeHandler=null;
  let lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true};

  const authority=createShareSourceAuthority({
    timeoutMs:4500,
    enumerateSources:async options=>{
      const includeDominionStar=Boolean(options?.includeDominionStar);
      const kind=String(options?.kind||'screen')==='window'?'window':'screen';
      // Physical-Mac rule: enumerate one source class at a time. Asking
      // ScreenCaptureKit for every screen + every application window + icons
      // on the first click is unnecessarily expensive and can stall Electron.
      const sources=await desktopCapturer.getSources({
        types:[kind],
        thumbnailSize:{width:256,height:144},
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
    const bounds=main.getBounds();
    win.setBounds({x:Math.round(bounds.x+(bounds.width-width)/2),y:Math.round(bounds.y+(bounds.height-height)/2),width,height});
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

  function compactMainWindow({focus=false}={}){
    if(!shareActive)return false;
    const main=rememberMainWindow();
    if(!main||main.isDestroyed())return false;
    const reference=savedMainWindowState?.bounds||main.getBounds();
    const width=Math.min(420,Math.max(330,Math.round(reference.width*.3)));
    const height=Math.min(300,Math.max(218,Math.round(width*.62)));
    const x=Math.round(reference.x+Math.max(12,reference.width-width-18));
    const y=Math.round(reference.y+Math.max(54,Math.min(86,reference.height-height-18)));
    try{if(main.isMinimized?.())main.restore();}catch{}
    try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}
    try{if(main.isMaximized?.())main.unmaximize();}catch{}
    try{main.setMinimumSize(300,190);}catch{}
    try{main.setBounds({x,y,width,height},true);}catch{}
    try{main.setAlwaysOnTop(true,'floating');}catch{}
    protectMeetingChrome(main,true);
    main.showInactive?.();
    if(focus){main.show();main.focus();}
    lastToolbarState={...lastToolbarState,meetingVisible:false};
    publishToolbarState();
    return true;
  }

  function showMeetingWindow({focus=true}={}){
    const main=getMainWindow?.();
    if(!main||main.isDestroyed())return false;
    const saved=savedMainWindowState;
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
    savedMainWindowState=null;
  }

  function attachShareWindowLifecycle(){
    const main=getMainWindow?.();
    if(!main||main.isDestroyed()||mainMinimizeHandler)return;
    mainMinimizeHandler=event=>{
      if(!shareActive)return;
      event?.preventDefault?.();
      compactMainWindow({focus:false});
    };
    main.on('minimize',mainMinimizeHandler);
  }

  function detachShareWindowLifecycle(){
    const main=getMainWindow?.();
    if(main&&!main.isDestroyed()&&mainMinimizeHandler)main.removeListener('minimize',mainMinimizeHandler);
    mainMinimizeHandler=null;
  }

  function openPicker(){
    if(pickerWindow&&!pickerWindow.isDestroyed()){pickerWindow.show();pickerWindow.focus();return {opened:true,reused:true};}
    pickerWindow=new BrowserWindow({width:940,height:650,minWidth:760,minHeight:520,show:false,backgroundColor:'#101214',title:'Choose what to share',resizable:true,fullscreenable:false,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
    positionNearMain(pickerWindow,940,650);
    pickerWindow.removeMenu?.();
    protectMeetingChrome(pickerWindow,true);
    pickerWindow.once('ready-to-show',()=>{pickerWindow?.show();pickerWindow?.focus();});
    void pickerWindow.loadFile(path.join(uiDir,'share-picker.html'));
    pickerWindow.on('closed',()=>{pickerWindow=null;});
    return {opened:true,reused:false};
  }

  function closePicker(){if(pickerWindow&&!pickerWindow.isDestroyed())pickerWindow.close();pickerWindow=null;}

  function openToolbar(){
    if(toolbarWindow&&!toolbarWindow.isDestroyed()){toolbarWindow.showInactive();publishToolbarState();return;}
    toolbarWindow=new BrowserWindow({width:820,height:74,minWidth:620,minHeight:74,maxHeight:74,show:false,frame:false,transparent:false,backgroundColor:'#16191d',resizable:true,fullscreenable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
    const main=getMainWindow?.();
    if(main&&!main.isDestroyed()){
      const bounds=savedMainWindowState?.bounds||main.getBounds();
      toolbarWindow.setBounds({x:Math.round(bounds.x+(bounds.width-820)/2),y:Math.max(24,bounds.y+18),width:820,height:74});
    }
    toolbarWindow.setAlwaysOnTop(true,'floating');
    protectMeetingChrome(toolbarWindow,true);
    toolbarWindow.webContents.once('did-finish-load',()=>publishToolbarState());
    toolbarWindow.once('ready-to-show',()=>toolbarWindow?.showInactive());
    void toolbarWindow.loadFile(path.join(uiDir,'presenter-toolbar.html'));
    toolbarWindow.on('closed',()=>{toolbarWindow=null;});
  }

  function closeToolbar(){if(toolbarWindow&&!toolbarWindow.isDestroyed())toolbarWindow.close();toolbarWindow=null;}
  const sendMain=(channel,payload)=>{const main=getMainWindow?.();if(main&&!main.isDestroyed())main.webContents.send(channel,payload);};

  desktopSession.setDisplayMediaRequestHandler((_request,callback)=>{
    const selection=pendingSelection;
    pendingSelection=null;
    if(!selection?.source){callback({});return;}
    const response={video:selection.source};
    if(selection.options?.shareAudio&&(platform==='win32'||platform==='darwin'))response.audio='loopback';
    callback(response);
  },{useSystemPicker:false});

  ipcMain.handle('share:open-picker',async()=>{
    if(platform==='darwin'&&typeof ensureScreenPermission==='function'){
      const permission=await ensureScreenPermission();
      if(!permission?.ok){
        // Do not open System Settings automatically and do not run native source
        // discovery here. Return immediately so the meeting process never
        // appears frozen. The UI can offer the explicit permission action.
        return {
          opened:false,
          permissionRequired:true,
          status:String(permission?.status||'unknown'),
          restartRequired:Boolean(permission?.restartRequired),
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
    compactMainWindow({focus:false});
    return {ok:true};
  });
  ipcMain.handle('share:capture-state',(_event,state={})=>{lastToolbarState={...lastToolbarState,...state};publishToolbarState();return {ok:true};});
  ipcMain.handle('share:capture-stopped',()=>{
    shareActive=false;
    detachShareWindowLifecycle();
    restoreMainWindowAfterShare();
    lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true};
    closeToolbar();
    return {ok:true};
  });
  ipcMain.handle('share:presenter-command',(_event,command)=>{
    const normalized=String(command||'');
    if(normalized==='show-meeting'&&shareActive){
      if(lastToolbarState.meetingVisible)compactMainWindow({focus:false});
      else showMeetingWindow({focus:true});
    }else if(['participants','chat','annotate'].includes(normalized)&&shareActive){
      showMeetingWindow({focus:true});
    }else if(['show-meeting','participants','chat','annotate'].includes(normalized)){
      const main=getMainWindow?.();if(main&&!main.isDestroyed()){main.show();main.focus();}
    }
    sendMain('share:presenter-command',normalized);
    return {ok:true};
  });

  return Object.freeze({openPicker,closePicker,closeToolbar,sourceAuthority:authority});
}
