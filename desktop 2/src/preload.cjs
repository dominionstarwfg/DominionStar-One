const { contextBridge, ipcRenderer } = require('electron');

const RELEASE_VERSION = '1.2.1';
const BRIDGE_VERSION = 12;
let remoteControlCapability = '';

const nativeCertification = Object.freeze({
  mode: 'native-authoritative',
  isDesktop: true,
  certified: true,
  blocking: false,
  blocked: false,
  certifiedBy: 'native-release',
  version: RELEASE_VERSION,
  appVersion: RELEASE_VERSION,
  buildVersion: RELEASE_VERSION,
  bridgeVersion: BRIDGE_VERSION
});

// The packaged application owns desktop compatibility. Hosted Guardian scripts
// are not allowed to override a valid installed release and lock the native app.
contextBridge.exposeInMainWorld('DominionGuardianCertification', nativeCertification);

contextBridge.exposeInMainWorld('dominionDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: RELEASE_VERSION,
  appVersion: RELEASE_VERSION,
  buildVersion: RELEASE_VERSION,
  electronVersion: process.versions.electron,
  bridgeVersion: BRIDGE_VERSION,
  supportsSystemAudioShare: ['win32', 'darwin'].includes(process.platform),
  goHome: () => ipcRenderer.send('desktop:home'),
  showAccountChooser: () => ipcRenderer.send('desktop:account-chooser'),
  getRuntimeInfo: async () => {
    const info = await ipcRenderer.invoke('desktop:runtime-info');
    if (!info || typeof info !== 'object') return info;
    const appVersion = String(info.appVersion || info.buildVersion || RELEASE_VERSION);
    return Object.freeze({
      ...info,
      version: appVersion,
      appVersion,
      buildVersion: String(info.buildVersion || appVersion),
      electronVersion: String(info.electronVersion || process.versions.electron),
      bridgeVersion: Number(info.bridgeVersion || BRIDGE_VERSION)
    });
  },
  getWindowLayout: () => ipcRenderer.invoke('desktop:window-layout'),
  onWindowLayout: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, layout) => callback(Object.freeze({ ...layout }));
    ipcRenderer.on('desktop:layout-changed', listener);
    return () => ipcRenderer.removeListener('desktop:layout-changed', listener);
  },
  getUpdateStatus: () => ipcRenderer.invoke('desktop:update-status'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-update'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  onUpdateStatus: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(Object.freeze({ ...status }));
    ipcRenderer.on('desktop:update-status', listener);
    return () => ipcRenderer.removeListener('desktop:update-status', listener);
  },
  openExternal: url => ipcRenderer.invoke('desktop:open-external', url),
  getShareSources: (options = {}) => ipcRenderer.invoke('desktop:share-sources', options),
  getCaptureStatus: () => ipcRenderer.invoke('desktop:capture-status'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('desktop:open-screen-settings'),
  selectShareSource: (sourceId, audio = false, displayId = '', kind = '', sourceName = '', shareOwnWindow = false) =>
    ipcRenderer.invoke('desktop:select-share-source', { sourceId, audio, displayId, kind, sourceName, shareOwnWindow }),
  showPresenterToolbar: () => ipcRenderer.send('desktop:presenter-show'),
  hidePresenterToolbar: () => ipcRenderer.send('desktop:presenter-hide'),
  onPresenterCommand: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, command) => callback(String(command || ''));
    ipcRenderer.on('desktop:presenter-command', listener);
    return () => ipcRenderer.removeListener('desktop:presenter-command', listener);
  },
  endShare: async () => {
    remoteControlCapability = '';
    return ipcRenderer.invoke('desktop:end-share');
  },
  requestRemoteControlPermission: async context => {
    const result = await ipcRenderer.invoke('desktop:remote-control-permission', context);
    remoteControlCapability = result?.ok ? String(result.capability || '') : '';
    return { ok: Boolean(result?.ok), reason: result?.reason || '' };
  },
  clearRemoteControlPermission: () => { remoteControlCapability = ''; },
  applyRemoteInput: input => remoteControlCapability
    ? ipcRenderer.invoke('desktop:remote-input', { ...input, capability: remoteControlCapability })
    : Promise.resolve(false)
}));

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.dispatchEvent(new CustomEvent('dominionstar:guardian-certification', { detail: nativeCertification }));
  } catch {}
}, { once: true });
