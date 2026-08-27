(()=>{
  if(window.DominionWebRTCController)return;
  const desktop=window.dominionDesktop;
  const meeting=desktop?.meeting;
  if(!desktop?.isDesktop||!meeting?.context||!meeting?.sendSignal||!meeting?.pullSignals)return;

  const ICE_SERVERS=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
  const POLL_MS=350,SNAPSHOT_MS=900,SPEAKER_MS=350,RECONNECT_MS=1800;
  const state={running:false,context:null,lastSignalId:0,peers:new Map(),participants:new Map(),timers:{signals:0,snapshot:0,speaker:0},mediaUnsub:null,shareUnsub:null};
  const q=s=>document.querySelector(s);
  const esc=value=>String(value||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const initials=name=>String(name||'Participant').split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()||'P';
  const localMedia=()=>window.DominionMediaController?.stream?.()||null;
  const shareMedia=()=>window.DominionShareController?.outputStream?.()||null;

  function ensureUi(){
    const stage=q('.stage');if(!stage)return null;
    let layer=q('#remoteMediaLayer');
    if(!layer){layer=document.createElement('div');layer.id='remoteMediaLayer';layer.className='remote-media-layer';layer.innerHTML='<video id="remoteShareVideo" class="remote-share-video" autoplay playsinline></video><div id="remoteTileStrip" class="remote-tile-strip"></div>';stage.append(layer);}
    return layer;
  }
  function participantName(id){return state.participants.get(id)?.displayName||'Participant';}
  function ensureTile(id){
    ensureUi();const strip=q('#remoteTileStrip');if(!strip)return null;
    let tile=strip.querySelector(`[data-peer-id="${CSS.escape(id)}"]`);
    if(tile)return tile;
    const name=participantName(id);tile=document.createElement('article');tile.className='remote-peer-tile';tile.dataset.peerId=id;
    tile.innerHTML=`<video autoplay playsinline></video><div class="remote-peer-fallback"><span>${initials(name)}</span></div><footer><strong>${esc(name)}</strong><small>Connecting…</small></footer>`;strip.append(tile);return tile;
  }
  function updateTileIdentity(id){const tile=ensureTile(id);if(!tile)return;const name=participantName(id);tile.querySelector('strong').textContent=name;tile.querySelector('.remote-peer-fallback span').textContent=initials(name);}
  function removeTile(id){q(`#remoteTileStrip [data-peer-id="${CSS.escape(id)}"]`)?.remove();}
  function setTileState(id,text){const tile=ensureTile(id);if(tile)tile.querySelector('small').textContent=text;}
  function showRemoteCamera(id,stream){const tile=ensureTile(id);if(!tile)return;const video=tile.querySelector('video');video.srcObject=stream;video.hidden=false;tile.querySelector('.remote-peer-fallback').hidden=true;void video.play().catch(()=>{});}
  function hideRemoteCamera(id){const tile=ensureTile(id);if(!tile)return;const video=tile.querySelector('video');video.srcObject=null;video.hidden=true;tile.querySelector('.remote-peer-fallback').hidden=false;}
  function showRemoteShare(id,stream){ensureUi();const video=q('#remoteShareVideo');if(!video)return;video.dataset.peerId=id;video.srcObject=stream;video.hidden=false;document.body.classList.add('remote-share-active');void video.play().catch(()=>{});}
  function hideRemoteShare(id){const video=q('#remoteShareVideo');if(!video||String(video.dataset.peerId||'')!==String(id))return;video.srcObject=null;video.hidden=true;delete video.dataset.peerId;document.body.classList.remove('remote-share-active');}

  function createPeerRecord(remoteId){
    const pc=new RTCPeerConnection({iceServers:ICE_SERVERS,bundlePolicy:'max-bundle'});
    const record={id:remoteId,pc,transceivers:[],pendingIce:[],makingOffer:false,reconnectTimer:0,audioContext:null,analyser:null,audioSource:null,lastLevel:0};
    state.peers.set(remoteId,record);ensureTile(remoteId);
    pc.onicecandidate=event=>{if(event.candidate)void meeting.sendSignal(remoteId,'ice',{candidate:event.candidate.toJSON?.()||event.candidate}).catch(()=>{});};
    pc.ontrack=event=>handleRemoteTrack(record,event);
    pc.onconnectionstatechange=()=>{
      const status=pc.connectionState;setTileState(remoteId,status==='connected'?'Connected':status==='connecting'?'Connecting…':status);
      if(status==='failed'||status==='closed')scheduleReconnect(record,0);else if(status==='disconnected')scheduleReconnect(record,RECONNECT_MS);else if(status==='connected'){clearTimeout(record.reconnectTimer);record.reconnectTimer=0;}
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
    const audio=media?.getAudioTracks?.()[0]||null,camera=media?.getVideoTracks?.()[0]||null,screen=share?.getVideoTracks?.()[0]||null;
    await Promise.all([lanes[0]?.sender?.replaceTrack(audio),lanes[1]?.sender?.replaceTrack(camera),lanes[2]?.sender?.replaceTrack(screen)].filter(Boolean));
  }
  async function initiate(record){
    if(record.makingOffer||record.pc.signalingState!=='stable')return;
    prepareOfferer(record);await syncLocalTracks(record);record.makingOffer=true;
    try{const offer=await record.pc.createOffer();await record.pc.setLocalDescription(offer);await meeting.sendSignal(record.id,'offer',{sdp:record.pc.localDescription});}finally{record.makingOffer=false;}
  }
  async function flushIce(record){if(!record.pc.remoteDescription)return;while(record.pendingIce.length){const candidate=record.pendingIce.shift();try{await record.pc.addIceCandidate(candidate);}catch{}}}
  async function handleSignal(signal){
    const remoteId=String(signal.fromParticipantId||'');if(!remoteId||remoteId===state.context?.participantId)return;
    if(signal.type==='bye'){closePeer(remoteId);return;}
    const record=ensurePeer(remoteId),payload=signal.payload||{};
    if(signal.type==='offer'){
      if(!payload.sdp)return;await record.pc.setRemoteDescription(payload.sdp);record.transceivers=record.pc.getTransceivers().slice(0,3);await syncLocalTracks(record);await flushIce(record);
      const answer=await record.pc.createAnswer();await record.pc.setLocalDescription(answer);await meeting.sendSignal(remoteId,'answer',{sdp:record.pc.localDescription});return;
    }
    if(signal.type==='answer'){if(payload.sdp){await record.pc.setRemoteDescription(payload.sdp);await flushIce(record);}return;}
    if(signal.type==='ice'&&payload.candidate){if(record.pc.remoteDescription)await record.pc.addIceCandidate(payload.candidate).catch(()=>{});else record.pendingIce.push(payload.candidate);}
  }
  function handleRemoteTrack(record,event){
    const lanes=record.pc.getTransceivers();const index=lanes.indexOf(event.transceiver);const stream=event.streams?.[0]||new MediaStream([event.track]);
    if(index===0&&event.track.kind==='audio'){attachSpeakerMeter(record,stream);return;}
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
  function scheduleReconnect(record,delay){
    if(!state.running||record.reconnectTimer)return;record.reconnectTimer=setTimeout(()=>{record.reconnectTimer=0;const id=record.id;closePeer(id,false);if(state.participants.has(id)){const next=ensurePeer(id);if(isInitiator(id))void initiate(next).catch(()=>scheduleReconnect(next,RECONNECT_MS));}},Math.max(0,delay));
  }
  function closePeer(id,remove=true){
    const record=state.peers.get(id);if(!record)return;clearTimeout(record.reconnectTimer);try{record.pc.ontrack=null;record.pc.onicecandidate=null;record.pc.close();}catch{}try{record.audioContext?.close?.();}catch{}state.peers.delete(id);hideRemoteShare(id);if(remove)removeTile(id);
  }
  async function reconcileParticipants(){
    if(!state.context?.roomId)return;const snapshot=await meeting.snapshot(state.context.roomId);const current=new Map();
    for(const p of snapshot.participants||[]){const id=String(p.participantId||'');if(!id||id===state.context.participantId)continue;current.set(id,p);state.participants.set(id,p);updateTileIdentity(id);const peer=ensurePeer(id);if(isInitiator(id)&&peer.pc.signalingState==='stable'&&peer.pc.connectionState==='new')void initiate(peer).catch(()=>scheduleReconnect(peer,RECONNECT_MS));}
    for(const id of [...state.peers.keys()])if(!current.has(id))closePeer(id);
    for(const id of [...state.participants.keys()])if(!current.has(id))state.participants.delete(id);
  }
  async function pullSignals(){
    if(!state.running)return;try{const result=await meeting.pullSignals(state.lastSignalId,100);for(const signal of result?.signals||[])await handleSignal(signal);state.lastSignalId=Math.max(state.lastSignalId,Number(result?.lastId)||0);}catch{}
  }
  async function syncAllSenders(){for(const record of state.peers.values()){try{await syncLocalTracks(record);}catch{}}}
  async function start(){
    if(state.running)return;const context=await meeting.context();if(!context?.roomId||!context?.participantId||context.state!=='joined')return;
    state.running=true;state.context=context;state.lastSignalId=0;ensureUi();
    state.mediaUnsub=window.DominionMediaController?.onChange?.(()=>void syncAllSenders());
    state.shareUnsub=window.DominionShareController?.onChange?.(()=>void syncAllSenders());
    await reconcileParticipants().catch(()=>{});await pullSignals();
    state.timers.signals=setInterval(()=>void pullSignals(),POLL_MS);state.timers.snapshot=setInterval(()=>void reconcileParticipants(),SNAPSHOT_MS);state.timers.speaker=setInterval(sampleSpeakers,SPEAKER_MS);
  }
  async function stop(){
    if(!state.running)return;state.running=false;for(const key of Object.keys(state.timers)){clearInterval(state.timers[key]);state.timers[key]=0;}state.mediaUnsub?.();state.shareUnsub?.();state.mediaUnsub=null;state.shareUnsub=null;
    for(const id of [...state.peers.keys()]){try{await meeting.sendSignal(id,'bye',{});}catch{}closePeer(id);}state.participants.clear();state.context=null;state.lastSignalId=0;document.body.classList.remove('remote-share-active');q('#remoteMediaLayer')?.remove();
  }
  async function lifecycleProbe(){
    const inRoom=!q('#meetingOverlay')?.hidden;const context=await meeting.context().catch(()=>({}));
    if(inRoom&&context?.state==='joined'&&!state.running)void start();
    if((!inRoom||!context?.roomId)&&state.running)void stop();
  }
  setInterval(()=>void lifecycleProbe(),500);
  const api=Object.freeze({start,stop,syncLocalTracks:syncAllSenders,snapshot:()=>({running:state.running,peerCount:state.peers.size,participantId:state.context?.participantId||'',roomId:state.context?.roomId||''})});
  window.DominionWebRTCController=api;
})();
