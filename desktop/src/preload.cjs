const { contextBridge, ipcRenderer } = require('electron');

let remoteControlCapability = '';

contextBridge.exposeInMainWorld('dominionDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  buildVersion: '1.0.1',
  bridgeVersion: 4,
  supportsSystemAudioShare: process.platform === 'win32',
  goHome: () => ipcRenderer.send('desktop:home'),
  showAccountChooser: () => ipcRenderer.send('desktop:account-chooser'),
  getRuntimeInfo: () => ipcRenderer.invoke('desktop:runtime-info'),
  openExternal: url => ipcRenderer.invoke('desktop:open-external', url),
  getShareSources: () => ipcRenderer.invoke('desktop:share-sources'),
  getCaptureStatus: () => ipcRenderer.invoke('desktop:capture-status'),
  selectShareSource: (sourceId, audio = false, displayId = '', kind = '', sourceName = '') => ipcRenderer.invoke('desktop:select-share-source', {sourceId, audio, displayId, kind, sourceName}),
  endShare: async () => { remoteControlCapability=''; return ipcRenderer.invoke('desktop:end-share'); },
  requestRemoteControlPermission: async context => { const result=await ipcRenderer.invoke('desktop:remote-control-permission', context); remoteControlCapability=result?.ok?String(result.capability||''):''; return {ok:Boolean(result?.ok),reason:result?.reason||''}; },
  clearRemoteControlPermission: () => { remoteControlCapability=''; },
  applyRemoteInput: input => remoteControlCapability ? ipcRenderer.invoke('desktop:remote-input', {...input,capability:remoteControlCapability}) : Promise.resolve(false)
}));
