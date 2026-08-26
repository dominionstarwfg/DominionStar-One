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

// DominionStar owns the one visible source-selection surface on every desktop
// platform so the installed app matches the approved illustration. macOS still
// owns TCC permission and ScreenCaptureKit capture underneath. Native source
// enumeration is bounded/single-flight by share-picker-authority.mjs so a slow
// permission transition cannot stack capture requests or freeze the meeting UI.
export function supportsNativeMacPicker() {
  return false;
}

ipcMain.handle('desktop:native-capture-capability', event => {
  const trusted = rendererIsTrusted(event);
  const nativePicker = supportsNativeMacPicker();
  return {
    ok: trusted,
    enabled: nativePicker,
    available: process.platform === 'darwin',
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
