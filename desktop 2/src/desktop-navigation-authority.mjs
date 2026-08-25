import { app, net, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DESKTOP_PARTITION = 'persist:dominionstar-meet';
const PRODUCTION_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);
const QA_PREVIEW_HOST = /^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;
const INTERNAL_PATHS = new Set(['/meet', '/meet-home', '/meet-login', '/member-login']);
const ACCOUNT_RETURN_PATHS = new Set(['/member-dashboard', '/workspace']);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizedPath(pathname = '/') {
  const value = String(pathname || '/');
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
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

function desktopRuntimeRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'desktop-runtime');
  return path.resolve(__dirname, '..', '..');
}

function localRuntimeRelativePath(url) {
  let rawPath;
  try { rawPath = decodeURIComponent(String(url.pathname || '/')); }
  catch { return ''; }

  const route = normalizedPath(rawPath);
  if (route === '/meet-home' && url.searchParams.get('desktop') === '1') return 'meet-home/desktop.html';
  if (INTERNAL_PATHS.has(route)) return `${route.slice(1)}/index.html`;
  if (rawPath.startsWith('/assets/')) return rawPath.slice(1);
  if (rawPath.startsWith('/meet/')) return rawPath.slice(1);
  if (rawPath === '/styles.css') return 'styles.css';
  return '';
}

function resolveLocalRuntimeFile(url) {
  const relative = localRuntimeRelativePath(url);
  if (!relative) return '';

  const root = desktopRuntimeRoot();
  const candidate = path.resolve(root, relative);
  const containment = path.relative(root, candidate);
  if (!containment || containment.startsWith('..') || path.isAbsolute(containment)) return '';

  try {
    return fs.statSync(candidate).isFile() ? candidate : '';
  } catch {
    return '';
  }
}

function installLocalDesktopRuntime() {
  const desktopSession = session.fromPartition(DESKTOP_PARTITION);
  desktopSession.protocol.handle('https', async (request) => {
    let url;
    try { url = new URL(String(request.url || '')); }
    catch { return desktopSession.fetch(request, { bypassCustomProtocolHandlers: true }); }

    if (!isDominionDesktopHost(url.hostname) || !['GET', 'HEAD'].includes(String(request.method || 'GET').toUpperCase())) {
      return desktopSession.fetch(request, { bypassCustomProtocolHandlers: true });
    }

    const candidate = resolveLocalRuntimeFile(url);
    if (!candidate) return desktopSession.fetch(request, { bypassCustomProtocolHandlers: true });

    try {
      return net.fetch(pathToFileURL(candidate).toString(), {
        method: String(request.method || 'GET').toUpperCase() === 'HEAD' ? 'HEAD' : 'GET'
      });
    } catch {
      return desktopSession.fetch(request, { bypassCustomProtocolHandlers: true });
    }
  });
}

async function resolveDesktopHostIdentity(contents) {
  if (!contents || contents.isDestroyed?.()) return null;
  const script = `(()=>{
    const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
    const digits=value=>String(value||'').replace(/\\D/g,'').slice(0,10);
    const identity={usePersonalForInstant:true,...(read('ds_meet_identity_preferences_v1')||{})};
    if(identity.usePersonalForInstant===false)return {usePersonal:false};
    for(const key of ['ds_meet_personal_room_v2','ds_meet_personal_room_v1']){
      const value=read(key);const id=digits(value?.personalRoomId||value?.personal_room_id||'');
      if(id.length===10)return {usePersonal:true,id,personal:String(value?.personalLinkName||value?.personal_link_name||''),passcode:String(value?.passcode||''),waiting:Boolean(value?.waitingRoomEnabled??value?.waiting_room_enabled)};
    }
    return {usePersonal:true,id:''};
  })();`;
  try { return await contents.executeJavaScript(script, true); }
  catch { return null; }
}

