const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('dominionDesktop',Object.freeze({
  isDesktop:true,
  environment:()=>ipcRenderer.invoke('app:get-environment'),
  auth:Object.freeze({
    getState:()=>ipcRenderer.invoke('auth:get-state'),
    startGoogle:()=>ipcRenderer.invoke('auth:start-google'),
    signOut:()=>ipcRenderer.invoke('auth:sign-out'),
    onChanged:callback=>{
      if(typeof callback!=='function')return()=>{};
      const handler=(_event,state)=>callback(state);
      ipcRenderer.on('auth:changed',handler);
      return()=>ipcRenderer.removeListener('auth:changed',handler);
    },
    onError:callback=>{
      if(typeof callback!=='function')return()=>{};
      const handler=(_event,error)=>callback(error);
      ipcRenderer.on('auth:error',handler);
      return()=>ipcRenderer.removeListener('auth:error',handler);
    }
  })
}));
