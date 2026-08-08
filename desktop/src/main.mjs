import { app, BrowserWindow, Menu, Notification, session, shell, systemPreferences, desktopCapturer } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ORIGIN = 'https://dominionstarld.com';
const MEET_URL = `${APP_ORIGIN}/meet/?desktop=1`;
const MEMBER_LOGIN_URL = `${APP_ORIGIN}/member-login/?next=%2Fmeet%2F%3Fdesktop%3D1`;
const HOME_URL = MEET_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let recoveryAttempts = 0;

app.enableSandbox();

function isDominionStarUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_ORIGIN && ['https:'].includes(url.protocol);
  } catch {
    return false;
  }
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

  // Electron does not expose display capture to a loaded web application until
  // the host app supplies a display-media handler. Prefer the operating system's
  // native picker (macOS/Windows) and retain a safe fallback for older releases.
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isDominionStarUrl(request.securityOrigin || request.frame?.url || '')) {
      callback({});
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: true
      });
      callback(sources[0] ? { video: sources[0] } : {});
    } catch {
      callback({});
    }
  }, { useSystemPicker: true });
}

function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'DominionStar',
      submenu: [
        { label: 'Meet Home', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.loadFile(path.join(__dirname, 'launcher.html')) },
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
    if (isDominionStarUrl(url)) {
      mainWindow.loadURL(url);
    } else if (/^https?:/.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDominionStarUrl(url) || url.startsWith('file:')) return;
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
        mainWindow.loadURL(MEET_URL);
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
  mainWindow.webContents.on('did-finish-load', () => { recoveryAttempts = 0; });

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
  await createWindow(deepLink ? resolveDeepLink(deepLink) : HOME_URL);
  if (Notification.isSupported()) new Notification({ title: 'DominionStar', body: 'Desktop is ready.' }).show();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
