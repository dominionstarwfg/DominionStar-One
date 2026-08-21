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
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isGenericLabel = (label, fallback) => {
    const value = String(label || '').trim();
    return !value || new RegExp(`^${fallback}\\s*\\d+$`, 'i').test(value) || new RegExp(`^${fallback}$`, 'i').test(value);
  };
  let refreshingLabels = false;
  let lastHydrateAt = 0;

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
    try { return (await media.enumerateDevices()).filter(device => device.kind === kind && device.deviceId); }
    catch (_) { return []; }
  };

  const activeTrack = kind => {
    const ids = kind === 'videoinput' ? ['prejoinVideo','selfVideo','stageVideo'] : [];
    for (const id of ids) {
      const stream = document.getElementById(id)?.srcObject;
      const track = kind === 'videoinput' ? stream?.getVideoTracks?.()[0] : stream?.getAudioTracks?.()[0];
      if (track?.readyState === 'live') return track;
    }
    if (kind === 'videoinput') {
      const source = window.DominionBackgroundEffects2030?.getSourceTrack?.();
      if (source?.readyState === 'live') return source;
    }
    return null;
  };

  const rememberTrack = track => {
    if (!track) return;
    const settings = track.getSettings?.() || {};
    const key = track.kind === 'video' ? CAMERA_KEY : track.kind === 'audio' ? MIC_KEY : '';
    if (key && settings.deviceId) {
      try { localStorage.setItem(key, settings.deviceId); } catch (_) {}
    }
  };

  const hydrateSelect = async (selectId, kind, fallback) => {
    const select = document.getElementById(selectId);
    if (!select) return;
    const list = await devices(kind);
    const live = activeTrack(kind);
    const liveSettings = live?.getSettings?.() || {};
    const liveId = String(liveSettings.deviceId || '');
    const liveLabel = String(live?.label || '').trim();
    const stored = (() => { try { return localStorage.getItem(kind === 'videoinput' ? CAMERA_KEY : MIC_KEY) || ''; } catch (_) { return ''; } })();
    const preferred = liveId || select.value || stored;
    select.innerHTML = '';
    for (const device of list) {
      const option = document.createElement('option');
      option.value = device.deviceId;
      const enumeratedLabel = String(device.label || '').trim();
      const activeResolved = device.deviceId === liveId && liveLabel && !isGenericLabel(liveLabel, fallback) ? liveLabel : '';
      const enumeratedResolved = !isGenericLabel(enumeratedLabel, fallback) ? enumeratedLabel : '';
      const label = activeResolved || enumeratedResolved;
      option.textContent = label || `${fallback} — name unavailable`;
      option.dataset.deviceLabelResolved = label ? '1' : '0';
      select.append(option);
    }
    if (preferred && list.some(device => device.deviceId === preferred)) select.value = preferred;
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
        if (track) { rememberTrack(track); queueMicrotask(refreshDeviceNames); return stream; }
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
      queueMicrotask(refreshDeviceNames);
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
    return stream;
  };

  media.getUserMedia = async constraints => {
    const requested = {...(constraints || {})};
    await ensureNativePermission(requested);
    try {
      const stream = await nativeGetUserMedia(requested);
      stream.getTracks().forEach(rememberTrack);
      queueMicrotask(refreshDeviceNames);
      return stream;
    } catch (firstError) {
      if (hardPermissionError(firstError) || !requested.video || !retryableVideoError(firstError)) throw firstError;
    }

    const videoStream = await acquireVideo(requested.video);
    if (!requested.audio) return videoStream;
    try {
      const audioStream = await acquireAudio(requested.audio);
      return new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    } catch (audioError) {
      if (hardPermissionError(audioError)) {
        videoStream.getTracks().forEach(track => track.stop());
        throw audioError;
      }
      return videoStream;
    }
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
        try { return await original.apply(engine,args); }
        catch (error) { throw translateCameraError(error); }
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

  media.addEventListener?.('devicechange', () => { refreshDeviceNames().catch(() => {}); });
  document.addEventListener('loadedmetadata', event => {
    if (event.target instanceof HTMLVideoElement) {
      const track = event.target.srcObject?.getVideoTracks?.()[0];
      if (track) rememberTrack(track);
      refreshDeviceNames().catch(() => {});
    }
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest?.('#preSettings,#camMenuBtn,#micMenuBtn')) {
      setTimeout(() => refreshDeviceNames().catch(() => {}), 40);
      setTimeout(() => refreshDeviceNames().catch(() => {}), 220);
    }
  }, true);

  const engineTimer = setInterval(() => { if (wrapEngine()) clearInterval(engineTimer); }, 25);
  setTimeout(() => clearInterval(engineTimer), 5000);
  setTimeout(() => { installDeviceSelectAuthority(); refreshDeviceNames().catch(() => {}); }, 250);
  setTimeout(() => refreshDeviceNames().catch(() => {}), 900);

  window.DominionCameraDeviceStability = Object.freeze({
    version:'1.1.0',
    refreshDeviceNames,
    snapshot:async()=>({
      cameras:(await devices('videoinput')).map(device=>({id:device.deviceId,label:device.label||''})),
      microphones:(await devices('audioinput')).map(device=>({id:device.deviceId,label:device.label||''})),
      activeCameraLabel:activeTrack('videoinput')?.label||''
    })
  });
})();
