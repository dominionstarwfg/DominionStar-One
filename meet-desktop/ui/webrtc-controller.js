(()=>{
  if(window.DominionWebRTCController)return;
  const desktop=window.dominionDesktop;
  const meeting=desktop?.meeting;
  if(!desktop?.isDesktop||!meeting?.context||!meeting?.sendSignal||!meeting?.pullSignals||!meeting?.iceConfig)return;

  const POLL_MS=350,SNAPSHOT_MS=900,SPEAKER_MS=350,RECONNECT_MS=1800,ICE_RETRY_MS=30000,REFRESH_MARGIN_MS=10*60*1000;
  const state={running:false,context:null,lastSignalId:0,peers:new Map(),participants:new Map(),timers:{signals:0,snapshot:0,speaker:0,ice:0,diagnostics:0,recovery:0},mediaUnsub:null,shareUnsub:null,effectsUnsub:null,powerUnsub:null,iceServers:[],iceExpiresAtMs:0,iceProvider:'',qaDirectOnly:false,nextStartAttemptAt:0,networkOnline:navigator.onLine!==false,recovering:false,systemSuspended:false};
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
  function setTransportStatus(text,kind=''){const badge=ensureTransportStatus();if(!badge)return;badge.textContent=text;badge.dataset.kind=kind;}
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
    if(!layer){layer=document.createElement('div');layer.id='remoteMediaLayer';layer.className='remote-media-layer';layer.innerHTML='<video id="remoteShareVideo" class="remote-share-video" autoplay playsinline></video><div id="remoteTileStrip" class="remote-tile-strip"></div><div id="remoteAudioBin" class="remote-audio-bin" aria-hidden="true"></div>';stage.append(layer);}
    ensureTransportStatus();return layer;
  }
  function participantName(id){return state.participants.get(id)?.displayName||'Participant';}
  function ensureTile(id){
    ensureUi();const strip=q('#remoteTileStrip');if(!strip)return null;
    let tile=strip.querySelector(`[data-peer-id="${CSS.escape(id)}"]`);
    if(tile)return tile;
    const name=participantName(id);tile=document.createElement('article');tile.className='remote-peer-tile';tile.dataset.peerId=id;
    tile.innerHTML=`<video autoplay playsinline></video><div class="remote-peer-fallback"><span>${initials(name)}</span></div><footer><strong>${esc(name)}</strong><small>Connecting…</small></footer>`;strip.append(tile);return tile;
  }
  function ensureAudio(id){ensureUi();const bin=q('#remoteAudioBin');if(!bin)return null;let audio=bin.querySelector(`[data-audio-peer="${CSS.escape(id)}"]`);if(!audio){audio=document.createElement('audio');audio.autoplay=true;audio.dataset.audioPeer=id;bin.append(audio);}return audio;}
  function updateTileIdentity(id){const tile=ensureTile(id);if(!tile)return;const name=participantName(id);tile.querySelector('strong').textContent=name;tile.querySelector('.remote-peer-fallback span').textContent=initials(name);}
  function removeTile(id){q(`#remoteTileStrip [data-peer-id="${CSS.escape(id)}"]`)?.remove();q(`#remoteAudioBin [data-audio-peer="${CSS.escape(id)}"]`)?.remove();}
  function setTileState(id,text){const tile=ensureTile(id);if(tile)tile.querySelector('small').textContent=text;}
  function showRemoteCamera(id,stream){const tile=ensureTile(id);if(!tile)return;const video=tile.querySelector('video');video.srcObject=stream;video.hidden=false;tile.querySelector('.remote-peer-fallback').hidden=true;void video.play().catch(()=>{});}
  function hideRemoteCamera(id){const tile=ensureTile(id);if(!tile)return;const video=tile.querySelector('video');video.srcObject=null;video.hidden=true;tile.querySelector('.remote-peer-fallback').hidden=false;}
  function showRemoteShare(id,stream){ensureUi();const video=q('#remoteShareVideo');if(!video)return;video.dataset.peerId=id;video.srcObject=stream;video.hidden=false;document.body.classList.add('remote-share-active');void video.play().catch(()=>{});}
  function hideRemoteShare(id){const video=q('#remoteShareVideo');if(!video||String(video.dataset.peerId||'')!==String(id))return;video.srcObject=null;video.hidden=true;delete video.dataset.peerId;document.body.classList.remove('remote-share-active');}
  async function playRemoteAudio(id,stream){const audio=ensureAudio(id);if(!audio)return;audio.srcObject=stream;const speakerId=window.DominionMediaController?.snapshot?.().speakerId||'';if(audio.setSinkId&&speakerId)await audio.setSinkId(speakerId).catch(()=>{});void audio.play().catch(()=>{});}

  function iceConfiguration(){return {iceServers:state.iceServers,bundlePolicy:'max-bundle',iceCandidatePoolSize:4,iceTransportPolicy:'all'};}
  function validIceConfig(){return state.iceServers.length>0&&state.iceExpiresAtMs>Date.now()+5*60*1000&&(state.qaDirectOnly||hasRelay(state.iceServers));}
  async function loadIceConfig(force=false){
    const config=await meeting.iceConfig(force,7200);
    const servers=Array.isArray(config?.iceServers)?config.iceServers:[];
    const expiresAtMs=Number(config?.expiresAtMs)||0;
    const qaDirectOnly=Boolean(config?.qaDirectOnly);
    if(!servers.length||expiresAtMs<=Date.now()+5*60*1000)throw new Error('ice_configuration_unavailable');
    if(!qaDirectOnly&&!hasRelay(servers))throw new Error('turn_relay_unavailable');
    state.iceServers=servers;state.iceExpiresAtMs=expiresAtMs;state.iceProvider=String(config?.provider||'network');state.qaDirectOnly=qaDirectOnly;
    if(qaDirectOnly)setTransportStatus('Direct QA • TURN deferred','warning');else setTransportStatus(`TURN ready • ${state.iceProvider}`,'ready');
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
      if(state.qaDirectOnly)setTransportStatus('Direct QA • TURN deferred','warning');else setTransportStatus(`TURN refreshed • ${state.iceProvider}`,'ready');
    }catch{
      setTransportStatus('Network refresh retrying','warning');
      clearTimeout(state.timers.ice);state.timers.ice=setTimeout(()=>void refreshIce(),60000);
    }
  }

  async function recoverNetwork(){
    if(!state.running||state.recovering||!state.networkOnline)return;
    state.recovering=true;clearTimeout(state.timers.recovery);state.timers.recovery=0;
    showRecovery('Reconnecting…','Your meeting is still open. Restoring secure audio, video, and screen-share transport.');
    setTransportStatus('Reconnecting network…','warning');
    try{
      await loadIceConfig(true);
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
      setTransportStatus(state.qaDirectOnly?'Direct QA connection • TURN deferred':`Network restored • ${state.iceProvider}`,'ready');
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
    const record={id:remoteId,pc,transceivers:[],pendingIce:[],makingOffer:false,reconnectTimer:0,audioContext:null,analyser:null,audioSource:null,lastLevel:0,transport:'unknown'};
    state.peers.set(remoteId,record);ensureTile(remoteId);
    pc.onicecandidate=event=>{if(event.candidate)void meeting.sendSignal(remoteId,'ice',{candidate:event.candidate.toJSON?.()||event.candidate}).catch(()=>{});};
    pc.onicecandidateerror=()=>setTransportStatus('Network path retrying','warning');
    pc.ontrack=event=>handleRemoteTrack(record,event);
    pc.onconnectionstatechange=()=>{
      const status=pc.connectionState;setTileState(remoteId,status==='connected'?'Connected':status==='connecting'?'Connecting…':status);
      if(status==='failed'||status==='closed'){showRecovery();void loadIceConfig(true).catch(()=>{});scheduleReconnect(record,0);}else if(status==='disconnected'){showRecovery();scheduleReconnect(record,RECONNECT_MS);}else if(status==='connected'){clearTimeout(record.reconnectTimer);record.reconnectTimer=0;if([...state.peers.values()].every(item=>item.pc.connectionState==='connected'))hideRecovery();}
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
      record.pc.addTransceiver('video',{direction:'sendrecv'})
    ];
  }
  function transceivers(record){if(record.transceivers.length)return record.transceivers;record.transceivers=record.pc.getTransceivers().slice(0,3);return record.transceivers;}
  async function syncLocalTracks(record){
    const lanes=transceivers(record);if(lanes.length<3)return;
    const media=localMedia(),share=shareMedia();
    const audio=media?.getAudioTracks?.()[0]||null,camera=await localCameraTrack(),screen=share?.getVideoTracks?.()[0]||null;
    await Promise.all([lanes[0]?.sender?.replaceTrack(audio),lanes[1]?.sender?.replaceTrack(camera),lanes[2]?.sender?.replaceTrack(screen)].filter(Boolean));
  }
  async function initiate(record,iceRestart=false){
    if(record.makingOffer||record.pc.signalingState!=='stable')return;
    prepareOfferer(record);await syncLocalTracks(record);record.makingOffer=true;
    try{const offer=await record.pc.createOffer(iceRestart?{iceRestart:true}:undefined);await record.pc.setLocalDescription(offer);await meeting.sendSignal(record.id,'offer',{sdp:record.pc.localDescription});}finally{record.makingOffer=false;}
  }
  async function flushIce(record){if(!record.pc.remoteDescription)return;while(record.pendingIce.length){const candidate=record.pendingIce.shift();try{await record.pc.addIceCandidate(candidate);}catch{}}}
  function dispatchMeetingSignal(signal,remoteId){
    window.dispatchEvent(new CustomEvent('dominion:meeting-signal',{detail:{id:Number(signal.id)||0,type:String(signal.type||''),fromParticipantId:remoteId,fromDisplayName:participantName(remoteId),payload:signal.payload||{},createdAt:signal.createdAt||''}}));
  }
  async function handleSignal(signal){
    const remoteId=String(signal.fromParticipantId||'');if(!remoteId||remoteId===state.context?.participantId)return;
    if(signal.type==='chat'||signal.type==='reaction'||String(signal.type||'').startsWith('host:')){dispatchMeetingSignal(signal,remoteId);return;}
    if(signal.type==='bye'){closePeer(remoteId);return;}
    let record;try{record=ensurePeer(remoteId);}catch{return;}const payload=signal.payload||{};
    if(signal.type==='offer'){
      if(!payload.sdp)return;await record.pc.setRemoteDescription(payload.sdp);record.transceivers=record.pc.getTransceivers().slice(0,3);await syncLocalTracks(record);await flushIce(record);
      const answer=await record.pc.createAnswer();await record.pc.setLocalDescription(answer);await meeting.sendSignal(remoteId,'answer',{sdp:record.pc.localDescription});return;
    }
    if(signal.type==='answer'){if(payload.sdp){await record.pc.setRemoteDescription(payload.sdp);await flushIce(record);}return;}
    if(signal.type==='ice'&&payload.candidate){if(record.pc.remoteDescription)await record.pc.addIceCandidate(payload.candidate).catch(()=>{});else record.pendingIce.push(payload.candidate);}
  }
  function handleRemoteTrack(record,event){
    const lanes=record.pc.getTransceivers();const index=lanes.indexOf(event.transceiver);const stream=event.streams?.[0]||new MediaStream([event.track]);
    if(index===0&&event.track.kind==='audio'){void playRemoteAudio(record.id,stream);attachSpeakerMeter(record,stream);event.track.onended=()=>{const audio=ensureAudio(record.id);if(audio)audio.srcObject=null;};return;}
    if(index===1&&event.track.kind==='video'){showRemoteCamera(record.id,stream);event.track.onmute=()=>hideRemoteCamera(record.id);event.track.onunmute=()=>showRemoteCamera(record.id,stream);event.track.onended=()=>hideRemoteCamera(record.id);return;}
    if(index===2&&event.track.kind==='video'){showRemoteShare(record.id,stream);event.track.onmute=()=>hideRemoteShare(record.id);event.track.onunmute=()=>showRemoteShare(record.id,stream);event.track.onended=()=>hideRemoteShare(record.id);}
  }
  function attachSpeakerMeter(record,stream){
    try{record.audioContext?.close?.();const context=new AudioContext();const source=context.createMediaStreamSource(stream);const analyser=context.createAnalyser();analyser.fftSize=512;source.connect(analyser);record.audioContext=context;record.audioSource=source;record.analyser=analyser;}catch{}
  }
  function sampleSpeakers(){
    let loudest=null,max=.012;
    for(const record of state.peers.values()){
      if(!record.analyser)continue;const data=new Uint8Array(record.analyser.fftSize);record.analyser.getByteTimeDomainData(data);let sum=0;for(const v of data){const n=(v-128)/128;sum+=n*n;}record.lastLevel=Math.sqrt(sum/data.length);if(record.lastLevel>max){max=record.lastLevel;loudest=record.id;}
    }
    document.querySelectorAll('.remote-peer-tile').forEach(tile=>tile.classList.toggle('active-speaker',tile.dataset.peerId===loudest));
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
    else if(values.includes('direct')&&state.qaDirectOnly)setTransportStatus('Direct QA connection • TURN deferred','warning');
    else if(values.includes('direct'))setTransportStatus('Direct connection • TURN standby','ready');
  }
  function scheduleReconnect(record,delay){
    if(!state.running||record.reconnectTimer)return;record.reconnectTimer=setTimeout(()=>{record.reconnectTimer=0;const id=record.id;closePeer(id,false);if(state.participants.has(id)){try{const next=ensurePeer(id);if(isInitiator(id))void initiate(next).catch(()=>scheduleReconnect(next,RECONNECT_MS));}catch{setTransportStatus('Network path unavailable','error');}}},Math.max(0,delay));
  }
  function closePeer(id,remove=true){
    const record=state.peers.get(id);if(!record)return;clearTimeout(record.reconnectTimer);try{record.pc.ontrack=null;record.pc.onicecandidate=null;record.pc.close();}catch{}try{record.audioContext?.close?.();}catch{}state.peers.delete(id);hideRemoteShare(id);if(remove)removeTile(id);
  }
  async function reconcileParticipants(){
    if(!state.context?.roomId)return;const snapshot=await meeting.snapshot(state.context.roomId);const current=new Map();
    for(const p of snapshot.participants||[]){const id=String(p.participantId||'');if(!id||id===state.context.participantId)continue;current.set(id,p);state.participants.set(id,p);updateTileIdentity(id);let peer;try{peer=ensurePeer(id);}catch{setTransportStatus('Network path unavailable','error');continue;}if(isInitiator(id)&&peer.pc.signalingState==='stable'&&peer.pc.connectionState==='new')void initiate(peer).catch(()=>scheduleReconnect(peer,RECONNECT_MS));}
    for(const id of [...state.peers.keys()])if(!current.has(id))closePeer(id);
    for(const id of [...state.participants.keys()])if(!current.has(id))state.participants.delete(id);
  }
  async function pullSignals(){
    if(!state.running)return;try{const result=await meeting.pullSignals(state.lastSignalId,100);for(const signal of result?.signals||[])await handleSignal(signal);state.lastSignalId=Math.max(state.lastSignalId,Number(result?.lastId)||0);}catch{}
  }
  async function syncAllSenders(){for(const record of state.peers.values()){try{await syncLocalTracks(record);}catch{}}const speakerId=window.DominionMediaController?.snapshot?.().speakerId||'';if(speakerId)for(const audio of document.querySelectorAll('#remoteAudioBin audio'))if(audio.setSinkId)void audio.setSinkId(speakerId).catch(()=>{});}
  async function start(){
    if(state.running||Date.now()<state.nextStartAttemptAt)return;const context=await meeting.context();if(!context?.roomId||!context?.participantId||context.state!=='joined')return;
    ensureUi();setTransportStatus('Preparing network…','pending');
    try{await loadIceConfig(false);}catch{state.nextStartAttemptAt=Date.now()+ICE_RETRY_MS;setTransportStatus('Network configuration unavailable','error');return;}
    state.running=true;state.context=context;state.lastSignalId=0;state.nextStartAttemptAt=0;state.networkOnline=navigator.onLine!==false;state.recovering=false;state.systemSuspended=false;
    state.mediaUnsub=window.DominionMediaController?.onChange?.(()=>void syncAllSenders());
    state.shareUnsub=window.DominionShareController?.onChange?.(()=>void syncAllSenders());
    state.effectsUnsub=window.DominionVideoEffects?.onChange?.(()=>void syncAllSenders());
    state.powerUnsub=desktop.power?.onChanged?.(event=>void handlePowerEvent(event));
    await reconcileParticipants().catch(()=>{});await pullSignals();
    state.timers.signals=setInterval(()=>void pullSignals(),POLL_MS);state.timers.snapshot=setInterval(()=>void reconcileParticipants(),SNAPSHOT_MS);state.timers.speaker=setInterval(sampleSpeakers,SPEAKER_MS);state.timers.diagnostics=setInterval(()=>void sampleTransports(),4000);
  }
  async function stop(){
    if(!state.running){state.context=null;hideRecovery();return;}state.running=false;for(const key of Object.keys(state.timers)){clearInterval(state.timers[key]);clearTimeout(state.timers[key]);state.timers[key]=0;}state.mediaUnsub?.();state.shareUnsub?.();state.effectsUnsub?.();state.powerUnsub?.();state.mediaUnsub=null;state.shareUnsub=null;state.effectsUnsub=null;state.powerUnsub=null;
    for(const id of [...state.peers.keys()]){try{await meeting.sendSignal(id,'bye',{});}catch{}closePeer(id);}state.participants.clear();hideRecovery();state.context=null;state.lastSignalId=0;state.iceServers=[];state.iceExpiresAtMs=0;state.iceProvider='';state.qaDirectOnly=false;document.body.classList.remove('remote-share-active');q('#remoteMediaLayer')?.remove();q('#transportStatus')?.remove();window.DominionVideoEffects?.clearTransientMeetingEffects?.();
  }
  async function lifecycleProbe(){
    const inRoom=!q('#meetingOverlay')?.hidden;const context=await meeting.context().catch(()=>({}));
    if(inRoom&&context?.state==='joined'&&!state.running&&Date.now()>=state.nextStartAttemptAt)void start();
    if((!inRoom||!context?.roomId)&&state.running)void stop();
  }
  setInterval(()=>void lifecycleProbe(),500);
  const api=Object.freeze({start,stop,recoverNetwork,syncLocalTracks:syncAllSenders,snapshot:()=>({running:state.running,recovering:state.recovering,networkOnline:state.networkOnline,systemSuspended:state.systemSuspended,peerCount:state.peers.size,participantId:state.context?.participantId||'',roomId:state.context?.roomId||'',iceReady:validIceConfig(),relayReady:hasRelay(state.iceServers),qaDirectOnly:state.qaDirectOnly,relayProvider:state.iceProvider,relayExpiresAt:state.iceExpiresAtMs})});
  window.DominionWebRTCController=api;
})();
