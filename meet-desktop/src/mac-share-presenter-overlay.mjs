import {app,BrowserWindow,ipcMain,screen} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

if(process.platform==='darwin'){
  const here=path.dirname(fileURLToPath(import.meta.url));
  const uiDir=path.resolve(here,'../ui');
  const presenterPreloadPath=path.join(here,'presenter-preload.cjs');
  const PREPARE_STEP_TIMEOUT_MS=2200;
  const BORDER_THICKNESS=4;
  const BORDER_COLOR='#2ed573';
  let toolbarWindow=null;
  let borderWindows=[];
  let videoWindow=null;
  let shareActive=false;
  let toolbarReady=false;
  let toolbarMenuOpen=false;
  let preparing=null;
  let presenterDeliverySeq=0;
  let videoLayout='speaker';
  let presenterDisplayId=0;
  let meetingBoundsBeforeShare=null;
  const presenterDeliveries=new Map();
  const presenterCommandQueue=[];
  const qaPresenterTrace=process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';
  const qaKeepPresenterHidden=qaPresenterTrace&&process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1';
  let shareState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:false};

  const isAlive=win=>Boolean(win&&!win.isDestroyed());
  const bordersReady=()=>borderWindows.length===4&&borderWindows.every(isAlive);
  const isBorderWindow=win=>borderWindows.includes(win);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const mainWindow=()=>{
    const windows=BrowserWindow.getAllWindows().filter(isAlive);
    return windows.find(win=>String(win.webContents?.getURL?.()||'').includes('/ui/index.html'))
      ||windows.find(win=>win!==toolbarWindow&&!isBorderWindow(win)&&win!==videoWindow&&!String(win.webContents?.getURL?.()||'').includes('mac-presenter-toolbar.html')&&!String(win.webContents?.getURL?.()||'').includes('mac-share-video.html')&&win.isVisible?.())
      ||null;
  };
  const displayForMain=()=>{try{if(presenterDisplayId){const saved=screen.getAllDisplays().find(display=>Number(display.id)===Number(presenterDisplayId));if(saved)return saved;}const main=mainWindow();return main?screen.getDisplayMatching(meetingBoundsBeforeShare||main.getBounds()):screen.getPrimaryDisplay();}catch{return screen.getPrimaryDisplay();}};
  const isDisplayShare=()=>/screen|desktop|display|entire/i.test(String(shareState.sourceName||''));

  function protect(win){if(!isAlive(win))return;try{win.setContentProtection(true);}catch{}}
  function wakeMain(main=mainWindow()){
    if(!isAlive(main))return false;
    try{main.webContents?.setBackgroundThrottling?.(false);}catch{}
    try{if(main.isMinimized?.())main.restore();}catch{}
    try{main.setAlwaysOnTop(true,'floating');}catch{try{main.setAlwaysOnTop(true);}catch{}}
    try{main.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    try{main.showInactive?.();}catch{}
    try{if(Number(main.getOpacity?.()||0)<0.01)main.setOpacity?.(0.02);}catch{}
    try{toolbarWindow?.moveTop?.();}catch{}
    return true;
  }
  async function boundedLoad(label,loader){
    let timer=0;
    try{return await Promise.race([Promise.resolve().then(loader),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label}_timeout`)),PREPARE_STEP_TIMEOUT_MS);})]);}
    finally{if(timer)clearTimeout(timer);}
  }
  function closeFailedWindow(win){if(!isAlive(win))return;try{win.setClosable?.(true);win.close();}catch{try{win.destroy?.();}catch{}}}
  function positionToolbar(){
    if(!isAlive(toolbarWindow))return;
    const display=displayForMain(),area=display.workArea||display.bounds;
    const width=Math.min(890,Math.max(760,area.width-28));
    const height=toolbarMenuOpen?286:92;
    const x=Math.round(area.x+(area.width-width)/2),y=Math.round(area.y+4);
    try{toolbarWindow.setBounds({x,y,width,height},false);}catch{}
  }
  function positionBorder(){
    if(!bordersReady())return;
    const display=displayForMain(),bounds=display.bounds,t=BORDER_THICKNESS;
    const segments=[
      {x:bounds.x,y:bounds.y,width:bounds.width,height:t},
      {x:bounds.x,y:bounds.y+bounds.height-t,width:bounds.width,height:t},
      {x:bounds.x,y:bounds.y+t,width:t,height:Math.max(t,bounds.height-(t*2))},
      {x:bounds.x+bounds.width-t,y:bounds.y+t,width:t,height:Math.max(t,bounds.height-(t*2))}
    ];
    borderWindows.forEach((win,index)=>{try{win.setBounds(segments[index],false);}catch{}});
  }
  function showBorder(){
    if(!bordersReady())return;positionBorder();
    for(const win of borderWindows){try{win.setAlwaysOnTop(true,'screen-saver',1);}catch{try{win.setAlwaysOnTop(true);}catch{}}try{win.showInactive?.();}catch{}}
    // macOS can constrain hidden utility windows to the work area. Re-apply
    // the physical display bounds after they are visible so all four edges
    // remain flush with the shared display, including the Dock edge.
    positionBorder();
    for(const win of borderWindows){try{win.moveTop?.();}catch{}}
  }
  function hideBorder(){for(const win of borderWindows){if(isAlive(win))try{win.hide();}catch{}}}
  function positionVideo(){
    if(!isAlive(videoWindow))return;
    const display=displayForMain(),area=display.workArea||display.bounds;
    let width=videoLayout==='gallery'?360:252,height=videoLayout==='gallery'?250:174;
    if(videoLayout==='speaker'){try{const current=videoWindow.getBounds();width=Math.max(190,Math.min(360,current.width||252));height=Math.max(132,Math.min(250,current.height||174));}catch{}}
    const x=Math.round(area.x+area.width-width-18),y=Math.round(area.y+78);
    try{videoWindow.setBounds({x,y,width,height},false);}catch{}
  }
  function setVideoLayout(mode='speaker'){
    videoLayout=['speaker','gallery','hide'].includes(String(mode))?String(mode):'speaker';
    if(!isAlive(videoWindow))return {ok:false,layout:videoLayout};
    if(videoLayout==='hide'){try{videoWindow.hide();}catch{}return {ok:true,layout:videoLayout};}
    positionVideo();try{videoWindow.showInactive?.();videoWindow.moveTop?.();}catch{}return {ok:true,layout:videoLayout};
  }
  function publishState(){
    if(toolbarReady&&isAlive(toolbarWindow))toolbarWindow.webContents.send('share:toolbar-state',{...shareState,videoLayout});
    if(isAlive(videoWindow))videoWindow.webContents.send('share:toolbar-state',{...shareState,videoLayout});
  }

  async function prepareToolbar(){
    if(isAlive(toolbarWindow)&&toolbarReady)return toolbarWindow;
    if(isAlive(toolbarWindow))closeFailedWindow(toolbarWindow);
    toolbarWindow=null;toolbarReady=false;
    const win=new BrowserWindow({
      width:890,height:92,minWidth:760,minHeight:92,maxHeight:286,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
      resizable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,
      focusable:false,acceptFirstMouse:true,
      webPreferences:{preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,devTools:false,backgroundThrottling:false}
    });
    toolbarWindow=win;protect(win);
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
    const html=`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${BORDER_COLOR}}body{border:4px solid #2ed573}</style>`;
    const url=`data:text/html;charset=utf-8,${encodeURIComponent(html)}`;const created=[];
    try{
      for(let index=0;index<4;index+=1){
        const win=new BrowserWindow({width:2,height:2,show:false,frame:false,type:'panel',transparent:false,backgroundColor:BORDER_COLOR,resizable:false,movable:false,fullscreenable:false,minimizable:false,maximizable:false,closable:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:false,enableLargerThanScreen:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false}});
        created.push(win);protect(win);try{win.setIgnoreMouseEvents(true,{forward:true});}catch{}
        try{win.setAlwaysOnTop(true,'screen-saver',1);}catch{try{win.setAlwaysOnTop(true);}catch{}}
        try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
        win.on('closed',()=>{borderWindows=borderWindows.filter(candidate=>candidate!==win);});
      }
      borderWindows=created;await Promise.all(created.map((win,index)=>boundedLoad(`mac_share_border_edge_${index}_load`,()=>win.loadURL(url))));
      if(!bordersReady())throw new Error('mac_share_border_edges_incomplete');positionBorder();return borderWindows;
    }catch(error){console.error('[DominionStar Meet] share border failed to prepare.',error);for(const win of created)closeFailedWindow(win);borderWindows=[];return null;}
  }

  async function prepareVideo(){
    if(isAlive(videoWindow))return videoWindow;
    const win=new BrowserWindow({width:252,height:174,minWidth:190,minHeight:132,maxWidth:360,maxHeight:250,show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:true,movable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,acceptFirstMouse:true,webPreferences:{preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,devTools:false,backgroundThrottling:false}});
    videoWindow=win;protect(win);try{win.setAlwaysOnTop(true,'floating');}catch{try{win.setAlwaysOnTop(true);}catch{}}
    try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('closed',()=>{if(videoWindow===win)videoWindow=null;});positionVideo();
    try{await boundedLoad('mac_share_video_load',()=>win.loadFile(path.join(uiDir,'mac-share-video.html')));if(!isAlive(win)||videoWindow!==win)return null;publishState();if(shareActive&&!qaKeepPresenterHidden&&videoLayout!=='hide'){positionVideo();win.showInactive?.();win.moveTop?.();}return win;}
    catch(error){console.error('[DominionStar Meet] macOS presenter video dock failed to prepare.',error);closeFailedWindow(win);if(videoWindow===win)videoWindow=null;return null;}
  }

  async function prepare(){
    if(preparing)return preparing;
    const main=mainWindow();
    if(isAlive(main)&&!meetingBoundsBeforeShare){try{meetingBoundsBeforeShare={...main.getBounds()};presenterDisplayId=Number(screen.getDisplayMatching(meetingBoundsBeforeShare)?.id||0)||0;}catch{}}
    preparing=(async()=>{await prepareToolbar();await Promise.allSettled([prepareBorder(),prepareVideo()]);const ok=Boolean(toolbarReady&&isAlive(toolbarWindow)&&bordersReady()&&isAlive(videoWindow));return {ok,toolbarReady,prepared:ok};})()
      .catch(error=>{console.error('[DominionStar Meet] macOS presenter preparation failed.',error);return {ok:false,toolbarReady:false,prepared:false,error:String(error?.message||error||'presenter_prepare_failed')};})
      .finally(()=>{preparing=null;});return preparing;
  }
  function showMeeting(){
    const main=mainWindow();if(!isAlive(main))return false;wakeMain(main);
    try{if(meetingBoundsBeforeShare)main.setBounds(meetingBoundsBeforeShare,false);}catch{}
    try{main.setIgnoreMouseEvents(false);}catch{}try{main.setOpacity?.(1);}catch{}
    try{main.webContents.send('mac-share:show-meeting');}catch{}
    try{main.show();main.focus();}catch{}
    shareState={...shareState,meetingVisible:true};publishState();return true;
  }
  function hideMeeting(){
    const main=mainWindow();if(!isAlive(main))return false;wakeMain(main);
    const base=meetingBoundsBeforeShare||main.getBounds();
    try{main.setBounds({x:-32000,y:-32000,width:base.width,height:base.height},false);}catch{}
    try{main.setIgnoreMouseEvents(true);}catch{}try{main.setOpacity?.(1);}catch{}
    shareState={...shareState,meetingVisible:false};publishState();try{toolbarWindow?.moveTop?.();}catch{}return true;
  }
  function showOverlays(){
    if(!shareActive)return;
    void prepare().then(()=>{
      if(!shareActive)return;positionToolbar();positionBorder();positionVideo();publishState();
      if(qaKeepPresenterHidden){if(qaPresenterTrace)console.error('QA_MAC_PRESENTER_PREPARED_HIDDEN');hideOverlays();return;}
      if(toolbarReady&&isAlive(toolbarWindow)){toolbarWindow.showInactive?.();toolbarWindow.moveTop?.();}
      if(isAlive(videoWindow)&&videoLayout!=='hide'){videoWindow.showInactive?.();videoWindow.moveTop?.();}
      if(isDisplayShare())showBorder();else hideBorder();
    });
  }
  function hideOverlays(){toolbarMenuOpen=false;if(isAlive(toolbarWindow)){try{toolbarWindow.setBounds({...toolbarWindow.getBounds(),height:92},false);}catch{}toolbarWindow.hide();}if(isAlive(videoWindow))videoWindow.hide();hideBorder();}

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
  ipcMain.handle('mac-share:presenter-next-command',(event)=>{const main=mainWindow();if(!isAlive(main)||event.sender!==main.webContents)return null;const next=presenterCommandQueue.shift()||null;if(next&&qaPresenterTrace)console.error(`QA_MAC_PRESENTER_PULL delivery=${Number(next.deliveryId||0)||0} command=${String(next.command||'')} queue=${presenterCommandQueue.length}`);return next?{...next}:null;});
  ipcMain.on('share:capture-started',(_event,state={})=>{shareActive=true;shareState={...shareState,...state,meetingVisible:false};wakeMain();showOverlays();});
  ipcMain.on('mac-share:state',(_event,state={})=>{if(!shareActive)return;shareState={...shareState,...state};publishState();if(qaKeepPresenterHidden){hideBorder();return;}if(isDisplayShare())showBorder();else hideBorder();});
  ipcMain.on('mac-share:capture-stopped',()=>{shareActive=false;videoLayout='speaker';shareState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true};hideOverlays();presenterDisplayId=0;meetingBoundsBeforeShare=null;});
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
    if(normalized==='layout-gallery')return {...setVideoLayout('gallery'),sent:true,acknowledged:true};
    if(['participants','chat','annotate'].includes(normalized))showMeeting();
    return deliverPresenterCommandWithRetry(main,normalized);
  });
  ipcMain.handle('mac-share:menu-state',(_event,{open=false}={})=>{toolbarMenuOpen=Boolean(open);positionToolbar();return {ok:true,height:toolbarMenuOpen?286:92};});
  ipcMain.handle('mac-share:show-meeting',()=>({ok:shareState.meetingVisible?hideMeeting():showMeeting()}));

  screen.on('display-metrics-changed',()=>{if(shareActive){positionToolbar();positionBorder();positionVideo();}});
  app.on('before-quit',()=>{
    shareActive=false;hideOverlays();presenterCommandQueue.length=0;
    for(const [deliveryId,pending] of presenterDeliveries){clearTimeout(pending.timer);pending.resolve({ok:false,sent:false,acknowledged:false,error:'app_quitting',deliveryId});}
    presenterDeliveries.clear();for(const win of [toolbarWindow,...borderWindows,videoWindow]){if(isAlive(win)){try{win.setClosable?.(true);win.close();}catch{}}}borderWindows=[];
  });

  globalThis.__dominionMacSharePresenterOverlay=Object.freeze({showMeeting,hideMeeting,showOverlays,hideOverlays,prepare,state:()=>({shareActive,prepared:Boolean(toolbarReady&&isAlive(toolbarWindow)&&bordersReady()&&isAlive(videoWindow)),videoLayout,shareState:{...shareState}})});
}