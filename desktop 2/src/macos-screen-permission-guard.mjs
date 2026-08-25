import { desktopCapturer, shell, systemPreferences } from 'electron';

let screenSettingsVisitedThisLaunch = false;
const originalOpenExternal = shell.openExternal.bind(shell);
const originalGetSources = desktopCapturer.getSources.bind(desktopCapturer);

function isScreenRecordingSettingsUrl(value = '') {
  const target = String(value || '');
  return target.startsWith('x-apple.systempreferences:') && /Privacy_ScreenCapture/i.test(target);
}

function screenPermissionStatus() {
  if (process.platform !== 'darwin') return 'granted';
  try { return String(systemPreferences.getMediaAccessStatus('screen') || 'unknown').toLowerCase(); }
  catch { return 'unknown'; }
}

// macOS applies Screen & System Audio Recording changes to a process lifetime.
// DominionStar never probes desktopCapturer while Screen Recording is denied or
// undecided. That avoids macOS repeatedly presenting its native recording sheet
// behind the branded picker and leaving the meeting UI apparently frozen.
// Once the user visits the Privacy pane, one clean app relaunch is required
// before any further capture enumeration is allowed in that process.
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

    const permission = screenPermissionStatus();
    if (permission !== 'granted') {
      const error = new Error('DominionStar Meet requires Screen & System Audio Recording permission before screen sources can be enumerated.');
      error.code = 'DOMINIONSTAR_SCREEN_PERMISSION_REQUIRED';
      error.screenPermission = permission;
      throw error;
    }

    return originalGetSources(options);
  };
}

export const DominionMacScreenPermissionGuard = Object.freeze({
  settingsVisited: () => screenSettingsVisitedThisLaunch,
  restartRequired: () => process.platform === 'darwin' && screenSettingsVisitedThisLaunch,
  screenPermissionStatus
});
