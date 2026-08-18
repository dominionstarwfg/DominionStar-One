(() => {
  'use strict';

  const engine = window.DominionStarMeetingEngine;
  if (!engine) return;

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const cameraKey = 'ds_meet_camera_id';
  const micKey = 'ds_meet_microphone_id';
  const speakerKey = 'ds_meet_speaker_id';
  const desktopParams = new URLSearchParams(location.search);
  const desktopMode = desktopParams.get('desktop') === '1';
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

const nativePermissionBlocked = value => ['denied', 'restricted'].includes(String(value || '').toLowerCase());
const ensureNativeMediaPermissions = async constraints => {
  if (!desktopMode || !window.dominionDesktop?.getMediaPermissions) return true;
  const kinds = [];
  if (constraints?.video) kinds.push('camera');
  if (constraints?.audio) kinds.push('microphone');
  if (!kinds.length) return true;

  let status = await window.dominionDesktop.getMediaPermissions().catch(() => null);
  if (!status?.ok) return true;
  const undetermined = kinds.filter(kind => String(status?.[kind] || '').toLowerCase() === 'not-determined');
  if (undetermined.length && window.dominionDesktop?.requestMediaPermissions) {
    status = await window.dominionDesktop.requestMediaPermissions(undetermined).catch(() => status);
  }
  const blocked = kinds.filter(kind => nativePermissionBlocked(status?.[kind]));
  if (!blocked.length) return true;

  const names = blocked.map(kind => kind === 'camera' ? 'Camera' : 'Microphone').join(' and ');
  const error = new Error(`DominionStar Meet needs macOS ${names} permission. Open System Settings > Privacy & Security, allow DominionStar Meet, then reopen the app.`);
  error.name = 'NotAllowedError';
  error.permissionKinds = blocked;
  throw error;
};

  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (originalGetUserMedia && !navigator.mediaDevices.__dsLocalDeviceRouting) {
    navigator.mediaDevices.getUserMedia = async constraints => {
      const next = {...(constraints || {})};
      try {
        const preferredCamera = localStorage.getItem(cameraKey) || '';
        const preferredMic = localStorage.getItem(micKey) || '';
        if (next.video === true && preferredCamera) next.video = {deviceId:{ideal:preferredCamera}};
        else if (next.video && typeof next.video === 'object' && preferredCamera && !next.video.deviceId) next.video = {...next.video, deviceId:{ideal:preferredCamera}};
        if (next.audio === true && preferredMic) next.audio = {deviceId:{ideal:preferredMic},echoCancellation:true,noiseSuppression:true,autoGainControl:true};
        else if (next.audio && typeof next.audio === 'object' && preferredMic && !next.audio.deviceId) next.audio = {...next.audio, deviceId:{ideal:preferredMic}};
      } catch (_) {}
      await ensureNativeMediaPermissions(next);
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
    if (preview.srcObject?.getTracks?.().some(track => track.readyState === 'live')) {
      hotfixPreviewStream=preview.srcObject;hotfixPreviewOwned=false;
      setPreviewVisualState({videoOn:preview.srcObject.getVideoTracks?.().some(t=>t.readyState==='live'),audioOn:preview.srcObject.getAudioTracks?.().some(t=>t.readyState==='live'&&t.enabled)});
      return preview.srcObject;
    }
    stopHotfixPreview({all:true});
    const cameraOff = Boolean($('alwaysJoinCameraOff')?.checked);
    const muted = Boolean($('alwaysJoinMuted')?.checked);
    try {
      if(window.__DS_PREJOIN_MEDIA_PROMISE){
        const shared=await window.__DS_PREJOIN_MEDIA_PROMISE.catch(()=>null);
        if(shared){hotfixPreviewStream=shared;hotfixPreviewOwned=false;preview.srcObject=shared;setPreviewVisualState({videoOn:shared.getVideoTracks?.().some(t=>t.readyState==='live'),audioOn:shared.getAudioTracks?.().some(t=>t.readyState==='live'&&t.enabled)});return shared;}
      }
      const acquisition=navigator.mediaDevices.getUserMedia({
        video: cameraOff ? false : {width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},
        audio: muted ? false : {echoCancellation:true,noiseSuppression:true,autoGainControl:true}
      });
      window.__DS_PREJOIN_MEDIA_PROMISE=acquisition;
      const stream = await acquisition.finally(()=>{if(window.__DS_PREJOIN_MEDIA_PROMISE===acquisition)window.__DS_PREJOIN_MEDIA_PROMISE=null;});
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
    } catch (error) {
      setPreviewVisualState({videoOn:false,audioOn:false});
      const status = $('joinStatus');
      if (status && error?.message) {
        status.textContent = error.message;
        status.hidden = false;
      }
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

  window.DominionStarEnterHostPrejoin = options => enterHostPrejoin(options || {});

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
  if (bootstrapParams.get('desktop') === '1' && bootstrapAction === 'personal') {
    const openPersonalRoom = () => setTimeout(() => $('personalMeetingAction')?.click(), 0);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openPersonalRoom, {once:true});
    else openPersonalRoom();
    window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'rc13.2-desktop-personal-room';
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

  // Zoom-style manual join: Meeting ID first, passcode second. This runs before
  // preview handoff so invalid credentials never tear down camera/mic state.
  const manualJoin = {active:false,step:'meeting-id',verifiedRoom:'',bypassOnce:false,verifying:false};
  const joinForm = $('joinForm');
  const roomInput = $('roomId');
  const passcodeInput = $('meetingPasscode');
  const roomField = roomInput?.closest('label');
  const passcodeField = passcodeInput?.closest('label');
  const displayNameField = $('displayNameField');
  const accountIdentity = $('accountIdentity');
  const joinPreferences = joinForm?.querySelector('.join-preferences');
  const joinHeading = joinForm?.querySelector('h1');
  const joinSubcopy = joinForm?.querySelector('.subcopy');
  const joinLabel = joinForm?.querySelector('[data-join-label]');
  const initialHidden = {
    displayName:Boolean(displayNameField?.hidden),
    accountIdentity:Boolean(accountIdentity?.hidden),
    preferences:Boolean(joinPreferences?.hidden)
  };
  const manualDigits = value => String(value || '').replace(/\D/g, '').slice(0,10);
  const isHostJoin = () => window.__DS_START_AS_HOST === true || new URLSearchParams(location.search).get('host') === '1';
  const setManualJoinStatus = (message='', state='progress') => {
    const status = $('joinStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
    status.hidden = !message;
  };
  const restoreManualIdentity = () => {
    if (displayNameField) displayNameField.hidden = initialHidden.displayName;
    if (accountIdentity) accountIdentity.hidden = initialHidden.accountIdentity;
    if (joinPreferences) joinPreferences.hidden = initialHidden.preferences;
  };
  const showMeetingIdStep = () => {
    if (!joinForm || isHostJoin()) return;
    manualJoin.active = true;
    manualJoin.step = 'meeting-id';
    manualJoin.verifiedRoom = '';
    if (roomField) roomField.hidden = false;
    if (passcodeField) passcodeField.hidden = true;
    if (passcodeInput) {
      passcodeInput.required = false;
      passcodeInput.value = '';
    }
    restoreManualIdentity();
    if (joinHeading) joinHeading.textContent = 'Join a meeting';
    if (joinSubcopy) joinSubcopy.textContent = 'Enter the Meeting ID provided by the host.';
    if (joinLabel) joinLabel.textContent = 'Join';
    setManualJoinStatus('');
    queueMicrotask(() => roomInput?.focus());
  };
  const showPasscodeStep = room => {
    manualJoin.active = true;
    manualJoin.step = 'passcode';
    manualJoin.verifiedRoom = room;
    if (roomField) roomField.hidden = true;
    if (passcodeField) passcodeField.hidden = false;
    if (passcodeInput) passcodeInput.required = true;
    if (displayNameField) displayNameField.hidden = true;
    if (accountIdentity) accountIdentity.hidden = true;
    if (joinPreferences) joinPreferences.hidden = true;
    if (joinHeading) joinHeading.textContent = 'Enter meeting passcode';
    if (joinSubcopy) joinSubcopy.textContent = `Meeting ID ${formatMeetingId(room)}`;
    if (joinLabel) joinLabel.textContent = 'Join Meeting';
    setManualJoinStatus('');
    queueMicrotask(() => passcodeInput?.focus());
  };
  const resolveManualJoin = async (room, passcode='') => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/.netlify/functions/resolve-meeting-join', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({room,passcode}),
        signal:controller.signal
      });
      const record = await response.json().catch(() => null);
      if (response.status === 404 || record?.found === false) {
        throw new Error(record?.error || 'Invalid meeting ID. Check the meeting ID and try again.');
      }
      if (!response.ok) {
        throw new Error(record?.error || 'Meeting verification is temporarily unavailable. Try again.');
      }
      if (!record?.found) throw new Error('Invalid meeting ID. Check the meeting ID and try again.');
      return record;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('The meeting service took too long to respond. Check your connection and try again.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
  const continueManualJoin = () => {
    manualJoin.bypassOnce = true;
    joinForm?.requestSubmit();
  };

  document.addEventListener('click', event => {
    if (!event.target.closest?.('#joinMeetingAction')) return;
    queueMicrotask(showMeetingIdStep);
  }, true);

  roomInput?.addEventListener('input', () => {
    if (manualJoin.active && manualJoin.step === 'meeting-id') manualJoin.verifiedRoom = '';
  });

  joinForm?.addEventListener('submit', async event => {
    if (manualJoin.bypassOnce) {
      manualJoin.bypassOnce = false;
      return;
    }
    if (!manualJoin.active || isHostJoin()) return;

    const room = manualDigits(roomInput?.value);
    if (room.length < 6) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setManualJoinStatus('Enter a valid meeting ID.', 'error');
      roomInput?.focus();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (manualJoin.verifying) return;
    manualJoin.verifying = true;
    const submit = joinForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;

    try {
      if (manualJoin.step === 'meeting-id') {
        const record = await resolveManualJoin(room, '');
        if (record.passcode_required) {
          showPasscodeStep(room);
          return;
        }
        manualJoin.active = false;
        continueManualJoin();
        return;
      }

      if (room !== manualJoin.verifiedRoom) {
        showMeetingIdStep();
        setManualJoinStatus('Meeting ID changed. Verify the meeting again.', 'error');
        return;
      }

      const passcode = manualDigits(passcodeInput?.value);
      if (!passcode) {
        setManualJoinStatus('Enter the meeting passcode.', 'error');
        passcodeInput?.focus();
        return;
      }

      const record = await resolveManualJoin(room, passcode);
      if (record.passcode_required && record.passcode_valid === false) {
        if (passcodeInput) passcodeInput.value = '';
        setManualJoinStatus('Incorrect meeting passcode.', 'error');
        passcodeInput?.focus();
        return;
      }

      manualJoin.active = false;
      continueManualJoin();
    } catch (error) {
      setManualJoinStatus(error?.message || 'Could not verify this meeting. Try again.', 'error');
    } finally {
      manualJoin.verifying = false;
      if (submit) submit.disabled = false;
    }
  }, true);

  window.__DS_MEET_MANUAL_JOIN_FLOW = 'zoom-id-then-passcode-v1';

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

  // In-meeting camera lifecycle is owned exclusively by DominionStarMeetingEngine.


  patchLocalDevicePreferenceBoundary().catch(() => {});
  window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'rc13.3-camera-privacy-single-owner';
})();