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
  const spotlight = load('/assets/js/meet/share-spotlight.js?v=2-operation-2030-certified', 'data-ds-share-spotlight');
  const handoff = load('/assets/js/meet/presentation-handoff.js?v=2-operation-2030-certified', 'data-ds-presentation-handoff');
  const arbitration = load('/assets/js/meet/share-arbitration.js?v=2-operation-2030-certified', 'data-ds-share-arbitration');
  const arbitrationUi = load('/assets/js/meet/share-arbitration-ui.js?v=2-operation-2030-certified', 'data-ds-share-arbitration-ui', { after: arbitration });
  const identitySettings = load('/assets/js/meet/meeting-identity-settings.js?v=2-operation-2030-certified', 'data-ds-meeting-identity-settings');
  const identityBridge = load('/assets/js/meet/meeting-identity-bridge.js?v=2-operation-2030-certified', 'data-ds-meeting-identity-bridge', { after: identitySettings });
  const cameraPolish = load('/assets/js/meet/camera-reaction-polish.js?v=3-operation-2030-certified', 'data-ds-camera-reaction-polish');
  const dockPolish = load('/assets/js/meet/dock-polish-2030.js?v=2-operation-2030-certified', 'data-ds-dock-polish-2030');
  const shareWatchdog = load('/assets/js/meet/remote-share-watchdog.js?v=2-operation-2030-certified', 'data-ds-remote-share-watchdog');
  const backgroundEffects = load('/assets/js/meet/background-effects-2030.js?v=2-operation-2030-certified', 'data-ds-background-effects-2030');
  const shareUi = load('/assets/js/meet/share-ui-2030.js?v=2-operation-2030-certified', 'data-ds-share-ui-2030');

  const ready = Promise.all([
    annotation, spotlight, handoff, arbitration, arbitrationUi,
    identitySettings, identityBridge, cameraPolish, dockPolish,
    shareWatchdog, backgroundEffects, shareUi
  ]);

  window.DominionOperation2030Bootstrap = Object.freeze({
    version: '1.0.0',
    ready,
    modules: Object.freeze([
      'share-annotation','share-spotlight','presentation-handoff','share-arbitration','share-arbitration-ui',
      'meeting-identity-settings','meeting-identity-bridge','camera-reaction-polish','dock-polish-2030',
      'remote-share-watchdog','background-effects-2030','share-ui-2030'
    ])
  });
})();
