import {
  app,
  BrowserWindow,
  Menu,
  Notification,
  session,
  shell,
  systemPreferences,
  desktopCapturer,
  ipcMain,
  screen as electronScreen
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { isDominionStarCaptureSource, resolveCaptureSource, visibleCaptureSources } from './capture-source.mjs';
import { CaptureSession } from './capture-session.mjs';
import { resolveDesktopLayout } from './desktop-layout.mjs';
import { loadFreshPage } from './desktop-session.mjs';

const APP_ORIGIN = 'https://dominionstarld.com';
const TRUSTED_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);
const MEET_URL = `${APP_ORIGIN}/meet/?desktop=1`;
const MEET_HOME_URL = `${APP_ORIGIN}/meet-home/?desktop=1`;
const MEMBER_LOGIN_URL = `${APP_ORIGIN}/member-login/?desktop=1`;
const DESKTOP_PARTITION = 'persist:dominionstar-meet';
const DESKTOP_BRIDGE_VERSION = 14;
const HOSTED_NAVIGATION_TIMEOUT_MS = 12000;
const STARTUP_PROBE_PATH = String(process.env.DOMINIONSTAR_STARTUP_PROBE || '');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let presenterWindow = null;
let pendingDeepLink = '';
let consumedAuthCallback = '';
let recoveryAttempts = 0;
let saveWindowTimer = null;
let currentDesktopLayout = null;
let remoteControlCapability = '';
let remoteInputQueue = Promise.resolve();
let lastCaptureFailure = '';
let updaterModule = null;
let updaterLoadPromise = null;
const captureSession = new CaptureSession();

function writeStartupProbe(stage, detail = {}) {
  if (!STARTUP_PROBE_PATH) return;
  const record = {
    stage,
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    at: new Date().toISOString(),
    ...detail
  };
  try {
    fs.appendFileSync(STARTUP_PROBE_PATH, `${JSON.stringify(record)}\n`);
  } catch {}
}

// Electron requires the global sandbox switch before the ready event.
app.enableSandbox();
writeStartupProbe('entry-loaded');

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  writeStartupProbe('secondary-instance-exit');
  app.quit();
}

function isDominionStarUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && TRUSTED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isTrustedRendererUrl(value) {
  if (isDominionStarUrl(value)) return true;
  try {
    return new URL(String(value || '')).protocol === 'file:';
  } catch {
    return false;
  }
}

function isDesktopRoute(value) {
  try {
    const url = new URL(String(value || ''));
    const route = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return isDominionStarUrl(url.toString()) && ['/meet', '/meet-home', '/meet-login', '/member-login'].includes(route);
  } catch {
    return false;
  }
}

function isMeetingMediaRoute(value) {
  try {
    const url = new URL(String(value || ''));
    const route = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return isDominionStarUrl(url.toString()) && route === '/meet';
  } catch {
    return false;
  }
}

function nativeMediaPermissionSnapshot() {
  const granted = { platform: process.platform, camera: 'granted', microphone: 'granted' };
  if (process.platform !== 'darwin') return granted;
  const status = kind => {
    try { return systemPreferences.getMediaAccessStatus(kind); }
    catch { return 'unknown'; }
  };
  return {
    platform: process.platform,
    camera: status('camera'),
    microphone: status('microphone')
  };
}

async function requestNativeMediaPermissions(kinds = []) {
  const requested = new Set(Array.isArray(kinds) ? kinds.map(String) : []);
  if (process.platform !== 'darwin') return nativeMediaPermissionSnapshot();
  for (const kind of ['camera', 'microphone']) {
    if (!requested.has(kind)) continue;
    let current = 'unknown';
    try { current = systemPreferences.getMediaAccessStatus(kind); } catch {}
    if (current !== 'not-determined') continue;
    try { await systemPreferences.askForMediaAccess(kind); } catch {}
  }
  return nativeMediaPermissionSnapshot();
}

