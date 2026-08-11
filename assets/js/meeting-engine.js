(() => {
  if (window.DominionStarMeetingEngine) return;

  const state = {
    client: null,
    session: null,
    roomId: '',
    displayName: '',
    participantId: '',
    userId: '',
    hostUserId: '',
    instanceId: '',
    joinToken: '',
    isHost: false,
    role: 'attendee',
    contractLevel: 'TA',
    avatarUrl: '',
    mediaState: {audio:true,video:true},
    admitted: false,
    waitingRoomKnown: false,
    waitingRoomEnabled: false,
    localStream: null,
    screenStream: null,
    screenRemoteControlCapable: false,
    remoteControlAuthorizedId: null,
    remoteControlRequestId: null,
    channel: null,
    channelStatus: 'idle',
    peers: new Map(),
    pendingCandidates: new Map(),
    remoteMeta: new Map(),
    remoteStreams: new Map(),
    remoteScreenStreams: new Map(),
    remoteScreenTrackIds: new Map(),
    remoteScreenStreamIds: new Map(),
    remoteScreenMids: new Map(),
    remoteTrackStreamIds: new Map(),
    remoteTrackMids: new Map(),
    makingOffer: new Set(),
    reconnectTimers: new Map(),
    presenceMissingTimers: new Map(),
    listeners: new Map(),
    readySent: false,
    stoppingScreen: false,
    preShareVideoEnabled: true,
    meetingEnded: false,
    endingMeeting: false,
    roomWatchTimer: null,
    departureSent: false,
    moderationRequestsSeen: new Set(),
    heartbeatTimer: null,
    lastHeartbeatByParticipant: new Map(),
    directControlChannels: [],
    controlAcks: new Map(),
    pendingModerationRequests: new Map(),
    departedParticipants: new Map(),
    mediaMutation: Promise.resolve(),
    cameraRecoveryCount: 0,
    peerRecoveryCount: 0,
    lastPeerRecoveryAt: 0,
    lastCameraToggleAt: 0,
    monitoredCameraTracks: new WeakSet(),
    desiredVideo: true,
    videoToggleSeq: 0,
    desiredAudio: true,
    audioToggleSeq: 0,
    audioPublishTimer: null,
    audioPublishInFlight: false,
    audioPublishPending: false,
    monitoredAudioTracks: new WeakSet(),
    transcriptionActive: false,
    transcriptionLanguage: 'auto',
    pendingRoleChanges: new Map()
  };

  const domainEventMap = {
    'participant-left':'participant.left',
    'participant-joined':'participant.joined',
    'peer-state':'meet.peer.state',
    'connected':'meet.connected',
    'meeting-ended':'meeting.ended',
    'admitted':'participant.admitted',
    'denied':'participant.denied',
    'join-request':'participant.join.requested',
    'moderation':'meet.moderation.applied',
    'moderation-ack':'meet.moderation.acknowledged',
    'moderation-response':'meet.moderation.responded',
    'moderation-timeout':'meet.moderation.timeout',
    'moderation-status':'meet.moderation.status',
    'control-ack':'meet.control.acknowledged',
    'media-state':'media.remote.state',
    'speaking-state':'participant.speaking.updated',
    'screen-state':'screen.share.remote.state',
    'screen-stream':'screen.share.started',
    'screen-ended':'screen.share.stopped',
    'reaction':'reaction.received',
    'chat':'chat.message.received',
    'role-change':'participant.role.changed',
    'identity-updated':'participant.identity.updated'
  };
  // Preserve the waiting-room boundary at the sender. Live synchronization for
  // an admitted browser must not be rejected because a remote presence record
  // is briefly stale; this restores the proven S35 cross-browser behavior.
  const ADMISSION_REQUIRED_EVENTS=new Set(['meet-chat','meet-spotlight','meet-reaction','meet-remote-control-request','meet-remote-control-response','meet-remote-control-input','meet-remote-control-stop','meet-transcript']);
  const publishDomainEvent = (name, detail={}) => {
    const type=domainEventMap[name]||`meet.ui.${String(name||'event').replace(/[^a-z0-9_.-]/gi,'-')}`;
    return window.DominionRuntime?.events?.publish?.({
      type,
      source:'meeting-engine',
      meetingId:state.roomId,
      actorId:detail?.participantId||detail?.from||state.participantId||'',
      correlationId:detail?.requestId||'',
      severity:/timeout|failed|error/i.test(name)?'warning':'info',
      payload:detail
    });
  };
  const emit = (name, detail={}) => {
    (state.listeners.get(name) || []).forEach(fn => {
      try { fn(detail); } catch (error) { console.error(error); }
    });
    publishDomainEvent(name,detail);
  };
  const on = (name, fn) => {
    const list = state.listeners.get(name) || [];
    list.push(fn);
    state.listeners.set(name, list);
    return () => state.listeners.set(name, list.filter(item => item !== fn));
  };

  const randomId = (prefix='m') => `${prefix}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  const sanitizeRoomId = value => String(value || '').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,24);
  const createRoomId = () => String(Math.floor(100000 + Math.random() * 900000));

  let rtcConfig = {
    iceServers: [
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'}
    ]
  };
  const getRtcConfig = () => rtcConfig;
  const loadRtcConfig = async () => {
    try{
      const response=await fetch('/.netlify/functions/meet-rtc-config',{cache:'no-store'});
      if(!response.ok)return rtcConfig;
      const data=await response.json();
      if(Array.isArray(data?.iceServers)&&data.iceServers.length)rtcConfig={iceServers:data.iceServers,iceCandidatePoolSize:4};
    }catch(_){}
    return rtcConfig;
  };


  const syncPeerTracks = async peer => {
    if (!peer) return;
    const audioTrack = state.localStream?.getAudioTracks?.()[0] || null;
    const cameraTrack = state.localStream?.getVideoTracks?.()[0] || null;
    const screenTrack = state.screenStream?.getVideoTracks?.()[0] || null;
    const screenAudioTrack = state.screenStream?.getAudioTracks?.()[0] || null;
    const desired = [
      {kind:'audio', track:audioTrack, stream:state.localStream},
      {kind:'camera', track:cameraTrack, stream:state.localStream},
      {kind:'screen', track:screenTrack, stream:state.screenStream},
      {kind:'screen-audio', track:screenAudioTrack, stream:state.screenStream}
    ];
    for (const item of desired) {
      let sender = peer.getSenders().find(candidate => candidate.__dsKind === item.kind);
      // Backward-compatible adoption of senders created by older builds.
      if (!sender && item.kind === 'audio') sender = peer.getSenders().find(candidate => candidate.track?.kind === 'audio' && !candidate.__dsKind);
      if (!sender && item.kind === 'camera') sender = peer.getSenders().find(candidate => candidate.track?.kind === 'video' && !candidate.__dsKind);
      if (sender) {
        sender.__dsKind = item.kind;
        if (sender.track !== item.track) await sender.replaceTrack(item.track).catch(()=>{});
      } else if (item.track) {
        const created = peer.addTrack(item.track, item.stream || new MediaStream([item.track]));
        created.__dsKind = item.kind;
      }
    }
  };

  const renegotiatePeer = async remoteId => {
    const peer = state.peers.get(remoteId);
    if (!peer || peer.signalingState !== 'stable' || state.makingOffer.has(remoteId)) return;
    state.makingOffer.add(remoteId);
    try {
      await syncPeerTracks(peer);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await send('meet-offer', {to:remoteId, description:peer.localDescription});
    } finally {
      state.makingOffer.delete(remoteId);
    }
  };

  const flushPendingCandidates = async remoteId => {
    const peer = state.peers.get(remoteId);
    if (!peer?.remoteDescription) return;
    const queued = state.pendingCandidates.get(remoteId) || [];
    state.pendingCandidates.delete(remoteId);
    for (const candidate of queued) await peer.addIceCandidate(candidate).catch(()=>{});
  };

  const ready = async () => {
    if (state.isHost || !state.admitted || state.readySent) return false;
    state.readySent = true;
    await send('meet-ready', {});
    return true;
  };

  const send = async (event, payload={}) => {
    if(ADMISSION_REQUIRED_EVENTS.has(event)&&!state.admitted){
      window.DominionRuntime?.events?.publish?.({type:'waiting-room.event.blocked',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,severity:'warning',payload:{event}});
      return false;
    }
    if (!state.channel) {
      window.DominionRuntime?.events?.publish?.({type:'realtime.send.skipped',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,severity:'warning',payload:{event,reason:'channel-unavailable'}});
      return false;
    }
    const envelope={...payload, roomId:state.roomId, from:state.participantId, userId:state.userId, instanceId:state.instanceId, sentAt:Date.now(), displayName:state.displayName, isHost:state.isHost, role:state.role, admitted:state.admitted, contractLevel:state.contractLevel, avatarUrl:state.avatarUrl};
    const startedAt=performance.now?.()||Date.now();
    try {
      const result=await state.channel.send({type:'broadcast',event,payload:envelope});
      window.DominionRuntime?.events?.publish?.({type:'realtime.event.sent',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,correlationId:payload?.requestId||'',payload:{event,durationMs:Math.round((performance.now?.()||Date.now())-startedAt),result}});
      return result;
    } catch (error) {
      window.DominionRuntime?.events?.publish?.({type:'realtime.event.failed',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,correlationId:payload?.requestId||'',severity:'error',payload:{event,message:error?.message||String(error)}});
      throw error;
    }
  };

  const updatePresence = async (extra={}) => {
    if (!state.channel) return;
    await state.channel.track({
      participantId:state.participantId,
      userId:state.userId,
      instanceId:state.instanceId,
      displayName:state.displayName,
      isHost:state.isHost,
      role:state.role,
      admitted:state.admitted,
      contractLevel:state.contractLevel,
      avatarUrl:state.avatarUrl,
      audio:state.mediaState.audio,
      video:state.mediaState.video,
      screenSharing:Boolean(state.screenStream),
      joinedAt:new Date().toISOString(),
      ...extra
    });
  };

  const ensurePeer = async (remoteId, shouldOffer=false) => {
    if (!remoteId || remoteId === state.participantId) return null;
    if (state.peers.has(remoteId)) return state.peers.get(remoteId);

    const peer = new RTCPeerConnection(getRtcConfig());
    state.peers.set(remoteId, peer);

    // Reserve independent presentation lanes when the peer is first created.
    // Starting a share must not add a second video sender in the middle of a
    // call: doing that renegotiates the camera connection and can briefly route
    // the display track through the camera receiver.  A negotiated, empty
    // transceiver lets share/stop use replaceTrack() only, preserving camera
    // decoders and the participant dock exactly as Zoom-style clients do.
    if(typeof peer.addTransceiver==='function'){
      const screenVideoTransceiver=peer.addTransceiver('video',{direction:'sendonly'});
      screenVideoTransceiver.sender.__dsKind='screen';
      const screenAudioTransceiver=peer.addTransceiver('audio',{direction:'sendonly'});
      screenAudioTransceiver.sender.__dsKind='screen-audio';
    }

    await syncPeerTracks(peer);

    peer.onicecandidate = ({candidate}) => {
      if (candidate) send('meet-ice', {to:remoteId, candidate});
    };
    peer.onnegotiationneeded = () => {
      // Adding/removing the dedicated screen-share track requires a fresh SDP offer.
      renegotiatePeer(remoteId).catch(()=>{});
    };
    peer.ontrack = ({track,streams,transceiver}) => {
      const supplied = streams?.[0] || null;
      if (supplied?.id) state.remoteTrackStreamIds.set(`${remoteId}:${track.id}`, supplied.id);
      const trackMid=String(transceiver?.mid||'');
      if(trackMid)state.remoteTrackMids.set(`${remoteId}:${track.id}`,trackMid);
      const announcedTrackId = state.remoteScreenTrackIds.get(remoteId);
      const announcedStreamId = state.remoteScreenStreamIds.get(remoteId);
      const announcedMid=state.remoteScreenMids.get(remoteId);
      const isScreen = Boolean((announcedTrackId && track.id === announcedTrackId) || (announcedStreamId && supplied?.id === announcedStreamId) || (announcedMid&&trackMid===announcedMid));
      const targetMap = isScreen ? state.remoteScreenStreams : state.remoteStreams;
      let aggregate = targetMap.get(remoteId);
      if (!aggregate) {
        aggregate = new MediaStream();
        targetMap.set(remoteId, aggregate);
      }
      const incomingTracks = supplied?.getTracks?.() || [track];
      incomingTracks.forEach(item => {
        const itemMid=state.remoteTrackMids.get(`${remoteId}:${item.id}`)||trackMid;
        const itemIsScreen = Boolean((announcedTrackId && item.id === announcedTrackId) || (announcedStreamId && supplied?.id === announcedStreamId) || (announcedMid&&itemMid===announcedMid));
        if (itemIsScreen !== isScreen) return;
        if (!aggregate.getTracks().some(existing => existing.id === item.id)) aggregate.addTrack(item);
      });
      if (!aggregate.getTracks().some(existing => existing.id === track.id)) aggregate.addTrack(track);
      track.addEventListener('ended', () => {
        aggregate.removeTrack(track);
        emit(isScreen ? 'remote-screen-stream' : 'remote-stream', {participantId:remoteId, stream:aggregate, meta:state.remoteMeta.get(remoteId)});
      }, {once:true});
      emit(isScreen ? 'remote-screen-stream' : 'remote-stream', {participantId:remoteId, stream:aggregate, meta:state.remoteMeta.get(remoteId)});
    };
    peer.onconnectionstatechange = () => {
      emit('peer-state', {participantId:remoteId, state:peer.connectionState});
      clearTimeout(state.reconnectTimers.get(remoteId));
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        // Both browsers observe the same outage. Give one deterministic side
        // the first recovery turn and retain a delayed fallback on the other.
        // Simultaneous ICE restarts were producing offer glare and frozen media.
        const primary=state.participantId.localeCompare(remoteId)<0;
        const delay=peer.connectionState==='failed'?(primary?700:8000):(primary?5000:12000);
        const timer=setTimeout(()=>{
          const current=state.peers.get(remoteId);
          if(current && ['failed','disconnected'].includes(current.connectionState)){
            current.restartIce?.();
            renegotiatePeer(remoteId).catch(()=>{});
          }
        },delay);
        state.reconnectTimers.set(remoteId,timer);
      } else if (peer.connectionState === 'closed' && state.remoteMeta.has(remoteId) && !participantIsDeparted(remoteId)) {
        recoverPeer(remoteId,{reason:'peer-transport-closed'}).catch(()=>{});
      }
    };

    if (shouldOffer) await renegotiatePeer(remoteId);
    return peer;
  };

  const markParticipantDeparted = (participantId, ttlMs=30000) => {
    if (!participantId) return;
    const leftAt=Date.now();
    state.departedParticipants.set(participantId,{leftAt,expiresAt:leftAt+ttlMs});
  };

  const departureRecord = participantId => {
    const record=state.departedParticipants.get(participantId)||null;
    if(!record)return null;
    const expiresAt=typeof record==='number'?record:Number(record.expiresAt||0);
    if(expiresAt<=Date.now()){state.departedParticipants.delete(participantId);return null;}
    return typeof record==='number'?{leftAt:0,expiresAt:record}:record;
  };

  const participantIsDeparted = participantId => Boolean(departureRecord(participantId));

  const discardPeerTransport = (participantId,{announceRecovery=false}={}) => {
    const peer=state.peers.get(participantId);
    if(peer){peer.onconnectionstatechange=null;peer.ontrack=null;peer.onicecandidate=null;peer.onnegotiationneeded=null;try{peer.close();}catch(_){}}
    state.peers.delete(participantId);
    state.remoteStreams.delete(participantId);
    state.remoteScreenStreams.delete(participantId);
    state.remoteScreenTrackIds.delete(participantId);
    state.remoteScreenStreamIds.delete(participantId);
    state.remoteScreenMids.delete(participantId);
    for (const key of [...state.remoteTrackStreamIds.keys()]) {
      if (key.startsWith(`${participantId}:`)) state.remoteTrackStreamIds.delete(key);
    }
    for (const key of [...state.remoteTrackMids.keys()]) {
      if (key.startsWith(`${participantId}:`)) state.remoteTrackMids.delete(key);
    }
    clearTimeout(state.reconnectTimers.get(participantId));state.reconnectTimers.delete(participantId);
    state.pendingCandidates.delete(participantId);
    if(announceRecovery)emit('remote-stream',{participantId,stream:new MediaStream(),meta:state.remoteMeta.get(participantId),recovering:true});
  };

  const removePeer = (participantId,{departed=false}={}) => {
    const hadParticipant = state.peers.has(participantId) || state.remoteMeta.has(participantId) || state.remoteStreams.has(participantId) || state.remoteScreenStreams.has(participantId);
    if (departed) markParticipantDeparted(participantId);
    clearTimeout(state.presenceMissingTimers.get(participantId));
    state.presenceMissingTimers.delete(participantId);
    discardPeerTransport(participantId);
    state.remoteMeta.delete(participantId);
    state.lastHeartbeatByParticipant.delete(participantId);
    if (hadParticipant || departed) emit('participant-left', {participantId});
  };

  const safeChannelToken = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,180);

  const subscribeDirectControlChannel = async token => {
    if (!state.client || !token) return null;
    const name=`dominionstar-meet-control-${safeChannelToken(state.roomId)}-${safeChannelToken(token)}`;
    const channel=state.client.channel(name,{config:{broadcast:{self:false,ack:true}}});
    channel.on('broadcast',{event:'command'},async({payload})=>{
      const applied=await applyModerationRequest(payload);
      if(applied && payload?.requestId){
        channel.send({type:'broadcast',event:'ack',payload:{requestId:payload.requestId,action:payload.action,from:state.participantId,userId:state.userId,accepted:true}}).catch(()=>{});
      }
    });
    channel.on('broadcast',{event:'ack'},({payload})=>{
      if(!payload?.requestId)return;
      const waiter=state.controlAcks.get(payload.requestId);
      if(waiter){clearTimeout(waiter.timer);state.controlAcks.delete(payload.requestId);waiter.resolve(payload);}
      const pending=state.pendingModerationRequests.get(payload.requestId);
      if(pending){
        pending.delivered=true;pending.deliveredAt=Date.now();pending.status='delivered';
        if(!pending.consentRequired) state.pendingModerationRequests.delete(payload.requestId);
      }
      emit('control-ack',payload);
      emit('moderation-status',{requestId:payload.requestId,status:'delivered',action:pending?.action||payload.action,participantId:pending?.participantId||payload.from});
    });
    await new Promise(resolve=>channel.subscribe(status=>{if(status==='SUBSCRIBED'||status==='CHANNEL_ERROR'||status==='TIMED_OUT')resolve();}));
    state.directControlChannels.push(channel);
    return channel;
  };

  const sendDirectControl = async (token,payload) => {
    if(!state.client||!token)return false;
    const name=`dominionstar-meet-control-${safeChannelToken(state.roomId)}-${safeChannelToken(token)}`;
    const channel=state.client.channel(name,{config:{broadcast:{self:false,ack:true}}});
    try{
      await new Promise(resolve=>channel.subscribe(status=>{if(status==='SUBSCRIBED'||status==='CHANNEL_ERROR'||status==='TIMED_OUT')resolve();}));
      const result=await channel.send({type:'broadcast',event:'command',payload:{...payload,roomId:state.roomId,from:state.participantId,userId:state.userId,displayName:state.displayName,role:state.role,isHost:state.isHost}});
      return result==='ok'||result===true||result?.status==='ok';
    }catch(_){return false;}finally{setTimeout(()=>state.client?.removeChannel?.(channel),800);}
  };

  const moderationTargetMatches = payload => {
    if (!payload) return false;
    const targetParticipantId = payload.targetParticipantId || payload.to || '';
    const targetUserId = payload.targetUserId || payload.toUserId || '';
    const participantAliasMatch=Boolean(targetParticipantId && (
      targetParticipantId === state.participantId ||
      targetParticipantId === state.instanceId ||
      targetParticipantId.endsWith(`:${state.instanceId}`)
    ));
    // A participant id identifies one live device/tab. Never fall through to a
    // user-id match when it is present: doing so lets a command for one device
    // mute every concurrent connection owned by the same signed-in account.
    if(targetParticipantId)return participantAliasMatch;
    return !targetUserId || Boolean(state.userId && targetUserId === state.userId);
  };

  const applyModerationRequest = async payload => {
    if (!moderationTargetMatches(payload)) return false;
    const action=payload.action;
    const requestId=payload.requestId||`${payload.from||'host'}:${action||'control'}:${payload.sentAt||''}`;
    // Controls are delivered redundantly across realtime transports. Every action,
    // including destructive actions, must therefore be idempotent.
    if(state.moderationRequestsSeen.has(requestId)){
      send('meet-control-ack',{targetParticipantId:payload.from,requestId,action,duplicate:true}).catch(()=>{});
      return true;
    }
    state.moderationRequestsSeen.add(requestId);
    setTimeout(()=>state.moderationRequestsSeen.delete(requestId),60000);
    // Receipt acknowledgement is separate from consent/response. It tells the host
    // the command reached the participant even if the user still has to decide.
    send('meet-control-ack',{targetParticipantId:payload.from,requestId,action,receivedAt:Date.now()}).catch(()=>{});
    if (action === 'mute') await toggleAudio(false);
    if (action === 'camera-off') await toggleVideo(false);
    if (action === 'rename') {
      const next=String(payload.displayName||'').trim().slice(0,80);
      if(next){state.displayName=next;await updatePresence({displayName:next});emit('identity-renamed',{displayName:next,from:payload.from});await send('meet-state-heartbeat',{audio:state.mediaState.audio,video:state.mediaState.video,displayName:next,renamed:true});}
    }
    if (action === 'request-unmute') emit('unmute-request',{...payload,requestId});
    if (action === 'request-camera') emit('camera-request',{...payload,requestId});
    if (action === 'remove') { emit('removed',payload); await leave(); }
    if (action === 'waiting-room') {
      state.admitted=false;
      state.readySent=false;
      await updatePresence({admitted:false});
      for (const remoteId of [...state.peers.keys()]) removePeer(remoteId);
      emit('moved-to-waiting',payload);
      state.joinToken=randomId('join');
      await send('meet-join-request',{joinToken:state.joinToken}).catch(()=>{});
    }
    emit('moderation',payload);
    return true;
  };

  const sendStateHeartbeat = async () => {
    if (!state.channel) return;
    await send('meet-state-heartbeat',{
      audio:state.mediaState.audio,
      video:state.mediaState.video,
      screenSharing:Boolean(state.screenStream),
      admitted:state.admitted,
      heartbeatAt:Date.now(),
      heartbeatVersion:2,
      transcriptionActive:Boolean(state.transcriptionActive),
      transcriptionLanguage:state.transcriptionLanguage||'auto'
    }).catch(()=>{});
  };

  const startHeartbeat = () => {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer=setInterval(sendStateHeartbeat,1800);
    sendStateHeartbeat();
  };

  const handleSignal = async (event, payload) => {
    if (!payload || payload.roomId !== state.roomId || payload.from === state.participantId) return;
    const targetsParticipant = !payload.to || payload.to === state.participantId;
    const targetsUser = Boolean(payload.toUserId && state.userId && payload.toUserId === state.userId);
    const targetsEveryone = payload.to === 'everyone';
    if ((payload.to || payload.toUserId) && !targetsEveryone && !targetsParticipant && !targetsUser) return;
    window.DominionRuntime?.events?.publish?.({type:'realtime.event.received',source:'meeting-engine',meetingId:state.roomId,actorId:payload.from||'',correlationId:payload.requestId||'',payload:{event,to:payload.to||'',toUserId:payload.toUserId||''}});
    const departure=departureRecord(payload.from);
    if(departure){
      const sentAt=Number(payload.sentAt||payload.heartbeatAt||0);
      // Terminal leave wins over late packets. Only a fresh explicit join/ready
      // may reopen the same participant id; heartbeats never resurrect a ghost.
      if(['meet-ready','meet-join-request'].includes(event) && sentAt>Number(departure.leftAt||0)){
        state.departedParticipants.delete(payload.from);
      } else {
        return;
      }
    }
    const previousRemoteMeta=state.remoteMeta.get(payload.from)||null;
    const verifiedOwner=Boolean(state.hostUserId&&payload.userId===state.hostUserId);
    const claimedRole=verifiedOwner?'host':'attendee';
    // Once a peer is known, ordinary messages cannot promote their own role.
    // Role changes are applied only by the dedicated host-authorized event.
    const stableRole=verifiedOwner?'host':(previousRemoteMeta?.role||claimedRole);
    state.remoteMeta.set(payload.from, {userId:payload.userId || previousRemoteMeta?.userId || '', instanceId:payload.instanceId||previousRemoteMeta?.instanceId||'', joinToken:payload.joinToken||previousRemoteMeta?.joinToken||'', displayName:payload.displayName || previousRemoteMeta?.displayName || 'Guest', isHost:stableRole==='host', role:stableRole, admitted:Boolean(payload.admitted??previousRemoteMeta?.admitted), contractLevel:payload.contractLevel || previousRemoteMeta?.contractLevel || 'TA', avatarUrl:payload.avatarUrl || previousRemoteMeta?.avatarUrl || ''});
    const senderRole=previousRemoteMeta?.role||claimedRole;
    const senderPrivileged=senderRole==='host'||senderRole==='cohost';
    const senderHost=senderRole==='host';
    if(ADMISSION_REQUIRED_EVENTS.has(event)&&state.remoteMeta.get(payload.from)?.admitted!==true)return;

    if (event === 'meet-state-heartbeat') {
      const previous=state.lastHeartbeatByParticipant.get(payload.from)||0;
      if(Number(payload.heartbeatAt||0)<previous)return;
      state.lastHeartbeatByParticipant.set(payload.from,Number(payload.heartbeatAt||Date.now()));
      clearTimeout(state.presenceMissingTimers.get(payload.from));
      state.presenceMissingTimers.delete(payload.from);
      const meta={...state.remoteMeta.get(payload.from),audio:payload.audio!==false,video:payload.video!==false,screenSharing:Boolean(payload.screenSharing),admitted:Boolean(payload.admitted)};
      state.remoteMeta.set(payload.from,meta);
      if(meta.admitted && state.admitted){
        const shouldOffer=state.isHost || (!meta.isHost && state.participantId < payload.from);
        await ensurePeer(payload.from,shouldOffer).catch(()=>{});
      }
      // Heartbeats may activate transcription for late joiners, but they never
      // deactivate it. Stopping is an explicit host action so a stale/late peer
      // cannot accidentally shut captions down for the room.
      if(Boolean(payload.transcriptionActive) && (!state.transcriptionActive || (payload.transcriptionLanguage&&payload.transcriptionLanguage!==state.transcriptionLanguage))){
        state.transcriptionActive=true;
        state.transcriptionLanguage=String(payload.transcriptionLanguage||'auto');
        emit('transcription-state',{...payload,active:true,language:state.transcriptionLanguage,heartbeat:true});
      }
      emit('state-heartbeat',{...payload,meta});
      return;
    }
    if (event === 'meet-control') {
      if(senderPrivileged)await applyModerationRequest(payload);
      return;
    }
    if (event === 'meet-control-ack') {
      if(moderationTargetMatches(payload)){
        const pending=state.pendingModerationRequests.get(payload.requestId);
        if(pending){
          pending.delivered=true;pending.deliveredAt=Date.now();pending.status='delivered';
          if(!pending.consentRequired) state.pendingModerationRequests.delete(payload.requestId);
        }
        emit('moderation-ack',payload);
        emit('moderation-status',{requestId:payload.requestId,status:'delivered',action:pending?.action||payload.action,participantId:pending?.participantId||payload.from});
      }
      return;
    }
    if (event === 'meet-control-response') {
      if(moderationTargetMatches(payload)){
        const pending=state.pendingModerationRequests.get(payload.requestId);
        if(pending)state.pendingModerationRequests.delete(payload.requestId);
        emit('moderation-response',payload);
        emit('moderation-status',{requestId:payload.requestId,status:payload.accepted?'accepted':'declined',action:pending?.action||payload.action,participantId:pending?.participantId||payload.responderParticipantId});
      }
      return;
    }

    if (event === 'meet-join-request') {
      if (['host','cohost'].includes(state.role)) emit('join-request', payload);
      return;
    }
    if (event === 'meet-admitted') {
      const validJoinToken=Boolean(state.joinToken&&payload.joinToken===state.joinToken);
      if (payload.to === state.participantId && (senderPrivileged||validJoinToken)) {
        // Possession of the targeted one-time admission token authenticates the
        // admitting sender as this meeting's host even when anonymous RLS
        // prevents the guest from reading owner_id before entry.
        if(validJoinToken){
          const admittingHost=state.remoteMeta.get(payload.from)||{};
          state.remoteMeta.set(payload.from,{...admittingHost,role:'host',isHost:true,admitted:true});
        }
        state.admitted = true;
        state.readySent = false;
        await updatePresence({admitted:true});
        await send('meet-admission-confirmed',{to:payload.from,admissionId:payload.admissionId||'',joinToken:state.joinToken});
        emit('admitted', payload);
      }
      return;
    }
    if(event==='meet-admission-confirmed'){
      const guest=state.remoteMeta.get(payload.from)||{};
      if(payload.to===state.participantId&&payload.joinToken&&payload.joinToken===guest.joinToken){
        state.remoteMeta.set(payload.from,{...guest,admitted:true});
        emit('admission-confirmed',{...payload,participantId:payload.from});
      }
      return;
    }
    if (event === 'meet-denied') {
      const validJoinToken=Boolean(state.joinToken&&payload.joinToken===state.joinToken);
      if (payload.to === state.participantId && (senderPrivileged||validJoinToken)) emit('denied', payload);
      return;
    }
    if (event === 'meet-ready') {
      if (state.isHost || state.admitted) await ensurePeer(payload.from, true);
      emit('participant-joined', {...payload, meta:state.remoteMeta.get(payload.from)});
      return;
    }
    if (event === 'meet-offer') {
      if(!state.admitted)return;
      const peer = await ensurePeer(payload.from, false);
      const polite = state.participantId > payload.from;
      const collision = state.makingOffer.has(payload.from) || peer.signalingState !== 'stable';
      if (collision && !polite) return;
      if (collision) await peer.setLocalDescription({type:'rollback'}).catch(()=>{});
      await peer.setRemoteDescription(payload.description);
      await flushPendingCandidates(payload.from);
      await syncPeerTracks(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await send('meet-answer', {to:payload.from, description:peer.localDescription});
      return;
    }
    if (event === 'meet-answer') {
      if(!state.admitted)return;
      const peer = await ensurePeer(payload.from, false);
      if (peer.signalingState === 'have-local-offer') {
        await peer.setRemoteDescription(payload.description);
        await flushPendingCandidates(payload.from);
      }
      return;
    }
    if (event === 'meet-ice') {
      if(!state.admitted)return;
      const peer = state.peers.get(payload.from);
      if (peer?.remoteDescription) await peer.addIceCandidate(payload.candidate).catch(()=>{});
      else state.pendingCandidates.set(payload.from, [...(state.pendingCandidates.get(payload.from)||[]), payload.candidate]);
      return;
    }
    if (event === 'meet-left') { removePeer(payload.from,{departed:true}); return; }
    if (event === 'meet-ended') {
      if (state.meetingEnded) return;
      state.meetingEnded = true;
      emit('meeting-ended', payload);
      return;
    }
    if (event === 'meet-transcription-state') { state.transcriptionActive=Boolean(payload.active);state.transcriptionLanguage=String(payload.language||'auto');emit('transcription-state', payload); return; }
    if (event === 'meet-transcript') { emit('transcript', payload); return; }
    if (event === 'meet-chat') {
      const addressed=!payload.to||payload.to==='everyone'||payload.to===state.participantId||payload.from===state.participantId;
      if(addressed)emit('chat', payload);
    }
    if (event === 'meet-spotlight' && (senderPrivileged||payload.isHost||payload.role==='host')) emit('spotlight',payload);
    if (event === 'meet-active-speaker' && senderHost) emit('active-speaker',{participantId:String(payload.participantId||''),decidedAt:Number(payload.decidedAt||payload.sentAt||Date.now())});
    if (event === 'meet-reaction') emit('reaction', payload);
    if (event === 'meet-media-state') emit('media-state', payload);
    if (event === 'meet-speaking-state') emit('speaking-state', {participantId:payload.from,active:Boolean(payload.active),level:Number(payload.level||0),displayName:payload.displayName});
    if (event === 'meet-media-resync-request') {
      if(!state.admitted)return;
      const peer=state.peers.get(payload.from)||await ensurePeer(payload.from,false);
      await syncPeerTracks(peer);
      await renegotiatePeer(payload.from).catch(()=>{});
      await send('meet-media-state',{audio:state.mediaState.audio,video:state.mediaState.video,resynced:true}).catch(()=>{});
      return;
    }
    if (event === 'meet-screen-state') {
      if (payload.active) {
        if (payload.screenTrackId) state.remoteScreenTrackIds.set(payload.from,payload.screenTrackId);
        if (payload.screenStreamId) state.remoteScreenStreamIds.set(payload.from,payload.screenStreamId);
        if(payload.screenMid!==undefined&&payload.screenMid!==null)state.remoteScreenMids.set(payload.from,String(payload.screenMid));
        // Reclassify a screen track if it arrived before the metadata broadcast.
        const cameraAggregate=state.remoteStreams.get(payload.from);
        const screenTracks=cameraAggregate?.getTracks?.().filter(item=>
          item.id===payload.screenTrackId ||
          (payload.screenStreamId && state.remoteTrackStreamIds.get(`${payload.from}:${item.id}`)===payload.screenStreamId) ||
          (payload.screenMid!==undefined && String(payload.screenMid)===state.remoteTrackMids.get(`${payload.from}:${item.id}`))
        )||[];
        if(screenTracks.length){
          let screenAggregate=state.remoteScreenStreams.get(payload.from);
          if(!screenAggregate){screenAggregate=new MediaStream();state.remoteScreenStreams.set(payload.from,screenAggregate);}
          screenTracks.forEach(screenTrack=>{
            cameraAggregate.removeTrack(screenTrack);
            if(!screenAggregate.getTracks().some(item=>item.id===screenTrack.id))screenAggregate.addTrack(screenTrack);
          });
          emit('remote-stream',{participantId:payload.from,stream:cameraAggregate,meta:state.remoteMeta.get(payload.from)});
          emit('remote-screen-stream',{participantId:payload.from,stream:screenAggregate,meta:state.remoteMeta.get(payload.from)});
        }else{
          // replaceTrack() reuses the receiver on subsequent shares, so the
          // browser does not fire ontrack again. Re-emit the preserved screen
          // aggregate when presentation state becomes active.
          const preservedScreen=state.remoteScreenStreams.get(payload.from);
          if(preservedScreen?.getVideoTracks?.().length){
            emit('remote-screen-stream',{participantId:payload.from,stream:preservedScreen,meta:state.remoteMeta.get(payload.from),reused:true});
          }
        }
      } else {
        state.remoteScreenTrackIds.delete(payload.from);
        state.remoteScreenStreamIds.delete(payload.from);
        state.remoteScreenMids.delete(payload.from);
        // Keep the receiver aggregate. stopScreenShare uses replaceTrack(null),
        // and a later share reuses this receiver without another ontrack event.
      }
      emit('screen-state', {participantId:payload.from,active:Boolean(payload.active),paused:Boolean(payload.paused),displayName:payload.displayName,remoteControlCapable:Boolean(payload.remoteControlCapable)});
    }
    if(event==='meet-remote-control-request' && payload.to===state.participantId && state.screenStream && state.screenRemoteControlCapable && senderPrivileged)emit('remote-control-request',{...payload,requesterId:payload.from});
    if(event==='meet-remote-control-response' && payload.to===state.participantId)emit('remote-control-response',payload);
    if(event==='meet-remote-control-input' && payload.to===state.participantId && state.screenStream && state.remoteControlAuthorizedId===payload.from && senderPrivileged)emit('remote-control-input',payload);
    if(event==='meet-remote-control-stop' && (payload.to===state.participantId||payload.from===state.remoteControlAuthorizedId)){state.remoteControlAuthorizedId=null;state.remoteControlRequestId=null;emit('remote-control-stop',payload);}
    if (event === 'meet-role-change' && senderHost && payload.targetParticipantId) {
      const targetId=String(payload.targetParticipantId);
      const requestedRole=payload.targetRole||payload.role;
      const nextRole=['host','cohost','attendee'].includes(requestedRole)?requestedRole:'attendee';
      if(nextRole==='host'&&payload.newHostUserId)state.hostUserId=String(payload.newHostUserId);
      if(targetId===state.participantId){
        state.role=nextRole;state.isHost=nextRole==='host';if(state.isHost)state.admitted=true;
        await updatePresence({role:state.role,isHost:state.isHost,admitted:state.admitted});
      }else{
        const target=state.remoteMeta.get(targetId)||{};
        state.remoteMeta.set(targetId,{...target,role:nextRole,isHost:nextRole==='host',admitted:nextRole==='host'?true:Boolean(target.admitted)});
      }
      if(nextRole==='host'&&payload.from!==targetId){
        const former=state.remoteMeta.get(payload.from)||{};
        state.remoteMeta.set(payload.from,{...former,role:'attendee',isHost:false});
      }
      emit('role-change',{role:nextRole,participantId:targetId,from:payload.from,newHostUserId:payload.newHostUserId||''});
      if(targetId===state.participantId){
        await send('meet-role-change-confirmed',{to:payload.from,targetParticipantId:targetId,confirmedRole:nextRole,requestId:payload.requestId||''}).catch(()=>{});
      }
    }
    if(event==='meet-role-change-confirmed'&&payload.targetParticipantId===payload.from){
      const pending=state.pendingRoleChanges.get(payload.targetParticipantId);
      if(pending&&(!payload.requestId||payload.requestId===pending.requestId))state.pendingRoleChanges.delete(payload.targetParticipantId);
      const confirmedRole=['host','cohost','attendee'].includes(payload.confirmedRole)?payload.confirmedRole:(pending?.role||'attendee');
      const target=state.remoteMeta.get(payload.targetParticipantId)||{};
      state.remoteMeta.set(payload.targetParticipantId,{...target,role:confirmedRole,isHost:confirmedRole==='host'});
      emit('role-change',{role:confirmedRole,participantId:payload.targetParticipantId,from:state.participantId,confirmed:true,requestId:payload.requestId||''});
    }
    if (event === 'meet-moderation' && senderPrivileged) { await applyModerationRequest(payload); }
    if (event === 'meet-moderation-ack') emit('moderation-ack',payload);
    if (event === 'meet-security-state' && senderPrivileged){
      state.waitingRoomKnown=true;
      if(payload?.settings&&'waitingRoom' in payload.settings)state.waitingRoomEnabled=Boolean(payload.settings.waitingRoom);
      emit('security-state',payload);
    }
  };

  const normalizePresence = raw => {
    const latest = new Map();
    Object.values(raw || {}).forEach(entries => {
      (entries || []).forEach(entry => {
        if (!entry?.participantId || entry.participantId === state.participantId) return;
        const member={
          participantId: entry.participantId,
          userId: entry.userId || '',
          displayName: entry.displayName || 'Guest',
          isHost: Boolean(state.hostUserId&&entry.userId===state.hostUserId) || state.remoteMeta.get(entry.participantId)?.role==='host',
          role: (state.hostUserId&&entry.userId===state.hostUserId)?'host':(state.remoteMeta.get(entry.participantId)?.role||'attendee'),
          admitted: Boolean(entry.admitted),
          avatarUrl: entry.avatarUrl || '',
          audio: entry.audio !== false,
          video: entry.video !== false,
          screenSharing: Boolean(entry.screenSharing),
          joinedAt: entry.joinedAt || ''
        };
        const previous=latest.get(member.participantId);
        if(!previous || Date.parse(member.joinedAt||0)>=Date.parse(previous.joinedAt||0))latest.set(member.participantId,member);
      });
    });
    return [...latest.values()];
  };

  const syncPresencePeers = async members => {
    const filtered=(members||[]).filter(member=>member?.participantId && !participantIsDeparted(member.participantId));
    const current = new Set(filtered.map(member => member.participantId));
    for (const existingId of [...state.peers.keys()]) {
      if (current.has(existingId)) {
        clearTimeout(state.presenceMissingTimers.get(existingId));
        state.presenceMissingTimers.delete(existingId);
        continue;
      }
      // Supabase presence can briefly omit a healthy participant while a tab,
      // network interface, or desktop WebView refreshes its presence record.
      // Tearing down WebRTC on that single snapshot causes the black-video /
      // participant-count flicker seen in two-device meetings. Explicit leave
      // broadcasts still remove immediately; presence-only absence gets grace.
      if (!state.presenceMissingTimers.has(existingId)) {
        const timer=setTimeout(()=>{
          state.presenceMissingTimers.delete(existingId);
          const stillPresent=normalizePresence(state.channel?.presenceState?.()||{})
            .some(member=>member?.participantId===existingId && !participantIsDeparted(existingId));
          const heartbeatAge=Date.now()-Number(state.lastHeartbeatByParticipant.get(existingId)||0);
          if(!stillPresent && heartbeatAge>6500) removePeer(existingId);
        },8000);
        state.presenceMissingTimers.set(existingId,timer);
      }
    }
    for (const member of filtered) {
      clearTimeout(state.presenceMissingTimers.get(member.participantId));
      state.presenceMissingTimers.delete(member.participantId);
      const previous=state.remoteMeta.get(member.participantId)||{};
      // Presence is an eventually-consistent transport snapshot. It must never
      // erase the targeted join credential or demote a confirmed participant
      // because an older `admitted:false` presence record arrived late.
      const merged={
        ...previous,
        ...member,
        joinToken:previous.joinToken||'',
        admitted:previous.admitted===true||member.admitted===true
      };
      state.remoteMeta.set(member.participantId, merged);
      if (!merged.admitted || !state.admitted) {
        if(state.peers.has(member.participantId)) removePeer(member.participantId);
        continue;
      }
      const shouldOffer = state.isHost || (!merged.isHost && state.participantId < member.participantId);
      await ensurePeer(member.participantId, shouldOffer).catch(()=>{});
    }
  };


  const checkRoomLifecycle = async () => {
    if (!state.client || !state.roomId || state.meetingEnded || state.endingMeeting) return;
    try {
      const result = await state.client.from('meet_rooms').select('active,updated_at').eq('room_id',state.roomId).maybeSingle();
      if (result?.error || !result?.data) return;
      if (result.data.active === false) {
        state.meetingEnded = true;
        emit('meeting-ended',{source:'room-state',endedAt:result.data.updated_at || new Date().toISOString()});
      }
    } catch (_) {}
  };

  const startRoomLifecycleWatch = () => {
    clearInterval(state.roomWatchTimer);
    clearInterval(state.heartbeatTimer);
    state.roomWatchTimer = setInterval(checkRoomLifecycle, 900);
    checkRoomLifecycle();
  };

  const init = async ({roomId, displayName, isHost=false, hostUserId='', contractLevel='TA', avatarUrl='', waitingRoomEnabled=false}={}) => {
    const client = await window.DSAuth?.init?.();
    if (!client) throw new Error('DominionStar connection is unavailable.');
    const session = (await client.auth.getSession()).data?.session || null;
    state.client = client;
    state.session = session;
    state.roomId = sanitizeRoomId(roomId || createRoomId());
    state.displayName = String(displayName || session?.user?.user_metadata?.full_name || session?.user?.email || 'Guest').slice(0,80);
    state.userId = session?.user?.id || '';
    state.hostUserId=String(hostUserId||(isHost?state.userId:'')||'');
    // Each live connection needs a fresh identity. Reusing a room-scoped id lets
    // stale presence collide with a reopened browser tab or desktop app.
    state.instanceId = randomId('device');
    sessionStorage.setItem(`ds-meet-instance:${state.roomId}`, state.instanceId);
    state.participantId = `${state.userId || 'guest'}:${state.instanceId}`;
    state.isHost = Boolean(isHost);
    state.role = state.isHost ? 'host' : 'attendee';
    state.contractLevel = String(contractLevel || 'TA').slice(0,20);
    state.avatarUrl = String(avatarUrl || '').slice(0,1000);
    state.joinToken=randomId('join');
    state.admitted = state.isHost;
    state.waitingRoomEnabled=Boolean(waitingRoomEnabled);
    state.waitingRoomKnown=state.isHost||state.waitingRoomEnabled;
    await loadRtcConfig();

    state.channel = client.channel(`dominionstar-meet-${state.roomId}`, {config:{broadcast:{self:false,ack:true},presence:{key:state.participantId}}});
    ['meet-join-request','meet-admitted','meet-admission-confirmed','meet-denied','meet-ready','meet-offer','meet-answer','meet-ice','meet-left','meet-ended','meet-chat','meet-spotlight','meet-active-speaker','meet-reaction','meet-media-state','meet-speaking-state','meet-media-resync-request','meet-screen-state','meet-remote-control-request','meet-remote-control-response','meet-remote-control-input','meet-remote-control-stop','meet-role-change','meet-role-change-confirmed','meet-moderation','meet-moderation-ack','meet-control','meet-control-ack','meet-control-response','meet-state-heartbeat','meet-security-state','meet-transcript','meet-transcription-state']
      .forEach(event => state.channel.on('broadcast',{event},({payload})=>handleSignal(event,payload)));
    state.channel.on('presence',{event:'sync'},async()=>{
      const members = normalizePresence(state.channel.presenceState()).filter(member=>member?.participantId && !participantIsDeparted(member.participantId));
      emit('presence',{members});
      await syncPresencePeers(members);
    });
    await subscribeDirectControlChannel(`participant-${state.participantId}`);
    if(state.userId) await subscribeDirectControlChannel(`user-${state.userId}`);

    await state.channel.subscribe(async status => {
      state.channelStatus=String(status||'unknown').toLowerCase();
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        window.DominionRuntime?.events?.publish?.({type:'realtime.disconnected',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,severity:'warning',payload:{status}});
      }
      if (status === 'SUBSCRIBED') {
        await updatePresence();
        emit('connected',{roomId:state.roomId,participantId:state.participantId,isHost:state.isHost});
        startRoomLifecycleWatch();
        startHeartbeat();
        if (!state.isHost) await send('meet-join-request',{joinToken:state.joinToken});
      }
    });
    return snapshot();
  };

  const queueMediaMutation = operation => {
    const run=()=>Promise.resolve().then(operation);
    state.mediaMutation=state.mediaMutation.then(run,run);
    return state.mediaMutation;
  };

  const monitorCameraTrack = track => {
    if(!track || state.monitoredCameraTracks.has(track))return;
    state.monitoredCameraTracks.add(track);
    track.addEventListener('ended',()=>{
      if(state.endingMeeting || state.meetingEnded || !state.mediaState.video)return;
      if(state.localStream?.getVideoTracks?.()[0]!==track)return;
      window.DominionRuntime?.events?.publish?.({type:'media.camera.track.ended',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,severity:'warning',payload:{label:track.label||'',readyState:track.readyState}});
      setTimeout(()=>queueMediaMutation(async()=>{
        if(!state.mediaState.video || state.endingMeeting || state.localStream?.getVideoTracks?.()[0]?.readyState==='live')return;
        try{
          const replacement=await recoverCameraTrack();
          emit('local-media-state',{audio:state.mediaState.audio,video:true,stream:state.localStream,recovered:true});
          await send('meet-media-state',{audio:state.mediaState.audio,video:true}).catch(()=>{});
          await updatePresence().catch(()=>{});
          return replacement;
        }catch(error){
          state.mediaState.video=false;
          emit('local-media-state',{audio:state.mediaState.audio,video:false,stream:state.localStream,recoveryFailed:true});
        }
      }),220);
    },{once:true});
  };

  const monitorAudioTrack = track => {
    if(!track || state.monitoredAudioTracks.has(track))return;
    state.monitoredAudioTracks.add(track);
    track.addEventListener('ended',()=>{
      if(state.endingMeeting || state.meetingEnded || !state.desiredAudio)return;
      window.DominionRuntime?.events?.publish?.({type:'media.microphone.track.ended',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,severity:'warning',payload:{label:track.label||''}});
      toggleAudio(true).catch(()=>{});
    },{once:true});
  };

  const acquireAudioTrack = async () => {
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
    const track=stream.getAudioTracks()[0]||null;
    if(!track){stream.getTracks().forEach(item=>item.stop());throw new Error('No microphone track was provided.');}
    monitorAudioTrack(track);
    return track;
  };

  const recoverAudioTrack = async () => {
    const current=state.localStream?.getAudioTracks?.()[0]||null;
    if(current?.readyState==='live')return current;
    const replacement=await acquireAudioTrack();
    const base=state.localStream||new MediaStream();
    base.getAudioTracks().forEach(item=>{try{base.removeTrack(item);}catch(_){};if(item.readyState!=='ended')item.stop();});
    base.addTrack(replacement);
    state.localStream=base;
    for(const peer of state.peers.values())await syncPeerTracks(peer);
    emit('local-stream',{stream:base,recoveredAudio:true});
    return replacement;
  };

  const acquireCameraTrack = async () => {
    const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    const track=stream.getVideoTracks()[0]||null;
    if(!track){stream.getTracks().forEach(item=>item.stop());throw new Error('No camera track was provided by the browser.');}
    return track;
  };

  const recoverCameraTrack = async () => {
    const current=state.localStream?.getVideoTracks?.()[0]||null;
    if(current?.readyState==='live')return current;
    const replacement=await acquireCameraTrack();
    const base=state.localStream||new MediaStream();
    base.getVideoTracks().forEach(track=>{try{base.removeTrack(track);}catch(_){};if(track.readyState!=='ended')track.stop();});
    base.addTrack(replacement);
    state.localStream=base;
    replacement.enabled=Boolean(state.mediaState.video);
    monitorCameraTrack(replacement);
    for(const peer of state.peers.values())await syncPeerTracks(peer);
    state.cameraRecoveryCount+=1;
    emit('local-stream',{stream:state.localStream,recovered:true});
    window.DominionRuntime?.events?.publish?.({type:'media.camera.recovered',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,payload:{recoveryCount:state.cameraRecoveryCount}});
    return replacement;
  };

  const startMedia = async ({video=true,audio=true,existingStream=null}={}) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone are not supported in this browser.');
    const wantsVideo = video !== false;
    const wantsAudio = audio !== false;
    state.mediaState={audio:wantsAudio,video:wantsVideo};
    const processedAudio=wantsAudio
      ? (audio===true?{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}:audio)
      : false;
    const requested = {video:wantsVideo ? video : false, audio:processedAudio};
    let stream=existingStream instanceof MediaStream ? existingStream : null;
    let lastError=null;
    if (!stream) {
      const attempts=[requested];
      if (wantsVideo && wantsAudio) attempts.push({video:video || true,audio:false},{video:false,audio:audio || true});
      for (const constraints of attempts) {
        try { stream=await navigator.mediaDevices.getUserMedia(constraints); break; }
        catch (error) { lastError=error; }
      }
    }
    // A partial fallback must never pretend both devices are available. Recover
    // each requested missing kind independently so audio activity and video senders
    // are real rather than UI-only state.
    if(wantsAudio && !stream.getAudioTracks().length){
      try{const extra=await navigator.mediaDevices.getUserMedia({audio:processedAudio||{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});const track=extra.getAudioTracks()[0];if(track)stream.addTrack(track);}catch(error){lastError=lastError||error;}
    }
    if(wantsVideo && !stream.getVideoTracks().length){
      try{const extra=await navigator.mediaDevices.getUserMedia({video:video||true,audio:false});const track=extra.getVideoTracks()[0];if(track)stream.addTrack(track);}catch(error){lastError=lastError||error;}
    }
    state.mediaState.audio=Boolean(wantsAudio&&stream.getAudioTracks().length);
    state.mediaState.video=Boolean(wantsVideo&&stream.getVideoTracks().length);
    if (!stream) {
      if (!wantsVideo && !wantsAudio) stream = new MediaStream();
      else throw lastError || new Error('Camera and microphone access is unavailable.');
    }
    const previous=state.localStream;
    state.localStream=stream;
    state.desiredAudio=state.mediaState.audio;
    stream.getAudioTracks().forEach(track=>{track.enabled=state.mediaState.audio;monitorAudioTrack(track);});
    stream.getVideoTracks().forEach(track=>{track.enabled=state.mediaState.video;monitorCameraTrack(track);});
    for (const peer of state.peers.values()) await syncPeerTracks(peer);
    previous?.getTracks?.().forEach(track=>{ if(!stream.getTracks().includes(track)) track.stop(); });
    emit('local-stream',{stream:state.localStream});
    await send('meet-media-state',{audio:state.mediaState.audio,video:state.mediaState.video});
    await updatePresence();
    await ready();
    for (const remoteId of state.peers.keys()) await renegotiatePeer(remoteId).catch(()=>{});
    return state.localStream;
  };

  const publishLatestAudioState = async () => {
    if(state.audioPublishInFlight){state.audioPublishPending=true;return;}
    state.audioPublishInFlight=true;
    do{
      state.audioPublishPending=false;
      const payload={audio:state.mediaState.audio,video:state.mediaState.video};
      await Promise.allSettled([send('meet-media-state',payload),updatePresence()]);
    }while(state.audioPublishPending);
    state.audioPublishInFlight=false;
  };

  const scheduleAudioStatePublish = () => {
    clearTimeout(state.audioPublishTimer);
    state.audioPublishTimer=setTimeout(()=>publishLatestAudioState().catch(()=>{}),70);
  };

  const applyLocalAudioState = (target,track,source='audio-toggle') => {
    state.mediaState.audio=Boolean(target&&track?.readyState==='live');
    if(track)track.enabled=state.mediaState.audio;
    if(!state.mediaState.audio)setSpeaking(false,0).catch(()=>{});
    emit('local-media-state',{audio:state.mediaState.audio,video:state.mediaState.video,stream:state.localStream,source});
    scheduleAudioStatePublish();
    return state.mediaState.audio;
  };

  const toggleAudio = enabled => {
    const target=Boolean(enabled);
    const seq=++state.audioToggleSeq;
    state.desiredAudio=target;
    let track=state.localStream?.getAudioTracks?.()[0]||null;
    // Muting and unmuting an existing live track is synchronous. Network state
    // publication is coalesced separately so rapid clicks never build a media
    // mutation backlog or block the control for multiple seconds.
    if(!target || track?.readyState==='live')return Promise.resolve(applyLocalAudioState(target,track));
    return queueMediaMutation(async()=>{
      if(seq!==state.audioToggleSeq)return state.mediaState.audio;
      track=await recoverAudioTrack();
      if(seq!==state.audioToggleSeq){track.enabled=state.desiredAudio;return state.mediaState.audio;}
      return applyLocalAudioState(true,track,'audio-recovered');
    });
  };
  const publishCameraState = (target,track,extra={}) => {
    state.lastCameraToggleAt=Date.now();
    emit('local-media-state',{audio:state.mediaState.audio,video:target,stream:state.localStream,...extra});
    send('meet-media-state',{audio:state.mediaState.audio,video:target}).catch(()=>{});
    updatePresence().catch(()=>{});
    window.DominionRuntime?.events?.publish?.({type:'media.camera.toggled',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,payload:{enabled:target,trackState:track?.readyState||'missing',...extra}});
  };

  // Camera intent is intentionally separated from camera acquisition. Turning video off
  // must be instantaneous and must never wait behind a recovery/renegotiation operation.
  // Turning it back on uses the existing live track when possible and only enters the
  // serialized media queue when a real track acquisition is required.
  const toggleVideo = enabled => {
    const target=Boolean(enabled);
    const seq=++state.videoToggleSeq;
    state.desiredVideo=target;
    state.mediaState.video=target;
    let track=state.localStream?.getVideoTracks?.()[0]||null;

    if(!target){
      if(track)track.enabled=false;
      publishCameraState(false,track,{intent:'user-off',seq});
      return Promise.resolve(false);
    }

    if(track?.readyState==='live'){
      track.enabled=true;
      publishCameraState(true,track,{intent:'user-on',seq,reusedTrack:true});
      return Promise.resolve(true);
    }

    return queueMediaMutation(async()=>{
      // The user may have changed their mind while getUserMedia was queued.
      if(!state.desiredVideo || seq!==state.videoToggleSeq)return false;
      try{track=await recoverCameraTrack();}
      catch(error){
        if(seq===state.videoToggleSeq){state.mediaState.video=false;state.desiredVideo=false;}
        window.DominionRuntime?.events?.publish?.({type:'media.camera.recovery.failed',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,severity:'error',payload:{message:error?.message||String(error),seq}});
        throw error;
      }
      if(!state.desiredVideo || seq!==state.videoToggleSeq){
        track.enabled=false;
        publishCameraState(false,track,{intent:'superseded',seq});
        return false;
      }
      track.enabled=true;
      state.mediaState.video=true;
      publishCameraState(true,track,{intent:'user-on',seq,recovered:true});
      return true;
    });
  };

  const shareScreen = async () => {
    if (state.screenStream) return state.screenStream;
    state.preShareVideoEnabled = state.mediaState.video;
    let desktopSelection=null;
    const desktopExpected=/(?:^|[?&])desktop=1(?:&|$)/.test(String(globalThis.location?.search||''));
    if(desktopExpected&&(!window.dominionDesktop?.isDesktop||!window.DominionDesktopSharePicker?.choose)){
      throw new Error('The DominionStar desktop capture bridge did not load. Install the latest desktop update and completely reopen the app.');
    }
    if(window.dominionDesktop?.isDesktop && window.DominionDesktopSharePicker?.choose){
      desktopSelection=await window.DominionDesktopSharePicker.choose();
      if(!desktopSelection){const cancelled=new Error('Screen sharing cancelled.');cancelled.name='AbortError';throw cancelled;}
      const accepted=await window.dominionDesktop.selectShareSource(desktopSelection.sourceId,desktopSelection.audio,desktopSelection.displayId||'',desktopSelection.kind||'',desktopSelection.sourceName||'',desktopSelection.shareOwnWindow);
      if(!accepted)throw new Error('The selected screen is no longer available. Open Share and select it again.');
    }
    // Keep the browser request standards-safe. Several Chromium/macOS versions
    // report experimental display-capture hints as NotAllowedError instead of
    // TypeError, which previously made a valid user selection look like an OS
    // permission denial. The native picker still provides screen/window/tab
    // selection and the optional audio choice.
    const desktopAudio=Boolean(desktopSelection?.audio&&window.dominionDesktop?.supportsSystemAudioShare);
    const displayOptions=desktopSelection
      ? {video:true,...(desktopAudio?{audio:true}:{})}
      : {video:true,audio:true};
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
    } catch (error) {
      if(desktopSelection){
        const status=await window.dominionDesktop?.getCaptureStatus?.().catch?.(()=>null);
        const reason=status?.lastFailure;
        if(reason==='selection-expired'||reason==='source-unavailable')throw new Error('That screen or window changed before sharing began. Open Share Screen and select it again.');
        if(reason)throw new Error(`Desktop capture could not start (${reason}). Reopen Share Screen and try again.`);
      }
      throw error;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach(item=>item.stop());
      throw new Error('No display video track was provided by the browser.');
    }
    track.contentHint = desktopSelection?.optimize ? 'motion' : 'detail';
    state.screenStream = stream;
    state.screenRemoteControlCapable=Boolean(desktopSelection?.kind==='screen');
    state.screenPaused=false;
    const cameraTrack=state.localStream?.getVideoTracks?.()[0]||null;
    if(state.preShareVideoEnabled&&cameraTrack)cameraTrack.enabled=true;
    state.mediaState.video=Boolean(state.preShareVideoEnabled&&cameraTrack);
    // Announce the display stream before SDP negotiation so both its video and
    // optional system-audio tracks are classified as presentation media.
    await send('meet-screen-state',{active:true,screenTrackId:track.id,screenStreamId:stream.id,screenAudioTrackId:stream.getAudioTracks()[0]?.id||'',remoteControlCapable:state.screenRemoteControlCapable});
    // Keep the camera sender alive and publish the display as a dedicated second video track.
    for (const [remoteId,peer] of state.peers.entries()) {
      await syncPeerTracks(peer);
      const screenSender=peer.getSenders().find(item=>item.__dsKind==='screen');
      const screenMid=peer.getTransceivers().find(item=>item.sender===screenSender)?.mid;
      // Older peers created before this build may not have a negotiated
      // presentation MID. Only those compatibility peers need renegotiation.
      if(screenMid===undefined||screenMid===null){
        await renegotiatePeer(remoteId).catch(()=>{});
      }
      const resolvedScreenMid=peer.getTransceivers().find(item=>item.sender===screenSender)?.mid;
      if(resolvedScreenMid!==undefined&&resolvedScreenMid!==null){
        await send('meet-screen-state',{to:remoteId,active:true,screenTrackId:track.id,screenStreamId:stream.id,screenMid:String(resolvedScreenMid),screenAudioTrackId:stream.getAudioTracks()[0]?.id||'',remoteControlCapable:state.screenRemoteControlCapable}).catch(()=>{});
      }
    }
    // Repeat metadata after negotiation: a receiver can otherwise get the
    // display track before it knows that the second video track is a screen.
    const screenAnnouncement={active:true,screenTrackId:track.id,screenStreamId:stream.id,screenAudioTrackId:stream.getAudioTracks()[0]?.id||'',remoteControlCapable:state.screenRemoteControlCapable};
    setTimeout(()=>send('meet-screen-state',screenAnnouncement).catch(()=>{}),250);
    setTimeout(()=>send('meet-screen-state',screenAnnouncement).catch(()=>{}),1100);
    track.addEventListener('ended',()=>stopScreenShare({source:'browser'}),{once:true});
    await send('meet-media-state',{audio:state.mediaState.audio,video:state.mediaState.video}).catch(()=>{});
    await updatePresence({screenSharing:true,video:state.mediaState.video});
    emit('screen-stream',{stream,settings:track.getSettings?.()||{}});
    return stream;
  };

  const stopScreenShare = async ({source='app'}={}) => {
    if (!state.screenStream || state.stoppingScreen) return;
    state.stoppingScreen=true;
    if(state.remoteControlAuthorizedId)await send('meet-remote-control-stop',{to:state.remoteControlAuthorizedId,reason:'sharing-ended'}).catch(()=>{});
    state.remoteControlAuthorizedId=null;
    const stream=state.screenStream;
    state.screenStream = null;
    state.screenRemoteControlCapable=false;
    state.screenPaused=false;
    stream.getTracks().forEach(track=>{ track.onended=null; if(track.readyState!=='ended')track.stop(); });
    const cameraTrack = state.localStream?.getVideoTracks()[0] || null;
    if(cameraTrack) cameraTrack.enabled=Boolean(state.preShareVideoEnabled);
    state.mediaState.video=Boolean(state.preShareVideoEnabled && cameraTrack);
    for (const [remoteId,peer] of state.peers.entries()) {
      const screenSender=peer.getSenders().find(item=>item.__dsKind==='screen');
      if(screenSender) await screenSender.replaceTrack(null).catch(()=>{});
      const screenAudioSender=peer.getSenders().find(item=>item.__dsKind==='screen-audio');
      if(screenAudioSender) await screenAudioSender.replaceTrack(null).catch(()=>{});
      const cameraSender=peer.getSenders().find(item=>item.__dsKind==='camera');
      if(cameraSender && cameraSender.track!==cameraTrack)await cameraSender.replaceTrack(cameraTrack).catch(()=>{});
      await renegotiatePeer(remoteId).catch(()=>{});
    }
    await send('meet-screen-state',{active:false});
    await send('meet-media-state',{audio:state.mediaState.audio,video:state.mediaState.video});
    await updatePresence({screenSharing:false,video:state.mediaState.video});
    await window.dominionDesktop?.endShare?.().catch?.(()=>{});
    emit('screen-ended',{source,videoRestored:state.mediaState.video});
    state.stoppingScreen=false;
  };


  const pauseScreenShare = async paused => {
    if (!state.screenStream) return false;
    state.screenPaused=Boolean(paused);
    state.screenStream.getVideoTracks().forEach(track=>track.enabled=!state.screenPaused);
    await send('meet-screen-state',{active:true,paused:state.screenPaused});
    emit('screen-paused',{paused:state.screenPaused});
    return state.screenPaused;
  };

  const activateWithoutWaitingRoom = async () => {
    if (state.isHost || state.admitted || !state.waitingRoomKnown || state.waitingRoomEnabled) return false;
    state.admitted = true;
    state.readySent = false;
    await updatePresence({admitted:true});
    emit('admitted',{automatic:true});
    await ready();
    return true;
  };

  const requirePrivileged=action=>{if(!['host','cohost'].includes(state.role))throw new Error(`Only a host or co-host can ${action}.`);};
  const requireHost=action=>{if(!state.isHost)throw new Error(`Only the host can ${action}.`);};
  const admit = async participantId => {
    requirePrivileged('admit participants');
    const existing=state.remoteMeta.get(participantId)||{};
    state.remoteMeta.set(participantId,{...existing,admitted:false});
    const admissionId=randomId('admission');
    const deliver=()=>send('meet-admitted',{to:participantId,admissionId,joinToken:existing.joinToken||''}).catch(()=>false);
    await deliver();
    setTimeout(()=>{if(state.remoteMeta.get(participantId)?.admitted!==true)deliver();},450);
    setTimeout(()=>{if(state.remoteMeta.get(participantId)?.admitted!==true)deliver();},1200);
    return admissionId;
  };
  const deny = async participantId => {requirePrivileged('decline participants');const guest=state.remoteMeta.get(participantId)||{};return send('meet-denied',{to:participantId,joinToken:guest.joinToken||''});};
  const setRole = async (participantId, role) => {
    requireHost('change participant roles');
    const nextRole=['host','cohost','attendee'].includes(role)?role:'attendee';
    let newHostUserId='';
    if(nextRole==='host'){
      newHostUserId=String(state.remoteMeta.get(participantId)?.userId||'');
      if(!newHostUserId)throw new Error('The participant account is not ready for host transfer.');
      const result=await state.client.from('meet_rooms').update({owner_id:newHostUserId,updated_at:new Date().toISOString()}).eq('room_id',state.roomId).eq('owner_id',state.userId).select('owner_id').maybeSingle();
      if(result.error||result.data?.owner_id!==newHostUserId)throw new Error('Host ownership could not be transferred. Try again after the participant reconnects.');
      state.hostUserId=newHostUserId;
    }
    const requestId=randomId('role');
    const transaction={requestId,role:nextRole};
    state.pendingRoleChanges.set(participantId,transaction);
    const deliver=()=>send('meet-role-change',{targetParticipantId:participantId,targetRole:nextRole,newHostUserId,requestId}).catch(()=>false);
    const delivered=await deliver();
    if(delivered!==false){
      const target=state.remoteMeta.get(participantId)||{};
      state.remoteMeta.set(participantId,{...target,role:nextRole,isHost:nextRole==='host'});
      emit('role-change',{role:nextRole,participantId,from:state.participantId,local:true,pending:true,requestId});
      [450,1300].forEach(delay=>setTimeout(()=>{if(state.pendingRoleChanges.get(participantId)?.requestId===requestId)deliver();},delay));
      setTimeout(()=>state.pendingRoleChanges.delete(participantId),5000);
    }else state.pendingRoleChanges.delete(participantId);
    if(nextRole==='host'&&delivered!==false){
      state.role='attendee';state.isHost=false;
      await updatePresence({role:'attendee',isHost:false,admitted:true});
      emit('role-change',{role:'attendee',participantId:state.participantId,from:state.participantId,local:true});
    }
    return delivered;
  };
  const requestRemoteControl = async participantId => {if(!['host','cohost'].includes(state.role))throw new Error('Only a host or co-host can request remote control.');const requestId=randomId('remote');state.remoteControlRequestId=requestId;await send('meet-remote-control-request',{to:participantId,requestId});return requestId;};
  const respondRemoteControl = async ({requestId,requesterId,accepted}) => {if(!state.screenStream)accepted=false;state.remoteControlAuthorizedId=accepted?requesterId:null;await send('meet-remote-control-response',{to:requesterId,requestId,accepted:Boolean(accepted)});return Boolean(accepted);};
  const sendRemoteControlInput = async (participantId,input={}) => {if(!['host','cohost'].includes(state.role))return false;return send('meet-remote-control-input',{to:participantId,input:{type:String(input.type||''),x:Number(input.x||0),y:Number(input.y||0),button:String(input.button||''),deltaX:Number(input.deltaX||0),deltaY:Number(input.deltaY||0),key:String(input.key||''),code:String(input.code||''),ctrl:Boolean(input.ctrl),alt:Boolean(input.alt),shift:Boolean(input.shift),meta:Boolean(input.meta)}});};
  const stopRemoteControl = async participantId => {state.remoteControlAuthorizedId=null;state.remoteControlRequestId=null;await send('meet-remote-control-stop',{to:participantId||''});emit('remote-control-stop',{local:true,to:participantId||''});};
  const moderate = async (participantId, action, options={}) => {
    requirePrivileged('control participant media');
    const requestId=options.requestId||randomId('mod');
    const sentAt=Date.now();
    const commandData={displayName:String(options.displayName||'').slice(0,80)};
    const targeted={to:participantId,toUserId:options.toUserId||'',action,requestId,sentAt,...commandData};
    const resilient={targetParticipantId:participantId,targetUserId:options.toUserId||'',action,requestId,sentAt,...commandData};
    const isConsentRequest=action==='request-unmute'||action==='request-camera';
    const transaction={requestId,participantId,action,sentAt,delivered:false,status:'pending',attempts:0,consentRequired:isConsentRequest};
    state.pendingModerationRequests.set(requestId,transaction);
    const dispatch=()=>{
      transaction.attempts+=1;transaction.lastAttemptAt=Date.now();
      emit('moderation-status',{requestId,status:transaction.attempts===1?'sending':'retrying',action,participantId,attempt:transaction.attempts});
      return Promise.allSettled([
      send('meet-moderation',targeted),
      send('meet-control',resilient),
      sendDirectControl(`participant-${participantId}`,resilient),
      ...(options.toUserId?[sendDirectControl(`user-${options.toUserId}`,resilient)]:[])
      ]);
    };
    await dispatch();
    const retrySchedule=isConsentRequest?[500,1400,3000]:[700,1800];
    retrySchedule.forEach(delay=>setTimeout(()=>{
      const pending=state.pendingModerationRequests.get(requestId);
      if(!pending||pending.delivered)return;
      dispatch().catch(()=>{});
    },delay));
    setTimeout(()=>{
      const pending=state.pendingModerationRequests.get(requestId);
      if(!pending)return;
      state.pendingModerationRequests.delete(requestId);
      pending.status='timed-out';
      emit('moderation-timeout',{requestId,participantId,action});
      emit('moderation-status',{requestId,status:'timed-out',action,participantId,attempts:pending.attempts});
    },isConsentRequest?12000:6500);
    return requestId;
  };
  const respondToModeration = async (payload={},accepted=false) => {
    if(!payload.requestId)return false;
    const response={
      targetParticipantId:payload.from||payload.hostParticipantId||'',
      targetUserId:payload.userId||payload.hostUserId||'',
      requestId:payload.requestId,
      action:payload.action,
      accepted:Boolean(accepted),
      responderParticipantId:state.participantId,
      responderUserId:state.userId,
      respondedAt:Date.now()
    };
    await send('meet-control-response',response);
    return true;
  };
  const broadcastModeration = async action => {requirePrivileged('control participant media');return send('meet-moderation',{action});};
  const updateSecurity = async settings => {
    requirePrivileged('change meeting security');
    state.waitingRoomKnown=true;
    if(settings&&'waitingRoom' in settings)state.waitingRoomEnabled=Boolean(settings.waitingRoom);
    return send('meet-security-state',{settings});
  };
  const chat = async (message,to='everyone') => send('meet-chat',{message:String(message||'').slice(0,2000),to:String(to||'everyone'),sentAt:Date.now()});
  const spotlight = async participantId => {requirePrivileged('spotlight participants');return send('meet-spotlight',{participantId:String(participantId||'')});};
  const publishActiveSpeaker = async participantId => {requireHost('publish the active speaker');return send('meet-active-speaker',{participantId:String(participantId||''),decidedAt:Date.now()});};
  const reaction = async symbol => send('meet-reaction',{symbol:String(symbol||'').slice(0,16)});
  const setLocalRole = async role => {
    state.role=role||'attendee';
    state.isHost=state.role==='host';
    if(state.isHost)state.admitted=true;
    await updatePresence({role:state.role,isHost:state.isHost,admitted:state.admitted});
    emit('role-change',{role:state.role,local:true});
    return state.role;
  };

  const persistMeetingActiveState = async active => {
    if (!state.client || !state.userId || !state.roomId) return false;
    try {
      const result = await state.client
        .from('meet_rooms')
.update({active:Boolean(active),updated_at:new Date().toISOString()})
        .eq('room_id',state.roomId)
        .eq('owner_id',state.userId);
      return !result?.error;
    } catch (_) {
      return false;
    }
  };

  let lastSpeakingSentAt=0;
  let lastSpeakingActive=false;
  let speakingSendInFlight=false;
  let pendingSpeakingPayload=null;
  const flushSpeakingState = async () => {
    if(speakingSendInFlight)return;
    speakingSendInFlight=true;
    while(pendingSpeakingPayload){
      const payload=pendingSpeakingPayload;
      pendingSpeakingPayload=null;
      await send('meet-speaking-state',payload).catch(()=>{});
    }
    speakingSendInFlight=false;
  };
  const setSpeaking = (active, level=0) => {
    const now=Date.now();
    active=Boolean(active&&state.mediaState.audio);
    if(active!==lastSpeakingActive || now-lastSpeakingSentAt>180){
      lastSpeakingActive=active;
      lastSpeakingSentAt=now;
      // Audio meters run several times per second. Keep only the newest sample
      // while a realtime send is pending so network latency cannot create an
      // unbounded promise backlog that freezes meeting controls.
      pendingSpeakingPayload={active,level:active?Number(level||0):0};
      flushSpeakingState().catch(()=>{});
    }
    return Promise.resolve(true);
  };

  const requestMediaResync = async participantId => send('meet-media-resync-request',{to:participantId,requestedAt:Date.now()});

  const within = (promise, milliseconds, fallback=false) => Promise.race([
    Promise.resolve(promise).catch(()=>fallback),
    new Promise(resolve=>setTimeout(()=>resolve(fallback),milliseconds))
  ]);

  const cleanup = async () => {
    state.localStream?.getTracks().forEach(track=>track.stop());
    state.screenStream?.getTracks().forEach(track=>track.stop());
    state.peers.forEach(peer=>peer.close());
    state.peers.clear();
    state.remoteStreams.clear();
    state.remoteScreenStreams.clear();
    state.remoteScreenTrackIds.clear();
    state.remoteScreenStreamIds.clear();
    state.remoteScreenMids.clear();
    state.remoteTrackStreamIds.clear();
    state.remoteTrackMids.clear();
    state.pendingCandidates.clear();
    state.pendingModerationRequests.clear();
    state.reconnectTimers.forEach(timer=>clearTimeout(timer));
    state.reconnectTimers.clear();
    clearInterval(state.roomWatchTimer);
    clearInterval(state.heartbeatTimer);
    state.roomWatchTimer = null;
    if (state.channel) await within(state.client.removeChannel(state.channel),900);
    state.channel = null;
    state.readySent = false;
  };

  const leave = async ({endForAll=false,silent=false}={}) => {
    if (state.endingMeeting) return;
    state.endingMeeting = true;
    try {
      if (endForAll && state.isHost) {
        state.meetingEnded = true;
        await within(persistMeetingActiveState(false),1100);
        const endedAt=new Date().toISOString();
        const eventId=randomId('ended');
        // Repeat the terminal event briefly before disconnecting. This avoids losing
        // the event when the host closes the realtime channel immediately after send.
        for (let attempt=0; attempt<3; attempt++) {
          await within(send('meet-ended',{endedAt,eventId,attempt}),650);
          if (attempt<2) await new Promise(resolve=>setTimeout(resolve,140));
        }
        await new Promise(resolve=>setTimeout(resolve,220));
      } else if (!silent && !state.meetingEnded && !state.departureSent) {
        state.departureSent = true;
        const departureId=randomId('left');
        // Send twice before untracking so peers receive an explicit terminal signal
        // even if presence removal and channel teardown race each other.
        for (let attempt=0; attempt<2; attempt++) {
          await within(send('meet-left',{departureId,attempt}),550);
          if (attempt===0) await new Promise(resolve=>setTimeout(resolve,90));
        }
        await within(state.channel?.untrack?.(),600);
        await new Promise(resolve=>setTimeout(resolve,140));
      }
      await cleanup();
    } finally {
      state.endingMeeting = false;
    }
  };

  const announceDeparture = () => {
    if (!state.channel || state.departureSent || state.meetingEnded || state.endingMeeting) return;
    state.departureSent = true;
    try { state.channel.send({type:'broadcast',event:'meet-left',payload:{roomId:state.roomId,from:state.participantId,userId:state.userId,instanceId:state.instanceId,sentAt:Date.now(),displayName:state.displayName}}); } catch (_) {}
    try { state.channel.untrack?.(); } catch (_) {}
  };
  window.addEventListener('pagehide', announceDeparture, {capture:true});
  window.addEventListener('beforeunload', announceDeparture, {capture:true});

  const updateIdentity = async ({displayName,avatarUrl}={}) => {
    if(displayName)state.displayName=String(displayName).slice(0,80);
    if(avatarUrl!==undefined)state.avatarUrl=String(avatarUrl||'').slice(0,1000);
    await updatePresence({displayName:state.displayName,avatarUrl:state.avatarUrl});
    await sendStateHeartbeat();
    emit('identity-updated',{displayName:state.displayName,avatarUrl:state.avatarUrl});
    return {displayName:state.displayName,avatarUrl:state.avatarUrl};
  };

  const recoverCamera = async ({reason='guardian'}={}) => queueMediaMutation(async()=>{
    if(!state.mediaState.video)return {ok:false,skipped:true,reason:'camera-disabled'};
    try{
      const track=await recoverCameraTrack();
      emit('local-media-state',{audio:state.mediaState.audio,video:true,stream:state.localStream,recovered:true,recoveryReason:reason});
      await send('meet-media-state',{audio:state.mediaState.audio,video:true}).catch(()=>{});
      await updatePresence().catch(()=>{});
      return {ok:true,trackId:track?.id||'',readyState:track?.readyState||'unknown'};
    }catch(error){
      window.DominionRuntime?.events?.publish?.({type:'media.camera.recovery.failed',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,severity:'error',payload:{reason,message:error?.message||String(error)}});
      return {ok:false,error:error?.message||String(error)};
    }
  });

  const recoverPeer = async (participantId,{reason='guardian'}={}) => {
    const remoteId=String(participantId||'');
    if(!remoteId||remoteId===state.participantId||participantIsDeparted(remoteId))return {ok:false,skipped:true,reason:'invalid-participant'};
    try{
      let peer=state.peers.get(remoteId)||null;
      // Recovery preserves a live peer and its receivers. A rendering symptom
      // must never discard transport; only a genuinely closed peer is rebuilt.
      if(peer && peer.connectionState==='closed'){discardPeerTransport(remoteId,{announceRecovery:true});peer=null;}
      if(!peer) peer=await ensurePeer(remoteId,true);
      if(!peer)return {ok:false,skipped:true,reason:'peer-unavailable'};
      peer.restartIce?.();
      await syncPeerTracks(peer);
      await renegotiatePeer(remoteId).catch(()=>{});
      state.peerRecoveryCount+=1;
      state.lastPeerRecoveryAt=Date.now();
      window.DominionRuntime?.events?.publish?.({type:'meet.peer.recovery.attempted',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,correlationId:remoteId,payload:{participantId:remoteId,reason,connectionState:peer.connectionState,recoveryCount:state.peerRecoveryCount}});
      return {ok:true,participantId:remoteId,state:peer.connectionState};
    }catch(error){
      window.DominionRuntime?.events?.publish?.({type:'meet.peer.recovery.failed',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,correlationId:remoteId,severity:'error',payload:{participantId:remoteId,reason,message:error?.message||String(error)}});
      return {ok:false,error:error?.message||String(error)};
    }
  };

  const recoverPeers = async ({reason='guardian'}={}) => {
    const ids=[...state.peers.keys()].filter(id=>!participantIsDeparted(id));
    const results=[];
    for(const id of ids){
      const peer=state.peers.get(id);
      if(!peer||['connected','connecting','new'].includes(peer.connectionState))continue;
      results.push(await recoverPeer(id,{reason}));
    }
    return {ok:results.every(item=>item.ok!==false),attempted:results.length,results};
  };

  const resyncPresence = async ({reason='guardian'}={}) => {
    try{
      await updatePresence();
      await sendStateHeartbeat();
      const members=normalizePresence(state.channel?.presenceState?.()||{}).filter(member=>member?.participantId&&!participantIsDeparted(member.participantId));
      await syncPresencePeers(members);
      window.DominionRuntime?.events?.publish?.({type:'presence.reconciled',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,payload:{reason,members:members.length}});
      return {ok:true,members:members.length};
    }catch(error){
      window.DominionRuntime?.events?.publish?.({type:'presence.reconcile.failed',source:'meeting-engine',meetingId:state.roomId,actorId:state.participantId,severity:'error',payload:{reason,message:error?.message||String(error)}});
      return {ok:false,error:error?.message||String(error)};
    }
  };

  const transcript = async ({text='',final=true,sourceLanguage='auto',startedAt=0,endedAt=0}={}) => {
    const clean=String(text||'').trim().slice(0,4000);
    if(!clean)return false;
    return send('meet-transcript',{text:clean,final:Boolean(final),sourceLanguage:String(sourceLanguage||'auto').slice(0,24),startedAt:Number(startedAt||Date.now()),endedAt:Number(endedAt||Date.now())});
  };

  const setTranscriptionActive = async (active,{language='auto'}={}) => {state.transcriptionActive=Boolean(active);state.transcriptionLanguage=String(language||'auto').slice(0,24);await send('meet-transcription-state',{active:state.transcriptionActive,language:state.transcriptionLanguage});await sendStateHeartbeat().catch(()=>{});emit('transcription-state',{active:state.transcriptionActive,language:state.transcriptionLanguage,from:state.participantId,local:true});return state.transcriptionActive;};

  const snapshot = () => ({roomId:state.roomId,displayName:state.displayName,participantId:state.participantId,userId:state.userId,hostUserId:state.hostUserId,instanceId:state.instanceId,isHost:state.isHost,role:state.role,contractLevel:state.contractLevel,avatarUrl:state.avatarUrl,mediaState:{...state.mediaState},admitted:state.admitted,waitingRoomKnown:state.waitingRoomKnown,waitingRoomEnabled:state.waitingRoomEnabled,screenStream:state.screenStream,transcriptionActive:state.transcriptionActive,transcriptionLanguage:state.transcriptionLanguage});
  const health = () => {
    const peers=[...state.peers.values()];
    const failed=peers.filter(peer=>['failed','closed'].includes(peer.connectionState)).length;
    const disconnected=peers.filter(peer=>peer.connectionState==='disconnected').length;
    const expectedRemoteVideo=[...state.remoteMeta.entries()].filter(([id,meta])=>id!==state.participantId&&meta?.admitted!==false&&meta?.video!==false);
    const missingRemoteVideo=expectedRemoteVideo.filter(([id])=>!state.remoteStreams.get(id)?.getVideoTracks?.().some(track=>track.readyState==='live'&&!track.muted));
    return {
      status:failed?'critical':disconnected||missingRemoteVideo.length||state.channelStatus!=='subscribed'?'warning':'healthy',
      roomId:state.roomId,
      connected:Boolean(state.channel)&&state.channelStatus==='subscribed',
      channelStatus:state.channelStatus,
      admitted:state.admitted,
      peerCount:peers.length,
      failedPeers:failed,
      disconnectedPeers:disconnected,
      expectedRemoteVideo:expectedRemoteVideo.length,
      missingRemoteVideo:missingRemoteVideo.length,
      missingRemoteVideoParticipants:missingRemoteVideo.map(([id])=>id),
      pendingModerationRequests:state.pendingModerationRequests.size,
      media:{audio:state.mediaState.audio,video:state.mediaState.video,screenSharing:Boolean(state.screenStream),cameraTrackState:state.localStream?.getVideoTracks?.()[0]?.readyState||'missing',cameraRecoveries:state.cameraRecoveryCount,lastCameraToggleAt:state.lastCameraToggleAt},
      recovery:{peerRecoveries:state.peerRecoveryCount,lastPeerRecoveryAt:state.lastPeerRecoveryAt}
    };
  };
  window.DominionStarMeetingEngine = {init,on,startMedia,ready,activateWithoutWaitingRoom,toggleAudio,toggleVideo,shareScreen,stopScreenShare,pauseScreenShare,admit,deny,setRole,requestRemoteControl,respondRemoteControl,sendRemoteControlInput,stopRemoteControl,moderate,respondToModeration,broadcastModeration,updateSecurity,chat,spotlight,publishActiveSpeaker,reaction,setLocalRole,setSpeaking,requestMediaResync,updateIdentity,transcript,setTranscriptionActive,recoverCamera,recoverPeer,recoverPeers,resyncPresence,leave,createRoomId,snapshot,health};
  window.DominionRuntime=window.DominionRuntime||{};
  window.DominionRuntime.meeting=window.DominionStarMeetingEngine;
})();
