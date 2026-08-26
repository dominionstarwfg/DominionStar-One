import { app, BrowserWindow, ipcMain } from 'electron';

let dockGuardTimer = null;
let sharing = false;
let meetingExplicitlyShown = false;

function meetingWindow() {
  return BrowserWindow.getAllWindows().find(win => {
    try {
      if (win.isDestroyed()) return false;
      const url = new URL(String(win.webContents?.getURL?.() || ''));
      const route = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
      return url.protocol === 'https:' && route === '/meet';
    } catch {
      return false;
    }
  }) || null;
}

async function ensureMacDockVisible() {
  if (process.platform !== 'darwin' || !app.dock) return true;
  try {
    if (!app.dock.isVisible()) await app.dock.show();
    return app.dock.isVisible();
  } catch {
    return false;
  }
}

function presenterSender(event) {
  try {
    const url = new URL(String(event?.sender?.getURL?.() || ''));
    return url.protocol === 'file:' && /presenter-toolbar\.html$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function keepMeetingOffSharedDesktop() {
  // Compatibility export only. The approved presentation state keeps Meet visible;
  // native content protection prevents the app surface from leaking into capture.
  return false;
}

function startDockGuard() {
  sharing = true;
  meetingExplicitlyShown = false;
  clearInterval(dockGuardTimer);
  void ensureMacDockVisible();
  dockGuardTimer = setInterval(() => {
    if (!sharing) return;
    void ensureMacDockVisible();
  }, 500);
}

function stopDockGuard() {
  sharing = false;
  meetingExplicitlyShown = false;
  clearInterval(dockGuardTimer);
  dockGuardTimer = null;
  void ensureMacDockVisible();
}

ipcMain.on('desktop:presenter-show', startDockGuard);
ipcMain.on('desktop:presenter-hide', stopDockGuard);
ipcMain.on('desktop:presenter-command', (event, command = '') => {
  if (!presenterSender(event)) return;
  if (String(command || '') === 'show-meeting') meetingExplicitlyShown = true;
});

app.on('activate', () => {
  void ensureMacDockVisible();
});

app.on('before-quit', () => {
  sharing = false;
  meetingExplicitlyShown = false;
  clearInterval(dockGuardTimer);
  dockGuardTimer = null;
});

export const shareLifecycle = Object.freeze({
  ensureMacDockVisible,
  keepMeetingOffSharedDesktop,
  isSharing: () => sharing,
  isMeetingExplicitlyShown: () => meetingExplicitlyShown
});