function resolveDeepLink(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'dominionstar:') return MEET_HOME_URL;
    if (url.hostname === 'meet') {
      const meeting = url.searchParams.get('meeting') || url.pathname.replace(/^\//, '');
      const target = new URL('/meet/', APP_ORIGIN);
      target.searchParams.set('desktop', '1');
      if (meeting) target.searchParams.set('meeting', meeting.slice(0, 160));
      return target.toString();
    }
    if (url.hostname === 'auth' && url.pathname === '/callback') {
      if (!url.hash || consumedAuthCallback === url.hash) return MEET_HOME_URL;
      consumedAuthCallback = url.hash;
      const target = new URL('/member-login/?desktop=1&oauth=complete', APP_ORIGIN);
      target.hash = url.hash;
      return target.toString();
    }
    return MEET_HOME_URL;
  } catch {
    return MEET_HOME_URL;
  }
}

function registerDeepLinkProtocol() {
  if (process.defaultApp && process.argv[1]) {
    return app.setAsDefaultProtocolClient('dominionstar', process.execPath, [path.resolve(process.argv[1])]);
  }
  return app.setAsDefaultProtocolClient('dominionstar');
}

function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function readWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
    if (!state || !Number.isFinite(state.width) || !Number.isFinite(state.height)) return null;
    const area = electronScreen.getDisplayMatching(state).workArea;
    const width = Math.max(700, Math.min(state.width, area.width));
    const height = Math.max(520, Math.min(state.height, area.height));
    const x = Math.max(area.x, Math.min(Number(state.x) || area.x, area.x + area.width - width));
    const y = Math.max(area.y, Math.min(Number(state.y) || area.y, area.y + area.height - height));
    return { x, y, width, height, maximized: Boolean(state.maximized) };
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getNormalBounds();
    fs.mkdirSync(path.dirname(windowStatePath()), { recursive: true });
    fs.writeFileSync(windowStatePath(), JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }));
  } catch {}
}

function scheduleWindowStateSave() {
  clearTimeout(saveWindowTimer);
  saveWindowTimer = setTimeout(saveWindowState, 350);
}

function publishDesktopLayout() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const bounds = mainWindow.getBounds();
  const workArea = electronScreen.getDisplayMatching(bounds).workArea;
  const layout = resolveDesktopLayout(bounds, workArea, process.platform);
  currentDesktopLayout = layout;
  mainWindow.setAlwaysOnTop(Boolean(layout.alwaysOnTop), 'floating');
  if (!mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('desktop:layout-changed', layout);
  }
  return layout;
}

// Use one display-media handler. DominionStar owns the visible source picker
// on every desktop platform; macOS/Windows remain the underlying capture and
// permission authorities.
function supportsMacSystemPicker() {
  return false;
}

