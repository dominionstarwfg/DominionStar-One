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

// Locked approved design contract: DominionStar owns the single visible source
// chooser on every desktop platform. macOS still owns TCC permission and the
// underlying ScreenCaptureKit capture boundary.
export const ApprovedDominionStarCapture = Object.freeze({
  authority: 'dominionstar-custom-picker'
});

// Native source enumeration is bounded/single-flight by share-picker-authority.mjs
// so a slow permission transition cannot stack capture requests or freeze the
// meeting UI. A second visible Apple picker therefore remains disabled.
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
  primary: ApprovedDominionStarCapture.authority,
  nativeFallbackAvailable: supportsNativeMacPicker
});
