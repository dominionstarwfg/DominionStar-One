(() => {
  'use strict';

  const engine = window.DominionStarMeetingEngine;
  if (!engine) return;

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const cameraKey = 'ds_meet_camera_id';
  const micKey = 'ds_meet_microphone_id';
  const speakerKey = 'ds_meet_speaker_id';
  let hotfixPreviewStream = null;
  let hotfixPreviewOwned = false;
  let hostPrejoinPrepared = false;
  let resubmitting = false;
  let cameraTransition = false;

  const randomDigits = n => Array.from({length:n}, () => Math.floor(Math.random() * 10)).join('');
  const formatMeetingId = value => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0,3)} ${digits.slice(3)}`;
    return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
  };

  const rememberLocalDevice = (kind, value) => {
    try {
      const key = kind === 'camera' ? cameraKey : kind === 'microphone' ? micKey : speakerKey;
      localStorage.setItem(key, value || '');
    } catch (_) {}
  };

  const patchLocalDevicePreferenceBoundary = async () => {
    try {
      const client = await window.DSAuth?.init?.();
      if (!client || client.__dsLocalDeviceBoundary) return;
      const originalFrom = client.from?.bind(client);
      if (!originalFrom) return;
      client.from = table => {
        const builder = originalFrom(table);
        if (table === 'meet_user_preferences' && builder?.upsert && !builder.__dsLocalDeviceBoundary) {
          const originalUpsert = builder.upsert.bind(builder);
          builder.upsert = (payload, ...args) => {
            if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
              const sanitized = {...payload};
              delete sanitized.camera_id;
              delete sanitized.microphone_id;
              delete sanitized.speaker_id;
              return originalUpsert(sanitized, ...args);
            }
            return originalUpsert(payload, ...args);
          };
          builder.__dsLocalDeviceBoundary = true;
        }
        return builder;
      };
      client.__dsLocalDeviceBoundary = true;
    } catch (_) {}
  };

  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (originalGetUserMedia && !navigator.mediaDevices.__dsLocalDeviceRouting) {
    navigator.mediaDevices.getUserMedia = constraints => {
      const next = {...(constraints || {})};
      try {
        const preferredCamera = localStorage.getItem(cameraKey) || '';
        const preferredMic = localStorage.getItem(micKey) || '';
        if (next.video === true && preferredCamera) next.video = {deviceId:{ideal:preferredCamera}};
        else if (next.video && typeof next.video === 'object' && preferredCamera && !next.video.deviceId) next.video = {...next.video, deviceId:{ideal:preferredCamera}};
        if (next.audio === true && preferredMic) next.audio = {deviceId:{ideal:preferredMic},echoCancellation:true,noiseSuppression:true,autoGainControl:true};
        else if (next.audio && typeof next.audio === 'object' && preferredMic && !next.audio.deviceId) next.audio = {...next.audio, deviceId:{ideal:preferredMic}};
      } catch (_) {}
      return originalGetUserMedia(next);
    };
    navigator.mediaDevices.__dsLocalDeviceRouting = true;
  }

  const stopStreamVideoTracks = stream => {
    if (!stream?.getVideoTracks) return;
    stream.getVideoTracks().forEach(track => {
      try { stream.removeTrack(track); } catch (_) {}
      try { if (track.readyState !== 'ended') track.stop(); } catch (_) {}
    });
  };

  const stopHotfixPreview = ({all=false}={}) => {
    if (!hotfixPreviewStream) return;
    stopStreamVideoTracks(hotfixPreviewStream);
    if (all) {
      hotfixPreviewStream.getAudioTracks?.().forEach(track => {
        try { hotfixPreviewStream.removeTrack(track); } catch (_) {}
        try { if (track.readyState !== 'ended') track.stop(); } catch (_) {}
      });
      hotfixPreviewStream = null;
      hotfixPreviewOwned = false;
    }
  };

  const setPreviewVisualState = ({videoOn, audioOn}) => {
    const preCam = $('preCam');
    const preMic = $('preMic');
    preCam?.classList.toggle('active', Boolean(videoOn));
    preMic?.classList.toggle('active', Boolean(audioOn));
    preCam?.setAttribute('aria-pressed', String(Boolean(videoOn)));
    preMic?.setAttribute('aria-pressed', String(Boolean(audioOn)));
    const fallback = $('prejoinFallback');
    const preview = $('prejoinVideo');
    if (preview) preview.hidden = !videoOn;
    if (fallback) fallback.hidden = Boolean(videoOn);
  };

  const startHotfixPreview = async () => {
    const preview = $('prejoinVideo');
    if (!preview || !navigator.mediaDevices?.getUserMedia) return;
    if (preview.srcObject?.getVideoTracks?.().some(track => track.readyState === 'live')) return;
    stopHotfixPreview({all:true});
    const cameraOff = Boolean($('alwaysJoinCameraOff')?.checked);
    const muted = Boolean($('alwaysJoinMuted')?.checked);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraOff ? false : {width:{ideal:1280},height:{ideal:720}},
        audio: muted ? false : {echoCancellation:true,noiseSuppression:true,autoGainControl:true}
      });
      hotfixPreviewStream = stream;
      hotfixPreviewOwned = true;
      preview.srcObject = stream;
      preview.muted = true;
      preview.autoplay = true;
      preview.playsInline = true;
      if (!cameraOff) await preview.play().catch(() => {});
      setPreviewVisualState({videoOn:!cameraOff && stream.getVideoTracks().some(t => t.readyState === 'live'), audioOn:!muted && stream.getAudioTracks().some(t => t.readyState === 'live')});
      await navigator.mediaDevices.enumerateDevices?.().then(devices => {
        const camera = devices.find(d => d.kind === 'videoinput' && d.deviceId);
        const mic = devices.find(d => d.kind === 'audioinput' && d.deviceId);
        if (camera && !localStorage.getItem(cameraKey)) rememberLocalDevice('camera', camera.deviceId);
        if (mic && !localStorage.getItem(micKey)) rememberLocalDevice('microphone', mic.deviceId);
      }).catch(() => {});
    } catch (_) {
      setPreviewVisualState({videoOn:false,audioOn:false});
    }
  };

  const enterHostPrejoin = ({room, passcode, waitingRoom=false, autoShare=false}={}) => {
    const roomId = String(room || randomDigits(10)).replace(/\D/g, '').slice(0,10);
    const code = String(passcode || randomDigits(6)).replace(/\D/g, '').slice(0,10);
    window.__DS_START_AS_HOST = true;
    window.__DS_WAITING_ROOM = Boolean(waitingRoom);
    window.__DS_MEETING_PASSCODE = code;
    window.__DS_AUTO_SHARE = Boolean(autoShare);
    if ($('roomId')) $('roomId').value = formatMeetingId(roomId);
    if ($('meetingPasscode')) $('meetingPasscode').value = code;
    history.replaceState(null, '', `${location.pathname}?room=${roomId}&host=1${new URLSearchParams(location.search).get('desktop') === '1' ? '&desktop=1' : ''}`);
    const prejoin = $('prejoin');
    if (prejoin) prejoin.dataset.flow = 'join';
    document.body.classList.add('meet-flow-active', 'prejoin-active');
    const heading = $('joinForm')?.querySelector('h1');
    const subcopy = $('joinForm')?.querySelector('.subcopy');
    const label = $('joinForm')?.querySelector('[data-join-label]');
    if (heading) heading.textContent = 'Ready to start?';
    if (subcopy) subcopy.textContent = 'Check your camera and microphone before you start the meeting.';
    if (label) label.textContent = 'Start Meeting';
    hostPrejoinPrepared = true;
    startHotfixPreview().catch(() => {});
  };

  // Desktop Meet Home arrives as /meet/?desktop=1&action=new|share. Consume
  // that bootstrap intent immediately, before Executive 6's window-load handler
  // can synthesize a New Meeting click and auto-submit the room. This makes the
  // installed desktop client deterministically stop at camera/mic pre-join.
  const bootstrapParams = new URLSearchParams(location.search);
  const bootstrapAction = bootstrapParams.get('action') || '';
  if (bootstrapParams.get('desktop') === '1' && (bootstrapAction === 'new' || bootstrapAction === 'share')) {
    enterHostPrejoin({autoShare:bootstrapAction === 'share'});
    window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'rc13.1-desktop-prejoin-v2';
  }

  document.addEventListener('click', event => {
    const newMeeting = event.target.closest?.('#newMeetingAction');
    if (newMeeting) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      enterHostPrejoin({autoShare:false});
      return;
    }
    const shareMeeting = event.target.closest?.('#shareScreenAction');
    if (shareMeeting) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      enterHostPrejoin({autoShare:true});
      return;
    }
    const scheduledStart = event.target.closest?.('[data-start-id]');
    if (scheduledStart) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      try {
        const meetings = JSON.parse(localStorage.getItem('ds_meet_scheduled_v1') || '[]');
        const item = meetings.find(entry => String(entry.id) === String(scheduledStart.dataset.startId));
        enterHostPrejoin({room:scheduledStart.dataset.startId,passcode:item?.passcode||'',waitingRoom:Boolean(item?.waitingRoom)});
      } catch (_) {
        enterHostPrejoin({room:scheduledStart.dataset.startId});
      }
      return;
    }
  }, true);

  const preCam = $('preCam');
  const preMic = $('preMic');
  preCam?.addEventListener('click', async event => {
    if (!hostPrejoinPrepared) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const currentlyOn = Boolean(hotfixPreviewStream?.getVideoTracks?.().some(t => t.readyState === 'live'));
    if (currentlyOn) {
      stopStreamVideoTracks(hotfixPreviewStream);
      if ($('alwaysJoinCameraOff')) $('alwaysJoinCameraOff').checked = true;
      setPreviewVisualState({videoOn:false,audioOn:Boolean(hotfixPreviewStream?.getAudioTracks?.().some(t => t.readyState === 'live'))});
    } else {
      if ($('alwaysJoinCameraOff')) $('alwaysJoinCameraOff').checked = false;
      try {
        const fresh = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
        const track = fresh.getVideoTracks()[0];
        if (!hotfixPreviewStream) hotfixPreviewStream = new MediaStream();
        if (track) hotfixPreviewStream.addTrack(track);
        $('prejoinVideo').srcObject = hotfixPreviewStream;
        await $('prejoinVideo').play().catch(() => {});
        setPreviewVisualState({videoOn:Boolean(track),audioOn:Boolean(hotfixPreviewStream.getAudioTracks().some(t => t.readyState === 'live'))});
      } catch (_) {
        if ($('alwaysJoinCameraOff')) $('alwaysJoinCameraOff').checked = true;
        setPreviewVisualState({videoOn:false,audioOn:Boolean(hotfixPreviewStream?.getAudioTracks?.().some(t => t.readyState === 'live'))});
      }
    }
  }, true);

  preMic?.addEventListener('click', async event => {
    if (!hostPrejoinPrepared) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const track = hotfixPreviewStream?.getAudioTracks?.()[0] || null;
    const nextMuted = !Boolean(track && track.enabled);
    if (track) track.enabled = nextMuted;
    if ($('alwaysJoinMuted')) $('alwaysJoinMuted').checked = !nextMuted;
    setPreviewVisualState({videoOn:Boolean(hotfixPreviewStream?.getVideoTracks?.().some(t => t.readyState === 'live')),audioOn:Boolean(track && track.enabled)});
  }, true);

  $('cameraSelect')?.addEventListener('change', event => rememberLocalDevice('camera', event.target.value), true);
  $('microphoneSelect')?.addEventListener('change', event => rememberLocalDevice('microphone', event.target.value), true);
  $('speakerSelect')?.addEventListener('change', event => rememberLocalDevice('speaker', event.target.value), true);

  $('joinForm')?.addEventListener('submit', async event => {
    if (resubmitting) {
      resubmitting = false;
      return;
    }
    const previewStream = $('prejoinVideo')?.srcObject;
    if (!previewStream?.getVideoTracks?.().some(track => track.readyState === 'live') && !hotfixPreviewOwned) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (previewStream) stopStreamVideoTracks(previewStream);
    stopHotfixPreview({all:true});
    $('prejoinVideo').srcObject = null;
    await sleep(1100);
    resubmitting = true;
    $('joinForm').requestSubmit();
  }, true);

  const setCameraButton = on => {
    const button = $('camBtn');
    if (!button) return;
    button.classList.toggle('is-off', !on);
    button.setAttribute('aria-label', on ? 'Stop video' : 'Start video');
    const label = button.querySelector('.tool-label');
    if (label) label.textContent = on ? 'Stop Video' : 'Start Video';
  };

  $('camBtn')?.addEventListener('click', async event => {
    if (cameraTransition) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
    const snapshot = engine.snapshot?.() || {};
    const currentlyOn = Boolean(snapshot.mediaState?.video && snapshot.media?.cameraTrackState !== 'ended');
    if (currentlyOn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    cameraTransition = true;
    const button = $('camBtn');
    if (button) button.disabled = true;
    setCameraButton(false);
    try {
      await engine.toggleVideo(false).catch(() => false);
      const localSurfaces = [$('prejoinVideo'), $('selfVideo')];
      localSurfaces.forEach(video => {
        const stream = video?.srcObject;
        if (stream) stopStreamVideoTracks(stream);
      });
      await sleep(1200);
      const actual = await engine.toggleVideo(true);
      const latest = engine.snapshot?.() || {};
      const live = Boolean(actual && latest.mediaState?.video !== false && latest.media?.cameraTrackState === 'live');
      setCameraButton(live);
      if (!live) throw new Error('Camera could not start after releasing the previous preview stream.');
    } catch (error) {
      setCameraButton(false);
      const layer = $('toastLayer');
      if (layer) {
        const node = document.createElement('div');
        node.className = 'toast toast-error';
        node.textContent = error?.message || 'Camera could not start';
        layer.append(node);
        setTimeout(() => node.remove(), 3500);
      }
    } finally {
      if (button) button.disabled = false;
      cameraTransition = false;
    }
  }, true);

  patchLocalDevicePreferenceBoundary().catch(() => {});
  window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'rc13.1-media-prejoin-local-devices';
})();