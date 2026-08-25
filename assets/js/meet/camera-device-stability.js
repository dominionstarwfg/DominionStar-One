(() => {
  'use strict';
  if (window.DominionCameraDeviceStability) return;

  const media = navigator.mediaDevices;
  if (!media?.enumerateDevices) return;

  const KEYS = Object.freeze({
    videoinput: 'ds_meet_camera_id',
    audioinput: 'ds_meet_microphone_id',
    audiooutput: 'ds_meet_speaker_id'
  });
  const SELECTS = Object.freeze({
    videoinput: 'cameraSelect',
    audioinput: 'microphoneSelect',
    audiooutput: 'speakerSelect'
  });
  const FALLBACK = Object.freeze({
    videoinput: 'Camera',
    audioinput: 'Microphone',
    audiooutput: 'Speaker'
  });

  const knownLabels = new Map();
  let refreshPromise = null;
  let refreshTimer = 0;
  let lastSnapshot = Object.freeze({ cameras: [], microphones: [], speakers: [] });

  const looksOpaque = (label, deviceId = '') => {
    const value = String(label || '').trim();
    const id = String(deviceId || '').trim();
    if (!value) return true;
    if (id && value === id) return true;
    if (value.length > 52 && !/\s/.test(value)) return true;
    return /^[A-Za-z0-9+/_=-]{44,}$/.test(value);
  };

  const rememberLabel = (deviceId, label) => {
    const id = String(deviceId || '').trim();
    const value = String(label || '').trim();
    if (!id || !value || looksOpaque(value, id)) return;
    knownLabels.set(id, value);
  };

  const activeTrack = kind => {
    const ids = ['prejoinVideo', 'selfVideo', 'stageVideo'];
    for (const id of ids) {
      const stream = document.getElementById(id)?.srcObject;
      if (!(stream instanceof MediaStream)) continue;
      const track = kind === 'videoinput'
        ? stream.getVideoTracks?.().find(item => item?.readyState === 'live')
        : kind === 'audioinput'
          ? stream.getAudioTracks?.().find(item => item?.readyState === 'live')
          : null;
      const physical = track?.__dsPhysicalSourceTrack?.readyState === 'live' ? track.__dsPhysicalSourceTrack : track;
      if (physical?.readyState === 'live') return physical;
    }
    const processed = kind === 'videoinput'
      ? window.DominionVideoIntelligenceCompositor?.getSourceTrack?.() || window.DominionBackgroundEffects2030?.getSourceTrack?.()
      : null;
    return processed?.readyState === 'live' ? processed : null;
  };

  const preferredId = kind => {
    const live = activeTrack(kind);
    const liveId = String(live?.getSettings?.().deviceId || '');
    if (liveId) return liveId;
    try { return localStorage.getItem(KEYS[kind]) || ''; } catch { return ''; }
  };

  const savePreferred = (kind, deviceId) => {
    const key = KEYS[kind];
    if (!key) return;
    try { localStorage.setItem(key, String(deviceId || '')); } catch {}
  };

  const optionLabel = (device, kind, index, count) => {
    const direct = String(device.label || '').trim();
    if (direct && !looksOpaque(direct, device.deviceId)) {
      rememberLabel(device.deviceId, direct);
      return direct;
    }
    const cached = String(knownLabels.get(device.deviceId) || '').trim();
    if (cached) return cached;
    const base = FALLBACK[kind] || 'Device';
    return count > 1 ? `${base} — name unavailable (${index + 1})` : `${base} — name unavailable`;
  };

  const sameOptions = (select, entries, selected) => {
    const current = [...select.options].map(option => `${option.value}\u0000${option.textContent}`).join('\u0001');
    const next = entries.map(entry => `${entry.value}\u0000${entry.label}`).join('\u0001');
    return current === next && String(select.value || '') === String(selected || '');
  };

  const hydrate = (kind, devices) => {
    const select = document.getElementById(SELECTS[kind]);
    if (!select) return;
    const matching = devices.filter(device => device.kind === kind && device.deviceId);
    const live = activeTrack(kind);
    const liveId = String(live?.getSettings?.().deviceId || '');
    const liveLabel = String(live?.label || '').trim();
    if (liveId) rememberLabel(liveId, liveLabel);

    const entries = matching.map((device, index) => ({
      value: device.deviceId,
      label: optionLabel(device, kind, index, matching.length)
    }));
    const wanted = [liveId, preferredId(kind), String(select.value || '')]
      .find(id => id && entries.some(entry => entry.value === id)) || entries[0]?.value || '';

    if (!sameOptions(select, entries, wanted)) {
      const fragment = document.createDocumentFragment();
      for (const entry of entries) {
        const option = document.createElement('option');
        option.value = entry.value;
        option.textContent = entry.label;
        fragment.append(option);
      }
      select.replaceChildren(fragment);
      if (wanted) select.value = wanted;
    }
    if (wanted) savePreferred(kind, wanted);
  };

  const refresh = async () => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const devices = await media.enumerateDevices();
      for (const device of devices) rememberLabel(device.deviceId, device.label);
      for (const kind of Object.keys(SELECTS)) hydrate(kind, devices);
      lastSnapshot = Object.freeze({
        cameras: devices.filter(device => device.kind === 'videoinput').map(device => ({ id: device.deviceId, label: optionLabel(device, 'videoinput', 0, 1) })),
        microphones: devices.filter(device => device.kind === 'audioinput').map(device => ({ id: device.deviceId, label: optionLabel(device, 'audioinput', 0, 1) })),
        speakers: devices.filter(device => device.kind === 'audiooutput').map(device => ({ id: device.deviceId, label: optionLabel(device, 'audiooutput', 0, 1) }))
      });
      return lastSnapshot;
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  };

  const scheduleRefresh = (delay = 0) => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { void refresh().catch(() => {}); }, Math.max(0, delay));
  };

  const rememberTrack = track => {
    if (!track) return;
    const settings = track.getSettings?.() || {};
    rememberLabel(settings.deviceId, track.label);
    if (track.kind === 'video') savePreferred('videoinput', settings.deviceId);
    if (track.kind === 'audio') savePreferred('audioinput', settings.deviceId);
  };

  document.addEventListener('loadedmetadata', event => {
    const stream = event.target?.srcObject;
    if (!(stream instanceof MediaStream)) return;
    stream.getTracks().forEach(rememberTrack);
    scheduleRefresh(60);
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest?.('#preSettings,#camMenuBtn,#micMenuBtn')) {
      scheduleRefresh(0);
      setTimeout(() => { void refresh().catch(() => {}); }, 240);
    }
  }, true);

  for (const [kind, id] of Object.entries(SELECTS)) {
    document.getElementById(id)?.addEventListener('change', event => savePreferred(kind, event.target.value));
  }

  media.addEventListener?.('devicechange', () => scheduleRefresh(120));
  scheduleRefresh(180);

  window.DominionCameraDeviceStability = Object.freeze({
    version: '2.0.0-passive-catalog',
    refresh,
    snapshot: () => lastSnapshot,
    counts: () => ({
      cameras: lastSnapshot.cameras.length,
      microphones: lastSnapshot.microphones.length,
      speakers: lastSnapshot.speakers.length
    })
  });
})();
