const { contextBridge, ipcRenderer } = require('electron');

let remoteControlCapability = '';

contextBridge.exposeInMainWorld('dominionDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  // Compatibility contract used by the hosted Meet client. `version` is the
  // Electron/runtime version; DominionStar release identity lives in
  // appVersion/buildVersion. Keep these semantics separate.
  version: process.versions.electron,
  appVersion: '1.1.3',
  buildVersion: '1.1.3',
  electronVersion: process.versions.electron,
  bridgeVersion: 12,
  supportsSystemAudioShare: ['win32', 'darwin'].includes(process.platform),
  goHome: () => ipcRenderer.send('desktop:home'),
  showAccountChooser: () => ipcRenderer.send('desktop:account-chooser'),
  getRuntimeInfo: () => ipcRenderer.invoke('desktop:runtime-info'),
  getWindowLayout: () => ipcRenderer.invoke('desktop:window-layout'),
  onWindowLayout: callback => {
    if(typeof callback!=='function')return()=>{};
    const listener=(_event,layout)=>callback(Object.freeze({...layout}));
    ipcRenderer.on('desktop:layout-changed',listener);
    return()=>ipcRenderer.removeListener('desktop:layout-changed',listener);
  },
  getUpdateStatus: () => ipcRenderer.invoke('desktop:update-status'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-update'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  onUpdateStatus: callback => {
    if(typeof callback!=='function')return()=>{};
    const listener=(_event,status)=>callback(Object.freeze({...status}));
    ipcRenderer.on('desktop:update-status',listener);
    return()=>ipcRenderer.removeListener('desktop:update-status',listener);
  },
  openExternal: url => ipcRenderer.invoke('desktop:open-external', url),
  getShareSources: (options = {}) => ipcRenderer.invoke('desktop:share-sources', options),
  getCaptureStatus: () => ipcRenderer.invoke('desktop:capture-status'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('desktop:open-screen-settings'),
  selectShareSource: (sourceId, audio = false, displayId = '', kind = '', sourceName = '', shareOwnWindow = false) => ipcRenderer.invoke('desktop:select-share-source', {sourceId, audio, displayId, kind, sourceName, shareOwnWindow}),
  showPresenterToolbar: () => ipcRenderer.send('desktop:presenter-show'),
  hidePresenterToolbar: () => ipcRenderer.send('desktop:presenter-hide'),
  onPresenterCommand: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, command) => callback(String(command || ''));
    ipcRenderer.on('desktop:presenter-command', listener);
    return () => ipcRenderer.removeListener('desktop:presenter-command', listener);
  },
  endShare: async () => { remoteControlCapability=''; return ipcRenderer.invoke('desktop:end-share'); },
  requestRemoteControlPermission: async context => { const result=await ipcRenderer.invoke('desktop:remote-control-permission', context); remoteControlCapability=result?.ok?String(result.capability||''):''; return {ok:Boolean(result?.ok),reason:result?.reason||''}; },
  clearRemoteControlPermission: () => { remoteControlCapability=''; },
  applyRemoteInput: input => remoteControlCapability ? ipcRenderer.invoke('desktop:remote-input', {...input,capability:remoteControlCapability}) : Promise.resolve(false)
}));
