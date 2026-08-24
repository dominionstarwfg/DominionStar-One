import { app, session, shell } from 'electron';

const DESKTOP_PARTITION = 'persist:dominionstar-meet';
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

function installPreviewChromeSuppression(contents) {
  if (!contents || contents.isDestroyed?.()) return;
  const suppress = () => {
    let current;
    try { current = new URL(String(contents.getURL?.() || '')); } catch { return; }
    if (!QA_PREVIEW_HOST.test(current.hostname)) return;
    const script = `(()=>{
      if(window.__dsNetlifyPreviewSuppressionV2)return;
      window.__dsNetlifyPreviewSuppressionV2=true;
      const phrases=['Collaborate on this Deploy Preview','Log in to the Netlify Drawer'];
      const removePreviewChrome=()=>{
        for(const iframe of Array.from(document.querySelectorAll('iframe'))){
          const src=String(iframe.getAttribute('src')||'').toLowerCase();
          const title=String(iframe.getAttribute('title')||'').toLowerCase();
          if(src.includes('app.netlify.com')||(src.includes('netlify.com')&&title.includes('netlify'))||title.includes('deploy preview'))iframe.remove();
        }
        for(const node of Array.from(document.querySelectorAll('[data-netlify-drawer],#netlify-drawer,netlify-drawer,netlify-toolbar'))){node.remove();}
        for(const node of Array.from(document.querySelectorAll('body *'))){
          const text=String(node.textContent||'').trim();
          if(!phrases.some(phrase=>text.includes(phrase)))continue;
          let target=node;
          for(let depth=0;depth<5&&target.parentElement&&target.parentElement!==document.body;depth+=1){
            const parent=target.parentElement;
            const rect=parent.getBoundingClientRect();
            const style=getComputedStyle(parent);
            if(rect.height<=150&&(style.position==='fixed'||style.position==='sticky'||rect.width>=320))target=parent;
            else break;
          }
          target.remove();
        }
      };
      const style=document.createElement('style');
      style.textContent='iframe[src*="app.netlify.com"],iframe[title*="Deploy Preview" i],[data-netlify-drawer],#netlify-drawer,netlify-drawer,netlify-toolbar{display:none!important;visibility:hidden!important;pointer-events:none!important}';
      (document.head||document.documentElement).append(style);
      removePreviewChrome();
      new MutationObserver(removePreviewChrome).observe(document.documentElement,{childList:true,subtree:true});
    })();`;
    void contents.executeJavaScript(script, true).catch(() => {});
  };
  contents.on('dom-ready', suppress);
  contents.on('did-navigate-in-page', suppress);
}

function installPreviewRequestNormalization() {
  const desktopSession = session.fromPartition(DESKTOP_PARTITION);
  desktopSession.webRequest.onBeforeRequest({ urls: ['https://*/*'] }, (details, callback) => {
    if (details.resourceType !== 'mainFrame') { callback({}); return; }
    let url;
    try { url = new URL(String(details.url || '')); } catch { callback({}); return; }
    if (!QA_PREVIEW_HOST.test(url.hostname)) { callback({}); return; }
    const path = normalizedPath(url.pathname);
    if (!INTERNAL_PATHS.has(path)) { callback({}); return; }
    const normalized = normalizeInternalDesktopUrl(url);
    if (normalized.toString() === url.toString()) { callback({}); return; }
    callback({ redirectURL: normalized.toString() });
  });
}

app.on('web-contents-created', (_event, contents) => {
  installNavigationAuthority(contents);
  installPreviewChromeSuppression(contents);
});

app.whenReady().then(() => {
  installPreviewRequestNormalization();
}).catch(() => {});

export const DominionDesktopNavigationAuthority = Object.freeze({
  isDominionDesktopHost,
  normalizedPath,
  internalPaths: Object.freeze([...INTERNAL_PATHS]),
  accountReturnPaths: Object.freeze([...ACCOUNT_RETURN_PATHS])
});
