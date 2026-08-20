const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('presenterDockBridge',Object.freeze({
  onState:callback=>{
    if(typeof callback!=='function')return()=>{};
    const listener=(_event,state)=>callback(state&&typeof state==='object'?state:{});
    ipcRenderer.on('desktop:presenter-dock-state',listener);
    return()=>ipcRenderer.removeListener('desktop:presenter-dock-state',listener);
  },
  onLayout:callback=>{
    if(typeof callback!=='function')return()=>{};
    const listener=(_event,mode)=>callback(String(mode||'stack'));
    ipcRenderer.on('desktop:presenter-dock-layout',listener);
    return()=>ipcRenderer.removeListener('desktop:presenter-dock-layout',listener);
  }
}));
