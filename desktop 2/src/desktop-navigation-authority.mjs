import { app, shell } from 'electron';

const PRODUCTION_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);
const QA_PREVIEW_HOST = /^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;
const INTERNAL_PATHS = new Set(['/meet', '/meet-home', '/meet-login', '/member-login']);
const ACCOUNT_RETURN_PATHS = new Set(['/member-dashboard', '/workspace']);

function normalizedPath(pathname = '/') {
  const path = String(pathname || '/');
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function isDominionDesktopHost(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  return PRODUCTION_HOSTS.has(host) || QA_PREVIEW_HOST.test(host);
}

function desktopHomeFor(url) {
  const target = new URL('/meet-home/', url.origin);
  target.searchParams.set('desktop', '1');
  if (QA_PREVIEW_HOST.test(target.hostname)) target.searchParams.set('ntl-drawer-state', 'hidden');
  return target.toString();
}

function normalizeInternalDesktopUrl(url) {
  const target = new URL(url.toString());
  target.searchParams.set('desktop', '1');
  if (QA_PREVIEW_HOST.test(target.hostname)) target.searchParams.set('ntl-drawer-state', 'hidden');
  return target;
}

function installNavigationAuthority(contents) {
  if (!contents || contents.isDestroyed?.()) return;

  contents.on('will-navigate', (event, rawUrl) => {
    let url;
    try { url = new URL(String(rawUrl || '')); } catch { return; }
    if (url.protocol === 'file:') return;
    if (url.protocol !== 'https:' || !isDominionDesktopHost(url.hostname)) return;

    const path = normalizedPath(url.pathname);

    if (ACCOUNT_RETURN_PATHS.has(path)) {
      event.preventDefault();
      void contents.loadURL(desktopHomeFor(url)).catch(() => {});
      return;
    }

    if (!INTERNAL_PATHS.has(path)) {
      event.preventDefault();
      void shell.openExternal(url.toString()).catch(() => {});
      return;
    }

    const normalized = normalizeInternalDesktopUrl(url);
    if (normalized.toString() !== url.toString()) {
      event.preventDefault();
      void contents.loadURL(normalized.toString()).catch(() => {});
    }
  });
}

app.on('web-contents-created', (_event, contents) => {
  installNavigationAuthority(contents);
});

export const DominionDesktopNavigationAuthority = Object.freeze({
  isDominionDesktopHost,
  normalizedPath,
  internalPaths: Object.freeze([...INTERNAL_PATHS]),
  accountReturnPaths: Object.freeze([...ACCOUNT_RETURN_PATHS])
});