function installPermissionPolicy(desktopSession) {
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
  const mediaPermissions = new Set(['media', 'audioCapture', 'videoCapture', 'microphone', 'camera']);

  desktopSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    const source = details.requestingUrl || webContents?.getURL() || '';
    const trusted = isDominionStarUrl(source) && allowed.has(permission);
    callback(trusted && (!mediaPermissions.has(permission) || isMeetingMediaRoute(source)));
  });

  desktopSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const source = requestingOrigin || webContents?.getURL() || '';
    const trusted = isDominionStarUrl(source) && allowed.has(permission);
    return trusted && (!mediaPermissions.has(permission) || isMeetingMediaRoute(source));
  });

  desktopSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isDominionStarUrl(request.securityOrigin || request.frame?.url || '')) {
      lastCaptureFailure = 'untrusted-origin';
      callback({});
      return;
    }
    if (!request.videoRequested) {
      lastCaptureFailure = 'video-not-requested';
      callback({});
      return;
    }
    try {
      const contentsId = mainWindow?.webContents?.id;
      const selection = captureSession.consume(contentsId);
      if (!selection?.sourceId) {
        lastCaptureFailure = captureSession.lastFailure;
        callback({});
        return;
      }
      const freshSources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false
      });
      const source = resolveCaptureSource(freshSources, selection);
      if (!source) {
        captureSession.fail('source-unavailable');
        lastCaptureFailure = captureSession.lastFailure;
        callback({});
        return;
      }
      const ownSourceId = typeof mainWindow?.getMediaSourceId === 'function' ? mainWindow.getMediaSourceId() : '';
      if (isDominionStarCaptureSource(source, ownSourceId) && !selection.shareOwnWindow) {
        captureSession.fail('own-window-blocked');
        lastCaptureFailure = captureSession.lastFailure;
        callback({});
        return;
      }
      captureSession.activate(source, selection);
      lastCaptureFailure = '';
      callback({
        video: source,
        ...(selection.audio && ['win32', 'darwin'].includes(process.platform) ? { audio: 'loopback' } : {})
      });
      setTimeout(() => {
        mainWindow?.setContentProtection?.(selection.kind === 'screen' && !selection.shareOwnWindow);
      }, 0);
    } catch (error) {
      captureSession.fail(error?.message || 'capture-handler-failed');
      lastCaptureFailure = captureSession.lastFailure;
      callback({});
    }
  }, { useSystemPicker: supportsMacSystemPicker() });
}

function installCertificationInterception(desktopSession) {
  const urls = [
    'https://dominionstarld.com/assets/js/runtime/guardian-certification.js*',
    'https://www.dominionstarld.com/assets/js/runtime/guardian-certification.js*'
  ];
  desktopSession.webRequest.onBeforeRequest({ urls }, (_details, callback) => callback({ cancel: true }));
}

function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'DominionStar',
      submenu: [
        { label: 'Meet Home', accelerator: 'CmdOrCtrl+1', click: () => navigateHosted(MEET_HOME_URL) },
        { label: 'New Meeting', accelerator: 'CmdOrCtrl+Shift+N', click: () => navigateHosted(MEET_URL) },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' }
      ]
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] }
  ]);
}

function loadOffline(reason = 'offline') {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  writeStartupProbe('offline-fallback', { reason });
  mainWindow.loadFile(path.join(__dirname, 'offline.html')).catch(() => {});
}

async function loadLocalShell() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    await mainWindow.loadFile(path.join(__dirname, 'startup-v2.html'));
    if (!mainWindow.isVisible()) mainWindow.show();
    writeStartupProbe('local-shell-shown');
    return true;
  } catch (error) {
    writeStartupProbe('local-shell-failed', { error: String(error?.message || error).slice(0, 200) });
    loadOffline('local-shell-failed');
    return false;
  }
}

async function navigateHosted(target) {
  if (!mainWindow || mainWindow.isDestroyed() || !isDominionStarUrl(target)) return false;
  let timeout = null;
  try {
    await Promise.race([
      loadFreshPage(mainWindow, target),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('hosted-navigation-timeout')), HOSTED_NAVIGATION_TIMEOUT_MS);
      })
    ]);
    writeStartupProbe('hosted-navigation-complete', { target: new URL(target).pathname });
    return true;
  } catch (error) {
    try { mainWindow.webContents.stop(); } catch {}
    loadOffline(String(error?.message || 'hosted-navigation-failed'));
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function configureWindowNavigation(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isDominionStarUrl(url)) {
      void navigateHosted(url);
    } else if (/^https?:/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:') || isDominionStarUrl(url)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });

  win.webContents.on('did-navigate', (_event, url) => {
    try {
      const target = new URL(url);
      if (isDominionStarUrl(url) && ['/member-dashboard/', '/workspace/'].includes(target.pathname)) {
        void navigateHosted(MEET_HOME_URL);
      }
    } catch {}
  });

  win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) loadOffline(`${code}:${description}`);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    captureSession.clear(win.webContents.id);
    captureSession.end();
    if (details.reason === 'clean-exit') return;
    recoveryAttempts += 1;
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (recoveryAttempts <= 2) void loadLocalShell().then(() => navigateHosted(MEET_HOME_URL));
      else loadOffline(`renderer-${details.reason}`);
    }, Math.min(600 * recoveryAttempts, 1800));
  });

  win.webContents.on('did-finish-load', () => {
    recoveryAttempts = 0;
    publishDesktopLayout();
  });
}

