(() => {
  'use strict';

  const engine = window.DominionStarMeetingEngine;
  if (!engine) return;

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const desktopMode = new URLSearchParams(location.search).get('desktop') === '1';
  const DEVICE_KEYS = Object.freeze({
    camera:'ds_meet_camera_id',
    microphone:'ds_meet_microphone_id',
    speaker:'ds_meet_speaker_id'
  });

  let hostPrejoinPrepared = false;
  let hostPreviewStream = null;
  let hostPreviewTransitioning = false;
  let hostJoinResubmit = false;

  const randomDigits = n => Array.from({length:n}, () => Math.floor(Math.random() * 10)).join('');
  const formatMeetingId = value => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0,3)} ${digits.slice(3)}`;
    return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
  };
  const rememberLocalDevice = (kind, value) => {
    try { localStorage.setItem(DEVICE_KEYS[kind], String(value || '')); } catch {}
  };
  const preferredDevice = kind => {
    try { return localStorage.getItem(DEVICE_KEYS[kind]) || ''; } catch { return ''; }
  };

  const permissionBlocked = value => ['denied','restricted'].includes(String(value || '').toLowerCase());
  const ensureNativeMediaPermissions = async constraints => {
    if (!desktopMode || !window.dominionDesktop?.getMediaPermissions) return true;
    const kinds = [];
    if (constraints?.video) kinds.push('camera');
    if (constraints?.audio) kinds.push('microphone');
    if (!kinds.length) return true;

    let status = await window.dominionDesktop.getMediaPermissions().catch(() => null);
    if (!status?.ok) return true;
    const undecided = kinds.filter(kind => String(status?.[kind] || '').toLowerCase() === 'not-determined');
    if (undecided.length && window.dominionDesktop?.requestMediaPermissions) {
      status = await window.dominionDesktop.requestMediaPermissions(undecided).catch(() => status);
    }
    const blocked = kinds.filter(kind => permissionBlocked(status?.[kind]));
    if (!blocked.length) return true;
    const names = blocked.map(kind => kind === 'camera' ? 'Camera' : 'Microphone').join(' and ');
    const error = new Error(`DominionStar Meet needs macOS ${names} permission. Open System Settings > Privacy & Security, allow DominionStar Meet, then reopen the app.`);
    error.name = 'NotAllowedError';
    error.permissionKinds = blocked;
    throw error;
  };

  const stopTracks = (stream, kind = '') => {
    if (!(stream instanceof MediaStream)) return;
    for (const track of stream.getTracks()) {
      if (kind && track.kind !== kind) continue;
      try { stream.removeTrack(track); } catch {}
      try { if (track.readyState !== 'ended') track.stop(); } catch {}
    }
  };

  const hostVideoOn = () => Boolean(hostPreviewStream?.getVideoTracks?.().some(track => track.readyState === 'live'));
  const hostAudioOn = () => Boolean(hostPreviewStream?.getAudioTracks?.().some(track => track.readyState === 'live' && track.enabled));

  const setPreviewVisualState = ({videoOn = hostVideoOn(), audioOn = hostAudioOn()} = {}) => {
    const preCam = $('preCam');
    const preMic = $('preMic');
    if (preCam) {
      preCam.classList.toggle('active', Boolean(videoOn));
      preCam.setAttribute('aria-pressed', String(Boolean(videoOn)));
      preCam.disabled = false;
    }
    if (preMic) {
      preMic.classList.toggle('active', Boolean(audioOn));
      preMic.setAttribute('aria-pressed', String(Boolean(audioOn)));
      preMic.disabled = false;
    }
    const preview = $('prejoinVideo');
    const fallback = $('prejoinFallback');
    if (preview) preview.hidden = !videoOn;
    if (fallback) fallback.hidden = Boolean(videoOn);
  };

  const showPrejoinError = message => {
    const status = $('joinStatus');
    if (!status) return;
    status.textContent = String(message || 'Media device unavailable.');
    status.dataset.state = 'error';
    status.hidden = false;
  };
  const clearPrejoinError = () => {
    const status = $('joinStatus');
    if (!status) return;
    status.textContent = '';
    status.hidden = true;
  };

  const mediaConstraints = ({video = false, audio = false, cameraId = '', microphoneId = ''} = {}) => ({
    video: video ? {
      width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30,max:30},
      ...(cameraId ? {deviceId:{ideal:cameraId}} : {})
    } : false,
    audio: audio ? {
      echoCancellation:true, noiseSuppression:true, autoGainControl:true,
      ...(microphoneId ? {deviceId:{ideal:microphoneId}} : {})
    } : false
  });

  const acquireHostTracks = async request => {
    const constraints = mediaConstraints(request);
    await ensureNativeMediaPermissions(constraints);
    const acquisition = navigator.mediaDevices.getUserMedia(constraints);
    window.__DS_PREJOIN_MEDIA_PROMISE = acquisition;
    try { return await acquisition; }
    finally {
      if (window.__DS_PREJOIN_MEDIA_PROMISE === acquisition) window.__DS_PREJOIN_MEDIA_PROMISE = null;
    }
  };

  const attachHostPreview = async stream => {
    hostPreviewStream = stream instanceof MediaStream ? stream : new MediaStream();
    const preview = $('prejoinVideo');
    if (preview) {
      preview.srcObject = hostPreviewStream;
      preview.muted = true;
      preview.autoplay = true;
      preview.playsInline = true;
      if (hostVideoOn()) await preview.play().catch(() => {});
    }
    setPreviewVisualState();
    window.DominionCameraDeviceStability?.refresh?.().catch?.(() => {});
    return hostPreviewStream;
  };

  const startHostPreview = async () => {
    if (!hostPrejoinPrepared || hostPreviewTransitioning) return hostPreviewStream;
    const existing = $('prejoinVideo')?.srcObject;
    if (existing instanceof MediaStream && existing.getTracks().some(track => track.readyState === 'live')) {
      hostPreviewStream = existing;
      setPreviewVisualState();
      return existing;
    }
    if (hostPreviewStream?.getTracks?.().some(track => track.readyState === 'live')) {
      await attachHostPreview(hostPreviewStream);
      return hostPreviewStream;
    }

    clearPrejoinError();
    const cameraOff = Boolean($('alwaysJoinCameraOff')?.checked);
    const muted = Boolean($('alwaysJoinMuted')?.checked);
    try {
      const stream = (!cameraOff || !muted)
        ? await acquireHostTracks({
            video:!cameraOff,
            audio:!muted,
            cameraId:preferredDevice('camera'),
            microphoneId:preferredDevice('microphone')
          })
        : new MediaStream();
      await attachHostPreview(stream);
      return stream;
    } catch (error) {
      hostPreviewStream = new MediaStream();
      await attachHostPreview(hostPreviewStream);
      showPrejoinError(error?.message || 'Camera and microphone unavailable.');
      return hostPreviewStream;
    }
  };

  const replaceHostTrack = async (kind, deviceId = '') => {
    if (!hostPrejoinPrepared || hostPreviewTransitioning) return false;
    const isVideo = kind === 'video';
    const key = isVideo ? 'camera' : 'microphone';
    const request = isVideo
      ? {video:true,audio:false,cameraId:deviceId}
      : {video:false,audio:true,microphoneId:deviceId};
    clearPrejoinError();
    try {
      const fresh = await acquireHostTracks(request);
      const track = isVideo ? fresh.getVideoTracks()[0] : fresh.getAudioTracks()[0];
      if (!track) throw new Error(isVideo ? 'No camera was available.' : 'No microphone was available.');
      if (!(hostPreviewStream instanceof MediaStream)) hostPreviewStream = new MediaStream();
      stopTracks(hostPreviewStream, isVideo ? 'video' : 'audio');
      hostPreviewStream.addTrack(track);
      rememberLocalDevice(key, String(track.getSettings?.().deviceId || deviceId || ''));
      await attachHostPreview(hostPreviewStream);
      return true;
    } catch (error) {
      showPrejoinError(error?.message || `${isVideo ? 'Camera' : 'Microphone'} unavailable.`);
      setPreviewVisualState();
      return false;
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
    history.replaceState(null, '', `${location.pathname}?room=${roomId}&host=1${desktopMode ? '&desktop=1' : ''}`);
    const prejoin = $('prejoin');
    if (prejoin) prejoin.dataset.flow = 'join';
    document.body.classList.add('meet-flow-active','prejoin-active');
    const heading = $('joinForm')?.querySelector('h1');
    const subcopy = $('joinForm')?.querySelector('.subcopy');
    const label = $('joinForm')?.querySelector('[data-join-label]');
    if (heading) heading.textContent = 'Ready to start?';
    if (subcopy) subcopy.textContent = 'Check your camera and microphone before you start the meeting.';
    if (label) label.textContent = 'Start Meeting';
    hostPrejoinPrepared = true;
    void startHostPreview();
  };

  window.DominionStarEnterHostPrejoin = options => enterHostPrejoin(options || {});

  const bootstrapParams = new URLSearchParams(location.search);
  const bootstrapAction = bootstrapParams.get('action') || '';
  if (desktopMode && (bootstrapAction === 'new' || bootstrapAction === 'share')) {
    enterHostPrejoin({autoShare:bootstrapAction === 'share'});
    window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'single-owner-host-prejoin-v1';
  }
  if (desktopMode && bootstrapAction === 'personal') {
    const openPersonalRoom = () => setTimeout(() => $('personalMeetingAction')?.click(), 0);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',openPersonalRoom,{once:true});
    else openPersonalRoom();
    window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'single-owner-personal-room-v1';
  }

  // Capture dashboard start commands before Executive 6's historical auto-submit
  // handlers. Once host prejoin is active, only this scoped controller owns the
  // preview stream; guest prejoin and in-meeting media remain Executive 6 owned.
  document.addEventListener('click', event => {
    const newMeeting = event.target.closest?.('#newMeetingAction');
    if (newMeeting) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      enterHostPrejoin({autoShare:false});
      return;
    }
    const shareMeeting = event.target.closest?.('#shareScreenAction');
    if (shareMeeting) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      enterHostPrejoin({autoShare:true});
      return;
    }
    const scheduledStart = event.target.closest?.('[data-start-id]');
    if (scheduledStart) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      try {
        const meetings = JSON.parse(localStorage.getItem('ds_meet_scheduled_v1') || '[]');
        const item = meetings.find(entry => String(entry.id) === String(scheduledStart.dataset.startId));
        enterHostPrejoin({room:scheduledStart.dataset.startId,passcode:item?.passcode||'',waitingRoom:Boolean(item?.waitingRoom)});
      } catch {
        enterHostPrejoin({room:scheduledStart.dataset.startId});
      }
    }
  }, true);

  $('preCam')?.addEventListener('click', async event => {
    if (!hostPrejoinPrepared) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (hostPreviewTransitioning) return;
    const button = $('preCam');
    if (button) button.disabled = true;
    try {
      if (hostVideoOn()) {
        stopTracks(hostPreviewStream,'video');
        await attachHostPreview(hostPreviewStream);
      } else {
        await replaceHostTrack('video',preferredDevice('camera'));
      }
    } finally { setPreviewVisualState(); }
  }, true);

  $('preMic')?.addEventListener('click', async event => {
    if (!hostPrejoinPrepared) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (hostPreviewTransitioning) return;
    const track = hostPreviewStream?.getAudioTracks?.().find(item => item.readyState === 'live');
    if (track) {
      track.enabled = !track.enabled;
      setPreviewVisualState();
      return;
    }
    await replaceHostTrack('audio',preferredDevice('microphone'));
  }, true);

  $('cameraSelect')?.addEventListener('change', async event => {
    rememberLocalDevice('camera',event.target.value);
    if (!hostPrejoinPrepared) return;
    event.stopImmediatePropagation();
    await replaceHostTrack('video',event.target.value);
  }, true);
  $('microphoneSelect')?.addEventListener('change', async event => {
    rememberLocalDevice('microphone',event.target.value);
    if (!hostPrejoinPrepared) return;
    event.stopImmediatePropagation();
    await replaceHostTrack('audio',event.target.value);
  }, true);
  $('speakerSelect')?.addEventListener('change', event => rememberLocalDevice('speaker',event.target.value), true);

  // Zoom-style manual join: Meeting ID first, passcode second. This is a flow
  // concern only; it does not own guest media acquisition.
  const manualJoin = {active:false,step:'meeting-id',verifiedRoom:'',bypassOnce:false,verifying:false,identityHidden:null};
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
    const hidden = manualJoin.identityHidden;
    if (!hidden) return;
    if (displayNameField) displayNameField.hidden = hidden.displayName;
    if (accountIdentity) accountIdentity.hidden = hidden.accountIdentity;
    if (joinPreferences) joinPreferences.hidden = hidden.preferences;
  };
  const showMeetingIdStep = () => {
    if (!joinForm || isHostJoin()) return;
    manualJoin.active = true;
    manualJoin.step = 'meeting-id';
    manualJoin.verifiedRoom = '';
    if (roomField) roomField.hidden = false;
    if (passcodeField) passcodeField.hidden = true;
    if (passcodeInput) { passcodeInput.required = false; passcodeInput.value = ''; }
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
    const timeout = setTimeout(() => controller.abort(),10000);
    try {
      const response = await fetch('/.netlify/functions/resolve-meeting-join', {
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({room,passcode}), signal:controller.signal
      });
      const record = await response.json().catch(() => null);
      if (response.status === 404 || record?.found === false) throw new Error(record?.error || 'Invalid meeting ID. Check the meeting ID and try again.');
      if (!response.ok) throw new Error(record?.error || 'Meeting verification is temporarily unavailable. Try again.');
      if (!record?.found) throw new Error('Invalid meeting ID. Check the meeting ID and try again.');
      return record;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('The meeting service took too long to respond. Check your connection and try again.');
      throw error;
    } finally { clearTimeout(timeout); }
  };
  const continueManualJoin = () => {
    manualJoin.bypassOnce = true;
    queueMicrotask(() => joinForm?.requestSubmit());
  };

  document.addEventListener('click', event => {
    if (!event.target.closest?.('#joinMeetingAction')) return;
    queueMicrotask(() => {
      manualJoin.identityHidden = {
        displayName:Boolean(displayNameField?.hidden),
        accountIdentity:Boolean(accountIdentity?.hidden),
        preferences:Boolean(joinPreferences?.hidden)
      };
      showMeetingIdStep();
    });
  }, true);

  roomInput?.addEventListener('input', () => {
    if (manualJoin.active && manualJoin.step === 'meeting-id') manualJoin.verifiedRoom = '';
  });

  joinForm?.addEventListener('submit', async event => {
    if (manualJoin.bypassOnce) { manualJoin.bypassOnce = false; return; }
    if (!manualJoin.active || isHostJoin()) return;
    const room = manualDigits(roomInput?.value);
    if (room.length < 6) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      setManualJoinStatus('Enter a valid meeting ID.','error'); roomInput?.focus(); return;
    }
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (manualJoin.verifying) return;
    manualJoin.verifying = true;
    const submit = joinForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      if (manualJoin.step === 'meeting-id') {
        const record = await resolveManualJoin(room,'');
        if (record.passcode_required) { showPasscodeStep(room); return; }
        manualJoin.active = false; continueManualJoin(); return;
      }
      if (room !== manualJoin.verifiedRoom) {
        showMeetingIdStep(); setManualJoinStatus('Meeting ID changed. Verify the meeting again.','error'); return;
      }
      const passcode = manualDigits(passcodeInput?.value);
      if (!passcode) { setManualJoinStatus('Enter the meeting passcode.','error'); passcodeInput?.focus(); return; }
      const record = await resolveManualJoin(room,passcode);
      if (record.passcode_required && record.passcode_valid === false) {
        if (passcodeInput) passcodeInput.value = '';
        setManualJoinStatus('Incorrect meeting passcode.','error'); passcodeInput?.focus(); return;
      }
      manualJoin.active = false; continueManualJoin();
    } catch (error) {
      setManualJoinStatus(error?.message || 'Could not verify this meeting. Try again.','error');
    } finally {
      manualJoin.verifying = false;
      if (submit) submit.disabled = false;
    }
  }, true);

  window.__DS_MEET_MANUAL_JOIN_FLOW = 'zoom-id-then-passcode-v2-flow-only';

  // Host prejoin owns its preview only until Start Meeting. Release once, wait a
  // short hardware handoff interval, then let Executive 6/meeting-engine become
  // the sole in-meeting media owner. No 1.1-second synthetic freeze.
  joinForm?.addEventListener('submit', async event => {
    if (hostJoinResubmit) { hostJoinResubmit = false; return; }
    if (!hostPrejoinPrepared || !(hostPreviewStream instanceof MediaStream) || hostPreviewTransitioning) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    hostPreviewTransitioning = true;
    stopTracks(hostPreviewStream);
    hostPreviewStream = null;
    if ($('prejoinVideo')) $('prejoinVideo').srcObject = null;
    setPreviewVisualState({videoOn:false,audioOn:false});
    await sleep(220);
    hostJoinResubmit = true;
    hostPrejoinPrepared = false;
    hostPreviewTransitioning = false;
    joinForm.requestSubmit();
  }, true);

  // Zoom host departure parity. Reuse the established Executive 6 leave/end
  // lifecycle; only the replacement-host checkpoint lives here.
  const leaveOnlyButton = $('leaveOnlyBtn');
  const endAllButton = $('endAllBtn');
  const leaveDialog = $('leaveDialog');
  const leaveCopy = $('leaveCopy');
  const baseLeaveOnlyHandler = leaveOnlyButton?.onclick;
  const baseLeaveCopy = leaveCopy?.textContent || 'You can leave the meeting at any time.';
  const baseLeaveLabel = leaveOnlyButton?.textContent || 'Leave Meeting';
  const participantName = node => String(node?.querySelector('.participant-name')?.firstChild?.textContent || node?.querySelector('.tile-overlay > span:first-child')?.textContent || 'Participant')
    .replace(/\s+\((?:Host|Co-host)\)\s*$/i,'').trim() || 'Participant';
  const hostTransferCandidates = () => {
    const candidates = new Map();
    document.querySelectorAll('#participantList .participant-row[data-row]').forEach(row => {
      const id = String(row.dataset.row || '');
      if (!id || id === 'self' || row.classList.contains('is-offline')) return;
      const label = String(row.querySelector('.participant-name')?.firstChild?.textContent || '');
      if (/\(Host\)\s*$/i.test(label)) return;
      candidates.set(id,{id,name:participantName(row)});
    });
    document.querySelectorAll('#filmstripTrack .remote-tile[data-tile]').forEach(tile => {
      const id = String(tile.dataset.tile || '');
      if (!id || id === 'self' || candidates.has(id)) return;
      const label = String(tile.querySelector('.tile-overlay > span:first-child')?.textContent || '');
      if (/\(Host\)\s*$/i.test(label)) return;
      candidates.set(id,{id,name:participantName(tile)});
    });
    return [...candidates.values()];
  };
  const resetHostTransferPrompt = () => {
    $('hostTransferField')?.remove();
    if (leaveCopy) leaveCopy.textContent = baseLeaveCopy;
    if (leaveOnlyButton) {
      leaveOnlyButton.textContent = baseLeaveLabel;
      leaveOnlyButton.disabled = false;
      delete leaveOnlyButton.dataset.hostTransferStep;
    }
  };
  const showHostTransferPrompt = candidates => {
    resetHostTransferPrompt();
    if (!leaveDialog || !leaveOnlyButton) return;
    const field = document.createElement('label');
    field.id = 'hostTransferField';
    field.style.cssText = 'display:grid;gap:8px;margin:14px 0 18px;text-align:left';
    const title = document.createElement('span');
    title.textContent = 'New host';
    title.style.cssText = 'font-size:12px;font-weight:800;letter-spacing:.04em;color:#cbd5e1';
    const select = document.createElement('select');
    select.id = 'hostTransferSelect';
    select.setAttribute('aria-label','Select a new meeting host');
    select.style.cssText = 'width:100%;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0d1522;color:#f8fafc;font:inherit';
    candidates.forEach(candidate => {
      const option = document.createElement('option');
      option.value = candidate.id;
      option.textContent = candidate.name;
      select.append(option);
    });
    field.append(title,select);
    leaveDialog.querySelector('.leave-actions')?.before(field);
    if (leaveCopy) leaveCopy.textContent = 'Assign another participant as host so the meeting can continue after you leave.';
    leaveOnlyButton.textContent = 'Assign and Leave';
    leaveOnlyButton.dataset.hostTransferStep = '1';
    queueMicrotask(() => select.focus());
  };
  if (leaveOnlyButton && typeof baseLeaveOnlyHandler === 'function') {
    leaveOnlyButton.onclick = async () => {
      const snapshot = engine.snapshot?.() || {};
      if (!snapshot.isHost) { resetHostTransferPrompt(); return baseLeaveOnlyHandler(); }
      const candidates = hostTransferCandidates();
      if (!candidates.length) { resetHostTransferPrompt(); endAllButton?.click(); return; }
      const select = $('hostTransferSelect');
      if (!select) { showHostTransferPrompt(candidates); return; }
      const targetId = String(select.value || '');
      const current = hostTransferCandidates().find(candidate => candidate.id === targetId);
      if (!current) {
        showHostTransferPrompt(hostTransferCandidates());
        if (leaveCopy) leaveCopy.textContent = 'That participant is no longer available. Choose another participant to continue as host.';
        return;
      }
      leaveOnlyButton.disabled = true;
      leaveOnlyButton.textContent = 'Assigning host…';
      try {
        const delivered = await engine.setRole(targetId,'host');
        if (delivered === false) throw new Error('Could not assign the new host. Try again.');
        await sleep(220);
        resetHostTransferPrompt();
        return baseLeaveOnlyHandler();
      } catch (error) {
        leaveOnlyButton.disabled = false;
        leaveOnlyButton.textContent = 'Assign and Leave';
        if (leaveCopy) leaveCopy.textContent = error?.message || 'Could not assign the new host. Try again.';
      }
    };
    leaveDialog?.addEventListener('close',resetHostTransferPrompt);
  }

  window.__DS_MEET_HOST_LEAVE_FLOW = 'zoom-assign-and-leave-v1';
  window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'retired-global-wrapper-single-owner-flow-v1';
})();
