const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,payload)=>ipcRenderer.invoke(channel,payload);
const listen=(channel,callback)=>{if(typeof callback!=='function')return()=>{};const handler=(_event,payload)=>callback(payload);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
const presenterCommandCallbacks=new Set();
let presenterListenerGeneration=0;
let presenterPollTimer=null;
let presenterPollBusy=false;
const presenterDeliveryTasks=new Map();

const runPresenterPayload=payload=>{
  const command=String(payload?.command||payload||'');
  const qaCommandId=Number(payload?.qaCommandId||0)||0;
  const deliveryId=Number(payload?.deliveryId||0)||0;
  if(deliveryId>0&&presenterDeliveryTasks.has(deliveryId))return presenterDeliveryTasks.get(deliveryId);
  const task=(async()=>{
    if(qaCommandId>0){
      console.error(`QA_PRESENTER_PRELOAD_RECEIVED id=${qaCommandId} command=${command} generation=${presenterListenerGeneration}`);
      ipcRenderer.send('share:presenter-preload-tap',{qaCommandId,command,generation:presenterListenerGeneration});
    }
    if(!presenterCommandCallbacks.size)return {accepted:false,error:'presenter_listener_unavailable',command,qaCommandId,deliveryId};
    let lastError='presenter_command_rejected';
    for(const callback of [...presenterCommandCallbacks]){
      try{
        const result=await Promise.resolve(callback(payload));
        const accepted=result?.handled!==false;
        if(accepted)return {accepted:true,error:'',command,qaCommandId,deliveryId};
        lastError=String(result?.error||lastError);
      }catch(error){
        console.error('[DominionStar Meet] Presenter command callback failed.',error);
        lastError=String(error?.message||error||'presenter_callback_failed');
      }
    }
    return {accepted:false,error:lastError,command,qaCommandId,deliveryId};
  })();
  if(deliveryId>0){
    presenterDeliveryTasks.set(deliveryId,task);
    void task.finally(()=>setTimeout(()=>presenterDeliveryTasks.delete(deliveryId),4000));
  }
  return task;
};

const handlePresenterPayload=async(payload,source='push')=>{
  const command=String(payload?.command||payload||'');
  const qaCommandId=Number(payload?.qaCommandId||0)||0;
  const deliveryId=Number(payload?.deliveryId||0)||0;
  const qaTrace=process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';
  if(qaTrace&&deliveryId>0)console.error(`QA_PRESENTER_PRELOAD_DELIVERY source=${source} delivery=${deliveryId} command=${command} generation=${presenterListenerGeneration} listeners=${presenterCommandCallbacks.size}`);
  if(qaTrace&&payload?.fast)console.error(`QA_PRESENTER_PRELOAD_FAST_RECEIVE source=${source} command=${command} generation=${presenterListenerGeneration} listeners=${presenterCommandCallbacks.size}`);
  const result=await runPresenterPayload(payload);
  if(qaTrace&&payload?.fast)console.error(`QA_PRESENTER_PRELOAD_FAST_RESULT command=${command} accepted=${result?.accepted?1:0} error=${String(result?.error||'')}`);
  if(deliveryId>0)ipcRenderer.send('share:presenter-delivery-ack',{deliveryId,command,generation:presenterListenerGeneration,accepted:Boolean(result?.accepted),error:result?.accepted?'':String(result?.error||'presenter_command_rejected')});
  if(qaCommandId>0)ipcRenderer.send('share:presenter-preload-ack',{qaCommandId,command,generation:presenterListenerGeneration});
  return result;
};

ipcRenderer.on('share:presenter-command',(_event,payload)=>{void handlePresenterPayload(payload,'push');});

const pollPresenterCommand=async()=>{
  if(process.platform!=='darwin'||presenterPollBusy||presenterCommandCallbacks.size===0)return;
  presenterPollBusy=true;
  try{
    // Physical macOS can stop accepting main->renderer IPC while the capture
    // owner is parked under the native presenter surfaces even though its JS
    // event loop and renderer->main IPC remain alive. Pull synchronously from
    // the renderer so command delivery is initiated by the capture owner.
    let payload=null;
    try{payload=ipcRenderer.sendSync('mac-share:presenter-next-command-sync')||null;}catch{}
    if(payload)await handlePresenterPayload(payload,'pull-sync');
  }finally{presenterPollBusy=false;}
};
const ensurePresenterPoll=()=>{
  if(process.platform!=='darwin'||presenterPollTimer)return;
  presenterPollTimer=setInterval(()=>{void pollPresenterCommand();},80);
};
const stopPresenterPoll=()=>{if(presenterPollTimer){clearInterval(presenterPollTimer);presenterPollTimer=null;}presenterPollBusy=false;};

const listenPresenterCommand=callback=>{
  if(typeof callback!=='function')return()=>{};
  presenterCommandCallbacks.add(callback);
  const generation=++presenterListenerGeneration;
  ipcRenderer.send('share:presenter-listener-ready',{href:String(location?.href||''),generation,listenerCount:presenterCommandCallbacks.size});
  ensurePresenterPoll();
  return()=>{presenterCommandCallbacks.delete(callback);if(!presenterCommandCallbacks.size)stopPresenterPoll();};
};
const packaged=String(location?.href||'').includes('/app.asar/');
const logoUrl=new URL(packaged?'../../branding/dominionstar-logo.jpeg':'../../assets/logo.jpeg',location.href).href;
if(process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1'&&!String(location?.href||'').includes('presenter-toolbar.html')){
  [1000,2000,3000,5000,7000].forEach((delay,index)=>setTimeout(()=>{
    console.error(`QA_MAIN_PRELOAD_PULSE index=${index+1} delay=${delay} generation=${presenterListenerGeneration}`);
    ipcRenderer.send('share:qa-renderer-pulse',{index:index+1,delay,generation:presenterListenerGeneration,href:String(location?.href||'')});
  },delay));
}
const prepareMacPresenter=()=>process.platform==='darwin'?invoke('mac-share:prepare').catch(()=>({ok:false})):Promise.resolve({ok:true});
contextBridge.exposeInMainWorld('dominionDesktop',Object.freeze({
  isDesktop:true,
  environment:()=>invoke('app:get-environment'),
  app:Object.freeze({relaunch:()=>invoke('app:relaunch'),privacyIdentity:()=>invoke('app:privacy-identity'),resetScreenPermission:()=>invoke('app:reset-screen-permission')}),
  brand:Object.freeze({logoUrl}),
  power:Object.freeze({onChanged:callback=>listen('app:power-event',callback)}),
  joinLinks:Object.freeze({consume:()=>invoke('app:consume-join-url'),onOpen:callback=>listen('app:join-url',callback)}),
  auth:Object.freeze({
    getState:()=>invoke('auth:get-state'),startGoogle:()=>invoke('auth:start-google'),signInPassword:(email,password)=>invoke('auth:sign-in-password',{email,password}),updateAvatar:dataUrl=>invoke('auth:update-avatar',{dataUrl}),signOut:()=>invoke('auth:sign-out'),
    onChanged:callback=>listen('auth:changed',callback),onError:callback=>listen('auth:error',callback)
  }),
  notifications:Object.freeze({showMeeting:(title,body)=>invoke('notifications:meeting',{title,body}),setWaitingCount:(count,attention=false)=>invoke('notifications:set-waiting-count',{count,attention})}),
  media:Object.freeze({
    permissions:()=>invoke('media:get-permissions'),request:kinds=>invoke('media:request-permissions',{kinds:Array.isArray(kinds)?kinds:[]}),requestScreen:()=>invoke('media:request-screen'),openPrivacy:kind=>invoke('media:open-privacy',{kind})
  }),
  meeting:Object.freeze({
    create:input=>invoke('meeting:create',input),
    personalRoom:()=>invoke('meeting:personal-room'),updatePersonalRoom:input=>invoke('meeting:update-personal-room',input),startPersonalRoom:()=>invoke('meeting:start-personal-room'),startHostRoom:roomId=>invoke('meeting:start-host-room',{roomId}),
    schedule:input=>invoke('meeting:schedule',input),listSchedules:()=>invoke('meeting:list-schedules'),cancelSchedule:scheduleId=>invoke('meeting:cancel-schedule',{scheduleId}),startSchedule:scheduleId=>invoke('meeting:start-schedule',{scheduleId}),updateRoomPasscode:(roomId,passcode)=>invoke('meeting:update-room-passcode',{roomId,passcode}),
    requestJoin:input=>invoke('meeting:request-join',input),joinStatus:(participantId,joinToken)=>invoke('meeting:join-status',{participantId,joinToken}),markJoined:(participantId,joinToken)=>invoke('meeting:mark-joined',{participantId,joinToken}),
    leave:(participantId,joinToken)=>invoke('meeting:leave',{participantId,joinToken}),hostQueue:roomId=>invoke('meeting:host-queue',{roomId}),decide:(participantId,decision)=>invoke('meeting:decide',{participantId,decision}),
    snapshot:roomId=>invoke('meeting:snapshot',{roomId}),touchPresence:(participantId,joinToken)=>invoke('meeting:touch-presence',{participantId,joinToken}),setCohost:(participantId,enabled)=>invoke('meeting:set-cohost',{participantId,enabled}),removeParticipant:participantId=>invoke('meeting:remove-participant',{participantId}),renameParticipant:(participantId,displayName)=>invoke('meeting:rename-participant',{participantId,displayName}),setRecordingPermission:(participantId,enabled)=>invoke('meeting:set-recording-permission',{participantId,enabled}),setRecordingState:(participantId,active,paused=false)=>invoke('meeting:set-recording-state',{participantId,active,paused}),setSecurity:(roomId,options)=>invoke('meeting:set-security',{roomId,options}),setChatPolicy:(roomId,policy)=>invoke('meeting:set-chat-policy',{roomId,policy}),setCaptionState:(roomId,options)=>invoke('meeting:set-caption-state',{roomId,options}),publishCaption:(participantId,text,speakerName)=>invoke('meeting:publish-caption',{participantId,text,speakerName}),transcript:roomId=>invoke('meeting:get-transcript',{roomId}),transferHostAndLeave:participantId=>invoke('meeting:transfer-host-and-leave',{participantId}),end:roomId=>invoke('meeting:end',{roomId}),
    context:()=>invoke('meeting:context'),sendSignal:(toParticipantId,type,payload)=>invoke('meeting:signal-send',{toParticipantId,type,payload}),pullSignals:(afterId=0,limit=100)=>invoke('meeting:signal-pull',{afterId,limit}),pruneSignals:roomId=>invoke('meeting:signal-prune',{roomId}),
    iceConfig:(force=false,ttl=7200)=>invoke('meeting:ice-config',{force:Boolean(force),ttl:Number(ttl)||7200})
  }),
  share:Object.freeze({
    openPicker:async permission=>{await prepareMacPresenter();return invoke('share:open-picker',{permission:String(permission||'unknown')});},probeAccess:()=>invoke('share:probe-access'),onSourceSelected:callback=>listen('share:source-selected',callback),
    captureStarted:state=>{ipcRenderer.send('share:capture-started',state||{});return true;},
    captureState:state=>{if(process.platform==='darwin'){ipcRenderer.send('mac-share:state',state||{});return true;}return invoke('share:capture-state',state);},
    presenterCommitted:state=>{ipcRenderer.send('share:presenter-committed',state||{});return true;},
    captureStopped:()=>{if(process.platform==='darwin')ipcRenderer.send('mac-share:capture-stopped');return invoke('share:capture-stopped');},
    onPresenterCommand:callback=>listenPresenterCommand(callback)
  }),
  sharePicker:Object.freeze({
    listSources:async options=>{await prepareMacPresenter();return invoke('share:list-sources',options);},
    choose:(sourceId,options)=>invoke('share:select-source',{sourceId,options}),cancel:()=>invoke('share:cancel-picker')
  }),
  presenter:Object.freeze({command:command=>invoke('share:presenter-command',command),setMenuOpen:open=>invoke('share:presenter-menu-state',{open:Boolean(open)}),onState:callback=>listen('share:toolbar-state',callback)}),
  macShare:Object.freeze({
    prepare:()=>prepareMacPresenter(),
    command:command=>invoke('mac-share:presenter-command',{command:String(command||'')}),
    setMenuOpen:open=>invoke('mac-share:menu-state',{open:Boolean(open)}),
    showMeeting:()=>invoke('mac-share:show-meeting'),
    onState:callback=>listen('share:toolbar-state',callback),
    onShowMeeting:callback=>listen('mac-share:show-meeting',callback)
  })
}));