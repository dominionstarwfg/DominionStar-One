import { createShareSourceAuthority } from './share-source-authority.mjs';

export function createShareService({BrowserWindow,desktopCapturer,desktopSession,ipcMain,path,uiDir,preloadPath,getMainWindow,platform,screen,ensureScreenPermission,openPrivacySettings}){
  let pickerWindow=null;
  let captureWorkerWindow=null;
  let captureWorkerLoading=null;
  let captureWorkerStartPending=null;
  let activeCaptureDisplayId='';
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
  let captureStartWatchdog=null;
  let macPresenterParked=false;
  let macCaptureStartedAt=0;
  let macParkTimer=null;
  const MAC_PARK_DELAY_MS=2100;
  let qaPresenterCommandSeq=0;
  let lastToolbarState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true,companion:''};

  const macVersion=platform==='darwin'&&typeof process.getSystemVersion==='function'?String(process.getSystemVersion()||''):'';
  const macMajor=Number.parseInt(macVersion.split('.')[0]||'0',10)||0;
  const systemPickerAvailable=platform==='darwin'&&macMajor>=15;
  // DominionStar owns the preshare chooser. The macOS system picker must not
  // reopen after the user has already selected a DominionStar source.
  const nativeSystemPicker=false;
  const qaPresenterTrace=process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';
  const qaNoMacPark=qaPresenterTrace&&process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1';

  const authority=createShareSourceAuthority({
    timeoutMs:4500,
    enumerateSources:async options=>{
      const includeDominionStar=Boolean(options?.includeDominionStar);
      const kind=String(options?.kind||'screen')==='window'?'window':'screen';
      const sources=await desktopCapturer.getSources({types:[kind],thumbnailSize:{width:320,height:180},fetchWindowIcons:false});
      return sources.filter(source=>includeDominionStar||!/DominionStar Meet/i.test(String(source.name||'')));
    }
  });

  const serialize=source=>({id:String(source.id),name:String(source.name||'Untitled source'),kind:String(source.id||'').startsWith('screen:')?'screen':'window',displayId:String(source.display_id||''),thumbnail:source.thumbnail?.isEmpty?.()?'' : source.thumbnail?.toDataURL?.()||'',icon:source.appIcon?.isEmpty?.()?'' : source.appIcon?.toDataURL?.()||''});
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
    console.error(`QA_PRESENTER_${marker}${pairs.length?` ${pairs.join(' ')}`:''}`);
  };

  function positionNearMain(win,width,height){const main=getMainWindow?.();if(!main||main.isDestroyed())return;const bounds=savedMainWindowState?.bounds||main.getBounds();win.setBounds({x:Math.round(bounds.x+(bounds.width-width)/2),y:Math.max(24,bounds.y+18),width,height});}
  function protectMeetingChrome(win,enabled=true){
    if(!win||win.isDestroyed())return;
    // On macOS, content protection also blanks ordinary screenshots. Native
    // screen sharing now runs in an isolated capture worker, while presenter
    // mode parks the meeting renderer nearly transparent, so self-capture
    // avoidance no longer depends on screenshot blocking.
    const protect=platform==='darwin'?false:Boolean(enabled);
    try{win.setContentProtection(protect);}catch{}
  }
  const capturePreloadPath=path.join(path.dirname(preloadPath),'share-capture-preload.cjs');
  const captureWorkerAlive=()=>Boolean(captureWorkerWindow&&!captureWorkerWindow.isDestroyed());
  function captureWorkerSender(event){return Boolean(captureWorkerAlive()&&event?.sender===captureWorkerWindow.webContents);}
  function positionCaptureWorker(){
    if(!captureWorkerAlive()||platform!=='darwin')return;
    let display=null;
    try{display=screen?.getAllDisplays?.().find(item=>String(item.id)===String(activeCaptureDisplayId||''))||screen?.getPrimaryDisplay?.();}catch{}
    const area=display?.workArea||display?.bounds;
    if(!area)return;
    // Keep a normal compositor surface alive without presenting application UI.
    // The document itself is fully transparent and click-through.
    const width=Math.min(320,Math.max(180,Math.round(area.width*.18)));
    const height=Math.min(180,Math.max(120,Math.round(width*9/16)));
    try{captureWorkerWindow.setBounds({x:Math.round(area.x+area.width-width-4),y:Math.round(area.y+area.height-height-4),width,height},false);}catch{}
  }
  async function ensureCaptureWorker(){
    if(platform!=='darwin')return null;
    if(captureWorkerAlive())return captureWorkerWindow;
    if(captureWorkerLoading)return captureWorkerLoading;
    captureWorkerLoading=(async()=>{
      const win=new BrowserWindow({
        width:320,height:180,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
        resizable:false,movable:false,fullscreenable:false,minimizable:false,maximizable:false,closable:false,
        focusable:false,alwaysOnTop:false,skipTaskbar:true,hasShadow:false,
        webPreferences:{
          preload:capturePreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,
          devTools:false,backgroundThrottling:false,
          // A dedicated StoragePartition prevents Chromium from coalescing the
          // capture surface with the meeting SiteInstance/process.
          partition:'dominion-share-capture-v2044'
        }
      });
      // The worker captures the already selected DesktopCapturer source ID
      // directly. Do not register a second session-level display-media handler
      // here; physical Mac QA proved that worker-side handler registration can
      // starve the independent meeting/control renderer.
      captureWorkerWindow=win;
      protectMeetingChrome(win,true);
      try{win.setIgnoreMouseEvents(true,{forward:true});}catch{}
      try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
      win.on('closed',()=>{if(captureWorkerWindow===win)captureWorkerWindow=null;});
      await win.loadFile(path.join(uiDir,'share-capture-worker.html'));
      if(!captureWorkerAlive())throw new Error('share_capture_worker_closed_during_load');
      positionCaptureWorker();
      return win;
    })().catch(error=>{
      if(captureWorkerAlive()){try{captureWorkerWindow.destroy();}catch{}}
      captureWorkerWindow=null;
      throw error;
    }).finally(()=>{captureWorkerLoading=null;});
    return captureWorkerLoading;
  }
  function showCaptureWorker(){
    if(!captureWorkerAlive())return false;
    positionCaptureWorker();
    try{captureWorkerWindow.setOpacity?.(1);}catch{}
    try{captureWorkerWindow.showInactive?.();}catch{try{captureWorkerWindow.show();}catch{}}
    return true;
  }
  function hideCaptureWorker(){if(captureWorkerAlive())try{captureWorkerWindow.hide();}catch{}}
  function signalCaptureWorker(channel,payload={}){if(!captureWorkerAlive())return false;try{captureWorkerWindow.webContents.send(channel,payload);return true;}catch{return false;}}
  function settleCaptureWorkerStart(result={}){
    const pending=captureWorkerStartPending;if(!pending)return false;
    captureWorkerStartPending=null;clearTimeout(pending.timer);
    try{pending.reply({...pending.meta,...result,requestId:pending.requestId});}catch{}
    return true;
  }
  function rememberMainWindow(){
    const main=getMainWindow?.();if(!main||main.isDestroyed()||savedMainWindowState)return main||null;
    const maximized=main.isMaximized?.()||false,fullScreen=main.isFullScreen?.()||false;let bounds=main.getBounds();
    if((maximized||fullScreen)&&typeof main.getNormalBounds==='function'){try{const normal=main.getNormalBounds();if(normal?.width&&normal?.height)bounds=normal;}catch{}}
    let minimumSize=[960,640];try{minimumSize=main.getMinimumSize();}catch{}
    let opacity=1;try{opacity=Number(main.getOpacity?.()??1)||1;}catch{}
    savedMainWindowState={bounds:{...bounds},minimumSize,maximized,fullScreen,alwaysOnTop:main.isAlwaysOnTop?.()||false,opacity};return main;
  }
  function keepMeetingRendererLive(){const main=getMainWindow?.();return Boolean(main&&!main.isDestroyed());}
  const shareSurfaceUrlMarkers=['/ui/presenter-toolbar.html','/ui/mac-presenter-toolbar.html','/ui/mac-share-video.html','/ui/mac-annotation-toolbar.html','/ui/share-picker.html','/ui/share-capture-worker.html'];
  function destroyShareOnlyWindows(){
    let destroyed=0;
    for(const win of BrowserWindow.getAllWindows()){
      if(!win||win.isDestroyed?.())continue;
      const main=getMainWindow?.();if(main&&win===main)continue;
      const url=String(win.webContents?.getURL?.()||'');
      if(!shareSurfaceUrlMarkers.some(marker=>url.includes(marker)))continue;
      try{win.setClosable?.(true);}catch{}
      try{win.hide?.();}catch{}
      try{win.destroy?.();destroyed+=1;}catch{try{win.close?.();destroyed+=1;}catch{}}
    }
    return destroyed;
  }
  function closeLegacyMacPresenterWindows(){
    if(platform!=='darwin')return 0;
    let closed=0;
    for(const win of BrowserWindow.getAllWindows()){
      if(!win||win.isDestroyed?.())continue;
      const url=String(win.webContents?.getURL?.()||'');
      if(!url.includes('/ui/presenter-toolbar.html'))continue;
      try{win.setClosable?.(true);}catch{}
      try{win.hide?.();}catch{}
      try{win.close?.();closed+=1;}catch{}
    }
    if(toolbarWindow&&!toolbarWindow.isDestroyed?.()){
      try{toolbarWindow.setClosable?.(true);}catch{}
      try{toolbarWindow.hide?.();}catch{}
      try{toolbarWindow.close?.();closed+=1;}catch{}
      toolbarWindow=null;
    }
    return closed;
  }
  function syncMacTransparentPresenterShell(main,enabled){
    if(platform!=='darwin'||!main||main.isDestroyed())return false;
    try{main.setBackgroundColor?.(enabled?'#00000000':'#07111f');}catch{}
    try{
      const script=enabled
        ? `(()=>{document.documentElement.style.setProperty('background','transparent','important');document.documentElement.style.setProperty('background-color','transparent','important');document.body.style.setProperty('background','transparent','important');document.body.style.setProperty('background-color','transparent','important');document.body.style.setProperty('background-image','none','important');document.body.classList.add('ds-native-mac-presenter-share');document.body.classList.remove('ds-native-mac-show-meeting');const appShell=document.querySelector('#appShell');if(appShell){appShell.style.setProperty('visibility','hidden','important');appShell.style.setProperty('opacity','0','important');appShell.style.setProperty('pointer-events','none','important');}const shell=document.querySelector('#meetingOverlay>.meeting-shell');if(shell){shell.style.setProperty('visibility','hidden','important');shell.style.setProperty('pointer-events','none','important');}return true;})()`
        : `(()=>{document.documentElement.style.removeProperty('background');document.documentElement.style.removeProperty('background-color');document.body.style.removeProperty('background');document.body.style.removeProperty('background-color');document.body.style.removeProperty('background-image');document.body.classList.remove('ds-native-mac-presenter-share','ds-native-mac-show-meeting');const appShell=document.querySelector('#appShell');if(appShell){appShell.style.removeProperty('visibility');appShell.style.removeProperty('opacity');appShell.style.removeProperty('pointer-events');}const shell=document.querySelector('#meetingOverlay>.meeting-shell');if(shell){shell.style.removeProperty('visibility');shell.style.removeProperty('pointer-events');}return true;})()`;
      void main.webContents?.executeJavaScript?.(script,true).catch?.(()=>{});
    }catch{}
    return true;
  }
  function setMacPresenterStealth(main,enabled){
    if(platform!=='darwin'||!main||main.isDestroyed())return false;
    closeLegacyMacPresenterWindows();
    syncMacTransparentPresenterShell(main,Boolean(enabled));
    try{main.setWindowButtonVisibility?.(!enabled);}catch{}
    try{main.setHasShadow?.(!enabled);}catch{}
    return true;
  }
  function cancelMacParkTimer(){if(macParkTimer){clearTimeout(macParkTimer);macParkTimer=null;}}
  function scheduleMacPark(){
    if(platform!=='darwin'||!shareActive)return false;
    // Capture now belongs to the isolated worker. Do not perform any delayed
    // post-share mutation on the meeting/control renderer. Physical Mac proved
    // the old 2.1s parking transition was exactly where presenter IPC stopped.
    cancelMacParkTimer();
    const main=getMainWindow?.();keepMeetingRendererLive();setMacPresenterStealth(main,true);
    try{main?.setOpacity?.(0.001);}catch{}
    return true;
  }
  function parkMacMeetingWindow({preCapture=false}={}){
    if(platform!=='darwin')return false;
    const main=rememberMainWindow();if(!main||main.isDestroyed())return false;
    keepMeetingRendererLive();
    // Preserve the capture-owning renderer as a normal, fully composited,
    // visible BrowserWindow. Physical Mac and the packaged liveness gate both
    // proved that moving the renderer off-display can cause macOS/Chromium to
    // stop servicing its event loop even though the capture track stays live.
    //
    // Keep a tiny ON-DISPLAY sentinel instead. The isolated capture worker
    // owns screen capture, while the nearly transparent meeting renderer stays
    // composited and responsive without using macOS screenshot blocking.
    if(preCapture||!macPresenterParked)protectMeetingChrome(main,true);
    try{if(main.isMinimized?.())main.restore();}catch{}
    try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}
    try{if(main.isMaximized?.())main.unmaximize();}catch{}
    try{main.setOpacity?.(0.001);}catch{}
    setMacPresenterStealth(main,true);
    try{main.setIgnoreMouseEvents(true);}catch{}
    try{main.setAlwaysOnTop(false);}catch{}
    try{main.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    if(preCapture){
      // Capture startup stays in the user's normal meeting geometry until
      // getDisplayMedia has established the track.
      try{main.showInactive?.();}catch{try{main.show();}catch{}}
      return true;
    }
    if(!shareActive)return false;
    // Do not resize, move, minimize, hide or fade the meeting engine after
    // sharing begins. Physical Mac proved that geometry mutation causes
    // Chromium to demote this renderer even when background throttling is off.
    // Capture is isolated in its own renderer, so presenter mode only changes
    // focus/input/visibility authority and remains capturable in macOS screenshots.
    try{main.blur?.();}catch{}
    try{main.showInactive?.();}catch{try{main.show();}catch{}}
    macPresenterParked=true;
    lastToolbarState={...lastToolbarState,meetingVisible:false,companion:''};publishToolbarState();
    return true;
  }
  function hideMeetingWindowForShare(){
    if(!shareActive)return false;
    // Do not mutate the main BrowserWindow at presenter commit. macOS physical
    // presenter mutation happens before capture in parkMacMeetingWindow().
    if(platform==='darwin')return scheduleMacPark();
    const main=rememberMainWindow();if(!main||main.isDestroyed())return false;
    const qaSyntheticShare=qaPresenterTrace&&String(lastToolbarState.sourceName||'')==='QA Synthetic Share';
    if(!qaSyntheticShare)protectMeetingChrome(main,true);
    keepMeetingRendererLive();
    lastToolbarState={...lastToolbarState,meetingVisible:true,companion:''};publishToolbarState();return true;
  }
  function showMeetingWindow({focus=true}={}){
    const main=getMainWindow?.();if(!main||main.isDestroyed())return false;const saved=savedMainWindowState;keepMeetingRendererLive();if(platform==='darwin')cancelMacParkTimer();
    setMacPresenterStealth(main,false);try{main.setIgnoreMouseEvents(false);}catch{}try{main.setOpacity?.(saved?.opacity??1);}catch{}try{if(main.isMinimized?.())main.restore();}catch{}try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}try{if(main.isMaximized?.())main.unmaximize();}catch{}
    if(saved){try{main.setMinimumSize(...saved.minimumSize);}catch{}try{main.setBounds(saved.bounds,true);}catch{}}
    try{main.setAlwaysOnTop(shareActive,'floating');}catch{try{main.setAlwaysOnTop(Boolean(shareActive));}catch{}}
    if(platform==='darwin'){try{main.setVisibleOnAllWorkspaces(Boolean(shareActive),{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}}
    protectMeetingChrome(main,Boolean(shareActive));
    main.show();if(focus)main.focus();lastToolbarState={...lastToolbarState,meetingVisible:true,companion:''};publishToolbarState();return true;
  }
  function showCompanionWindow(kind='chat'){
    if(!shareActive)return false;
    const main=rememberMainWindow();if(!main||main.isDestroyed())return false;
    const normalized=String(kind||'chat');
    // Annotation belongs to the presenter/share surface. Resizing the entire
    // meeting BrowserWindow for Annotate compresses Chat, Participants and
    // meeting chrome into one crowded window. Keep the renderer geometry
    // untouched and let the annotation layer own its own interaction.
    if(platform==='darwin'&&normalized==='annotate'){
      keepMeetingRendererLive();
      // The native window stays transparent except for the annotation canvas.
      // Renderer CSS hides meeting chrome while this opacity restores visible ink.
      try{main.setOpacity?.(savedMainWindowState?.opacity??1);}catch{}
      try{main.setIgnoreMouseEvents(false);}catch{}
      try{main.showInactive?.();}catch{try{main.show();}catch{}}
      lastToolbarState={...lastToolbarState,meetingVisible:false,companion:'annotate'};publishToolbarState();
      return true;
    }
    const base=savedMainWindowState?.bounds||main.getBounds();
    const width=Math.min(390,Math.max(340,base.width-40));
    const height=Math.min(590,Math.max(460,base.height-120));
    let x=Math.round(base.x+base.width-width-18),y=Math.round(base.y+76);
    if(platform==='darwin'){
      try{
        const display=screen.getDisplayMatching(base),area=display.workArea||display.bounds;
        const video=BrowserWindow.getAllWindows().find(win=>!win.isDestroyed?.()&&String(win.webContents?.getURL?.()||'').includes('/ui/mac-share-video.html')&&win.isVisible?.());
        const toolbar=BrowserWindow.getAllWindows().find(win=>!win.isDestroyed?.()&&String(win.webContents?.getURL?.()||'').includes('/ui/mac-presenter-toolbar.html')&&win.isVisible?.());
        const vb=video?.getBounds?.()||null,tb=toolbar?.getBounds?.()||null;
        const gap=12;
        const preferredRight=vb?Math.round(vb.x-width-gap):Math.round(area.x+area.width-width-18);
        x=Math.max(area.x+10,Math.min(preferredRight,area.x+area.width-width-10));
        y=Math.max(area.y+10,tb?tb.y+tb.height+gap:area.y+82);
        if(y+height>area.y+area.height-10)y=Math.max(area.y+10,area.y+area.height-height-10);
      }catch{}
    }
    setMacPresenterStealth(main,false);try{main.setIgnoreMouseEvents(false);}catch{}try{main.setOpacity?.(savedMainWindowState?.opacity??1);}catch{}try{if(main.isMinimized?.())main.restore();}catch{}try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}try{if(main.isMaximized?.())main.unmaximize();}catch{}
    try{main.setMinimumSize(330,420);}catch{}try{main.setBounds({x,y,width,height},false);}catch{}keepMeetingRendererLive();
    try{main.setAlwaysOnTop(true,'floating');}catch{try{main.setAlwaysOnTop(true);}catch{}}protectMeetingChrome(main,true);main.show();main.focus();
    lastToolbarState={...lastToolbarState,meetingVisible:true,companion:normalized};publishToolbarState();return true;
  }
  function restoreMainWindowAfterShare(){
    cancelMacParkTimer();macCaptureStartedAt=0;const main=getMainWindow?.(),saved=savedMainWindowState;if(!main||main.isDestroyed()){savedMainWindowState=null;macPresenterParked=false;return;}
    try{main.setIgnoreMouseEvents(false);}catch{}try{if(main.isMinimized?.())main.restore();}catch{}try{if(main.isFullScreen?.())main.setFullScreen(false);}catch{}try{if(main.isMaximized?.())main.unmaximize();}catch{}
    if(saved){try{main.setOpacity?.(saved.opacity??1);}catch{}try{main.setMinimumSize(...saved.minimumSize);}catch{}try{main.setBounds(saved.bounds,true);}catch{}try{main.setAlwaysOnTop(Boolean(saved.alwaysOnTop));}catch{}try{if(saved.maximized)main.maximize();else if(saved.fullScreen)main.setFullScreen(true);}catch{}}
    else{try{main.setOpacity?.(1);}catch{}try{main.setMinimumSize(960,640);}catch{}try{main.setAlwaysOnTop(false);}catch{}}
    if(platform==='darwin'){try{main.setVisibleOnAllWorkspaces(false);}catch{}}setMacPresenterStealth(main,false);protectMeetingChrome(main,false);main.show();savedMainWindowState=null;macPresenterParked=false;
  }
  function attachShareWindowLifecycle(){const main=getMainWindow?.();if(!main||main.isDestroyed()||mainMinimizeHandler)return;mainMinimizeHandler=event=>{if(!shareActive)return;event?.preventDefault?.();hideMeetingWindowForShare();};main.on('minimize',mainMinimizeHandler);}
  function detachShareWindowLifecycle(){const main=getMainWindow?.();if(main&&!main.isDestroyed()&&mainMinimizeHandler)main.removeListener('minimize',mainMinimizeHandler);mainMinimizeHandler=null;}

  function recoverMainWindow({focus=true}={}){
    const main=getMainWindow?.();if(!main||main.isDestroyed())return false;
    if(shareActive)return showMeetingWindow({focus:Boolean(focus)});
    restoreMainWindowAfterShare();
    try{if(main.isMinimized?.())main.restore();}catch{}
    try{main.show();}catch{}
    if(focus)try{main.focus();}catch{}
    return true;
  }
  function shutdown(){
    if(captureStartWatchdog){clearTimeout(captureStartWatchdog);captureStartWatchdog=null;}
    if(stopRetryTimer){clearTimeout(stopRetryTimer);stopRetryTimer=null;}
    cancelToolbarOpen();detachShareWindowLifecycle();
    shareActive=false;toolbarReadyForShare=false;presenterCommitPending=false;pendingSelection=null;activeCaptureDisplayId='';
    try{signalCaptureWorker('share-capture:stop',{});}catch{}
    if(captureWorkerAlive()){try{captureWorkerWindow.destroy();}catch{}captureWorkerWindow=null;}
    try{closePicker();}catch{}
    try{closeToolbar();}catch{}
    try{closeLegacyMacPresenterWindows();}catch{}
    try{globalThis.__dominionMacSharePresenterOverlay?.destroy?.();}catch{try{globalThis.__dominionMacSharePresenterOverlay?.reset?.();}catch{try{globalThis.__dominionMacSharePresenterOverlay?.hideOverlays?.();}catch{}}}
    try{destroyShareOnlyWindows();}catch{}
    const main=getMainWindow?.();
    if(main&&!main.isDestroyed()){
      try{main.setIgnoreMouseEvents(false);}catch{}
      try{main.setAlwaysOnTop(false);}catch{}
      try{protectMeetingChrome(main,false);}catch{}
      try{setMacPresenterStealth(main,false);}catch{}
    }
    savedMainWindowState=null;macPresenterParked=false;
    return true;
  }

  function openPicker(){
    if(pickerWindow&&!pickerWindow.isDestroyed()){pickerWindow.show();pickerWindow.focus();return {opened:true,reused:true,nativeSystemPicker:false};}
    pickerWindow=new BrowserWindow({width:900,height:620,minWidth:760,minHeight:520,show:false,backgroundColor:'#16181b',title:'Share Screen',resizable:true,fullscreenable:false,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
    positionNearMain(pickerWindow,900,620);pickerWindow.removeMenu?.();protectMeetingChrome(pickerWindow,true);pickerWindow.once('ready-to-show',()=>{pickerWindow?.show();pickerWindow?.focus();});void pickerWindow.loadFile(path.join(uiDir,'share-picker.html'));pickerWindow.on('closed',()=>{pickerWindow=null;});
    return {opened:true,reused:false,nativeSystemPicker:false};
  }
  function closePicker(){if(pickerWindow&&!pickerWindow.isDestroyed()){try{pickerWindow.hide();}catch{}try{pickerWindow.close();}catch{}}pickerWindow=null;}

  async function openToolbar(){
    // macOS has one presenter authority: mac-share-presenter-overlay.mjs.
    // Never create the legacy presenter-toolbar BrowserWindow on Mac; two
    // independent toolbar windows produce the duplicated share chrome seen on
    // the physical machine.
    if(platform==='darwin'){closeLegacyMacPresenterWindows();closeToolbar();return true;}
    if(toolbarWindow&&!toolbarWindow.isDestroyed()){toolbarWindow.showInactive?.();toolbarWindow.moveTop?.();publishToolbarState();return true;}
    const created=new BrowserWindow({width:900,height:72,minWidth:720,minHeight:72,maxHeight:292,show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,focusable:false,acceptFirstMouse:true,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false}});
    toolbarWindow=created;positionNearMain(created,900,72);try{created.setAlwaysOnTop(true,'floating');}catch{}
    if(platform==='darwin'){try{created.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}}
    protectMeetingChrome(created,true);created.on('closed',()=>{if(toolbarWindow===created)toolbarWindow=null;});
    try{await created.loadFile(path.join(uiDir,'presenter-toolbar.html'));if(created.isDestroyed()||toolbarWindow!==created)return false;created.showInactive?.();created.moveTop?.();publishToolbarState();return true;}
    catch(error){try{created.setClosable?.(true);created.close();}catch{}if(toolbarWindow===created)toolbarWindow=null;console.error('[DominionStar Meet] Presenter toolbar failed to load.',error);return false;}
  }
  function closeToolbar(){if(toolbarWindow&&!toolbarWindow.isDestroyed()){try{toolbarWindow.setClosable?.(true);}catch{}toolbarWindow.close();}toolbarWindow=null;}
  const sendMain=(channel,payload)=>{const main=getMainWindow?.();if(main&&!main.isDestroyed()){main.webContents.send(channel,payload);return true;}return false;};
  const sendPresenterCommand=async(command,toolbarSenderId=0)=>{
    const normalized=String(command?.command||command||'');
    const qaCommandId=qaPresenterTrace?++qaPresenterCommandSeq:0;
    const outbound=qaCommandId?{command:normalized,qaCommandId}:normalized;
    const main=getMainWindow?.(),webContents=main?.webContents,meta=presenterRendererMeta();
    qaPresenterLog('MAIN_ACCEPT',{id:qaCommandId,command:normalized,toolbar:toolbarSenderId,target:meta.webContentsId,pid:meta.osPid,destroyed:meta.webContentsDestroyed?1:0,crashed:meta.crashed?1:0,visible:meta.visible?1:0,url:encodeURIComponent(meta.url)});
    if(main&&!main.isDestroyed()&&webContents&&!webContents.isDestroyed()){
      try{
        keepMeetingRendererLive();
        const payload=JSON.stringify(outbound).replace(/</g,'\\u003c');
        const directPromise=webContents.executeJavaScript(`(async()=>{const fn=window.__DominionPresenterDispatch;if(typeof fn!=='function')return {handled:false,reason:'dispatcher-missing'};return await fn(${payload});})()`,true);
        const direct=await Promise.race([directPromise,new Promise(resolve=>setTimeout(()=>resolve({handled:false,reason:'direct-timeout'}),700))]);
        const handled=Boolean(direct?.handled);
        qaPresenterLog('DIRECT',{id:qaCommandId,command:normalized,handled:handled?1:0,reason:String(direct?.reason||direct?.error||'')});
        if(handled)return {sent:true,qaCommandId,direct:true};
      }catch(error){qaPresenterLog('DIRECT_ERROR',{id:qaCommandId,command:normalized,error:String(error?.message||error||'execute_failed')});}
    }
    const sent=sendMain('share:presenter-command',outbound);
    qaPresenterLog('MAIN_SENT',{id:qaCommandId,command:normalized,sent:sent?1:0,target:meta.webContentsId,pid:meta.osPid});
    return {sent,qaCommandId,direct:false};
  };

  function cancelToolbarOpen(){if(toolbarOpenTimer){clearTimeout(toolbarOpenTimer);toolbarOpenTimer=null;}}
  function scheduleToolbarForShare(){
    cancelToolbarOpen();
    if(platform==='darwin'){toolbarReadyForShare=true;presenterCommitPending=false;return;}
    toolbarOpenTimer=setTimeout(async()=>{
      toolbarOpenTimer=null;if(!shareActive)return;
      const ready=await openToolbar();if(!shareActive)return;
      toolbarReadyForShare=Boolean(ready);publishToolbarState();
      if(!ready){presenterCommitPending=false;showMeetingWindow({focus:false});void sendPresenterCommand('stop',0);return;}
      if(presenterCommitPending){presenterCommitPending=false;hideMeetingWindowForShare();}
    },75);
  }

  const displayMediaHandler=(_request,callback)=>{const selection=pendingSelection;pendingSelection=null;if(!selection?.source){callback({});return;}const response={video:selection.source};if(selection.options?.shareAudio&&(platform==='win32'||platform==='darwin'))response.audio='loopback';callback(response);};
  function configureDisplayMediaHandler(useSystemPicker){const mode=useSystemPicker?'native':'dominionstar';if(displayPickerMode===mode)return;desktopSession.setDisplayMediaRequestHandler(displayMediaHandler,{useSystemPicker:Boolean(useSystemPicker)});displayPickerMode=mode;}
  configureDisplayMediaHandler(false);

  ipcMain.handle('share:open-picker',async(_event,{permission='unknown'}={})=>{
    const status=String(permission||'unknown').toLowerCase();configureDisplayMediaHandler(false);
    if(platform==='darwin')void ensureCaptureWorker().catch(error=>console.error('[DominionStar Meet] Capture worker prewarm failed.',error));
    if(platform==='darwin'&&typeof ensureScreenPermission==='function'){
      const permissionResult=await ensureScreenPermission();
      if(!permissionResult?.ok)return {opened:false,nativeSystemPicker:false,systemPickerAvailable,permissionRequired:true,status:String(permissionResult?.status||status||'unknown'),restartRequired:Boolean(permissionResult?.restartRequired),passive:true};
    }
    return openPicker();
  });
  ipcMain.handle('share:probe-access',async()=>{try{configureDisplayMediaHandler(false);const result=await authority.list({kind:'screen'});if(result.timedOut)return {ok:false,status:'timeout'};const readable=result.sources.some(source=>!source.thumbnail?.isEmpty?.());return {ok:readable,status:readable?'granted':'unavailable',sourceCount:result.sources.length};}catch(error){return {ok:false,status:'error',error:String(error?.message||error)};}});
  ipcMain.handle('share:list-sources',async(_event,options={})=>{configureDisplayMediaHandler(false);pendingSelection=null;try{const result=await authority.list(options);if(result.timedOut)return {ok:false,timedOut:true,sources:[]};return {ok:true,timedOut:false,sources:result.sources.map(serialize)};}catch(error){return {ok:false,timedOut:false,sources:[],error:String(error?.message||error)};}});
  ipcMain.handle('share:select-source',(_event,{sourceId,options={}}={})=>{configureDisplayMediaHandler(false);
    const source=authority.get(sourceId);if(!source)return {ok:false,error:'share_source_not_available'};
    const normalizedOptions={optimizeVideo:Boolean(options.optimizeVideo),shareAudio:Boolean(options.shareAudio),displayId:String(source.display_id||'')};pendingSelection={source,options:normalizedOptions};activeCaptureDisplayId=normalizedOptions.displayId;
    closePicker();
    if(platform==='darwin')parkMacMeetingWindow({preCapture:true});
    if(captureStartWatchdog)clearTimeout(captureStartWatchdog);
    captureStartWatchdog=setTimeout(()=>{captureStartWatchdog=null;if(platform==='darwin'&&!shareActive){pendingSelection=null;restoreMainWindowAfterShare();}},6500);
    queueMicrotask(()=>sendMain('share:source-selected',{sourceId:String(source.id),name:String(source.name||'Shared content'),options:normalizedOptions}));return {ok:true,nativeSystemPicker:false};
  });
  ipcMain.handle('share:cancel-picker',()=>{pendingSelection=null;closePicker();return {ok:true};});


  // macOS capture runs in a dedicated renderer. The meeting renderer receives
  // the screen track over an in-process WebRTC bridge, so presenter controls,
  // chat, participants, mic and camera never share the ScreenCaptureKit owner.
  ipcMain.handle('share-capture:qa-prepare',async(event)=>{
    const main=getMainWindow?.();
    if(!qaPresenterTrace||platform!=='darwin'||!main||main.isDestroyed()||event.sender!==main.webContents)return {ok:false,error:'qa_capture_prepare_unavailable'};
    try{
      const worker=await ensureCaptureWorker();
      if(!worker||worker.isDestroyed())return {ok:false,error:'capture_worker_unavailable'};
      const shown=showCaptureWorker();
      const mainPid=Number(main.webContents?.getOSProcessId?.()||0),workerPid=Number(worker.webContents?.getOSProcessId?.()||0);
      qaPresenterLog('CAPTURE_QA_PREPARE',{shown:shown?1:0,mainPid,workerPid});
      return {ok:true,shown:Boolean(shown),mainPid,workerPid};
    }catch(error){return {ok:false,error:String(error?.message||error||'qa_capture_prepare_failed')};}
  });
  ipcMain.handle('share-capture:qa-message-only',async(event)=>{
    const main=getMainWindow?.();
    if(!qaPresenterTrace||platform!=='darwin'||!main||main.isDestroyed()||event.sender!==main.webContents)return {ok:false,error:'qa_capture_message_unavailable'};
    try{
      const worker=await ensureCaptureWorker();
      if(!worker||worker.isDestroyed())return {ok:false,error:'capture_worker_unavailable'};
      const shown=showCaptureWorker();
      worker.webContents.send('share-capture:start',{qaMessageOnly:true});
      const mainPid=Number(main.webContents?.getOSProcessId?.()||0),workerPid=Number(worker.webContents?.getOSProcessId?.()||0);
      qaPresenterLog('CAPTURE_QA_MESSAGE_ONLY',{shown:shown?1:0,mainPid,workerPid});
      return {ok:true,shown:Boolean(shown),mainPid,workerPid};
    }catch(error){return {ok:false,error:String(error?.message||error||'qa_capture_message_failed')};}
  });
  ipcMain.handle('share-capture:qa-detached-lifecycle',async(event)=>{
    const main=getMainWindow?.();
    if(!qaPresenterTrace||platform!=='darwin'||!main||main.isDestroyed()||event.sender!==main.webContents)return {ok:false,error:'qa_capture_detached_unavailable'};
    try{
      const worker=await ensureCaptureWorker();
      if(!worker||worker.isDestroyed())return {ok:false,error:'capture_worker_unavailable'};
      const shown=showCaptureWorker();
      worker.webContents.send('share-capture:start',{qaLifecycleOnly:true});
      const mainPid=Number(main.webContents?.getOSProcessId?.()||0),workerPid=Number(worker.webContents?.getOSProcessId?.()||0);
      qaPresenterLog('CAPTURE_QA_DETACHED_LIFECYCLE',{shown:shown?1:0,mainPid,workerPid});
      return {ok:true,shown:Boolean(shown),mainPid,workerPid};
    }catch(error){return {ok:false,error:String(error?.message||error||'qa_capture_detached_failed')};}
  });
  ipcMain.on('share-capture:start-request',async(event,message={})=>{
    const requestId=Number(message?.requestId||0)||0;
    const payload=message?.payload||{};
    const reply=result=>{try{event.reply('share-capture:start-result',{requestId,...result});}catch{}};
    const main=getMainWindow?.();
    if(!requestId||platform!=='darwin'||!main||main.isDestroyed()||event.sender!==main.webContents){reply({ok:false,error:'capture_client_unavailable'});return;}
    try{
      const worker=await ensureCaptureWorker();
      if(!worker||worker.isDestroyed()){reply({ok:false,error:'capture_worker_unavailable'});return;}
      const mainPid=Number(main.webContents?.getOSProcessId?.()||0);
      const workerPid=Number(worker.webContents?.getOSProcessId?.()||0);
      const meta={isolated:Boolean(mainPid&&workerPid&&mainPid!==workerPid),mainPid,workerPid};
      qaPresenterLog('CAPTURE_PROCESS_BOUNDARY',{mainPid,workerPid,isolated:meta.isolated?1:0});
      if(mainPid&&workerPid&&mainPid===workerPid){reply({ok:false,error:'capture_worker_process_not_isolated',...meta});return;}
      // Keep the capture renderer compositor-visible for every active share,
      // including lifecycle-only QA. The start acknowledgement is delivered
      // asynchronously so the meeting renderer never sits inside a nested
      // renderer -> main -> worker -> main -> renderer invoke transaction.
      const workerShown=showCaptureWorker();
      if(qaPresenterTrace)qaPresenterLog('CAPTURE_WORKER_VISIBILITY',{shown:workerShown?1:0,reason:payload?.qaLifecycleOnly?'qa-lifecycle-composited':'capture-active'});
      if(captureWorkerStartPending){reply({ok:false,error:'capture_worker_start_pending',...meta});return;}
      const timer=setTimeout(()=>{settleCaptureWorkerStart({ok:false,error:'capture_worker_start_timeout'});},6000);
      captureWorkerStartPending={requestId,reply,timer,meta};
      const workerPayload={...payload,sourceId:String(pendingSelection?.source?.id||payload?.sourceId||'')};
      try{worker.webContents.send('share-capture:start',workerPayload);}
      catch(error){settleCaptureWorkerStart({ok:false,error:String(error?.message||error||'capture_worker_send_failed')});}
    }catch(error){
      const failure={ok:false,error:String(error?.message||error||'capture_worker_start_failed')};
      if(!settleCaptureWorkerStart(failure))reply(failure);
    }
  });
  ipcMain.handle('share-capture:set-paused',async(event,payload={})=>{
    const main=getMainWindow?.();
    if(!main||main.isDestroyed()||event.sender!==main.webContents)return {ok:false,error:'capture_client_unavailable'};
    if(!captureWorkerAlive())return {ok:false,error:'capture_worker_unavailable'};
    const paused=Boolean(payload?.paused);
    try{
      const result=await captureWorkerWindow.webContents.executeJavaScript(`window.DominionShareCaptureWorker?.setPaused(${paused?'true':'false'})`,true);
      if(result&&typeof result==='object')return result;
      return {ok:false,error:'capture_worker_pause_unavailable',paused};
    }catch(error){
      return {ok:false,error:String(error?.message||error||'capture_worker_pause_failed'),paused};
    }
  });
  ipcMain.handle('share-capture:stop',(event)=>{
    const main=getMainWindow?.();
    if(!main||main.isDestroyed()||event.sender!==main.webContents)return {ok:false};
    signalCaptureWorker('share-capture:stop',{});
    return {ok:true};
  });
  ipcMain.handle('share-capture:answer',(event,payload={})=>{
    const main=getMainWindow?.();
    if(!main||main.isDestroyed()||event.sender!==main.webContents)return {ok:false};
    return {ok:signalCaptureWorker('share-capture:answer',payload||{})};
  });
  ipcMain.handle('share-capture:client-ice',(event,payload={})=>{
    const main=getMainWindow?.();
    if(!main||main.isDestroyed()||event.sender!==main.webContents)return {ok:false};
    return {ok:signalCaptureWorker('share-capture:client-ice',payload||{})};
  });
  ipcMain.on('share-capture:offer',(event,payload={})=>{if(captureWorkerSender(event))sendMain('share-capture:offer',payload||{});});
  ipcMain.on('share-capture:worker-ice',(event,payload={})=>{if(captureWorkerSender(event))sendMain('share-capture:worker-ice',payload||{});});
  ipcMain.on('share-capture:started',(event,payload={})=>{if(!captureWorkerSender(event))return;settleCaptureWorkerStart({ok:true,...payload});});
  ipcMain.on('share-capture:stopped',(event,payload={})=>{
    if(!captureWorkerSender(event))return;
    if(!settleCaptureWorkerStart({ok:false,error:'capture_worker_stopped_before_ready',...payload}))sendMain('share-capture:stopped',payload||{});
    hideCaptureWorker();
  });
  ipcMain.on('share-capture:error',(event,payload={})=>{
    if(!captureWorkerSender(event))return;
    const failure={ok:false,error:String(payload?.error||'capture_worker_failed'),...payload};
    if(!settleCaptureWorkerStart(failure))sendMain('share-capture:error',payload||{});
    hideCaptureWorker();
  });

  ipcMain.on('share:capture-started',(event,state={})=>{
    const main=getMainWindow?.();if(!main||main.isDestroyed()||event.sender!==main.webContents)return;
    if(captureStartWatchdog){clearTimeout(captureStartWatchdog);captureStartWatchdog=null;}
    shareActive=true;toolbarReadyForShare=platform==='darwin';presenterCommitPending=false;
    if(platform==='darwin')closeToolbar();
    if(platform!=='darwin'){rememberMainWindow();keepMeetingRendererLive();attachShareWindowLifecycle();}
    else{rememberMainWindow();keepMeetingRendererLive();macCaptureStartedAt=Date.now();scheduleMacPark();}
    lastToolbarState={...lastToolbarState,...state,meetingVisible:platform==='darwin'?!macPresenterParked:true,companion:''};
    const meta=presenterRendererMeta();qaPresenterLog('CAPTURE_STARTED',{sender:Number(event.sender?.id||0),target:meta.webContentsId,pid:meta.osPid,url:encodeURIComponent(meta.url)});
    if(qaPresenterTrace&&platform==='darwin'){
      setTimeout(()=>{
        const target=getMainWindow?.()?.webContents;
        if(!target||target.isDestroyed?.()){qaPresenterLog('ACTIVE_JS_PROBE',{ok:0,error:'renderer-unavailable'});return;}
        const probe=target.executeJavaScript("(()=>({ready:document.readyState,dispatcher:typeof window.__DominionPresenterDispatch==='function',stamp:Date.now()}))()",true);
        void Promise.race([probe,new Promise(resolve=>setTimeout(()=>resolve({__timeout:true}),900))])
          .then(result=>qaPresenterLog('ACTIVE_JS_PROBE',{ok:result?.__timeout?0:1,timeout:result?.__timeout?1:0,ready:result?.ready||'',dispatcher:result?.dispatcher?1:0}))
          .catch(error=>qaPresenterLog('ACTIVE_JS_PROBE',{ok:0,error:String(error?.message||error||'execute-failed')}));
      },900);
    }
  });
  ipcMain.handle('share:capture-state',(_event,state={})=>{const priorCompanion=String(lastToolbarState.companion||'');lastToolbarState={...lastToolbarState,...state};if(shareActive&&priorCompanion&&state.companionOpen===false)hideMeetingWindowForShare();else publishToolbarState();return {ok:true};});
  ipcMain.on('share:presenter-committed',(event,state={})=>{
    if(!shareActive)return;const main=getMainWindow?.();if(!main||main.isDestroyed()||event.sender!==main.webContents)return;lastToolbarState={...lastToolbarState,...state};
    const meta=presenterRendererMeta();qaPresenterLog('COMMITTED',{sender:Number(event.sender?.id||0),target:meta.webContentsId,pid:meta.osPid,url:encodeURIComponent(meta.url)});
    presenterCommitPending=true;if(!toolbarReadyForShare){scheduleToolbarForShare();return;}presenterCommitPending=false;setImmediate(()=>{if(shareActive&&toolbarReadyForShare)hideMeetingWindowForShare();});
  });
  ipcMain.on('share:presenter-listener-ready',(event,payload={})=>{const main=getMainWindow?.(),meta=presenterRendererMeta(),accepted=Boolean(main&&!main.isDestroyed()&&event.sender===main.webContents);qaPresenterLog('LISTENER_READY',{accepted:accepted?1:0,sender:Number(event.sender?.id||0),target:meta.webContentsId,pid:meta.osPid,href:encodeURIComponent(String(payload?.href||''))});});
  ipcMain.on('share:qa-renderer-pulse',(event,payload={})=>{if(!qaPresenterTrace)return;const main=getMainWindow?.(),accepted=Boolean(main&&!main.isDestroyed()&&event.sender===main.webContents);qaPresenterLog('RENDERER_PULSE',{accepted:accepted?1:0,index:Number(payload?.index||0),delay:Number(payload?.delay||0),generation:Number(payload?.generation||0)});});
  ipcMain.on('share:presenter-preload-tap',(event,payload={})=>{const main=getMainWindow?.(),meta=presenterRendererMeta(),accepted=Boolean(main&&!main.isDestroyed()&&event.sender===main.webContents);qaPresenterLog('PRELOAD_TAP',{id:Number(payload?.qaCommandId||0)||0,command:String(payload?.command||''),accepted:accepted?1:0,sender:Number(event.sender?.id||0),target:meta.webContentsId,pid:meta.osPid});});
  ipcMain.on('share:presenter-preload-ack',(event,payload={})=>{const main=getMainWindow?.();const meta=presenterRendererMeta();const accepted=Boolean(main&&!main.isDestroyed()&&event.sender===main.webContents);qaPresenterLog('PRELOAD_ACK',{id:Number(payload?.qaCommandId||0)||0,command:String(payload?.command||''),accepted:accepted?1:0,sender:Number(event.sender?.id||0),target:meta.webContentsId,pid:meta.osPid});});
  ipcMain.handle('share:capture-stopped',()=>{
    if(captureStartWatchdog){clearTimeout(captureStartWatchdog);captureStartWatchdog=null;}
    shareActive=false;toolbarReadyForShare=false;presenterCommitPending=false;pendingSelection=null;activeCaptureDisplayId='';signalCaptureWorker('share-capture:stop',{});if(captureWorkerAlive()){try{captureWorkerWindow.destroy();}catch{}captureWorkerWindow=null;}cancelToolbarOpen();if(stopRetryTimer){clearTimeout(stopRetryTimer);stopRetryTimer=null;}detachShareWindowLifecycle();
    try{globalThis.__dominionMacSharePresenterOverlay?.destroy?.();}catch{}
    try{destroyShareOnlyWindows();}catch{}
    restoreMainWindowAfterShare();
    lastToolbarState={paused:false,micOn:false,cameraOn:false,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true,companion:''};closeToolbar();return {ok:true};
  });
  ipcMain.handle('share:presenter-menu-state',(_event,{open=false}={})=>{if(!toolbarWindow||toolbarWindow.isDestroyed())return {ok:false};const bounds=toolbarWindow.getBounds();const nextHeight=open?286:72;if(bounds.height!==nextHeight){try{toolbarWindow.setBounds({...bounds,height:nextHeight},false);}catch{}}return {ok:true,height:nextHeight};});
  ipcMain.handle('share:presenter-command',async(_event,command)=>{
    const normalized=String(command?.command||command||'');let sent=false,delivery=null;const toolbarSenderId=Number(_event?.sender?.id||0)||0;
    if(normalized==='show-meeting'&&shareActive){if(lastToolbarState.meetingVisible)hideMeetingWindowForShare();else showMeetingWindow({focus:true});}
    else if(['participants','chat','annotate'].includes(normalized)&&shareActive){delivery=await sendPresenterCommand(normalized,toolbarSenderId);sent=delivery.sent;setTimeout(()=>{if(shareActive)showCompanionWindow(normalized);},45);}
    else if(['show-meeting','participants','chat','annotate'].includes(normalized)){const main=getMainWindow?.();if(main&&!main.isDestroyed()){main.show();main.focus();}}
    if(!sent){delivery=await sendPresenterCommand(normalized,toolbarSenderId);sent=delivery.sent;}
    if(normalized==='stop'&&shareActive){if(stopRetryTimer)clearTimeout(stopRetryTimer);stopRetryTimer=setTimeout(()=>{stopRetryTimer=null;if(shareActive){if(platform!=='darwin')showMeetingWindow({focus:false});else keepMeetingRendererLive();void sendPresenterCommand('stop',0);}},700);}
    return {ok:Boolean(sent),qaCommandId:Number(delivery?.qaCommandId||0),sent:Boolean(sent),direct:Boolean(delivery?.direct),handled:Boolean(delivery?.direct)};
  });

  return Object.freeze({openPicker,closePicker,closeToolbar,recoverMainWindow,shutdown,sourceAuthority:authority,nativeSystemPicker,systemPickerAvailable});
}