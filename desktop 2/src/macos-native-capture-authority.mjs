import { ipcMain } from 'electron';

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
  try { return String(process.getSystemVersion?.() || ''); }
  catch { return ''; }
}

export function supportsNativeMacPicker() {
  return false;
}

// Physical Mac QA showed that desktopCapturer enumeration can stall after a
// Screen & System Audio Recording permission transition. On macOS 15+ use the
// operating system's single native picker. The DominionStar source picker stays
// available only as the fallback on older macOS and non-macOS desktops.
ipcMain.handle('desktop:native-capture-capability', event => {
  const nativePicker = supportsNativeMacPicker();
  if (!rendererIsTrusted(event)) {
    return {
      ok: false,
      enabled: false,
      available: nativePicker,
      installed: false,
      platform: process.platform,
      systemVersion: macSystemVersion(),
      authority: nativePicker ? 'macos-system-picker' : 'dominionstar-custom-picker'
    };
  }
  return {
    ok: true,
    enabled: nativePicker,
    available: nativePicker,
    installed: nativePicker,
    platform: process.platform,
    systemVersion: macSystemVersion(),
    authority: nativePicker ? 'macos-system-picker' : 'dominionstar-custom-picker'
  };
});

export const DominionMacCaptureAuthority = Object.freeze({
  primary: supportsNativeMacPicker() ? 'macos-system-picker' : 'dominionstar-custom-picker',
  nativeFallbackAvailable: supportsNativeMacPicker
});
