const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,payload)=>ipcRenderer.invoke(channel,payload);
const listen=(channel,callback)=>{if(typeof callback!=='function')return()=>{};const handler=(_event,payload)=>callback(payload);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
const listenPresenterCommand=callback=>{
  if(typeof callback!=='function')return()=>{};
  const handler=(_event,payload)=>{
    const command=String(payload?.command||payload||'');
    const qaCommandId=Number(payload?.qaCommandId||0)||0;
    if(qaCommandId>0){
      console.error(`QA_PRESENTER_PRELOAD_RECEIVED id=${qaCommandId} command=${command}`);
      ipcRenderer.send('share:presenter-preload-ack',{qaCommandId,command});
    }
    callback(payload);
  };
  ipcRenderer.on('share:presenter-command',handler);
  return()=>ipcRenderer.removeListener('share:presenter-command',handler);
};
const packaged=String(location?.href||'').includes('/app.asar/');
const logoUrl=new URL(packaged?'../../branding/dominionstar-logo.jpeg':'../../assets/logo.jpeg',location.href).href;
contextBridge.exposeInMainWorld('dominionDesktop',Object.freeze({
  isDesktop:true,
  environment:()=>invoke('app:get-environment'),
  app:Object.freeze({relaunch:()=>invoke('app:relaunch'),privacyIdentity:()=>invoke('app:privacy-identity'),resetScreenPermission:()=>invoke('app:reset-screen-permission')}),
  brand:Object.freeze({logoUrl}),
  power:Object.freeze({onChanged:callback=>listen('app:power-event',callback)}),
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
    openPicker:permission=>invoke('share:open-picker',{permission:String(permission||'unknown')}),probeAccess:()=>invoke('share:probe-access'),onSourceSelected:callback=>listen('share:source-selected',callback),
    captureStarted:state=>{const snapshot=state||{};ipcRenderer.send('share:capture-started',snapshot);if(String(snapshot.sourceName||'')==='QA Synthetic Share'){setTimeout(()=>console.log('QA_PRESENTER_PRELOAD_HEARTBEAT post-capture'),700);}return true;},captureState:state=>invoke('share:capture-state',state),presenterCommitted:state=>{ipcRenderer.send('share:presenter-committed',state||{});return true;},captureStopped:()=>invoke('share:capture-stopped'),onPresenterCommand:callback=>listenPresenterCommand(callback)
  }),
  sharePicker:Object.freeze({listSources:options=>invoke('share:list-sources',options),choose:(sourceId,options)=>invoke('share:select-source',{sourceId,options}),cancel:()=>invoke('share:cancel-picker')}),
  presenter:Object.freeze({command:command=>invoke('share:presenter-command',command),setMenuOpen:open=>invoke('share:presenter-menu-state',{open:Boolean(open)}),onState:callback=>listen('share:toolbar-state',callback)})
}));
