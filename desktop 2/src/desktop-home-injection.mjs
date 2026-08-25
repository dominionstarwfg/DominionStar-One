import { app, BrowserWindow } from 'electron';

const TRUSTED_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);
const QA_PREVIEW_HOST = /^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;
const wired = new WeakSet();

function isMeetHome(value) {
  try {
    const url = new URL(String(value || ''));
    const host = url.hostname.toLowerCase();
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return url.protocol === 'https:' && (TRUSTED_HOSTS.has(host) || QA_PREVIEW_HOST.test(host)) && path === '/meet-home';
  } catch {
    return false;
  }
}

function injectCompactHome(win) {
  if (!win || win.isDestroyed() || !isMeetHome(win.webContents.getURL())) return false;
  const source = `(()=>{if(document.querySelector('script[data-ds-compact-home-launch]'))return true;const s=document.createElement('script');s.src='/assets/js/meet/desktop-home-compact-launch.js?v=1-physical-qa';s.dataset.dsCompactHomeLaunch='1';s.async=false;(document.head||document.documentElement).append(s);return true;})()`;
  void win.webContents.executeJavaScript(source, true).catch(() => {});
  return true;
}

function wireWindow(win) {
  if (!win || wired.has(win)) return;
  wired.add(win);
  win.webContents.on('did-finish-load', () => injectCompactHome(win));
  if (!win.webContents.isLoading()) injectCompactHome(win);
}

app.on('browser-window-created', (_event, win) => wireWindow(win));
app.whenReady().then(() => BrowserWindow.getAllWindows().forEach(wireWindow)).catch(() => {});

export { injectCompactHome };
export const DominionDesktopHomeInjection = Object.freeze({ route: '/meet-home' });
