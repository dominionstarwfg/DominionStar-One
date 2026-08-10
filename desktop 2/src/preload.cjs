const { contextBridge, ipcRenderer } = require('electron');

let remoteControlCapability = '';

contextBridge.exposeInMainWorld('dominionDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  buildVersion: '1.0.4',
  bridgeVersion: 7,
  supportsSystemAudioShare: ['win32', 'darwin'].includes(process.platform),
  goHome: () => ipcRenderer.send('desktop:home'),
  showAccountChooser: () => ipcRenderer.send('desktop:account-chooser'),
  getRuntimeInfo: () => ipcRenderer.invoke('desktop:runtime-info'),
  openExternal: url => ipcRenderer.invoke('desktop:open-external', url),
  getShareSources: (options = {}) => ipcRenderer.invoke('desktop:share-sources', options),
  getCaptureStatus: () => ipcRenderer.invoke('desktop:capture-status'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('desktop:open-screen-settings'),
  selectShareSource: (sourceId, audio = false, displayId = '', kind = '', sourceName = '', shareOwnWindow = false) => ipcRenderer.invoke('desktop:select-share-source', {sourceId, audio, displayId, kind, sourceName, shareOwnWindow}),
  endShare: async () => { remoteControlCapability=''; return ipcRenderer.invoke('desktop:end-share'); },
  requestRemoteControlPermission: async context => { const result=await ipcRenderer.invoke('desktop:remote-control-permission', context); remoteControlCapability=result?.ok?String(result.capability||''):''; return {ok:Boolean(result?.ok),reason:result?.reason||''}; },
  clearRemoteControlPermission: () => { remoteControlCapability=''; },
  applyRemoteInput: input => remoteControlCapability ? ipcRenderer.invoke('desktop:remote-input', {...input,capability:remoteControlCapability}) : Promise.resolve(false)
}));
