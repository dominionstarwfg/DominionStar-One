(() => {
  'use strict';
  if (window.DominionOperation2030Bootstrap) return;

  const loaded = new Map();
  const load = (src, marker, { after = null } = {}) => {
    if (loaded.has(marker)) return loaded.get(marker);
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      const promise = existing.dataset.dsLoaded === '1'
        ? Promise.resolve(existing)
        : new Promise(resolve => {
            existing.addEventListener('load', () => resolve(existing), { once: true });
            existing.addEventListener('error', () => resolve(existing), { once: true });
            setTimeout(() => resolve(existing), 4500);
          });
      loaded.set(marker, promise);
      return promise;
    }
    const start = after ? Promise.resolve(after).catch(() => null) : Promise.resolve();
    const promise = start.then(() => new Promise(resolve => {
      const script = document.createElement('script');
      script.src = src;
      script.setAttribute(marker, '1');
      script.addEventListener('load', () => { script.dataset.dsLoaded = '1'; resolve(script); }, { once: true });
      script.addEventListener('error', () => resolve(script), { once: true });
      document.head.append(script);
    }));
    loaded.set(marker, promise);
    return promise;
  };

  const annotation = load('/assets/js/meet/share-annotation.js?v=2-operation-2030-certified', 'data-ds-share-annotation');
  const verticalAnnotationUi = load('/assets/js/meet/annotation-vertical-ui.js?v=1-approved-zoom-rail', 'data-ds-annotation-vertical-ui', { after: annotation });
  const presenterCommandParity = load('/assets/js/meet/presenter-command-web-parity.js?v=1-approved-presenter-actions', 'data-ds-presenter-command-parity', { after: annotation });
  const microphoneIdentity = load('/assets/js/meet/microphone-device-identity.js?v=1-hardware-identity', 'data-ds-microphone-device-identity');
  const quickDeviceMenuParity = load('/assets/js/meet/quick-device-menu-parity.js?v=1-zoom-class-device-menu', 'data-ds-quick-device-menu-parity');
  const receiverSideLayout = load('/assets/js/meet/receiver-side-layout-parity.js?v=1-zoom-class-side-by-side', 'data-ds-receiver-side-layout');
  const hostCohostUiParity = load('/assets/js/meet/host-cohost-ui-parity.js?v=1-authority-copy', 'data-ds-host-cohost-ui-parity');
  const spotlight = load('/assets/js/meet/share-spotlight.js?v=2-operation-2030-certified', 'data-ds-share-spotlight');
  const handoff = load('/assets/js/meet/presentation-handoff.js?v=2-operation-2030-certified', 'data-ds-presentation-handoff');
  const arbitration = load('/assets/js/meet/share-arbitration.js?v=2-operation-2030-certified', 'data-ds-share-arbitration');
  const arbitrationUi = load('/assets/js/meet/share-arbitration-ui.js?v=2-operation-2030-certified', 'data-ds-share-arbitration-ui', { after: arbitration });
  const identitySettings = load('/assets/js/meet/meeting-identity-settings.js?v=2-operation-2030-certified', 'data-ds-meeting-identity-settings');
  const identityBridge = load('/assets/js/meet/meeting-identity-bridge.js?v=2-operation-2030-certified', 'data-ds-meeting-identity-bridge', { after: identitySettings });
  const cameraPolish = load('/assets/js/meet/camera-reaction-polish.js?v=3-operation-2030-certified', 'data-ds-camera-reaction-polish');
  const dockPolish = load('/assets/js/meet/dock-polish-2030.js?v=2-operation-2030-certified', 'data-ds-dock-polish-2030');
  const nativeDockQuality = load('/assets/js/meet/native-dock-quality.js?v=1-operation-2030-hd-dock', 'data-ds-native-dock-quality');
  const screenPermissionGuard = load('/assets/js/meet/screen-permission-ui-guard.js?v=1-operation-2030-permission-state', 'data-ds-screen-permission-ui-guard');
  const shareWatchdog = load('/assets/js/meet/remote-share-watchdog.js?v=2-operation-2030-certified', 'data-ds-remote-share-watchdog');
  const backgroundEffects = load('/assets/js/meet/background-effects-2030.js?v=2-operation-2030-certified', 'data-ds-background-effects-2030');
  const shareUi = load('/assets/js/meet/share-ui-2030.js?v=2-operation-2030-certified', 'data-ds-share-ui-2030');

  const ready = Promise.all([
    annotation, verticalAnnotationUi, presenterCommandParity, microphoneIdentity, quickDeviceMenuParity, receiverSideLayout, hostCohostUiParity, spotlight, handoff, arbitration, arbitrationUi,
    identitySettings, identityBridge, cameraPolish, dockPolish, nativeDockQuality, screenPermissionGuard,
    shareWatchdog, backgroundEffects, shareUi
  ]);

  window.DominionOperation2030Bootstrap = Object.freeze({
    version: '1.8.0',
    ready,
    modules: Object.freeze([
      'share-annotation','annotation-vertical-ui','presenter-command-web-parity','microphone-device-identity','quick-device-menu-parity','receiver-side-layout-parity','host-cohost-ui-parity','share-spotlight','presentation-handoff','share-arbitration','share-arbitration-ui',
      'meeting-identity-settings','meeting-identity-bridge','camera-reaction-polish','dock-polish-2030','native-dock-quality','screen-permission-ui-guard',
      'remote-share-watchdog','background-effects-2030','share-ui-2030'
    ])
  });
})();
