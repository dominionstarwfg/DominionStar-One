const { contextBridge, ipcRenderer } = require('electron');

const RELEASE_VERSION = '1.2.2';
const BRIDGE_VERSION = 14;
const RELEASE_CONTRACT_PATH = '/meet/release-contract.json';
const TRUSTED_ORIGINS = new Set(['https://dominionstarld.com', 'https://www.dominionstarld.com']);
let remoteControlCapability = '';
const remoteControlDecisionListeners = new Set();

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

async function applyLiveMeetReleaseCompatibility(info) {
  const normalized = info && typeof info === 'object' ? info : {};
  try {
    const origin = String(window.location?.origin || '');
    if (!TRUSTED_ORIGINS.has(origin)) {
      return Object.freeze({ ...normalized, meetReleaseId: '', meetReleaseCompatible: false });
    }

    const contractUrl = new URL(RELEASE_CONTRACT_PATH, origin).toString();
    const response = await fetch(contractUrl, {
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error'
    });
    if (!response.ok) {
      return Object.freeze({ ...normalized, meetReleaseId: '', meetReleaseCompatible: false });
    }

    const contract = await response.json();
    const releaseId = String(contract?.releaseId || '').trim();
    const requiredBridge = Number(contract?.desktopBridge || 0);
    const actualBridge = Number(normalized.bridgeVersion || BRIDGE_VERSION);
    const compatible = Boolean(
      releaseId &&
      Number.isFinite(requiredBridge) &&
      requiredBridge > 0 &&
      actualBridge >= requiredBridge
    );

    return Object.freeze({
      ...normalized,
      meetReleaseId: compatible ? releaseId : '',
      meetReleaseCompatible: compatible,
      requiredDesktopBridge: Number.isFinite(requiredBridge) ? requiredBridge : 0
    });
  } catch {
    return Object.freeze({ ...normalized, meetReleaseId: '', meetReleaseCompatible: false });
  }
}

async function showNativeRemoteControlPrompt(payload = {}) {
  let result = { accepted: false, reason: 'prompt-failed' };
  try {
    result = await ipcRenderer.invoke('desktop:remote-control-prompt', payload && typeof payload === 'object' ? payload : {});
  } catch {}
  for (const listener of [...remoteControlDecisionListeners]) {
    try { listener(Boolean(result?.accepted)); } catch {}
  }
  return result;
}

async function revokeRemoteControlCapability() {
  const previous = remoteControlCapability;
  remoteControlCapability = '';
  if (!previous) return true;
  try {
    await ipcRenderer.invoke('desktop:remote-control-permission', {
      requestId: `revoke-${Date.now()}`,
      requesterId: 'dominionstar-revoke'
    });
  } catch {}
  return true;
}

function trustedMeetOriginAndRoute() {
  try {
    const origin = String(window.location?.origin || '');
    const route = String(window.location?.pathname || '').replace(/\/+$/, '') || '/';
    return TRUSTED_ORIGINS.has(origin) && route === '/meet' ? origin : '';
  } catch {
    return '';
  }
}

function appendTrustedMeetScript(origin, path, marker) {
  try {
    if (!origin || !marker) return null;
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) return existing;
    const script = document.createElement('script');
    script.src = new URL(path, origin).toString();
    script.setAttribute(marker, '1');
    script.async = false;
    document.head.append(script);
    return script;
  } catch {
    return null;
  }
}

