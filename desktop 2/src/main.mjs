import { app, BrowserWindow, Menu, Notification, session, shell, systemPreferences, desktopCapturer, ipcMain, screen as electronScreen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { isDominionStarCaptureSource, resolveCaptureSource, visibleCaptureSources } from './capture-source.mjs';
import { CaptureSession } from './capture-session.mjs';

const APP_ORIGIN = 'https://dominionstarld.com';
const MEET_URL = `${APP_ORIGIN}/meet/?desktop=1`;
const MEET_HOME_URL = `${APP_ORIGIN}/meet-home/?desktop=1`;
const MEMBER_LOGIN_URL = `${APP_ORIGIN}/meet-login/?desktop=1&mode=member`;
const HOME_URL = MEET_HOME_URL;
const DESKTOP_PARTITION = 'persist:dominionstar-meet';
const DESKTOP_BRIDGE_VERSION = 7;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let pendingDeepLink = '';
let consumedAuthCallback = '';
let recoveryAttempts = 0;
const captureSession = new CaptureSession();
let remoteControlCapability = '';
let remoteInputQueue = Promise.resolve();
let lastCaptureFailure = '';

app.enableSandbox();

function registerDeepLinkProtocol() {
  if (process.defaultApp && process.argv[1]) {
    return app.setAsDefaultProtocolClient('dominionstar', process.execPath, [path.resolve(process.argv[1])]);
  }
  return app.setAsDefaultProtocolClient('dominionstar');
}

function isDominionStarUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['dominionstarld.com','www.dominionstarld.com'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isDesktopRoute(value) {
  try {
    const url = new URL(value);
    const route = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return isDominionStarUrl(url.toString()) && ['/meet', '/meet-home', '/meet-login', '/member-login'].includes(route);
  } catch { return false; }
}

function loadMeetHome() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // The persistent Electron partition keeps the Supabase session. Meet Home
  // redirects to sign-in only when that session is actually absent/expired.
  return mainWindow.loadURL(MEET_HOME_URL);
}

function loadAccountChooser() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  return mainWindow.loadFile(path.join(__dirname, 'launcher.html'), {
    query: { memberLogin: MEMBER_LOGIN_URL, meet: MEET_URL }
  });
}

function resolveDeepLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'dominionstar:') return HOME_URL;
    if (url.hostname === 'meet') {
      const meeting = url.searchParams.get('meeting') || url.pathname.replace(/^\//, '');
      const target = new URL('/meet/', APP_ORIGIN);
      if (meeting) target.searchParams.set('meeting', meeting.slice(0, 160));
      return target.toString();
    }
    if (url.hostname === 'auth' && url.pathname === '/callback') {
      if (!url.hash || consumedAuthCallback === url.hash) return HOME_URL;
      consumedAuthCallback = url.hash;
      const target = new URL('/meet-login/?desktop=1&oauth=complete', APP_ORIGIN);
      // Supabase's short-lived session tokens arrive in the URL fragment. They
      // are only loaded into the trusted Meet origin and never sent to a server.
      target.hash = url.hash;
      return target.toString();
    }
    return HOME_URL;
  } catch {
    return HOME_URL;
  }
}

async function requestMacMediaAccess() {
  if (process.platform !== 'darwin') return;
  for (const mediaType of ['microphone', 'camera']) {
    const status = systemPreferences.getMediaAccessStatus(mediaType);
    if (status === 'not-determined') await systemPreferences.askForMediaAccess(mediaType);
  }
}

