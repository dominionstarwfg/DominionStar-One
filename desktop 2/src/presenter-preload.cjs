const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('presenterBridge',Object.freeze({
  command:value=>ipcRenderer.send('desktop:presenter-command',String(value||''))
}));