function enforceDesktopHostIdentity(contents, event, url) {
  const route = normalizedPath(url.pathname);
  const action = String(url.searchParams.get('action') || '');
  if (route !== '/meet' || url.searchParams.get('desktop') !== '1' || !['new', 'share'].includes(action)) return false;
  if (url.searchParams.get('desktopIdentityResolved') === '1' || url.searchParams.get('room')) return false;

  event.preventDefault();
  void resolveDesktopHostIdentity(contents).then(identity => {
    if (!contents || contents.isDestroyed?.()) return;
    const target = new URL(url.toString());
    target.searchParams.set('desktopIdentityResolved', '1');
    if (identity?.usePersonal && identity?.id) {
      target.searchParams.set('host', '1');
      target.searchParams.set('room', identity.id);
      if (identity.personal) target.searchParams.set('personal', identity.personal);
      if (identity.passcode) target.searchParams.set('passcode', identity.passcode);
      if (identity.waiting) target.searchParams.set('waiting', '1');
    }
    void contents.loadURL(target.toString()).catch(() => {});
  }).catch(() => {
    const target = new URL(url.toString());
    target.searchParams.set('desktopIdentityResolved', '1');
    void contents.loadURL(target.toString()).catch(() => {});
  });
  return true;
}

function installNavigationAuthority(contents) {
  if (!contents || contents.isDestroyed?.()) return;

  contents.on('will-navigate', (event, rawUrl) => {
    let url;
    try { url = new URL(String(rawUrl || '')); } catch { return; }
    if (url.protocol === 'file:') return;
    if (url.protocol !== 'https:' || !isDominionDesktopHost(url.hostname)) return;

    const route = normalizedPath(url.pathname);
    if (ACCOUNT_RETURN_PATHS.has(route)) {
      event.preventDefault();
      void contents.loadURL(desktopHomeFor(url)).catch(() => {});
      return;
    }
    if (!INTERNAL_PATHS.has(route)) {
      event.preventDefault();
      void shell.openExternal(url.toString()).catch(() => {});
      return;
    }

    const normalized = normalizeInternalDesktopUrl(url);
    if (normalized.toString() !== url.toString()) {
      event.preventDefault();
      void contents.loadURL(normalized.toString()).catch(() => {});
      return;
    }

    if (enforceDesktopHostIdentity(contents, event, url)) return;
  });
}

function installDesktopSettingsAuthority(contents) {
  if (!contents || contents.isDestroyed?.()) return;
  const inject = () => {
    let current;
    try { current = new URL(String(contents.getURL?.() || '')); } catch { return; }
    if (!isDominionDesktopHost(current.hostname)) return;
    if (normalizedPath(current.pathname) !== '/meet-home') return;
    if (current.searchParams.get('desktop') !== '1') return;

    const script = `(()=>{
      if(document.querySelector('script[data-ds-desktop-settings-authority]'))return;
      const node=document.createElement('script');
      node.src='/assets/js/meet/desktop-settings-authority.js?v=2-core-host-settings';
      node.async=false;
      node.setAttribute('data-ds-desktop-settings-authority','1');
      document.head.append(node);
    })();`;
    void contents.executeJavaScript(script, true).catch(() => {});
  };
  contents.on('dom-ready', inject);
}

