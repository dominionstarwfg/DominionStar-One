const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,payload)=>ipcRenderer.invoke(channel,payload);
contextBridge.exposeInMainWorld('dominionDesktop',Object.freeze({
  isDesktop:true,
  environment:()=>invoke('app:get-environment'),
  auth:Object.freeze({
    getState:()=>invoke('auth:get-state'),startGoogle:()=>invoke('auth:start-google'),signOut:()=>invoke('auth:sign-out'),
    onChanged:callback=>{if(typeof callback!=='function')return()=>{};const handler=(_event,state)=>callback(state);ipcRenderer.on('auth:changed',handler);return()=>ipcRenderer.removeListener('auth:changed',handler);},
    onError:callback=>{if(typeof callback!=='function')return()=>{};const handler=(_event,error)=>callback(error);ipcRenderer.on('auth:error',handler);return()=>ipcRenderer.removeListener('auth:error',handler);}
  }),
  meeting:Object.freeze({
    create:input=>invoke('meeting:create',input),requestJoin:input=>invoke('meeting:request-join',input),
    joinStatus:(participantId,joinToken)=>invoke('meeting:join-status',{participantId,joinToken}),
    markJoined:(participantId,joinToken)=>invoke('meeting:mark-joined',{participantId,joinToken}),
    leave:(participantId,joinToken)=>invoke('meeting:leave',{participantId,joinToken}),
    hostQueue:roomId=>invoke('meeting:host-queue',{roomId}),decide:(participantId,decision)=>invoke('meeting:decide',{participantId,decision}),
    snapshot:roomId=>invoke('meeting:snapshot',{roomId}),end:roomId=>invoke('meeting:end',{roomId})
  })
}));
