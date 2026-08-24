(() => {
  'use strict';
  if (window.DominionCameraDeviceStability) return;

  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) return;

  const nativeGetUserMedia = media.getUserMedia.bind(media);
  const CAMERA_KEY = 'ds_meet_camera_id';
  const MIC_KEY = 'ds_meet_microphone_id';
  const hardPermissionError = error => ['NotAllowedError','SecurityError'].includes(String(error?.name || ''));
  const retryableVideoError = error => {
    const name = String(error?.name || '');
    const message = String(error?.message || '').toLowerCase();
    return ['NotReadableError','AbortError','TrackStartError','OverconstrainedError','NotFoundError'].includes(name)
      || /camera|video source|device|track|constraint/.test(message);
  };
  const clone = value => value && typeof value === 'object' && !Array.isArray(value) ? {...value} : value;
  const isGenericLabel = (label, fallback) => {
    const value = String(label || '').trim();
    return !value || new RegExp(`^${fallback}\\s*\\d+$`, 'i').test(value) || new RegExp(`^${fallback}$`, 'i').test(value);
  };
  const looksOpaqueLabel = (label, deviceId = '') => {
    const value = String(label || '').trim();
    const id = String(deviceId || '').trim();
    if (!value) return true;
    if (id && value === id) return true;
    if (value.length > 52 && !/\s/.test(value)) return true;
    if (/^[A-Za-z0-9+/_=-]{44,}$/.test(value)) return true;
    return false;
  };

  let refreshingLabels = false;
  let lastHydrateAt = 0;
  let lastLiveVideoTrack = null;
  let lastLiveAudioTrack = null;
  const knownLabels = new Map();

  const unwrapPhysicalTrack = track => {
    const source = track?.__dsPhysicalSourceTrack;
    return source?.readyState === 'live' ? source : track;
  };

  const prejoinCameraPreferenceOff = () => {
    if (!document.body?.classList?.contains('prejoin-active')) return false;
    return Boolean(document.getElementById('alwaysJoinCameraOff')?.checked);
  };

  const stopVideoTracks = stream => {
    for (const track of stream?.getVideoTracks?.() || []) {
      try { stream.removeTrack?.(track); } catch {}
      try { if (track.readyState !== 'ended') track.stop(); } catch {}
    }
  };

  const enforcePrejoinCameraPrivacy = () => {
    if (!prejoinCameraPreferenceOff()) return false;
    const preview = document.getElementById('prejoinVideo');
    if (preview?.srcObject instanceof MediaStream) stopVideoTracks(preview.srcObject);
    const physical = unwrapPhysicalTrack(lastLiveVideoTrack);
    if (physical?.readyState === 'live') {
      try { physical.stop(); } catch {}
    }
    lastLiveVideoTrack = null;
    if (preview) {
      preview.hidden = true;
      try { preview.pause?.(); } catch {}
    }
    const fallback = document.getElementById('prejoinFallback');
    if (fallback) fallback.hidden = false;
    return true;
  };

  const ensureNativePermission = async constraints => {
    if (!window.dominionDesktop?.isDesktop || !window.dominionDesktop?.getMediaPermissions) return;
    const kinds = [];
    if (constraints?.video) kinds.push('camera');
    if (constraints?.audio) kinds.push('microphone');
    if (!kinds.length) return;
    let status = await window.dominionDesktop.getMediaPermissions().catch(() => null);
    if (!status?.ok) return;
    const undetermined = kinds.filter(kind => String(status?.[kind] || '').toLowerCase() === 'not-determined');
    if (undetermined.length && window.dominionDesktop.requestMediaPermissions) {
      status = await window.dominionDesktop.requestMediaPermissions(undetermined).catch(() => status);
    }
    const blocked = kinds.filter(kind => ['denied','restricted'].includes(String(status?.[kind] || '').toLowerCase()));
    if (!blocked.length) return;
    const error = new Error(`DominionStar Meet needs macOS ${blocked.map(kind => kind === 'camera' ? 'Camera' : 'Microphone').join(' and ')} permission. Open System Settings > Privacy & Security, allow DominionStar Meet, then reopen the app.`);
    error.name = 'NotAllowedError';
    throw error;
  };

  const devices = async kind => {
    try {
      const list = (await media.enumerateDevices()).filter(device => device.kind === kind && device.deviceId);
      for (const device of list) {
        const label = String(device.label || '').trim();
        if (label && !looksOpaqueLabel(label, device.deviceId)) knownLabels.set(device.deviceId, label);
      }
      return list;
    } catch (_) { return []; }
  };

  const activeTrack = kind => {
    const ids = kind === 'videoinput' ? ['prejoinVideo','selfVideo','stageVideo'] : [];
    for (const id of ids) {
      const stream = document.getElementById(id)?.srcObject;
      const track = kind === 'videoinput' ? stream?.getVideoTracks?.()[0] : stream?.getAudioTracks?.()[0];
      const resolved = unwrapPhysicalTrack(track);
      if (resolved?.readyState === 'live') return resolved;
    }
    if (kind === 'videoinput') {
      const source = unwrapPhysicalTrack(window.DominionBackgroundEffects2030?.getSourceTrack?.());
      if (source?.readyState === 'live') return source;
      const remembered = unwrapPhysicalTrack(lastLiveVideoTrack);
      if (remembered?.readyState === 'live') return remembered;
    }
    if (kind === 'audioinput' && lastLiveAudioTrack?.readyState === 'live') return lastLiveAudioTrack;
    return null;
  };

  const rememberTrack = input => {
    const track = unwrapPhysicalTrack(input);
    if (!track) return;
    if (track.kind === 'video') lastLiveVideoTrack = track;
    if (track.kind === 'audio') lastLiveAudioTrack = track;
    const settings = track.getSettings?.() || {};
    const key = track.kind === 'video' ? CAMERA_KEY : track.kind === 'audio' ? MIC_KEY : '';
    const label = String(track.label || '').trim();
    if (settings.deviceId && label && !looksOpaqueLabel(label, settings.deviceId)) knownLabels.set(settings.deviceId, label);
    if (key && settings.deviceId) {
      try { localStorage.setItem(key, settings.deviceId); } catch (_) {}
    }
  };

  const hydrateSelect = async (selectId, kind, fallback) => {
    const select = document.getElementById(selectId);
    if (!select) return;
    const enumerated = await devices(kind);
    const live = activeTrack(kind);
    const liveSettings = live?.getSettings?.() || {};
    const liveId = String(liveSettings.deviceId || '');
    const liveLabelRaw = String(live?.label || '').trim();
    const liveLabel = looksOpaqueLabel(liveLabelRaw, liveId) ? String(knownLabels.get(liveId) || '') : liveLabelRaw;
    const stored = (() => { try { return localStorage.getItem(kind === 'videoinput' ? CAMERA_KEY : MIC_KEY) || ''; } catch (_) { return ''; } })();
    const preferred = liveId || select.value || stored;
    const list = [...enumerated];

    if (live && liveId && !list.some(device => device.deviceId === liveId)) {
      list.unshift({ deviceId: liveId, label: liveLabel, kind });
    }
    if (!list.length && live) {
      list.push({ deviceId: liveId || `active-${kind}`, label: liveLabel, kind, activeSynthetic: true });
    }

    select.innerHTML = '';
    for (const device of list) {
      const option = document.createElement('option');
      option.value = device.deviceId;
      const enumeratedLabelRaw = String(device.label || '').trim();
      const cached = String(knownLabels.get(device.deviceId) || '').trim();
      const enumeratedLabel = looksOpaqueLabel(enumeratedLabelRaw, device.deviceId) ? cached : enumeratedLabelRaw;
      const activeResolved = device.deviceId === liveId && liveLabel && !isGenericLabel(liveLabel, fallback) ? liveLabel : '';
      const enumeratedResolved = !isGenericLabel(enumeratedLabel, fallback) ? enumeratedLabel : '';
      const label = activeResolved || enumeratedResolved || cached;
      option.textContent = label || (device.activeSynthetic ? `${fallback} in use — hardware name unavailable` : `${fallback} — name unavailable`);
      option.dataset.deviceLabelResolved = label ? '1' : '0';
      if (device.deviceId === liveId) option.dataset.activeDevice = '1';
      select.append(option);
    }
    if (preferred && list.some(device => device.deviceId === preferred)) select.value = preferred;
    else if (liveId && list.some(device => device.deviceId === liveId)) select.value = liveId;
  };

  const refreshDeviceNames = async () => {
    if (refreshingLabels) return;
    refreshingLabels = true;
    try {
      await Promise.all([
        hydrateSelect('cameraSelect','videoinput','Camera'),
        hydrateSelect('microphoneSelect','audioinput','Microphone')
      ]);
      lastHydrateAt = Date.now();
    } finally {
      refreshingLabels = false;
    }
  };

  const scheduleDeviceRefresh = () => {
    queueMicrotask(() => refreshDeviceNames().catch(() => {}));
    setTimeout(() => refreshDeviceNames().catch(() => {}), 120);
    setTimeout(() => refreshDeviceNames().catch(() => {}), 450);
    setTimeout(() => refreshDeviceNames().catch(() => {}), 1100);
  };

  const relaxedVideo = base => {
    const current = base === true ? {} : clone(base) || {};
    delete current.deviceId;
    if (!current.width) current.width = {ideal:1280};
    if (!current.height) current.height = {ideal:720};
    if (!current.frameRate) current.frameRate = {ideal:30,max:30};
    return current;
  };

  const acquireVideo = async videoConstraints => {
    const base = relaxedVideo(videoConstraints);
    const cameras = await devices('videoinput');
    const requestedId = (() => {
      const raw = videoConstraints && typeof videoConstraints === 'object' ? videoConstraints.deviceId : null;
      if (typeof raw === 'string') return raw;
      return String(raw?.exact || raw?.ideal || '');
    })();
    const storedId = (() => { try { return localStorage.getItem(CAMERA_KEY) || ''; } catch (_) { return ''; } })();
    const ordered = [];
    for (const id of [requestedId, storedId, ...cameras.map(camera => camera.deviceId)]) {
      if (id && !ordered.includes(id) && cameras.some(camera => camera.deviceId === id)) ordered.push(id);
    }

    let lastError = null;
    for (const id of ordered) {
      try {
        const stream = await nativeGetUserMedia({video:{...base,deviceId:{exact:id}},audio:false});
        const track = stream.getVideoTracks()[0];
        if (track) { rememberTrack(track); scheduleDeviceRefresh(); return stream; }
        stream.getTracks().forEach(item => item.stop());
      } catch (error) {
        lastError = error;
        if (hardPermissionError(error)) throw error;
      }
    }

    try {
      const stream = await nativeGetUserMedia({video:base,audio:false});
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No camera track was provided.');
      rememberTrack(track);
      scheduleDeviceRefresh();
      return stream;
    } catch (error) {
      lastError = error;
    }

    const error = new Error('DominionStar could not start an available camera. Reconnect the camera or choose another camera in Video Settings, then try Start Video again.');
    error.name = lastError?.name || 'CameraUnavailableError';
    error.cause = lastError;
    throw error;
  };

  const acquireAudio = async audioConstraints => {
    const stream = await nativeGetUserMedia({video:false,audio:audioConstraints || true});
    const track = stream.getAudioTracks()[0];
    if (track) rememberTrack(track);
    scheduleDeviceRefresh();
    return stream;
  };

  media.getUserMedia = async constraints => {
    const requested = {...(constraints || {})};
    await ensureNativePermission(requested);
    let stream = null;
    try {
      stream = await nativeGetUserMedia(requested);
      stream.getTracks().forEach(rememberTrack);
    } catch (firstError) {
      if (hardPermissionError(firstError) || !requested.video || !retryableVideoError(firstError)) throw firstError;
      const videoStream = await acquireVideo(requested.video);
      if (!requested.audio) stream = videoStream;
      else {
        try {
          const audioStream = await acquireAudio(requested.audio);
          stream = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
        } catch (audioError) {
          if (hardPermissionError(audioError)) {
            videoStream.getTracks().forEach(track => track.stop());
            throw audioError;
          }
          stream = videoStream;
        }
      }
    }

    // Privacy invariant: if the prejoin preference says Camera Off, no video
    // track is allowed to survive an unrelated/background media request. The
    // user pressing Start Video clears that preference before requesting a new
    // track, so intentional camera activation still works normally.
    if (requested.video && prejoinCameraPreferenceOff()) stopVideoTracks(stream);
    stream?.getTracks?.().forEach(rememberTrack);
    scheduleDeviceRefresh();
    setTimeout(enforcePrejoinCameraPrivacy, 0);
    return stream;
  };

  const translateCameraError = error => {
    const message = String(error?.message || '');
    if (!/camera could not start after automatic recovery|another app is using the camera/i.test(message)) return error;
    const replacement = new Error('DominionStar could not start the selected camera. Reconnect it or choose another camera in Video Settings, then try Start Video again.');
    replacement.name = error?.name || 'CameraUnavailableError';
    replacement.cause = error;
    return replacement;
  };

  const wrapEngine = () => {
    const engine = window.DominionStarMeetingEngine;
    if (!engine || engine.__dsCameraStabilityWrapped) return Boolean(engine);
    for (const method of ['startMedia','toggleVideo']) {
      const original = engine[method];
      if (typeof original !== 'function') continue;
      engine[method] = async (...args) => {
        try {
          const result = await original.apply(engine,args);
          scheduleDeviceRefresh();
          setTimeout(enforcePrejoinCameraPrivacy, 0);
          return result;
        } catch (error) {
          throw translateCameraError(error);
        }
      };
    }
    engine.__dsCameraStabilityWrapped = true;
    return true;
  };

  const installDeviceSelectAuthority = () => {
    const selects = ['cameraSelect','microphoneSelect'].map(id => document.getElementById(id)).filter(Boolean);
    if (!selects.length || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => {
      if (refreshingLabels || Date.now() - lastHydrateAt < 180) return;
      setTimeout(() => refreshDeviceNames().catch(() => {}), 20);
    });
    selects.forEach(select => observer.observe(select,{childList:true}));
  };

  media.addEventListener?.('devicechange', scheduleDeviceRefresh);
  document.addEventListener('loadedmetadata', event => {
    if (event.target instanceof HTMLVideoElement) {
      const track = event.target.srcObject?.getVideoTracks?.()[0];
      if (track) rememberTrack(track);
      scheduleDeviceRefresh();
      setTimeout(enforcePrejoinCameraPrivacy, 0);
    }
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest?.('#preSettings,#camMenuBtn,#micMenuBtn')) scheduleDeviceRefresh();
    if (event.target.closest?.('#preCam,#alwaysJoinCameraOff')) {
      setTimeout(enforcePrejoinCameraPrivacy, 0);
      setTimeout(enforcePrejoinCameraPrivacy, 100);
    }
  }, true);

  if (typeof MutationObserver === 'function') {
    const privacyObserver = new MutationObserver(() => enforcePrejoinCameraPrivacy());
    privacyObserver.observe(document.documentElement, { attributes:true, subtree:true, attributeFilter:['aria-pressed','class'] });
  }

  const engineTimer = setInterval(() => { if (wrapEngine()) clearInterval(engineTimer); }, 25);
  setTimeout(() => clearInterval(engineTimer), 5000);
  setTimeout(() => { installDeviceSelectAuthority(); refreshDeviceNames().catch(() => {}); enforcePrejoinCameraPrivacy(); }, 250);
  setTimeout(() => { refreshDeviceNames().catch(() => {}); enforcePrejoinCameraPrivacy(); }, 900);

  window.DominionCameraDeviceStability = Object.freeze({
    version:'1.3.0',
    refreshDeviceNames,
    enforcePrejoinCameraPrivacy,
    snapshot:async()=>({
      cameras:(await devices('videoinput')).map(device=>({id:device.deviceId,label:device.label||knownLabels.get(device.deviceId)||''})),
      microphones:(await devices('audioinput')).map(device=>({id:device.deviceId,label:device.label||knownLabels.get(device.deviceId)||''})),
      activeCameraLabel:activeTrack('videoinput')?.label||'',
      activeCameraDeviceId:activeTrack('videoinput')?.getSettings?.().deviceId||'',
      prejoinCameraOff:prejoinCameraPreferenceOff()
    })
  });
})();