async function createMainWindow(initialUrl = MEET_HOME_URL) {
  const saved = readWindowState();
  mainWindow = new BrowserWindow({
    width: saved?.width || 1440,
    height: saved?.height || 900,
    ...(saved ? { x: saved.x, y: saved.y } : {}),
    minWidth: 700,
    minHeight: 520,
    show: true,
    frame: true,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } }
      : { titleBarStyle: 'default' }),
    backgroundColor: '#0b1220',
    title: 'DominionStar Meet',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      partition: DESKTOP_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true
    }
  });

  writeStartupProbe('window-created');
  configureWindowNavigation(mainWindow);

  mainWindow.on('resize', () => { publishDesktopLayout(); scheduleWindowStateSave(); });
  mainWindow.on('move', scheduleWindowStateSave);
  mainWindow.on('maximize', () => { publishDesktopLayout(); scheduleWindowStateSave(); });
  mainWindow.on('unmaximize', () => { publishDesktopLayout(); scheduleWindowStateSave(); });
  mainWindow.on('closed', () => {
    if (presenterWindow && !presenterWindow.isDestroyed()) presenterWindow.destroy();
    presenterWindow = null;
    mainWindow = null;
  });

  if (saved?.maximized) mainWindow.maximize();
  publishDesktopLayout();
  await loadLocalShell();

  await new Promise((resolve) => setTimeout(resolve, 500));
  writeStartupProbe('event-loop-responsive');

  if (STARTUP_PROBE_PATH) {
    setTimeout(() => app.quit(), 50);
    return mainWindow;
  }

  void navigateHosted(initialUrl);
  return mainWindow;
}

