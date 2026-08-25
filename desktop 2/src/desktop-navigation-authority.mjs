import { app, net, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DESKTOP_PARTITION='persist:dominionstar-meet';
const PRODUCTION_HOSTS=new Set(['dominionstarld.com','www.dominionstarld.com']);
const QA_PREVIEW_HOST=/^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;
const INTERNAL_PATHS=new Set(['/meet','/meet-home','/meet-login','/member-login']);
const ACCOUNT_RETURN_PATHS=new Set(['/member-dashboard','/workspace']);
const __dirname=path.dirname(fileURLToPath(import.meta.url));

function normalizedPath(pathname='/'){const value=String(pathname||'/');return value.length>1?value.replace(/\/+$/,''):value;}
function isDominionDesktopHost(hostname=''){const host=String(hostname||'').toLowerCase();return PRODUCTION_HOSTS.has(host)||QA_PREVIEW_HOST.test(host);}
function desktopHomeFor(url){const target=new URL('/meet-home/',url.origin);target.searchParams.set('desktop','1');if(QA_PREVIEW_HOST.test(target.hostname))target.searchParams.set('ntl-drawer-state','hidden');return target.toString();}
function normalizeInternalDesktopUrl(url){const target=new URL(url.toString());target.searchParams.set('desktop','1');if(QA_PREVIEW_HOST.test(target.hostname))target.searchParams.set('ntl-drawer-state','hidden');return target;}
function desktopRuntimeRoot(){return app.isPackaged?path.join(process.resourcesPath,'desktop-runtime'):path.resolve(__dirname,'..','..');}

function localRuntimeRelativePath(url){
  let rawPath;try{rawPath=decodeURIComponent(String(url.pathname||'/'));}catch{return '';}
  const route=normalizedPath(rawPath);
  if(route==='/meet-home'&&url.searchParams.get('desktop')==='1')return 'meet-home/desktop.html';
  if(INTERNAL_PATHS.has(route))return `${route.slice(1)}/index.html`;
  if(rawPath.startsWith('/assets/'))return rawPath.slice(1);
  if(rawPath.startsWith('/meet/'))return rawPath.slice(1);
  if(rawPath==='/styles.css')return 'styles.css';
  return '';
}

function resolveLocalRuntimeFile(url){
  const relative=localRuntimeRelativePath(url);if(!relative)return '';
  const root=desktopRuntimeRoot();const candidate=path.resolve(root,relative);const containment=path.relative(root,candidate);
  if(!containment||containment.startsWith('..')||path.isAbsolute(containment))return '';
  try{return fs.statSync(candidate).isFile()?candidate:'';}catch{return '';}
}

function installLocalDesktopRuntime(){
  const desktopSession=session.fromPartition(DESKTOP_PARTITION);
  desktopSession.protocol.handle('https',async request=>{
    let url;try{url=new URL(String(request.url||''));}catch{return desktopSession.fetch(request,{bypassCustomProtocolHandlers:true});}
    if(!isDominionDesktopHost(url.hostname)||!['GET','HEAD'].includes(String(request.method||'GET').toUpperCase()))return desktopSession.fetch(request,{bypassCustomProtocolHandlers:true});
    const candidate=resolveLocalRuntimeFile(url);if(!candidate)return desktopSession.fetch(request,{bypassCustomProtocolHandlers:true});
    try{return net.fetch(pathToFileURL(candidate).toString(),{method:String(request.method||'GET').toUpperCase()==='HEAD'?'HEAD':'GET'});}catch{return desktopSession.fetch(request,{bypassCustomProtocolHandlers:true});}
  });
}

function installNavigationAuthority(contents){
  if(!contents||contents.isDestroyed?.())return;
  contents.on('will-navigate',(event,rawUrl)=>{
    let url;try{url=new URL(String(rawUrl||''));}catch{return;}
    if(url.protocol==='file:')return;
    if(url.protocol!=='https:'||!isDominionDesktopHost(url.hostname))return;
    const route=normalizedPath(url.pathname);
    if(ACCOUNT_RETURN_PATHS.has(route)){event.preventDefault();void contents.loadURL(desktopHomeFor(url)).catch(()=>{});return;}
    if(!INTERNAL_PATHS.has(route)){event.preventDefault();void shell.openExternal(url.toString()).catch(()=>{});return;}
    const normalized=normalizeInternalDesktopUrl(url);
    if(normalized.toString()!==url.toString()){event.preventDefault();void contents.loadURL(normalized.toString()).catch(()=>{});}
  });
}

// Personal Room identity is chosen by the single Home controller. The native
// navigation layer only converts that explicit URL into the existing host
// pre-join API; it never reads or invents account state itself.
function installDesktopMeetingIdentityBootstrap(contents){
  if(!contents||contents.isDestroyed?.())return;
  const apply=()=>{
    let current;try{current=new URL(String(contents.getURL?.()||''));}catch{return;}
    if(!isDominionDesktopHost(current.hostname)||normalizedPath(current.pathname)!=='/meet'||current.searchParams.get('desktop')!=='1')return;
    const action=current.searchParams.get('action')||'';if(!['desktop-new','desktop-share'].includes(action))return;
    const room=String(current.searchParams.get('room')||'').replace(/\D/g,'').slice(0,10);if(room.length!==10)return;
    const script=`(()=>{if(window.__dsDesktopPersonalRoomBootstrapInstalled)return;window.__dsDesktopPersonalRoomBootstrapInstalled=true;const params=new URLSearchParams(location.search);const room=String(params.get('room')||'').replace(/\\D/g,'').slice(0,10);if(room.length!==10)return;const start=()=>{if(typeof window.DominionStarEnterHostPrejoin!=='function')return false;window.DominionStarEnterHostPrejoin({room,passcode:String(params.get('passcode')||''),waitingRoom:params.get('waiting')==='1',autoShare:params.get('action')==='desktop-share'});window.__DS_DESKTOP_PERSONAL_ROOM_BOOTSTRAP='explicit-home-identity-v3';return true;};if(start())return;let attempts=0;const timer=setInterval(()=>{attempts+=1;if(start()||attempts>=40)clearInterval(timer);},75);})();`;
    void contents.executeJavaScript(script,true).catch(()=>{});
  };
  contents.on('dom-ready',apply);
}

function installPreviewChromeSuppression(contents){
  if(!contents||contents.isDestroyed?.())return;
  const suppress=()=>{
    let current;try{current=new URL(String(contents.getURL?.()||''));}catch{return;}if(!QA_PREVIEW_HOST.test(current.hostname))return;
    const script=`(()=>{if(window.__dsNetlifyPreviewSuppressionV3)return;window.__dsNetlifyPreviewSuppressionV3=true;const remove=()=>{for(const iframe of Array.from(document.querySelectorAll('iframe'))){const src=String(iframe.getAttribute('src')||'').toLowerCase();const title=String(iframe.getAttribute('title')||'').toLowerCase();if(src.includes('app.netlify.com')||(src.includes('netlify.com')&&title.includes('netlify'))||title.includes('deploy preview'))iframe.remove();}for(const node of Array.from(document.querySelectorAll('[data-netlify-drawer],#netlify-drawer,netlify-drawer,netlify-toolbar')))node.remove();};const style=document.createElement('style');style.textContent='iframe[src*="app.netlify.com"],iframe[title*="Deploy Preview" i],[data-netlify-drawer],#netlify-drawer,netlify-drawer,netlify-toolbar{display:none!important;visibility:hidden!important;pointer-events:none!important}';(document.head||document.documentElement).append(style);remove();new MutationObserver(remove).observe(document.documentElement,{childList:true,subtree:true});})();`;
    void contents.executeJavaScript(script,true).catch(()=>{});
  };
  contents.on('dom-ready',suppress);contents.on('did-navigate-in-page',suppress);
}

function installPreviewRequestNormalization(){
  const desktopSession=session.fromPartition(DESKTOP_PARTITION);
  desktopSession.webRequest.onBeforeRequest({urls:['https://*/*']},(details,callback)=>{
    if(details.resourceType!=='mainFrame'){callback({});return;}
    let url;try{url=new URL(String(details.url||''));}catch{callback({});return;}
    if(!QA_PREVIEW_HOST.test(url.hostname)||!INTERNAL_PATHS.has(normalizedPath(url.pathname))){callback({});return;}
    const normalized=normalizeInternalDesktopUrl(url);if(normalized.toString()===url.toString()){callback({});return;}callback({redirectURL:normalized.toString()});
  });
}

app.on('web-contents-created',(_event,contents)=>{installNavigationAuthority(contents);installDesktopMeetingIdentityBootstrap(contents);installPreviewChromeSuppression(contents);});
app.whenReady().then(()=>{installLocalDesktopRuntime();installPreviewRequestNormalization();}).catch(()=>{});

export const DominionDesktopNavigationAuthority=Object.freeze({isDominionDesktopHost,normalizedPath,internalPaths:Object.freeze([...INTERNAL_PATHS]),accountReturnPaths:Object.freeze([...ACCOUNT_RETURN_PATHS]),localRuntimeRelativePath,resolveLocalRuntimeFile});