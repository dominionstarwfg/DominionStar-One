import { createShareSourceAuthority } from './share-source-authority.mjs';

export function createShareService({BrowserWindow,desktopCapturer,desktopSession,ipcMain,path,uiDir,preloadPath,getMainWindow,platform,ensureScreenPermission,openPrivacySettings}){
  let pickerWindow=null;
  let toolbarWindow=null;
  let pendingSelection=null;
  let lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:''};

  const authority=createShareSourceAuthority({
    timeoutMs:4500,
    enumerateSources:async options=>{
      const includeDominionStar=Boolean(options?.includeDominionStar);
      const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:360,height:220},fetchWindowIcons:true});
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

  function positionNearMain(win,width,height){
    const main=getMainWindow?.();
    if(!main||main.isDestroyed())return;
    const bounds=main.getBounds();
    win.setBounds({x:Math.round(bounds.x+(bounds.width-width)/2),y:Math.round(bounds.y+(bounds.height-height)/2),width,height});
  }

  function openPicker(){
    if(pickerWindow&&!pickerWindow.isDestroyed()){pickerWindow.show();pickerWindow.focus();return {opened:true,reused:true};}
    pickerWindow=new BrowserWindow({width:940,height:650,minWidth:760,minHeight:520,show:false,backgroundColor:'#101214',title:'Choose what to share',resizable:true,fullscreenable:false,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
    positionNearMain(pickerWindow,940,650);
    pickerWindow.removeMenu?.();
    pickerWindow.once('ready-to-show',()=>{pickerWindow?.show();pickerWindow?.focus();});
    void pickerWindow.loadFile(path.join(uiDir,'share-picker.html'));
    pickerWindow.on('closed',()=>{pickerWindow=null;});
    return {opened:true,reused:false};
  }

  function closePicker(){if(pickerWindow&&!pickerWindow.isDestroyed())pickerWindow.close();pickerWindow=null;}

  function openToolbar(){
    if(toolbarWindow&&!toolbarWindow.isDestroyed()){toolbarWindow.showInactive();return;}
    toolbarWindow=new BrowserWindow({width:760,height:74,minWidth:560,minHeight:74,maxHeight:74,show:false,frame:false,transparent:false,backgroundColor:'#16191d',resizable:true,fullscreenable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
    const main=getMainWindow?.();
    if(main&&!main.isDestroyed()){
      const bounds=main.getBounds();
      toolbarWindow.setBounds({x:Math.round(bounds.x+(bounds.width-760)/2),y:Math.max(24,bounds.y+18),width:760,height:74});
    }
    toolbarWindow.setAlwaysOnTop(true,'floating');
    toolbarWindow.webContents.once('did-finish-load',()=>toolbarWindow?.webContents.send('share:toolbar-state',lastToolbarState));
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
    if(selection.options?.shareAudio&&platform==='win32')response.audio='loopback';
    callback(response);
  },{useSystemPicker:false});

  ipcMain.handle('share:open-picker',async()=>{
    if(platform==='darwin'&&typeof ensureScreenPermission==='function'){
      const permission=await ensureScreenPermission();
      if(!permission?.ok){
        if(typeof openPrivacySettings==='function')await openPrivacySettings('screen').catch?.(()=>{});
        return {opened:false,permissionRequired:true,status:String(permission?.status||'unknown'),restartRequired:Boolean(permission?.restartRequired)};
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
  ipcMain.handle('share:capture-started',(_event,state={})=>{lastToolbarState={...lastToolbarState,...state};openToolbar();return {ok:true};});
  ipcMain.handle('share:capture-state',(_event,state={})=>{lastToolbarState={...lastToolbarState,...state};toolbarWindow?.webContents.send('share:toolbar-state',lastToolbarState);return {ok:true};});
  ipcMain.handle('share:capture-stopped',()=>{lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:''};closeToolbar();return {ok:true};});
  ipcMain.handle('share:presenter-command',(_event,command)=>{
    const normalized=String(command||'');
    if(normalized==='show-meeting'){const main=getMainWindow?.();if(main&&!main.isDestroyed()){main.show();main.focus();}}
    sendMain('share:presenter-command',normalized);
    return {ok:true};
  });

  return Object.freeze({openPicker,closePicker,closeToolbar,sourceAuthority:authority});
}
