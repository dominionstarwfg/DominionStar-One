const {contextBridge,ipcRenderer}=require('electron');

const invoke=(channel,payload)=>ipcRenderer.invoke(channel,payload);
const listen=(channel,callback)=>{
  if(typeof callback!=='function')return()=>{};
  const handler=(_event,payload)=>callback(payload);
  ipcRenderer.on(channel,handler);
  return()=>ipcRenderer.removeListener(channel,handler);
};

const qaPresenterTrace=process.env.DOMINIONSTAR_QA_INTERACTION_FIXTURES==='1';
const packaged=String(location?.href||'').includes('/app.asar/');
const logoUrl=new URL(packaged?'../../branding/dominionstar-logo.jpeg':'../../assets/logo.jpeg',location.href).href;

// Minimal bridge for the macOS floating presenter surfaces only. Keeping these
// windows on a dedicated preload avoids loading the entire meeting API into an
// auxiliary renderer and prevents Electron sandbox-preload startup races from
// turning visible presenter controls into dead buttons.
contextBridge.exposeInMainWorld('dominionDesktop',Object.freeze({
  isDesktop:true,
  brand:Object.freeze({logoUrl}),
  auth:Object.freeze({getState:()=>invoke('auth:get-state')}),
  presenter:Object.freeze({
    command:command=>invoke('share:presenter-command',command),
    setMenuOpen:open=>invoke('share:presenter-menu-state',{open:Boolean(open)}),
    onState:callback=>listen('share:toolbar-state',callback)
  }),
  macShare:Object.freeze({
    prepare:()=>invoke('mac-share:prepare'),
    command:async command=>{
      const normalized=String(command||'');
      if(qaPresenterTrace)console.error(`QA_MAC_TOOLBAR_SEND command=${normalized}`);
      // A toolbar click is successful only when main process reports that the
      // live meeting renderer actually executed or positively acknowledged it.
      // Never return a synthetic acknowledged:true for a one-way send.
      const result=await invoke('mac-share:presenter-command',{command:normalized});
      if(qaPresenterTrace)console.error(`QA_MAC_TOOLBAR_RESULT command=${normalized} ok=${result?.ok?1:0} acknowledged=${result?.acknowledged?1:0} direct=${result?.direct?1:0} error=${String(result?.error||'')}`);
      return result;
    },
    setMenuOpen:open=>invoke('mac-share:menu-state',{open:Boolean(open)}),
    showMeeting:()=>invoke('mac-share:show-meeting'),
    onState:callback=>listen('share:toolbar-state',callback),
    onShowMeeting:callback=>listen('mac-share:show-meeting',callback),
    onVideoFrame:callback=>listen('mac-share:video-frame',callback)
  })
}));
