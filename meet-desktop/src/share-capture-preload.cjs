const {contextBridge,ipcRenderer}=require('electron');
const listen=(channel,callback)=>{if(typeof callback!=='function')return()=>{};const handler=(_event,payload)=>callback(payload);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};

contextBridge.exposeInMainWorld('dominionShareCapture',Object.freeze({
  offer:payload=>ipcRenderer.send('share-capture:offer',payload||{}),
  candidate:payload=>ipcRenderer.send('share-capture:worker-ice',payload||{}),
  started:payload=>ipcRenderer.send('share-capture:started',payload||{}),
  stopped:payload=>ipcRenderer.send('share-capture:stopped',payload||{}),
  error:payload=>ipcRenderer.send('share-capture:error',payload||{}),
  onStart:callback=>listen('share-capture:start',callback),
  onAnswer:callback=>listen('share-capture:answer',callback),
  onCandidate:callback=>listen('share-capture:client-ice',callback),
  onStop:callback=>listen('share-capture:stop',callback)
}));