function createPresenterWindow() {
  if (presenterWindow && !presenterWindow.isDestroyed()) return presenterWindow;
  presenterWindow = new BrowserWindow({
    width: 930,
    height: 76,
    minWidth: 270,
    minHeight: 48,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'presenter-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  presenterWindow.setContentProtection(true);
  presenterWindow.setAlwaysOnTop(true, 'floating');
  presenterWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void presenterWindow.loadFile(path.join(__dirname, 'presenter-toolbar.html'));
  presenterWindow.on('closed', () => { presenterWindow = null; });
  return presenterWindow;
}

function showPresenterWindow() {
  const win = createPresenterWindow();
  const display = electronScreen.getDisplayNearestPoint(electronScreen.getCursorScreenPoint());
  const bounds = display.workArea;
  const size = win.getSize();
  win.setPosition(Math.round(bounds.x + (bounds.width - size[0]) / 2), bounds.y + 18, false);
  win.showInactive();
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.showInactive();
}

function hidePresenterWindow({ restoreMeeting = false } = {}) {
  if (presenterWindow && !presenterWindow.isDestroyed()) presenterWindow.hide();
  if (restoreMeeting && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

async function ensureUpdaterLoaded() {
  if (updaterModule) return updaterModule;
  if (!updaterLoadPromise) {
    updaterLoadPromise = import('./desktop-updater.mjs')
      .then((module) => {
        updaterModule = module;
        module.initializeDesktopUpdater({
          app,
          windowProvider: () => mainWindow,
          notify: (body) => {
            if (Notification.isSupported()) {
              new Notification({ title: 'DominionStar Meet update', body }).show();
            }
          }
        });
        return module;
      })
      .catch(() => null);
  }
  return updaterLoadPromise;
}

function scheduleUpdaterInitialization() {
  setTimeout(() => { void ensureUpdaterLoaded(); }, 15000);
}

ipcMain.on('desktop:home', (event) => {
  if (!isTrustedRendererUrl(event.sender.getURL())) return;
  void navigateHosted(MEET_HOME_URL);
});

ipcMain.on('desktop:account-chooser', (event) => {
  if (!isTrustedRendererUrl(event.sender.getURL())) return;
  void navigateHosted(MEMBER_LOGIN_URL);
});

ipcMain.on('desktop:presenter-show', (event) => {
  if (!isDesktopRoute(event.sender.getURL())) return;
  showPresenterWindow();
});

ipcMain.on('desktop:presenter-hide', (event) => {
  if (!isDesktopRoute(event.sender.getURL())) return;
  hidePresenterWindow({ restoreMeeting: true });
});

ipcMain.on('desktop:presenter-command', (event, command = '') => {
  if (event.sender !== presenterWindow?.webContents) return;
  const allowed = new Set(['audio', 'video', 'participants', 'chat', 'reactions', 'pause', 'new-share', 'more', 'stop']);
  const safe = String(command || '');
  if (allowed.has(safe) && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:presenter-command', safe);
  }
});

ipcMain.on('desktop:presenter-resize', (event, size = {}) => {
  if (event.sender !== presenterWindow?.webContents || !presenterWindow || presenterWindow.isDestroyed()) return;
  const width = Math.max(270, Math.min(930, Number(size.width) || 930));
  const height = Math.max(48, Math.min(370, Number(size.height) || 76));
  const bounds = presenterWindow.getBounds();
  presenterWindow.setBounds({
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: bounds.y,
    width: Math.round(width),
    height: Math.round(height)
  }, true);
});

ipcMain.handle('desktop:media-permissions', (event) => {
  if (!isMeetingMediaRoute(event.sender.getURL())) {
    return { ok: false, platform: process.platform, camera: 'denied', microphone: 'denied' };
  }
  return { ok: true, ...nativeMediaPermissionSnapshot() };
});

ipcMain.handle('desktop:request-media-permissions', async (event, kinds = []) => {
  if (!isMeetingMediaRoute(event.sender.getURL())) {
    return { ok: false, platform: process.platform, camera: 'denied', microphone: 'denied' };
  }
  const result = await requestNativeMediaPermissions(kinds);
  return { ok: true, ...result };
});

ipcMain.handle('desktop:runtime-info', (event) => {
  if (!isTrustedRendererUrl(event.sender.getURL())) return null;
  const appVersion = app.getVersion();
  return {
    bridgeVersion: DESKTOP_BRIDGE_VERSION,
    version: appVersion,
    appVersion,
    buildVersion: appVersion,
    electronVersion: process.versions.electron,
    platform: process.platform,
    persistentSession: true,
    customSharePicker: !supportsMacSystemPicker(),
    systemSharePicker: supportsMacSystemPicker(),
    supportsSystemAudioShare: ['win32', 'darwin'].includes(process.platform),
    layout: currentDesktopLayout || publishDesktopLayout()
  };
});

ipcMain.handle('desktop:window-layout', (event) => (
  isTrustedRendererUrl(event.sender.getURL()) ? (currentDesktopLayout || publishDesktopLayout()) : null
));

ipcMain.handle('desktop:update-status', async (event) => {
  if (!isTrustedRendererUrl(event.sender.getURL())) return null;
  const module = await ensureUpdaterLoaded();
  return module ? module.desktopUpdateStatus() : { state: 'unavailable', version: app.getVersion(), progress: 0, error: '' };
});

ipcMain.handle('desktop:check-update', async (event) => {
  if (!isTrustedRendererUrl(event.sender.getURL())) return false;
  const module = await ensureUpdaterLoaded();
  if (!module) return false;
  return module.checkForDesktopUpdate().then(() => true).catch(() => false);
});

ipcMain.handle('desktop:install-update', async (event) => {
  if (!isTrustedRendererUrl(event.sender.getURL())) return false;
  const module = await ensureUpdaterLoaded();
  return module ? module.installDesktopUpdate() : false;
});

ipcMain.handle('desktop:open-external', async (event, value = '') => {
  if (!isTrustedRendererUrl(event.sender.getURL())) return false;
  try {
    const target = new URL(String(value || ''));
    if (target.protocol !== 'https:') return false;
    await shell.openExternal(target.toString());
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('desktop:share-sources', async (event, options = {}) => {
  if (!isDesktopRoute(event.sender.getURL())) return [];
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 384, height: 240 },
      fetchWindowIcons: false
    });
    const ownSourceId = typeof mainWindow?.getMediaSourceId === 'function' ? mainWindow.getMediaSourceId() : '';
    return visibleCaptureSources(sources, {
      includeOwnWindows: Boolean(options.includeOwnWindows),
      ownSourceId
    }).map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail?.toDataURL?.() || '',
      icon: source.appIcon?.toDataURL?.() || '',
      kind: source.id.startsWith('screen:') ? 'screen' : 'window',
      displayId: String(source.display_id || ''),
      ownWindow: isDominionStarCaptureSource(source, ownSourceId)
    }));
  } catch (error) {
    lastCaptureFailure = error?.message || 'source-enumeration-failed';
    return [];
  }
});

