const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('dominionDesktop',Object.freeze({
  isDesktop:true,
  environment:()=>ipcRenderer.invoke('app:get-environment')
}));
