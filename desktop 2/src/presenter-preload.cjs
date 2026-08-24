const {contextBridge,ipcRenderer}=require('electron');

const parityCommands=new Set(['layout','annotate','show-meeting','slide-control']);

contextBridge.exposeInMainWorld('presenterBridge',Object.freeze({
  command:value=>{
    const command=String(value||'');
    ipcRenderer.send(parityCommands.has(command)?'desktop:presenter-parity-command':'desktop:presenter-command',command);
  },
  resize:(width,height)=>ipcRenderer.send('desktop:presenter-resize',{width:Number(width),height:Number(height)})
}));
