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

function readScreenPermission() {
  if (process.platform !== 'darwin') {
    return { ok: true, platform: process.platform, screen: 'granted', requiresRestart: false };
  }
  let screen = 'unknown';
  try { screen = systemPreferences.getMediaAccessStatus('screen'); } catch {}
  return {
    ok: true,
    platform: process.platform,
    screen,
    requiresRestart: ['denied', 'restricted'].includes(String(screen || '').toLowerCase())
  };
}

ipcMain.handle('desktop:screen-permission-status', event => {
  if (!isTrustedDesktopRenderer(event)) {
    return { ok: false, platform: process.platform, screen: 'denied', requiresRestart: false };
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