function installDesktopMeetRuntimeLayers() {
  const origin = trustedMeetOriginAndRoute();
  if (!origin) return false;

  // One explicit bootstrap owns the advanced desktop meeting modules. This
  // prevents useful camera/share/presenter layers from existing as orphaned
  // repository files while keeping the public browser runtime unchanged.
  const bootstrap = appendTrustedMeetScript(
    origin,
    '/assets/js/meet/operation-2030-bootstrap.js?v=13-clean-desktop-runtime',
    'data-ds-desktop-operation-bootstrap'
  );

  const installIllustration = () => appendTrustedMeetScript(
    origin,
    '/assets/js/meet/illustration-ui-parity.js?v=1-final-ui-blueprint',
    'data-ds-illustration-ui-parity'
  );

  if (!bootstrap) {
    installIllustration();
    return true;
  }
  if (bootstrap.dataset.dsLoaded === '1') {
    installIllustration();
    return true;
  }
  bootstrap.addEventListener('load', () => {
    bootstrap.dataset.dsLoaded = '1';
    installIllustration();
  }, { once: true });
  bootstrap.addEventListener('error', installIllustration, { once: true });
  return true;
}

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
    const normalized = {
      ...info,
      version: appVersion,
      appVersion,
      buildVersion: String(info.buildVersion || appVersion),
      electronVersion: String(info.electronVersion || process.versions.electron),
      bridgeVersion: Number(info.bridgeVersion || BRIDGE_VERSION)
    };
    return applyLiveMeetReleaseCompatibility(normalized);
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
  getMediaPermissions: () => ipcRenderer.invoke('desktop:media-permissions'),
  requestMediaPermissions: (kinds = []) => ipcRenderer.invoke('desktop:request-media-permissions', Array.isArray(kinds) ? kinds.filter(kind => ['camera','microphone'].includes(String(kind))) : []),
  getScreenPermissionStatus: () => ipcRenderer.invoke('desktop:screen-permission-status'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('desktop:open-screen-settings'),
  relaunchForPermissions: () => ipcRenderer.invoke('desktop:relaunch-for-permissions'),
  selectShareSource: (sourceId, audio = false, displayId = '', kind = '', sourceName = '', shareOwnWindow = false) =>
    ipcRenderer.invoke('desktop:select-share-source', { sourceId, audio, displayId, kind, sourceName, shareOwnWindow }),
  showPresenterToolbar: () => ipcRenderer.send('desktop:presenter-show'),
  hidePresenterToolbar: () => ipcRenderer.send('desktop:presenter-hide'),
  updatePresenterDock: state => ipcRenderer.send('desktop:presenter-dock-update', state && typeof state === 'object' ? state : {}),
  onPresenterCommand: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, command) => callback(String(command || ''));
    ipcRenderer.on('desktop:presenter-command', listener);
    return () => ipcRenderer.removeListener('desktop:presenter-command', listener);
  },
  getSlideControlPermission: () => ipcRenderer.invoke('desktop:slide-control-permission'),
  setSlideControlState: state => ipcRenderer.send('desktop:slide-control-state', state && typeof state === 'object' ? state : {}),
  applySlideControlCommand: command => ipcRenderer.invoke('desktop:slide-control-command', String(command || '')),
  endShare: async () => {
    remoteControlCapability = '';
    ipcRenderer.send('desktop:slide-control-state', { active: false });
    return ipcRenderer.invoke('desktop:end-share');
  },
  showRemoteControlPrompt: payload => showNativeRemoteControlPrompt(payload),
  onRemoteControlDecision: callback => {
    if (typeof callback !== 'function') return () => {};
    remoteControlDecisionListeners.add(callback);
    return () => remoteControlDecisionListeners.delete(callback);
  },
  showRemoteControlError: message => ipcRenderer.invoke('desktop:remote-control-error', String(message || 'Remote control is unavailable.')),
  requestRemoteControlPermission: async context => {
    const result = await ipcRenderer.invoke('desktop:remote-control-permission', context);
    remoteControlCapability = result?.ok ? String(result.capability || '') : '';
    return { ok: Boolean(result?.ok), reason: result?.reason || '' };
  },
  clearRemoteControlPermission: () => revokeRemoteControlCapability(),
  applyRemoteInput: input => remoteControlCapability
    ? ipcRenderer.invoke('desktop:remote-input', { ...input, capability: remoteControlCapability })
    : Promise.resolve(false)
}));

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.dispatchEvent(new CustomEvent('dominionstar:guardian-certification', { detail: nativeCertification }));
  } catch {}
  installDesktopMeetRuntimeLayers();
}, { once: true });
