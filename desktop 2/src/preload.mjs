import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('dominionDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  supportsSystemAudioShare: process.platform === 'win32',
  goHome: () => ipcRenderer.send('desktop:home'),
  openExternal: url => ipcRenderer.invoke('desktop:open-external', url),
  getShareSources: () => ipcRenderer.invoke('desktop:share-sources'),
  selectShareSource: (sourceId, audio = false, displayId = '', kind = '') => ipcRenderer.invoke('desktop:select-share-source', {sourceId, audio, displayId, kind}),
  endShare: () => ipcRenderer.invoke('desktop:end-share'),
  requestRemoteControlPermission: () => ipcRenderer.invoke('desktop:remote-control-permission'),
  applyRemoteInput: input => ipcRenderer.invoke('desktop:remote-input', input)
}));
