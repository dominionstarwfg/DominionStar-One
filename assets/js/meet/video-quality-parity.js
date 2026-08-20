(() => {
  'use strict';
  if (window.DominionVideoQualityParity) return;

  const settingsBody = document.querySelector('#settingsDialog .settings-body');
  if (!settingsBody) return;

  const STORAGE_LOW_LIGHT = 'ds_meet_adjust_low_light';
  const STORAGE_ORIGINAL_RATIO = 'ds_meet_original_ratio';
  const localVideos = () => ['prejoinVideo','selfVideo','stageVideo']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const readBool = (key, fallback=false) => {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value === '1';
    } catch (_) { return fallback; }
  };
  const writeBool = (key, value) => {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch (_) {}
  };

  const makeToggle = (id, label, checked) => {
    let input = document.getElementById(id);
    if (input) return input;
    const row = document.createElement('label');
    row.className = 'check ds-video-quality-parity';
    const copy = document.createElement('span');
    copy.textContent = label;
    input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = checked;
    row.append(copy,input);
    settingsBody.append(row);
    return input;
  };

  const lowLightToggle = makeToggle('adjustLowLightToggle','Adjust for low light',readBool(STORAGE_LOW_LIGHT,false));
  const originalRatioToggle = makeToggle('originalRatioToggle','Original ratio',readBool(STORAGE_ORIGINAL_RATIO,false));

  const activeCameraTrack = () => {
    const intelligentSource = window.DominionVideoIntelligenceCompositor?.getSourceTrack?.();
    if (intelligentSource?.readyState === 'live') return intelligentSource;
    const backgroundSource = window.DominionBackgroundEffects2030?.getSourceTrack?.();
    if (backgroundSource?.readyState === 'live') {
      const physical = backgroundSource.__dsPhysicalSourceTrack;
      if (physical?.readyState === 'live') return physical;
      return backgroundSource;
    }
    for (const video of localVideos()) {
      const track = video.srcObject?.getVideoTracks?.()[0];
      const physical = track?.__dsPhysicalSourceTrack;
      if (physical?.readyState === 'live') return physical;
      if (track?.readyState === 'live') return track;
    }
    return null;
  };

  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const supportedAdvanced = (track, enabled) => {
    const capabilities = track?.getCapabilities?.() || {};
    const advanced = {};
    if (Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) {
      advanced.exposureMode = 'continuous';
    }
    if (capabilities.exposureCompensation && Number.isFinite(capabilities.exposureCompensation.min) && Number.isFinite(capabilities.exposureCompensation.max)) {
      const min = Number(capabilities.exposureCompensation.min);
      const max = Number(capabilities.exposureCompensation.max);
      const step = Number(capabilities.exposureCompensation.step || 0.1);
      const desired = enabled ? min + (max-min)*0.72 : clamp(0,min,max);
      advanced.exposureCompensation = Math.round(desired/step)*step;
    } else if (capabilities.brightness && Number.isFinite(capabilities.brightness.min) && Number.isFinite(capabilities.brightness.max)) {
      const min = Number(capabilities.brightness.min);
      const max = Number(capabilities.brightness.max);
      const step = Number(capabilities.brightness.step || 1);
      const desired = enabled ? min + (max-min)*0.62 : min + (max-min)*0.5;
      advanced.brightness = Math.round(desired/step)*step;
    }
    return advanced;
  };

  const applyLowLight = async () => {
    const enabled = Boolean(lowLightToggle.checked);
    writeBool(STORAGE_LOW_LIGHT,enabled);
    const track = activeCameraTrack();
    if (!track?.applyConstraints) return {applied:false,reason:'no-live-camera'};
    const advanced = supportedAdvanced(track,enabled);
    if (!Object.keys(advanced).length) return {applied:false,reason:'camera-controls-unavailable'};
    try {
      await track.applyConstraints({advanced:[advanced]});
      return {applied:true,advanced};
    } catch (error) {
      return {applied:false,reason:String(error?.name||'constraint-failed')};
    }
  };

  const applyOriginalRatio = () => {
    const enabled = Boolean(originalRatioToggle.checked);
    writeBool(STORAGE_ORIGINAL_RATIO,enabled);
    localVideos().forEach(video => {
      video.dataset.dsOriginalRatio = enabled ? '1' : '0';
      video.style.objectFit = enabled ? 'contain' : '';
    });
    return enabled;
  };

  lowLightToggle.addEventListener('change',()=>{ void applyLowLight(); });
  originalRatioToggle.addEventListener('change',applyOriginalRatio);
  document.addEventListener('loadedmetadata',event=>{
    if (!(event.target instanceof HTMLVideoElement)) return;
    applyOriginalRatio();
    setTimeout(()=>{ if (lowLightToggle.checked) void applyLowLight(); },80);
  },true);
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{
    setTimeout(()=>{ if (lowLightToggle.checked) void applyLowLight(); },120);
  });

  applyOriginalRatio();
  setTimeout(()=>{ if (lowLightToggle.checked) void applyLowLight(); },300);

  window.DominionVideoQualityParity = Object.freeze({
    version:'1.0.1',
    applyLowLight,
    applyOriginalRatio,
    snapshot:()=>({
      lowLight:Boolean(lowLightToggle.checked),
      originalRatio:Boolean(originalRatioToggle.checked),
      cameraLabel:activeCameraTrack()?.label||'',
      cameraCapabilities:activeCameraTrack()?.getCapabilities?.()||{}
    })
  });
})();
