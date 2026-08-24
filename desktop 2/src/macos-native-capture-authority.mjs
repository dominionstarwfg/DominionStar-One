import { app, ipcMain, session } from 'electron';

const DESKTOP_PARTITION = 'persist:dominionstar-meet';
const TRUSTED_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);
const QA_PREVIEW_HOST = /^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;

function rendererIsTrusted(event) {
  try {
    const url = new URL(String(event?.sender?.getURL?.() || ''));
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return TRUSTED_HOSTS.has(host) || QA_PREVIEW_HOST.test(host);
  } catch {
    return false;
  }
}

export function macSystemVersion() {
  if (process.platform !== 'darwin') return '';
  try {
    return String(process.getSystemVersion?.() || '');
  } catch {
    return '';
  }
}

export function supportsNativeMacPicker() {
  if (process.platform !== 'darwin') return false;
  const major = Number.parseInt(macSystemVersion().split('.')[0] || '', 10);
  return Number.isFinite(major) && major >= 15;
}

let installed = false;

export function installMacNativeCaptureAuthority() {
  if (!supportsNativeMacPicker()) return false;
  const desktopSession = session.fromPartition(DESKTOP_PARTITION);

  // This intentionally becomes the final display-capture authority on supported
  // macOS versions. Electron documents that when useSystemPicker is available,
  // the native picker owns selection and this callback is not invoked. The
  // defensive empty callback prevents a stale custom selection from becoming a
  // second authority if the OS picker is unexpectedly unavailable.
  desktopSession.setDisplayMediaRequestHandler((_request, callback) => {
    callback({});
  }, { useSystemPicker: true });

  installed = true;
  return true;
}

ipcMain.handle('desktop:native-capture-capability', event => {
  if (!rendererIsTrusted(event)) {
    return { ok: false, enabled: false, platform: process.platform, systemVersion: '' };
  }
  return {
    ok: true,
    enabled: supportsNativeMacPicker(),
    installed,
    platform: process.platform,
    systemVersion: macSystemVersion(),
    authority: supportsNativeMacPicker() ? 'macos-system-picker' : 'dominionstar-custom-picker'
  };
});

app.whenReady().then(() => {
  // main-v2 installs the cross-platform custom capture fallback during its ready
  // path. Install the macOS native authority on the next turn so supported Macs
  // finish with exactly one effective picker authority.
  setImmediate(() => {
    installMacNativeCaptureAuthority();
  });
}).catch(() => {});