function installDesktopMeetingIdentityBootstrap(contents) {
  if (!contents || contents.isDestroyed?.()) return;

  const applyPersonalRoomIdentity = () => {
    let current;
    try { current = new URL(String(contents.getURL?.() || '')); } catch { return; }
    if (!isDominionDesktopHost(current.hostname)) return;
    if (normalizedPath(current.pathname) !== '/meet') return;
    if (current.searchParams.get('desktop') !== '1') return;
    const action = current.searchParams.get('action') || '';
    if (!['new', 'share'].includes(action)) return;
    if (current.searchParams.get('room')) return;

    const script = `(()=>{
      if(window.__dsDesktopPersonalRoomBootstrapInstalled)return;
      window.__dsDesktopPersonalRoomBootstrapInstalled=true;
      const params=new URLSearchParams(location.search);
      const action=params.get('action')||'';
      if(!['new','share'].includes(action))return;
      let prefs={usePersonalForInstant:true};
      try{prefs={...prefs,...JSON.parse(localStorage.getItem('ds_meet_identity_preferences_v1')||'{}')}}catch{}
      if(prefs.usePersonalForInstant===false){window.__DS_DESKTOP_PERSONAL_ROOM_BOOTSTRAP='generated-meeting-v1';return;}
      const cachedRoom=()=>{
        for(const key of ['ds_meet_personal_room_v2','ds_meet_personal_room_v1']){
          try{const value=JSON.parse(localStorage.getItem(key)||'null');const id=String(value?.personalRoomId||'').replace(/\\D/g,'').slice(0,10);if(id.length===10)return{...value,personalRoomId:id};}catch{}
        }
        return null;
      };
      const start=()=>{
        const room=window.DominionPersonalRoom?.current?.()||cachedRoom();
        const id=String(room?.personalRoomId||'').replace(/\\D/g,'').slice(0,10);
        if(id.length!==10||typeof window.DominionStarEnterHostPrejoin!=='function')return false;
        window.DominionStarEnterHostPrejoin({room:id,passcode:String(room?.passcode||''),waitingRoom:Boolean(room?.waitingRoomEnabled),autoShare:action==='share'});
        window.__DS_DESKTOP_PERSONAL_ROOM_BOOTSTRAP='account-personal-room-v1';return true;
      };
      if(start())return;
      let attempts=0;const timer=setInterval(()=>{attempts+=1;if(start()||attempts>=20)clearInterval(timer);},100);
      Promise.resolve(window.DominionPersonalRoom?.ready).then(()=>{if(start())clearInterval(timer);}).catch(()=>{});
    })();`;
    void contents.executeJavaScript(script, true).catch(() => {});
  };

  contents.on('dom-ready', applyPersonalRoomIdentity);
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
          const src=String(iframe.getAttribute('src')||'').toLowerCase();const title=String(iframe.getAttribute('title')||'').toLowerCase();
          if(src.includes('app.netlify.com')||(src.includes('netlify.com')&&title.includes('netlify'))||title.includes('deploy preview'))iframe.remove();
        }
        for(const node of Array.from(document.querySelectorAll('[data-netlify-drawer],#netlify-drawer,netlify-drawer,netlify-toolbar')))node.remove();
        for(const node of Array.from(document.querySelectorAll('body *'))){
          const text=String(node.textContent||'').trim();if(!phrases.some(phrase=>text.includes(phrase)))continue;
          let target=node;for(let depth=0;depth<5&&target.parentElement&&target.parentElement!==document.body;depth+=1){const parent=target.parentElement;const rect=parent.getBoundingClientRect();const style=getComputedStyle(parent);if(rect.height<=150&&(style.position==='fixed'||style.position==='sticky'||rect.width>=320))target=parent;else break;}target.remove();
        }
      };
      const style=document.createElement('style');style.textContent='iframe[src*="app.netlify.com"],iframe[title*="Deploy Preview" i],[data-netlify-drawer],#netlify-drawer,netlify-drawer,netlify-toolbar{display:none!important;visibility:hidden!important;pointer-events:none!important}';(document.head||document.documentElement).append(style);removePreviewChrome();new MutationObserver(removePreviewChrome).observe(document.documentElement,{childList:true,subtree:true});
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
    const route = normalizedPath(url.pathname);
    if (!INTERNAL_PATHS.has(route)) { callback({}); return; }
    const normalized = normalizeInternalDesktopUrl(url);
    if (normalized.toString() === url.toString()) { callback({}); return; }
    callback({ redirectURL: normalized.toString() });
  });
}

app.on('web-contents-created', (_event, contents) => {
  installNavigationAuthority(contents);
  installDesktopSettingsAuthority(contents);
  installDesktopMeetingIdentityBootstrap(contents);
  installPreviewChromeSuppression(contents);
});

app.whenReady().then(() => {
  installLocalDesktopRuntime();
  installPreviewRequestNormalization();
}).catch(() => {});

export const DominionDesktopNavigationAuthority = Object.freeze({
  isDominionDesktopHost,
  normalizedPath,
  internalPaths: Object.freeze([...INTERNAL_PATHS]),
  accountReturnPaths: Object.freeze([...ACCOUNT_RETURN_PATHS]),
  localRuntimeRelativePath,
  resolveLocalRuntimeFile,
  resolveDesktopHostIdentity
});
