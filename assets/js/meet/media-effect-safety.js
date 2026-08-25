(() => {
  'use strict';
  if (window.DominionMediaEffectSafety) return;

  const RESET_DELAYS = [0, 120, 320, 700, 1200, 2000, 3500, 5500, 8000, 11000];
  const LEGACY_EFFECT_KEYS = [
    'ds_meet_portrait_lighting',
    'ds_meet_auto_framing',
    'ds_meet_adjust_low_light'
  ];
  const explicit = {
    background: false,
    enhancement: false,
    portraitLighting: false,
    autoFraming: false,
    lowLight: false
  };

  const localVideos = () => ['prejoinVideo','selfVideo','stageVideo']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const sanitizeStoredPreferences = () => {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('ds_meet_preferences:')) continue;
        let value;
        try { value = JSON.parse(localStorage.getItem(key) || '{}'); } catch { continue; }
        if (!value || typeof value !== 'object') continue;
        const next = { ...value, background:'none', brightness:100, touchAppearance:0 };
        localStorage.setItem(key, JSON.stringify(next));
      }
    } catch (_) {}
  };

  const clearLegacyEffectMemory = () => {
    for (const key of LEGACY_EFFECT_KEYS) {
      try { localStorage.removeItem(key); } catch (_) {}
    }
    sanitizeStoredPreferences();
  };

  const neutralize = () => {
    const background = document.getElementById('backgroundSelect');
    const brightness = document.getElementById('brightnessRange');
    const touch = document.getElementById('touchAppearanceRange');
    const portrait = document.getElementById('portraitLightingToggle');
    const autoFrame = document.getElementById('autoFramingToggle');
    const lowLight = document.getElementById('adjustLowLightToggle');

    if (!explicit.background && background) background.value = 'none';
    if (!explicit.enhancement && brightness) brightness.value = '100';
    if (!explicit.enhancement && touch) touch.value = '0';
    if (!explicit.portraitLighting && portrait) portrait.checked = false;
    if (!explicit.autoFraming && autoFrame) autoFrame.checked = false;
    if (!explicit.lowLight && lowLight) lowLight.checked = false;

    if (!explicit.background && !explicit.enhancement) {
      for (const video of localVideos()) {
        if (video.dataset.dsBackgroundProcessed === '1' || video.dataset.dsVideoIntelligence === '1') continue;
        video.style.filter = '';
      }
    }
    clearLegacyEffectMemory();
  };

  const markExplicit = event => {
    if (!event.isTrusted) return;
    const id = String(event.target?.id || '');
    if (id === 'backgroundSelect') explicit.background = true;
    if (id === 'brightnessRange' || id === 'touchAppearanceRange') explicit.enhancement = true;
    if (id === 'portraitLightingToggle') explicit.portraitLighting = true;
    if (id === 'autoFramingToggle') explicit.autoFraming = true;
    if (id === 'adjustLowLightToggle') explicit.lowLight = true;
  };

  document.addEventListener('change', markExplicit, true);
  document.addEventListener('input', markExplicit, true);
  clearLegacyEffectMemory();

  const ready = new Promise(resolve => {
    let remaining = RESET_DELAYS.length;
    for (const delay of RESET_DELAYS) {
      setTimeout(() => {
        neutralize();
        remaining -= 1;
        if (remaining === 0) resolve(true);
      }, delay);
    }
  });

  window.DominionMediaEffectSafety = Object.freeze({
    version: '1.1.0-explicit-session-opt-in',
    ready,
    neutralize,
    snapshot: () => ({ ...explicit })
  });
})();
