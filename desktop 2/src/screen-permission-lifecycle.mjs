import { app, desktopCapturer, ipcMain, systemPreferences } from 'electron';

const TRUSTED_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);
const QA_PREVIEW_HOST = /^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;

function isTrustedDesktopRenderer(event) {
  try {
    const url = new URL(String(event?.sender?.getURL?.() || ''));
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return TRUSTED_HOSTS.has(host) || QA_PREVIEW_HOST.test(host);
  } catch {
    return false;
  }
}

function rawScreenPermission() {
  if (process.platform !== 'darwin') return 'granted';
  try { return String(systemPreferences.getMediaAccessStatus('screen') || 'unknown').toLowerCase(); }
  catch { return 'unknown'; }
}

const initialScreenPermission = rawScreenPermission();

async function probeCaptureReadiness() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen','window'],
      thumbnailSize: { width: 160, height: 90 },
      fetchWindowIcons: process.platform === 'win32'
    });
    const screenCount = sources.filter(source => String(source.id || '').startsWith('screen:')).length;
    const windowCount = Math.max(0, sources.length - screenCount);
    const previewCount = sources.filter(source => {
      try { return source.thumbnail && !source.thumbnail.isEmpty(); }
      catch { return false; }
    }).length;
    return {
      ready: sources.length > 0 && previewCount > 0,
      sourceCount: sources.length,
      screenCount,
      windowCount,
      previewCount
    };
  } catch (error) {
    return {
      ready: false,
      sourceCount: 0,
      screenCount: 0,
      windowCount: 0,
      previewCount: 0,
      error: String(error?.message || error)
    };
  }
}

function blockedStatus(raw) {
  return {
    ok: true,
    platform: process.platform,
    screen: raw,
    rawScreen: raw,
    initialScreen: initialScreenPermission,
    changedSinceLaunch: raw !== initialScreenPermission,
    requiresRestart: false,
    captureReady: false,
    sourceCount: 0,
    screenCount: 0,
    windowCount: 0,
    previewCount: 0,
    captureError: 'screen-permission-not-granted'
  };
}

async function readScreenPermission() {
  const raw = rawScreenPermission();

  if (process.platform !== 'darwin') {
    const capture = await probeCaptureReadiness();
    return {
      ok: true,
      platform: process.platform,
      screen: 'granted',
      rawScreen: 'granted',
      initialScreen: 'granted',
      changedSinceLaunch: false,
      requiresRestart: false,
      captureReady: capture.ready,
      sourceCount: capture.sourceCount,
      screenCount: capture.screenCount,
      windowCount: capture.windowCount,
      previewCount: capture.previewCount,
      captureError: capture.error || ''
    };
  }

  // Never probe desktopCapturer while macOS still reports Screen Recording as
  // not granted. Probing in that state can invoke the native permission sheet
  // repeatedly and leave the renderer behind a modal permission flow.
  if (raw !== 'granted') return blockedStatus(raw);

  // macOS applies a newly granted Screen & System Audio Recording permission
  // to a fresh application process. Once the setting changes during this run,
  // require one clean relaunch before any capture enumeration occurs.
  if (initialScreenPermission !== 'granted') {
    return {
      ok: true,
      platform: process.platform,
      screen: 'granted',
      rawScreen: raw,
      initialScreen: initialScreenPermission,
      changedSinceLaunch: true,
      requiresRestart: true,
      captureReady: false,
      sourceCount: 0,
      screenCount: 0,
      windowCount: 0,
      previewCount: 0,
      captureError: 'restart-required-after-screen-permission-change'
    };
  }

  const capture = await probeCaptureReadiness();
  return {
    ok: true,
    platform: process.platform,
    screen: 'granted',
    rawScreen: raw,
    initialScreen: initialScreenPermission,
    changedSinceLaunch: false,
    requiresRestart: false,
    captureReady: capture.ready,
    sourceCount: capture.sourceCount,
    screenCount: capture.screenCount,
    windowCount: capture.windowCount,
    previewCount: capture.previewCount,
    captureError: capture.error || ''
  };
}

ipcMain.handle('desktop:screen-permission-status', async event => {
  if (!isTrustedDesktopRenderer(event)) {
    return {
      ok: false,
      platform: process.platform,
      screen: 'denied',
      rawScreen: 'denied',
      initialScreen: initialScreenPermission,
      changedSinceLaunch: false,
      requiresRestart: false,
      captureReady: false,
      sourceCount: 0,
      screenCount: 0,
      windowCount: 0,
      previewCount: 0
    };
  }
  return readScreenPermission();
});

ipcMain.handle('desktop:relaunch-for-permissions', event => {
  if (!isTrustedDesktopRenderer(event)) return false;
  if (process.platform !== 'darwin') return false;
  app.relaunch();
  setImmediate(() => app.exit(0));
  return true;
});

export const DominionScreenPermissionLifecycle = Object.freeze({
  readScreenPermission,
  probeCaptureReadiness
});