function installPermissionPolicy(ses) {
  const allowed = new Set([
    'media',
    'audioCapture',
    'videoCapture',
    'display-capture',
    'microphone',
    'camera',
    'notifications',
    'fullscreen'
  ]);
  const approve = (webContents, permission, callback, details = {}) => {
    const source = details.requestingUrl || webContents?.getURL() || '';
    callback(isDominionStarUrl(source) && allowed.has(permission));
  };
  ses.setPermissionRequestHandler(approve);
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => (
    isDominionStarUrl(requestingOrigin || webContents?.getURL() || '') && allowed.has(permission)
  ));

  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isDominionStarUrl(request.securityOrigin || request.frame?.url || '')) {
      lastCaptureFailure='untrusted-origin';
      callback({});
      return;
    }
    if(!request.videoRequested){lastCaptureFailure='video-not-requested';callback({});return;}
    try {
      const contentsId = mainWindow?.webContents?.id;
      const selection = captureSession.consume(contentsId);
      if (!selection?.sourceId) {
        lastCaptureFailure=captureSession.lastFailure;
        return callback({});
      }
      // Source objects returned while drawing the picker can be stale by the
      // time Chromium requests capture, especially after a macOS Space/window
      // change. Resolve the chosen id again at the exact capture boundary.
      const freshSources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0},fetchWindowIcons:false});
      const source=resolveCaptureSource(freshSources,selection);
      if(!source){captureSession.fail('source-unavailable');lastCaptureFailure=captureSession.lastFailure;return callback({});}
      const ownSourceId=typeof mainWindow?.getMediaSourceId==='function'?mainWindow.getMediaSourceId():'';
      if(isDominionStarCaptureSource(source,ownSourceId)&&!selection.shareOwnWindow){captureSession.fail('own-window-blocked');lastCaptureFailure=captureSession.lastFailure;return callback({});}
      captureSession.activate(source,selection);
      lastCaptureFailure='';
      callback({video:source,...(selection.audio&&['win32','darwin'].includes(process.platform)?{audio:'loopback'}:{})});
      // Exclude DominionStar's own window only after the selected capture was
      // accepted; changing protection before callback can invalidate a source.
      setTimeout(()=>mainWindow?.setContentProtection?.(selection.kind==='screen'&&!selection.shareOwnWindow),0);
    } catch (error) {
      captureSession.fail(error?.message||'capture-handler-failed');
      lastCaptureFailure=captureSession.lastFailure;
      callback({});
    }
  });
}

function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'DominionStar',
      submenu: [
        { label: 'Meet Home', accelerator: 'CmdOrCtrl+1', click: loadMeetHome },
        { label: 'New Meeting', accelerator: 'CmdOrCtrl+Shift+N', click: () => mainWindow?.loadURL(MEET_URL) },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' }
      ]
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] }
  ]);
}

function loadOffline() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadFile(path.join(__dirname, 'offline.html'));
}

async function createWindow(initialUrl = '') {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#f4f7fb',
    title: 'DominionStar Meet',
    webPreferences: {
      // Sandboxed preload scripts use Electron's supported CommonJS loader.
      preload: path.join(__dirname, 'preload.cjs'),
      partition: DESKTOP_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isDesktopRoute(url)) {
      mainWindow.loadURL(url);
    } else if (/^https?:/.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDesktopRoute(url) || url.startsWith('file:')) return;
    event.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  mainWindow.webContents.on('did-navigate', (_event, url) => {
    try {
      const target = new URL(url);
      // The desktop product owns the meeting experience only. If the existing
      // member login sends a user to its normal web dashboard, carry the valid
      // signed-in session directly into Meet instead.
      if (target.origin === APP_ORIGIN && ['/member-dashboard/', '/workspace/'].includes(target.pathname)) {
        shell.openExternal(target.toString());
        mainWindow.loadURL(MEET_HOME_URL);
      }
    } catch {}
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) loadOffline();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    captureSession.clear(mainWindow?.webContents?.id);
    captureSession.end();
    if (details.reason === 'clean-exit') return;
    recoveryAttempts += 1;
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      recoveryAttempts <= 3 ? mainWindow.reload() : loadOffline();
    }, Math.min(800 * recoveryAttempts, 3000));
  });
  mainWindow.webContents.on('did-finish-load', () => {
    recoveryAttempts = 0;
  });

  if (initialUrl && isDominionStarUrl(initialUrl)) {
    await mainWindow.loadURL(initialUrl).catch(loadOffline);
  } else {
    await mainWindow.loadFile(path.join(__dirname, 'launcher.html'), {
      query: { memberLogin: MEMBER_LOGIN_URL, meet: MEET_URL }
    }).catch(loadOffline);
  }
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

