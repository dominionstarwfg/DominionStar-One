import { app, ipcMain, systemPreferences } from 'electron';

const TRUSTED_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);

function isTrustedDesktopRenderer(event) {
  try {
    const url = new URL(String(event?.sender?.getURL?.() || ''));
    return url.protocol === 'https:' && TRUSTED_HOSTS.has(url.hostname.toLowerCase());
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

function readScreenPermission() {
  const screen = rawScreenPermission();
  if (process.platform !== 'darwin') {
    return {
      ok: true,
      platform: process.platform,
      screen: 'granted',
      initialScreen: 'granted',
      changedSinceLaunch: false,
      requiresRestart: false
    };
  }
  const changedSinceLaunch = screen !== initialScreenPermission;
  return {
    ok: true,
    platform: process.platform,
    screen,
    initialScreen: initialScreenPermission,
    changedSinceLaunch,
    // macOS applies a newly granted Screen Recording entitlement reliably
    // after the app relaunches. A launch that already began granted does not
    // need to be bounced again.
    requiresRestart: initialScreenPermission !== 'granted' && screen === 'granted'
  };
}

ipcMain.handle('desktop:screen-permission-status', event => {
  if (!isTrustedDesktopRenderer(event)) {
    return {
      ok: false,
      platform: process.platform,
      screen: 'denied',
      initialScreen: initialScreenPermission,
      changedSinceLaunch: false,
      requiresRestart: false
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
  readScreenPermission
});
