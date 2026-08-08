import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('dominionDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  goHome: () => ipcRenderer.send('desktop:home'),
  getShareSources: () => ipcRenderer.invoke('desktop:share-sources'),
  selectShareSource: (sourceId, audio = false, displayId = '') => ipcRenderer.invoke('desktop:select-share-source', {sourceId, audio, displayId}),
  requestRemoteControlPermission: () => ipcRenderer.invoke('desktop:remote-control-permission'),
  applyRemoteInput: input => ipcRenderer.invoke('desktop:remote-input', input)
}));
