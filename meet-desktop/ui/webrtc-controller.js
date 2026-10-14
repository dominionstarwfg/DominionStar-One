(()=>{
  if(window.DominionWebRTCController)return;
  const desktop=window.dominionDesktop;
  const meeting=desktop?.meeting;
  if(!desktop?.isDesktop||!meeting?.context||!meeting?.sendSignal||!meeting?.pullSignals||!meeting?.iceConfig)return;

  const POLL_MS=350,SNAPSHOT_MS=900,SPEAKER_MS=350,RECONNECT_MS=1800,ICE_RETRY_MS=30000,REFRESH_MARGIN_MS=10*60*1000;
  const state={running:false,context:null,lastSignalId:0,peers:new Map(),participants:new Map(),remoteMedia:new Map(),timers:{signals:0,snapshot:0,speaker:0,ice:0,diagnostics:0,recovery:0},mediaUnsub:null,shareUnsub:null,effectsUnsub:null,powerUnsub:null,iceServers:[],iceExpiresAtMs:0,iceProvider:'',qaDirectOnly:false,relayFailure:'',nextStartAttemptAt:0,networkOnline:navigator.onLine!==false,recovering:false,systemSuspended:false,lastPresenceTouchAt:0,lastSpeakerSignature:'',generation:0,signalPull:null,snapshotPull:null,signalsProcessed:0,signalingErrors:0,lastSignalError:''};
  const q=s=>document.querySelector(s);
  const esc=value=>String(value||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const initials=name=>String(name||'Participant').split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()||'P';
  const localMedia=()=>window.DominionMediaController?.stream?.()||null;
  const shareMedia=()=>window.DominionShareController?.outputStream?.()||null;
  async function localCameraTrack(){
    const raw=localMedia()?.getVideoTracks?.()[0]||null;
    if(!raw)return null;
    const effects=window.DominionVideoEffects;
    if(!effects?.outputStream)return raw;
    try{return (await effects.outputStream(raw))?.getVideoTracks?.()[0]||raw;}catch{return raw;}
  }
  const serverUrls=server=>(Array.isArray(server?.urls)?server.urls:[server?.urls]).filter(Boolean).map(String);
  const hasRelay=servers=>(servers||[]).some(server=>serverUrls(server).some(url=>/^turns?:/i.test(url))&&Boolean(server?.username)&&Boolean(server?.credential));

  function ensureTransportStatus(){
    const head=q('.meeting-head');if(!head)return null;
    let badge=q('#transportStatus');
    if(!badge){badge=document.createElement('span');badge.id='transportStatus';badge.className='transport-status';badge.textContent='Preparing network…';head.append(badge);}
    return badge;
  }
  function setTransportStatus(text,kind=''){const badge=ensureTransportStatus();if(!badge)return;badge.textContent=text;badge.dataset.kind=kind;const remoteCount=state.participants.size;badge.hidden=remoteCount===0||kind==='ready'||kind==='pending';}
  function ensureRecoveryBanner(){
    let banner=q('#networkRecoveryBanner');if(banner)return banner;
    banner=document.createElement('div');banner.id='networkRecoveryBanner';banner.className='network-recovery-banner';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
    banner.innerHTML='<strong>Reconnecting…</strong><span>Your meeting is still open. DominionStar Meet is restoring the network connection.</span>';
    document.body.append(banner);return banner;
  }
  function showRecovery(text='Reconnecting…',copy='Your meeting is still open. DominionStar Meet is restoring the network connection.'){
    const banner=ensureRecoveryBanner();banner.querySelector('strong').textContent=text;banner.querySelector('span').textContent=copy;banner.hidden=false;
  }
  function hideRecovery(){const banner=q('#networkRecoveryBanner');if(banner)banner.hidden=true;}
  function ensureUi(){
    const stage=q('.stage');if(!stage)return null;
    let layer=q('#remoteMediaLayer');
    if(!layer){layer=document.createElement('div');layer.id='remoteMediaLayer';layer.className='remote-media-layer';layer.innerHTML='<video id="remoteShareVideo" class="remote-share-video" autoplay muted playsinline></video><div id="remoteShareBanner" class="remote-share-banner" hidden><span class="remote-share-dot"></span><strong>Participant is sharing</strong></div><div id="remoteTileStrip" class="remote-tile-strip"></div><div id="remoteAudioBin" class="remote-audio-bin" aria-hidden="true"></div>';stage.append(layer);}
    ensureTransportStatus();return layer;
  }
  function participantName(id){return state.participants.get(id)?.displayName||'Participant';}
  function ensureTile(id){
    ensureUi();const strip=q('#remoteTileStrip');if(!strip)return null;
    let tile=strip.querySelector(`[data-peer-id="${CSS.escape(id)}"]`);
    if(tile)return tile;
    const name=participantName(id);tile=document.createElement('article');tile.className='remote-peer-tile';tile.dataset.peerId=id;
    tile.innerHTML=`<video autoplay muted playsinline></video><div class="remote-peer-fallback"><span>${initials(name)}</span></div><footer><strong>${esc(name)}</strong><small>Connecting…</small></footer>`;strip.append(tile);return tile;
  }
  function ensureAudio(id){ensureUi();const bin=q('#remoteAudioBin');if(!bin)return null;let audio=bin.querySelector(`[data-audio-peer="${CSS.escape(id)}"]`);if(!audio){audio=document.createElement('audio');audio.autoplay=true;audio.dataset.audioPeer=id;bin.append(audio);}return audio;}
  function ensureShareAudio(id){ensureUi();const bin=q('#remoteAudioBin');if(!bin)return null;let audio=bin.querySelector(`[data-share-audio-peer="${CSS.escape(id)}"]`);if(!audio){audio=document.createElement('audio');audio.autoplay=true;audio.dataset.shareAudioPeer=id;bin.append(audio);}return audio;}
  function updateTileIdentity(id){const tile=ensureTile(id);if(!tile)return;const participant=state.participants.get(id)||{},name=participantName(id);tile.dataset.participantId=String(id);tile.dataset.participantSelf='0';tile.dataset.participantRole=String(participant.role||'participant').toLowerCase();tile.dataset.participantName=name;tile.querySelector('strong').textContent=name;tile.querySelector('.remote-peer-fallback span').textContent=initials(name);const share=q('#remoteShareVideo'),banner=q('#remoteShareBanner');if(share&&banner&&String(share.dataset.peerId||'')===String(id)){const label=banner.querySelector('strong');if(label)label.textContent=`${name} is sharing`;}}
  function removeTile(id){q(`#remoteTileStrip [data-peer-id="${CSS.escape(id)}"]`)?.remove();q(`#remoteAudioBin [data-audio-peer="${CSS.escape(id)}"]`)?.remove();q(`#remoteAudioBin [data-share-audio-peer="${CSS.escape(id)}"]`)?.remove();}
  function setTileState(id,text){const tile=ensureTile(id);if(tile)tile.querySelector('small').textContent=text;}
  function setRemoteMediaState(id,patch={}){
    const key=String(id||'');if(!key)return;
    const current=state.remoteMedia.get(key)||{micOn:false,cameraOn:false};
    const next={...current,...patch};if(Object.keys(patch).every(field=>current[field]===next[field]))return;state.remoteMedia.set(key,next);
    const tile=q(`#remoteTileStrip [data-peer-id="${CSS.escape(key)}"]`);if(tile){tile.dataset.micOn=next.micOn?'1':'0';tile.dataset.cameraOn=next.cameraOn?'1':'0';}
    window.dispatchEvent(new CustomEvent('dominion:remote-media-state',{detail:{participantId:key,...next}}));
  }
  function showRemoteCamera(id,stream){
    const tile=ensureTile(id);if(!tile)return;
    const video=tile.querySelector('video'),fallback=tile.querySelector('.remote-peer-fallback');
    const changed=video.srcObject!==stream;
    if(changed)video.srcObject=stream;
    // Muted preview playback is permitted without an audio-autoplay gesture.
    // The microphone's actual sound is independently attached to <audio>.
    video.muted=true;
    const reveal=()=>{
      if(video.srcObject!==stream||video.readyState<2||!video.videoWidth||!video.videoHeight)return;
      video.hidden=false;if(fallback)fallback.hidden=true;
      setRemoteMediaState(id,{cameraOn:true});
    };
    video.onloadeddata=reveal;video.onresize=reveal;
    if(changed||video.paused)void video.play().then(reveal).catch(()=>setTileState(id,'Camera playback unavailable'));
    reveal();
  }
  function hideRemoteCamera(id,ended=false){
    const tile=ensureTile(id);if(!tile)return;
    const video=tile.querySelector('video');video.onloadeddata=null;video.onresize=null;
    if(ended)video.srcObject=null;
    video.hidden=true;tile.querySelector('.remote-peer-fallback').hidden=false;
    setRemoteMediaState(id,{cameraOn:false});
  }
  function emitRemoteShareState(id,active){
    const key=String(id||'');if(!key)return;
    const tile=q(`#remoteTileStrip [data-peer-id="${CSS.escape(key)}"]`);
    if(tile){const next=active?'1':'0';if(tile.dataset.sharing===next)return;tile.dataset.sharing=next;}
    window.dispatchEvent(new CustomEvent('dominion:remote-share-state',{detail:{participantId:key,active:Boolean(active)}}));
  }
  function showRemoteShare(id,stream){
    ensureUi();const video=q('#remoteShareVideo'),banner=q('#remoteShareBanner');
    if(!video)return;
    const key=String(id),previous=String(video.dataset.peerId||'');
    if(previous&&previous!==key)emitRemoteShareState(previous,false);
    const changed=video.srcObject!==stream||previous!==key;
    if(video.srcObject!==stream)video.srcObject=stream;
    video.muted=true;video.dataset.peerId=key;
    // Receipt of ontrack/onunmute does not prove a displayed frame. Keep the
    // existing stage intact until decoding produces non-zero dimensions.
    if(changed){video.hidden=true;document.body.classList.remove('remote-share-active');if(banner)banner.hidden=true;}
    const reveal=()=>{
      if(String(video.dataset.peerId||'')!==key||video.srcObject!==stream)return;
      if(video.readyState<2||!video.videoWidth||!video.videoHeight)return;
      video.hidden=false;document.body.classList.add('remote-share-active');
      emitRemoteShareState(key,true);
      if(banner){banner.hidden=false;const label=banner.querySelector('strong');if(label)label.textContent=`${participantName(key)} is sharing`;}
    };
    video.onloadeddata=reveal;video.onresize=reveal;
    if(changed||video.paused)void video.play().then(reveal).catch(()=>setTransportStatus('Shared video playback blocked','warning'));
    reveal();
  }
  function hideRemoteShare(id,ended=true){
    const video=q('#remoteShareVideo');
    if(!video||String(video.dataset.peerId||'')!==String(id))return;
    video.onloadeddata=null;video.onresize=null;
    emitRemoteShareState(id,false);
    if(ended)video.srcObject=null;
    video.hidden=true;delete video.dataset.peerId;
    const banner=q('#remoteShareBanner');if(banner)banner.hidden=true;
    document.body.classList.remove('remote-share-active');
  }
  async function routeAudioElement(audio,stream){if(!audio)return;if(audio.srcObject!==stream)audio.srcObject=stream;const speakerId=window.DominionMediaController?.snapshot?.().speakerId||'';if(audio.setSinkId&&speakerId)await audio.setSinkId(speakerId).catch(()=>{});void audio.play().catch(()=>{});}
  async function playRemoteAudio(id,stream){return routeAudioElement(ensureAudio(id),stream);}
  async function playRemoteShareAudio(id,stream){return routeAudioElement(ensureShareAudio(id),stream);}

  function iceConfiguration(){return {iceServers:state.iceServers,bundlePolicy:'max-bundle',iceCandidatePoolSize:4,iceTransportPolicy:'all'};}
  function validIceConfig(){return state.iceServers.length>0&&state.iceExpiresAtMs>Date.now()+5*60*1000&&(state.qaDirectOnly||hasRelay(state.iceServers));}
  async function loadIceConfig(force=false){
    const config=await meeting.iceConfig(force,7200);
    const servers=Array.isArray(config?.iceServers)?config.iceServers:[];
    const expiresAtMs=Number(config?.expiresAtMs)||0;
    const qaDirectOnly=Boolean(config?.qaDirectOnly);
    if(!servers.length||expiresAtMs<=Date.now()+5*60*1000)throw new Error('ice_configuration_unavailable');
    if(!qaDirectOnly&&!hasRelay(servers))throw new Error('turn_relay_unavailable');
    state.iceServers=servers;state.iceExpiresAtMs=expiresAtMs;state.iceProvider=String(config?.provider||'network');state.qaDirectOnly=qaDirectOnly;state.relayFailure=String(config?.relayFailure||'');
    if(qaDirectOnly)setTransportStatus('TURN unavailable • direct connection only','warning');else setTransportStatus(`TURN ready • ${state.iceProvider}`,'ready');
    scheduleIceRefresh();return config;
  }
  function scheduleIceRefresh(){
    clearTimeout(state.timers.ice);state.timers.ice=0;
    if(!state.iceExpiresAtMs)return;
    const delay=state.qaDirectOnly?10*60*1000:Math.max(60000,state.iceExpiresAtMs-Date.now()-REFRESH_MARGIN_MS);
    state.timers.ice=setTimeout(()=>void refreshIce(),delay);
  }
  async function refreshIce(){
    if(!state.running)return;
    try{
      await loadIceConfig(true);
      for(const record of state.peers.values()){
        try{record.pc.setConfiguration(iceConfiguration());record.pc.restartIce();if(isInitiator(record.id))void initiate(record,true);}catch{}
      }
      if(state.qaDirectOnly)setTransportStatus('Direct connection','warning');else setTransportStatus(`TURN refreshed • ${state.iceProvider}`,'ready');
    }catch{
      setTransportStatus('Network refresh retrying','warning');
      clearTimeout(state.timers.ice);state.timers.ice=setTimeout(()=>void refreshIce(),60000);
    }
  }

  async function touchPresence(force=false){
    if(!state.running||!state.context?.participantId||!state.context?.joinToken)return false;
    const now=Date.now();if(!force&&now-state.lastPresenceTouchAt<15000)return true;
    try{
      await meeting.touchPresence(state.context.participantId,state.context.joinToken);
      state.lastPresenceTouchAt=now;return true;
    }catch{return false;}
  }

  async function recoverNetwork(){
    if(!state.running||state.recovering||!state.networkOnline)return;
    state.recovering=true;clearTimeout(state.timers.recovery);state.timers.recovery=0;
    showRecovery('Reconnecting…','Your meeting is still open. Restoring secure audio, video, and screen-share transport.');
    setTransportStatus('Reconnecting network…','warning');
    try{
      await loadIceConfig(true);
      await touchPresence(true);
      await reconcileParticipants();
      for(const record of [...state.peers.values()]){
        try{
          record.pc.setConfiguration(iceConfiguration());
          record.pc.restartIce();
          await syncLocalTracks(record);
          if(isInitiator(record.id)&&record.pc.signalingState==='stable')await initiate(record,true);
        }catch{}
      }
      await pullSignals();
      await syncAllSenders();
      setTransportStatus(state.qaDirectOnly?'Direct connection restored':`Network restored • ${state.iceProvider}`,'ready');
      hideRecovery();
    }catch{
      setTransportStatus('Reconnecting…','warning');
      state.timers.recovery=setTimeout(()=>void recoverNetwork(),2500);
    }finally{state.recovering=false;}
  }
  function handleOffline(){
    state.networkOnline=false;
    if(!state.running)return;
    showRecovery('Connection interrupted','Your meeting is still open. We will reconnect automatically when the network returns.');
    setTransportStatus('Offline • waiting for network','warning');
    for(const record of state.peers.values())setTileState(record.id,'Reconnecting…');
  }
  function handleOnline(){
    state.networkOnline=true;
    if(!state.running)return;
    clearTimeout(state.timers.recovery);state.timers.recovery=setTimeout(()=>void recoverNetwork(),120);
  }
  window.addEventListener('offline',handleOffline);
  window.addEventListener('online',handleOnline);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.running&&navigator.onLine!==false)void recoverNetwork();});

  async function handlePowerEvent(event={}){
    const type=String(event.type||'');
    if(type==='suspend'||type==='lock-screen'){
      state.systemSuspended=true;
      if(state.running){
        showRecovery(type==='suspend'?'Mac sleeping':'Screen locked','Your meeting remains open. DominionStar Meet will restore media and network transport when you return.');
        setTransportStatus(type==='suspend'?'System suspended':'Screen locked','warning');
      }
      return;
    }
    if(type==='resume'||type==='unlock-screen'){
      state.systemSuspended=false;
      if(!state.running)return;
      showRecovery('Restoring meeting…','Checking camera, microphone, participants, and secure network transport.');
      try{await window.DominionMediaController?.recoverAfterResume?.();}catch{}
      state.networkOnline=navigator.onLine!==false;
      clearTimeout(state.timers.recovery);
      state.timers.recovery=setTimeout(()=>void recoverNetwork(),220);
    }
  }

  function createPeerRecord(remoteId){
    if(!validIceConfig())throw new Error('ice_configuration_unavailable');
    const pc=new RTCPeerConnection(iceConfiguration());
    const record={id:remoteId,pc,transceivers:[],pendingIce:[],makingOffer:false,negotiationStarted:false,offerPending:false,offersSent:0,answersApplied:0,reconnectTimer:0,cameraMuteTimer:0,shareMuteTimer:0,senderSync:Promise.resolve(),cameraTrack:null,shareTrack:null,audioContext:null,analyser:null,audioSource:null,lastLevel:0,transport:'unknown'};
    state.peers.set(remoteId,record);ensureTile(remoteId);
    pc.onicecandidate=event=>{if(event.candidate)void meeting.sendSignal(remoteId,'ice',{candidate:event.candidate.toJSON?.()||event.candidate}).catch(()=>{});};
    pc.onicecandidateerror=()=>{if(pc.connectionState!=='connected')setTransportStatus('Network path retrying','warning');};
    pc.ontrack=event=>handleRemoteTrack(record,event);
    pc.onconnectionstatechange=()=>{
      const status=pc.connectionState;setTileState(remoteId,status==='connected'?'Connected':status==='connecting'?'Connecting…':status);
      if(status==='failed'){showRecovery();void loadIceConfig(true).catch(()=>{});scheduleReconnect(record,0);}else if(status==='disconnected'){showRecovery();scheduleReconnect(record,RECONNECT_MS);}else if(status==='connected'){clearTimeout(record.reconnectTimer);record.reconnectTimer=0;setTransportStatus('Network connected','ready');if([...state.peers.values()].every(item=>item.pc.connectionState==='connected'))hideRecovery();}
    };
    return record;
  }
  function ensurePeer(remoteId){return state.peers.get(remoteId)||createPeerRecord(remoteId);}
  function isInitiator(remoteId){return String(state.context?.participantId||'').localeCompare(String(remoteId))<0;}
  function prepareOfferer(record){
    if(record.transceivers.length)return;
    record.transceivers=[
      record.pc.addTransceiver('audio',{direction:'sendrecv'}),
      record.pc.addTransceiver('video',{direction:'sendrecv'}),
      record.pc.addTransceiver('video',{direction:'sendrecv'}),
      record.pc.addTransceiver('audio',{direction:'sendrecv'})
    ];
  }
  function transceivers(record){if(record.transceivers.length)return record.transceivers;record.transceivers=record.pc.getTransceivers().slice(0,4);return record.transceivers;}
  async function syncLocalTracks(record){
    // One transport owner per peer; determine the desired tracks INSIDE the
    // serialized lane operation so late camera/effects callbacks cannot undo
    // the most recent screen-sharing transition.
    const operation=record.senderSync.catch(()=>{}).then(async()=>{
      if(!state.running||state.peers.get(record.id)!==record||record.pc.signalingState==='closed')return;
      const lanes=transceivers(record);if(lanes.length<4)return;
      const media=localMedia();
      const audio=media?.getAudioTracks?.()[0]||null;
      const camera=await localCameraTrack();
      if(!state.running||state.peers.get(record.id)!==record||record.pc.signalingState==='closed')return;
      // Read the current share stream after asynchronous camera processing.
      const share=shareMedia(),shareState=window.DominionShareController?.snapshot?.()||{};
      const screen=share?.getVideoTracks?.().find(track=>track.readyState==='live')||null;
      const shareAudio=share?.getAudioTracks?.().find(track=>track.readyState==='live')||null;
      const desired=[[lanes[0],audio],[lanes[1],camera],[lanes[2],screen],[lanes[3],shareAudio]];
      for(const [lane,track] of desired){
        if(!lane?.sender||lane.sender.track===track)continue;
        await lane.sender.replaceTrack(track);
      }
      // Only the dedicated screen/video and system audio lanes inherit the
      // share-specific encoding preferences; ordinary camera must not change.
      const screenSender=lanes[2]?.sender;
      if(screenSender&&screen){try{
        const params=screenSender.getParameters();params.degradationPreference=shareState.options?.optimizeVideo?'maintain-framerate':'balanced';
        params.encodings=params.encodings?.length?params.encodings:[{}];
        params.encodings[0].maxBitrate=shareState.options?.optimizeVideo?4500000:2500000;
        await screenSender.setParameters(params);
      }catch{}}
      const audioSender=lanes[3]?.sender;
      if(audioSender&&shareAudio){try{
        const params=audioSender.getParameters();params.encodings=params.encodings?.length?params.encodings:[{}];
        params.encodings[0].maxBitrate=128000;await audioSender.setParameters(params);
      }catch{}}
    });
    record.senderSync=operation;
    return operation;
  }
  async function initiate(record,iceRestart=false){
    // Protect the entire async negotiation, including camera/effects setup.
    // Merely receiving an SDP answer does not mean ICE is connected; a 900-ms
    // participant refresh must not start a second offer in that interval.
    if(record.makingOffer||record.offerPending||record.pc.signalingState!=='stable')return false;
    if(record.negotiationStarted&&!iceRestart)return false;
    record.makingOffer=true;
    record.negotiationStarted=true;
    try{
      prepareOfferer(record);
      await syncLocalTracks(record);
      if(!state.running||state.peers.get(record.id)!==record||record.pc.signalingState!=='stable')return false;
      const offer=await record.pc.createOffer(iceRestart?{iceRestart:true}:undefined);
      await record.pc.setLocalDescription(offer);
      record.offerPending=true;
      await meeting.sendSignal(record.id,'offer',{sdp:record.pc.localDescription});
      record.offersSent++;
      return true;
    }catch(error){
      record.offerPending=false;
      // Failed negotiation must be recovered by replacing the peer, not by
      // immediately sending another offer over the half-open SDP state.
      if(state.running&&state.peers.get(record.id)===record)scheduleReconnect(record,RECONNECT_MS);
      throw error;
    }finally{record.makingOffer=false;}
  }
  async function flushIce(record){if(!record.pc.remoteDescription)return;while(record.pendingIce.length){const candidate=record.pendingIce.shift();try{await record.pc.addIceCandidate(candidate);}catch{}}}
  function dispatchMeetingSignal(signal,remoteId){
    window.dispatchEvent(new CustomEvent('dominion:meeting-signal',{detail:{id:Number(signal.id)||0,type:String(signal.type||''),fromParticipantId:remoteId,fromDisplayName:participantName(remoteId),payload:signal.payload||{},createdAt:signal.createdAt||''}}));
  }
  const APPLICATION_SIGNAL_TYPES=new Set(['chat','reaction','caption','caption-request','recording-state','poll:start','poll:vote','poll:end']);
  async function handleSignal(signal){
    const remoteId=String(signal.fromParticipantId||'');if(!remoteId||remoteId===state.context?.participantId)return;
    const signalType=String(signal.type||'');
    if(APPLICATION_SIGNAL_TYPES.has(signalType)||signalType.startsWith('host:')){dispatchMeetingSignal(signal,remoteId);return;}
    if(signal.type==='bye'){closePeer(remoteId);return;}
    let record;try{record=ensurePeer(remoteId);}catch{return;}const payload=signal.payload||{};
    if(signal.type==='offer'){
      if(!payload.sdp)return;await record.pc.setRemoteDescription(payload.sdp);record.transceivers=record.pc.getTransceivers().slice(0,4);for(const lane of record.transceivers)if(lane?.direction==='recvonly')lane.direction='sendrecv';await syncLocalTracks(record);await flushIce(record);
      const answer=await record.pc.createAnswer();await record.pc.setLocalDescription(answer);await meeting.sendSignal(remoteId,'answer',{sdp:record.pc.localDescription});return;
    }
    if(signal.type==='answer'){
      if(!payload.sdp||!record.offerPending||record.pc.signalingState!=='have-local-offer')return;
      await record.pc.setRemoteDescription(payload.sdp);
      record.offerPending=false;record.answersApplied++;
      await flushIce(record);return;
    }
    if(signal.type==='ice'&&payload.candidate){if(record.pc.remoteDescription)await record.pc.addIceCandidate(payload.candidate).catch(()=>{});else record.pendingIce.push(payload.candidate);}
  }
  function handleRemoteTrack(record,event){
    const lanes=record.pc.getTransceivers(),index=lanes.indexOf(event.transceiver);
    const stream=event.streams?.[0]||new MediaStream([event.track]);
    if(index===0&&event.track.kind==='audio'){
      void playRemoteAudio(record.id,stream);attachSpeakerMeter(record,stream);
      setRemoteMediaState(record.id,{micOn:!event.track.muted&&event.track.readyState==='live'});
      event.track.onmute=()=>setRemoteMediaState(record.id,{micOn:false});
      event.track.onunmute=()=>setRemoteMediaState(record.id,{micOn:true});
      event.track.onended=()=>{const audio=ensureAudio(record.id);if(audio)audio.srcObject=null;setRemoteMediaState(record.id,{micOn:false});};
      return;
    }
    if(index===1&&event.track.kind==='video'){
      clearTimeout(record.cameraMuteTimer);record.cameraTrack=event.track;
      if(event.track.muted)hideRemoteCamera(record.id);else showRemoteCamera(record.id,stream);
      event.track.onmute=()=>{clearTimeout(record.cameraMuteTimer);record.cameraMuteTimer=setTimeout(()=>{
        if(record.cameraTrack===event.track&&event.track.muted)hideRemoteCamera(record.id);
      },900);};
      event.track.onunmute=()=>{clearTimeout(record.cameraMuteTimer);if(record.cameraTrack===event.track)showRemoteCamera(record.id,stream);};
      event.track.onended=()=>{clearTimeout(record.cameraMuteTimer);if(record.cameraTrack===event.track)hideRemoteCamera(record.id,true);};
      return;
    }
    if(index===2&&event.track.kind==='video'){
      clearTimeout(record.shareMuteTimer);record.shareTrack=event.track;
      if(event.track.muted)hideRemoteShare(record.id,false);else showRemoteShare(record.id,stream);
      event.track.onmute=()=>{clearTimeout(record.shareMuteTimer);record.shareMuteTimer=setTimeout(()=>{
        if(record.shareTrack===event.track&&event.track.muted)hideRemoteShare(record.id,false);
      },900);};
      event.track.onunmute=()=>{clearTimeout(record.shareMuteTimer);if(record.shareTrack===event.track)showRemoteShare(record.id,stream);};
      event.track.onended=()=>{clearTimeout(record.shareMuteTimer);if(record.shareTrack===event.track)hideRemoteShare(record.id,true);};
      return;
    }
    if(index===3&&event.track.kind==='audio'){
      void playRemoteShareAudio(record.id,stream);
      event.track.onended=()=>{const audio=ensureShareAudio(record.id);if(audio)audio.srcObject=null;};
    }
  }
  function attachSpeakerMeter(record,stream){
    try{record.audioContext?.close?.();const context=new AudioContext();const source=context.createMediaStreamSource(stream);const analyser=context.createAnalyser();analyser.fftSize=512;source.connect(analyser);record.audioContext=context;record.audioSource=source;record.analyser=analyser;}catch{}
  }
  function sampleSpeakers(){
    const ranked=[];
    for(const record of state.peers.values()){
      if(!record.analyser)continue;
      const data=new Uint8Array(record.analyser.fftSize);record.analyser.getByteTimeDomainData(data);let sum=0;
      for(const v of data){const n=(v-128)/128;sum+=n*n;}
      record.lastLevel=Math.sqrt(sum/data.length);if(record.lastLevel>.012)ranked.push({id:record.id,level:record.lastLevel});
    }
    ranked.sort((a,b)=>b.level-a.level);const top=ranked.slice(0,4),loudest=top[0]?.id||'';
    document.querySelectorAll('.remote-peer-tile').forEach(tile=>{
      const id=String(tile.dataset.peerId||''),rank=top.findIndex(item=>item.id===id),level=top[rank]?.level||0;
      tile.classList.toggle('active-speaker',id===loudest);tile.style.setProperty('--speaker-level',String(Math.max(0,Math.min(1,level/.12))));
      for(let i=1;i<=4;i++)tile.classList.toggle(`active-speaker-rank-${i}`,rank===i-1);
    });
    const sharingPeer=String(document.querySelector('#remoteShareVideo')?.dataset.peerId||'');
    document.body.classList.toggle('ds-remote-share-speaker-active',Boolean(loudest&&sharingPeer&&loudest===sharingPeer));
    const signature=top.map(item=>item.id).join('|');if(signature!==state.lastSpeakerSignature){state.lastSpeakerSignature=signature;window.dispatchEvent(new CustomEvent('dominion:active-speakers',{detail:{participantIds:top.map(item=>item.id),loudestId:loudest}}));}
  }
  async function sampleTransport(record){
    try{
      const stats=await record.pc.getStats();let pair=null;
      stats.forEach(report=>{if(report.type==='candidate-pair'&&report.state==='succeeded'&&(report.nominated||!pair))pair=report;});
      if(!pair)return;const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);const relay=local?.candidateType==='relay'||remote?.candidateType==='relay';record.transport=relay?'relay':'direct';
    }catch{}
  }
  async function sampleTransports(){
    for(const record of state.peers.values())await sampleTransport(record);
    const values=[...state.peers.values()].map(record=>record.transport);
    if(values.includes('relay'))setTransportStatus('Connected via TURN relay','relay');
    else if(values.includes('direct')&&state.qaDirectOnly)setTransportStatus('Direct connection restored','warning');
    else if(values.includes('direct'))setTransportStatus('Direct connection • TURN standby','ready');
  }
  function scheduleReconnect(record,delay){
    if(!state.running||record.reconnectTimer)return;record.reconnectTimer=setTimeout(()=>{record.reconnectTimer=0;const id=record.id;closePeer(id,false);if(state.participants.has(id)){try{const next=ensurePeer(id);if(isInitiator(id))void initiate(next).catch(()=>scheduleReconnect(next,RECONNECT_MS));}catch{setTransportStatus('Network path unavailable','error');}}},Math.max(0,delay));
  }
  function closePeer(id,remove=true){
    const record=state.peers.get(id);if(!record)return;clearTimeout(record.reconnectTimer);clearTimeout(record.cameraMuteTimer);clearTimeout(record.shareMuteTimer);try{record.pc.ontrack=null;record.pc.onicecandidate=null;record.pc.onicecandidateerror=null;record.pc.onconnectionstatechange=null;record.pc.close();}catch{}try{record.audioContext?.close?.();}catch{}state.peers.delete(id);state.remoteMedia.delete(String(id));window.dispatchEvent(new CustomEvent('dominion:remote-media-state',{detail:{participantId:String(id),micOn:false,cameraOn:false,disconnected:true}}));hideRemoteShare(id);if(remove)removeTile(id);
  }
  async function reconcileParticipants(){
    if(!state.running||!state.context?.roomId)return;
    if(state.snapshotPull)return state.snapshotPull;
    const generation=state.generation,roomId=state.context.roomId;
    const operation=(async()=>{
      try{
        await touchPresence();
        const snapshot=await meeting.snapshot(roomId);
        if(!state.running||state.generation!==generation||state.context?.roomId!==roomId)return;
        const current=new Map();
        for(const p of snapshot.participants||[]){
          const id=String(p.participantId||'');
          if(!id||id===state.context.participantId)continue;
          current.set(id,p);state.participants.set(id,p);updateTileIdentity(id);
          let peer;try{peer=ensurePeer(id);}catch{setTransportStatus('Network path unavailable','error');continue;}
          if(isInitiator(id)&&!peer.negotiationStarted&&!peer.makingOffer&&peer.pc.signalingState==='stable'&&peer.pc.connectionState==='new')
            void initiate(peer).catch(()=>scheduleReconnect(peer,RECONNECT_MS));
        }
        for(const id of [...state.peers.keys()])if(!current.has(id))closePeer(id);
        for(const id of [...state.participants.keys()])if(!current.has(id))state.participants.delete(id);
      }catch(error){state.lastSignalError='presence_poll_failed';}
    })();
    state.snapshotPull=operation;
    try{return await operation;}finally{if(state.snapshotPull===operation)state.snapshotPull=null;}
  }
  async function pullSignals(){
    if(!state.running)return;
    // Signaling is an ordered stream. Overlapping 350-ms poll responses can
    // replay offers and ICE candidates while a previous offer is still being
    // applied, leaving the receiver without a valid track.
    if(state.signalPull)return state.signalPull;
    const generation=state.generation;
    const operation=(async()=>{
      try{
        const result=await meeting.pullSignals(state.lastSignalId,100);
        if(!state.running||state.generation!==generation)return;
        const signals=Array.isArray(result?.signals)?[...result.signals]:[];
        signals.sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));
        for(const signal of signals){
          if(!state.running||state.generation!==generation)return;
          const id=Number(signal.id)||0;
          if(id&&id<=state.lastSignalId)continue;
          try{
            await handleSignal(signal);
            if(id)state.lastSignalId=Math.max(state.lastSignalId,id);
            state.signalsProcessed+=1;state.lastSignalError='';
          }catch(error){
            state.signalingErrors+=1;
            state.lastSignalError=String(signal.type||'unknown')+'_processing_failed';
            // Preserve the cursor at the previous accepted signal; retry the
            // failed negotiation before any later message in the batch.
            return;
          }
        }
        state.lastSignalId=Math.max(state.lastSignalId,Number(result?.lastId)||0);
      }catch(error){state.signalingErrors+=1;state.lastSignalError='signal_poll_failed';}
    })();
    state.signalPull=operation;
    try{return await operation;}finally{if(state.signalPull===operation)state.signalPull=null;}
  }
  async function syncAllSenders(){for(const record of state.peers.values()){try{await syncLocalTracks(record);}catch{}}const speakerId=window.DominionMediaController?.snapshot?.().speakerId||'';if(speakerId)for(const audio of document.querySelectorAll('#remoteAudioBin audio'))if(audio.setSinkId)void audio.setSinkId(speakerId).catch(()=>{});}
  async function start(){
    if(state.running||Date.now()<state.nextStartAttemptAt)return;const context=await meeting.context();if(!context?.roomId||!context?.participantId||context.state!=='joined')return;
    ensureUi();setTransportStatus('Preparing network…','pending');
    try{await loadIceConfig(false);}catch{state.nextStartAttemptAt=Date.now()+ICE_RETRY_MS;setTransportStatus('Network relay unavailable','warning');return;}
    state.running=true;state.generation+=1;state.context=context;state.lastSignalId=0;state.signalsProcessed=0;state.signalingErrors=0;state.lastSignalError='';state.lastSpeakerSignature='';state.nextStartAttemptAt=0;state.networkOnline=navigator.onLine!==false;state.recovering=false;state.systemSuspended=false;state.lastPresenceTouchAt=0;
    state.mediaUnsub=window.DominionMediaController?.onChange?.(()=>void syncAllSenders());
    state.shareUnsub=window.DominionShareController?.onChange?.(()=>void syncAllSenders());
    state.effectsUnsub=window.DominionVideoEffects?.onChange?.(()=>void syncAllSenders());
    state.powerUnsub=desktop.power?.onChanged?.(event=>void handlePowerEvent(event));
    await touchPresence(true);await reconcileParticipants().catch(()=>{});await pullSignals();
    state.timers.signals=setInterval(()=>void pullSignals(),POLL_MS);state.timers.snapshot=setInterval(()=>void reconcileParticipants(),SNAPSHOT_MS);state.timers.speaker=setInterval(sampleSpeakers,SPEAKER_MS);state.timers.diagnostics=setInterval(()=>void sampleTransports(),4000);
  }
  async function stop(){
    if(!state.running){state.context=null;hideRecovery();return;}state.running=false;state.generation+=1;state.signalPull=null;state.snapshotPull=null;for(const key of Object.keys(state.timers)){clearInterval(state.timers[key]);clearTimeout(state.timers[key]);state.timers[key]=0;}state.mediaUnsub?.();state.shareUnsub?.();state.effectsUnsub?.();state.powerUnsub?.();state.mediaUnsub=null;state.shareUnsub=null;state.effectsUnsub=null;state.powerUnsub=null;
    for(const id of [...state.peers.keys()]){try{await meeting.sendSignal(id,'bye',{});}catch{}closePeer(id);}state.participants.clear();state.remoteMedia.clear();hideRecovery();state.context=null;state.lastSignalId=0;state.lastPresenceTouchAt=0;state.lastSpeakerSignature='';state.iceServers=[];state.iceExpiresAtMs=0;state.iceProvider='';state.qaDirectOnly=false;state.relayFailure='';document.body.classList.remove('remote-share-active');q('#remoteMediaLayer')?.remove();q('#transportStatus')?.remove();window.DominionVideoEffects?.clearTransientMeetingEffects?.();
  }
  // Explicit QA snapshot: safe counters and track states only. Excludes
  // session tokens, SDP, IP addresses and ICE server credentials.
  // Capture one on BOTH machines before and after starting a screen share.
  async function diagnosticSnapshot(){
    const stream=shareMedia();
    const element=(selector)=>{
      const video=q(selector);if(!video)return null;
      return {present:true,hidden:video.hidden,paused:video.paused,
        readyState:video.readyState,videoWidth:video.videoWidth,
        videoHeight:video.videoHeight,currentTime:Number(video.currentTime)||0,
        streamTracks:video.srcObject?.getTracks?.().map(t=>({
          kind:t.kind,readyState:t.readyState,muted:t.muted,enabled:t.enabled
        }))||[]};
    };
    const peers=[];
    for(const record of state.peers.values()){
      const reports=[];
      try{
        const stats=await record.pc.getStats();
        stats.forEach(report=>{
          if(!['inbound-rtp','outbound-rtp'].includes(report.type))return;
          reports.push({direction:report.type,kind:report.kind||report.mediaType||'unknown',
            bytesSent:Number(report.bytesSent)||0,bytesReceived:Number(report.bytesReceived)||0,
            framesSent:Number(report.framesSent)||0,framesEncoded:Number(report.framesEncoded)||0,
            framesReceived:Number(report.framesReceived)||0,framesDecoded:Number(report.framesDecoded)||0,
            packetsLost:Number(report.packetsLost)||0});
        });
      }catch(error){reports.push({error:String(error?.message||'getStats_failed')});}
      const laneStats=async(endpoint,direction)=>{
        if(!endpoint?.getStats)return null;
        try{
          const collection=await endpoint.getStats();
          const summary={bytes:0,packets:0,frames:0,framesEncoded:0,framesDecoded:0,packetsLost:0,hasRtp:false};
          collection.forEach(report=>{
            if(report.type!==(direction==='sender'?'outbound-rtp':'inbound-rtp')||report.isRemote===true)return;
            summary.hasRtp=true;
            summary.bytes+=Number(direction==='sender'?report.bytesSent:report.bytesReceived)||0;
            summary.packets+=Number(direction==='sender'?report.packetsSent:report.packetsReceived)||0;
            summary.frames+=Number(direction==='sender'?report.framesSent:report.framesReceived)||0;
            summary.framesEncoded+=Number(report.framesEncoded)||0;
            summary.framesDecoded+=Number(report.framesDecoded)||0;
            summary.packetsLost+=Number(report.packetsLost)||0;
          });
          return summary;
        }catch{return {error:'stats_unavailable'};}
      };
      const lanes=await Promise.all(record.pc.getTransceivers().slice(0,4).map(async(lane,index)=>({
        lane:['microphone','camera','screen','systemAudio'][index]||String(index),
        sender:lane.sender?.track?{kind:lane.sender.track.kind,readyState:lane.sender.track.readyState,
          muted:lane.sender.track.muted,enabled:lane.sender.track.enabled}:null,
        receiver:lane.receiver?.track?{kind:lane.receiver.track.kind,readyState:lane.receiver.track.readyState,
          muted:lane.receiver.track.muted,enabled:lane.receiver.track.enabled}:null,
        outbound:await laneStats(lane.sender,'sender'),
        inbound:await laneStats(lane.receiver,'receiver')
      })));
      peers.push({peerId:record.id,connectionState:record.pc.connectionState,
        iceConnectionState:record.pc.iceConnectionState,signalingState:record.pc.signalingState,
        selectedPath:record.transport,negotiation:{offerPending:record.offerPending,makingOffer:record.makingOffer,offersSent:record.offersSent,answersApplied:record.answersApplied},lanes,reports});
    }
    return {at:new Date().toISOString(),surface:desktop?.isBrowserMeet?'web':'desktop',running:state.running,networkOnline:state.networkOnline,ice:{provider:state.iceProvider,directOnly:state.qaDirectOnly,relayFailure:state.relayFailure},signaling:{processed:state.signalsProcessed,errors:state.signalingErrors,lastError:state.lastSignalError,pollInFlight:Boolean(state.signalPull),lastCursor:state.lastSignalId},
      shareCaptureTracks:stream?.getTracks?.().map(track=>({
        kind:track.kind,readyState:track.readyState,muted:track.muted,enabled:track.enabled
      }))||[],
      remoteShareElement:element('#remoteShareVideo'),remoteCameraElements:[...document.querySelectorAll('#remoteTileStrip .remote-peer-tile')].map(tile=>({
        peerId:String(tile.dataset.peerId||''),video:{
          hidden:tile.querySelector('video')?.hidden,
          readyState:tile.querySelector('video')?.readyState,
          videoWidth:tile.querySelector('video')?.videoWidth,
          currentTime:Number(tile.querySelector('video')?.currentTime)||0
        }
      })),peers};
  }
  async function lifecycleProbe(){
    const inRoom=!q('#meetingOverlay')?.hidden;const context=await meeting.context().catch(()=>({}));
    if(inRoom&&context?.state==='joined'&&!state.running&&Date.now()>=state.nextStartAttemptAt)void start();
    if((!inRoom||!context?.roomId)&&state.running)void stop();
  }
  setInterval(()=>void lifecycleProbe(),500);
  const api=Object.freeze({start,stop,recoverNetwork,touchPresence,diagnosticSnapshot,syncLocalTracks:syncAllSenders,snapshot:()=>({running:state.running,recovering:state.recovering,networkOnline:state.networkOnline,systemSuspended:state.systemSuspended,lastPresenceTouchAt:state.lastPresenceTouchAt,peerCount:state.peers.size,participantId:state.context?.participantId||'',roomId:state.context?.roomId||'',iceReady:validIceConfig(),relayReady:hasRelay(state.iceServers),qaDirectOnly:state.qaDirectOnly,relayProvider:state.iceProvider,relayFailure:state.relayFailure,relayExpiresAt:state.iceExpiresAtMs})});
  window.DominionWebRTCController=api;
})();
