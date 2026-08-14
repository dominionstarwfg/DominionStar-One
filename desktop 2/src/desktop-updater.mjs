import updater from 'electron-updater';

const { autoUpdater } = updater;
let status = { state: 'idle', version: '', progress: 0, error: '' };
let emit = () => {};

export function initializeDesktopUpdater({ app, windowProvider, notify }) {
  if (!app.isPackaged) {
    status = { ...status, state: 'development', version: app.getVersion() };
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  emit = (next) => {
    status = { ...status, ...next };
    const window = windowProvider?.();
    if (window && !window.isDestroyed()) {
      window.webContents.send('desktop:update-status', status);
    }
  };

  autoUpdater.on('checking-for-update', () => emit({ state: 'checking', error: '' }));
  autoUpdater.on('update-available', (info) => emit({ state: 'downloading', version: info.version, progress: 0 }));
  autoUpdater.on('update-not-available', () => emit({ state: 'current', version: app.getVersion(), progress: 100 }));
  autoUpdater.on('download-progress', (progress) => emit({ state: 'downloading', progress: Math.round(progress.percent || 0) }));
  autoUpdater.on('update-downloaded', (info) => {
    emit({ state: 'ready', version: info.version, progress: 100 });
    notify?.(`DominionStar Meet ${info.version} is ready. It will install when you close the app.`);
  });
  autoUpdater.on('error', (error) => emit({ state: 'error', error: String(error?.message || error).slice(0, 240) }));
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 12000);
}

export const desktopUpdateStatus = () => ({ ...status });
export const checkForDesktopUpdate = () => autoUpdater.checkForUpdates();
export const installDesktopUpdate = () => {
  if (status.state !== 'ready') return false;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
};
