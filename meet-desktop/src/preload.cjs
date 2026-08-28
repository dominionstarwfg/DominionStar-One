const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,payload)=>ipcRenderer.invoke(channel,payload);
const listen=(channel,callback)=>{if(typeof callback!=='function')return()=>{};const handler=(_event,payload)=>callback(payload);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
const packaged=String(location?.href||'').includes('/app.asar/');
const logoUrl=new URL(packaged?'../../branding/dominionstar-logo.jpeg':'../../assets/logo.jpeg',location.href).href;
contextBridge.exposeInMainWorld('dominionDesktop',Object.freeze({
  isDesktop:true,
  environment:()=>invoke('app:get-environment'),
  brand:Object.freeze({logoUrl}),
  auth:Object.freeze({
    getState:()=>invoke('auth:get-state'),startGoogle:()=>invoke('auth:start-google'),signInPassword:(email,password)=>invoke('auth:sign-in-password',{email,password}),signOut:()=>invoke('auth:sign-out'),
    onChanged:callback=>listen('auth:changed',callback),onError:callback=>listen('auth:error',callback)
  }),
  media:Object.freeze({
    permissions:()=>invoke('media:get-permissions'),request:kinds=>invoke('media:request-permissions',{kinds:Array.isArray(kinds)?kinds:[]}),requestScreen:()=>invoke('media:request-screen'),openPrivacy:kind=>invoke('media:open-privacy',{kind})
  }),
  meeting:Object.freeze({
    create:input=>invoke('meeting:create',input),
    personalRoom:()=>invoke('meeting:personal-room'),updatePersonalRoom:input=>invoke('meeting:update-personal-room',input),startPersonalRoom:()=>invoke('meeting:start-personal-room'),startHostRoom:roomId=>invoke('meeting:start-host-room',{roomId}),
    schedule:input=>invoke('meeting:schedule',input),listSchedules:()=>invoke('meeting:list-schedules'),cancelSchedule:scheduleId=>invoke('meeting:cancel-schedule',{scheduleId}),startSchedule:scheduleId=>invoke('meeting:start-schedule',{scheduleId}),updateRoomPasscode:(roomId,passcode)=>invoke('meeting:update-room-passcode',{roomId,passcode}),
    requestJoin:input=>invoke('meeting:request-join',input),joinStatus:(participantId,joinToken)=>invoke('meeting:join-status',{participantId,joinToken}),markJoined:(participantId,joinToken)=>invoke('meeting:mark-joined',{participantId,joinToken}),
    leave:(participantId,joinToken)=>invoke('meeting:leave',{participantId,joinToken}),hostQueue:roomId=>invoke('meeting:host-queue',{roomId}),decide:(participantId,decision)=>invoke('meeting:decide',{participantId,decision}),
    snapshot:roomId=>invoke('meeting:snapshot',{roomId}),setCohost:(participantId,enabled)=>invoke('meeting:set-cohost',{participantId,enabled}),removeParticipant:participantId=>invoke('meeting:remove-participant',{participantId}),end:roomId=>invoke('meeting:end',{roomId}),
    context:()=>invoke('meeting:context'),sendSignal:(toParticipantId,type,payload)=>invoke('meeting:signal-send',{toParticipantId,type,payload}),pullSignals:(afterId=0,limit=100)=>invoke('meeting:signal-pull',{afterId,limit}),pruneSignals:roomId=>invoke('meeting:signal-prune',{roomId}),
    iceConfig:(force=false,ttl=7200)=>invoke('meeting:ice-config',{force:Boolean(force),ttl:Number(ttl)||7200})
  }),
  share:Object.freeze({
    openPicker:()=>invoke('share:open-picker'),onSourceSelected:callback=>listen('share:source-selected',callback),
    captureStarted:state=>invoke('share:capture-started',state),captureState:state=>invoke('share:capture-state',state),captureStopped:()=>invoke('share:capture-stopped'),onPresenterCommand:callback=>listen('share:presenter-command',callback)
  }),
  sharePicker:Object.freeze({listSources:options=>invoke('share:list-sources',options),choose:(sourceId,options)=>invoke('share:select-source',{sourceId,options}),cancel:()=>invoke('share:cancel-picker')}),
  presenter:Object.freeze({command:command=>invoke('share:presenter-command',command),onState:callback=>listen('share:toolbar-state',callback)})
}));
