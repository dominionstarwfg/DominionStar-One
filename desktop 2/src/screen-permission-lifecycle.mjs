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
  if (process.platform !== 'darwin') return { ready: true, sourceCount: 1, previewCount: 1 };
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 160, height: 90 },
      fetchWindowIcons: false
    });
    const previewCount = sources.filter(source => {
      try { return source.thumbnail && !source.thumbnail.isEmpty(); }
      catch { return false; }
    }).length;
    return {
      ready: sources.length > 0 && previewCount > 0,
      sourceCount: sources.length,
      previewCount
    };
  } catch (error) {
    return {
      ready: false,
      sourceCount: 0,
      previewCount: 0,
      error: String(error?.message || error)
    };
  }
}

async function readScreenPermission() {
  const raw = rawScreenPermission();
  const capture = await probeCaptureReadiness();
  if (process.platform !== 'darwin') {
    return {
      ok: true,
      platform: process.platform,
      screen: 'granted',
      rawScreen: 'granted',
      initialScreen: 'granted',
      changedSinceLaunch: false,
      requiresRestart: false,
      captureReady: true,
      sourceCount: capture.sourceCount,
      previewCount: capture.previewCount
    };
  }

  // Real capture output is the strongest signal. macOS/TCC status can lag after
  // a user enables Screen Recording, especially during unsigned QA builds. If
  // Electron can already enumerate non-empty screen previews, do not send the
  // user back to System Settings and do not request a pointless relaunch.
  if (capture.ready) {
    return {
      ok: true,
      platform: process.platform,
      screen: 'granted',
      rawScreen: raw,
      initialScreen: initialScreenPermission,
      changedSinceLaunch: raw !== initialScreenPermission,
      requiresRestart: false,
      captureReady: true,
      sourceCount: capture.sourceCount,
      previewCount: capture.previewCount
    };
  }

  const changedSinceLaunch = raw !== initialScreenPermission;
  return {
    ok: true,
    platform: process.platform,
    screen: raw,
    rawScreen: raw,
    initialScreen: initialScreenPermission,
    changedSinceLaunch,
    requiresRestart: initialScreenPermission !== 'granted' && raw === 'granted',
    captureReady: false,
    sourceCount: capture.sourceCount,
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
