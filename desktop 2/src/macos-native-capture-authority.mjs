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

// Physical Mac QA is authoritative here. The OS system-picker path left an
// in-flight getDisplayMedia transaction during the Screen Recording permission
// transition and the meeting renderer became unresponsive on return. Until that
// behavior is proven on physical Macs, DominionStar keeps one selected-source
// authority in main-v2 on every platform.
export function supportsNativeMacPicker() { return false; }

ipcMain.handle('desktop:native-capture-capability', event => ({
  ok: rendererIsTrusted(event),
  enabled: false,
  available: false,
  installed: false,
  platform: process.platform,
  systemVersion: macSystemVersion(),
  authority: 'dominionstar-custom-picker'
}));

export const DominionMacCaptureAuthority = Object.freeze({
  primary: 'dominionstar-custom-picker',
  nativeFallbackAvailable: () => false
});
