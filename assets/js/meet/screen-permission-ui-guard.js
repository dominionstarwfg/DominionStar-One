(() => {
  'use strict';
  if (window.DominionScreenPermissionUIGuard) return;
  if (!window.dominionDesktop?.isDesktop || window.dominionDesktop?.platform !== 'darwin') return;

  const SETTINGS_OPENED_KEY = 'ds.screenPermission.settingsOpenedAt';
  const PERMISSION_FLOW_KEY = 'ds.screenPermission.permissionFlowAt';
  const RELAUNCH_KEY = 'ds.screenPermission.relaunchAt';
  const RECENT_SETTINGS_MS = 5 * 60 * 1000;
  const RECENT_PERMISSION_FLOW_MS = 2 * 60 * 1000;
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

  const permissionFlowWasActive = () => (
    recent(SETTINGS_OPENED_KEY, RECENT_SETTINGS_MS)
    || recent(PERMISSION_FLOW_KEY, RECENT_PERMISSION_FLOW_MS)
  );

  const relaunchOnceAfterPermissionFlow = async () => {
    if (focusBusy || !permissionFlowWasActive()) return false;
    if (recent(RELAUNCH_KEY, RECENT_RELAUNCH_MS)) {
      clearStamp(SETTINGS_OPENED_KEY);
      clearStamp(PERMISSION_FLOW_KEY);
      return false;
    }
    focusBusy = true;
    try {
      const panel = visiblePermissionPanel();
      if (!panel) return false;

      // A macOS-owned Screen Recording prompt can send the user to Privacy &
      // Security without ever clicking DominionStar's own settings button. The
      // blur/focus permission-flow stamp therefore matters just as much as our
      // explicit settings button. One controlled relaunch gives Electron the
      // TCC state that the newly granted session requires.
      writeStamp(RELAUNCH_KEY, Date.now());
      clearStamp(SETTINGS_OPENED_KEY);
      clearStamp(PERMISSION_FLOW_KEY);
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

    if (granted && result?.requiresRestart && !recent(RELAUNCH_KEY, RECENT_RELAUNCH_MS)) {
      writeStamp(PERMISSION_FLOW_KEY, Date.now());
      void relaunchOnceAfterPermissionFlow();
      return;
    }

    if (!granted) return;

    const badge = panel.querySelector('[data-permission-badge]');
    const title = panel.querySelector('[data-permission-title]');
    const copy = panel.querySelector('[data-permission-copy]');
    const note = panel.querySelector('[data-permission-note]');
    const settings = panel.querySelector('[data-open-settings]');
    const restart = panel.querySelector('[data-restart-app]');

    // Granted access is never represented as a permission request. If source
    // enumeration still fails after the controlled relaunch, report the real
    // capture failure and retry source enumeration instead of looping the user
    // back through Privacy & Security.
    if (recent(RELAUNCH_KEY, RECENT_RELAUNCH_MS)) {
      if (badge) badge.textContent = 'CAPTURE INITIALIZATION';
      if (title) title.textContent = 'Screen access is active';
      if (copy) copy.textContent = 'macOS Screen Recording access is granted, but the current source list did not initialize.';
      if (note) note.textContent = 'Retry Capture. DominionStar Meet will request the screen and window list again; changing the permission is not required.';
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
      if (title) title.textContent = 'Applying screen access';
      if (copy) copy.textContent = 'macOS has granted Screen Recording access to DominionStar Meet.';
      if (note) note.textContent = 'DominionStar Meet is applying the permission to this meeting session.';
      if (settings) settings.hidden = true;
      writeStamp(PERMISSION_FLOW_KEY, Date.now());
      void relaunchOnceAfterPermissionFlow();
    }
  };

  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-open-settings]')) return;
    writeStamp(SETTINGS_OPENED_KEY, Date.now());
    writeStamp(PERMISSION_FLOW_KEY, Date.now());
  }, true);

  // Apple's own Screen Recording alert can open System Settings without going
  // through the DominionStar button. If the app loses focus while the screen
  // permission panel is visible, remember that a permission flow is active.
  window.addEventListener('blur', () => {
    if (visiblePermissionPanel()) writeStamp(PERMISSION_FLOW_KEY, Date.now());
  });

  window.addEventListener('focus', () => {
    setTimeout(() => {
      void relaunchOnceAfterPermissionFlow().then(relaunched => {
        if (!relaunched) void enforceGrantedState();
      });
    }, 350);
  });

  const observer = new MutationObserver(() => { void enforceGrantedState(); });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });

  window.DominionScreenPermissionUIGuard = Object.freeze({
    version: '1.1.0',
    enforceGrantedState,
    snapshot: () => ({
      settingsOpenedRecently: recent(SETTINGS_OPENED_KEY, RECENT_SETTINGS_MS),
      permissionFlowRecently: recent(PERMISSION_FLOW_KEY, RECENT_PERMISSION_FLOW_MS),
      relaunchedRecently: recent(RELAUNCH_KEY, RECENT_RELAUNCH_MS)
    })
  });
})();
