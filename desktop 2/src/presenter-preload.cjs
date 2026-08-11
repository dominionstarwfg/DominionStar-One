const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('presenterBridge',Object.freeze({
  command:value=>ipcRenderer.send('desktop:presenter-command',String(value||'')),
  resize:(width,height)=>ipcRenderer.send('desktop:presenter-resize',{width:Number(width),height:Number(height)})
}));