ipcMain.handle('desktop:open-screen-settings', async (event) => {
  if (!isDesktopRoute(event.sender.getURL()) || process.platform !== 'darwin') return false;
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  return true;
});

ipcMain.handle('desktop:select-share-source', (event, selection = {}) => {
  if (!isDesktopRoute(event.sender.getURL())) return false;
  const sourceId = String(selection.sourceId || '');
  const kind = String(selection.kind || '');
  if (!sourceId || !/^(screen|window):/.test(sourceId) || !['screen', 'window'].includes(kind)) return false;
  const selected = captureSession.select(event.sender.id, {
    ...selection,
    audio: Boolean(selection.audio) && ['win32', 'darwin'].includes(process.platform)
  });
  if (!selected) return false;
  lastCaptureFailure = '';
  return true;
});

ipcMain.handle('desktop:capture-status', (event) => {
  if (!isDesktopRoute(event.sender.getURL())) return { ok: false, screen: 'denied', systemAudio: false };
  const screenStatus = process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted';
  return {
    ok: screenStatus === 'granted',
    screen: screenStatus,
    systemAudio: ['win32', 'darwin'].includes(process.platform),
    platform: process.platform,
    lastFailure: lastCaptureFailure
  };
});

ipcMain.handle('desktop:end-share', (event) => {
  if (!isDesktopRoute(event.sender.getURL())) return false;
  captureSession.end();
  remoteControlCapability = '';
  mainWindow?.setContentProtection?.(false);
  hidePresenterWindow({ restoreMeeting: true });
  return true;
});

ipcMain.handle('desktop:remote-control-permission', (event, context = {}) => {
  if (!isDesktopRoute(event.sender.getURL())) return { ok: false, reason: 'untrusted-route' };
  if (captureSession.active.kind !== 'screen' || !String(context.requestId || '').trim() || !String(context.requesterId || '').trim()) {
    return { ok: false, reason: 'no-active-control-request' };
  }
  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) {
    return { ok: false, reason: 'accessibility-permission-required' };
  }
  remoteControlCapability = randomUUID();
  return { ok: true, capability: remoteControlCapability };
});

