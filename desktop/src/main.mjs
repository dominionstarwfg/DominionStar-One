import { app, BrowserWindow, Menu, Notification, session, shell, systemPreferences, desktopCapturer, ipcMain, screen as electronScreen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ORIGIN = 'https://dominionstarld.com';
const MEET_URL = `${APP_ORIGIN}/meet/?desktop=1`;
const MEET_HOME_URL = `${APP_ORIGIN}/meet-home/?desktop=1`;
const MEMBER_LOGIN_URL = `${APP_ORIGIN}/meet-login/?desktop=1&mode=member`;
const HOME_URL = MEET_HOME_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let recoveryAttempts = 0;
const pendingDisplaySelections = new Map();
let activeShareDisplayId = '';
let remoteInputQueue = Promise.resolve();

app.enableSandbox();

function isDominionStarUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_ORIGIN && ['https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isDesktopRoute(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_ORIGIN && ['/meet/', '/meet-home/', '/meet-login/', '/member-login/'].includes(url.pathname);
  } catch { return false; }
}

function loadLauncher() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  return mainWindow.loadFile(path.join(__dirname, 'launcher.html'));
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

function installPermissionPolicy() {
  const ses = session.defaultSession;
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
      callback({});
      return;
    }
    try {
      const contentsId = mainWindow?.webContents?.id;
      const selection = pendingDisplaySelections.get(contentsId);
      pendingDisplaySelections.delete(contentsId);
      if (!selection?.sourceId) return callback({});
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: true
      });
      const source = sources.find(item => item.id === selection.sourceId);
      if(source)activeShareDisplayId=String(source.display_id||selection.displayId||'');
      callback(source ? { video: source, ...(selection.audio ? { audio: 'loopback' } : {}) } : {});
    } catch {
      callback({});
    }
  });
}

function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'DominionStar',
      submenu: [
        { label: 'Meet Home', accelerator: 'CmdOrCtrl+1', click: loadLauncher },
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
    title: 'DominionStar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
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
    if (details.reason === 'clean-exit') return;
    recoveryAttempts += 1;
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      recoveryAttempts <= 3 ? mainWindow.reload() : loadOffline();
    }, Math.min(800 * recoveryAttempts, 3000));
  });
  mainWindow.webContents.on('did-finish-load', () => {
    recoveryAttempts = 0;
    if (!mainWindow.webContents.getURL().startsWith('file:')) mainWindow.webContents.executeJavaScript(`(() => {
      if (document.getElementById('dominionDesktopHome')) return;
      const button=document.createElement('button');
      button.id='dominionDesktopHome'; button.type='button'; button.textContent='⌂  Home';
      button.setAttribute('aria-label','Return to DominionStar Meet Home');
      Object.assign(button.style,{position:'fixed',top:'14px',left:'14px',zIndex:'2147483647',border:'1px solid #c9a33d',borderRadius:'999px',padding:'9px 14px',background:'#111827',color:'#fff',font:'600 13px system-ui',boxShadow:'0 5px 18px #0004',cursor:'pointer'});
      button.addEventListener('click',()=>window.dominionDesktop?.goHome()); document.body.append(button);
    })()`).catch(()=>{});
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
  if (deepLink) mainWindow?.loadURL(resolveDeepLink(deepLink));
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});

ipcMain.on('desktop:home', loadLauncher);
ipcMain.handle('desktop:share-sources', async (event) => {
  if (!isDesktopRoute(event.sender.getURL())) return [];
  const sources = await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:360,height:220},fetchWindowIcons:true});
  return sources.map(source=>({id:source.id,name:source.name,thumbnail:source.thumbnail?.toDataURL?.()||'',icon:source.appIcon?.toDataURL?.()||'',kind:source.id.startsWith('screen:')?'screen':'window',displayId:String(source.display_id||'')}));
});
ipcMain.handle('desktop:select-share-source', (event, selection={}) => {
  if (!isDesktopRoute(event.sender.getURL())) return false;
  pendingDisplaySelections.set(event.sender.id,{sourceId:String(selection.sourceId||''),displayId:String(selection.displayId||''),audio:Boolean(selection.audio)});
  return true;
});
ipcMain.handle('desktop:remote-control-permission', event => {
  if(!isDesktopRoute(event.sender.getURL()))return {ok:false,reason:'untrusted-route'};
  if(process.platform==='darwin'&&!systemPreferences.isTrustedAccessibilityClient(true))return {ok:false,reason:'accessibility-permission-required'};
  return {ok:true};
});
ipcMain.handle('desktop:remote-input', async (event, input={}) => {
  if(!isDesktopRoute(event.sender.getURL()))return false;
  if(process.platform==='darwin'&&!systemPreferences.isTrustedAccessibilityClient(false))return false;
  const safe={type:String(input.type||''),x:Math.max(0,Math.min(1,Number(input.x)||0)),y:Math.max(0,Math.min(1,Number(input.y)||0)),button:String(input.button||'left'),deltaY:Math.max(-20,Math.min(20,Number(input.deltaY)||0)),key:String(input.key||'').slice(0,20)};
  remoteInputQueue=remoteInputQueue.then(async()=>{
    const native=await import('@nut-tree-fork/nut-js');
    const display=electronScreen.getAllDisplays().find(item=>String(item.id)===activeShareDisplayId)||electronScreen.getPrimaryDisplay();
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
  mainWindow?.loadURL(resolveDeepLink(url));
});

app.whenReady().then(async () => {
  app.setAsDefaultProtocolClient('dominionstar');
  installPermissionPolicy();
  Menu.setApplicationMenu(createMenu());
  await requestMacMediaAccess();
  const deepLink = process.argv.find((value) => value.startsWith('dominionstar://'));
  // A normal app launch always begins at the desktop identity chooser. Only an
  // explicit dominionstar:// meeting link may bypass the launcher.
  await createWindow(deepLink ? resolveDeepLink(deepLink) : '');
  if (Notification.isSupported()) new Notification({ title: 'DominionStar', body: 'Desktop is ready.' }).show();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
