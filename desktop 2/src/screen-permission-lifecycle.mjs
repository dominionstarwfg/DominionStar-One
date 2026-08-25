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
    // Use the same Electron desktopCapturer path on macOS and Windows. Do not
    // declare Windows healthy merely because it lacks macOS TCC semantics.
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

async function readScreenPermission() {
  const raw = rawScreenPermission();

  // macOS applies Screen & System Audio Recording permission to a process
  // lifetime. If access changed from non-granted to granted after launch, do
  // not immediately call desktopCapturer again in that stale process. Doing so
  // can trigger the native permission sheet a second time and make the meeting
  // appear frozen. Require exactly one clean relaunch first.
  if (process.platform === 'darwin' && initialScreenPermission !== 'granted' && raw === 'granted') {
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

  if (process.platform !== 'darwin') {
    // Windows does not use macOS Screen Recording TCC. Keep permission semantics
    // granted, but report the real desktopCapturer health independently so the
    // picker can diagnose an unavailable capture backend instead of lying.
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

  // Real capture output is the strongest signal once the process has launched
  // with permission already active. TCC status can be imperfect in unsigned QA,
  // so usable source previews remain authoritative in that case.
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
      screenCount: capture.screenCount,
      windowCount: capture.windowCount,
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
    requiresRestart: false,
    captureReady: false,
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
