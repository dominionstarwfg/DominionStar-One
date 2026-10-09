import {app,BrowserWindow,ipcMain,screen} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

if(process.platform==='darwin'){
  const here=path.dirname(fileURLToPath(import.meta.url));
  const uiDir=path.resolve(here,'../ui');
  const presenterPreloadPath=path.join(here,'presenter-preload.cjs');
  const PREPARE_STEP_TIMEOUT_MS=process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1'?10000:5000;
  const BORDER_THICKNESS=4;
  const BORDER_ACTIVE_COLOR='#2ed573';
  const BORDER_PAUSED_COLOR='#f5b942';
  let toolbarWindow=null;
  let borderWindows=[]; // four thin edge windows driven by one geometry authority
  let videoWindow=null;
  let annotationWindow=null;
  let annotationCanvasWindow=null;
  let shareActive=false;
  let toolbarReady=false,toolbarAutoHidden=false;
  let toolbarMenuOpen=false;
  let annotationPointerPassthrough=false,nativeAnnotationActive=false;
  let cursorWatchTimer=0,lastCursorPoint=null;
  let preparing=null;
  let presenterDeliverySeq=0;
  let videoLayout='strip';
  const presenterDeliveries=new Map();
  const presenterCommandQueue=[];
  const qaPresenterTrace=process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';
  const qaKeepPresenterHidden=qaPresenterTrace&&process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1';
  const qaDeferPresenterShow=qaPresenterTrace&&process.env.DOMINIONSTAR_QA_DEFER_MAC_PRESENTER_SHOW==='1';
  let shareState={paused:false,micOn:false,cameraOn:true,cameraId:'',mirror:true,sourceName:'',displayId:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:false,voiceLevel:0,speaking:false,participants:[]};

  const isAlive=win=>Boolean(win&&!win.isDestroyed());
  const bordersReady=()=>borderWindows.length===1&&borderWindows.every(isAlive);
  const isBorderWindow=win=>borderWindows.includes(win);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const mainWindow=()=>{
    const windows=BrowserWindow.getAllWindows().filter(isAlive);
    return windows.find(win=>String(win.webContents?.getURL?.()||'').includes('/ui/index.html'))
      ||windows.find(win=>win!==toolbarWindow&&!isBorderWindow(win)&&win!==videoWindow&&win!==annotationWindow&&win!==annotationCanvasWindow&&!String(win.webContents?.getURL?.()||'').includes('mac-presenter-toolbar.html')&&!String(win.webContents?.getURL?.()||'').includes('mac-share-video.html')&&!String(win.webContents?.getURL?.()||'').includes('mac-annotation-toolbar.html')&&!String(win.webContents?.getURL?.()||'').includes('mac-annotation-canvas.html')&&win.isVisible?.())
      ||null;
  };
  const displayForMain=()=>{const main=mainWindow();try{return main?screen.getDisplayMatching(main.getBounds()):screen.getPrimaryDisplay();}catch{return screen.getPrimaryDisplay();}};
  const displayForSharedContent=()=>{const id=String(shareState.displayId||'');if(id){try{const matched=screen.getAllDisplays().find(display=>String(display.id)===id);if(matched)return matched;}catch{}}return displayForMain();};
  const isDisplayShare=()=>/screen|desktop|display|entire/i.test(String(shareState.sourceName||''));

  // Presenter chrome must remain visible in normal macOS screenshots. Content
  // protection makes Electron windows render blank in screenshots, which is not
  // acceptable for meeting controls, the participant video companion, annotation
  // palette, or the share perimeter. Keep these non-sensitive presenter surfaces
  // capturable and rely on share-stream composition rules rather than OS capture
  // blocking for presenter UX.
  function allowSystemCapture(win){
    if(!isAlive(win))return false;
    try{win.setContentProtection(false);}catch{}
    // Reassert on every reveal. Older builds only cleared protection at window
    // creation, so a later presenter/session transition could leave a visible
    // surface blank in ordinary macOS screenshots.
    try{win.__dominionSystemCaptureAllowed=true;}catch{}
    return true;
  }
  function wakeMain(main=mainWindow()){
    if(!isAlive(main))return false;
    // Renderer scheduling is fixed at BrowserWindow creation. Do not mutate
    // background throttling while macOS presenter surfaces are hidden/shown;
    // the 43.x compositor path is sensitive to that runtime transition.
    // share-service remains the sole meeting-window geometry authority.
    try{toolbarWindow?.moveTop?.();}catch{}
    return true;
  }
  async function boundedLoad(label,loader){
    let timer=0;
    try{return await Promise.race([Promise.resolve().then(loader),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label}_timeout`)),PREPARE_STEP_TIMEOUT_MS);})]);}
    finally{if(timer)clearTimeout(timer);}
  }
  function closeFailedWindow(win){if(!isAlive(win))return;try{win.setClosable?.(true);win.close();}catch{try{win.destroy?.();}catch{}}}
  function stopCursorWatch(){if(cursorWatchTimer){clearInterval(cursorWatchTimer);cursorWatchTimer=0;}lastCursorPoint=null;}
  function toolbarRevealZoneContains(point){
    if(!point)return false;
    const display=isDisplayShare()?displayForSharedContent():displayForMain(),area=display.workArea||display.bounds;
    const width=Math.min(770,Math.max(680,area.width-28)),left=Math.round(area.x+(area.width-width)/2),right=left+width;
    const top=Math.round(area.y),bottom=Math.round(area.y+64);
    return point.x>=left&&point.x<=right&&point.y>=top&&point.y<=bottom;
  }
  function startCursorWatch(){
    if(cursorWatchTimer)return;
    try{lastCursorPoint=screen.getCursorScreenPoint();}catch{lastCursorPoint=null;}
    cursorWatchTimer=setInterval(()=>{
      if(!shareActive||!toolbarAutoHidden||toolbarMenuOpen||qaKeepPresenterHidden)return;
      let point=null;try{point=screen.getCursorScreenPoint();}catch{return;}
      if(!lastCursorPoint){lastCursorPoint=point;return;}
      const moved=Math.abs(point.x-lastCursorPoint.x)+Math.abs(point.y-lastCursorPoint.y);lastCursorPoint=point;
      if(moved<3||!toolbarRevealZoneContains(point))return;
      toolbarAutoHidden=false;shareState={...shareState,forceRevealAt:Date.now()};positionToolbar();publishState();
    },120);
  }
  function positionToolbar(){
    if(!isAlive(toolbarWindow))return;
    const display=isDisplayShare()?displayForSharedContent():displayForMain(),area=display.workArea||display.bounds;
    const width=Math.min(770,Math.max(680,area.width-28));
    const height=toolbarMenuOpen?300:(toolbarAutoHidden?28:84);
    const x=Math.round(area.x+(area.width-width)/2),y=Math.round(area.y+12);
    try{toolbarWindow.setBounds({x,y,width,height},false);}catch{}
  }
  function positionBorder(){
    if(!bordersReady())return;
    const display=displayForSharedContent(),bounds=display.bounds,win=borderWindows[0];
    const frame={x:Math.round(bounds.x),y:Math.round(bounds.y),width:Math.round(bounds.width),height:Math.round(bounds.height)};
    try{win.setBounds(frame,false);}catch{}
    try{win.setPosition(frame.x,frame.y,false);}catch{}
  }
  function showBorder(){
    if(!bordersReady())return;positionBorder();
    for(const win of borderWindows){
      try{win.setAlwaysOnTop(true,'screen-saver',2);}catch{try{win.setAlwaysOnTop(true);}catch{}}
      try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
      try{if(process.platform==='darwin'&&typeof win.setSimpleFullScreen==='function'&&!win.isSimpleFullScreen?.())win.setSimpleFullScreen(true);}catch{}
      allowSystemCapture(win);
      try{win.showInactive?.();win.moveTop?.();}catch{}
    }
    // Re-assert all edges from the same selected-display geometry after the
    // window manager commits them; no edge computes its own display bounds.
    setImmediate(()=>{if(shareActive&&bordersReady()){positionBorder();for(const win of borderWindows){try{win.moveTop?.();}catch{}}}});
    setTimeout(()=>{if(shareActive&&bordersReady())positionBorder();},80);
  }
  function hideBorder(){for(const win of borderWindows){if(!isAlive(win))continue;try{if(process.platform==='darwin'&&win.isSimpleFullScreen?.())win.setSimpleFullScreen(false);}catch{}try{win.hide();}catch{}}}
  function positionVideo({preservePosition=false}={}){
    if(!isAlive(videoWindow))return;
    const display=isDisplayShare()?displayForSharedContent():displayForMain(),area=display.workArea||display.bounds;
    const participantCount=Math.max(1,Math.min(5,Array.isArray(shareState.participants)?shareState.participants.length:1));
    let width=252,height=166;
    if(videoLayout==='strip')height=Math.min(area.height-92,32+(participantCount*134)+Math.max(0,participantCount-1)*2);
    else if(videoLayout==='gallery'){width=360;const visible=Math.min(4,participantCount),rows=Math.ceil(visible/2);height=Math.min(area.height-92,34+(rows*112)+Math.max(0,rows-1)*4);}
    else if(videoLayout==='speaker'){width=268;height=166;}
    let x=Math.round(area.x+area.width-width-18),y=Math.round(area.y+76);
    if(preservePosition){
      try{const current=videoWindow.getBounds();x=Math.max(area.x+8,Math.min(current.x,area.x+area.width-width-8));y=Math.max(area.y+48,Math.min(current.y,area.y+area.height-height-8));}catch{}
    }
    try{videoWindow.setBounds({x,y,width,height},false);}catch{}
  }
  function positionAnnotation(){
    if(!isAlive(annotationWindow))return;
    const display=isDisplayShare()?displayForSharedContent():displayForMain(),area=display.workArea||display.bounds;
    const width=184,height=Math.min(526,Math.max(430,area.height-180));
    const x=Math.round(area.x+8),y=Math.round(area.y+Math.max(82,(area.height-height)/2));
    try{annotationWindow.setBounds({x,y,width,height},false);}catch{}
  }
  function positionAnnotationCanvas(){
    if(!isAlive(annotationCanvasWindow))return;
    const display=isDisplayShare()?displayForSharedContent():displayForMain(),area=display.bounds||display.workArea;
    try{annotationCanvasWindow.setBounds({x:Math.round(area.x),y:Math.round(area.y),width:Math.max(2,Math.round(area.width)),height:Math.max(2,Math.round(area.height))},false);}catch{}
  }
  function hideAnnotationCanvas({clearLaser=true}={}){
    if(!isAlive(annotationCanvasWindow))return;
    if(clearLaser){try{annotationCanvasWindow.webContents.send('mac-annotation:command',{command:'annotate-laser-clear'});}catch{}}
    try{annotationCanvasWindow.hide();}catch{}
  }
  function hideAnnotationPalette(){
    if(!isAlive(annotationWindow))return;
    try{annotationWindow.hide();}catch{}
    if(qaPresenterTrace)console.error(`QA_MAC_ANNOTATION_VISIBILITY visible=${annotationWindow.isVisible?.()?1:0}`);
  }
  function setAnnotationPointerPassthrough(enabled){
    annotationPointerPassthrough=Boolean(enabled);
    if(!isAlive(annotationCanvasWindow))return annotationPointerPassthrough;
    try{annotationCanvasWindow.setIgnoreMouseEvents(annotationPointerPassthrough,{forward:true});}catch{}
    return annotationPointerPassthrough;
  }
  function showAnnotationPalette(){
    if(!shareActive)return;
    void Promise.all([prepareAnnotation(),prepareAnnotationCanvas()]).then(([palette,canvas])=>{
      if(!shareActive||String(shareState.companion||'')!=='annotate'||!isAlive(palette)||!isAlive(canvas))return;
      positionAnnotationCanvas();positionAnnotation();allowSystemCapture(canvas);allowSystemCapture(palette);
      try{canvas.showInactive?.();canvas.moveTop?.();}catch{}
      try{toolbarWindow?.moveTop?.();videoWindow?.moveTop?.();palette.showInactive?.();palette.moveTop?.();}catch{}
    });
  }
  function setVideoLayout(mode='strip'){
    videoLayout=['speaker','strip','gallery','hide'].includes(String(mode))?String(mode):'strip';
    if(!isAlive(videoWindow))return {ok:false,layout:videoLayout};
    if(videoLayout==='hide'){try{videoWindow.hide();}catch{}return {ok:true,layout:videoLayout};}
    positionVideo({preservePosition:true});allowSystemCapture(videoWindow);try{videoWindow.showInactive?.();videoWindow.moveTop?.();}catch{}return {ok:true,layout:videoLayout};
  }
  function syncBorderState(){
    if(!bordersReady())return;
    const paused=Boolean(shareState.paused);
    for(const win of borderWindows){
      if(!isAlive(win))continue;
      void win.webContents.executeJavaScript(`document.body.dataset.shareState='${paused?'paused':'active'}';true`,true).catch(()=>{});
    }
  }
  function publishState(){
    if(toolbarReady&&isAlive(toolbarWindow))toolbarWindow.webContents.send('share:toolbar-state',{...shareState,videoLayout});
    if(isAlive(videoWindow))videoWindow.webContents.send('share:toolbar-state',{...shareState,videoLayout});
    if(isAlive(annotationWindow))annotationWindow.webContents.send('share:toolbar-state',{...shareState,videoLayout});
    syncBorderState();
  }

  async function prepareToolbar(){
    if(isAlive(toolbarWindow)&&toolbarReady)return toolbarWindow;
    if(isAlive(toolbarWindow))closeFailedWindow(toolbarWindow);
    toolbarWindow=null;toolbarReady=false;
    const win=new BrowserWindow({
      width:770,height:84,minWidth:680,minHeight:28,maxHeight:300,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
      resizable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,
      focusable:false,acceptFirstMouse:true,
      webPreferences:{preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,devTools:false,backgroundThrottling:false,partition:'dominion-presenter-toolbar-v2044'}
    });
    toolbarWindow=win;allowSystemCapture(win);
    try{win.setAlwaysOnTop(true,'floating');}catch{try{win.setAlwaysOnTop(true);}catch{}}
    try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('closed',()=>{if(toolbarWindow===win){toolbarWindow=null;toolbarReady=false;}});
    positionToolbar();
    try{
      await boundedLoad('mac_presenter_toolbar_load',()=>win.loadFile(path.join(uiDir,'mac-presenter-toolbar.html')));
      if(!isAlive(win)||toolbarWindow!==win)return null;
      toolbarReady=true;publishState();
      if(shareActive&&!qaKeepPresenterHidden){positionToolbar();win.showInactive?.();win.moveTop?.();}
      return win;
    }catch(error){console.error('[DominionStar Meet] macOS presenter toolbar failed to prepare.',error);closeFailedWindow(win);if(toolbarWindow===win)toolbarWindow=null;toolbarReady=false;return null;}
  }

  async function prepareBorder(){
    if(bordersReady())return borderWindows;
    for(const win of borderWindows)closeFailedWindow(win);borderWindows=[];
    const html=`<!doctype html><meta charset="utf-8"><style>
      *{box-sizing:border-box}
      html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
      body::before{content:"";position:fixed;inset:0;pointer-events:none;box-sizing:border-box;border:${BORDER_THICKNESS}px solid ${BORDER_ACTIVE_COLOR};border-radius:0}\n      body[data-share-state="paused"]::before{border-color:${BORDER_PAUSED_COLOR}}
    </style>`;
    const url=`data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    let win=null;
    try{
      win=new BrowserWindow({
        width:8,height:8,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
        resizable:false,movable:false,fullscreenable:false,minimizable:false,maximizable:false,
        closable:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:false,roundedCorners:false,
        webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false}
      });
      borderWindows=[win];allowSystemCapture(win);
      try{win.setIgnoreMouseEvents(true,{forward:true});}catch{}
      try{win.setAlwaysOnTop(true,'screen-saver',2);}catch{try{win.setAlwaysOnTop(true);}catch{}}
      try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
      win.on('closed',()=>{borderWindows=borderWindows.filter(candidate=>candidate!==win);});
      await boundedLoad('mac_share_perimeter_load',()=>win.loadURL(url));
      syncBorderState();
      if(!bordersReady())throw new Error('mac_share_perimeter_incomplete');
      positionBorder();
      return borderWindows;
    }catch(error){
      console.error('[DominionStar Meet] share perimeter failed to prepare.',error);
      if(win)closeFailedWindow(win);borderWindows=[];return null;
    }
  }
  async function prepareVideo(){
    if(isAlive(videoWindow))return videoWindow;
    const win=new BrowserWindow({width:252,height:166,minWidth:230,minHeight:145,maxWidth:420,maxHeight:720,show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:true,movable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,focusable:true,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,acceptFirstMouse:true,webPreferences:{preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,devTools:false,backgroundThrottling:false,partition:'dominion-presenter-video-v2050'}});
    videoWindow=win;allowSystemCapture(win);try{win.setAlwaysOnTop(true,'floating');}catch{try{win.setAlwaysOnTop(true);}catch{}}
    try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('closed',()=>{if(videoWindow===win)videoWindow=null;});positionVideo();
    try{await boundedLoad('mac_share_video_load',()=>win.loadFile(path.join(uiDir,'mac-share-video.html')));if(!isAlive(win)||videoWindow!==win)return null;publishState();if(shareActive&&!qaKeepPresenterHidden&&videoLayout!=='hide'){positionVideo();win.showInactive?.();win.moveTop?.();}return win;}
    catch(error){console.error('[DominionStar Meet] macOS presenter video dock failed to prepare.',error);closeFailedWindow(win);if(videoWindow===win)videoWindow=null;return null;}
  }

  async function prepareAnnotationCanvas(){
    if(isAlive(annotationCanvasWindow))return annotationCanvasWindow;
    const win=new BrowserWindow({
      width:800,height:600,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
      resizable:false,movable:false,fullscreenable:false,minimizable:false,maximizable:false,closable:false,focusable:true,alwaysOnTop:true,skipTaskbar:true,hasShadow:false,acceptFirstMouse:true,roundedCorners:false,
      webPreferences:{preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,devTools:false,backgroundThrottling:false,partition:'dominion-presenter-annotation-canvas-v2044'}
    });
    annotationCanvasWindow=win;allowSystemCapture(win);
    try{win.setAlwaysOnTop(true,'floating',0);}catch{try{win.setAlwaysOnTop(true);}catch{}}
    try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('closed',()=>{if(annotationCanvasWindow===win)annotationCanvasWindow=null;});
    positionAnnotationCanvas();
    try{
      await boundedLoad('mac_annotation_canvas_load',()=>win.loadFile(path.join(uiDir,'mac-annotation-canvas.html')));
      if(!isAlive(win)||annotationCanvasWindow!==win)return null;
      return win;
    }catch(error){
      console.error('[DominionStar Meet] macOS annotation canvas failed to prepare.',error);
      closeFailedWindow(win);if(annotationCanvasWindow===win)annotationCanvasWindow=null;return null;
    }
  }

  async function prepareAnnotation(){
    if(isAlive(annotationWindow))return annotationWindow;
    const win=new BrowserWindow({
      width:184,height:500,minWidth:184,maxWidth:184,minHeight:430,maxHeight:526,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
      resizable:false,movable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,focusable:true,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,acceptFirstMouse:true,
      webPreferences:{preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,devTools:false,backgroundThrottling:false,partition:'dominion-presenter-annotation-v2044'}
    });
    annotationWindow=win;allowSystemCapture(win);
    try{win.setAlwaysOnTop(true,'screen-saver',3);}catch{try{win.setAlwaysOnTop(true);}catch{}}
    try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('closed',()=>{if(annotationWindow===win)annotationWindow=null;});
    positionAnnotation();
    try{
      await boundedLoad('mac_annotation_toolbar_load',()=>win.loadFile(path.join(uiDir,'mac-annotation-toolbar.html')));
      if(!isAlive(win)||annotationWindow!==win)return null;
      publishState();
      return win;
    }catch(error){
      console.error('[DominionStar Meet] macOS annotation palette failed to prepare.',error);
      closeFailedWindow(win);if(annotationWindow===win)annotationWindow=null;return null;
    }
  }

  async function prepare(){
    if(preparing)return preparing;
    preparing=(async()=>{await prepareToolbar();await Promise.allSettled([prepareBorder(),prepareVideo()]);const ok=Boolean(toolbarReady&&isAlive(toolbarWindow)&&bordersReady()&&isAlive(videoWindow));return {ok,toolbarReady,prepared:ok};})()
      .catch(error=>{console.error('[DominionStar Meet] macOS presenter preparation failed.',error);return {ok:false,toolbarReady:false,prepared:false,error:String(error?.message||error||'presenter_prepare_failed')};})
      .finally(()=>{preparing=null;});return preparing;
  }
  function showMeeting(){
    const main=mainWindow();if(!isAlive(main))return false;wakeMain(main);
    try{main.setIgnoreMouseEvents(false);}catch{}try{main.setOpacity?.(1);}catch{}
    try{main.webContents.send('mac-share:show-meeting',{visible:true});}catch{}
    try{main.show();main.focus();}catch{}
    shareState={...shareState,meetingVisible:true};publishState();return true;
  }
  function hideMeeting(){
    const main=mainWindow();if(!isAlive(main))return false;wakeMain(main);
    try{main.setIgnoreMouseEvents(true);}catch{}
    try{main.webContents.send('mac-share:show-meeting',{visible:false});}catch{}
    shareState={...shareState,meetingVisible:false};publishState();try{toolbarWindow?.moveTop?.();}catch{}return true;
  }
  function logProcessBoundary(){
    if(!qaPresenterTrace)return;
    const main=mainWindow();
    const mainPid=Number(main?.webContents?.getOSProcessId?.()||0)||0;
    const toolbarPid=Number(toolbarWindow?.webContents?.getOSProcessId?.()||0)||0;
    const videoPid=Number(videoWindow?.webContents?.getOSProcessId?.()||0)||0;
    const isolated=Boolean(mainPid&&toolbarPid&&videoPid&&mainPid!==toolbarPid&&mainPid!==videoPid&&toolbarPid!==videoPid);
    console.error(`QA_MAC_PRESENTER_PROCESS_BOUNDARY mainPid=${mainPid} toolbarPid=${toolbarPid} videoPid=${videoPid} isolated=${isolated?1:0}`);
  }
  async function qaRevealStage(stage='toolbar'){
    if(!qaPresenterTrace||!shareActive)return {ok:false,stage:String(stage||''),error:'qa_stage_unavailable'};
    await prepare();
    const normalized=String(stage||'toolbar');
    positionToolbar();positionBorder();positionVideo();publishState();logProcessBoundary();
    if(normalized==='toolbar'){
      if(toolbarReady&&isAlive(toolbarWindow)){toolbarWindow.showInactive?.();toolbarWindow.moveTop?.();}
    }else if(normalized==='video'){
      if(isAlive(videoWindow)&&videoLayout!=='hide'){videoWindow.showInactive?.();videoWindow.moveTop?.();}
    }else if(normalized==='border'){
      if(isDisplayShare())showBorder();else hideBorder();
    }else return {ok:false,stage:normalized,error:'unknown_qa_reveal_stage'};
    console.error(`QA_MAC_REVEAL_STAGE stage=${normalized}`);
    return {ok:true,stage:normalized};
  }
  function showOverlays(){
    if(!shareActive)return;
    void prepare().then(()=>{
      if(!shareActive)return;positionToolbar();positionBorder();positionVideo();publishState();logProcessBoundary();
      if(qaKeepPresenterHidden){if(qaPresenterTrace)console.error('QA_MAC_PRESENTER_PREPARED_HIDDEN');hideOverlays();return;}
      if(toolbarReady&&isAlive(toolbarWindow)){allowSystemCapture(toolbarWindow);toolbarWindow.showInactive?.();toolbarWindow.moveTop?.();}
      if(isAlive(videoWindow)&&videoLayout!=='hide'){allowSystemCapture(videoWindow);videoWindow.showInactive?.();videoWindow.moveTop?.();}
      if(isDisplayShare())showBorder();else hideBorder();
    });
  }
  function hideOverlays(){toolbarMenuOpen=false;if(isAlive(toolbarWindow)){try{toolbarWindow.setBounds({...toolbarWindow.getBounds(),height:84},false);}catch{}toolbarWindow.hide();}if(isAlive(videoWindow))videoWindow.hide();hideAnnotationCanvas();hideAnnotationPalette();hideBorder();}

  function removeQueuedPresenterDelivery(deliveryId){const id=Number(deliveryId||0)||0;if(!id)return false;const index=presenterCommandQueue.findIndex(item=>Number(item?.deliveryId||0)===id);if(index<0)return false;presenterCommandQueue.splice(index,1);return true;}
  function settlePresenterDelivery(deliveryId,result){const pending=presenterDeliveries.get(deliveryId);if(!pending)return false;presenterDeliveries.delete(deliveryId);clearTimeout(pending.timer);pending.resolve(result);return true;}
  function deliverPresenterCommand(main,command){
    const deliveryId=++presenterDeliverySeq;const payload={command,deliveryId};presenterCommandQueue.push(payload);
    if(qaPresenterTrace)console.error(`QA_MAC_PRESENTER_ENQUEUE delivery=${deliveryId} command=${String(command||'')} queue=${presenterCommandQueue.length}`);
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{presenterDeliveries.delete(deliveryId);removeQueuedPresenterDelivery(deliveryId);resolve({ok:false,sent:true,acknowledged:false,error:'presenter_command_ack_timeout',deliveryId});},900);
      presenterDeliveries.set(deliveryId,{resolve,timer});
      try{main.webContents.send('share:presenter-command',payload);}catch(error){clearTimeout(timer);presenterDeliveries.delete(deliveryId);removeQueuedPresenterDelivery(deliveryId);resolve({ok:false,sent:false,acknowledged:false,error:String(error?.message||error||'presenter_command_failed'),deliveryId});}
    });
  }
  async function deliverPresenterCommandWithRetry(main,command){
    wakeMain(main);let result=await deliverPresenterCommand(main,command);if(result?.ok)return result;
    await wait(120);wakeMain(main);result=await deliverPresenterCommand(main,command);return result;
  }

  ipcMain.handle('mac-share:prepare',()=>prepare());
  ipcMain.handle('mac-share:reveal',()=>{showOverlays();return {ok:true};});
  ipcMain.handle('mac-share:qa-reveal-stage',(_event,{stage='toolbar'}={})=>qaRevealStage(stage));
  ipcMain.handle('mac-share:presenter-next-command',(event)=>{const main=mainWindow();if(!isAlive(main)||event.sender!==main.webContents)return null;const next=presenterCommandQueue.shift()||null;if(next&&qaPresenterTrace)console.error(`QA_MAC_PRESENTER_PULL delivery=${Number(next.deliveryId||0)||0} command=${String(next.command||'')} queue=${presenterCommandQueue.length}`);return next?{...next}:null;});
  ipcMain.on('share:capture-started',(_event,state={})=>{
    shareActive=true;shareState={...shareState,...state,meetingVisible:false};startCursorWatch();
    // Hidden-presenter diagnostic must be a true zero-surface-mutation test.
    // Do not position, publish to, show, hide, resize, or raise any presenter
    // BrowserWindow after capture starts. This isolates the capture renderer
    // from macOS compositor/window-server effects.
    if(qaKeepPresenterHidden){
      if(qaPresenterTrace)console.error('QA_MAC_CAPTURE_STARTED_NO_SURFACE_MUTATION');
      return;
    }
    if(qaDeferPresenterShow){
      if(qaPresenterTrace)console.error('QA_MAC_PRESENTER_SHOW_DEFERRED');
      return;
    }
    showOverlays();
  });
  ipcMain.on('mac-share:state',(_event,state={})=>{
    if(!shareActive)return;
    const priorCount=Array.isArray(shareState.participants)?shareState.participants.length:0,priorDisplay=String(shareState.displayId||'');
    shareState={...shareState,...state,...(nativeAnnotationActive?{meetingVisible:false,companion:'annotate',companionOpen:true}:null)};
    const nextCount=Array.isArray(shareState.participants)?shareState.participants.length:0,nextDisplay=String(shareState.displayId||'');
    if(priorCount!==nextCount||priorDisplay!==nextDisplay)positionVideo({preservePosition:priorDisplay===nextDisplay});
    publishState();
    const companion=String(shareState.companion||'');
    const main=mainWindow();
    if(companion==='annotate'){
      if(isAlive(main)){try{main.setIgnoreMouseEvents(false);}catch{}}
      showAnnotationPalette();
    }else{
      hideAnnotationPalette();
      if(isAlive(main)&&!shareState.meetingVisible&&companion!=='participants'&&companion!=='chat'){try{main.setIgnoreMouseEvents(true);}catch{}}
    }
    if(qaKeepPresenterHidden){hideBorder();return;}
    if(isDisplayShare())showBorder();else hideBorder();
  });
  ipcMain.on('mac-share:video-frame',(event,payload={})=>{
    const main=mainWindow();
    if(!shareActive||!isAlive(main)||event.sender!==main.webContents||!isAlive(videoWindow))return;
    const participantId=String(payload?.participantId||''),dataUrl=String(payload?.dataUrl||'');
    if(!participantId||!/^data:image\/(?:jpeg|webp|png);base64,/i.test(dataUrl)||dataUrl.length>220000)return;
    try{videoWindow.webContents.send('mac-share:video-frame',{participantId,dataUrl,at:Number(payload?.at)||Date.now()});}catch{}
  });
  ipcMain.on('mac-share:voice-level',(_event,payload={})=>{
    if(!shareActive)return;
    const level=Math.max(0,Math.min(1,Number(payload?.level)||0));
    const speaking=Boolean(payload?.speaking&&level>0);
    shareState={...shareState,voiceLevel:level,speaking};
    publishState();
  });
  function resetPresenterSession(reason='reset'){
    if(qaPresenterTrace)console.error(`QA_MAC_PRESENTER_RESET reason=${String(reason||'reset')}`);
    shareActive=false;videoLayout='strip';toolbarMenuOpen=false;toolbarAutoHidden=false;nativeAnnotationActive=false;setAnnotationPointerPassthrough(false);stopCursorWatch();
    shareState={paused:false,micOn:false,cameraOn:false,cameraId:'',mirror:true,sourceName:'',displayId:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:false,voiceLevel:0,speaking:false,participants:[]};
    publishState();hideOverlays();presenterCommandQueue.length=0;
    for(const [deliveryId,pending] of presenterDeliveries){clearTimeout(pending.timer);pending.resolve({ok:false,sent:false,acknowledged:false,error:'presenter_reset',deliveryId});}
    presenterDeliveries.clear();
    return true;
  }
  function destroyPresenterSession(reason='meeting-ended'){
    resetPresenterSession(reason);
    preparing=null;
    const windows=[toolbarWindow,...borderWindows,videoWindow,annotationWindow,annotationCanvasWindow];
    toolbarWindow=null;toolbarReady=false;borderWindows=[];videoWindow=null;annotationWindow=null;annotationCanvasWindow=null;
    for(const win of windows){
      if(!isAlive(win))continue;
      try{win.setClosable?.(true);}catch{}
      try{win.hide?.();}catch{}
      try{win.close?.();}catch{try{win.destroy?.();}catch{}}
      if(isAlive(win)){try{win.destroy?.();}catch{}}
    }
    if(qaPresenterTrace)console.error(`QA_MAC_PRESENTER_DESTROY reason=${String(reason||'meeting-ended')} remaining=${windows.filter(isAlive).length}`);
    return true;
  }
  ipcMain.on('mac-share:capture-stopped',()=>destroyPresenterSession('capture-stopped'));
  ipcMain.on('share:presenter-delivery-ack',(event,payload={})=>{
    const deliveryId=Number(payload?.deliveryId||0)||0;if(!deliveryId)return;const main=mainWindow();if(!isAlive(main)||event.sender!==main.webContents)return;removeQueuedPresenterDelivery(deliveryId);
    if(qaPresenterTrace)console.error(`QA_MAC_PRESENTER_ACK delivery=${deliveryId} command=${String(payload?.command||'')} accepted=${payload?.accepted?1:0}`);
    settlePresenterDelivery(deliveryId,{ok:Boolean(payload?.accepted),sent:true,acknowledged:true,deliveryId,error:payload?.accepted?'':String(payload?.error||'presenter_command_rejected')});
  });

  ipcMain.handle('mac-share:presenter-command',async(_event,{command}={})=>{
    const normalized=String(command||'').replace(/^toolbar:/,'');const main=mainWindow();if(!isAlive(main))return {ok:false,sent:false,acknowledged:false,error:'meeting_window_unavailable'};
    if(normalized==='show-meeting'){if(shareState.meetingVisible)hideMeeting();else showMeeting();return {ok:true,sent:true,acknowledged:true};}
    if(normalized==='layout-hide')return {...setVideoLayout('hide'),sent:true,acknowledged:true};
    if(normalized==='layout-speaker')return {...setVideoLayout('speaker'),sent:true,acknowledged:true};
    if(normalized==='layout-strip')return {...setVideoLayout('strip'),sent:true,acknowledged:true};
    if(normalized==='layout-gallery')return {...setVideoLayout('gallery'),sent:true,acknowledged:true};
    if(normalized==='annotate'){
      const open=String(shareState.companion||'')==='annotate'&&isAlive(annotationCanvasWindow)&&Boolean(annotationCanvasWindow.isVisible?.());
      if(open){
        const rendererSync=await deliverPresenterCommandWithRetry(main,'annotate-close');
        if(!rendererSync?.ok)return {...rendererSync,active:true,error:rendererSync?.error||'annotation_close_state_sync_failed'};
        nativeAnnotationActive=false;shareState={...shareState,companion:'',companionOpen:false};hideAnnotationCanvas();hideAnnotationPalette();publishState();
        return {ok:true,sent:true,acknowledged:true,active:false,rendererSynced:true};
      }
      nativeAnnotationActive=true;shareState={...shareState,meetingVisible:false,companion:'annotate',companionOpen:true};setAnnotationPointerPassthrough(true);hideMeeting();showAnnotationPalette();try{annotationCanvasWindow?.webContents?.send('mac-annotation:command',{command:'annotate-select'});}catch{}publishState();return {ok:true,sent:true,acknowledged:true,active:true,pointerPassthrough:true};
    }
    if(normalized==='annotate-close'){
      const rendererSync=await deliverPresenterCommandWithRetry(main,'annotate-close');
      if(!rendererSync?.ok)return {...rendererSync,active:true,error:rendererSync?.error||'annotation_close_state_sync_failed'};
      nativeAnnotationActive=false;shareState={...shareState,companion:'',companionOpen:false};setAnnotationPointerPassthrough(false);hideAnnotationCanvas();hideAnnotationPalette();publishState();
      return {ok:true,sent:true,acknowledged:true,active:false,rendererSynced:true};
    }
    if(normalized.startsWith('annotate-')){
      nativeAnnotationActive=true;shareState={...shareState,meetingVisible:false,companion:'annotate',companionOpen:true};hideMeeting();
      const canvas=await prepareAnnotationCanvas();await prepareAnnotation();showAnnotationPalette();
      if(!isAlive(canvas))return {ok:false,sent:false,acknowledged:false,error:'annotation_canvas_unavailable'};
      if(normalized==='annotate-select')setAnnotationPointerPassthrough(true);
      else if(/^annotate-(?:pen|highlight|laser|erase|shape-)/.test(normalized))setAnnotationPointerPassthrough(false);
      try{canvas.webContents.send('mac-annotation:command',{command:normalized});if(isAlive(annotationWindow)){try{annotationWindow.setAlwaysOnTop(true,'screen-saver',3);annotationWindow.showInactive?.();annotationWindow.moveTop?.();}catch{}}return {ok:true,sent:true,acknowledged:true,pointerPassthrough:annotationPointerPassthrough};}
      catch(error){return {ok:false,sent:false,acknowledged:false,error:String(error?.message||error||'annotation_command_failed')};}
    }
    const panelCommand=['participants','chat'].includes(normalized)||/^participant:(?:chat|rename):/.test(normalized);
    if(normalized==='annotate'||normalized.startsWith('annotate-'))hideMeeting();
    const closingAnnotationToggle=normalized==='annotate'&&isAlive(annotationWindow)&&Boolean(annotationWindow.isVisible?.());
    const delivered=await deliverPresenterCommandWithRetry(main,normalized);
    if(panelCommand&&delivered?.ok)showMeeting();
    if((normalized==='annotate-close'||closingAnnotationToggle)&&delivered?.ok){
      shareState={...shareState,companion:'',companionOpen:false};
      hideAnnotationPalette();
      publishState();
    }
    return delivered;
  });
  ipcMain.handle('mac-share:menu-state',(_event,{open=false}={})=>{toolbarMenuOpen=Boolean(open);if(toolbarMenuOpen)toolbarAutoHidden=false;positionToolbar();return {ok:true,height:toolbarMenuOpen?300:(toolbarAutoHidden?28:84)};});
  ipcMain.handle('mac-share:toolbar-hidden',(_event,{hidden=false}={})=>{toolbarAutoHidden=Boolean(hidden)&&!toolbarMenuOpen;positionToolbar();if(toolbarAutoHidden){try{lastCursorPoint=screen.getCursorScreenPoint();}catch{lastCursorPoint=null;}}return {ok:true,hidden:toolbarAutoHidden,height:toolbarAutoHidden?28:84};});
  ipcMain.handle('mac-share:show-meeting',()=>({ok:shareState.meetingVisible?hideMeeting():showMeeting()}));

  screen.on('display-metrics-changed',()=>{if(shareActive){positionToolbar();positionBorder();positionVideo();positionAnnotation();positionAnnotationCanvas();}});
  app.on('before-quit',()=>{destroyPresenterSession('app-quitting');});

  globalThis.__dominionMacSharePresenterOverlay=Object.freeze({showMeeting,hideMeeting,showOverlays,hideOverlays,prepare,reset:()=>resetPresenterSession('external-reset'),destroy:()=>destroyPresenterSession('external-destroy'),state:()=>({shareActive,prepared:Boolean(toolbarReady&&isAlive(toolbarWindow)&&bordersReady()&&isAlive(videoWindow)),videoLayout,shareState:{...shareState}})});
}