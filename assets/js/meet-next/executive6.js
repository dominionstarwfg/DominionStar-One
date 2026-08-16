(() => {
  'use strict';
  window.__DS_MEET_BUILD='RC12.26-Join-and-Waiting-Room-Recovery';

  const $ = id => document.getElementById(id);
  const engine = window.DominionStarMeetingEngine;
  if (!engine) throw new Error('DominionStarMeetingEngine unavailable');

  const ICONS = {
    mic:'<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>',
    'mic-off':'<svg viewBox="0 0 24 24"><path d="m2 2 20 20M9 9v1a3 3 0 0 0 5.1 2.1M15 9V5a3 3 0 0 0-5.4-1.8M5 10a7 7 0 0 0 11.4 5.4M19 10a7 7 0 0 1-.7 3M12 17v5M8 22h8"/></svg>',
    video:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
    'video-off':'<svg viewBox="0 0 24 24"><path d="m2 2 20 20M10.7 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h11V11.3M16 10l5-3v10l-2.2-1.3"/></svg>',
    settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>',
    shield:'<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    users:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    message:'<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    share:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4M12 12V6M9 9l3-3 3 3"/></svg>',
    smile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>',
    more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
    'phone-off':'<svg viewBox="0 0 24 24"><path d="M10.7 13.3a16 16 0 0 0 3.9 3.9l2.8-2.8a2 2 0 0 1 2-.5 12.7 12.7 0 0 0 2.6.4V20a2 2 0 0 1-2 2C10.1 22 2 13.9 2 4a2 2 0 0 1 2-2h5.7a12.7 12.7 0 0 0 .4 2.6 2 2 0 0 1-.5 2L6.8 9.4"/><path d="m2 2 20 20"/></svg>',
    'chevron-up':'<svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>',
    'chevron-down':'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    x:'<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    send:'<svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/></svg>',
    info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    maximize:'<svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
    sidebar:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 4v16"/></svg>',
    copy:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    command:'<svg viewBox="0 0 24 24"><path d="M9 6V5a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/></svg>',
    activity:'<svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
    captions:'<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M9 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>'
  };

  document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = ICONS[node.dataset.icon] || ''; });

  document.body.classList.add('prejoin-active');

  const verifyDesktopReleaseContract=async()=>{
    if(!window.dominionDesktop?.isDesktop)return true;
    try{
      const [runtime,response]=await Promise.all([
        window.dominionDesktop.getRuntimeInfo?.(),
        fetch('/meet/release-contract.json',{cache:'no-store'})
      ]);
      const contract=response.ok?await response.json():null;
      const matches=Boolean(contract?.releaseId&&runtime?.meetReleaseId===contract.releaseId&&Number(runtime?.bridgeVersion)>=Number(contract?.desktopBridge||0));
      if(matches)return true;
    }catch(_){}
    document.body.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;padding:28px;background:#080d15;color:#f8fafc;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><section style="max-width:560px;padding:34px;border:1px solid #ffffff20;border-radius:18px;background:#111a28;box-shadow:0 28px 90px #000b"><p style="margin:0 0 8px;color:#e8bc49;font-size:12px;font-weight:800;letter-spacing:.14em">DOMINIONSTAR MEET</p><h1 style="margin:0 0 12px;font-size:27px">Desktop update required</h1><p style="margin:0;color:#bac3d0;line-height:1.6">This installed app does not match the certified meeting release. Update DominionStar Meet before joining so screen sharing, camera privacy, and meeting controls remain reliable.</p></section></main>';
    return false;
  };

  const state = {
    phase:'prejoin', stream:null, audio:true, video:true, sharing:false, isHost:false, role:'attendee',
    participants:new Map(), waiting:new Map(), unread:0, activeMenu:null, activeSpeakerId:null, spotlightParticipantId:null,
    speakerClaims:new Map(), speakerElectionTimer:null, activeSpeakerSince:0, securityKnown:false, lastHeartbeatByParticipant:new Map(), pendingAdmissions:new Map(),
    absentHostAlertTimer:null, absentHostAlertSent:false,
    waitingRoomEnabled:false, passcode:'', inviteLink:'', presenceMembers:new Map(), dock:{x:null,y:null}, sharingParticipantId:null, sharePaused:false, client:null, session:null, profile:null, meetingStartedAt:0, meetingTimer:null, speakingMonitor:null, audioAnalysisContext:null, speakingReleaseTimer:null, preferences:{joinMuted:false,joinCameraOff:false,mirror:true,background:'none',brightness:100,touchAppearance:0,quality:'720',cameraId:'',microphoneId:'',speakerId:''}, security:{locked:false,allowShare:true,allowChat:true,allowRename:true,allowUnmute:true,allowVideo:true,muteOnEntry:false}, awaitingAdmission:false, mediaStarted:false, pendingModeration:new Map(), pendingParticipantControls:new Map(), activeUnmuteRequest:null, activeCameraRequest:null, mediaBindings:new Map(), missingMediaSince:new Map(), recoveringRemoteMedia:new Set(), departedParticipants:new Map(), reconcileTimer:null, lastHostSeenAt:0, lastMediaResyncAt:new Map(), lastPeerRepairAt:new Map(), screenRecoveryTimers:new Map()
  };

  const ids = ['prejoin','meeting','prejoinVideo','prejoinFallback','joinForm','joinStatus','displayName','displayNameField','accountIdentity','alwaysJoinMuted','alwaysJoinCameraOff','roomId','meetingPasscode','preMic','preCam','preSettings','roomLabel','connectionState','stageVideo','stageFallback','stageName','speakerNameplate','speakerName','selfTile','selfVideo','selfName','selfMicState','filmstrip','filmstripTrack','dockUp','dockDown','participantsPanel','participantCount','participantBadge','waitingSection','waitingCount','waitingRoom','participantList','participantSearch','chatPanel','chatRecipient','chatMessages','chatForm','chatInput','chatBadge','deviceMenu','toastLayer','reactionLayer','micBtn','micMenuBtn','camBtn','camMenuBtn','participantsBtn','chatBtn','shareBtn','reactionBtn','raiseHandBtn','transcribeBtn','hostToolsBtn','moreBtn','leaveBtn','settingsDialog','cameraSelect','microphoneSelect','speakerSelect','mirrorToggle','qualitySelect','backgroundSelect','brightnessRange','touchAppearanceRange','networkIndicator','speakerMicIndicator','profilePhotoInput','profilePhotoPreview','inviteBtn','inviteDialog','inviteMeetingLink','inviteMeetingId','invitePasscode','copyInviteBtn','copyLinkBtn','closeInviteBtn','muteAllBtn','participantMoreBtn','leaveDialog','leaveCopy','leaveOnlyBtn','endAllBtn','leaveCancelBtn','leaveClose','shareStatusBar','shareStatusText','shareViewerMoreBtn','sharePresenterControls','pauseShareBtn','newShareBtn','stopShareBtn'].reduce((o,k)=>(o[k]=$(k),o),{});

  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = name => String(name || 'Guest').split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
  const ROUTINE_TOAST_PATTERNS=[/saved/i,/applied/i,/enabled$/i,/disabled$/i,/participant dock (hidden|shown)/i,/invitation copied/i,/meeting link copied/i];
  const meetingDigits=value=>String(value||'').replace(/\D/g,'').slice(0,10);
  const formatMeetingId=value=>{const digits=meetingDigits(value);if(digits.length<=3)return digits;if(digits.length<=6)return`${digits.slice(0,3)} ${digits.slice(3)}`;return`${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;};
  const setJoinStatus=(message='',status='progress')=>{
    if(!ids.joinStatus)return;
    ids.joinStatus.textContent=message;
    ids.joinStatus.dataset.state=status;
    ids.joinStatus.hidden=!message;
  };
  const fetchWithTimeout=async(url,options={},timeoutMs=10000)=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{return await fetch(url,{...options,signal:controller.signal});}
    catch(error){if(error?.name==='AbortError')throw new Error('The meeting service took too long to respond. Check your connection and try again.');throw error;}
    finally{clearTimeout(timer);}
  };
  const toast = (message,options={}) => {
    if(!message)return;
    if(!options.force && ROUTINE_TOAST_PATTERNS.some(pattern=>pattern.test(String(message))))return;
    const node=document.createElement('div');
    node.className=`toast${options.type?` toast-${options.type}`:''}`;
    node.textContent=message;
    ids.toastLayer.append(node);
    setTimeout(()=>node.remove(),options.duration||2800);
  };
  const suppressLegacyPreferenceNotice=()=>{
    const phrases=['Saved on this device','Account sync is unavailable','Personal Room database update is installed','preferences saved','settings saved'];
    document.querySelectorAll('.toast,.notification,.notice,[role="status"],[role="alert"],body>div').forEach(node=>{
      const text=String(node.textContent||'');
      if(phrases.some(phrase=>text.includes(phrase)))node.remove();
    });
  };
  new MutationObserver(suppressLegacyPreferenceNotice).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  queueMicrotask(suppressLegacyPreferenceNotice);

  let toneContext=null;
  const SOUND_PATTERNS={
    waiting:[[988,.00,.11],[1319,.16,.16],[1568,.36,.22]],
    admitted:[[523,.00,.09],[659,.10,.09],[784,.20,.18]],
    join:[[659,.00,.09],[880,.11,.15]],
    leave:[[740,.00,.09],[554,.11,.15]],
    mute:[[420,.00,.07],[315,.08,.10]],
    unmute:[[420,.00,.07],[630,.08,.11]],
    cameraOn:[[520,.00,.06],[780,.07,.09]],
    cameraOff:[[700,.00,.06],[470,.07,.10]],
    shareStart:[[587,.00,.08],[784,.10,.08],[988,.20,.16]],
    shareStop:[[988,.00,.08],[740,.10,.08],[554,.20,.16]],
    chat:[[880,.00,.06],[1047,.08,.10]],
    raise:[[784,.00,.08],[988,.10,.12]],
    denied:[[392,.00,.08],[294,.10,.13]]
  };
  const playTone=async(kind='join')=>{try{toneContext=toneContext||new (window.AudioContext||window.webkitAudioContext)();if(toneContext.state==='suspended')await toneContext.resume();const notes=SOUND_PATTERNS[kind]||SOUND_PATTERNS.join;const now=toneContext.currentTime+.01;notes.forEach(([freq,offset,duration])=>{const osc=toneContext.createOscillator(),gain=toneContext.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(.09,now+offset+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+duration);osc.connect(gain).connect(toneContext.destination);osc.start(now+offset);osc.stop(now+offset+duration+.02);});}catch(_){}};
  const canonicalSelfId = () => engine.snapshot?.().participantId || 'self';
  const uiSpeakerId = participantId => participantId === canonicalSelfId() ? 'self' : participantId;

  // RC10-S3: Stable media binding. Reassigning an identical srcObject can restart
  // Chromium decoding and appears to users as a periodic black video blink.
  const bindStableVideo = (video, stream, {muted=null, mirror=null, play=true}={}) => {
    if(!video) return false;
    const next=stream||null;
    const changed=video.srcObject!==next;
    if(changed) video.srcObject=next;
    if(muted!==null) video.muted=Boolean(muted);
    video.autoplay=true;
    video.playsInline=true;
    if(mirror!==null) video.style.transform=mirror?'scaleX(-1)':'';
    if(play && next && video.paused){
      const attempt=()=>video.play().catch(()=>{});
      attempt();
      if(changed) video.addEventListener('loadedmetadata',attempt,{once:true});
    }
    return changed;
  };

  function setLocalMainSpeaker() {
    if (state.sharing) return;
    state.activeSpeakerId='self';
    bindStableVideo(ids.stageVideo,state.stream,{muted:true,mirror:ids.mirrorToggle.checked,play:true});
    ids.stageVideo.style.filter='';
    const localLive=Boolean(state.video && hasLiveVideo(state.stream));
    ids.stageVideo.hidden=!localLive;
    ids.stageFallback.hidden=localLive;
    if(localLive) ids.stageVideo.play().catch(()=>{});
    else showStageFallback({...state.profile,avatarUrl:state.profile?.avatarUrl||'',displayName:ids.selfName.textContent||ids.displayName.value||'You'});
    ids.speakerNameplate.hidden=false;
    ids.speakerName.textContent=ids.selfName.textContent||ids.displayName.value||'You';
    ids.meeting.classList.remove('active-speaker-remote');
    ids.stageVideo.classList.toggle('active-speaker-ring',Boolean(state.speakerClaims.get(canonicalSelfId())?.active));
  }

  function applyElectedSpeaker(canonicalId) {
    const uiId=uiSpeakerId(canonicalId);
    if(!canonicalId || state.sharing)return;
    if(uiId==='self') setLocalMainSpeaker();
    else setMainSpeaker(uiId);
  }

  function electActiveSpeaker(force=false,preferredId='') {
    if(state.sharing)return;
    if(state.spotlightParticipantId){
      const spotlightUi=uiSpeakerId(state.spotlightParticipantId);
      if(spotlightUi==='self'||state.participants.has(spotlightUi))applyElectedSpeaker(state.spotlightParticipantId);
      return;
    }
    const now=Date.now();
    for(const [id,claim] of state.speakerClaims){
      if(!claim.active || now-claim.updatedAt>1800) state.speakerClaims.delete(id);
    }
    const candidates=[...state.speakerClaims.entries()].sort((a,b)=>
      (b[1].level-a[1].level) || (b[1].updatedAt-a[1].updatedAt) || String(a[0]).localeCompare(String(b[0]))
    );
    const winner=(preferredId&&state.speakerClaims.get(preferredId)?.active)
      ? [preferredId,state.speakerClaims.get(preferredId)]
      : candidates[0];
    if(!winner){
      ids.stageVideo.classList.remove('active-speaker-ring');
      ids.selfTile?.classList.remove('speaking');
      ids.filmstripTrack.querySelectorAll('.speaking').forEach(node=>node.classList.remove('speaking'));
      return;
    }
    const currentCanonical=state.activeSpeakerId==='self'?canonicalSelfId():state.activeSpeakerId;
    const current=state.speakerClaims.get(currentCanonical);
    const shouldSwitch=force || !current || currentCanonical===winner[0] ||
      now-state.activeSpeakerSince>850 && winner[1].level>Math.max(10,(current?.level||0)*1.12);
    if(shouldSwitch && currentCanonical!==winner[0]){
      state.activeSpeakerSince=now;
      applyElectedSpeaker(winner[0]);
    }else if(currentCanonical===winner[0]){
      const tile=ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(uiSpeakerId(winner[0]))}"]`);
      tile?.classList.add('speaking');
    }
  }

  const setSpeakingVisual = (participantId, active, level=0) => {
    const canonicalId=participantId==='self'?canonicalSelfId():participantId;
    const uiId=uiSpeakerId(canonicalId);
    const normalized=Math.max(0,Number(level||0));
    const person=state.participants.get(uiId);
    // A received voice-activity sample is direct evidence that a remote
    // microphone is live. Do not let an older presence/media snapshot suppress
    // its green meter. Local mute intent remains authoritative for self.
    if(uiId!=='self'&&active&&person)person.audio=true;
    const allowed=uiId==='self'?Boolean(state.audio):Boolean(active||person?.audio!==false);
    active=Boolean(active)&&allowed;
    const wasActive=Boolean(state.speakerClaims.get(canonicalId)?.active);
    state.speakerClaims.set(canonicalId,{active,level:active?normalized:0,updatedAt:Date.now()});
    const tile=ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(uiId)}"]`);
    tile?.classList.toggle('speaking',Boolean(active));
    tile?.style.setProperty('--speaker-level',String(Math.min(1,normalized/45)));
    const tileMic=tile?.querySelector('.tile-mic');
    tileMic?.classList.toggle('is-speaking',Boolean(active)&&allowed);
    if(uiId==='self'){
      ids.micBtn?.classList.toggle('is-speaking',Boolean(active)&&state.audio);
      ids.micBtn?.style.setProperty('--local-audio-level',String(Math.min(1,normalized/45)));
      ids.selfTile?.classList.toggle('speaking',Boolean(active));
      ids.selfMicState?.classList.toggle('is-speaking',Boolean(active)&&state.audio);
    }
    if(person){person.speaking=Boolean(active);person.speakingLevel=normalized;}
    const selected=state.activeSpeakerId===uiId||(uiId==='self'&&state.activeSpeakerId==='self');
    if(selected)ids.stageVideo.classList.toggle('active-speaker-ring',Boolean(active));
    const isSharedStageOwner=Boolean(state.sharing&&state.sharingParticipantId&&(state.sharingParticipantId===uiId||(state.sharingParticipantId==='self'&&uiId==='self')));
    if(isSharedStageOwner)document.getElementById('stage')?.classList.toggle('shared-stage-speaking',Boolean(active));
    // Restore the proven S35 behavior: every admitted browser receives the
    // same speaking samples and runs the same deterministic election.
    if(active) electActiveSpeaker(!wasActive,!wasActive?canonicalId:'');
    else {
      clearTimeout(state.speakerElectionTimer);
      state.speakerElectionTimer=setTimeout(()=>electActiveSpeaker(true),120);
    }
    updateParticipantSpeakingRow(uiId,active,normalized);
  };

  const startLocalSpeakingMonitor = stream => {
    state.speakingMonitor?.stop?.();
    if(!stream?.getAudioTracks?.().length)return;
    try{
      const context=state.audioAnalysisContext||(state.audioAnalysisContext=new (window.AudioContext||window.webkitAudioContext)());
      const source=context.createMediaStreamSource(stream);
      const analyser=context.createAnalyser();
      analyser.fftSize=512;analyser.smoothingTimeConstant=.72;
      source.connect(analyser);
      const data=new Uint8Array(analyser.fftSize);
      let raf=0,active=false,quiet=0,lastBroadcast=0,noiseFloor=.012,smoothed=0;
      const loop=()=>{
        analyser.getByteTimeDomainData(data);
        let sum=0;for(let i=0;i<data.length;i++){const sample=(data[i]-128)/128;sum+=sample*sample;}
        const rms=Math.sqrt(sum/data.length);
        if(!active)noiseFloor=noiseFloor*.985+Math.min(rms,.08)*.015;
        const signal=Math.max(0,rms-noiseFloor*1.18);
        const rawLevel=Math.min(100,signal*900);
        smoothed=smoothed*.68+rawLevel*.32;
        const level=smoothed;
        const next=state.audio && (level>5.5 || (active && level>2.8));
        if(next)quiet=0;else quiet++;
        const stable=next || (active && quiet<10);
        const now=performance.now();
        if(stable!==active){
          active=stable;
          setSpeakingVisual('self',active,level);
          engine.setSpeaking?.(active,level);
          lastBroadcast=now;
        }else if(now-lastBroadcast>180){
          setSpeakingVisual('self',active,active?level:0);
          engine.setSpeaking?.(active,active?level:0);
          lastBroadcast=now;
        }
        raf=requestAnimationFrame(loop);
      };
      context.resume?.().catch(()=>{});
      loop();
      state.speakingMonitor={context,stream,resume:()=>context.resume?.().catch(()=>{}),stop:()=>{cancelAnimationFrame(raf);try{source.disconnect();analyser.disconnect();}catch(_){}setSpeakingVisual('self',false,0);engine.setSpeaking?.(false,0);}};
    }catch(error){console.warn('Local active speaker detection unavailable',error);}
  };

  const showJoinRequest=(payload)=>{
    if(!state.isHost && state.role!=='cohost') return;
    ids.toastLayer.querySelector(`[data-join-request="${CSS.escape(payload.from)}"]`)?.remove();
    const node=document.createElement('div');
    node.className='join-request-toast waiting-room-banner';
    node.dataset.joinRequest=payload.from;
    node.innerHTML=`<div class="waiting-room-copy"><span class="waiting-room-avatar">${escapeHtml(initials(payload.displayName||'Guest'))}</span><span><strong>${escapeHtml(payload.displayName||'Guest')} is waiting to join</strong><small>Waiting Room · Host action required</small></span></div><div class="join-request-actions"><button class="admit" data-toast-admit="${escapeHtml(payload.from)}">Admit</button><button class="deny" data-toast-deny="${escapeHtml(payload.from)}">Decline</button></div>`;
    ids.toastLayer.append(node);
    setTimeout(()=>node.isConnected&&node.remove(),30000);
  };

  const preferenceStorageKey = () => `ds_meet_preferences:${state.session?.user?.id || 'anonymous'}`;
  function readLocalPreferences(){
    try {
      const stored=JSON.parse(localStorage.getItem(preferenceStorageKey())||'{}');
      state.preferences={...state.preferences,...stored};
      return stored;
    } catch(_) {}
    return {};
  }
  function writeLocalPreferences(){
    try {
      const payload={
        joinMuted:Boolean(ids.alwaysJoinMuted?.checked),
        joinCameraOff:Boolean(ids.alwaysJoinCameraOff?.checked),
        mirror:Boolean(ids.mirrorToggle?.checked),
        background:ids.backgroundSelect?.value||'none',
        brightness:Number(ids.brightnessRange?.value||100),
        touchAppearance:Number(ids.touchAppearanceRange?.value||state.preferences.touchAppearance||0),
        quality:String(ids.qualitySelect?.value||state.preferences.quality||'720'),
        cameraId:String(ids.cameraSelect?.value||state.preferences.cameraId||''),
        microphoneId:String(ids.microphoneSelect?.value||state.preferences.microphoneId||''),
        speakerId:String(ids.speakerSelect?.value||state.preferences.speakerId||''),
        updatedAt:new Date().toISOString()
      };
      state.preferences={...state.preferences,...payload};
      localStorage.setItem(preferenceStorageKey(),JSON.stringify(payload));
    } catch(_) {}
  }
  function applyStoredPreferenceControls(){
    ids.alwaysJoinMuted.checked=Boolean(state.preferences.joinMuted);
    ids.alwaysJoinCameraOff.checked=Boolean(state.preferences.joinCameraOff);
    state.audio=!state.preferences.joinMuted;
    state.video=!state.preferences.joinCameraOff;
    ids.mirrorToggle.checked=state.preferences.mirror!==false;
    ids.backgroundSelect.value=state.preferences.background||'none';
    ids.brightnessRange.value=String(state.preferences.brightness||100);
    if(ids.touchAppearanceRange) ids.touchAppearanceRange.value=String(state.preferences.touchAppearance||0);
    if(ids.qualitySelect) ids.qualitySelect.value=String(state.preferences.quality||'720');
  }
  function enforcePersistentJoinMediaPreferences(){
    // These account-level choices are authoritative at the publication boundary.
    // Preview/device acquisition may create enabled tracks, so enforce the saved
    // intent again immediately before the stream is exposed to the meeting.
    if(Boolean(ids.alwaysJoinMuted?.checked)) state.audio=false;
    if(Boolean(ids.alwaysJoinCameraOff?.checked)) state.video=false;
    state.stream?.getAudioTracks?.().forEach(track=>{track.enabled=Boolean(state.audio);});
    state.stream?.getVideoTracks?.().forEach(track=>{track.enabled=Boolean(state.video);});
  }
  function setWaitingGate(active,message='Waiting for the host to admit you'){
    state.awaitingAdmission=Boolean(active);
    ids.meeting.classList.toggle('waiting-room-active',state.awaitingAdmission);
    document.body.classList.toggle('waiting-room-active',state.awaitingAdmission);
    let gate=document.getElementById('waitingRoomGate');
    if(!gate){
      gate=document.createElement('section');
      gate.id='waitingRoomGate';
      gate.className='waiting-room-gate';
      gate.setAttribute('role','status');
      gate.setAttribute('aria-live','polite');
      gate.innerHTML=`<div class="waiting-room-brand-stage" aria-label="DominionStar waiting room">
        <img class="waiting-room-logo" src="/assets/logo.jpeg" alt="DominionStar Leadership">
        <p class="waiting-room-eyebrow">DOMINIONSTAR LEADERSHIP</p>
        <h1>You are in the Waiting Room</h1>
        <p class="waiting-room-message"></p>
        <div class="waiting-room-preview" aria-label="Camera and microphone preview">
          <video class="waiting-room-preview-video" autoplay muted playsinline></video>
          <div class="waiting-room-preview-fallback"><img src="/assets/logo.jpeg" alt=""></div>
          <div class="waiting-room-preview-controls">
            <button type="button" class="waiting-preview-mic" aria-label="Toggle microphone"></button>
            <button type="button" class="waiting-preview-cam" aria-label="Toggle camera"></button>
            <button type="button" class="waiting-preview-settings" aria-label="Audio and video settings">${ICONS.settings}</button>
          </div>
        </div>
        <label class="waiting-room-remember"><input type="checkbox" class="waiting-preview-remember"><span>Remember my camera and microphone choices</span></label>
        <div class="waiting-room-pulse" aria-hidden="true"><i></i><i></i><i></i></div>
        <small>You will join automatically when the host admits you.</small>
        <button type="button" class="waiting-room-leave">Leave Meeting</button>
      </div>`;
      document.body.append(gate);
      gate.querySelector('.waiting-room-leave').onclick=async()=>{try{await engine.leave({silent:true});}catch(_){} location.href='/meet-home/';};
      const previewVideo=gate.querySelector('.waiting-room-preview-video');
      const previewFallback=gate.querySelector('.waiting-room-preview-fallback');
      const previewMic=gate.querySelector('.waiting-preview-mic');
      const previewCam=gate.querySelector('.waiting-preview-cam');
      const previewRemember=gate.querySelector('.waiting-preview-remember');
      const syncPreview=()=>{
        previewVideo.srcObject=state.stream||null;
        previewVideo.hidden=!(state.video&&hasLiveVideo(state.stream));
        previewFallback.hidden=!previewVideo.hidden;
        previewMic.innerHTML=ICONS[state.audio?'mic':'mic-off'];
        previewCam.innerHTML=ICONS[state.video?'video':'video-off'];
        previewMic.classList.toggle('is-off',!state.audio);
        previewCam.classList.toggle('is-off',!state.video);
        previewVideo.style.transform=ids.mirrorToggle.checked?'scaleX(-1)':'';
        if(!previewVideo.hidden)previewVideo.play().catch(()=>{});
      };
      previewMic.onclick=async()=>{state.audio=!state.audio;state.stream?.getAudioTracks?.().forEach(track=>track.enabled=state.audio);syncPreview();if(previewRemember.checked){ids.alwaysJoinMuted.checked=!state.audio;await saveAccountPreferences();}};
      previewCam.onclick=async()=>{
        const target=!state.video;
        state.video=target;
        try{
          await engine.toggleVideo(target);
        }catch(error){state.video=false;toast(error.message||'Camera unavailable');}
        syncPreview();
        if(previewRemember.checked){ids.alwaysJoinCameraOff.checked=!state.video;await saveAccountPreferences();}
      };
      gate.querySelector('.waiting-preview-settings').onclick=()=>ids.settingsDialog.showModal();
      gate._syncPreview=syncPreview;
    }
    gate.querySelector('.waiting-room-message').textContent=message;
    gate._syncPreview?.();
    gate.hidden=!state.awaitingAdmission;
    ids.connectionState.hidden=true;
    ids.meeting.setAttribute('aria-busy',String(state.awaitingAdmission));
    [ids.micBtn,ids.camBtn,ids.shareBtn,ids.chatBtn,ids.reactionBtn,ids.moreBtn,ids.participantsBtn,ids.hostToolsBtn].forEach(button=>{if(button)button.disabled=state.awaitingAdmission;});
    ids.leaveBtn.disabled=false;
  }

  async function ensureMeetingMedia(){
    if(state.mediaStarted)return state.stream;
    enforcePersistentJoinMediaPreferences();
    const media=await engine.startMedia({existingStream:state.stream,video:state.video,audio:state.audio});
    state.stream=media||state.stream;
    enforcePersistentJoinMediaPreferences();
    if(!state.audio) await engine.toggleAudio?.(false);
    if(!state.video) await engine.toggleVideo?.(false);
    state.mediaStarted=true;
    updateLocalStage();
    startLocalSpeakingMonitor(state.stream);
    applyEffects();
    applyVideoQuality().catch(()=>{});
    return state.stream;
  }

  function stopPreviewMediaForWaiting(){
    // Keep the local pre-join stream available for the isolated waiting-room preview.
    // It is not published to the meeting until admission and engine.ready().
    state.mediaStarted=false;
    if(ids.prejoinVideo)ids.prejoinVideo.srcObject=state.stream||null;
    document.getElementById('waitingRoomGate')?._syncPreview?.();
  }

  function securityPayload(){return {waitingRoom:state.waitingRoomEnabled,...state.security};}
  function applySecuritySettings(settings={}){
    if('waitingRoom' in settings) state.waitingRoomEnabled=Boolean(settings.waitingRoom);
    ['locked','allowShare','allowChat','allowRename','allowUnmute','allowVideo','muteOnEntry'].forEach(key=>{if(key in settings)state.security[key]=Boolean(settings[key]);});
    const privileged=state.isHost||state.role==='cohost';
    if(ids.shareBtn) ids.shareBtn.classList.toggle('permission-disabled',!privileged&&!state.security.allowShare);
    if(ids.chatBtn) ids.chatBtn.classList.toggle('permission-disabled',!privileged&&!state.security.allowChat);
    renderParticipants();
  }

  async function loadAccountContext() {
    try {
      state.client=await window.DSAuth?.init?.();
      state.session=state.client ? (await state.client.auth.getSession()).data.session : null;
      const params=new URLSearchParams(location.search);
      const externalInvitation=Boolean(params.get('room'))&&params.get('host')!=='1'&&params.get('mode')!=='host';
      if (!state.session?.user || externalInvitation || params.get('guest')==='1') {
        if(params.get('desktop')==='1' && params.get('guest')!=='1') { location.replace('/meet-login/?desktop=1&mode=public'); return false; }
        // An invitation link is an external guest entry point. Never attach the
        // account that happens to be signed into this browser to the visitor.
        // This prevents a shared phone/browser from presenting a prior member
        // as the current participant.
        if(externalInvitation||params.get('guest')==='1'){
          state.session=null;
          state.profile=null;
          ids.accountIdentity.hidden=true;
          ids.accountIdentity.innerHTML='';
        }
        // Never inherit another participant's browser-autofilled identity.
        // A guest must explicitly enter their own name for this join.
        ids.displayName.value='';
        ids.displayName.readOnly=false;
        ids.displayNameField.hidden=false;
        readLocalPreferences(); applyStoredPreferenceControls(); return true;
      }
      const {data:profile}=await state.client.from('member_profiles').select('full_name,preferred_name,email,avatar_path,rank,agent_code').eq('id',state.session.user.id).maybeSingle();
      let avatarUrl='';
      if(profile?.avatar_path){const signed=await state.client.storage.from('member-avatars').createSignedUrl(profile.avatar_path,3600);avatarUrl=signed?.data?.signedUrl||'';}
      const accountAvatarKey=`ds_meet_avatar_url:${state.session.user.id}`;
      if(!avatarUrl){avatarUrl=state.session.user.user_metadata?.avatar_url||state.session.user.user_metadata?.picture||localStorage.getItem(accountAvatarKey)||'';}
      const displayName=profile?.preferred_name||profile?.full_name||state.session.user.user_metadata?.full_name||state.session.user.email?.split('@')[0]||'DominionStar Member';
      state.profile={displayName,email:profile?.email||state.session.user.email||'',avatarUrl,contractLevel:profile?.rank||state.session.user.user_metadata?.title||''};
      ids.displayName.value=displayName;
      ids.displayName.readOnly=true;
      ids.displayNameField.hidden=true;
      ids.accountIdentity.hidden=false;
      ids.accountIdentity.innerHTML=`${avatarUrl?`<img src="${escapeHtml(avatarUrl)}" alt="">`:`<span class="account-avatar-fallback">${escapeHtml(initials(displayName))}</span>`}<span><strong>${escapeHtml(displayName)}</strong><small>${state.profile.contractLevel?`${escapeHtml(state.profile.contractLevel)} · `:''}${escapeHtml(state.profile.email)} · Signed in</small></span>`;
      const localPreferences=readLocalPreferences();
      try {
        const {data:prefs}=await state.client.from('meet_user_preferences').select('*').eq('user_id',state.session.user.id).maybeSingle();
        const remoteUpdatedAt=Date.parse(prefs?.updated_at||'')||0;
        const localUpdatedAt=Date.parse(localPreferences?.updatedAt||'')||0;
        if(prefs && remoteUpdatedAt>=localUpdatedAt) state.preferences={...state.preferences,joinMuted:Boolean(prefs.join_muted),joinCameraOff:Boolean(prefs.join_camera_off),mirror:prefs.mirror_video!==false,background:prefs.background_mode||'none',brightness:Number(prefs.brightness||100),touchAppearance:Number(prefs.touch_appearance||0),quality:String(prefs.video_quality||state.preferences.quality||'720'),cameraId:prefs.camera_id||state.preferences.cameraId||'',microphoneId:prefs.microphone_id||state.preferences.microphoneId||'',speakerId:prefs.speaker_id||state.preferences.speakerId||'',updatedAt:prefs.updated_at||''};
      } catch(_) {}
      const accountMedia=state.session.user.user_metadata?.dominionstar_settings?.meetingMedia;
      if(accountMedia) state.preferences={...state.preferences,...accountMedia};
      applyStoredPreferenceControls();
      ids.preMic.classList.toggle('active',state.audio);ids.preMic.querySelector('[data-icon]').innerHTML=ICONS[state.audio?'mic':'mic-off'];
      ids.preCam.classList.toggle('active',state.video);ids.preCam.querySelector('[data-icon]').innerHTML=ICONS[state.video?'video':'video-off'];
      return true;
    } catch(error) {
      // Network/profile failure must never fall through to an unrequested
      // camera start. Preserve the device's last explicit privacy choices.
      console.warn('Meet account context unavailable',error);
      readLocalPreferences();
      applyStoredPreferenceControls();
      return true;
    }
  }
  async function saveAccountPreferences() {
    writeLocalPreferences();
    if(!state.client||!state.session?.user)return;
    const payload={user_id:state.session.user.id,join_muted:ids.alwaysJoinMuted.checked,join_camera_off:ids.alwaysJoinCameraOff.checked,mirror_video:ids.mirrorToggle.checked,background_mode:ids.backgroundSelect.value,brightness:Number(ids.brightnessRange.value),touch_appearance:Number(ids.touchAppearanceRange?.value||state.preferences.touchAppearance||0),video_quality:String(ids.qualitySelect?.value||'720'),camera_id:String(ids.cameraSelect?.value||''),microphone_id:String(ids.microphoneSelect?.value||''),speaker_id:String(ids.speakerSelect?.value||''),updated_at:new Date().toISOString()};
    try{const result=await state.client.from('meet_user_preferences').upsert(payload,{onConflict:'user_id'});if(result?.error)throw result.error;}catch(error){console.warn('Meet preferences remote sync unavailable',error);}
  }

  function setButtonState(button, enabled, onIcon, offIcon, onLabel, offLabel) {
    const icon = button.querySelector('.tool-icon');
    const label = button.querySelector('.tool-label');
    if (icon) icon.innerHTML = ICONS[enabled ? onIcon : offIcon];
    if (label) label.textContent = enabled ? onLabel : offLabel;
    button.classList.toggle('is-off', !enabled);
  }

  function formatMeetingDuration(ms) {
    const total=Math.max(0,Math.floor(ms/1000));
    const hours=Math.floor(total/3600);
    const minutes=Math.floor((total%3600)/60);
    const seconds=total%60;
    return hours>0 ? `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}` : `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }

  function startMeetingTimer() {
    clearInterval(state.meetingTimer);
    state.meetingStartedAt=Date.now();
    const tick=()=>{ if(ids.roomLabel) ids.roomLabel.textContent=formatMeetingDuration(Date.now()-state.meetingStartedAt); };
    tick();
    state.meetingTimer=setInterval(tick,1000);
  }

  function stopMeetingTimer() {
    clearInterval(state.meetingTimer);
    state.meetingTimer=null;
  }

  function closeMenus() {
    ids.deviceMenu.hidden = true;
    ids.deviceMenu.removeAttribute('data-anchor-id');
    ids.participantList?.querySelectorAll('[data-participant][aria-expanded="true"]').forEach(button=>button.setAttribute('aria-expanded','false'));
    [ids.moreBtn,ids.hostToolsBtn,ids.participantMoreBtn].forEach(button=>button?.setAttribute('aria-expanded','false'));
    state.activeMenu = null;
  }

  function setStream(stream) {
    state.stream = stream;
    bindStableVideo(ids.prejoinVideo,stream,{muted:true,mirror:true,play:true});
    bindStableVideo(ids.selfVideo,stream,{muted:true,mirror:true,play:true});
    ids.prejoinFallback.hidden = Boolean(state.video && hasLiveVideo(stream));
    updateLocalStage();
  }

  function updateLocalStage() {
    const hasRemote = state.participants.size > 0;
    if (state.sharing) return;
    // Camera changes must immediately repaint the local main stage even when
    // remote participants are present. Previously this branch returned without
    // replacing the hidden/black video surface with the profile fallback.
    if(state.activeSpeakerId==='self'){
      setLocalMainSpeaker();
      ids.selfTile.hidden=false;
      ids.filmstrip.hidden=false;
      return;
    }
    if (!hasRemote) {
      bindStableVideo(ids.stageVideo,state.stream,{muted:true,mirror:ids.mirrorToggle.checked,play:true});
      const localLive=Boolean(state.video && hasLiveVideo(state.stream));
      ids.stageVideo.hidden=!localLive;
      if(localLive){ids.stageFallback.hidden=true;ids.stageName.textContent=ids.selfName.textContent||'You';}
      else showStageFallback({...state.profile,avatarUrl:state.profile?.avatarUrl||'',displayName:ids.selfName.textContent||'You'});
      ids.selfTile.hidden = true;
      ids.filmstrip.hidden = true;
      ids.speakerNameplate.hidden = false;
      ids.speakerName.textContent = `${ids.selfName.textContent || 'You'} (You)`;
    } else {
      ids.selfTile.hidden = false;
      ids.filmstrip.hidden = false;
    }
  }

  async function ensurePreview() {
    try {
      const stream = (!state.video&&!state.audio)
        ? new MediaStream()
        : await navigator.mediaDevices.getUserMedia({video:state.video?{width:{ideal:1280},height:{ideal:720}}:false,audio:state.audio});
      setStream(stream);
      await loadDevices();
    } catch (error) {
      toast(error.message || 'Camera and microphone unavailable');
    }
  }

  async function loadDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const fill = (select, kind) => {
      const current = select.value;
      select.innerHTML = '';
      devices.filter(d => d.kind === kind).forEach((device,index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `${kind} ${index + 1}`;
        select.append(option);
      });
      if (current) select.value = current;
    };
    fill(ids.cameraSelect,'videoinput');
    fill(ids.microphoneSelect,'audioinput');
    fill(ids.speakerSelect,'audiooutput');
  }

  async function replaceMedia(kind, deviceId) {
    if (!deviceId) return;
    const constraints = kind === 'video' ? {video:{deviceId:{exact:deviceId}},audio:false} : {audio:{deviceId:{exact:deviceId}},video:false};
    const fresh = await navigator.mediaDevices.getUserMedia(constraints);
    const old = state.stream || new MediaStream();
    const keep = old.getTracks().filter(track => track.kind !== kind);
    const track = fresh.getTracks()[0];
    const merged = new MediaStream([...keep, track]);
    setStream(merged);
    await engine.startMedia({existingStream:merged,video:state.video,audio:state.audio});
    old.getTracks().filter(t=>t.kind===kind).forEach(t=>t.stop());
  }

  function roleRank(p) {
    if (p.role === 'host' || p.isHost) return 0;
    if (p.role === 'cohost') return 1;
    if (p.audio !== false) return 2;
    return 3;
  }

  function sortedParticipants() {
    return [...state.participants.entries()].sort((a,b) => {
      const aRaised=Boolean(a[1].handRaised),bRaised=Boolean(b[1].handRaised);
      if(aRaised!==bRaised)return aRaised?-1:1;
      if(aRaised&&bRaised){const queue=Number(a[1].handRaisedAt||0)-Number(b[1].handRaisedAt||0);if(queue)return queue;}
      const rank = roleRank(a[1]) - roleRank(b[1]);
      if (rank) return rank;
      if ((a[1].audio !== false) && (b[1].audio !== false)) {
        if (a[0] === state.activeSpeakerId) return -1;
        if (b[0] === state.activeSpeakerId) return 1;
      }
      return String(a[1].displayName || '').localeCompare(String(b[1].displayName || ''));
    });
  }

  function raisedHandQueue(){
    const queue=[...state.participants.entries()].filter(([,p])=>p.handRaised).map(([id,p])=>({id,at:Number(p.handRaisedAt||0),name:p.displayName||'Participant'}));
    if(state.handRaised)queue.push({id:'self',at:Number(state.handRaisedAt||0),name:ids.selfName?.textContent||'You'});
    return queue.sort((a,b)=>(a.at-b.at)||String(a.id).localeCompare(String(b.id)));
  }

  function raisedHandPosition(id){const index=raisedHandQueue().findIndex(item=>item.id===id);return index<0?0:index+1;}

  function reorderRaisedHandTiles(){
    if(!ids.filmstripTrack)return;
    const queue=raisedHandQueue();
    queue.forEach((item,index)=>{const badge=ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(item.id)}"] .raised-hand-badge`);if(badge){badge.textContent=`✋ ${index+1}`;badge.title=`Raised hand · Queue ${index+1}`;}});
    for(let index=queue.length-1;index>=0;index--){
      const tile=ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(queue[index].id)}"]`);
      if(tile)ids.filmstripTrack.prepend(tile);
    }
  }

  function participantRow(id, p, self=false) {
    const role = self ? (state.isHost ? 'host' : state.role) : (p.role || (p.isHost ? 'host' : 'attendee'));
    const roleSuffix = role === 'host' ? ' (Host)' : role === 'cohost' ? ' (Co-host)' : self ? ' (You)' : '';
    const name = `${self ? (ids.selfName.textContent || 'You') : (p.displayName || 'Guest')}${roleSuffix}`;
    const audio = self ? state.audio : p.audio !== false;
    const video = self ? state.video : p.video !== false;
    const speaking=self ? Boolean(state.speakerClaims.get(canonicalSelfId())?.active) : Boolean(p.speaking);
    const level=self ? Number(state.speakerClaims.get(canonicalSelfId())?.level||0) : Number(p.speakingLevel||0);
    const connected=self||state.presenceMembers.has(id);
    const micPending=state.pendingParticipantControls.has(`${id}:audio`), videoPending=state.pendingParticipantControls.has(`${id}:video`);
    const handRaised=self?Boolean(state.handRaised):Boolean(p.handRaised),queuePosition=handRaised?raisedHandPosition(id):0;
    return `<div class="participant-row ${speaking?'is-speaking':''} ${connected?'':'is-offline'} ${handRaised?'has-raised-hand':''}" data-row="${escapeHtml(id)}" style="--speaker-level:${Math.min(1,level/45)}"><span class="participant-avatar">${(!self&&p.avatarUrl)?`<img src="${escapeHtml(p.avatarUrl)}" alt="">`:(self&&state.profile?.avatarUrl)?`<img src="${escapeHtml(state.profile.avatarUrl)}" alt="">`:escapeHtml(initials(name))}</span><span class="participant-name">${escapeHtml(name)}${handRaised?`<b class="participant-raised-hand" title="Raised hand queue position ${queuePosition}">✋ #${queuePosition}</b>`:''}<small>${handRaised?`Hand raised · Queue ${queuePosition}`:speaking?'Speaking':connected?'Connected':'Reconnecting…'}</small></span><span class="participant-actions"><button class="participant-mic-action media-state ${audio?'':'is-off'} ${speaking?'is-speaking':''} ${micPending?'is-pending':''}" data-quick-mic="${escapeHtml(id)}" data-self="${self?'1':'0'}" ${(connected&&!micPending)?'':'disabled'} aria-busy="${micPending}" title="${micPending?'Updating microphone…':speaking?'Speaking':audio?'Mute':'Ask to unmute'}">${ICONS[audio?'mic':'mic-off']}</button><button class="participant-video-action media-state ${video?'':'is-off'} ${videoPending?'is-pending':''}" data-quick-video="${escapeHtml(id)}" data-self="${self?'1':'0'}" ${(connected&&!videoPending)?'':'disabled'} aria-busy="${videoPending}" title="${videoPending?'Updating video…':video?'Stop video':'Ask to start video'}">${ICONS[video?'video':'video-off']}</button><button data-participant="${escapeHtml(id)}" data-self="${self?'1':'0'}" ${connected?'':'disabled'} aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${escapeHtml(name)}">${ICONS.more}</button></span></div>`;
  }

  function syncRaisedHandVisual(participantId,raised){
    const uiId=participantId===canonicalSelfId()?'self':participantId;
    const tile=ids.filmstripTrack?.querySelector(`[data-tile="${CSS.escape(uiId)}"]`);
    tile?.classList.toggle('has-raised-hand',Boolean(raised));
    let badge=tile?.querySelector('.raised-hand-badge');
    if(raised&&tile&&!badge){badge=document.createElement('span');badge.className='raised-hand-badge';tile.append(badge);}
    if(raised&&badge){const position=raisedHandPosition(uiId);badge.textContent=`✋ ${position}`;badge.title=`Raised hand · Queue ${position}`;}
    if(!raised)badge?.remove();
    if(uiId==='self'&&ids.raiseHandBtn){ids.raiseHandBtn.classList.toggle('active',Boolean(raised));ids.raiseHandBtn.setAttribute('aria-pressed',String(Boolean(raised)));ids.raiseHandBtn.querySelector('.tool-label').textContent=raised?'Lower Hand':'Raise Hand';}
    reorderRaisedHandTiles();
  }

  async function toggleRaisedHand(){
    state.handRaised=!state.handRaised;
    state.handRaisedAt=state.handRaised?Date.now():0;
    syncRaisedHandVisual(canonicalSelfId(),state.handRaised);
    renderParticipants();
    playTone('raise');
    await engine.reaction?.(state.handRaised?'raise-hand':'lower-hand');
  }

  function updateParticipantSpeakingRow(id,active,level=0){
    const row=ids.participantList?.querySelector(`[data-row="${CSS.escape(id)}"]`);
    if(!row)return;
    const person=id==='self'?null:state.participants.get(id);
    const connected=id==='self'||state.presenceMembers.has(id);
    row.classList.toggle('is-speaking',Boolean(active));
    row.style.setProperty('--speaker-level',String(Math.min(1,Math.max(0,Number(level)||0)/45)));
    const status=row.querySelector('.participant-name small');
    if(status)status.textContent=active?'Speaking':connected?'Connected':'Reconnecting…';
    const mic=row.querySelector('.participant-mic-action');
    if(mic){
      const audio=id==='self'?state.audio:person?.audio!==false;
      mic.classList.toggle('is-speaking',Boolean(active)&&audio);
      if(!mic.classList.contains('is-pending'))mic.title=active?'Speaking':audio?'Mute':'Ask to unmute';
    }
  }

  function beginParticipantControl(participantId,kind){
    const key=`${participantId}:${kind}`;
    clearParticipantControl(participantId,kind);
    const timer=setTimeout(()=>{state.pendingParticipantControls.delete(key);renderParticipants();toast('The participant did not confirm the change. Try again.',{type:'info',force:true});},5000);
    state.pendingParticipantControls.set(key,timer);
  }

  function clearParticipantControl(participantId,kind){
    const key=`${participantId}:${kind}`,timer=state.pendingParticipantControls.get(key);
    if(timer)clearTimeout(timer);
    state.pendingParticipantControls.delete(key);
  }

  function renderParticipants() {
    const total = state.participants.size + 1;
    ids.participantCount.textContent = total;
    ids.participantBadge.textContent = total;
    const query = ids.participantSearch.value.trim().toLowerCase();
    const entries = [...state.participants.entries()].map(([id,p])=>({id,p,self:false}));
    entries.push({id:'self',p:{displayName:ids.selfName.textContent||ids.displayName.value||'You',role:state.isHost?'host':state.role,isHost:state.isHost,audio:state.audio,video:state.video},self:true});
    entries.sort((a,b)=>{
      const aRaised=a.self?Boolean(state.handRaised):Boolean(a.p.handRaised),bRaised=b.self?Boolean(state.handRaised):Boolean(b.p.handRaised);
      if(aRaised!==bRaised)return aRaised?-1:1;
      if(aRaised&&bRaised){const aAt=a.self?state.handRaisedAt:a.p.handRaisedAt,bAt=b.self?state.handRaisedAt:b.p.handRaisedAt;const queue=Number(aAt||0)-Number(bAt||0);if(queue)return queue;}
      const rank=roleRank(a.p)-roleRank(b.p); if(rank)return rank;
      if(a.p.audio!==false && b.p.audio!==false){if(a.id===state.activeSpeakerId)return -1;if(b.id===state.activeSpeakerId)return 1;}
      return String(a.p.displayName||'').localeCompare(String(b.p.displayName||''));
    });
    ids.participantList.innerHTML=entries.filter(item=>!query||String(item.p.displayName||'').toLowerCase().includes(query)).map(item=>participantRow(item.id,item.p,item.self)).join('');
    syncChatRecipients();

    ids.waitingCount.textContent = state.waiting.size;
    ids.waitingSection.hidden = !state.waitingRoomEnabled || state.waiting.size === 0;
    ids.waitingRoom.innerHTML = '';
    state.waiting.forEach((p,id) => {
      const row = document.createElement('div');
      row.className = 'participant-row';
      const pending=state.pendingAdmissions.has(id);
      const avatar=p.avatarUrl?`<img src="${escapeHtml(p.avatarUrl)}" alt="">`:escapeHtml(initials(p.displayName));
      row.innerHTML = `<span class="participant-avatar">${avatar}</span><span class="participant-name">${escapeHtml(p.displayName || 'Guest')}<small>${pending?'Waiting for confirmation…':'Waiting Room'}</small></span><span class="participant-actions"><button class="waiting-admit" data-admit="${escapeHtml(id)}" ${pending?'disabled':''}>${pending?'Admitting…':'Admit'}</button><button class="waiting-deny" data-deny="${escapeHtml(id)}" ${pending?'disabled':''}>Decline</button></span>`;
      ids.waitingRoom.append(row);
    });
  }

  function syncChatRecipients(){
    if(!ids.chatRecipient)return;
    const selected=ids.chatRecipient.value||'everyone';
    const options=['<option value="everyone">Everyone</option>',...[...state.participants.entries()].filter(([id])=>state.presenceMembers.has(id)).map(([id,p])=>`<option value="${escapeHtml(id)}">${escapeHtml(p.displayName||'Participant')} · Private</option>`)];
    ids.chatRecipient.innerHTML=options.join('');
    ids.chatRecipient.value=[...ids.chatRecipient.options].some(option=>option.value===selected)?selected:'everyone';
  }

  function appendChatMessage({mine=false,displayName='Participant',message='',avatarUrl='',privateText='',timestamp=Date.now()}={}){
    const row=document.createElement('article');row.className=`chat-message ${mine?'mine':'theirs'}`;
    const avatar=avatarUrl?`<img src="${escapeHtml(avatarUrl)}" alt="">`:escapeHtml(initials(displayName));
    row.innerHTML=`<div class="chat-avatar">${avatar}</div><div class="chat-bubble-wrap"><div class="chat-message-meta"><strong>${escapeHtml(displayName)}</strong>${privateText?`<span>${escapeHtml(privateText)}</span>`:''}<time>${new Date(timestamp).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time></div><p>${escapeHtml(message)}</p></div>`;
    ids.chatMessages.append(row);ids.chatMessages.scrollTop=ids.chatMessages.scrollHeight;return row;
  }

  function showChatPreview(payload){
    const person=state.participants.get(payload.from)||{};const node=document.createElement('button');node.type='button';node.className='chat-heads-up';
    node.innerHTML=`<span class="chat-preview-avatar">${person.avatarUrl?`<img src="${escapeHtml(person.avatarUrl)}" alt="">`:escapeHtml(initials(payload.displayName||person.displayName||'Guest'))}</span><span><strong>${escapeHtml(payload.displayName||person.displayName||'Guest')}${payload.to&&payload.to!=='everyone'?' · Private':''}</strong><small>${escapeHtml(String(payload.message||'').slice(0,110))}</small></span>`;
    node.onclick=()=>{openPanel(ids.chatPanel);ids.chatRecipient.value=payload.to&&payload.to!=='everyone'?payload.from:'everyone';node.remove();};document.body.append(node);setTimeout(()=>node.remove(),5200);
  }

  function ensureLocalDockTile() {
    let tile = ids.filmstripTrack.querySelector('[data-tile="self"]');
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'remote-tile local-dock-tile';
      tile.dataset.tile = 'self';
      tile.innerHTML = `<video autoplay muted playsinline></video><div class="remote-fallback local-fallback"><span></span></div><div class="tile-overlay"><span></span><span class="tile-mic"></span><span class="tile-network" title="Network quality"><i></i><i></i><i></i></span></div>`;
      ids.filmstripTrack.prepend(tile);
    }
    const localVideo=tile.querySelector('video');
    bindStableVideo(localVideo,state.stream,{muted:true,mirror:true,play:false});
    const localLive=Boolean(state.video&&hasLiveVideo(state.stream));
    localVideo.hidden=!localLive;
    if(localLive&&localVideo.paused)localVideo.play().catch(()=>{});
    const localFallback=tile.querySelector('.local-fallback');
    if(localFallback){
      const avatar=state.profile?.avatarUrl||'';
      localFallback.innerHTML=avatar?`<img src="${escapeHtml(avatar)}" alt="${escapeHtml(ids.selfName.textContent||'You')}">`:`<span>${escapeHtml(initials(ids.selfName.textContent||'You'))}</span>`;
      localFallback.hidden=localLive;
    }
    tile.classList.toggle('camera-off',!localLive);
    const roleLabel = state.isHost ? 'Host' : state.role === 'cohost' ? 'Co-host' : 'You';
    tile.querySelector('.tile-overlay > span:first-child').textContent = `${ids.selfName.textContent || 'You'} (${roleLabel})`;
    const localMic=tile.querySelector('.tile-mic'); if(localMic){localMic.innerHTML=ICONS[state.audio?'mic':'mic-off'];localMic.classList.toggle('is-off',!state.audio);}
    syncRaisedHandVisual(canonicalSelfId(),Boolean(state.handRaised));
    tile.hidden = false;
    return tile;
  }

  function updateDockScrollControls() {
    if (!ids.filmstripTrack || !ids.dockUp || !ids.dockDown) return;
    const count = ids.filmstripTrack.querySelectorAll('.remote-tile:not([hidden])').length;
    const visible = Math.max(1, Math.min(5, count));
    ids.filmstrip.style.setProperty('--dock-visible-count', String(visible));
    ids.filmstrip.dataset.count = String(count);
    const overflow = count > 5;
    ids.filmstrip.classList.toggle('has-overflow', overflow);
    const controls = ids.filmstrip.querySelector('.dock-scroll');
    if (controls) controls.hidden = !overflow;
    const horizontal = ids.filmstrip.dataset.orientation === 'horizontal';
    const max = horizontal
      ? Math.max(0, ids.filmstripTrack.scrollWidth - ids.filmstripTrack.clientWidth)
      : Math.max(0, ids.filmstripTrack.scrollHeight - ids.filmstripTrack.clientHeight);
    const current = horizontal ? ids.filmstripTrack.scrollLeft : ids.filmstripTrack.scrollTop;
    ids.dockUp.disabled = !overflow || current <= 4;
    ids.dockDown.disabled = !overflow || current >= max - 4;
  }

  function updateFilmstripVisibility() {
    const remoteCount = state.participants.size;
    const shouldShow = remoteCount > 0 || state.sharing;
    ids.selfTile.hidden = true;
    ids.filmstrip.hidden = !shouldShow;
    if (!shouldShow) {
      ids.filmstrip.dataset.count='0';
      ids.filmstripTrack.querySelector('[data-tile="self"]')?.remove();
      updateLocalStage();
      return;
    }
    ensureLocalDockTile();
    const visibleCount = remoteCount + 1;
    ids.filmstrip.dataset.count = String(visibleCount);
    ids.filmstrip.style.setProperty('--dock-visible-count', String(Math.min(5, Math.max(1, visibleCount))));
    reorderRaisedHandTiles();
    requestAnimationFrame(updateDockScrollControls);
  }

  function ensureTile(participantId, p) {
    let tile = ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(participantId)}"]`);
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'remote-tile';
      tile.dataset.tile = participantId;
      tile.innerHTML = `<video autoplay playsinline></video><div class="remote-fallback"><span></span></div><div class="tile-overlay"><span></span><span class="tile-mic"></span><div class="tile-hover-actions"><button class="tile-quick-mic" data-quick-mic="${escapeHtml(participantId)}" aria-label="Mute or ask to unmute"></button><button class="tile-menu" data-participant="${escapeHtml(participantId)}" aria-label="Participant options">${ICONS.more}</button></div></div>`;
      ids.filmstripTrack.append(tile);
    }
    const label = p.role==='host' || p.isHost ? `${p.displayName||'Guest'} (Host)` : p.role==='cohost' ? `${p.displayName||'Guest'} (Co-host)` : (p.displayName||'Guest');
    tile.querySelector('.tile-overlay > span:first-child').textContent = label;
    const mic=tile.querySelector('.tile-mic'); if(mic){mic.innerHTML=ICONS[p.audio!==false?'mic':'mic-off'];mic.classList.toggle('is-off',p.audio===false);}
    const quickMic=tile.querySelector('.tile-quick-mic'); if(quickMic){const pending=[...state.pendingModeration.values()].find(item=>item.participantId===participantId&&item.action==='request-unmute');quickMic.textContent=pending?'Requested':(p.audio!==false?'Mute':'Ask to unmute');quickMic.disabled=Boolean(pending);quickMic.dataset.pendingRequest=pending?.requestId||'';quickMic.classList.toggle('is-request',p.audio===false);}
    const fallback=tile.querySelector('.remote-fallback');
    if(fallback) {
      fallback.innerHTML = p.avatarUrl
        ? `<img src="${escapeHtml(p.avatarUrl)}" alt="${escapeHtml(p.displayName||'Guest')}">`
        : `<span>${escapeHtml(initials(p.displayName||'Guest'))}</span>`;
    }
    syncRaisedHandVisual(participantId,Boolean(p.handRaised));
    return tile;
  }

  function hasLiveVideo(stream) {
    // A WebRTC receiver may briefly mark a live track `muted` while packets are
    // being recovered. Treating that transient transport flag as camera-off
    // makes the UI flash between video and the avatar. Camera state is owned by
    // the explicit participant media-state; a track stops being renderable only
    // when it has actually ended.
    return Boolean(stream?.getVideoTracks?.().some(track=>track.readyState==='live'));
  }

  function cleanupMediaBinding(participantId) {
    const binding=state.mediaBindings.get(participantId);
    if(!binding)return;
    (binding.listeners||[]).forEach(({track,type,handler})=>{try{track.removeEventListener(type,handler);}catch(_){}});
    if(binding.audioRaf)cancelAnimationFrame(binding.audioRaf);
    if(binding.audioContext&&binding.audioContext!==state.audioAnalysisContext)binding.audioContext.close?.().catch(()=>{});
    state.mediaBindings.delete(participantId);
  }

  function attachRemoteAudioMeter(participantId,stream,binding){
    if(!stream?.getAudioTracks?.().length)return;
    try{
      const context=state.audioAnalysisContext||(state.audioAnalysisContext=new (window.AudioContext||window.webkitAudioContext)());
      const source=context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const analyser=context.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.62;source.connect(analyser);
      const data=new Uint8Array(analyser.fftSize);let noiseFloor=.01,smoothed=0,active=false,quiet=0,lastVisual=0;
      const loop=()=>{
        analyser.getByteTimeDomainData(data);let sum=0;for(let i=0;i<data.length;i++){const s=(data[i]-128)/128;sum+=s*s;}
        const rms=Math.sqrt(sum/data.length);if(!active)noiseFloor=noiseFloor*.988+Math.min(rms,.07)*.012;
        smoothed=smoothed*.64+Math.min(100,Math.max(0,rms-noiseFloor*1.12)*1100)*.36;
        const person=state.participants.get(participantId);const next=person?.audio!==false&&(smoothed>4.2||(active&&smoothed>2.1));
        if(next)quiet=0;else quiet++;const stable=next||(active&&quiet<8);
        const now=performance.now();if(stable!==active||now-lastVisual>100){active=stable;lastVisual=now;setSpeakingVisual(participantId,active,active?smoothed:0);}
        binding.audioRaf=requestAnimationFrame(loop);
      };
      binding.audioContext=context;context.resume?.().catch(()=>{});loop();
    }catch(error){console.warn('Remote audio activity monitor unavailable',error);}
  }

  function resumeSpeakingMeters(){
    state.speakingMonitor?.resume?.();
    state.mediaBindings.forEach(binding=>binding.audioContext?.resume?.().catch(()=>{}));
  }

  function refreshRemoteTile(participantId,tile,stream) {
    if(!tile)return;
    const participant=state.participants.get(participantId)||{};
    const video=tile.querySelector('video');
    const fallback=tile.querySelector('.remote-fallback');
    const live=participant.video!==false && hasLiveVideo(stream);
    tile.classList.toggle('camera-off',!live);
    if(video){
      video.hidden=!live;
      if(live && video.paused)video.play().catch(()=>{});
    }
    if(fallback)fallback.hidden=live;
    if(state.activeSpeakerId===participantId && !state.sharing){
      if(live)bindStageStream(participantId,participant);
      else showStageFallback(participant);
    }
  }

  function bindRemoteTileMedia(participantId,tile,stream) {
    if(!tile)return;
    const video=tile.querySelector('video');
    if(!video)return;
    const trackSignature=(stream?.getTracks?.()||[]).map(track=>`${track.kind}:${track.id}`).sort().join('|');
    const existing=state.mediaBindings.get(participantId);
    if(existing?.stream===stream && existing?.video===video && existing?.trackSignature===trackSignature){
      refreshRemoteTile(participantId,tile,stream);
      return;
    }
    cleanupMediaBinding(participantId);
    bindStableVideo(video,stream,{muted:false,mirror:true,play:false});
    const listeners=[];
    const refresh=()=>refreshRemoteTile(participantId,tile,stream);
    stream?.getTracks?.().forEach(track=>{
      ['mute','unmute','ended'].forEach(type=>{track.addEventListener(type,refresh);listeners.push({track,type,handler:refresh});});
    });
    // WebRTC commonly adds audio and camera tracks to the same MediaStream in
    // separate ontrack deliveries. The track signature makes that mutation a
    // real rebind so late camera frames and speaking meters cannot be skipped.
    const binding={stream,video,trackSignature,listeners,audioContext:null,audioRaf:0};
    state.mediaBindings.set(participantId,binding);
    attachRemoteAudioMeter(participantId,stream,binding);
    refresh();
  }

  function markUiDeparted(participantId,ttlMs=30000){
    if(!participantId)return;
    state.departedParticipants.set(participantId,Date.now()+ttlMs);
  }

  function uiParticipantIsDeparted(participantId){
    const expires=Number(state.departedParticipants.get(participantId)||0);
    if(!expires)return false;
    if(expires<=Date.now()){state.departedParticipants.delete(participantId);return false;}
    return true;
  }

  function reviveUiParticipant(participantId){
    if(participantId)state.departedParticipants.delete(participantId);
  }

  function setPresentationMode(active, presenterName='') {
    document.body.classList.toggle('presentation-active', Boolean(active));
    document.body.classList.toggle('local-presentation-active',Boolean(active&&state.sharingParticipantId==='self'));
    const nativeLocalPresenter=Boolean(active&&state.sharingParticipantId==='self'&&window.dominionDesktop?.isDesktop);
    ids.shareStatusBar.hidden = !active||nativeLocalPresenter;
    ids.speakerNameplate.hidden = Boolean(active);
    if (active) {
      if(state.sharingParticipantId!=='self'){
        ids.shareStatusBar.style.left='50%';
        ids.shareStatusBar.style.top='10px';
        ids.shareStatusBar.style.transform='translateX(-50%)';
      }
      ids.shareStatusText.textContent = state.sharingParticipantId && state.sharingParticipantId !== 'self'
        ? `${presenterName || 'A participant'} is sharing`
        : 'You are sharing';
      // Only the presenter receives the private floating control strip. Viewers
      // keep their normal bottom toolbar and see only the sharing status copy.
      ids.sharePresenterControls.hidden = state.sharingParticipantId!=='self';
      if(ids.shareViewerMoreBtn)ids.shareViewerMoreBtn.hidden=state.sharingParticipantId==='self';
      ids.sharePresenterControls.querySelectorAll('.local-share-only').forEach(button=>button.hidden=state.sharingParticipantId!=='self');
      ids.sharePresenterControls.querySelectorAll('.remote-share-only').forEach(button=>button.hidden=state.sharingParticipantId==='self');
      ids.stageVideo.style.objectFit = 'contain';
      ids.stageVideo.style.transform = '';
      ids.stageVideo.style.filter = '';
    } else {
      document.body.classList.remove('local-presentation-active');
      ids.shareStatusBar.style.left='50%';
      ids.shareStatusBar.style.top='10px';
      ids.shareStatusBar.style.transform='translateX(-50%)';
      ids.sharePresenterControls.hidden = true;
      if(ids.shareViewerMoreBtn)ids.shareViewerMoreBtn.hidden=true;
      ids.sharePresenterControls.querySelectorAll('.local-share-only,.remote-share-only').forEach(button=>button.hidden=false);
      ids.stageVideo.style.objectFit = '';
      ids.pauseShareBtn.textContent = 'Pause Share';
      state.sharePaused = false;
    }
  }

  function enablePresenterToolbarDrag(){
    const bar=ids.shareStatusBar;
    if(!bar||bar.dataset.dragReady==='1')return;
    bar.dataset.dragReady='1';
    let drag=null;
    bar.addEventListener('pointerdown',event=>{
      if(state.sharingParticipantId!=='self'||event.target.closest('button'))return;
      const rect=bar.getBoundingClientRect();
      drag={dx:event.clientX-rect.left,dy:event.clientY-rect.top};
      bar.setPointerCapture?.(event.pointerId);
      bar.classList.add('is-dragging');
      event.preventDefault();
    });
    bar.addEventListener('pointermove',event=>{
      if(!drag)return;
      const maxX=Math.max(8,innerWidth-bar.offsetWidth-8);
      const maxY=Math.max(8,innerHeight-bar.offsetHeight-8);
      bar.style.left=`${Math.min(maxX,Math.max(8,event.clientX-drag.dx))}px`;
      bar.style.top=`${Math.min(maxY,Math.max(8,event.clientY-drag.dy))}px`;
      bar.style.transform='none';
    });
    const finish=()=>{drag=null;bar.classList.remove('is-dragging');};
    bar.addEventListener('pointerup',finish);bar.addEventListener('pointercancel',finish);
  }
  enablePresenterToolbarDrag();

  let nativePresenterDockTimer=0;
  let nativePresenterDockBusy=false;
  const nativeDockCanvas=document.createElement('canvas');
  nativeDockCanvas.width=300;nativeDockCanvas.height=169;
  const nativeDockContext=nativeDockCanvas.getContext('2d',{alpha:false,desynchronized:true});
  function captureNativeDockFrame(video){
    if(!nativeDockContext||!video||video.hidden||video.readyState<2||!video.videoWidth||!video.videoHeight)return'';
    try{
      nativeDockContext.fillStyle='#111419';nativeDockContext.fillRect(0,0,300,169);
      const sourceRatio=video.videoWidth/video.videoHeight,targetRatio=300/169;
      let sx=0,sy=0,sw=video.videoWidth,sh=video.videoHeight;
      if(sourceRatio>targetRatio){sw=Math.round(video.videoHeight*targetRatio);sx=Math.round((video.videoWidth-sw)/2);}else{sh=Math.round(video.videoWidth/targetRatio);sy=Math.round((video.videoHeight-sh)/2);}
      nativeDockContext.drawImage(video,sx,sy,sw,sh,0,0,300,169);
      return nativeDockCanvas.toDataURL('image/jpeg',.68);
    }catch(_){return'';}
  }
  function publishNativePresenterDock(){
    if(nativePresenterDockBusy||!window.dominionDesktop?.isDesktop||!state.sharing||state.sharingParticipantId!=='self')return;
    nativePresenterDockBusy=true;
    try{
      const tiles=[...ids.filmstripTrack.querySelectorAll('.remote-tile:not([hidden])')].slice(0,5).map(tile=>{
        const id=tile.dataset.tile||'';
        const local=id==='self';
        const person=local?null:(state.participants.get(id)||{});
        const name=local?(ids.selfName.textContent||'You'):(person.displayName||'Participant');
        const role=local?(state.isHost?'Host':state.role==='cohost'?'Co-host':'You'):(person.role==='host'||person.isHost?'Host':person.role==='cohost'?'Co-host':'');
        const videoOn=local?state.video:person.video!==false;
        const video=tile.querySelector('video');
        const frame=videoOn?captureNativeDockFrame(video):'';
        // Camera intent is authoritative and separate from frame sampling. A
        // temporarily unavailable canvas sample must not look like Video Off
        // in the native dock; the dock retains its last good frame until an
        // actual media-state update reports video:false.
        return {id,name,role,audio:local?state.audio:person.audio!==false,video:Boolean(videoOn),speaking:tile.classList.contains('speaking'),avatarUrl:local?(state.profile?.avatarUrl||''):(person.avatarUrl||''),frame};
      });
      window.dominionDesktop.updatePresenterDock?.({tiles});
    }finally{nativePresenterDockBusy=false;}
  }
  function startNativePresenterDockFeed(){
    clearInterval(nativePresenterDockTimer);
    publishNativePresenterDock();
    nativePresenterDockTimer=setInterval(publishNativePresenterDock,220);
  }
  function stopNativePresenterDockFeed(){clearInterval(nativePresenterDockTimer);nativePresenterDockTimer=0;nativePresenterDockBusy=false;}

  if(window.dominionDesktop?.isDesktop&&window.dominionDesktop?.onPresenterCommand){
    window.dominionDesktop.onPresenterCommand(command=>{
      const actions={
        audio:()=>ids.micBtn?.click(),
        video:()=>ids.camBtn?.click(),
        participants:()=>ids.participantsBtn?.click(),
        chat:()=>ids.chatBtn?.click(),
        share:()=>ids.newShareBtn?.click(),
        reactions:()=>ids.reactionBtn?.click(),
        'raise-hand':()=>ids.raiseHandBtn?.click(),
        pause:()=>ids.pauseShareBtn?.click(),
        settings:()=>ids.settingsDialog?.showModal(),
        stop:()=>ids.stopShareBtn?.click()
      };
      actions[command]?.();
    });
  }

  function showSharedStage(participantId) {
    const person = participantId === 'self'
      ? {displayName:ids.selfName.textContent || 'You', stream:engine.snapshot().screenStream}
      : state.participants.get(participantId);
    if (!person) return;
    const stream = participantId === 'self' ? engine.snapshot().screenStream : (person.screenStream || null);
    state.sharing = true;
    state.sharingParticipantId = participantId;
    setPresentationMode(true, person.displayName);
    const privateDesktopPresenter=participantId==='self'&&Boolean(window.dominionDesktop?.isDesktop);
    if (privateDesktopPresenter) {
      // Never paint an entire-display capture back into the desktop meeting
      // window. Doing so creates the recursive tunnel Zoom deliberately avoids.
      ids.stageVideo.srcObject=null;
      ids.stageVideo.hidden=true;
      ids.stageFallback.hidden=false;
      ids.stageName.textContent='You are sharing your screen';
    } else if (hasLiveVideo(stream)) {
      bindStableVideo(ids.stageVideo,stream,{muted:participantId==='self',mirror:false,play:true});
      ids.stageFallback.hidden = true;
    ids.stageVideo.hidden = false;
    } else {
      ids.stageVideo.srcObject = null;
      ids.stageFallback.hidden = false;
      ids.stageName.textContent = `${person.displayName || 'Participant'} is sharing`;
    }
    const presenterTile = ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(participantId)}"]`);
    if (presenterTile) { presenterTile.classList.add('sharing-presenter'); ids.filmstripTrack.prepend(presenterTile); }
    if(participantId==='self'){const localTile=ensureLocalDockTile();localTile.classList.add('sharing-presenter');ids.filmstripTrack.prepend(localTile);}
    updateFilmstripVisibility();
  }

  function endPresentationMode() {
    const oldPresenter = state.sharingParticipantId;
    state.sharing = false;
    state.sharingParticipantId = null;
    setPresentationMode(false);
    ids.filmstripTrack.querySelectorAll('.sharing-presenter').forEach(tile=>tile.classList.remove('sharing-presenter'));
    updateFilmstripVisibility();
    if (state.activeSpeakerId) setMainSpeaker(state.activeSpeakerId); else updateLocalStage();
  }

  function resolveParticipantStageStream(participantId, person) {
    if (hasLiveVideo(person?.stream)) return person.stream;
    const tileVideo = ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(participantId)}"] video`);
    if (hasLiveVideo(tileVideo?.srcObject)) return tileVideo.srcObject;
    return person?.stream || tileVideo?.srcObject || null;
  }

  function bindStageStream(participantId, person) {
    const stream = resolveParticipantStageStream(participantId, person);
    if (person?.video===false || !hasLiveVideo(stream)) return false;
    bindStableVideo(ids.stageVideo,stream,{muted:participantId==='self',mirror:participantId==='self'&&ids.mirrorToggle.checked,play:true});
    ids.stageFallback.hidden = true;
    ids.stageVideo.hidden = false;
    return true;
  }

  function showStageFallback(person) {
    // Camera-off is presentation state, not a reason to tear down the decoder.
    // Keep the stream attached while hidden so toggling back on is instantaneous.
    ids.stageVideo.hidden = true;
    ids.stageFallback.hidden = false;
    const name = person?.displayName || 'Participant';
    const image = ids.stageFallback.querySelector('img');
    let initialsNode=ids.stageFallback.querySelector('.stage-avatar-initials');
    if(!initialsNode){initialsNode=document.createElement('span');initialsNode.className='stage-avatar-initials';ids.stageFallback.insertBefore(initialsNode,ids.stageName);}
    const avatar = person?.avatarUrl || '';
    if (image) {
      image.hidden=!avatar;
      image.src = avatar || '';
      image.alt = avatar ? name : '';
      image.classList.toggle('profile-placeholder', Boolean(avatar));
    }
    initialsNode.hidden=Boolean(avatar);
    initialsNode.textContent=initials(name);
    ids.stageName.textContent = name;
    ids.speakerNameplate.hidden = false;
    ids.speakerName.textContent = name;
  }

  function setMainSpeaker(participantId) {
    if(participantId==='self'){setLocalMainSpeaker();return;}
    const p = state.participants.get(participantId);
    if (!p || state.sharing) return;
    state.activeSpeakerId = participantId;
    const bound = bindStageStream(participantId, p);
    if (bound) {
      p.video = true;
      ids.stageVideo.style.transform = '';
    } else {
      showStageFallback(p);
      // The dock can receive its stream slightly before the stage. Retry briefly instead of leaving a false camera-off stage.
      let attempts = 0;
      const retry = setInterval(() => {
        attempts += 1;
        if (state.sharing || state.activeSpeakerId !== participantId || bindStageStream(participantId, p) || attempts >= 12) clearInterval(retry);
      }, 250);
    }
    ids.speakerNameplate.hidden = false;
    ids.speakerName.textContent = p.displayName || 'Guest';
    ids.meeting.classList.toggle('active-speaker-remote',participantId!=='self');
    ids.stageVideo.classList.toggle('active-speaker-ring',Boolean(state.speakerClaims.get(participantId)?.active));
  }

  function addRemote({participantId,stream,meta}) {
    if(!participantId || uiParticipantIsDeparted(participantId)) return;
    const existing = state.participants.get(participantId) || {};
    // Track delivery can pause for a moment while a second screen-share video
    // sender is negotiated. Never convert that transport pause into a durable
    // camera-off choice; only explicit media-state/presence signals own `video`.
    const advertisedAudio=typeof meta?.audio==='boolean'?meta.audio:(typeof existing.audio==='boolean'?existing.audio:true);
    const advertisedVideo=typeof meta?.video==='boolean'?meta.video:(typeof existing.video==='boolean'?existing.video:true);
    // Track existence is transport state, not mute/camera intent. Preserve the
    // participant's explicit media-state while attaching the newest stream.
    const participant = {...existing,...(meta||{}),stream,screenStream:existing.screenStream||null,audio:advertisedAudio,video:advertisedVideo};
    state.participants.set(participantId,participant);
    const tile = ensureTile(participantId,participant);
    bindRemoteTileMedia(participantId,tile,stream);
    if (state.sharingParticipantId === participantId) showSharedStage(participantId);
    else if (!state.activeSpeakerId || !state.participants.has(state.activeSpeakerId)) setMainSpeaker(participantId);
    updateFilmstripVisibility();
    renderParticipants();
  }

  function removeRemote(id,{departed=false}={}) {
    if(!id)return;
    if(departed)markUiDeparted(id);
    cleanupMediaBinding(id);
    const participant=state.participants.get(id);
    state.participants.delete(id);
    state.waiting.delete(id);
    const tile=ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(id)}"]`);
    const tileVideo=tile?.querySelector('video');
    if(tileVideo?.srcObject)tileVideo.srcObject=null;
    tile?.remove();
    if(state.sharingParticipantId===id) endPresentationMode();
    if (state.activeSpeakerId === id) {
      state.activeSpeakerId = null;
      const next = sortedParticipants()[0]?.[0];
      if (next) setMainSpeaker(next); else updateLocalStage();
    } else if(ids.stageVideo.srcObject && participant?.stream && ids.stageVideo.srcObject===participant.stream && !state.sharing){
      updateLocalStage();
    }
    updateFilmstripVisibility();
    renderParticipants();
  }

  function reconcileMeetingView() {
    if(state.phase!=='meeting' || state.awaitingAdmission || !ids.filmstripTrack)return;
    const valid=new Set(['self',...state.participants.keys()]);
    ids.filmstripTrack.querySelectorAll('[data-tile]').forEach(tile=>{
      const participantId=tile.dataset.tile;
      if(!valid.has(participantId)){
        cleanupMediaBinding(participantId);
        tile.querySelectorAll('video').forEach(video=>{video.srcObject=null;});
        tile.remove();
      }
    });
    for(const [participantId,participant] of state.participants){
      if(uiParticipantIsDeparted(participantId))continue;
      const tile=ensureTile(participantId,participant);
      if(participant.stream)bindRemoteTileMedia(participantId,tile,participant.stream);
      else refreshRemoteTile(participantId,tile,null);
      const advertisedVideo=participant.video!==false;
      const receivedVideo=hasLiveVideo(participant.stream);
      if(advertisedVideo&&!receivedVideo){
        const missingSince=state.missingMediaSince.get(participantId)||Date.now();state.missingMediaSince.set(participantId,missingSince);
        if(Date.now()-missingSince>3200){
          if(!state.recoveringRemoteMedia.has(participantId)){
            state.recoveringRemoteMedia.add(participantId);
            toast(`Reconnecting ${participant.displayName||'participant'} video…`,{force:true,type:'info'});
            window.DominionRuntime?.events?.publish?.({type:'media.remote.video.missing',source:'meet-ui',meetingId:engine.snapshot?.().roomId||'',correlationId:participantId,severity:'warning',payload:{participantId,displayName:participant.displayName||'Participant'}});
          }
          // A missing decoded frame is not proof that the WebRTC transport is
          // broken. Replacing a connected peer here made both clients rebuild
          // independently, causing offer collisions, frozen camera tracks and
          // screen-share loss. Rendering health is observational here; the
          // engine's connection state exclusively owns transport recovery.
        }
      }else{
        state.missingMediaSince.delete(participantId);
        if(state.recoveringRemoteMedia.delete(participantId)){
          toast(`${participant.displayName||'Participant'} video restored`,{force:true,type:'success'});
          window.DominionRuntime?.events?.publish?.({type:'media.remote.video.recovered',source:'meet-ui',meetingId:engine.snapshot?.().roomId||'',correlationId:participantId,payload:{participantId,displayName:participant.displayName||'Participant'}});
        }
      }
    }
    updateFilmstripVisibility();
    updateDockScrollControls();
  }

  function startViewReconciler(){
    clearInterval(state.reconcileTimer);
    state.reconcileTimer=setInterval(reconcileMeetingView,2500);
  }

  function stopViewReconciler(){
    clearInterval(state.reconcileTimer);
    state.reconcileTimer=null;
  }

  function positionPanel(panel) {
    if (panel.dataset.positioned === '1') return;
    const width = Math.min(380, Math.max(320, innerWidth - 32));
    const height = Math.min(560, Math.max(380, innerHeight - 180));
    Object.assign(panel.style, {
      position:'fixed', width:`${width}px`, height:`${height}px`,
      left:`${Math.max(16,(innerWidth-width)/2)}px`, top:`${Math.max(62,(innerHeight-height)/2)}px`,
      right:'auto', bottom:'auto'
    });
    panel.dataset.positioned = '1';
  }

  function openPanel(panel) {
    [ids.participantsPanel,ids.chatPanel].forEach(p=>{ if(p!==panel) p.hidden=true; });
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    if (willOpen) positionPanel(panel);
    if (panel === ids.chatPanel && willOpen) { state.unread=0; ids.chatBadge.hidden=true; }
    closeMenus();
  }

  function buildDeviceMenu(type, anchor) {
    const rect = anchor.getBoundingClientRect();
    ids.deviceMenu.style.left = `${Math.max(10,Math.min(innerWidth-325,rect.left))}px`;
    ids.deviceMenu.innerHTML = `<strong>${type==='audio'?'Audio options':'Video options'}</strong>`;
    const select = type === 'audio' ? ids.microphoneSelect : ids.cameraSelect;
    [...select.options].forEach(option => {
      const button = document.createElement('button');
      button.textContent = `${option.value===select.value?'✓ ':''}${option.textContent}`;
      button.onclick = async () => { try { select.value=option.value; await replaceMedia(type==='audio'?'audio':'video',option.value); closeMenus(); } catch(e) { toast(e.message || 'Could not change device'); } };
      ids.deviceMenu.append(button);
    });
    if (type === 'audio') {
      const settings = document.createElement('button');
      settings.textContent = 'Audio Settings…';
      settings.onclick = () => { closeMenus(); ids.settingsDialog.showModal(); };
      ids.deviceMenu.append(settings);
    } else {
      [[`${ids.mirrorToggle.checked?'✓ ':''}Mirror my video`,()=>ids.mirrorToggle.click()],[`${Number(ids.qualitySelect.value)>=720?'✓ ':''}HD video`,()=>{ids.qualitySelect.value='720';applyVideoQuality(true);saveAccountPreferences();}],[`${Number(ids.touchAppearanceRange?.value)>0?'✓ ':''}Touch up appearance`,()=>{if(ids.touchAppearanceRange){ids.touchAppearanceRange.value=ids.touchAppearanceRange.value==='0'?'24':'0';applyEffects();saveAccountPreferences();}}],[`${ids.backgroundSelect.value==='blur'?'✓ ':''}Blur background`,()=>{ids.backgroundSelect.value=ids.backgroundSelect.value==='blur'?'none':'blur';applyEffects();saveAccountPreferences();}],[`${ids.backgroundSelect.value==='portrait'?'✓ ':''}Portrait background`,()=>{ids.backgroundSelect.value=ids.backgroundSelect.value==='portrait'?'none':'portrait';applyEffects();saveAccountPreferences();}]].forEach(([label,fn])=>{
        const b=document.createElement('button'); b.textContent=label; b.onclick=async()=>{await fn();closeMenus();}; ids.deviceMenu.append(b);
      });
      const settings = document.createElement('button');
      settings.textContent = 'Video Settings…';
      settings.onclick = () => { closeMenus(); ids.settingsDialog.showModal(); };
      ids.deviceMenu.append(settings);
    }
    ids.deviceMenu.hidden = false;
  }

  function applyEffects() {
    const mirrorEnabled = ids.mirrorToggle.checked;
    const brightnessValue = Number(ids.brightnessRange.value || 100);
    const touch = Number(ids.touchAppearanceRange?.value || state.preferences.touchAppearance || 0);
    const background = ids.backgroundSelect.value;
    const contrast = 1 + touch / 500;
    const saturation = 1 + touch / 700;
    const soft = touch > 0 ? ` blur(${Math.min(.5,touch/150)}px)` : '';
    const modeFilter = background==='blur' ? ' blur(1.4px)' : background==='portrait' ? ' contrast(1.08) saturate(1.08)' : '';
    const filter = `brightness(${brightnessValue}%) contrast(${contrast}) saturate(${saturation})${soft}${modeFilter}`;
    const transform = `${mirrorEnabled?'scaleX(-1)':''}${background==='blur'?' scale(1.018)':''}`.trim();
    [ids.selfVideo,ids.prejoinVideo].forEach(video => { video.style.transform=transform; video.style.filter=filter; });
    const localOnStage = !state.participants.size && !state.sharing;
    if (localOnStage) { ids.stageVideo.style.transform=transform; ids.stageVideo.style.filter=filter; }
    ids.prejoinVideo.parentElement?.classList.toggle('portrait-mode', background==='portrait');
    state.preferences.touchAppearance=touch;
  }

  async function applyVideoQuality(notify=false) {
    const height=Number(ids.qualitySelect.value||720);
    const track=state.stream?.getVideoTracks?.()[0];
    if(!track?.applyConstraints)return;
    try{await track.applyConstraints({height:{ideal:height},width:{ideal:Math.round(height*16/9)},frameRate:{ideal:30,max:30}});if(notify)toast(`${height}p video quality applied`);}catch(error){if(notify)toast('This camera could not apply the selected quality');}
  }

  async function resolveRoomAuthority(room, requestedHost) {
    const normalizedRoom=meetingDigits(room)||String(room||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'');
    const userId=state.session?.user?.id || '';
    let roomRecord=null;
    if(state.client){
      if(!requestedHost){
        let lookupCompleted=false;
        try {
          const suppliedPasscode=String(state.passcode||'').replace(/\D/g,'').slice(0,10);
          const resolved=await fetchWithTimeout('/.netlify/functions/resolve-meeting-join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({room:normalizedRoom,passcode:suppliedPasscode})},10000);
          const record=await resolved.json().catch(()=>null);
          if(resolved.ok&&record?.found){
            roomRecord={room_id:normalizedRoom,owner_id:record.owner_id,waiting_room_enabled:Boolean(record.waiting_room_enabled),active:Boolean(record.active),passcodeRequired:Boolean(record.passcode_required),passcodeValid:Boolean(record.passcode_valid)};
            lookupCompleted=true;
          }
          if(!resolved.ok)throw new Error(record?.error||record?.message||'Meeting ID could not be verified. Check the number and try again.');
        } catch(error) { throw error; }
        if(!lookupCompleted)throw new Error('Meeting ID could not be verified. Check the number and try again.');
      }
      try {
        if(requestedHost){
          const result=await state.client.from('meet_rooms').select('room_id,owner_id,waiting_room_enabled,passcode,active').eq('room_id',normalizedRoom).maybeSingle();
          if(!result.error&&result.data) roomRecord=result.data;
        }
      } catch(_) {}
      // Scheduled meetings already have an authenticated owner. Use them to recover
      // host authority even before the general room record has been created.
      if(!roomRecord&&requestedHost){
        try {
          const scheduled=await state.client.from('meet_scheduled_meetings').select('user_id,meeting_id,waiting_room_enabled,passcode').eq('meeting_id',normalizedRoom).maybeSingle();
          if(!scheduled.error && scheduled.data){
            roomRecord={room_id:normalizedRoom,owner_id:scheduled.data.user_id,waiting_room_enabled:Boolean(scheduled.data.waiting_room_enabled),passcode:scheduled.data.passcode||'',active:true};
          }
        } catch(_) {}
      }
      const ownsRoom=Boolean(userId&&roomRecord?.owner_id===userId);
      const shouldClaim=Boolean(userId&&requestedHost && (!roomRecord || ownsRoom));
      if(shouldClaim){
        const payload={room_id:normalizedRoom,owner_id:userId,waiting_room_enabled:Boolean(state.waitingRoomEnabled),passcode:state.passcode||roomRecord?.passcode||'',active:true,updated_at:new Date().toISOString()};
        try {
          const saved=await state.client.from('meet_rooms').upsert(payload,{onConflict:'room_id'}).select('room_id,owner_id,waiting_room_enabled,passcode,active').maybeSingle();
          if(!saved.error) roomRecord=saved.data||payload;
        } catch(_) { roomRecord=roomRecord||payload; }
      }
      if(userId&&roomRecord?.owner_id===userId) requestedHost=true;
      if(roomRecord){
        state.securityKnown=true;
        state.waitingRoomEnabled=Boolean(roomRecord.waiting_room_enabled);
        if(requestedHost && !state.passcode && roomRecord.passcode) state.passcode=String(roomRecord.passcode);
      }
    }
    return {isHost:Boolean(requestedHost),roomRecord};
  }

  function cancelAbsentHostAlert(){
    if(state.absentHostAlertTimer)clearTimeout(state.absentHostAlertTimer);
    state.absentHostAlertTimer=null;
  }

  function scheduleAbsentHostAlert(room,attempt=0){
    cancelAbsentHostAlert();
    if(state.isHost||state.absentHostAlertSent)return;
    // Allow presence to settle before deciding the host is away. Client and
    // database dedupe prevent reconnects or heartbeats from flooding email.
    state.absentHostAlertTimer=setTimeout(async()=>{
      state.absentHostAlertTimer=null;
      const hostPresent=[...state.presenceMembers.values()].some(member=>member?.isHost||member?.role==='host');
      if(hostPresent||state.isHost||state.absentHostAlertSent)return;
      try{
        const response=await fetchWithTimeout('/.netlify/functions/meeting-host-alert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({room,visitorName:ids.displayName.value.trim()||'A guest'})},8000);
        if(!response.ok)throw new Error('Host alert could not be delivered.');
        state.absentHostAlertSent=true;
      }catch(_){
        // Delivery must never interrupt entry, but a transient function or
        // provider failure should not permanently suppress the host alert.
        if(attempt<2&&!state.isHost)scheduleAbsentHostAlert(room,attempt+1);
      }
    },attempt===0?250:Math.min(15000,4000*(attempt+1)));
  }

  async function join(event) {
    event.preventDefault();
    try{toneContext=toneContext||new (window.AudioContext||window.webkitAudioContext)();await toneContext.resume();}catch(_){}
    try{
      state.audioAnalysisContext=state.audioAnalysisContext||new (window.AudioContext||window.webkitAudioContext)();
      await state.audioAnalysisContext.resume();
      if(state.stream?.getAudioTracks?.().length)startLocalSpeakingMonitor(state.stream);
    }catch(_){}
    const name = ids.displayName.value.trim();
    const room = meetingDigits(ids.roomId.value)||ids.roomId.value.trim();
    if (!name || !room){setJoinStatus(!name?'Enter your name to join.':'Enter a valid meeting ID.','error');(!name?ids.displayName:ids.roomId)?.focus();return;}
    const submit = ids.joinForm.querySelector('.primary');
    const submitLabel=submit.querySelector('[data-join-label]');
    submit.disabled = true;
    submit.setAttribute('aria-busy','true');
    if(submitLabel)submitLabel.textContent='Joining…';
    setJoinStatus('Verifying meeting and passcode…');
    try {
      // Re-read the controls at the moment of entry so saved join defaults cannot
      // be lost to a late preview stream or device refresh.
      enforcePersistentJoinMediaPreferences();
      const session = await window.DSAuth?.getSession?.();
      const params = new URLSearchParams(location.search);
      const requestedHost = Boolean(window.__DS_START_AS_HOST) || params.get('host') === '1' || params.get('mode') === 'host';
      state.waitingRoomEnabled = params.get('waiting') === '1' || Boolean(window.__DS_WAITING_ROOM);
      state.securityKnown = state.waitingRoomEnabled || requestedHost;
      state.passcode = String(window.__DS_MEETING_PASSCODE || ids.meetingPasscode?.value || '').replace(/\D/g,'').slice(0,10);
      const authority=await resolveRoomAuthority(room,requestedHost);
      const requiredPasscode=String(authority.roomRecord?.passcode||'').replace(/\D/g,'').slice(0,10);
      const passcodeRequired=Boolean(authority.roomRecord?.passcodeRequired||requiredPasscode);
      const passcodeValid=authority.roomRecord?.passcodeValid!==false&&(!requiredPasscode||state.passcode===requiredPasscode);
      if(!authority.isHost&&passcodeRequired&&!passcodeValid){
        ids.meetingPasscode?.focus();
        throw new Error(state.passcode?'Incorrect meeting passcode.':'This meeting requires a passcode.');
      }
      if(requiredPasscode)state.passcode=requiredPasscode;
      if (authority.roomRecord && authority.roomRecord.active === false && !authority.isHost) {
        throw new Error('This meeting has ended. Ask the host to start the room again.');
      }
      state.isHost=authority.isHost;
      setJoinStatus('Meeting verified. Connecting securely…','success');
      // Start the deduplicated host notification before realtime initialization.
      // A slow or unavailable channel must never suppress the absent-host email.
      if(!state.isHost)scheduleAbsentHostAlert(room);
      state.inviteLink = `${location.origin}/meet/?action=join&room=${encodeURIComponent(room)}`;
      window.__DS_START_AS_HOST = false;
      state.role = state.isHost ? 'host' : 'attendee';
      await Promise.race([
        engine.init({roomId:room,displayName:name,isHost:state.isHost,hostUserId:authority.roomRecord?.owner_id||'',role:state.role,session,contractLevel:state.profile?.contractLevel||'',avatarUrl:state.profile?.avatarUrl||'',waitingRoomEnabled:state.waitingRoomEnabled}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('The secure meeting connection took too long. Try joining again.')),15000))
      ]);
      const initialSnapshot=engine.snapshot?.()||{};
      const mustWait=!state.isHost && (state.waitingRoomEnabled || initialSnapshot.admitted===false);
      if(mustWait) stopPreviewMediaForWaiting();
      else await ensureMeetingMedia();
      ids.prejoin.hidden = true;
      setJoinStatus('');
      ids.meeting.hidden = false;
      document.body.classList.remove('prejoin-active');
      document.body.classList.add('meeting-active');
      state.phase = 'meeting';
      startMeetingTimer();
      startViewReconciler();
      ids.selfName.textContent = name;
      ids.stageName.textContent = name;
      ids.connectionState.textContent = state.isHost ? 'Host' : 'Connecting…';
      ids.connectionState.classList.toggle('host-state',state.isHost);
      ids.endAllBtn.hidden = !state.isHost;
      ids.moreBtn.hidden = false;
      if(ids.hostToolsBtn) ids.hostToolsBtn.hidden = !(state.isHost || state.role==='cohost');
      setButtonState(ids.micBtn,state.audio,'mic','mic-off','Mute','Unmute');
      setButtonState(ids.camBtn,state.video,'video','video-off','Stop Video','Start Video');
      if(!mustWait) updateLocalStage();
      setWaitingGate(mustWait,'Waiting for the host to admit you');
      renderParticipants();
      if(window.__DS_AUTO_SHARE&&state.isHost){window.__DS_AUTO_SHARE=false;setTimeout(()=>engine.shareScreen().catch(error=>toast(error.message||'Screen sharing unavailable')),700);}
    } catch (error) {
      toast(error.message || 'Could not join meeting');
      setJoinStatus(error.message || 'Could not join meeting. Please try again.','error');
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      if(submitLabel)submitLabel.textContent='Join Meeting';
    }
  }


  function showUnmuteRequest(payload={}) {
    let overlay=document.getElementById('meetUnmuteRequest');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='meetUnmuteRequest';
      overlay.className='meet-unmute-request';
      overlay.hidden=true;
      overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="meetUnmuteTitle">
        <div class="meet-unmute-icon">${ICONS.mic}</div>
        <div class="meet-unmute-copy"><strong id="meetUnmuteTitle">The host is asking you to unmute</strong><span>You stay in control of your microphone.</span></div>
        <div class="meet-unmute-actions"><button type="button" data-unmute-decline>Stay muted</button><button type="button" class="primary-action" data-unmute-accept>Unmute</button></div>
      </section>`;
      document.body.append(overlay);
      overlay.addEventListener('click',async event=>{
        if(event.target.closest('[data-unmute-decline]')){await engine.respondToModeration?.(state.activeUnmuteRequest||{},false);state.activeUnmuteRequest=null;overlay.hidden=true;return;}
        if(event.target.closest('[data-unmute-accept]')){
          state.audio=true;
          state.stream?.getAudioTracks?.().forEach(track=>track.enabled=true);
          engine.toggleAudio(true);
          playTone('unmute');
          setButtonState(ids.micBtn,true,'mic','mic-off','Mute','Unmute');
          ids.selfMicState.innerHTML=ICONS.mic;
          renderParticipants();
          await engine.respondToModeration?.(state.activeUnmuteRequest||{},true);
          state.activeUnmuteRequest=null;
          overlay.hidden=true;
        }
      });
    }
    state.activeUnmuteRequest={...payload,action:'request-unmute'};
    const title=overlay.querySelector('#meetUnmuteTitle');
    if(title)title.textContent=`${payload.displayName||'The host'} is asking you to unmute`;
    overlay.hidden=false;
    overlay.querySelector('[data-unmute-accept]')?.focus();
  }

  engine.on('local-media-state',payload=>{
    if(typeof payload?.audio==='boolean'){
      state.audio=payload.audio;
      setButtonState(ids.micBtn,state.audio,'mic','mic-off','Mute','Unmute');
      ids.selfMicState.innerHTML=ICONS[state.audio?'mic':'mic-off'];
      if(!state.audio)setSpeakingVisual('self',false,0);
    }
    state.video=payload?.video!==false;
    if(payload?.stream&&payload.stream!==state.stream)setStream(payload.stream);
    updateLocalStage();
    ensureLocalDockTile();
    renderParticipants();
  });
  engine.on('local-stream',payload=>{
    if(payload?.stream&&payload.stream!==state.stream){setStream(payload.stream);startLocalSpeakingMonitor(payload.stream);}
    updateLocalStage();
    ensureLocalDockTile();
  });
  engine.on('connected',()=>{
    ids.connectionState.hidden=false;
    ids.connectionState.textContent=state.isHost?'Host':'Connecting…';
    ids.connectionState.classList.toggle('host-state',state.isHost);
    if(state.isHost){setTimeout(()=>ids.connectionState.hidden=true,1600);engine.updateSecurity?.(securityPayload());}
  });
  engine.on('admitted',async()=>{ try{await ensureMeetingMedia();}catch(error){toast(error.message||'Camera and microphone unavailable',{force:true,type:'error'});} setWaitingGate(false); playTone('admitted'); ids.connectionState.textContent='Connected'; setTimeout(()=>ids.connectionState.hidden=true,900); await engine.ready(); });
  engine.on('admission-confirmed',payload=>{
    const id=payload.participantId||payload.from;
    const pending=state.pendingAdmissions.get(id);if(pending)clearTimeout(pending);state.pendingAdmissions.delete(id);
    state.waiting.delete(id);
    ids.toastLayer.querySelector(`[data-join-request="${CSS.escape(id)}"]`)?.remove();
    renderParticipants();
  });
  engine.on('join-request',payload=>{
    if(!state.isHost && state.role!=='cohost')return;
    removeRemote(payload.from,{departed:false});
    state.participants.delete(payload.from);
    if(state.security.locked){engine.deny(payload.from).catch(()=>{});toast(`${payload.displayName||'A participant'} could not join because the meeting is locked`);return;}
    if (state.waitingRoomEnabled) {
      state.waiting.set(payload.from,payload);
      renderParticipants();
      playTone('waiting');
      showJoinRequest(payload);
    } else {
      state.waiting.delete(payload.from);
      engine.admit(payload.from).then(()=>{renderParticipants();});
    }
  });
  engine.on('remote-stream',addRemote);
  engine.on('participant-left',({participantId})=>{const p=state.participants.get(participantId);removeRemote(participantId,{departed:true});playTone('leave');toast(`${p?.displayName||'A participant'} left the meeting`);});
  engine.on('participant-joined',payload=>{
    reviveUiParticipant(payload.from);
    const pendingAdmission=state.pendingAdmissions.get(payload.from);if(pendingAdmission)clearTimeout(pendingAdmission);state.pendingAdmissions.delete(payload.from);
    const presence=state.presenceMembers.get(payload.from);
    if(state.waitingRoomEnabled && presence && !presence.admitted){state.waiting.set(payload.from,{...presence,...payload});removeRemote(payload.from,{departed:false});renderParticipants();return;}
    const wasWaiting=state.waiting.delete(payload.from);
    ids.toastLayer.querySelector(`[data-join-request="${CSS.escape(payload.from)}"]`)?.remove();
    const p=state.participants.get(payload.from)||{};
    state.participants.set(payload.from,{...p,...payload,...payload.meta,avatarUrl:payload.avatarUrl||payload.meta?.avatarUrl||p.avatarUrl||''});
    renderParticipants();
    playTone('join');toast(`${payload.displayName||payload.meta?.displayName||'Guest'} joined the meeting`);
  });
  engine.on('presence',({members})=>{
    const incoming = new Map((members||[]).filter(member=>member?.participantId && !uiParticipantIsDeparted(member.participantId)).map(member=>[member.participantId,member]));
    state.presenceMembers = incoming;
    let hostPresent = state.isHost;
    for (const [id,member] of incoming) {
      hostPresent = hostPresent || member.isHost || member.role==='host';
      if(member.isHost || member.role==='host')state.lastHostSeenAt=Date.now();
      const existing = state.participants.get(id) || {};
      if (member.admitted) {
        const pendingAdmission=state.pendingAdmissions.get(id);
        if(pendingAdmission)clearTimeout(pendingAdmission);
        state.pendingAdmissions.delete(id);
        state.waiting.delete(id);
        ids.toastLayer.querySelector(`[data-join-request="${CSS.escape(id)}"]`)?.remove();
        const merged={...existing,...member};
        state.participants.set(id,merged);
        const tile=ensureTile(id,merged),video=tile.querySelector('video'),fallback=tile.querySelector('.remote-fallback');
        const live=merged.video!==false && hasLiveVideo(merged.stream);
        tile.classList.toggle('camera-off',!live); video.hidden=!live; if(fallback)fallback.hidden=live;
      } else {
        // Presence snapshots can briefly carry an older, unadmitted record
        // during reconnect. Never let that stale snapshot remove a participant
        // whose engine session is already active. A targeted waiting-room event
        // or the engine's authoritative participant-left event owns removal.
        if((state.isHost||state.role==='cohost') && state.waitingRoomEnabled){
          removeRemote(id,{departed:false});
          state.waiting.set(id,{...existing,...member,from:id});
        }
      }
    }
    if(hostPresent)cancelAbsentHostAlert();
    // The meeting engine is the single departure authority. It combines an
    // explicit leave signal, peer state, presence and heartbeat grace before it
    // emits participant-left. The UI must not run a second removal clock.
    if (!state.isHost && !hostPresent && Date.now()-(state.lastHostSeenAt||0)>8000) { ids.connectionState.hidden=false; ids.connectionState.textContent='Reconnecting to host…'; }
    else if (!state.isHost && hostPresent && !engine.snapshot().admitted) {
      if (state.securityKnown && !state.waitingRoomEnabled) {
        engine.activateWithoutWaitingRoom?.().catch(()=>{});
        ids.connectionState.textContent='Connecting…';
      } else {
        ids.connectionState.hidden=false;
        ids.connectionState.textContent=state.securityKnown?'Waiting for host to admit':'Confirming meeting security…';
      }
    } else if (hostPresent) {
      ids.connectionState.hidden=true;
    }
    renderParticipants();
    updateFilmstripVisibility();
  });
  engine.on('moved-to-waiting',()=>{
    stopPreviewMediaForWaiting();
    setWaitingGate(true,'Waiting for the host to admit you');
    state.mediaBindings.forEach((_,participantId)=>cleanupMediaBinding(participantId));
    state.participants.clear();
    ids.filmstripTrack.querySelectorAll('video').forEach(video=>{video.srcObject=null;});
    ids.filmstripTrack.innerHTML='';
    updateFilmstripVisibility();
    renderParticipants();
  });
  engine.on('security-state',payload=>{ if(payload?.settings){state.securityKnown=true;applySecuritySettings(payload.settings);if(!state.waitingRoomEnabled&&!state.isHost&&!engine.snapshot().admitted){engine.activateWithoutWaitingRoom?.().then(async()=>{setWaitingGate(false);try{await ensureMeetingMedia();await engine.ready?.();}catch(error){toast(error.message||'Camera and microphone unavailable',{force:true,type:'error'});}}).catch(()=>{});}else if(state.waitingRoomEnabled&&!state.isHost&&!engine.snapshot().admitted){stopPreviewMediaForWaiting();setWaitingGate(true,'Waiting for the host to admit you');}} });
  engine.on('unmute-request',payload=>{playTone('waiting');showUnmuteRequest(payload);});
  function showCameraRequest(payload={}) {
    let overlay=document.getElementById('meetCameraRequest');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='meetCameraRequest';
      overlay.className='meet-unmute-request';
      overlay.hidden=true;
      overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="meetCameraRequestTitle">
        <div class="meet-unmute-icon">${ICONS.video}</div>
        <div class="meet-unmute-copy"><strong id="meetCameraRequestTitle">The host is asking you to start video</strong><span>Your camera stays off until you approve.</span></div>
        <div class="meet-unmute-actions"><button type="button" data-camera-decline>Not now</button><button type="button" class="primary-action" data-camera-accept>Start video</button></div>
      </section>`;
      document.body.append(overlay);
      overlay.addEventListener('click',async event=>{
        if(event.target.closest('[data-camera-decline]')){await engine.respondToModeration?.(state.activeCameraRequest||{},false);state.activeCameraRequest=null;overlay.hidden=true;return;}
        if(event.target.closest('[data-camera-accept]')){
          try{
            state.video=true;
            if(!state.stream)await ensureMeetingMedia();
            await engine.toggleVideo(true);
            const latest=engine.snapshot?.();
            if(latest?.mediaState?.video===false)throw new Error('Camera could not be started');
            setButtonState(ids.camBtn,true,'video','video-off','Stop Video','Start Video');
            updateLocalStage();
            renderParticipants();
            await engine.respondToModeration?.(state.activeCameraRequest||{},true);
            state.activeCameraRequest=null;
            overlay.hidden=true;
          }catch(error){toast(error.message||'Camera unavailable',{force:true,type:'error'});}
        }
      });
    }
    state.activeCameraRequest={...payload,action:'request-camera'};
    const title=overlay.querySelector('#meetCameraRequestTitle');
    if(title)title.textContent=`${payload.displayName||'The host'} is asking you to start video`;
    overlay.hidden=false;
    overlay.querySelector('[data-camera-accept]')?.focus();
  }

  async function requestAdmissionConfirmation(participantId){
    if(!participantId||state.pendingAdmissions.has(participantId))return;
    playTone('admitted');
    try{
      await engine.admit(participantId);
      const timer=setTimeout(()=>{
        state.pendingAdmissions.delete(participantId);
        renderParticipants();
        toast('Admission was not confirmed. The participant remains in the waiting room.',{type:'error',force:true});
      },22000);
      state.pendingAdmissions.set(participantId,timer);
      renderParticipants();
    }catch(error){
      state.pendingAdmissions.delete(participantId);
      renderParticipants();
      toast(error.message||'Could not admit this participant',{type:'error',force:true});
    }
  }

  function clearPendingAdmission(participantId){
    const timer=state.pendingAdmissions.get(participantId);
    if(timer)clearTimeout(timer);
    state.pendingAdmissions.delete(participantId);
  }
  engine.on('camera-request',payload=>{playTone('waiting');showCameraRequest(payload);});
  engine.on('moderation-ack',payload=>{
    const pending=state.pendingModeration.get(payload?.requestId);
    if(!pending)return;
    pending.delivered=true;
    const button=document.querySelector(`[data-pending-request="${CSS.escape(payload.requestId)}"]`);
    if(button){button.textContent='Requested';button.disabled=true;}
  });
  engine.on('moderation-response',payload=>{
    const pending=state.pendingModeration.get(payload?.requestId);
    if(!pending)return;
    state.pendingModeration.delete(payload.requestId);
    renderParticipants();
    const message=payload.accepted
      ? (payload.action==='request-camera'?'Participant started video':'Participant unmuted')
      : (payload.action==='request-camera'?'Video request declined':'Unmute request declined');
    toast(message,{type:payload.accepted?'success':'info',duration:1600,force:true});
  });
  engine.on('moderation-timeout',payload=>{
    if(!state.pendingModeration.has(payload?.requestId))return;
    state.pendingModeration.delete(payload.requestId);
    renderParticipants();
    toast('The participant did not receive the request. Try again.',{type:'error',duration:2200,force:true});
  });

  engine.on('state-heartbeat',payload=>{
    if(!payload?.from || uiParticipantIsDeparted(payload.from))return;
    state.lastHeartbeatByParticipant.set(payload.from,Date.now());
    const existing=state.participants.get(payload.from)||{};
    const merged={...existing,...payload.meta,audio:payload.audio!==false,video:payload.video!==false,screenSharing:Boolean(payload.screenSharing),displayName:payload.displayName||existing.displayName||'Guest'};
    state.presenceMembers.set(payload.from,merged);
    if(merged.admitted!==true){
      if((state.isHost||state.role==='cohost')&&state.waitingRoomEnabled){removeRemote(payload.from,{departed:false});state.waiting.set(payload.from,{...merged,from:payload.from});renderParticipants();}
      return;
    }
    const changed=!existing.displayName || existing.audio!==merged.audio || existing.video!==merged.video || existing.screenSharing!==merged.screenSharing || existing.role!==merged.role || existing.avatarUrl!==merged.avatarUrl;
    state.participants.set(payload.from,merged);
    if(changed){
      ensureTile(payload.from,merged);
      renderParticipants();
      updateFilmstripVisibility();
    }
  });

  engine.on('media-state',payload=>{
    if(!payload?.from || uiParticipantIsDeparted(payload.from))return;
    const p=state.participants.get(payload.from)||{};
    const updated={...p,audio:payload.audio,video:payload.video,displayName:payload.displayName||p.displayName};
    clearParticipantControl(payload.from,'audio');
    clearParticipantControl(payload.from,'video');
    state.participants.set(payload.from,updated);
    // A mute is authoritative. Clear an old audio-level broadcast immediately
    // so a muted participant cannot retain the green ring or main-speaker claim.
    if(payload.audio===false)setSpeakingVisual(payload.from,false,0);
    const tile=ensureTile(payload.from,updated);
    if(updated.stream)bindRemoteTileMedia(payload.from,tile,updated.stream); else refreshRemoteTile(payload.from,tile,updated.stream);
    if(state.activeSpeakerId===payload.from&&!state.sharing){
      if(updated.video===false)showStageFallback(updated); else setMainSpeaker(payload.from);
    }
    renderParticipants();
  });
  engine.on('screen-stream',({stream})=>{
    state.sharing=true;
    state.sharingParticipantId='self';
    if(window.dominionDesktop?.isDesktop){
      window.dominionDesktop.showPresenterToolbar?.();
      startNativePresenterDockFeed();
      ids.stageVideo.srcObject=null;
      ids.stageVideo.hidden=true;
      ids.stageFallback.hidden=false;
      ids.stageName.textContent='You are sharing your screen';
    }else{
      bindStableVideo(ids.stageVideo,stream,{muted:true,mirror:false,play:true});
      ids.stageFallback.hidden=true;
      ids.stageVideo.hidden=false;
    }
    ids.shareBtn.classList.add('active-share');
    ids.shareBtn.querySelector('.tool-label').textContent='Stop Share';
    setPresentationMode(true, ids.selfName.textContent || 'You');
    if(window.dominionDesktop?.isDesktop)ids.shareStatusBar.hidden=true;
    updateFilmstripVisibility();
  });
  engine.on('remote-screen-stream',({participantId,stream})=>{
    const participant=state.participants.get(participantId)||{};
    participant.screenStream=stream;
    state.participants.set(participantId,participant);
    if(state.sharingParticipantId===participantId && hasLiveVideo(stream)){
      clearTimeout(state.screenRecoveryTimers.get(participantId));
      state.screenRecoveryTimers.delete(participantId);
      showSharedStage(participantId);
    }
  });
  engine.on('speaking-state',payload=>{
    if(!payload?.participantId)return;
    setSpeakingVisual(payload.participantId,payload.active,payload.level);
  });
  engine.on('screen-state',payload=>{
    if (!payload?.participantId || payload.participantId===engine.snapshot().participantId) return;
    if (payload.active) {
      state.sharing=true;
      state.sharingParticipantId=payload.participantId;
      state.sharePaused=Boolean(payload.paused);
      const participant=state.participants.get(payload.participantId)||{displayName:payload.displayName||'Participant'};
      state.participants.set(payload.participantId,participant);
      setPresentationMode(true,participant.displayName);
      if(participant.screenStream && hasLiveVideo(participant.screenStream))showSharedStage(payload.participantId);
      else {
        ids.stageVideo.srcObject=null;ids.stageFallback.hidden=false;ids.stageName.textContent=`${participant.displayName||'Participant'} is starting screen share…`;
        clearTimeout(state.screenRecoveryTimers.get(payload.participantId));
        state.screenRecoveryTimers.set(payload.participantId,setTimeout(()=>engine.requestMediaResync?.(payload.participantId).catch(()=>{}),4000));
      }
      updateFilmstripVisibility();
    } else if (state.sharingParticipantId===payload.participantId) {
      endPresentationMode();
    }
  });
  engine.on('screen-ended',()=>{
    stopNativePresenterDockFeed();
    window.dominionDesktop?.hidePresenterToolbar?.();
    ids.shareBtn.classList.remove('active-share');
    ids.shareBtn.querySelector('.tool-label').textContent='Share Screen';
    endPresentationMode();
  });
  engine.on('chat',payload=>{
    const person=state.participants.get(payload.from)||{};
    appendChatMessage({displayName:payload.displayName||person.displayName||'Guest',message:payload.message,avatarUrl:person.avatarUrl||'',privateText:payload.to&&payload.to!=='everyone'?'Private to you':'',timestamp:payload.sentAt||Date.now()});
    if (ids.chatPanel.hidden) { state.unread++; ids.chatBadge.textContent=state.unread; ids.chatBadge.hidden=false; playTone('chat'); showChatPreview(payload); }
  });
  engine.on('spotlight',payload=>{
    const participantId=payload?.participantId||'';
    state.spotlightParticipantId=participantId||null;
    ids.filmstripTrack?.querySelectorAll('.remote-tile').forEach(node=>node.classList.toggle('is-spotlighted',node.dataset.tile===participantId));
    if(!participantId){electActiveSpeaker(true);toast('Spotlight removed; active speaker view restored',{force:true});return;}
    if(participantId==='self')setLocalMainSpeaker();else if(state.participants.has(participantId))setMainSpeaker(participantId);
    toast(`${state.participants.get(participantId)?.displayName||'Participant'} was spotlighted for everyone`,{force:true});
  });
  engine.on('reaction',payload=>{
    if(payload.symbol==='raise-hand'||payload.symbol==='lower-hand'){
      const raised=payload.symbol==='raise-hand';const p=state.participants.get(payload.from)||{};p.handRaised=raised;p.handRaisedAt=raised?Number(payload.sentAt||Date.now()):0;state.participants.set(payload.from,p);syncRaisedHandVisual(payload.from,raised);renderParticipants();return;
    }
    showReaction(payload.symbol,payload.from,payload.displayName);
  });
  engine.on('meeting-ended',async()=>{
    stopViewReconciler();
    state.speakingMonitor?.stop?.();
    stopMeetingTimer();
    ids.leaveDialog?.close?.();
    ids.connectionState.hidden=false;
    ids.connectionState.textContent='Meeting ended by host';
    ids.connectionState.classList.remove('host-state');
    toast('Meeting ended','The host ended this meeting for everyone.');
    try { await engine.leave({silent:true}); } catch (_) {}
    setTimeout(()=>location.replace(leaveDestination()),900);
  });
  engine.on('role-change',({role,participantId,from})=>{
    const selfId=engine.snapshot().participantId;
    if(participantId===selfId){
      state.role=role;state.isHost=role==='host';ids.endAllBtn.hidden=!state.isHost;ids.moreBtn.hidden=false;if(ids.hostToolsBtn)ids.hostToolsBtn.hidden=!(state.isHost||state.role==='cohost');
      ids.connectionState.hidden=false;ids.connectionState.textContent=role==='host'?'Host':role==='cohost'?'Co-host':'Connected';
      ids.connectionState.classList.toggle('host-state',state.isHost);
      if(state.isHost)setTimeout(()=>ids.connectionState.hidden=true,1400);
    }else if(participantId){
      const target=state.participants.get(participantId)||{};
      state.participants.set(participantId,{...target,role,isHost:role==='host'});
      if(role==='host'&&from&&from!==participantId){const former=state.participants.get(from)||{};state.participants.set(from,{...former,role:'attendee',isHost:false});}
    }
    updateFilmstripVisibility();renderParticipants();
  });

  async function updateProfilePhotoPreview(url){
    if(!ids.profilePhotoPreview)return;
    ids.profilePhotoPreview.innerHTML=url?`<img src="${escapeHtml(url)}" alt="Profile picture">`:`<span>${escapeHtml(initials(state.profile?.displayName||ids.displayName?.value||'DS'))}</span>`;
  }

  async function uploadProfilePhoto(file){
    if(!file)return;
    if(file.size>5*1024*1024){toast('Profile picture must be smaller than 5 MB',{force:true,type:'error'});return;}
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){toast('Choose a PNG, JPEG, or WebP image',{force:true,type:'error'});return;}
    const reader=new FileReader();
    const localUrl=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(file);});
    let avatarUrl=localUrl;
    if(state.client&&state.session?.user){
      try{
        const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
        const path=`${state.session.user.id}/profile-${Date.now()}.${ext}`;
        const uploaded=await state.client.storage.from('member-avatars').upload(path,file,{upsert:true,contentType:file.type});
        if(!uploaded.error){
          await state.client.from('member_profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',state.session.user.id);
          const signed=await state.client.storage.from('member-avatars').createSignedUrl(path,60*60*24*30);
          avatarUrl=signed?.data?.signedUrl||localUrl;
        }
      }catch(_){/* local fallback remains available */}
    }
    if(state.session?.user?.id)localStorage.setItem(`ds_meet_avatar_url:${state.session.user.id}`,avatarUrl);
    state.profile={...(state.profile||{}),avatarUrl};
    updateProfilePhotoPreview(avatarUrl);
    engine.updateIdentity?.({avatarUrl});
    renderParticipants();
    updateLocalStage();
  }

  ids.profilePhotoInput?.addEventListener('change',event=>uploadProfilePhoto(event.target.files?.[0]));
  updateProfilePhotoPreview(state.profile?.avatarUrl||'');

  ids.joinForm.addEventListener('submit',join);
  ids.preMic.onclick=()=>{ state.audio=!state.audio; playTone(state.audio?'unmute':'mute'); ids.preMic.classList.toggle('active',state.audio); ids.preMic.querySelector('[data-icon]').innerHTML=ICONS[state.audio?'mic':'mic-off']; state.stream?.getAudioTracks().forEach(t=>t.enabled=state.audio); };
  ids.preCam.onclick=async()=>{
    const target=!state.video;
    state.video=target;
    ids.preCam.disabled=true;
    try{
      if(!target){
        state.stream?.getVideoTracks?.().forEach(track=>{try{state.stream.removeTrack(track);}catch(_){};if(track.readyState!=='ended')track.stop();});
      }else if(!hasLiveVideo(state.stream)){
        const fresh=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
        const track=fresh.getVideoTracks()[0];
        if(!track)throw new Error('No camera was available.');
        if(!state.stream)state.stream=new MediaStream();
        state.stream.addTrack(track);
      }
      bindStableVideo(ids.prejoinVideo,state.stream,{muted:true,mirror:true,play:true});
      ids.prejoinFallback.hidden=!(state.video&&hasLiveVideo(state.stream));
    }catch(error){state.video=false;toast(error.message||'Camera unavailable');}
    finally{
      ids.preCam.classList.toggle('active',state.video);
      ids.preCam.querySelector('[data-icon]').innerHTML=ICONS[state.video?'video':'video-off'];
      ids.preCam.disabled=false;
    }
  };
  ids.preSettings.onclick=()=>ids.settingsDialog.showModal();
  ids.micBtn.onclick=()=>{
    if(!state.audio&&!state.isHost&&state.role!=='cohost'&&!state.security.allowUnmute){toast('The host disabled participant unmuting');return;}
    const target=!state.audio;
    if(target)resumeSpeakingMeters();
    state.audio=target;
    if(!target){setSpeakingVisual('self',false,0);engine.setSpeaking?.(false,0);}
    playTone(target?'unmute':'mute');
    setButtonState(ids.micBtn,target,'mic','mic-off','Mute','Unmute');
    ids.selfMicState.innerHTML=ICONS[target?'mic':'mic-off'];renderParticipants();
    Promise.resolve(engine.toggleAudio(target)).then(actual=>{
      state.audio=Boolean(actual);
      setButtonState(ids.micBtn,state.audio,'mic','mic-off','Mute','Unmute');
      ids.selfMicState.innerHTML=ICONS[state.audio?'mic':'mic-off'];renderParticipants();
    }).catch(error=>{
      state.audio=Boolean(engine.snapshot?.().mediaState?.audio);
      toast(error.message||'Microphone unavailable',{force:true,type:'error'});
    });
  };
  ids.camBtn.onclick=()=>{
    if(!state.video&&!state.isHost&&state.role!=='cohost'&&!state.security.allowVideo){toast('The host disabled participant video',{force:true});return;}
    const target=!state.video;
    // Every click updates intent immediately. The meeting engine sequences camera
    // acquisition and discards superseded work, so rapid off/on/off interaction
    // remains responsive without ignoring a user's latest choice.
    state.video=target;
    setButtonState(ids.camBtn,target,'video','video-off','Stop Video','Start Video');
    updateLocalStage();ensureLocalDockTile();renderParticipants();
    playTone(target?'cameraOn':'cameraOff');
    Promise.resolve(engine.toggleVideo(target)).then(actual=>{
      // A newer user click may already have superseded this operation.
      if(state.video!==target)return;
      const resolved=Boolean(actual);
      if(resolved!==target){state.video=resolved;setButtonState(ids.camBtn,resolved,'video','video-off','Stop Video','Start Video');updateLocalStage();ensureLocalDockTile();renderParticipants();}
    }).catch(error=>{
      if(state.video!==target)return;
      const actual=Boolean(engine.snapshot?.().mediaState?.video);
      state.video=actual;
      setButtonState(ids.camBtn,actual,'video','video-off','Stop Video','Start Video');
      updateLocalStage();ensureLocalDockTile();renderParticipants();
      toast(error?.message||'Camera could not be started',{force:true,type:'error'});
    });
  };
  ids.micMenuBtn.onclick=e=>buildDeviceMenu('audio',e.currentTarget);
  ids.camMenuBtn.onclick=e=>buildDeviceMenu('video',e.currentTarget);
  ids.participantsBtn.onclick=()=>openPanel(ids.participantsPanel);
  $('waitingHeader')?.addEventListener('click',()=>{
    const collapsed=$('waitingSection')?.classList.toggle('is-collapsed');
    $('waitingHeader')?.setAttribute('aria-expanded',String(!collapsed));
  });
  ids.chatBtn.onclick=()=>{if(!state.isHost&&state.role!=='cohost'&&!state.security.allowChat){toast('The host disabled participant chat');return;}openPanel(ids.chatPanel);};
  ids.shareBtn.onclick=async()=>{ if(!state.isHost&&state.role!=='cohost'&&!state.security.allowShare){toast('Only the host can share right now');return;} try { if(state.sharingParticipantId==='self'){ await engine.stopScreenShare(); playTone('shareStop'); } else { await engine.shareScreen(); playTone('shareStart'); } } catch(error) { toast(error.message || 'Screen sharing failed'); } };
  $('shareMicBtn').onclick=()=>ids.micBtn.click();
  $('shareCamBtn').onclick=()=>ids.camBtn.click();
  $('shareParticipantsBtn').onclick=()=>ids.participantsBtn.click();
  $('shareChatBtn').onclick=()=>ids.chatBtn.click();
  $('shareReactionBtn').onclick=()=>ids.reactionBtn.click();
  $('shareTopBtn').onclick=()=>ids.shareBtn.click();
  $('shareMoreBtn').onclick=()=>showGeneralMoreMenu($('shareMoreBtn'));
  ids.reactionBtn.onclick=e=>{
    const {add}=positionUtilityMenu(e.currentTarget,'Reactions',{grid:true});
    ['👍','👏','❤️','😂','🎉','🤔','👎'].forEach(symbol=>add(`${symbol}  React`,async()=>{
      await engine.reaction?.(symbol);
      showReaction(symbol,'self',ids.selfName.textContent||'You');
    }));
    add(`${state.handRaised?'✋  Lower hand':'✋  Raise hand'}`,toggleRaisedHand);
    ids.deviceMenu.hidden=false;state.activeMenu='reactions';
  };
  ids.raiseHandBtn.onclick=toggleRaisedHand;

  function showReaction(symbol,participantId,displayName){
    const uiId=participantId===engine.snapshot().participantId?'self':participantId;
    const tile=ids.filmstripTrack.querySelector(`[data-tile="${CSS.escape(uiId)}"]`);
    if(tile){
      let badge=tile.querySelector('.tile-reaction');
      if(!badge){badge=document.createElement('span');badge.className='tile-reaction';tile.append(badge);}
      badge.textContent=symbol;
      clearTimeout(badge.__timer);
      badge.__timer=setTimeout(()=>badge.remove(),4200);
    }
    if(ids.reactionLayer){
      const item=document.createElement('div');
      item.className='floating-reaction';
      item.style.setProperty('--reaction-x',`${7+Math.random()*24}%`);
      item.style.setProperty('--reaction-drift',`${-45+Math.random()*90}px`);
      item.style.setProperty('--reaction-delay',`${Math.random()*.12}s`);
      item.innerHTML=`<span class="floating-reaction-symbol">${escapeHtml(symbol)}</span><span class="floating-reaction-name">${escapeHtml(displayName||'Participant')}</span>`;
      ids.reactionLayer.append(item);
      item.addEventListener('animationend',()=>item.remove(),{once:true});
      setTimeout(()=>item.remove(),5200);

      // Desktop presentation enhancement: applause gets a short celebratory
      // cluster like a live audience response. It is intentionally visual-only
      // and never touches reaction signaling or media state.
      if(symbol==='👏'&&window.dominionDesktop?.isDesktop&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        const existing=ids.reactionLayer.querySelectorAll('.reaction-burst-particle').length;
        const count=Math.max(0,Math.min(10,28-existing));
        for(let index=0;index<count;index+=1){
          const particle=document.createElement('span');
          particle.className='reaction-burst-particle';
          particle.textContent=symbol;
          particle.style.setProperty('--burst-x',`${3+Math.random()*38}%`);
          particle.style.setProperty('--burst-drift',`${-70+Math.random()*140}px`);
          particle.style.setProperty('--burst-delay',`${index*.045+Math.random()*.1}s`);
          particle.style.setProperty('--burst-scale',`${.68+Math.random()*.6}`);
          ids.reactionLayer.append(particle);
          particle.addEventListener('animationend',()=>particle.remove(),{once:true});
          setTimeout(()=>particle.remove(),4200);
        }
      }
    }
  }

  async function persistWaitingRoom(enabled){
    state.waitingRoomEnabled=Boolean(enabled);
    ids.deviceMenu.querySelectorAll('.toggle-option').forEach(el=>{const label=el.querySelector('span')?.textContent.trim();if(label==='Enable Waiting Room'||label==='Waiting Room')el.setAttribute('aria-checked',String(state.waitingRoomEnabled));});
    await engine.updateSecurity?.(securityPayload());
    if(state.client&&state.session?.user&&engine.snapshot().roomId){
      try{await state.client.from('meet_rooms').update({waiting_room_enabled:state.waitingRoomEnabled,updated_at:new Date().toISOString()}).eq('room_id',engine.snapshot().roomId).eq('owner_id',state.session.user.id);}catch(_){}
    }
    renderParticipants();
  }

  async function persistSecuritySetting(key,value){
    state.security[key]=Boolean(value);
    const targetLabel=({locked:'Lock Meeting',allowShare:'Share screen',allowChat:'Chat',allowRename:'Rename themselves',allowUnmute:'Unmute themselves',allowVideo:'Start video',muteOnEntry:'Mute on entry'}[key]||key);
    ids.deviceMenu.querySelectorAll('.toggle-option').forEach(el=>{if(el.textContent.trim().startsWith(targetLabel))el.setAttribute('aria-checked',String(state.security[key]));});
    await engine.updateSecurity?.(securityPayload());
    applySecuritySettings(state.security);
    // State is reflected directly by the animated switch, matching native meeting controls.
  }

  function positionUtilityMenu(anchor,title,options={}){
    const rect=anchor.getBoundingClientRect();
    ids.deviceMenu.style.left=`${Math.max(10,Math.min(innerWidth-368,rect.left-250))}px`;
    ids.deviceMenu.style.bottom='auto';
    ids.deviceMenu.style.top=`${Math.max(54,Math.min(innerHeight-640,rect.top-470))}px`;
    ids.deviceMenu.classList.toggle('utility-grid-menu',Boolean(options.grid));
    ids.deviceMenu.innerHTML='';
    const header=document.createElement('div');
    header.className='utility-menu-header';
    if(options.back){
      const back=document.createElement('button');
      back.type='button';back.className='utility-back';back.setAttribute('aria-label','Back');back.innerHTML='‹';
      back.onclick=e=>{e.stopPropagation();options.back();};
      header.append(back);
    }
    const heading=document.createElement('strong');heading.className='menu-title';heading.textContent=title;header.append(heading);
    ids.deviceMenu.append(header);
    const body=document.createElement('div');body.className=options.grid?'utility-grid':'utility-menu-body';ids.deviceMenu.append(body);
    const section=label=>{
      const el=document.createElement('div');el.className='device-menu-section';el.textContent=label;body.append(el);
    };
    const add=(label,action,itemOptions={})=>{
      const b=document.createElement('button');b.type='button';b.className='device-menu-item';
      if(itemOptions.danger)b.classList.add('danger-option');
      if(itemOptions.disabled){b.disabled=true;b.classList.add('disabled-option');}
      if(itemOptions.icon)b.dataset.utilityIcon=itemOptions.icon;
      if(itemOptions.checked!==undefined){
        b.classList.add('toggle-option');b.setAttribute('aria-checked',String(Boolean(itemOptions.checked)));b.setAttribute('role','menuitemcheckbox');
        b.innerHTML=`<span>${escapeHtml(label)}</span><span class="menu-switch" aria-hidden="true"><i></i></span>`;
      }else if(itemOptions.next){
        b.innerHTML=`<span>${escapeHtml(label)}</span><span class="utility-next" aria-hidden="true">›</span>`;b.setAttribute('role','menuitem');
      }else{
        b.innerHTML=`${itemOptions.icon?`<span class="utility-card-icon" data-icon="${escapeHtml(itemOptions.icon)}"></span>`:''}<span>${escapeHtml(label)}</span>${itemOptions.note?`<small>${escapeHtml(itemOptions.note)}</small>`:''}`;
        b.setAttribute('role','menuitem');
      }
      b.onclick=async e=>{e.stopPropagation();if(itemOptions.disabled)return;const previous=b.getAttribute('aria-checked');if(itemOptions.checked!==undefined)b.setAttribute('aria-checked',String(previous!=='true'));try{await action();}catch(error){if(itemOptions.checked!==undefined)b.setAttribute('aria-checked',String(previous==='true'));toast(error.message||'The setting could not be updated',{force:true,type:'error'});}if(!itemOptions.keepOpen)closeMenus();};
      const iconNode=b.querySelector('[data-icon]');if(iconNode)iconNode.innerHTML=ICONS[iconNode.dataset.icon]||ICONS.more;
      body.append(b);return b;
    };
    return {add,section,body};
  }

  function showMeetingStatistics(){
    const snap=engine.snapshot();
    const remoteCount=[...state.participants.keys()].filter(id=>id!=='self').length;
    const lines=[
      ['Meeting duration',ids.roomLabel?.textContent||'Active'],
      ['Participants',String(remoteCount+1)],
      ['Your role',state.isHost?'Host':state.role==='cohost'?'Co-host':'Participant'],
      ['Microphone',state.audio?'On':'Muted'],
      ['Camera',state.video?'On':'Off'],
      ['Screen sharing',state.sharingParticipantId? (state.sharingParticipantId==='self'?'You are sharing':'Participant sharing'):'Inactive'],
      ['Connection',snap?.admitted===false?'Waiting room':'Connected']
    ];
    const dialog=document.createElement('dialog');dialog.className='settings-dialog meet-statistics-dialog';
    dialog.innerHTML=`<header><strong>Meeting Statistics</strong><button type="button" aria-label="Close">×</button></header><div class="settings-body statistics-list">${lines.map(([a,b])=>`<div><span>${escapeHtml(a)}</span><strong>${escapeHtml(b)}</strong></div>`).join('')}</div>`;
    document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }

  function showKeyboardShortcuts(){
    const rows=[['Mute / Unmute','Alt + A'],['Start / Stop Video','Alt + V'],['Participants','Alt + U'],['Chat','Alt + H'],['Share Screen','Alt + S'],['Full Screen','Alt + F']];
    const dialog=document.createElement('dialog');dialog.className='settings-dialog';
    dialog.innerHTML=`<header><strong>Keyboard Shortcuts</strong><button type="button" aria-label="Close">×</button></header><div class="settings-body shortcut-list">${rows.map(([a,b])=>`<div><span>${escapeHtml(a)}</span><kbd>${escapeHtml(b)}</kbd></div>`).join('')}</div>`;
    document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }

  function showSystemHealth(){
    const guardian=window.DominionGuardianObserver,recovery=window.DominionGuardianRecovery,certification=window.DominionGuardianCertification,resilience=window.DominionGuardianResilience;
    const dialog=document.createElement('dialog');dialog.className='settings-dialog guardian-health-dialog';
    dialog.innerHTML='<header><div><strong>DominionStar Guardian</strong><small>Live meeting protection and recovery</small></div><button type="button" data-health-close aria-label="Close">×</button></header><div class="settings-body guardian-health-body"></div>';
    const render=()=>{const health=guardian?.health?.()||{},mh=engine.health?.()||{},rh=recovery?.health?.()||{},report=certification?.run?.({publishEvent:false})||{};const safe=health.status==='healthy'&&!mh.failedPeers&&!mh.disconnectedPeers;const alerts=(guardian?.alerts?.(5)||[]).slice().reverse();dialog.querySelector('.guardian-health-body').innerHTML=`<div class="guardian-verdict ${safe?'is-healthy':'is-warning'}"><span></span><div><strong>${safe?'Meeting protection is active':'Guardian is checking the meeting'}</strong><small>${safe?'Audio, video, connection and controls are being monitored.':'A connection or runtime condition needs attention.'}</small></div></div><div class="guardian-health-grid"><div><small>Guardian</small><strong>${escapeHtml(health.status||'unknown')}</strong></div><div><small>Connected peers</small><strong>${escapeHtml(mh.peerCount||0)}</strong></div><div><small>Recoveries</small><strong>${escapeHtml(rh.successes||0)}</strong></div><div><small>Health checks</small><strong>${escapeHtml(report.summary?.pass||0)} passed</strong></div></div><div class="guardian-actions"><button type="button" data-health-check>Run Health Check</button><button type="button" data-health-repair>Repair Connections</button><button type="button" data-health-export>Export Diagnostics</button></div><section class="guardian-alert-list"><strong>Recent activity</strong>${alerts.length?alerts.map(item=>`<p><span class="${escapeHtml(item.severity||'warning')}">${escapeHtml(item.severity||'warning')}</span>${escapeHtml(item.type||'Guardian event')}</p>`).join(''):'<p class="guardian-clear">No recent problems detected.</p>'}</section>`;dialog.querySelector('[data-health-check]').onclick=()=>{certification?.run?.();render();toast('Guardian health check completed',{force:true});};dialog.querySelector('[data-health-repair]').onclick=async()=>{const button=dialog.querySelector('[data-health-repair]');button.disabled=true;button.textContent='Repairing…';await recovery?.reconcilePresence?.('host-health-center');await recovery?.recoverDegradedPeers?.('host-health-center');render();toast('Guardian connection repair completed',{force:true});};dialog.querySelector('[data-health-export]').onclick=()=>resilience?.exportDiagnostics?.();};
    document.body.append(dialog);dialog.querySelector('[data-health-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());render();dialog.showModal();
  }

  function showGeneralMoreMenu(anchor){
    const {add}=positionUtilityMenu(anchor,'More',{grid:true});
    add('Meeting Info',async()=>{refreshInviteDialog();ids.inviteDialog?.showModal();},{icon:'info',note:'ID, link and passcode'});
    add('Settings',async()=>ids.settingsDialog.showModal(),{icon:'settings',note:'Audio, video and appearance'});
    add(document.fullscreenElement?'Exit Full Screen':'Full Screen',async()=>{if(document.fullscreenElement)await document.exitFullscreen?.();else await ids.meeting.requestFullscreen?.();},{icon:'maximize',note:'Expand the meeting'});
    add(ids.filmstrip?.hidden?'Show Dock':'Hide Dock',async()=>{if(!ids.filmstrip)return;ids.filmstrip.hidden=!ids.filmstrip.hidden;toast(ids.filmstrip.hidden?'Participant dock hidden':'Participant dock shown');},{icon:'sidebar',note:'Participant filmstrip'});
    add('Copy Invitation',async()=>{try{await navigator.clipboard.writeText(invitationText());toast('Invitation copied');}catch{toast('Copy unavailable');}},{icon:'copy',note:'Link, ID and passcode'});
    add('Shortcuts',async()=>showKeyboardShortcuts(),{icon:'command',note:'Keyboard controls'});
    add('Statistics',async()=>showMeetingStatistics(),{icon:'activity',note:'Meeting and connection state'});
    add('System Health',async()=>showSystemHealth(),{icon:'shield',note:'Guardian monitoring and recovery'});
    if(window.DominionRemoteControl?.canRequest?.())add('Request Remote Control',async()=>window.DominionRemoteControl.requestCurrent(),{icon:'share',note:'Host or co-host controls the shared screen'});
    add('Meet Home',async()=>{await Promise.race([engine.leave(),new Promise(resolve=>setTimeout(resolve,1800))]);location.href=new URLSearchParams(location.search).get('desktop')==='1'?'/meet-home/?desktop=1':'/meet-home/';},{icon:'home',note:'Leave this meeting and return home'});
    add('Participants',async()=>openPanel(ids.participantsPanel),{icon:'users',note:'Open participant list'});
    ids.deviceMenu.hidden=false;state.activeMenu='general-more';
  }

  function showParticipantManagementMenu(anchor){
    const privileged=state.isHost||state.role==='cohost';
    const {add,section}=positionUtilityMenu(anchor,privileged?'Participant Management':'Participants');
    add('Invite participants',async()=>{refreshInviteDialog();ids.inviteDialog?.showModal();});
    add('Open participant list',async()=>openPanel(ids.participantsPanel));
    if(privileged){section('Management');add('Mute all participants',async()=>engine.broadcastModeration('mute'));add('Waiting Room',async()=>persistWaitingRoom(!state.waitingRoomEnabled),{checked:state.waitingRoomEnabled});}
    ids.deviceMenu.hidden=false;state.activeMenu='participant-management';
  }

  function showHostParticipantPermissions(anchor){
    const {add,section}=positionUtilityMenu(anchor,'Participant Permissions',{back:()=>showHostToolsMenu(anchor)});
    section('Communication');
    add('Chat',async()=>persistSecuritySetting('allowChat',!state.security.allowChat),{checked:state.security.allowChat,keepOpen:true});
    add('Rename themselves',async()=>persistSecuritySetting('allowRename',!state.security.allowRename),{checked:state.security.allowRename,keepOpen:true});
    section('Audio and video');
    add('Unmute themselves',async()=>persistSecuritySetting('allowUnmute',!state.security.allowUnmute),{checked:state.security.allowUnmute,keepOpen:true});
    add('Start video',async()=>persistSecuritySetting('allowVideo',!state.security.allowVideo),{checked:state.security.allowVideo,keepOpen:true});
    add('Share screen',async()=>persistSecuritySetting('allowShare',!state.security.allowShare),{checked:state.security.allowShare,keepOpen:true});
    add('Mute on entry',async()=>persistSecuritySetting('muteOnEntry',!state.security.muteOnEntry),{checked:state.security.muteOnEntry,keepOpen:true});
    ids.deviceMenu.hidden=false;state.activeMenu='host-participants';
  }

  function showHostAdvanced(anchor){
    const {add,section}=positionUtilityMenu(anchor,'Advanced Host Controls',{back:()=>showHostToolsMenu(anchor)});
    section('Meeting controls');
    add('Manage participants',async()=>openPanel(ids.participantsPanel));
    add('Mute all participants',async()=>engine.broadcastModeration('mute'));
    add('Copy invitation',async()=>{try{await navigator.clipboard.writeText(invitationText());toast('Invitation copied');}catch{toast('Copy unavailable');}});
    add('Audio & video settings',async()=>ids.settingsDialog.showModal());
    add('Guardian system health',async()=>showSystemHealth());
    section('Emergency');
    if(state.isHost)add('End meeting for everyone',async()=>{ids.leaveDialog.close?.();ids.leaveDialog.showModal();},{danger:true});
    ids.deviceMenu.hidden=false;state.activeMenu='host-advanced';
  }

  function showHostToolsMenu(anchor){
    const privileged=state.isHost||state.role==='cohost';if(!privileged){showGeneralMoreMenu(anchor);return;}
    const {add,section}=positionUtilityMenu(anchor,'Host Tools');
    section('Security');
    add('Lock Meeting',async()=>persistSecuritySetting('locked',!state.security.locked),{checked:state.security.locked,keepOpen:true});
    add('Enable Waiting Room',async()=>persistWaitingRoom(!state.waitingRoomEnabled),{checked:state.waitingRoomEnabled,keepOpen:true});
    section('Permissions');
    add('Participants',async()=>showHostParticipantPermissions(anchor),{next:true,keepOpen:true});
    add('Advanced',async()=>showHostAdvanced(anchor),{next:true,keepOpen:true});
    ids.deviceMenu.hidden=false;state.activeMenu='host-tools';
  }

  function openToolbarUtilityMenu(event,kind='more'){
    event.preventDefault();
    event.stopPropagation();
    const anchor=event.currentTarget;
    const menuKey=kind==='host'?'host-tools':kind==='participants'?'participant-management':'general-more';
    const sameMenu=state.activeMenu===menuKey && ids.deviceMenu.dataset.anchorId===anchor.id && !ids.deviceMenu.hidden;
    if(sameMenu){ closeMenus(); anchor.setAttribute('aria-expanded','false'); return; }
    [ids.moreBtn,ids.hostToolsBtn,ids.participantMoreBtn].forEach(button=>button?.setAttribute('aria-expanded','false'));
    if(kind==='host')showHostToolsMenu(anchor);
    else if(kind==='participants')showParticipantManagementMenu(anchor);
    else showGeneralMoreMenu(anchor);
    ids.deviceMenu.dataset.anchorId=anchor.id;
    anchor.setAttribute('aria-expanded','true');
  }

  ids.moreBtn.hidden=false;
  ids.moreBtn.setAttribute('aria-haspopup','menu');
  ids.moreBtn.setAttribute('aria-expanded','false');
  ids.moreBtn.onclick=e=>openToolbarUtilityMenu(e,'more');
  if(ids.shareViewerMoreBtn){
    ids.shareViewerMoreBtn.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      const anchor=event.currentTarget;
      const {add,section}=positionUtilityMenu(anchor,'Shared Screen');
      add('View Participants',async()=>openPanel(ids.participantsPanel));
      add('Meeting Chat',async()=>openPanel(ids.chatPanel));
      if(window.DominionRemoteControl?.canRequest?.())add('Request Remote Control',async()=>window.DominionRemoteControl.requestCurrent(),{note:'Host or co-host only'});
      if((state.isHost||state.role==='cohost')&&state.sharingParticipantId&&state.sharingParticipantId!=='self'){
        section('Host controls');
        add('Stop Participant Share',async()=>engine.moderate(state.sharingParticipantId,'stop-share'),{note:'Keeps the participant in the meeting'});
      }
      ids.deviceMenu.hidden=false;state.activeMenu='shared-screen';
    };
  }
  if(ids.hostToolsBtn){
    ids.hostToolsBtn.hidden=!(state.isHost||state.role==='cohost');
    ids.hostToolsBtn.setAttribute('aria-haspopup','menu');
    ids.hostToolsBtn.setAttribute('aria-expanded','false');
    ids.hostToolsBtn.onclick=e=>openToolbarUtilityMenu(e,'host');
  }
  ids.participantMoreBtn.hidden=false;
  ids.participantMoreBtn.setAttribute('aria-haspopup','menu');
  ids.participantMoreBtn.setAttribute('aria-expanded','false');
  ids.participantMoreBtn.onclick=e=>openToolbarUtilityMenu(e,'participants');

  ids.pauseShareBtn.onclick=async()=>{
    if(state.sharingParticipantId!=='self') return;
    state.sharePaused=await engine.pauseScreenShare(!state.sharePaused);
    ids.pauseShareBtn.textContent=state.sharePaused?'Resume Share':'Pause Share';
  };
  ids.newShareBtn.onclick=async()=>{
    if(state.sharingParticipantId!=='self') return;
    try{await engine.stopScreenShare(); await engine.shareScreen();}catch(error){toast(error.message||'Could not start a new share');}
  };
  ids.stopShareBtn.onclick=()=>engine.stopScreenShare();
  ids.leaveBtn.onclick=()=>ids.leaveDialog.showModal();
  ids.leaveClose.onclick=ids.leaveCancelBtn.onclick=()=>ids.leaveDialog.close();
  const leaveDestination=()=>new URLSearchParams(location.search).get('desktop')==='1'?'/meet-home/?desktop=1':'/meet-home/';
  const leaveWithDeadline=options=>Promise.race([engine.leave(options),new Promise(resolve=>setTimeout(resolve,2600))]);
  ids.leaveOnlyBtn.onclick=async()=>{ stopMeetingTimer(); try{await leaveWithDeadline();}finally{location.replace(leaveDestination());} };
  ids.endAllBtn.onclick=async()=>{
    if(!state.isHost)return;
    ids.endAllBtn.disabled=true;
    ids.endAllBtn.textContent='Ending meeting…';
    ids.connectionState.hidden=false;
    ids.connectionState.textContent='Ending meeting for everyone…';
    stopMeetingTimer();
    try{await leaveWithDeadline({endForAll:true});}finally{location.replace(leaveDestination());}
  };
    const refreshInviteDialog=()=>{
    const room=String(ids.roomId.value||engine.snapshot().roomId||'').replace(/\s/g,'');
    const link=state.inviteLink||`${location.origin}/meet/?action=join&room=${encodeURIComponent(room)}`;
    if(ids.inviteMeetingLink)ids.inviteMeetingLink.value=link;
    if(ids.inviteMeetingId)ids.inviteMeetingId.textContent=room.replace(/(\d{3})(?=\d)/g,'$1 ').trim();
    if(ids.invitePasscode)ids.invitePasscode.textContent=state.passcode||'Not required';
    return link;
  };
  const invitationText=()=>{const link=refreshInviteDialog();return `Join my DominionStar Meet\n${link}\nMeeting ID: ${ids.inviteMeetingId?.textContent||ids.roomId.value}${state.passcode?`\nPasscode: ${state.passcode}`:''}`};
  ids.inviteBtn.onclick=()=>{refreshInviteDialog();ids.inviteDialog?.showModal();};
  ids.copyInviteBtn && (ids.copyInviteBtn.onclick=async()=>{try{await navigator.clipboard.writeText(invitationText());toast('Invitation copied');}catch{toast('Copy unavailable');}});
  ids.copyLinkBtn && (ids.copyLinkBtn.onclick=async()=>{try{await navigator.clipboard.writeText(refreshInviteDialog());toast('Meeting link copied');}catch{toast('Copy unavailable');}});
  ids.closeInviteBtn && (ids.closeInviteBtn.onclick=()=>ids.inviteDialog?.close());
  ids.muteAllBtn.onclick=()=>engine.broadcastModeration('mute');
  ids.participantMoreBtn.hidden=false;
  ids.participantSearch.oninput=renderParticipants;

  async function sendConsentRequest(participantId,action,person){
    const existing=[...state.pendingModeration.values()].find(item=>item.participantId===participantId&&item.action===action);
    if(existing)return existing.requestId;
    const requestId=await engine.moderate(participantId,action,{toUserId:person?.userId||''});
    state.pendingModeration.set(requestId,{requestId,participantId,action,delivered:false,sentAt:Date.now()});
    renderParticipants();
    return requestId;
  }

  ids.dockUp.onclick=()=>{const h=ids.filmstrip.dataset.orientation==='horizontal';ids.filmstripTrack.scrollBy(h?{left:-Math.max(180,ids.filmstripTrack.clientWidth*.72),behavior:'smooth'}:{top:-Math.max(120,ids.filmstripTrack.clientHeight*.72),behavior:'smooth'});};
  ids.dockDown.onclick=()=>{const h=ids.filmstrip.dataset.orientation==='horizontal';ids.filmstripTrack.scrollBy(h?{left:Math.max(180,ids.filmstripTrack.clientWidth*.72),behavior:'smooth'}:{top:Math.max(120,ids.filmstripTrack.clientHeight*.72),behavior:'smooth'});};
  window.addEventListener('dominionstar:dock-layout',()=>requestAnimationFrame(updateDockScrollControls));
  window.addEventListener('pagehide',()=>{stopViewReconciler();state.mediaBindings.forEach((_,participantId)=>cleanupMediaBinding(participantId));},{once:true});
  ids.filmstripTrack.addEventListener('scroll',updateDockScrollControls,{passive:true});
  window.addEventListener('resize',()=>requestAnimationFrame(updateDockScrollControls));

  ids.chatForm.onsubmit=async event=>{
    event.preventDefault();
    const message=ids.chatInput.value.trim();
    if (!message) return;
    const recipient=ids.chatRecipient.value||'everyone';
    await engine.chat(message,recipient);
    const recipientName=recipient==='everyone'?'Everyone':state.participants.get(recipient)?.displayName||'Participant';
    appendChatMessage({mine:true,displayName:ids.selfName.textContent||'You',message,avatarUrl:state.profile?.avatarUrl||'',privateText:recipient==='everyone'?'To everyone':`Private to ${recipientName}`});ids.chatInput.value='';ids.chatInput.focus();
  };

  function showParticipantMenu(participantId, anchor, isSelf=false) {
    const p = isSelf ? {displayName:ids.selfName.textContent||'You',role:state.role,audio:state.audio,video:state.video} : state.participants.get(participantId);
    if (!p) return;
    const rect=anchor.getBoundingClientRect();
    ids.deviceMenu.style.left=`${Math.max(10,Math.min(innerWidth-286,rect.left-220))}px`;
    ids.deviceMenu.style.bottom='auto';
    ids.deviceMenu.style.top=`${Math.max(58,Math.min(innerHeight-430,rect.bottom+6))}px`;
    ids.deviceMenu.innerHTML=`<strong>${escapeHtml(p.displayName||'Participant')}</strong>`;
    const add=(label,action,danger=false)=>{const b=document.createElement('button');b.textContent=label;if(danger)b.classList.add('danger-option');b.onclick=async()=>{await action();closeMenus();};ids.deviceMenu.append(b);};
    const tileId=isSelf?'self':participantId;
    const tile=ids.filmstripTrack?.querySelector(`[data-tile="${CSS.escape(tileId)}"]`);
    const pin=()=>{ids.filmstripTrack?.querySelectorAll('.remote-tile').forEach(node=>node.classList.remove('is-pinned'));tile?.classList.add('is-pinned');if(tile)ids.filmstripTrack.prepend(tile);toast('Video pinned',p.displayName||'Participant');};
    const spotlight=async()=>{const removing=state.spotlightParticipantId===(tileId==='self'?canonicalSelfId():tileId);const target=removing?'':tileId;state.spotlightParticipantId=target?(target==='self'?canonicalSelfId():target):null;ids.filmstripTrack?.querySelectorAll('.remote-tile').forEach(node=>node.classList.toggle('is-spotlighted',Boolean(target)&&node.dataset.tile===tileId));if(target&&tile)ids.filmstripTrack.prepend(tile);if(target){if(tileId==='self')setLocalMainSpeaker();else setMainSpeaker(tileId);}else electActiveSpeaker(true);await engine.spotlight?.(target);toast(target?'Spotlight applied for everyone':'Spotlight removed; active speaker view restored',{force:true});};
    const profile=()=>{const dialog=document.createElement('dialog');dialog.className='settings-dialog participant-profile-dialog';const role=p.role==='host'||p.isHost?'Host':p.role==='cohost'?'Co-host':'Participant';dialog.innerHTML=`<header><strong>Participant profile</strong><button type="button" aria-label="Close">×</button></header><div class="settings-body"><div class="profile-card-avatar">${p.avatarUrl?`<img src="${escapeHtml(p.avatarUrl)}" alt="">`:escapeHtml(initials(p.displayName||'Participant'))}</div><h2>${escapeHtml(p.displayName||'Participant')}</h2><p>${escapeHtml(role)}</p>${p.contractLevel?`<p>Contract Level: ${escapeHtml(p.contractLevel)}</p>`:''}</div>`;document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();};

    if(isSelf){
      add('Rename',async()=>{const next=prompt('Display name',ids.selfName.textContent||'You')?.trim();if(!next)return;ids.selfName.textContent=next;ids.stageName.textContent=next;await engine.updateIdentity?.({displayName:next});renderParticipants();});
      add('Pin my video',async()=>pin());
      add('Hide self view',async()=>{ids.filmstripTrack?.querySelector('[data-tile="self"]')?.setAttribute('hidden','');updateDockScrollControls();});
      add('Audio & video settings',async()=>ids.settingsDialog.showModal());
      add('View profile',async()=>profile());
    } else {
      add('Chat privately',async()=>{openPanel(ids.chatPanel);ids.chatRecipient.value=participantId;});
      add('Pin for me',async()=>pin());
      add('View profile',async()=>profile());
      if(state.isHost||state.role==='cohost'){
        const audio=p.audio!==false, video=p.video!==false;
        add(audio?'Mute':'Ask to unmute',async()=>{if(!audio)return sendConsentRequest(participantId,'request-unmute',p);beginParticipantControl(participantId,'audio');try{await engine.moderate(participantId,'mute',{toUserId:p.userId||''});}catch(error){clearParticipantControl(participantId,'audio');renderParticipants();throw error;}});
        add(video?'Stop video':'Ask to start video',async()=>{if(!video)return sendConsentRequest(participantId,'request-camera',p);beginParticipantControl(participantId,'video');try{await engine.moderate(participantId,'camera-off',{toUserId:p.userId||''});}catch(error){clearParticipantControl(participantId,'video');renderParticipants();throw error;}});
        add(state.spotlightParticipantId===participantId?'Remove spotlight':'Spotlight for everyone',async()=>spotlight());
        add('Rename',async()=>{const next=prompt('Rename participant',p.displayName||'Participant')?.trim();if(!next)return;await engine.moderate?.(participantId,'rename',{displayName:next,toUserId:p.userId||''});p.displayName=next;renderParticipants();toast('Participant renamed',{force:true});});
        if(state.isHost){
          add(p.role==='cohost'?'Remove co-host':'Make co-host',()=>engine.setRole(participantId,p.role==='cohost'?'attendee':'cohost'));
          add('Make host',async()=>{await engine.setRole(participantId,'host');await engine.setLocalRole?.('attendee');state.isHost=false;state.role='attendee';ids.endAllBtn.hidden=true;renderParticipants();});
        }
        add('Move to waiting room',async()=>{await engine.moderate(participantId,'waiting-room',{toUserId:p.userId||''});toast('Waiting-room command sent',{force:true});});
        add('Remove',()=>engine.moderate(participantId,'remove'),true);
      }
    }
    ids.participantList?.querySelectorAll('[data-participant][aria-expanded="true"]').forEach(button=>button.setAttribute('aria-expanded','false'));
    anchor.setAttribute('aria-expanded','true');
    ids.deviceMenu.setAttribute('role','menu');
    ids.deviceMenu.dataset.menuKind='participant';
    ids.deviceMenu.hidden=false;state.activeMenu='participant';
  }

  document.addEventListener('click',async event=>{
    const close=event.target.closest('[data-close]');
    if (close) $(close.dataset.close).hidden=true;
    const admit=event.target.closest('[data-admit]');
    if (admit) await requestAdmissionConfirmation(admit.dataset.admit);
    const deny=event.target.closest('[data-deny]');
    if (deny) { clearPendingAdmission(deny.dataset.deny); playTone('denied'); await engine.deny(deny.dataset.deny); state.waiting.delete(deny.dataset.deny); renderParticipants(); }
    const toastAdmit=event.target.closest('[data-toast-admit]');
    if(toastAdmit){await requestAdmissionConfirmation(toastAdmit.dataset.toastAdmit);toastAdmit.closest('.join-request-toast')?.remove();}
    const toastDeny=event.target.closest('[data-toast-deny]');
    if(toastDeny){clearPendingAdmission(toastDeny.dataset.toastDeny);playTone('denied');await engine.deny(toastDeny.dataset.toastDeny);state.waiting.delete(toastDeny.dataset.toastDeny);renderParticipants();toastDeny.closest('.join-request-toast')?.remove();}
    const quickMic=event.target.closest('[data-quick-mic]');
    if(quickMic){
      event.preventDefault();event.stopPropagation();
      const participantId=quickMic.dataset.quickMic;
      const isSelf=quickMic.dataset.self==='1'||participantId==='self';
      if(isSelf){ids.micBtn?.click();}
      else {const person=state.participants.get(participantId);if(person&&(state.isHost||state.role==='cohost')){const action=person.audio!==false?'mute':'request-unmute';if(action==='request-unmute')await sendConsentRequest(participantId,action,person);else {beginParticipantControl(participantId,'audio');try{await engine.moderate(participantId,action,{toUserId:person.userId||''});}catch(error){clearParticipantControl(participantId,'audio');renderParticipants();toast(error.message||'Could not update microphone',{type:'error',force:true});}}}}
      return;
    }
    const quickVideo=event.target.closest('[data-quick-video]');
    if(quickVideo){
      event.preventDefault();event.stopPropagation();
      const participantId=quickVideo.dataset.quickVideo;const isSelf=quickVideo.dataset.self==='1'||participantId==='self';
      if(isSelf){ids.camBtn?.click();}
      else {const person=state.participants.get(participantId);if(person&&(state.isHost||state.role==='cohost')){const action=person.video!==false?'camera-off':'request-camera';if(action==='request-camera')await sendConsentRequest(participantId,action,person);else {beginParticipantControl(participantId,'video');try{await engine.moderate(participantId,action,{toUserId:person.userId||''});}catch(error){clearParticipantControl(participantId,'video');renderParticipants();toast(error.message||'Could not update video',{type:'error',force:true});}}}}
      return;
    }
    const participant=event.target.closest('[data-participant]');
    if (participant) {event.preventDefault();event.stopPropagation();showParticipantMenu(participant.dataset.participant,participant,participant.dataset.self==='1');return;}
    if (!event.target.closest('.device-menu,#micMenuBtn,#camMenuBtn,#reactionBtn,#moreBtn,#hostToolsBtn,#participantMoreBtn')) {
      [ids.moreBtn,ids.hostToolsBtn,ids.participantMoreBtn].forEach(button=>button?.setAttribute('aria-expanded','false'));
      closeMenus();
    }
  });

  ids.cameraSelect.onchange=async()=>{await replaceMedia('video',ids.cameraSelect.value);saveAccountPreferences();};
  ids.microphoneSelect.onchange=async()=>{await replaceMedia('audio',ids.microphoneSelect.value);saveAccountPreferences();};
  ids.speakerSelect.onchange=async()=>{const sink=ids.speakerSelect.value;const media=[ids.stageVideo,ids.selfVideo,ids.prejoinVideo,...ids.filmstripTrack.querySelectorAll('video')];let supported=false;await Promise.all(media.map(async node=>{if(typeof node?.setSinkId==='function'){supported=true;await node.setSinkId(sink).catch(()=>{});}}));saveAccountPreferences();toast(supported?'Speaker output changed':'Speaker selection is not supported by this browser',{force:true,type:supported?'success':'info'});};
  ids.brightnessRange.oninput=()=>{applyEffects();saveAccountPreferences();};
  if(ids.touchAppearanceRange){ids.touchAppearanceRange.value=String(state.preferences.touchAppearance||0);ids.touchAppearanceRange.oninput=()=>{applyEffects();saveAccountPreferences();};}
  ids.alwaysJoinMuted.onchange=saveAccountPreferences;
  ids.alwaysJoinCameraOff.onchange=saveAccountPreferences;
  ids.mirrorToggle.onchange=()=>{applyEffects();saveAccountPreferences();};
  ids.backgroundSelect.onchange=()=>{applyEffects();saveAccountPreferences();};
  ids.qualitySelect.onchange=async()=>{await applyVideoQuality(true);saveAccountPreferences();};

  // RC9.4: floating participant dock positioning is owned exclusively by
  // assets/js/meet/operational-fidelity-rc8-1.js. Keeping a single position
  // owner prevents competing drag/resize handlers from moving the dock when
  // presentation mode (screen sharing) changes the stage layout.


  // Centered, draggable utility windows. Dragging never changes their width or the meeting canvas.
  [ids.participantsPanel,ids.chatPanel].forEach(panel=>{const handle=panel?.querySelector('header');if(!panel||!handle)return;let panelDrag=null;handle.addEventListener('pointerdown',event=>{if(event.target.closest('button,input,select'))return;const rect=panel.getBoundingClientRect();panelDrag={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,pointerId:event.pointerId};handle.setPointerCapture?.(event.pointerId);});handle.addEventListener('pointermove',event=>{if(!panelDrag)return;const left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,panelDrag.left+event.clientX-panelDrag.x));const top=Math.max(56,Math.min(innerHeight-panel.offsetHeight-82,panelDrag.top+event.clientY-panelDrag.y));Object.assign(panel.style,{left:`${left}px`,top:`${top}px`,right:'auto',bottom:'auto'});});handle.addEventListener('pointerup',event=>{if(panelDrag?.pointerId===event.pointerId)handle.releasePointerCapture?.(event.pointerId);panelDrag=null;});});

  document.addEventListener('keydown',event=>{
    const typing=event.target?.matches?.('input,textarea,select,[contenteditable="true"]');
    if(!typing&&event.altKey){const key=event.key.toLowerCase();if(key==='a'){event.preventDefault();ids.micBtn?.click();}if(key==='v'){event.preventDefault();ids.camBtn?.click();}if(key==='u'){event.preventDefault();ids.participantsBtn?.click();}if(key==='h'){event.preventDefault();ids.chatBtn?.click();}if(key==='s'){event.preventDefault();ids.shareBtn?.click();}if(key==='f'){event.preventDefault();document.fullscreenElement?document.exitFullscreen?.():ids.meeting.requestFullscreen?.();}}
    if (event.key==='Escape') {
      closeMenus();
      [ids.participantsPanel,ids.chatPanel].forEach(panel=>panel.hidden=true);
      if (ids.settingsDialog.open) ids.settingsDialog.close();
      if (ids.leaveDialog.open) ids.leaveDialog.close();
    }
  });

  const query = new URLSearchParams(location.search);
  if(query.get('desktop')==='1'){
    const back=document.querySelector('.back-to-dashboard');
    if(back){back.href='/meet-home/?desktop=1';back.textContent='← Meet Home';back.setAttribute('aria-label','Return to DominionStar Meet Home');}
  }
  ids.roomId.value = formatMeetingId(query.get('room') || '');
  if(ids.meetingPasscode)ids.meetingPasscode.value='';
  ids.roomId.addEventListener('input',()=>{const formatted=formatMeetingId(ids.roomId.value);if(ids.roomId.value!==formatted)ids.roomId.value=formatted;});
  ids.roomId.addEventListener('paste',event=>{const pasted=event.clipboardData?.getData('text')||'';if(!/\d/.test(pasted))return;event.preventDefault();ids.roomId.value=formatMeetingId(pasted);ids.roomId.dispatchEvent(new Event('input',{bubbles:true}));});
  (async()=>{
    if(!await verifyDesktopReleaseContract())return;
    if(!await loadAccountContext())return;
    const action=query.get('action')||'';
    const enteringMeeting=Boolean(query.get('room'))||['new','join','share','personal'].includes(action)||query.get('new')==='1';
    // The Meet dashboard is not a camera screen. Hardware is acquired only
    // after the user enters a meeting/pre-join flow, matching desktop meeting
    // privacy expectations and preventing an unexplained camera indicator.
    if(enteringMeeting)await ensurePreview();
    applyEffects();
  })();
})();

