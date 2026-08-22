(() => {
  'use strict';
  if (window.DominionScreenPermissionUIGuard) return;
  if (!window.dominionDesktop?.isDesktop || window.dominionDesktop?.platform !== 'darwin') return;

  const SETTINGS_OPENED_KEY = 'ds.screenPermission.settingsOpenedAt';
  const RELAUNCH_KEY = 'ds.screenPermission.relaunchAt';
  const RECENT_SETTINGS_MS = 5 * 60 * 1000;
  const RECENT_RELAUNCH_MS = 2 * 60 * 1000;
  let focusBusy = false;

  const readStamp = key => {
    try { return Number(localStorage.getItem(key) || 0); } catch { return 0; }
  };
  const writeStamp = (key, value) => {
    try { localStorage.setItem(key, String(value)); } catch {}
  };
  const clearStamp = key => {
    try { localStorage.removeItem(key); } catch {}
  };
  const recent = (key, age) => Date.now() - readStamp(key) < age;

  const permissionDialog = () => document.getElementById('desktopSharePicker');
  const visiblePermissionPanel = () => {
    const dialog = permissionDialog();
    const panel = dialog?.querySelector('[data-permission]');
    return dialog && dialog.open && panel && !panel.hidden ? panel : null;
  };

  const relaunchOnceAfterSettings = async () => {
    if (focusBusy || !recent(SETTINGS_OPENED_KEY, RECENT_SETTINGS_MS)) return false;
    if (recent(RELAUNCH_KEY, RECENT_RELAUNCH_MS)) {
      clearStamp(SETTINGS_OPENED_KEY);
      return false;
    }
    focusBusy = true;
    try {
      // macOS may keep Electron's current-process Screen Recording status stale
      // until the application is restarted. Returning from Privacy & Security is
      // therefore the authoritative signal to perform one controlled relaunch.
      writeStamp(RELAUNCH_KEY, Date.now());
      clearStamp(SETTINGS_OPENED_KEY);
      const accepted = await window.dominionDesktop.relaunchForPermissions?.().catch(() => false);
      if (!accepted) clearStamp(RELAUNCH_KEY);
      return Boolean(accepted);
    } finally {
      focusBusy = false;
    }
  };

  const retryCapture = event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const dialog = permissionDialog();
    try { dialog?.close('cancel'); } catch {}
    setTimeout(() => {
      const share = document.getElementById('shareBtn') || document.getElementById('shareScreenAction');
      share?.click?.();
    }, 140);
  };

  const enforceGrantedState = async () => {
    const panel = visiblePermissionPanel();
    if (!panel) return;
    const result = await window.dominionDesktop.getScreenPermissionStatus?.().catch(() => null);
    const granted = String(result?.screen || '').toLowerCase() === 'granted';
    if (!granted) return;

    const badge = panel.querySelector('[data-permission-badge]');
    const title = panel.querySelector('[data-permission-title]');
    const copy = panel.querySelector('[data-permission-copy]');
    const note = panel.querySelector('[data-permission-note]');
    const settings = panel.querySelector('[data-open-settings]');
    const restart = panel.querySelector('[data-restart-app]');

    // Granted access is never represented as a permission request. If source
    // enumeration still fails after the controlled relaunch, report the real
    // failure and let the user retry capture without revisiting System Settings.
    if (recent(RELAUNCH_KEY, RECENT_RELAUNCH_MS)) {
      if (badge) badge.textContent = 'CAPTURE INITIALIZATION';
      if (title) title.textContent = 'Capture initialization failed';
      if (copy) copy.textContent = 'macOS Screen Recording access is already granted, but DominionStar Meet did not receive the available screen and window sources.';
      if (note) note.textContent = 'Retry Capture. If this repeats, the build fails screen-sharing QA; changing the permission again is not required.';
      if (settings) settings.hidden = true;
      if (restart) {
        restart.hidden = false;
        restart.disabled = false;
        restart.textContent = 'Retry Capture';
        restart.onclick = null;
        restart.addEventListener('click', retryCapture, { capture: true, once: true });
      }
    } else {
      if (badge) badge.textContent = 'SCREEN ACCESS ENABLED';
      if (title) title.textContent = 'Screen access is enabled';
      if (copy) copy.textContent = 'macOS has already granted Screen Recording access to DominionStar Meet.';
      if (note) note.textContent = 'Restart DominionStar Meet once to apply the permission to this running session.';
      if (settings) settings.hidden = true;
    }
  };

  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-open-settings]')) return;
    writeStamp(SETTINGS_OPENED_KEY, Date.now());
  }, true);

  window.addEventListener('focus', () => {
    setTimeout(() => {
      void relaunchOnceAfterSettings().then(relaunched => {
        if (!relaunched) void enforceGrantedState();
      });
    }, 350);
  });

  const observer = new MutationObserver(() => { void enforceGrantedState(); });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });

  window.DominionScreenPermissionUIGuard = Object.freeze({
    version: '1.0.1',
    enforceGrantedState,
    snapshot: () => ({
      settingsOpenedRecently: recent(SETTINGS_OPENED_KEY, RECENT_SETTINGS_MS),
      relaunchedRecently: recent(RELAUNCH_KEY, RECENT_RELAUNCH_MS)
    })
  });
})();