ipcMain.handle('desktop:remote-input', async (event, input = {}) => {
  if (!isDesktopRoute(event.sender.getURL())) return false;
  if (captureSession.active.kind !== 'screen' || !remoteControlCapability || String(input.capability || '') !== remoteControlCapability) return false;
  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) return false;

  const safe = {
    type: String(input.type || ''),
    x: Math.max(0, Math.min(1, Number(input.x) || 0)),
    y: Math.max(0, Math.min(1, Number(input.y) || 0)),
    button: String(input.button || 'left'),
    deltaY: Math.max(-20, Math.min(20, Number(input.deltaY) || 0)),
    key: String(input.key || '').slice(0, 20)
  };

  remoteInputQueue = remoteInputQueue.then(async () => {
    const native = await import('@nut-tree-fork/nut-js');
    const display = electronScreen.getAllDisplays().find((item) => String(item.id) === captureSession.active.displayId)
      || electronScreen.getPrimaryDisplay();
    const point = new native.Point(
      Math.round(display.bounds.x + safe.x * display.bounds.width),
      Math.round(display.bounds.y + safe.y * display.bounds.height)
    );
    native.mouse.config.autoDelayMs = 0;
    if (['move', 'down', 'up', 'click'].includes(safe.type)) await native.mouse.setPosition(point);
    const button = safe.button === 'right' ? native.Button.RIGHT : safe.button === 'middle' ? native.Button.MIDDLE : native.Button.LEFT;
    if (safe.type === 'down') await native.mouse.pressButton(button);
    if (safe.type === 'up') await native.mouse.releaseButton(button);
    if (safe.type === 'click') await (button === native.Button.RIGHT ? native.mouse.rightClick() : native.mouse.leftClick());
    if (safe.type === 'wheel' && safe.deltaY) {
      await (safe.deltaY > 0
        ? native.mouse.scrollDown(Math.ceil(Math.abs(safe.deltaY)))
        : native.mouse.scrollUp(Math.ceil(Math.abs(safe.deltaY))));
    }
    if (safe.type === 'key' && safe.key) {
      const map = {
        Enter: native.Key.Enter,
        Escape: native.Key.Escape,
        Backspace: native.Key.Backspace,
        Delete: native.Key.Delete,
        Tab: native.Key.Tab,
        ArrowUp: native.Key.Up,
        ArrowDown: native.Key.Down,
        ArrowLeft: native.Key.Left,
        ArrowRight: native.Key.Right,
        ' ': native.Key.Space
      };
      const key = map[safe.key];
      if (key !== undefined) await native.keyboard.type(key);
      else if (safe.key.length === 1) await native.keyboard.type(safe.key);
    }
  }).catch(() => {});

  await remoteInputQueue;
  return true;
});

app.on('second-instance', (_event, argv) => {
  const deepLink = argv.find((value) => value.startsWith('dominionstar://'));
  if (deepLink) {
    if (mainWindow && !mainWindow.isDestroyed()) void navigateHosted(resolveDeepLink(deepLink));
    else pendingDeepLink = deepLink;
  }
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.show();
  mainWindow?.focus();
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) void navigateHosted(resolveDeepLink(url));
  else pendingDeepLink = url;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow(MEET_HOME_URL);
  } else {
    mainWindow?.show();
    mainWindow?.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function startApplication() {
  writeStartupProbe('app-ready');
  registerDeepLinkProtocol();

  const desktopSession = session.fromPartition(DESKTOP_PARTITION);
  installCertificationInterception(desktopSession);
  installPermissionPolicy(desktopSession);
  Menu.setApplicationMenu(createMenu());

  const deepLink = pendingDeepLink || process.argv.find((value) => value.startsWith('dominionstar://'));
  pendingDeepLink = '';
  const initialUrl = deepLink ? resolveDeepLink(deepLink) : MEET_HOME_URL;

  await createMainWindow(initialUrl);
  if (STARTUP_PROBE_PATH) return;

  scheduleUpdaterInitialization();
  if (Notification.isSupported()) {
    new Notification({ title: 'DominionStar Meet', body: 'Desktop is ready.' }).show();
  }
}

app.whenReady().then(startApplication).catch((error) => {
  writeStartupProbe('fatal-startup-error', { error: String(error?.stack || error).slice(0, 1000) });
  try {
    if (mainWindow && !mainWindow.isDestroyed()) loadOffline('fatal-startup-error');
  } finally {
    if (STARTUP_PROBE_PATH) setTimeout(() => app.exit(1), 50);
  }
});