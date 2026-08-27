const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,payload)=>ipcRenderer.invoke(channel,payload);
const listen=(channel,callback)=>{if(typeof callback!=='function')return()=>{};const handler=(_event,payload)=>callback(payload);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
contextBridge.exposeInMainWorld('dominionDesktop',Object.freeze({
  isDesktop:true,
  environment:()=>invoke('app:get-environment'),
  auth:Object.freeze({
    getState:()=>invoke('auth:get-state'),startGoogle:()=>invoke('auth:start-google'),signOut:()=>invoke('auth:sign-out'),
    onChanged:callback=>listen('auth:changed',callback),onError:callback=>listen('auth:error',callback)
  }),
  meeting:Object.freeze({
    create:input=>invoke('meeting:create',input),requestJoin:input=>invoke('meeting:request-join',input),
    joinStatus:(participantId,joinToken)=>invoke('meeting:join-status',{participantId,joinToken}),markJoined:(participantId,joinToken)=>invoke('meeting:mark-joined',{participantId,joinToken}),
    leave:(participantId,joinToken)=>invoke('meeting:leave',{participantId,joinToken}),hostQueue:roomId=>invoke('meeting:host-queue',{roomId}),decide:(participantId,decision)=>invoke('meeting:decide',{participantId,decision}),
    snapshot:roomId=>invoke('meeting:snapshot',{roomId}),setCohost:(participantId,enabled)=>invoke('meeting:set-cohost',{participantId,enabled}),removeParticipant:participantId=>invoke('meeting:remove-participant',{participantId}),end:roomId=>invoke('meeting:end',{roomId})
  }),
  share:Object.freeze({
    openPicker:()=>invoke('share:open-picker'),
    onSourceSelected:callback=>listen('share:source-selected',callback),
    captureStarted:state=>invoke('share:capture-started',state),captureState:state=>invoke('share:capture-state',state),captureStopped:()=>invoke('share:capture-stopped'),
    onPresenterCommand:callback=>listen('share:presenter-command',callback)
  }),
  sharePicker:Object.freeze({
    listSources:options=>invoke('share:list-sources',options),choose:(sourceId,options)=>invoke('share:select-source',{sourceId,options}),cancel:()=>invoke('share:cancel-picker')
  }),
  presenter:Object.freeze({command:command=>invoke('share:presenter-command',command),onState:callback=>listen('share:toolbar-state',callback)})
}));
