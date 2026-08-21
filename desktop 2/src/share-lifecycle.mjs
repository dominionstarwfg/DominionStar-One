import { app, ipcMain } from 'electron';

let dockGuardTimer = null;
let sharing = false;

async function ensureMacDockVisible() {
  if (process.platform !== 'darwin' || !app.dock) return true;
  try {
    if (!app.dock.isVisible()) await app.dock.show();
    return app.dock.isVisible();
  } catch {
    return false;
  }
}

function startDockGuard() {
  sharing = true;
  clearInterval(dockGuardTimer);
  void ensureMacDockVisible();
  dockGuardTimer = setInterval(() => {
    if (sharing) void ensureMacDockVisible();
  }, 750);
}

function stopDockGuard() {
  sharing = false;
  clearInterval(dockGuardTimer);
  dockGuardTimer = null;
  void ensureMacDockVisible();
}

ipcMain.on('desktop:presenter-show', startDockGuard);
ipcMain.on('desktop:presenter-hide', stopDockGuard);

app.on('activate', () => {
  void ensureMacDockVisible();
});

app.on('before-quit', () => {
  sharing = false;
  clearInterval(dockGuardTimer);
  dockGuardTimer = null;
});

export const shareLifecycle = Object.freeze({
  ensureMacDockVisible,
  isSharing: () => sharing
});