/* Executive 6.0 Sprint 2 Build 2: Meet dashboard and recurring scheduling */
(() => {
  const $ = id => document.getElementById(id);
  const iconMap = {
    'video-plus':'<svg viewBox="0 0 24 24"><rect x="2" y="6" width="13" height="12" rx="2"/><path d="m15 10 5-3v10l-5-3zM7 9v6M4 12h6"/></svg>',
    join:'<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></svg>',
    repeat:'<svg viewBox="0 0 24 24"><path d="m17 1 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    'personal-room':'<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/><path d="M8 10h8"/></svg>',
    'share-screen':'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4M12 12V6M9 9l3-3 3 3"/></svg>'
  };
  document.querySelectorAll('[data-action-icon]').forEach(n=>n.innerHTML=iconMap[n.dataset.actionIcon]||'');
  const key='ds_meet_scheduled_v1';
  const readMeetings=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}};
  const saveMeetings=v=>localStorage.setItem(key,JSON.stringify(v));
  const randomDigits=n=>Array.from({length:n},()=>Math.floor(Math.random()*10)).join('');
  const formatId=id=>{const digits=String(id||'').replace(/\D/g,'').slice(0,10);if(digits.length<=3)return digits;if(digits.length<=6)return`${digits.slice(0,3)} ${digits.slice(3)}`;return`${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;};
  const generateMeeting=()=>({id:randomDigits(10),passcode:randomDigits(6)});
  let pendingCredentials=generateMeeting();
  const syncPreview=()=>{if($('scheduledIdPreview'))$('scheduledIdPreview').textContent=formatId(pendingCredentials.id);if($('scheduledPasscodePreview'))$('scheduledPasscodePreview').textContent=$('scheduleRequirePasscode')?.checked?pendingCredentials.passcode:'Not required'};
  const syncRecurrenceEnd=()=>{
    const input=$('scheduleEndValue'),mode=$('scheduleEnds')?.value||'never';
    if(!input)return;
    input.hidden=mode==='never';
    input.required=mode!=='never';
    input.type=mode==='date'?'date':'number';
    input.min=mode==='count'?'1':'';
    input.max=mode==='count'?'100':'';
    input.placeholder=mode==='count'?'Number of meetings':'';
    if(mode==='never')input.value='';
  };
  const setDefaultSchedule=()=>{const d=new Date(Date.now()+3600000);$('scheduleDate').value=d.toISOString().slice(0,10);$('scheduleTime').value=d.toTimeString().slice(0,5);pendingCredentials=generateMeeting();syncPreview()};
  const openSchedule=()=>{setDefaultSchedule();$('scheduleDialog')?.showModal()};
  const renderMeetings=()=>{
    const list=$('scheduledMeetingsList'); if(!list)return;
    const meetings=readMeetings();
    list.innerHTML=meetings.length?'':`<div class="scheduled-empty">No scheduled meetings yet.</div>`;
    meetings.forEach(m=>{
      const row=document.createElement('article');row.className='scheduled-meeting-row';
      const when=m.frequency==='no-fixed-time'?'No fixed time':new Date(`${m.date}T${m.time}`).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
      row.innerHTML=`<div><strong>${String(m.topic).replace(/[&<>"']/g,'')}</strong><small>${m.recurring?`Recurring · ${m.frequency}`:'One-time'} · ${when}</small></div><div class="meeting-credentials"><div>ID: ${formatId(m.id)}</div><div>Passcode: ${m.passcode||'Not required'}</div></div><div class="meeting-row-actions"><button class="start" data-start-id="${m.id}">Start</button><button data-copy-id="${m.id}">Copy invite</button><button data-delete-id="${m.id}">Delete</button></div>`;
      list.append(row);
    });
  };
  const showScheduled=()=>{$('scheduledMeetingsSection').hidden=false;renderMeetings();$('scheduledMeetingsSection').scrollIntoView({behavior:'smooth',block:'nearest'})};
  const setMeetFlow=(mode='dashboard')=>{
    const prejoin=$('prejoin'); if(!prejoin)return;
    prejoin.dataset.flow=mode;
    document.body.classList.toggle('meet-flow-active',mode!=='dashboard');
  };
  const openJoinFlow=()=>{setMeetFlow('join');$('roomId')?.focus();};
  $('newMeetingAction')?.addEventListener('click',()=>{const c=generateMeeting();window.__DS_START_AS_HOST=true;window.__DS_WAITING_ROOM=false;window.__DS_MEETING_PASSCODE=c.passcode;$('roomId').value=formatId(c.id);history.replaceState(null,'',`${location.pathname}?room=${c.id}&host=1`);$('joinForm').requestSubmit()});
  $('shareScreenAction')?.addEventListener('click',()=>{window.__DS_AUTO_SHARE=true;$('newMeetingAction')?.click();});
  $('joinMeetingAction')?.addEventListener('click',openJoinFlow);
  $('scheduleMeetingAction')?.addEventListener('click',openSchedule);
  $('recurringMeetingAction')?.addEventListener('click',showScheduled);
  $('closeScheduledMeetings')?.addEventListener('click',()=>{$('scheduledMeetingsSection').hidden=true});
  $('scheduleClose')?.addEventListener('click',()=>$('scheduleDialog').close());
  $('scheduleCancel')?.addEventListener('click',()=>$('scheduleDialog').close());
  $('scheduleRecurring')?.addEventListener('change',e=>{$('recurrenceOptions').hidden=!e.target.checked;syncRecurrenceEnd();});
  $('scheduleEnds')?.addEventListener('change',syncRecurrenceEnd);
  $('scheduleRequirePasscode')?.addEventListener('change',syncPreview);
  $('scheduleMeetingForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const recurring=$('scheduleRecurring').checked;
    const passcode=$('scheduleRequirePasscode')?.checked?pendingCredentials.passcode:'';
    const item={topic:$('scheduleTopic').value.trim(),date:$('scheduleDate').value,time:$('scheduleTime').value,duration:Number($('scheduleDuration').value),recurring,frequency:recurring?$('scheduleFrequency').value:null,ends:recurring?$('scheduleEnds').value:null,endValue:recurring&&$('scheduleEnds').value!=='never'?$('scheduleEndValue').value:null,waitingRoom:$('scheduleWaitingRoom').checked,id:pendingCredentials.id,passcode,link:`${location.origin}/meet/?action=join&room=${pendingCredentials.id}`};
    const meetings=readMeetings();meetings.unshift(item);saveMeetings(meetings);$('scheduleDialog').close();showScheduled();
  });
  $('scheduledMeetingsList')?.addEventListener('click',async e=>{
    const start=e.target.closest('[data-start-id]'); if(start){const m=readMeetings().find(x=>x.id===start.dataset.startId);window.__DS_START_AS_HOST=true;window.__DS_WAITING_ROOM=Boolean(m?.waitingRoom);window.__DS_MEETING_PASSCODE=m?.passcode||'';$('roomId').value=formatId(start.dataset.startId);history.replaceState(null,'',`${location.pathname}?room=${start.dataset.startId}&host=1`);$('joinForm').requestSubmit();return}
    const copy=e.target.closest('[data-copy-id]'); if(copy){const m=readMeetings().find(x=>x.id===copy.dataset.copyId);if(m){await navigator.clipboard?.writeText(`${m.topic}\n${m.link}\nMeeting ID: ${formatId(m.id)}${m.passcode?`\nPasscode: ${m.passcode}`:''}`);e.target.textContent='Copied';setTimeout(()=>e.target.textContent='Copy invite',1400)}return}
    const del=e.target.closest('[data-delete-id]'); if(del){saveMeetings(readMeetings().filter(x=>x.id!==del.dataset.deleteId));renderMeetings()}
  });
  window.addEventListener('load',()=>{
    renderMeetings();
    const params=new URLSearchParams(location.search);
    const action=params.get('action');
    if(params.get('new')==='1'||action==='new') setTimeout(()=>$('newMeetingAction')?.click(),80);
    else if(params.get('room')||action==='join') setTimeout(openJoinFlow,80);
    else if(action==='schedule') setTimeout(()=>$('scheduleMeetingAction')?.click(),80);
    else if(action==='share') setTimeout(()=>$('shareScreenAction')?.click(),80);
    else if(action==='personal') setTimeout(()=>$('personalMeetingAction')?.click(),120);
    else if(action==='recurring') setTimeout(()=>$('recurringMeetingAction')?.click(),80);
    else setMeetFlow('dashboard');
    setTimeout(()=>{const identity=$('accountIdentity');const dash=$('dashboardIdentity');if(identity&&!identity.hidden&&dash){dash.hidden=false;dash.innerHTML=identity.innerHTML}},700);
  });
})();

/* RC5.6 — Personal Meeting Room moved to isolated personal-room.js for fault isolation. */
