import { desktopCapturer, shell } from 'electron';

let screenSettingsVisitedThisLaunch = false;
const originalOpenExternal = shell.openExternal.bind(shell);
const originalGetSources = desktopCapturer.getSources.bind(desktopCapturer);

function isScreenRecordingSettingsUrl(value = '') {
  const target = String(value || '');
  return target.startsWith('x-apple.systempreferences:') && /Privacy_ScreenCapture/i.test(target);
}

// macOS applies Screen & System Audio Recording changes to a process lifetime.
// Once we send the user to that Privacy pane, the current process is no longer
// allowed to probe desktopCapturer again. A second probe can make macOS show the
// native permission sheet again, blocking every meeting control and looking like
// a frozen renderer. DominionStar instead requires one clean relaunch.
if (process.platform === 'darwin') {
  shell.openExternal = async (value, ...args) => {
    if (isScreenRecordingSettingsUrl(value)) screenSettingsVisitedThisLaunch = true;
    return originalOpenExternal(value, ...args);
  };

  desktopCapturer.getSources = async options => {
    if (screenSettingsVisitedThisLaunch) {
      const error = new Error('DominionStar Meet must restart once after Screen & System Audio Recording settings change.');
      error.code = 'DOMINIONSTAR_SCREEN_PERMISSION_RESTART_REQUIRED';
      throw error;
    }
    return originalGetSources(options);
  };
}

export const DominionMacScreenPermissionGuard = Object.freeze({
  settingsVisited: () => screenSettingsVisitedThisLaunch,
  restartRequired: () => process.platform === 'darwin' && screenSettingsVisitedThisLaunch
});
