(() => {
  'use strict';
  if (window.DominionMicrophoneDeviceIdentity) return;

  const media = navigator.mediaDevices;
  if (!media?.enumerateDevices) return;

  const MIC_KEY = 'ds_meet_microphone_id';
  let refreshing = false;
  let lastRefreshAt = 0;

  const isGeneric = label => {
    const value = String(label || '').trim();
    return !value || /^Microphone\s*\d*$/i.test(value) || /^Default\s*-?\s*Microphone$/i.test(value);
  };

  const liveAudioTrack = () => {
    for (const id of ['prejoinVideo','selfVideo','stageVideo']) {
      const stream = document.getElementById(id)?.srcObject;
      const track = stream?.getAudioTracks?.().find(item => item?.readyState === 'live');
      if (track) return track;
    }
    return null;
  };

  const remember = track => {
    const id = String(track?.getSettings?.().deviceId || '');
    if (!id) return;
    try { localStorage.setItem(MIC_KEY, id); } catch {}
  };

  const refresh = async () => {
    if (refreshing) return false;
    const select = document.getElementById('microphoneSelect');
    if (!select) return false;
    refreshing = true;
    try {
      const list = (await media.enumerateDevices()).filter(device => device.kind === 'audioinput' && device.deviceId);
      const live = liveAudioTrack();
      if (live) remember(live);
      const liveId = String(live?.getSettings?.().deviceId || '');
      const liveLabel = String(live?.label || '').trim();
      const stored = (() => { try { return localStorage.getItem(MIC_KEY) || ''; } catch { return ''; } })();
      const preferred = liveId || select.value || stored;

      select.innerHTML = '';
      for (const device of list) {
        const option = document.createElement('option');
        option.value = device.deviceId;
        const enumerated = String(device.label || '').trim();
        const activeResolved = device.deviceId === liveId && !isGeneric(liveLabel) ? liveLabel : '';
        const enumeratedResolved = !isGeneric(enumerated) ? enumerated : '';
        const label = activeResolved || enumeratedResolved;
        option.textContent = label || 'Microphone — name unavailable';
        option.dataset.deviceLabelResolved = label ? '1' : '0';
        select.append(option);
      }
      if (preferred && list.some(device => device.deviceId === preferred)) select.value = preferred;
      lastRefreshAt = Date.now();
      return true;
    } catch {
      return false;
    } finally {
      refreshing = false;
    }
  };

  const installObserver = () => {
    const select = document.getElementById('microphoneSelect');
    if (!select || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => {
      if (refreshing || Date.now() - lastRefreshAt < 180) return;
      setTimeout(() => { void refresh(); }, 25);
    });
    observer.observe(select, { childList: true });
  };

  media.addEventListener?.('devicechange', () => { void refresh(); });
  document.addEventListener('loadedmetadata', event => {
    const track = event.target?.srcObject?.getAudioTracks?.().find(item => item?.readyState === 'live');
    if (track) remember(track);
    void refresh();
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest?.('#preSettings,#micMenuBtn,#settingsDialog')) {
      setTimeout(() => { void refresh(); }, 40);
      setTimeout(() => { void refresh(); }, 220);
    }
  }, true);

  setTimeout(() => { installObserver(); void refresh(); }, 260);
  setTimeout(() => { void refresh(); }, 900);

  window.DominionMicrophoneDeviceIdentity = Object.freeze({
    version: '1.0.0',
    refresh,
    snapshot: async () => ({
      activeMicrophoneLabel: liveAudioTrack()?.label || '',
      microphones: (await media.enumerateDevices()).filter(device => device.kind === 'audioinput').map(device => ({id:device.deviceId,label:device.label||''}))
    })
  });
})();