app.on('second-instance', (_event, argv) => {
  const deepLink = argv.find((value) => value.startsWith('dominionstar://'));
  if (deepLink) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(resolveDeepLink(deepLink));
    else pendingDeepLink=deepLink;
  }
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});

ipcMain.on('desktop:home', loadMeetHome);
ipcMain.on('desktop:account-chooser', event => {
  if (!isDominionStarUrl(event.sender.getURL())) return;
  loadAccountChooser();
});
ipcMain.handle('desktop:runtime-info', event => {
  if (!isDominionStarUrl(event.sender.getURL())) return null;
  return {bridgeVersion:DESKTOP_BRIDGE_VERSION,appVersion:app.getVersion(),platform:process.platform,persistentSession:true,customSharePicker:true,supportsSystemAudioShare:['win32','darwin'].includes(process.platform)};
});
ipcMain.handle('desktop:open-external', async (event, value='') => {
  if(!isDominionStarUrl(event.sender.getURL()))return false;
  try{const target=new URL(String(value));if(target.protocol!=='https:')return false;await shell.openExternal(target.toString());return true;}catch{return false;}
});
ipcMain.handle('desktop:share-sources', async (event, options={}) => {
  if (!isDesktopRoute(event.sender.getURL())) return [];
  const screenStatus=process.platform==='darwin'?systemPreferences.getMediaAccessStatus('screen'):'granted';
  if(screenStatus==='denied'||screenStatus==='restricted')return [];
  const sources = await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:480,height:300},fetchWindowIcons:true});
  const ownSourceId=typeof mainWindow?.getMediaSourceId==='function'?mainWindow.getMediaSourceId():'';
  return visibleCaptureSources(sources,{includeOwnWindows:Boolean(options.includeOwnWindows),ownSourceId}).map(source=>({id:source.id,name:source.name,thumbnail:source.thumbnail?.toDataURL?.()||'',icon:source.appIcon?.toDataURL?.()||'',kind:source.id.startsWith('screen:')?'screen':'window',displayId:String(source.display_id||''),ownWindow:isDominionStarCaptureSource(source,ownSourceId)}));
});
ipcMain.handle('desktop:open-screen-settings', async event => {
  if(!isDesktopRoute(event.sender.getURL())||process.platform!=='darwin')return false;
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  return true;
});
ipcMain.handle('desktop:select-share-source', (event, selection={}) => {
  if (!isDesktopRoute(event.sender.getURL())) return false;
  const sourceId=String(selection.sourceId||'');
  if(!sourceId||!/^screen:|^window:/.test(sourceId))return false;
  const kind=String(selection.kind||'');
  if(!['screen','window'].includes(kind))return false;
  const selected=captureSession.select(event.sender.id,{...selection,audio:Boolean(selection.audio)&&['win32','darwin'].includes(process.platform)});
  if(!selected)return false;
  lastCaptureFailure='';
  return true;
});
ipcMain.handle('desktop:capture-status', event => {
  if(!isDesktopRoute(event.sender.getURL()))return {ok:false,screen:'denied',systemAudio:false};
  const screenStatus=process.platform==='darwin'?systemPreferences.getMediaAccessStatus('screen'):'granted';
  return {ok:screenStatus==='granted',screen:screenStatus,systemAudio:['win32','darwin'].includes(process.platform),platform:process.platform,lastFailure:lastCaptureFailure};
});
ipcMain.handle('desktop:end-share', event => {
  if(!isDesktopRoute(event.sender.getURL()))return false;
  captureSession.end();
  remoteControlCapability='';
  mainWindow?.setContentProtection?.(false);
  return true;
});
ipcMain.handle('desktop:remote-control-permission', (event, context={}) => {
  if(!isDesktopRoute(event.sender.getURL()))return {ok:false,reason:'untrusted-route'};
  if(captureSession.active.kind!=='screen'||!String(context.requestId||'').trim()||!String(context.requesterId||'').trim())return {ok:false,reason:'no-active-control-request'};
  if(process.platform==='darwin'&&!systemPreferences.isTrustedAccessibilityClient(true))return {ok:false,reason:'accessibility-permission-required'};
  remoteControlCapability=randomUUID();
  return {ok:true,capability:remoteControlCapability};
});
ipcMain.handle('desktop:remote-input', async (event, input={}) => {
  if(!isDesktopRoute(event.sender.getURL()))return false;
  if(captureSession.active.kind!=='screen'||!remoteControlCapability||String(input.capability||'')!==remoteControlCapability)return false;
  if(process.platform==='darwin'&&!systemPreferences.isTrustedAccessibilityClient(false))return false;
  const safe={type:String(input.type||''),x:Math.max(0,Math.min(1,Number(input.x)||0)),y:Math.max(0,Math.min(1,Number(input.y)||0)),button:String(input.button||'left'),deltaY:Math.max(-20,Math.min(20,Number(input.deltaY)||0)),key:String(input.key||'').slice(0,20)};
  remoteInputQueue=remoteInputQueue.then(async()=>{
    const native=await import('@nut-tree-fork/nut-js');
    const display=electronScreen.getAllDisplays().find(item=>String(item.id)===captureSession.active.displayId)||electronScreen.getPrimaryDisplay();
    const point=new native.Point(Math.round(display.bounds.x+safe.x*display.bounds.width),Math.round(display.bounds.y+safe.y*display.bounds.height));
    native.mouse.config.autoDelayMs=0;
    if(['move','down','up','click'].includes(safe.type))await native.mouse.setPosition(point);
    const button=safe.button==='right'?native.Button.RIGHT:safe.button==='middle'?native.Button.MIDDLE:native.Button.LEFT;
    if(safe.type==='down')await native.mouse.pressButton(button);
    if(safe.type==='up')await native.mouse.releaseButton(button);
    if(safe.type==='click')await (button===native.Button.RIGHT?native.mouse.rightClick():native.mouse.leftClick());
    if(safe.type==='wheel'&&safe.deltaY)await (safe.deltaY>0?native.mouse.scrollDown(Math.ceil(Math.abs(safe.deltaY))):native.mouse.scrollUp(Math.ceil(Math.abs(safe.deltaY))));
    if(safe.type==='key'&&safe.key){const map={Enter:native.Key.Enter,Escape:native.Key.Escape,Backspace:native.Key.Backspace,Delete:native.Key.Delete,Tab:native.Key.Tab,ArrowUp:native.Key.Up,ArrowDown:native.Key.Down,ArrowLeft:native.Key.Left,ArrowRight:native.Key.Right,' ':native.Key.Space};const key=map[safe.key];if(key!==undefined)await native.keyboard.type(key);else if(safe.key.length===1)await native.keyboard.type(safe.key);}
  }).catch(()=>{});
  await remoteInputQueue;return true;
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(resolveDeepLink(url));
  else pendingDeepLink=url;
});

app.whenReady().then(async () => {
  registerDeepLinkProtocol();
  installPermissionPolicy(session.fromPartition(DESKTOP_PARTITION));
  Menu.setApplicationMenu(createMenu());
  await requestMacMediaAccess();
  const deepLink = pendingDeepLink || process.argv.find((value) => value.startsWith('dominionstar://'));
  pendingDeepLink='';
  // Resume the signed-in Meet account on normal launches. Meet Home sends a
  // signed-out or expired session to the account chooser automatically.
  await createWindow(deepLink ? resolveDeepLink(deepLink) : MEET_HOME_URL);
  if (Notification.isSupported()) new Notification({ title: 'DominionStar Meet', body: 'Desktop is ready.' }).show();
});

app.on('activate', () => {
  // Reopening the app from the macOS Dock must follow the same session-resume
  // path as a cold launch. Calling createWindow() without a URL falls back to
  // the signed-out account chooser and makes an authenticated user start over.
  if (BrowserWindow.getAllWindows().length === 0) createWindow(MEET_HOME_URL);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
