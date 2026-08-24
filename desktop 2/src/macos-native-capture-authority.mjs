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

// The approved DominionStar source picker is the primary capture authority on
// every desktop platform. macOS's system picker remains detectable as a future
// emergency fallback, but it must never silently replace the branded picker.
// This prevents Apple UI from displacing the approved Screens / Application
// windows experience and avoids two competing picker authorities.
ipcMain.handle('desktop:native-capture-capability', event => {
  if (!rendererIsTrusted(event)) {
    return {
      ok: false,
      enabled: false,
      available: false,
      platform: process.platform,
      systemVersion: '',
      authority: 'dominionstar-custom-picker'
    };
  }
  return {
    ok: true,
    enabled: false,
    available: supportsNativeMacPicker(),
    installed: false,
    platform: process.platform,
    systemVersion: macSystemVersion(),
    authority: 'dominionstar-custom-picker'
  };
});

export const DominionMacCaptureAuthority = Object.freeze({
  primary: 'dominionstar-custom-picker',
  nativeFallbackAvailable: supportsNativeMacPicker
});
