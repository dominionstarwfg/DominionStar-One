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

  // Camera/microphone acquisition is intentionally NOT owned here. The base
  // meeting runtime is the single command owner. Advanced camera/effect layers
  // are delayed until the initial prejoin/UI work has settled so they cannot
  // race camera startup, selector hydration, or user clicks.
  const mediaIdle = new Promise(resolve => {
    const done = () => resolve(true);
    if (typeof requestIdleCallback === 'function') requestIdleCallback(done, { timeout: 1400 });
    else setTimeout(done, 900);
  });

  const annotation = load('/assets/js/meet/share-annotation.js?v=2-operation-2030-certified', 'data-ds-share-annotation');
  const verticalAnnotationUi = load('/assets/js/meet/annotation-vertical-ui.js?v=1-approved-zoom-rail', 'data-ds-annotation-vertical-ui', { after: annotation });
  const presenterCommandParity = load('/assets/js/meet/presenter-command-web-parity.js?v=2-slide-control-aware', 'data-ds-presenter-command-parity', { after: annotation });
  const slideControl = load('/assets/js/meet/slide-control-parity.js?v=1-encrypted-delegated-control', 'data-ds-slide-control-parity', { after: presenterCommandParity });
  const receiverSideLayout = load('/assets/js/meet/receiver-side-layout-parity.js?v=1-zoom-class-side-by-side', 'data-ds-receiver-side-layout');
  const hostCohostUiParity = load('/assets/js/meet/host-cohost-ui-parity.js?v=1-authority-copy', 'data-ds-host-cohost-ui-parity');
  const localRecording = load('/assets/js/meet/local-recording.js?v=1-visible-desktop-recording', 'data-ds-local-recording');
  const spotlight = load('/assets/js/meet/share-spotlight.js?v=2-operation-2030-certified', 'data-ds-share-spotlight');
  const handoff = load('/assets/js/meet/presentation-handoff.js?v=2-operation-2030-certified', 'data-ds-presentation-handoff');
  const arbitration = load('/assets/js/meet/share-arbitration.js?v=2-operation-2030-certified', 'data-ds-share-arbitration');
  const arbitrationUi = load('/assets/js/meet/share-arbitration-ui.js?v=2-operation-2030-certified', 'data-ds-share-arbitration-ui', { after: arbitration });
  const identitySettings = load('/assets/js/meet/meeting-identity-settings.js?v=2-operation-2030-certified', 'data-ds-meeting-identity-settings');
  const identityBridge = load('/assets/js/meet/meeting-identity-bridge.js?v=2-operation-2030-certified', 'data-ds-meeting-identity-bridge', { after: identitySettings });
  const dockPolish = load('/assets/js/meet/dock-polish-2030.js?v=2-operation-2030-certified', 'data-ds-dock-polish-2030');
  const nativeDockQuality = load('/assets/js/meet/native-dock-quality.js?v=1-operation-2030-hd-dock', 'data-ds-native-dock-quality');
  const shareWatchdog = load('/assets/js/meet/remote-share-watchdog.js?v=2-operation-2030-certified', 'data-ds-remote-share-watchdog');
  const shareOptimizationParity = load('/assets/js/meet/share-optimization-parity.js?v=1-real-motion-detail-policy', 'data-ds-share-optimization-parity');
  const shareUi = load('/assets/js/meet/share-ui-2030.js?v=2-operation-2030-certified', 'data-ds-share-ui-2030', { after: shareOptimizationParity });

  const quickDeviceMenuParity = load('/assets/js/meet/quick-device-menu-parity.js?v=2-modern-switch-ui', 'data-ds-quick-device-menu-parity', { after: mediaIdle });
  const videoIntelligence = load('/assets/js/meet/video-intelligence-compositor.js?v=2-bounded-autoframe', 'data-ds-video-intelligence-compositor', { after: mediaIdle });
  const backgroundEffects = load('/assets/js/meet/background-effects-2030.js?v=2-operation-2030-certified', 'data-ds-background-effects-2030', { after: videoIntelligence });
  const cameraPolish = load('/assets/js/meet/camera-reaction-polish.js?v=3-operation-2030-certified', 'data-ds-camera-reaction-polish', { after: backgroundEffects });
  const videoQualityParity = load('/assets/js/meet/video-quality-parity.js?v=1-low-light-original-ratio', 'data-ds-video-quality-parity', { after: cameraPolish });

  const ready = Promise.all([
    annotation, verticalAnnotationUi, presenterCommandParity, slideControl, receiverSideLayout,
    hostCohostUiParity, localRecording, spotlight, handoff, arbitration, arbitrationUi,
    identitySettings, identityBridge, dockPolish, nativeDockQuality, shareWatchdog,
    shareOptimizationParity, shareUi, quickDeviceMenuParity, videoIntelligence,
    backgroundEffects, cameraPolish, videoQualityParity
  ]);

  window.DominionOperation2030Bootstrap = Object.freeze({
    version: '2.0.0-single-media-owner',
    ready,
    mediaIdle,
    modules: Object.freeze([
      'share-annotation','annotation-vertical-ui','presenter-command-web-parity','slide-control-parity',
      'quick-device-menu-parity','receiver-side-layout-parity','host-cohost-ui-parity','local-recording',
      'share-spotlight','presentation-handoff','share-arbitration','share-arbitration-ui',
      'meeting-identity-settings','meeting-identity-bridge','camera-reaction-polish','dock-polish-2030',
      'native-dock-quality','remote-share-watchdog','video-intelligence-compositor',
      'background-effects-2030','video-quality-parity','share-optimization-parity','share-ui-2030'
    ])
  });
})();
