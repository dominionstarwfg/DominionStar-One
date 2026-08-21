(() => {
  'use strict';
  if (window.DominionShareOptimizationParity) return;

  const engine = window.DominionStarMeetingEngine;
  const picker = window.DominionDesktopSharePicker;
  if (!engine?.on || !picker?.choose) return;

  let optimizeForVideo = false;
  let currentTrack = null;
  const originalChoose = picker.choose.bind(picker);

  const apply = async track => {
    if (!track || track.kind !== 'video' || track.readyState !== 'live') return false;
    currentTrack = track;
    try { track.contentHint = optimizeForVideo ? 'motion' : 'detail'; } catch (_) {}
    if (typeof track.applyConstraints === 'function') {
      try {
        await track.applyConstraints(optimizeForVideo
          ? { frameRate: { ideal: 30, max: 30 } }
          : { frameRate: { ideal: 15, max: 30 } });
      } catch (_) {}
    }
    return true;
  };

  picker.choose = async (...args) => {
    const selection = await originalChoose(...args);
    if (selection) optimizeForVideo = Boolean(selection.optimize);
    return selection;
  };

  engine.on('screen-stream', ({ stream }) => {
    const track = stream?.getVideoTracks?.()[0] || null;
    void apply(track);
  });

  engine.on('screen-ended', () => {
    currentTrack = null;
    optimizeForVideo = false;
  });

  window.DominionShareOptimizationParity = Object.freeze({
    version: '1.0.0',
    reapply: () => apply(currentTrack),
    snapshot: () => ({
      optimizeForVideo,
      contentHint: currentTrack?.contentHint || '',
      settings: currentTrack?.getSettings?.() || {},
      trackState: currentTrack?.readyState || 'none'
    })
  });
})();
