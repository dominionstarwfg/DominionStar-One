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
  let captureOwnerWebContents=null;
  let captureOwnerWindowState=null;
  let shareActive=false;
  let presenterModeCommitted=false;
  let toolbarReady=false;
  let toolbarMenuOpen=false;
  let toolbarUserPositioned=false;
  let positioningToolbar=false;
  let preparing=null;
  let presenterDeliverySeq=0;
  let videoLayout='speaker',lastVisibleVideoLayout='speaker';
  const presenterDeliveries=new Map();
  const presenterCommandQueue=[];
  const qaPresenterTrace=process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';
  const qaKeepPresenterHidden=qaPresenterTrace&&process.env.DOMINIONSTAR_QA_KEEP_MAC_PRESENTER_HIDDEN==='1';
  let shareState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,showGreenBorder:true,includeMeetWindows:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:false};

  const isAlive=win=>Boolean(win&&!win.isDestroyed());
  const bordersReady=()=>borderWindows.length===1&&borderWindows.every(isAlive);
  const isBorderWindow=win=>borderWindows.includes(win);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const captureOwnerWindow=()=>{
    const wc=captureOwnerWebContents;
    if(!wc||wc.isDestroyed?.())return null;
    try{const win=BrowserWindow.fromWebContents(wc);return isAlive(win)?win:null;}catch{return null;}
  };
  const mainWindow=()=>{
    const owner=captureOwnerWindow();if(owner)return owner;
    const windows=BrowserWindow.getAllWindows().filter(isAlive);
    return windows.find(win=>String(win.webContents?.getURL?.()||'').includes('/ui/index.html'))
      ||windows.find(win=>win!==toolbarWindow&&!isBorderWindow(win)&&win!==videoWindow&&!String(win.webContents?.getURL?.()||'').includes('mac-presenter-toolbar.html')&&!String(win.webContents?.getURL?.()||'').includes('mac-share-video.html')&&win.isVisible?.())
      ||null;
  };
  const displayForMain=()=>{const main=mainWindow();try{return main?screen.getDisplayMatching(main.getBounds()):screen.getPrimaryDisplay();}catch{return screen.getPrimaryDisplay();}};
  const isDisplayShare=()=>/screen|desktop|display|entire/i.test(String(shareState.sourceName||''));

  function protect(win){if(!isAlive(win))return;try{win.setContentProtection(true);}catch{}}
  function wakeMain(main=mainWindow()){
    if(!isAlive(main))return false;
    try{main.webContents?.setBackgroundThrottling?.(false);}catch{}
    try{if(main.isMinimized?.())main.restore();}catch{}
    // During active share the meeting renderer is deliberately parked behind
    // the right-side video dock. Never raise it above the native presenter UI.
    if(shareActive&&!shareState.meetingVisible){
      try{main.setAlwaysOnTop(false);}catch{}
    }else{
      try{main.setAlwaysOnTop(true,'floating');}catch{try{main.setAlwaysOnTop(true);}catch{}}
    }
    try{main.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    try{main.setOpacity?.(1);}catch{}
    try{if(!main.isVisible?.())main.showInactive?.();}catch{}
    try{toolbarWindow?.moveTop?.();videoWindow?.moveTop?.();}catch{}
    return true;
  }
  function rememberCaptureOwnerWindow(main){
    if(!isAlive(main)||captureOwnerWindowState)return;
    let minimumSize=[960,640],bounds=null,opacity=1;
    try{minimumSize=main.getMinimumSize();}catch{}
    try{bounds={...main.getBounds()};}catch{}
    try{opacity=Number(main.getOpacity?.()??1)||1;}catch{}
    captureOwnerWindowState={minimumSize,bounds,opacity};
  }
  function parkCaptureOwnerBehindVideoDock(main=mainWindow()){
    if(!isAlive(main))return false;rememberCaptureOwnerWindow(main);
    // Keep the capture owner fully composited at its normal size, but move it
    // outside every attached display. Resizing it underneath the video dock was
    // starving the renderer on physical Macs and leaking a strip of meeting UI.
    try{main.webContents?.setBackgroundThrottling?.(false);}catch{}
    const saved=captureOwnerWindowState?.bounds||main.getBounds();
    const displays=screen.getAllDisplays?.()||[displayForMain()];
    const maxRight=Math.max(...displays.map(item=>Number(item?.bounds?.x||0)+Number(item?.bounds?.width||0)),Number(saved.x||0)+Number(saved.width||960));
    const minTop=Math.min(...displays.map(item=>Number(item?.workArea?.y??item?.bounds?.y??0)),Number(saved.y||0));
    const width=Math.max(960,Number(saved.width)||960),height=Math.max(640,Number(saved.height)||640);
    const x=Math.round(maxRight+96),y=Math.round(minTop+48);
    try{main.setAlwaysOnTop(false);}catch{}
    try{main.setContentProtection?.(!Boolean(shareState.includeMeetWindows));}catch{}
    try{main.setBounds({x,y,width,height},false);}catch{}
    try{main.setIgnoreMouseEvents(true,{forward:false});}catch{}
    try{main.setOpacity?.(1);}catch{}
    try{main.showInactive?.();}catch{try{main.show();}catch{}}
    try{videoWindow?.moveTop?.();toolbarWindow?.moveTop?.();}catch{}
    return true;
  }
  function restoreCaptureOwnerWindow(main=mainWindow(),{focus=false}={}){
    if(!isAlive(main))return false;const saved=captureOwnerWindowState;
    try{main.setIgnoreMouseEvents(false);}catch{}
    try{main.setContentProtection?.(Boolean(shareActive&&!shareState.includeMeetWindows));}catch{}
    if(saved?.minimumSize){try{main.setMinimumSize(...saved.minimumSize);}catch{}}
    if(saved?.bounds){try{main.setBounds(saved.bounds,false);}catch{}}
    try{main.setOpacity?.(saved?.opacity??1);}catch{}
    try{main.show();if(focus)main.focus();}catch{}
    return true;
  }
  async function boundedLoad(label,loader){
    let timer=0;
    try{return await Promise.race([Promise.resolve().then(loader),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label}_timeout`)),PREPARE_STEP_TIMEOUT_MS);})]);}
    finally{if(timer)clearTimeout(timer);}
  }
  function closeFailedWindow(win){if(!isAlive(win))return;try{win.setClosable?.(true);win.close();}catch{try{win.destroy?.();}catch{}}}
  function positionToolbar({reset=false}={}){
    if(!isAlive(toolbarWindow))return;
    const display=displayForMain(),area=display.workArea||display.bounds;
    const width=Math.min(890,Math.max(760,area.width-28)),height=toolbarMenuOpen?390:92;
    let x=Math.round(area.x+(area.width-width)/2),y=Math.round(area.y+4);
    if(toolbarUserPositioned&&!reset){
      try{const current=toolbarWindow.getBounds();x=Math.round(Math.max(area.x+4,Math.min(current.x,area.x+area.width-width-4)));y=Math.round(Math.max(area.y+4,Math.min(current.y,area.y+area.height-height-4)));}catch{}
    }
    positioningToolbar=true;try{toolbarWindow.setBounds({x,y,width,height},false);}catch{}finally{setTimeout(()=>{positioningToolbar=false;},0);}
  }
  function positionBorder(){
    if(!bordersReady())return;
    const display=displayForMain(),bounds=display.bounds;
    // One overlay owns all four edges, so the bottom corners cannot drift or
    // terminate early relative to the vertical edges.
    const win=borderWindows[0];
    try{win.setBounds({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},false);}catch{}
  }
  function showBorder(){
    if(!bordersReady())return;positionBorder();
    for(const win of borderWindows){try{win.setAlwaysOnTop(true,'screen-saver',1);}catch{try{win.setAlwaysOnTop(true);}catch{}}try{win.showInactive?.();win.moveTop?.();}catch{}}
  }
  function hideBorder(){for(const win of borderWindows){if(isAlive(win))try{win.hide();}catch{}}}
  function positionVideo(){
    if(!isAlive(videoWindow))return;
    const display=displayForMain(),area=display.workArea||display.bounds;
    let width=videoLayout==='gallery'?360:252,height=videoLayout==='gallery'?250:174;
    if(videoLayout==='speaker'){try{const current=videoWindow.getBounds();width=Math.max(190,Math.min(360,current.width||252));height=Math.max(132,Math.min(250,current.height||174));}catch{}}
    const x=Math.round(area.x+area.width-width-18),y=Math.round(area.y+78);
    try{videoWindow.setBounds({x,y,width,height},false);}catch{}
    try{videoWindow.moveTop?.();toolbarWindow?.moveTop?.();}catch{}
  }
  function setVideoLayout(mode='speaker'){
    const requested=String(mode||'speaker');
    videoLayout=requested==='show'?lastVisibleVideoLayout:(['speaker','gallery','hide'].includes(requested)?requested:'speaker');
    if(videoLayout!=='hide')lastVisibleVideoLayout=videoLayout;
    shareState={...shareState,participantVideoVisible:videoLayout!=='hide',participantVideoLayout:videoLayout==='hide'?lastVisibleVideoLayout:videoLayout};
    if(!isAlive(videoWindow)){publishState();return {ok:false,layout:videoLayout};}
    if(videoLayout==='hide'){try{videoWindow.hide();}catch{}publishState();return {ok:true,layout:videoLayout};}
    positionVideo();try{videoWindow.showInactive?.();videoWindow.moveTop?.();}catch{}publishState();return {ok:true,layout:videoLayout};
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
      width:890,height:92,minWidth:760,minHeight:92,maxHeight:390,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
      resizable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,
      focusable:true,acceptFirstMouse:true,
      webPreferences:{preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,devTools:false,backgroundThrottling:false}
    });
    toolbarWindow=win;protect(win);
    try{win.setAlwaysOnTop(true,'floating');}catch{try{win.setAlwaysOnTop(true);}catch{}}
    try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('move',()=>{if(!positioningToolbar&&isAlive(win))toolbarUserPositioned=true;});
    win.on('closed',()=>{if(toolbarWindow===win){toolbarWindow=null;toolbarReady=false;}});
    positionToolbar({reset:!toolbarUserPositioned});
    try{
      await boundedLoad('mac_presenter_toolbar_load',()=>win.loadFile(path.join(uiDir,'mac-presenter-toolbar.html')));
      if(!isAlive(win)||toolbarWindow!==win)return null;
      toolbarReady=true;publishState();
      if(shareActive&&presenterModeCommitted&&!qaKeepPresenterHidden){positionToolbar();win.showInactive?.();win.moveTop?.();}
      return win;
    }catch(error){console.error('[DominionStar Meet] macOS presenter toolbar failed to prepare.',error);closeFailedWindow(win);if(toolbarWindow===win)toolbarWindow=null;toolbarReady=false;return null;}
  }

  async function prepareBorder(){
    if(bordersReady())return borderWindows;
    for(const win of borderWindows)closeFailedWindow(win);borderWindows=[];
    const html=`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{border:${BORDER_THICKNESS}px solid ${BORDER_COLOR};pointer-events:none}</style>`;
    const url=`data:text/html;charset=utf-8,${encodeURIComponent(html)}`;let win=null;
    try{
      win=new BrowserWindow({width:2,height:2,show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,movable:false,fullscreenable:false,minimizable:false,maximizable:false,closable:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false}});
      borderWindows=[win];protect(win);try{win.setIgnoreMouseEvents(true,{forward:true});}catch{}
      try{win.setAlwaysOnTop(true,'screen-saver',1);}catch{try{win.setAlwaysOnTop(true);}catch{}}
      try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
      win.on('closed',()=>{borderWindows=borderWindows.filter(candidate=>candidate!==win);});
      await boundedLoad('mac_share_border_overlay_load',()=>win.loadURL(url));
      if(!bordersReady())throw new Error('mac_share_border_overlay_incomplete');positionBorder();return borderWindows;
    }catch(error){console.error('[DominionStar Meet] share border failed to prepare.',error);if(win)closeFailedWindow(win);borderWindows=[];return null;}
  }

  async function prepareVideo(){
    if(isAlive(videoWindow))return videoWindow;
    const win=new BrowserWindow({width:252,height:174,minWidth:190,minHeight:132,maxWidth:360,maxHeight:250,show:false,frame:false,transparent:false,backgroundColor:'#111111',resizable:true,movable:true,fullscreenable:false,minimizable:false,maximizable:false,closable:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:true,acceptFirstMouse:true,webPreferences:{preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false,devTools:false,backgroundThrottling:false}});
    videoWindow=win;protect(win);try{win.setAlwaysOnTop(true,'floating');}catch{try{win.setAlwaysOnTop(true);}catch{}}
    try{win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{}
    win.on('closed',()=>{if(videoWindow===win)videoWindow=null;});positionVideo();
    try{await boundedLoad('mac_share_video_load',()=>win.loadFile(path.join(uiDir,'mac-share-video.html')));if(!isAlive(win)||videoWindow!==win)return null;publishState();if(shareActive&&presenterModeCommitted&&!qaKeepPresenterHidden&&videoLayout!=='hide'){positionVideo();win.showInactive?.();win.moveTop?.();}return win;}
    catch(error){console.error('[DominionStar Meet] macOS presenter video dock failed to prepare.',error);closeFailedWindow(win);if(videoWindow===win)videoWindow=null;return null;}
  }

  async function prepare(){
    if(preparing)return preparing;
    preparing=(async()=>{await prepareToolbar();await Promise.allSettled([prepareBorder(),prepareVideo()]);const ok=Boolean(toolbarReady&&isAlive(toolbarWindow)&&bordersReady()&&isAlive(videoWindow));return {ok,toolbarReady,prepared:ok};})()
      .catch(error=>{console.error('[DominionStar Meet] macOS presenter preparation failed.',error);return {ok:false,toolbarReady:false,prepared:false,error:String(error?.message||error||'presenter_prepare_failed')};})
      .finally(()=>{preparing=null;});return preparing;
  }
  function showMeeting(){
    const main=mainWindow();if(!isAlive(main))return false;wakeMain(main);restoreCaptureOwnerWindow(main,{focus:true});
    try{main.webContents.send('mac-share:show-meeting');}catch{}
    shareState={...shareState,meetingVisible:true};publishState();return true;
  }
  function hideMeeting(){
    const main=mainWindow();if(!isAlive(main))return false;
    if(shareState.includeMeetWindows){shareState={...shareState,meetingVisible:true};publishState();return true;}
    shareState={...shareState,meetingVisible:false};
    parkCaptureOwnerBehindVideoDock(main);
    publishState();try{toolbarWindow?.moveTop?.();videoWindow?.moveTop?.();}catch{}return true;
  }
  function showCompanionWindow(kind='chat'){
    if(!shareActive)return false;
    const main=captureOwnerWindow();if(!isAlive(main))return false;rememberCaptureOwnerWindow(main);
    const base=captureOwnerWindowState?.bounds||main.getBounds(),annotation=String(kind)==='annotate';
    const width=annotation?Math.min(960,Math.max(720,base.width-120)):410;
    const height=annotation?Math.min(660,Math.max(500,base.height-120)):Math.min(620,Math.max(500,base.height-100));
    const display=displayForMain(),area=display.workArea||display.bounds;
    const x=annotation?Math.round(area.x+(area.width-width)/2):Math.round(area.x+area.width-width-18);
    const y=annotation?Math.round(area.y+(area.height-height)/2):Math.round(area.y+104);
    try{main.setIgnoreMouseEvents(false);}catch{}
    try{main.setContentProtection?.(!Boolean(shareState.includeMeetWindows));}catch{}
    try{main.setMinimumSize(annotation?640:330,annotation?460:420);}catch{}
    try{main.setBounds({x,y,width,height},false);}catch{}
    try{main.setAlwaysOnTop(true,'floating');}catch{try{main.setAlwaysOnTop(true);}catch{}}
    try{main.show();main.focus();}catch{}
    shareState={...shareState,meetingVisible:true,companion:String(kind||'')};publishState();
    try{toolbarWindow?.moveTop?.();videoWindow?.moveTop?.();}catch{}
    return true;
  }
  function hideCompanionWindow(){
    if(!shareActive)return false;
    const main=captureOwnerWindow();if(!isAlive(main))return false;
    shareState={...shareState,companion:'',meetingVisible:Boolean(shareState.includeMeetWindows)};
    if(!shareState.includeMeetWindows)parkCaptureOwnerBehindVideoDock(main);
    publishState();return true;
  }

  function showOverlays(){
    if(!shareActive)return;
    void prepare().then(()=>{
      if(!shareActive)return;positionToolbar();positionBorder();positionVideo();publishState();
      if(qaKeepPresenterHidden){if(qaPresenterTrace)console.error('QA_MAC_PRESENTER_PREPARED_HIDDEN');hideOverlays();return;}
      if(toolbarReady&&isAlive(toolbarWindow)){toolbarWindow.showInactive?.();toolbarWindow.moveTop?.();}
      if(isAlive(videoWindow)&&videoLayout!=='hide'){videoWindow.showInactive?.();videoWindow.moveTop?.();}
      if(isDisplayShare()&&shareState.showGreenBorder!==false)showBorder();else hideBorder();
    });
  }
  function hideOverlays(){toolbarMenuOpen=false;if(isAlive(toolbarWindow)){try{toolbarWindow.setBounds({...toolbarWindow.getBounds(),height:92},false);}catch{}toolbarWindow.hide();}if(isAlive(videoWindow))videoWindow.hide();hideBorder();}
  function resetSharePresentation(reason='capture-stopped'){
    const owner=captureOwnerWindow();
    // Leave presenter mode first, then restore the meeting. Restoring while
    // shareActive/meetingVisible still describe presenter mode can leave the
    // main window parked behind other desktop windows.
    shareActive=false;presenterModeCommitted=false;videoLayout='speaker';lastVisibleVideoLayout='speaker';toolbarUserPositioned=false;shareState={paused:false,micOn:false,cameraOn:true,sourceName:'',shareAudio:false,optimizeVideo:false,showGreenBorder:true,includeMeetWindows:false,handRaised:false,recording:false,recordingPaused:false,meetingVisible:true};hideOverlays();
    if(isAlive(owner)){
      restoreCaptureOwnerWindow(owner,{focus:false});
      try{owner.setAlwaysOnTop(false);}catch{}
      try{owner.setVisibleOnAllWorkspaces(false);}catch{}
      try{owner.show();owner.moveTop?.();owner.focus();}catch{}
      try{owner.webContents.send('mac-share:show-meeting');}catch{}
      if(qaPresenterTrace)console.error(`QA_MAC_MEETING_RESTORED visible=${owner.isVisible?.()?1:0} focused=${owner.isFocused?.()?1:0}`);
    }
    // share-service owns a second copy of the saved main-window geometry from
    // the preshare park. Force that authority to restore too, including when
    // Stop Share had to use the native fallback instead of renderer stop().
    try{ipcMain.emit('share:force-stop-chrome-main',null,String(reason||'capture-stopped'));}catch{}
    for(const [deliveryId] of [...presenterDeliveries])settlePresenterDelivery(deliveryId,{ok:false,sent:false,acknowledged:false,error:String(reason||'capture-stopped'),deliveryId});
    presenterCommandQueue.splice(0,presenterCommandQueue.length);
    captureOwnerWebContents=null;captureOwnerWindowState=null;
    if(qaPresenterTrace)console.error(`QA_MAC_PRESENTER_RESET reason=${String(reason||'capture-stopped')}`);
    return {ok:true,recovered:true,reason:String(reason||'capture-stopped')};
  }

  async function presenterRendererResponsive(main=captureOwnerWindow(),timeoutMs=1000){
    if(!isAlive(main)||main.webContents?.isDestroyed?.())return false;
    try{
      const probe=main.webContents.executeJavaScript(`Boolean(window.__DominionPresenterDispatch&&window.DominionShareIntegration&&window.DominionMediaController&&window.DominionShareController)`,true);
      return Boolean(await Promise.race([probe,new Promise(resolve=>setTimeout(()=>resolve(false),Math.max(300,Number(timeoutMs)||1000)))]));
    }catch{return false;}
  }

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
  async function executePresenterCommandDirect(main,command,timeoutMs=900){
    if(!isAlive(main)||main.webContents?.isDestroyed?.())return {ok:false,handled:false,error:'meeting_renderer_unavailable',direct:true};
    wakeMain(main);
    try{
      const payload=JSON.stringify(String(command||'')).replace(/</g,'\\u003c');
      const directPromise=main.webContents.executeJavaScript(`(async()=>{const api=window.DominionShareIntegration;const fn=api?.dispatchPresenterCommand||window.__DominionPresenterDispatch;if(typeof fn!=='function')return {handled:false,error:'presenter_dispatcher_missing'};return await fn(${payload});})()`,true);
      const result=await Promise.race([directPromise,new Promise(resolve=>setTimeout(()=>resolve({handled:false,error:'presenter_direct_timeout'}),timeoutMs))]);
      return {ok:Boolean(result?.handled),handled:Boolean(result?.handled),error:result?.handled?'':String(result?.error||'presenter_direct_rejected'),direct:true};
    }catch(error){return {ok:false,handled:false,error:String(error?.message||error||'presenter_direct_failed'),direct:true};}
  }
  async function deliverPresenterCommandWithRetry(main,command){
    wakeMain(main);let result=await deliverPresenterCommand(main,command);if(result?.ok)return result;
    await wait(120);wakeMain(main);result=await deliverPresenterCommand(main,command);return result;
  }

  ipcMain.handle('mac-share:prepare',()=>prepare());
  ipcMain.on('mac-share:presenter-command-fast',(event,{command}={})=>{
    const normalized=String(command||'').replace(/^toolbar:/,'');
    const fromToolbar=Boolean(isAlive(toolbarWindow)&&event.sender===toolbarWindow.webContents);
    if(qaPresenterTrace)console.error(`QA_MAC_TOOLBAR_RECEIVE command=${normalized} accepted=${fromToolbar?1:0}`);
    if(!fromToolbar)return;
    if(normalized==='show-meeting'){if(shareState.meetingVisible)hideMeeting();else showMeeting();return;}
    if(normalized==='layout-hide'){setVideoLayout('hide');return;}
    if(normalized==='layout-show'){setVideoLayout('show');return;}
    if(normalized==='layout-speaker'){setVideoLayout('speaker');return;}
    if(normalized==='layout-gallery'){setVideoLayout('gallery');return;}
    const main=mainWindow();
    if(!isAlive(main)){
      if(normalized==='stop')resetSharePresentation('meeting-renderer-unavailable-fast');
      return;
    }
    wakeMain(main);
    // Do not make the floating toolbar wait on cross-renderer work. Enqueue the
    // command through the acknowledged presenter transport and let the capture
    // renderer receive it by either channel: immediate webContents.send *or*
    // its existing 80ms pull loop. Both carry the same deliveryId, so the
    // preload de-duplicates them if both arrive.
    if(qaPresenterTrace)console.error(`QA_MAC_TOOLBAR_FORWARDED command=${normalized} target=${Number(main.webContents?.id||0)||0}`);
    void deliverPresenterCommand(main,normalized).then(async result=>{
      if(qaPresenterTrace)console.error(`QA_MAC_TOOLBAR_SETTLED command=${normalized} ok=${result?.ok?1:0} acknowledged=${result?.acknowledged?1:0} error=${String(result?.error||'')}`);
      if(result?.ok)return;
      // Stop Share is fail-safe: if both push and pull delivery fail, expose the
      // canonical meeting surface and make one bounded direct local attempt.
      if(normalized==='stop'){
        showMeeting();
        const direct=await executePresenterCommandDirect(main,'stop',1200);
        if(qaPresenterTrace)console.error(`QA_MAC_TOOLBAR_STOP_FALLBACK ok=${direct?.ok?1:0} error=${String(direct?.error||'')}`);
        if(!direct?.ok)resetSharePresentation('fast-stop-delivery-failed');
      }
    }).catch(error=>{
      console.error('[DominionStar Meet] Fast presenter command failed.',error);
      if(normalized==='stop')resetSharePresentation('fast-presenter-send-failed');
    });
  });
  ipcMain.on('mac-share:presenter-next-command-sync',(event)=>{
    const owner=captureOwnerWebContents;
    if(!owner||owner.isDestroyed?.()||event.sender!==owner){event.returnValue=null;return;}
    const next=presenterCommandQueue.shift()||null;
    if(next&&qaPresenterTrace)console.error(`QA_MAC_PRESENTER_PULL delivery=${Number(next.deliveryId||0)||0} command=${String(next.command||'')} queue=${presenterCommandQueue.length} transport=sync`);
    event.returnValue=next?{...next}:null;
  });
  ipcMain.handle('mac-share:presenter-next-command',(event)=>{const owner=captureOwnerWebContents;if(!owner||owner.isDestroyed?.()||event.sender!==owner)return null;const next=presenterCommandQueue.shift()||null;if(next&&qaPresenterTrace)console.error(`QA_MAC_PRESENTER_PULL delivery=${Number(next.deliveryId||0)||0} command=${String(next.command||'')} queue=${presenterCommandQueue.length} transport=invoke`);return next?{...next}:null;});
  ipcMain.on('share:capture-started',(_event,state={})=>{
    captureOwnerWebContents=_event.sender;const owner=captureOwnerWindow();if(isAlive(owner))rememberCaptureOwnerWindow(owner);
    // Phase 1: capture is live, but the chooser/main meeting has not yet been
    // parked. Prepare presenter windows hidden while the renderer stays fully
    // interactive and finishes the source-selection transaction.
    shareActive=true;presenterModeCommitted=false;shareState={...shareState,...state,meetingVisible:true};wakeMain(owner);void prepare();publishState();
  });
  ipcMain.on('share:presenter-committed',async(event,state={})=>{
    if(!shareActive||event.sender!==captureOwnerWebContents||presenterModeCommitted)return;
    const owner=captureOwnerWindow();if(!isAlive(owner))return;
    shareState={...shareState,...state};presenterModeCommitted=true;
    if(!shareState.includeMeetWindows)hideMeeting();
    const responsive=await presenterRendererResponsive(owner,1100);
    if(!responsive){
      // Never expose a decorative/dead toolbar. Restore the meeting and stop
      // the share if parking made the capture owner unresponsive.
      presenterModeCommitted=false;restoreCaptureOwnerWindow(owner,{focus:false});shareState={...shareState,meetingVisible:true};publishState();await wait(160);
      const stopped=await executePresenterCommandDirect(owner,'stop',1300);
      if(!stopped?.ok)resetSharePresentation('presenter-renderer-unresponsive');
      return;
    }
    showOverlays();publishState();
  });
  ipcMain.on('mac-share:state',(event,state={})=>{
    if(!shareActive||event.sender!==captureOwnerWebContents)return;
    const priorCompanion=String(shareState.companion||'');
    shareState={...shareState,...state};
    const nextCompanion=String(shareState.companion||'');
    if(presenterModeCommitted&&nextCompanion&&nextCompanion!==priorCompanion)showCompanionWindow(nextCompanion);
    else if(presenterModeCommitted&&priorCompanion&&!nextCompanion)hideCompanionWindow();
    else publishState();
    if(!presenterModeCommitted||qaKeepPresenterHidden){hideBorder();return;}
    if(isDisplayShare()&&shareState.showGreenBorder!==false)showBorder();else hideBorder();
  });
  ipcMain.on('mac-share:capture-stopped',(event)=>{if(captureOwnerWebContents&&event.sender!==captureOwnerWebContents)return;resetSharePresentation('capture-stopped');});
  ipcMain.on('share:presenter-delivery-ack',(event,payload={})=>{
    const deliveryId=Number(payload?.deliveryId||0)||0;if(!deliveryId)return;const owner=captureOwnerWebContents;if(!owner||owner.isDestroyed?.()||event.sender!==owner)return;removeQueuedPresenterDelivery(deliveryId);
    if(qaPresenterTrace)console.error(`QA_MAC_PRESENTER_ACK delivery=${deliveryId} command=${String(payload?.command||'')} accepted=${payload?.accepted?1:0}`);
    settlePresenterDelivery(deliveryId,{ok:Boolean(payload?.accepted),sent:true,acknowledged:true,deliveryId,error:payload?.accepted?'':String(payload?.error||'presenter_command_rejected')});
  });

  ipcMain.handle('mac-share:presenter-command',async(_event,{command}={})=>{
    const normalized=String(command||'').replace(/^toolbar:/,'');let main=mainWindow();
    // Stop Share must be fail-safe even if the meeting renderer disappeared.
    // A destroyed capture renderer no longer owns a live display track, so
    // leaving the native toolbar/border visible would falsely indicate sharing.
    if(!isAlive(main)){
      if(normalized==='stop')return {...resetSharePresentation('meeting-renderer-unavailable'),sent:false,acknowledged:false};
      return {ok:false,sent:false,acknowledged:false,error:'meeting_window_unavailable'};
    }
    if(normalized==='show-meeting'){if(shareState.meetingVisible)hideMeeting();else showMeeting();return {ok:true,sent:true,acknowledged:true};}
    if(normalized==='layout-hide')return {...setVideoLayout('hide'),sent:true,acknowledged:true};
    if(normalized==='layout-show')return {...setVideoLayout('show'),sent:true,acknowledged:true};
    if(normalized==='layout-speaker')return {...setVideoLayout('speaker'),sent:true,acknowledged:true};
    if(normalized==='layout-gallery')return {...setVideoLayout('gallery'),sent:true,acknowledged:true};

    // Physical-Mac authority: execute the command in the capture-owning
    // renderer directly first. The preload acknowledgement queue remains a
    // second, independent transport rather than the only route.
    let result=await executePresenterCommandDirect(main,normalized,normalized==='stop'?1200:900);
    if(result?.ok){
      if(['participants','chat','annotate'].includes(normalized))showCompanionWindow(normalized);
      return {...result,sent:true,acknowledged:true};
    }

    if(['participants','chat','annotate'].includes(normalized))showCompanionWindow(normalized);
    const acknowledged=await deliverPresenterCommandWithRetry(main,normalized);
    if(acknowledged?.ok)return acknowledged;

    if(normalized==='stop'){
      // Last bounded recovery: restore the meeting surface and retry both
      // transports. Stop itself remains local-first in ShareController, so a
      // successful direct call terminates the display track immediately.
      showMeeting();await wait(180);main=mainWindow();
      if(!isAlive(main))return {...resetSharePresentation('meeting-renderer-lost-during-stop'),sent:false,acknowledged:false};
      result=await executePresenterCommandDirect(main,normalized,1400);
      if(result?.ok)return {...result,sent:true,acknowledged:true,recovered:true};
      const retry=await deliverPresenterCommandWithRetry(main,normalized);
      if(retry?.ok)return {...retry,recovered:true};
      if(!isAlive(mainWindow()))return {...resetSharePresentation('meeting-renderer-lost-after-stop-retry'),sent:false,acknowledged:false};
      return {ok:false,sent:Boolean(retry?.sent),acknowledged:Boolean(retry?.acknowledged),error:String(retry?.error||result?.error||'stop_share_delivery_failed')};
    }
    return {ok:false,sent:Boolean(acknowledged?.sent),acknowledged:Boolean(acknowledged?.acknowledged),error:String(acknowledged?.error||result?.error||'presenter_command_delivery_failed')};
  });
  ipcMain.handle('mac-share:menu-state',(_event,{open=false}={})=>{toolbarMenuOpen=Boolean(open);positionToolbar();return {ok:true,height:toolbarMenuOpen?390:92};});
  ipcMain.handle('mac-share:show-meeting',()=>({ok:shareState.meetingVisible?hideMeeting():showMeeting()}));

  screen.on('display-metrics-changed',()=>{if(shareActive){positionToolbar();positionBorder();positionVideo();}});
  app.on('before-quit',()=>{
    shareActive=false;hideOverlays();presenterCommandQueue.length=0;
    for(const [deliveryId,pending] of presenterDeliveries){clearTimeout(pending.timer);pending.resolve({ok:false,sent:false,acknowledged:false,error:'app_quitting',deliveryId});}
    presenterDeliveries.clear();for(const win of [toolbarWindow,...borderWindows,videoWindow]){if(isAlive(win)){try{win.setClosable?.(true);win.close();}catch{}}}borderWindows=[];
  });

  globalThis.__dominionMacSharePresenterOverlay=Object.freeze({showMeeting,hideMeeting,showOverlays,hideOverlays,prepare,state:()=>({shareActive,prepared:Boolean(toolbarReady&&isAlive(toolbarWindow)&&bordersReady()&&isAlive(videoWindow)),videoLayout,shareState:{...shareState}})});
}