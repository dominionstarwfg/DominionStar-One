(()=>{
  if(window.DominionMeetingFeatures)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const reactions=['👏','👍','❤️','😂','😮','🎉'];
  const state={messages:[],reactionMenu:null,reactions:new Map(),reactionTimers:new Map(),raisedHands:new Map(),localHandRaised:false,meetingSnapshot:null,remoteRecorders:new Map(),recordingNoticeSeen:new Set(),recordingConsent:null,lastRecordingAllowed:null,recording:false,recordingPaused:false,recorder:null,recordChunks:[],recordStream:null,recordCanvas:null,recordFrame:0,audioContext:null};
  if(!document.querySelector('link[href="./meeting-features.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./meeting-features.css';document.head.append(link);}
  const esc=value=>String(value||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const nowLabel=value=>{try{return new Date(value||Date.now()).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}catch{return ''}};
  const localName=()=>String(q('#profileName')?.textContent||q('#stageName')?.textContent||'You').trim()||'You';
  const inMeeting=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);

  async function peers(){
    if(!meeting?.context||!meeting?.snapshot)return [];
    const ctx=await meeting.context();if(!ctx?.roomId)return [];
    const snap=await meeting.snapshot(ctx.roomId);return (snap?.participants||[]).filter(p=>String(p.participantId||'')&&String(p.participantId)!==String(ctx.participantId||'')&&['admitted','joined'].includes(String(p.state||'joined')));
  }
  async function broadcast(type,payload){
    if(!meeting?.sendSignal)return;
    const list=await peers();await Promise.allSettled(list.map(p=>meeting.sendSignal(p.participantId,type,payload)));
  }

  function ensureUi(){
    const overlay=q('#meetingOverlay'),body=q('.meeting-body'),footer=q('.meeting-footer'),exit=q('#roomExitButton');if(!overlay||!body||!footer||!exit)return false;
    if(!q('#meetingChatPanel')){
      const panel=document.createElement('aside');panel.id='meetingChatPanel';panel.className='meeting-chat-panel';panel.hidden=true;panel.innerHTML='<header><div><strong>Chat</strong><small>In-meeting messages</small></div><button type="button" data-chat-close aria-label="Close chat">×</button></header><div class="meeting-chat-recipient"><span>To:</span><select id="meetingChatRecipient" aria-label="Chat recipient"><option value="everyone">Everyone</option></select></div><div id="meetingChatMessages" class="meeting-chat-messages"><div class="meeting-chat-empty">Send a message to everyone or choose a participant for a direct message.</div></div><form id="meetingChatForm" class="meeting-chat-form"><textarea id="meetingChatInput" maxlength="2000" rows="2" autocomplete="off" placeholder="Type message here…"></textarea><button type="submit" aria-label="Send message">Send</button></form>';body.append(panel);panel.querySelector('[data-chat-close]').onclick=()=>toggleChat(false);panel.querySelector('form').onsubmit=sendChat;panel.querySelector('#meetingChatInput').addEventListener('keydown',event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();panel.querySelector("form").requestSubmit();}});
    }
    if(!q('#meetingReactionLayer')){const layer=document.createElement('div');layer.id='meetingReactionLayer';layer.className='meeting-reaction-layer';body.append(layer);}
    if(!q('#meetingRecordingIndicator')){const indicator=document.createElement('div');indicator.id='meetingRecordingIndicator';indicator.className='meeting-recording-indicator';indicator.hidden=true;indicator.innerHTML='<i></i><span>Recording</span><small id="meetingRecordingOwner"></small>';body.append(indicator);}
    if(!q('#meetingRecordingConsent')){const dialog=document.createElement('dialog');dialog.id='meetingRecordingConsent';dialog.className='meeting-recording-consent';dialog.innerHTML='<div class="recording-consent-card"><span class="recording-consent-orbit"><i></i></span><div><p>RECORDING NOTICE</p><h3>This meeting is being recorded</h3><span id="meetingRecordingConsentCopy">A participant started a local recording.</span></div><div class="recording-consent-actions"><button type="button" data-recording-leave class="danger">Leave Meeting</button><button type="button" data-recording-accept class="primary">Continue</button></div></div>';body.append(dialog);dialog.querySelector('[data-recording-accept]').onclick=()=>dialog.close();dialog.querySelector('[data-recording-leave]').onclick=()=>{dialog.close();q('#roomExitButton')?.click();};}
    const ensureButton=(id,label,before,handler)=>{let b=q(`#${id}`);if(b)return b;b=document.createElement('button');b.id=id;b.type='button';b.className='meeting-control';b.textContent=label;b.onclick=handler;footer.insertBefore(b,before||exit);return b;};
    ensureButton('roomChat','Chat',q('#roomSettings')||exit,()=>toggleChat());
    const recordButton=ensureButton('roomRecord','Record',q('#roomSettings')||exit,()=>void toggleRecording());
    const stopButton=ensureButton('roomRecordStop','Stop',q('#roomSettings')||exit,()=>void stopRecording());stopButton.classList.add('recording-stop-control');stopButton.hidden=!state.recording;
    ensureButton('roomReactions','Reactions',q('#roomSettings')||exit,event=>openReactions(event.currentTarget));
    window.DominionMeetingParity?.decorateControls?.();
    return true;
  }

  function toggleChat(force){ensureUi();const panel=q('#meetingChatPanel'),button=q('#roomChat');if(!panel)return;const show=typeof force==='boolean'?force:panel.hidden;panel.hidden=!show;button?.setAttribute('aria-pressed',String(show));if(show){void window.DominionZoomBehavior?.refreshChatRecipients?.();requestAnimationFrame(()=>q('#meetingChatInput')?.focus());}return show;}
    function renderMessages(){const box=q('#meetingChatMessages');if(!box)return;if(!state.messages.length){box.innerHTML='<div class="meeting-chat-empty">Send a message to everyone or choose a participant for a direct message.</div>';return;}box.innerHTML=state.messages.slice(-200).map(m=>`<article class="meeting-chat-message${m.own?' own':''}${m.private?' private':''}"><div class="meeting-chat-meta"><strong>${esc(m.own?'You':m.name)}</strong>${m.private?`<span>Direct Message${m.toName?` · ${esc(m.toName)}`:''}</span>`:''}</div><p>${esc(m.text)}</p><time>${esc(nowLabel(m.at))}</time></article>`).join('');box.scrollTop=box.scrollHeight;}
  function appendMessage(message){state.messages.push(message);renderMessages();if(!message.own&&q('#meetingChatPanel')?.hidden)window.DominionMeetingNotifications?.chat?.(message.name||'Participant');}
  async function sendChat(event){event?.preventDefault?.();const input=q('#meetingChatInput'),recipient=q('#meetingChatRecipient'),text=String(input?.value||'').trim();if(!text)return;input.value='';const target=String(recipient?.value||'everyone'),selected=recipient?.selectedOptions?.[0],privateMessage=target!=='everyone',toName=privateMessage?String(selected?.textContent||'').replace(/\s*·\s*Direct Message\s*$/,''):'';const payload={text:text.slice(0,2000),name:localName(),at:new Date().toISOString(),private:privateMessage,toParticipantId:privateMessage?target:'',toName};appendMessage({...payload,own:true});if(privateMessage&&meeting?.sendSignal)await meeting.sendSignal(target,'chat',payload);else await broadcast('chat',payload);}

  function closeReactionMenu(){state.reactionMenu?.remove();state.reactionMenu=null;}
  function openReactions(anchor=q('#roomReactions')){ensureUi();closeReactionMenu();if(!anchor)return;const menu=document.createElement('div');menu.className='meeting-reaction-menu';for(const emoji of reactions){const b=document.createElement('button');b.type='button';b.textContent=emoji;b.setAttribute('aria-label',`React ${emoji}`);b.onclick=()=>{closeReactionMenu();void sendReaction(emoji);};menu.append(b);}const divider=document.createElement('span');divider.className='reaction-divider';menu.append(divider);const hand=document.createElement('button');hand.type='button';hand.className='reaction-hand-button';hand.textContent=state.localHandRaised?'✋ Lower Hand':'✋ Raise Hand';hand.setAttribute('aria-pressed',String(state.localHandRaised));hand.onclick=()=>{closeReactionMenu();void toggleRaiseHand();};menu.append(hand);document.body.append(menu);state.reactionMenu=menu;const r=anchor.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-menu.offsetWidth-10,r.left))}px`;menu.style.bottom=`${Math.max(76,innerHeight-r.top+8)}px`;}
  function showReaction(emoji,name){ensureUi();const layer=q('#meetingReactionLayer');if(!layer)return;const bubble=document.createElement('div');bubble.className='meeting-reaction-bubble';bubble.innerHTML=`<b>${esc(emoji)}</b><span>${esc(name)}</span>`;layer.append(bubble);setTimeout(()=>bubble.remove(),3300);}
  function decorateReactions(){
    for(const row of qa('#participantRoster [data-participant-id]')){
      const id=String(row.dataset.participantId||''),entry=state.reactions.get(id);
      let badge=row.querySelector('.participant-reaction-indicator');
      if(entry&&!badge){badge=document.createElement('span');badge.className='participant-reaction-indicator';row.querySelector('.person-copy')?.append(badge);}
      if(entry&&badge){badge.textContent=entry.emoji;badge.title=`${entry.name||'Participant'} reacted ${entry.emoji}`;}
      if(!entry)badge?.remove();
    }
    for(const tile of qa('.remote-peer-tile[data-peer-id]')){
      const id=String(tile.dataset.peerId||''),entry=state.reactions.get(id);let badge=tile.querySelector('.remote-reaction-indicator');
      if(entry&&!badge){badge=document.createElement('span');badge.className='remote-reaction-indicator';tile.append(badge);}
      if(entry&&badge){badge.textContent=entry.emoji;badge.title=`${entry.name||'Participant'} reacted ${entry.emoji}`;}
      if(!entry)badge?.remove();
    }
  }
  function setParticipantReaction(participantId,emoji,name){
    const id=String(participantId||'');if(!id||!reactions.includes(emoji))return;
    clearTimeout(state.reactionTimers.get(id));state.reactions.set(id,{emoji,name:String(name||'Participant'),at:Date.now()});decorateReactions();
    state.reactionTimers.set(id,setTimeout(()=>{state.reactionTimers.delete(id);state.reactions.delete(id);decorateReactions();},10000));
  }
  async function sendReaction(emoji){
    if(!reactions.includes(emoji))return;
    const me=await localParticipant(),payload={emoji,name:localName(),participantId:me.participantId,at:new Date().toISOString()};
    if(me.participantId)setParticipantReaction(me.participantId,emoji,payload.name);
    showReaction(emoji,payload.name);await broadcast('reaction',payload);
  }
  async function localParticipant(){
    try{const ctx=await meeting?.context?.();return {participantId:String(ctx?.participantId||''),name:localName()};}catch{return {participantId:'',name:localName()};}
  }
  function decorateRaisedHands(){
    for(const row of qa('#participantRoster [data-participant-id]')){
      const id=String(row.dataset.participantId||''),raised=state.raisedHands.has(id);row.dataset.raisedHand=raised?'1':'0';
      let badge=row.querySelector('.raised-hand-indicator');
      if(raised&&!badge){badge=document.createElement('span');badge.className='raised-hand-indicator';badge.textContent='✋';badge.title='Hand raised';row.querySelector('.person-copy')?.append(badge);}
      if(!raised)badge?.remove();
    }
    for(const tile of qa('.remote-peer-tile[data-peer-id]')){
      const id=String(tile.dataset.peerId||''),raised=state.raisedHands.has(id);tile.classList.toggle('hand-raised',raised);
      let badge=tile.querySelector('.remote-raised-hand');
      if(raised&&!badge){badge=document.createElement('span');badge.className='remote-raised-hand';badge.textContent='✋';badge.title='Hand raised';tile.append(badge);}
      if(!raised)badge?.remove();
    }
    const button=q('#roomReactions');button?.classList.toggle('hand-raised',state.localHandRaised);
    if(button){const label=button.querySelector('.ds-control-label');if(label)label.textContent=state.localHandRaised?'Lower Hand':'Reactions';}
  }
  async function setLocalHand(raised,{broadcastChange=true}={}){
    state.localHandRaised=Boolean(raised);const me=await localParticipant();
    if(me.participantId){
      if(state.localHandRaised)state.raisedHands.set(me.participantId,{name:me.name,at:Date.now()});else state.raisedHands.delete(me.participantId);
    }
    decorateRaisedHands();
    if(broadcastChange)await broadcast('reaction',{kind:'hand',raised:state.localHandRaised,name:me.name,participantId:me.participantId,at:new Date().toISOString()});
    return state.localHandRaised;
  }
  async function toggleRaiseHand(){return setLocalHand(!state.localHandRaised);}
  async function lowerParticipantHand(participantId){
    const id=String(participantId||'');if(!id)return false;state.raisedHands.delete(id);decorateRaisedHands();return true;
  }

  function localRole(){return String(q('#roomRole')?.textContent||'participant').trim().toLowerCase().replace('-','');}
  async function recordingAuthority(){
    const ctx=await meeting?.context?.();if(!ctx?.participantId)return {allowed:false,participant:null,ctx};
    const snap=state.meetingSnapshot||await meeting?.snapshot?.(ctx.roomId);const participant=(snap?.participants||[]).find(p=>String(p.participantId)===String(ctx.participantId));
    const role=String(participant?.role||localRole()).toLowerCase();return {allowed:['host','cohost'].includes(role)||Boolean(participant?.recordingAllowed),participant,ctx,snapshot:snap};
  }
  function syncRecordingUi(){
    const button=q('#roomRecord'),stopButton=q('#roomRecordStop');if(!button)return;
    const snap=state.meetingSnapshot,ctxPromise=meeting?.context?.();
    Promise.resolve(ctxPromise).then(ctx=>{
      const participant=(snap?.participants||[]).find(p=>String(p.participantId)===String(ctx?.participantId||''));const role=String(participant?.role||localRole()).toLowerCase();
      const allowed=['host','cohost'].includes(role)||Boolean(participant?.recordingAllowed);
      if(!['host','cohost'].includes(role)&&participant){
        if(state.lastRecordingAllowed!==null&&state.lastRecordingAllowed!==Boolean(participant.recordingAllowed)){
          window.DominionMeetingNotifications?.toast?.(participant.recordingAllowed?'The host allowed you to record this meeting.':'The host removed your recording permission.','info');
        }
        state.lastRecordingAllowed=Boolean(participant.recordingAllowed);
      }else state.lastRecordingAllowed=true;
      if(state.recording&&!allowed){void stopRecording({reason:'revoked'});return;}
      button.hidden=!allowed&&!state.recording;button.disabled=!allowed&&!state.recording;
      if(state.recording){button.title=state.recordingPaused?'Resume recording':'Pause recording';}
      else button.title=allowed?'Record this meeting locally':'The host has not allowed you to record';
      if(stopButton){stopButton.hidden=!state.recording;stopButton.disabled=!state.recording;}
    }).catch(()=>{});
  }
  function syncRemoteRecordingFromSnapshot(){
    const ctxId=String(state.meetingSnapshot?._localParticipantId||'');
    const active=new Map();
    for(const p of state.meetingSnapshot?.participants||[]){
      const id=String(p.participantId||'');if(!id||id===ctxId||!p.isRecording)continue;
      const name=String(p.displayName||'Participant');active.set(id,{name,paused:Boolean(p.recordingPaused),at:Date.now()});
      if(!state.recordingNoticeSeen.has(id)){state.recordingNoticeSeen.add(id);showRecordingConsent(name);}
    }
    state.remoteRecorders=active;
  }
  function updateRecordingIndicator(){
    const indicator=q('#meetingRecordingIndicator'),owner=q('#meetingRecordingOwner');if(!indicator)return;
    const active=state.recording||state.remoteRecorders.size>0;indicator.hidden=!active;
    const remoteValues=[...state.remoteRecorders.values()],allPaused=active&&(state.recording?state.recordingPaused:true)&&remoteValues.every(item=>item.paused);
    indicator.classList.toggle('paused',Boolean(allPaused));
    const label=indicator.querySelector('span');if(label)label.textContent=allPaused?'Recording paused':'Recording';
    if(owner){if(state.recording&&state.remoteRecorders.size===0)owner.textContent='You';else if(state.remoteRecorders.size===1)owner.textContent=remoteValues[0]?.name||'';else if(state.remoteRecorders.size>1)owner.textContent=`${state.remoteRecorders.size+(state.recording?1:0)} recorders`;else owner.textContent='';}
    for(const row of qa('#participantRoster [data-participant-id]')){
      const id=String(row.dataset.participantId||''),remote=state.remoteRecorders.get(id);let badge=row.querySelector('.recording-participant-badge');
      if(remote&&!badge){badge=document.createElement('span');badge.className='recording-participant-badge';row.querySelector('.person-copy')?.append(badge);}
      if(remote&&badge){badge.textContent=remote.paused?'PAUSED':'REC';badge.classList.toggle('paused',Boolean(remote.paused));badge.title=remote.paused?'Recording paused':'Recording';}
      if(!remote)badge?.remove();
    }
  }
  async function announceRecording(active,paused=false){
    const ctx=await meeting?.context?.(),participantId=String(ctx?.participantId||''),payload={active:Boolean(active),paused:Boolean(paused),name:localName(),participantId,at:new Date().toISOString()};
    if(participantId&&meeting?.setRecordingState)await meeting.setRecordingState(participantId,Boolean(active),Boolean(paused));
    await broadcast('recording-state',payload);
  }
  function showRecordingConsent(name){
    const dialog=q('#meetingRecordingConsent'),copy=q('#meetingRecordingConsentCopy');if(!dialog||dialog.open)return;
    if(copy)copy.textContent=`${String(name||'A participant')} started recording this meeting. Continue to remain in the meeting, or leave now.`;
    dialog.showModal();
  }
  function handleRecordingState(detail){
    const payload=detail.payload||{},id=String(detail.fromParticipantId||payload.participantId||''),active=Boolean(payload.active),paused=Boolean(payload.paused),name=String(payload.name||detail.fromDisplayName||'Participant');
    if(!id)return;if(active){state.remoteRecorders.set(id,{name,paused,at:Date.now()});if(!state.recordingNoticeSeen.has(id)){state.recordingNoticeSeen.add(id);showRecordingConsent(name);}}else{state.remoteRecorders.delete(id);state.recordingNoticeSeen.delete(id);}updateRecordingIndicator();
  }

  function visibleStageVideo(){return [q('#sharedContentVideo'),q('#remoteShareVideo'),q('#remoteActiveSpeakerStage'),q('#localMeetingVideo')].find(video=>video&&!video.hidden&&video.srcObject&&video.readyState>=2)||null;}
  function stopRecordResources(){cancelAnimationFrame(state.recordFrame);state.recordFrame=0;for(const track of state.recordStream?.getTracks?.()||[]){try{track.stop();}catch{}}state.recordStream=null;try{state.audioContext?.close?.();}catch{}state.audioContext=null;state.recordCanvas=null;}
  async function buildRecordingStream(){
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Recording canvas unavailable.');state.recordCanvas=canvas;
    const draw=()=>{const source=visibleStageVideo();ctx.fillStyle='#030913';ctx.fillRect(0,0,canvas.width,canvas.height);if(source?.videoWidth){const scale=Math.min(canvas.width/source.videoWidth,canvas.height/source.videoHeight),w=source.videoWidth*scale,h=source.videoHeight*scale;ctx.drawImage(source,(canvas.width-w)/2,(canvas.height-h)/2,w,h);}state.recordFrame=requestAnimationFrame(draw);};draw();
    const stream=canvas.captureStream(30);
    try{
      const ac=new AudioContext(),dest=ac.createMediaStreamDestination();state.audioContext=ac;const sources=[];
      const pref=name=>{try{return window.DominionPreferences?.read?.(name)!==false;}catch{return true;}};
      const local=window.DominionMediaController?.stream?.();if(pref('recordMic')&&local?.getAudioTracks?.().length)sources.push(local);
      if(pref('recordRemote'))for(const audio of qa('#remoteAudioBin audio'))if(audio.srcObject?.getAudioTracks?.().length)sources.push(audio.srcObject);
      for(const source of sources){try{ac.createMediaStreamSource(source).connect(dest);}catch{}}
      for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
    }catch{}
    state.recordStream=stream;return stream;
  }
  async function startRecording(){
    if(state.recording)return;
    const authority=await recordingAuthority();if(!authority.allowed)throw new Error('The host has not allowed you to record this meeting.');
    const stream=await buildRecordingStream();const choices=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];const mime=choices.find(type=>MediaRecorder.isTypeSupported?.(type))||'';
    const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);state.recordChunks=[];state.recorder=recorder;
    recorder.ondataavailable=e=>{if(e.data?.size)state.recordChunks.push(e.data);};
    recorder.onstop=()=>{const blob=new Blob(state.recordChunks,{type:recorder.mimeType||'video/webm'});const url=URL.createObjectURL(blob),a=document.createElement('a');const stamp=new Date().toISOString().replace(/[:.]/g,'-');a.href=url;a.download=`DominionStar-Meet-${stamp}.webm`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);state.recordChunks=[];stopRecordResources();};
    try{
      if(meeting?.setRecordingState)await meeting.setRecordingState(authority.ctx.participantId,true,false);
      recorder.start(1000);state.recording=true;state.recordingPaused=false;updateRecordingIndicator();
      await broadcast('recording-state',{active:true,paused:false,name:localName(),participantId:String(authority.ctx.participantId||''),at:new Date().toISOString()});
      const button=q('#roomRecord');button?.classList.add('recording');if(button){const label=button.querySelector('.ds-control-label');if(label)label.textContent='Pause';else button.textContent='Pause';}
      window.DominionMeetingParity?.install?.();
    }catch(error){
      try{if(recorder.state!=='inactive')recorder.stop();}catch{}
      try{if(meeting?.setRecordingState&&authority.ctx?.participantId)await meeting.setRecordingState(authority.ctx.participantId,false,false);}catch{}
      state.recorder=null;state.recording=false;stopRecordResources();throw error;
    }
  }
  async function pauseRecording(){
    if(!state.recording||state.recordingPaused||!state.recorder||state.recorder.state!=='recording')return;
    state.recorder.pause();state.recordingPaused=true;await announceRecording(true,true).catch(()=>{});updateRecordingIndicator();syncRecordingUi();
    const button=q('#roomRecord'),label=button?.querySelector('.ds-control-label');if(label)label.textContent='Resume';else if(button)button.textContent='Resume';
  }
  async function resumeRecording(){
    if(!state.recording||!state.recordingPaused||!state.recorder||state.recorder.state!=='paused')return;
    state.recorder.resume();state.recordingPaused=false;await announceRecording(true,false).catch(()=>{});updateRecordingIndicator();syncRecordingUi();
    const button=q('#roomRecord'),label=button?.querySelector('.ds-control-label');if(label)label.textContent='Pause';else if(button)button.textContent='Pause';
  }
  async function stopRecording({reason=''}={}){
    if(!state.recording)return;state.recording=false;state.recordingPaused=false;
    const ctx=await meeting?.context?.().catch?.(()=>null);
    try{if(meeting?.setRecordingState&&ctx?.participantId)await meeting.setRecordingState(ctx.participantId,false,false);}catch{}
    await broadcast('recording-state',{active:false,paused:false,name:localName(),participantId:String(ctx?.participantId||''),at:new Date().toISOString()}).catch(()=>{});
    updateRecordingIndicator();const button=q('#roomRecord'),stopButton=q('#roomRecordStop');button?.classList.remove('recording');
    if(button){const label=button.querySelector('.ds-control-label');if(label)label.textContent='Record';else button.textContent='Record';}
    if(stopButton)stopButton.hidden=true;
    if(state.recorder&&state.recorder.state!=='inactive')state.recorder.stop();else stopRecordResources();state.recorder=null;
    if(reason==='revoked')window.DominionMeetingNotifications?.toast?.('The host removed your recording permission. Recording stopped.','info');
  }
  async function toggleRecording(){
    try{
      if(!state.recording)await startRecording();
      else if(state.recordingPaused)await resumeRecording();
      else await pauseRecording();
    }catch(error){
      stopRecordResources();state.recording=false;state.recordingPaused=false;
      const title=q('#foundationTitle'),copy=q('#foundationCopy'),dialog=q('#foundationDialog');if(title)title.textContent='Recording unavailable';if(copy)copy.textContent=String(error?.message||error);if(dialog&&!dialog.open)dialog.showModal();
    }
  }

  function setVideoLayout(mode){const dock=q('#participantVideoDock');if(!dock)return;dock.classList.remove('layout-speaker');if(mode==='hide'){dock.hidden=true;return;}dock.hidden=false;if(mode==='speaker')dock.classList.add('layout-speaker');window.DominionMeetingParity?.syncVideoDock?.();}

  function handleSignal(event){const detail=event.detail||{},payload=detail.payload||{};if(detail.type==='recording-state'){handleRecordingState(detail);return;}if(detail.type==='chat'){const text=String(payload.text||'').trim();if(text)appendMessage({text:text.slice(0,2000),name:String(payload.name||detail.fromDisplayName||'Participant'),at:payload.at||detail.createdAt,own:false,private:Boolean(payload.private),toName:payload.private?'You':''});}else if(detail.type==='reaction'){if(payload.kind==='hand'){const id=String(detail.fromParticipantId||payload.participantId||''),raised=Boolean(payload.raised);if(id){if(raised)state.raisedHands.set(id,{name:String(payload.name||detail.fromDisplayName||'Participant'),at:Date.now()});else state.raisedHands.delete(id);decorateRaisedHands();}return;}const emoji=String(payload.emoji||'');if(reactions.includes(emoji)){const id=String(detail.fromParticipantId||payload.participantId||'');const name=String(payload.name||detail.fromDisplayName||'Participant');if(id)setParticipantReaction(id,emoji,name);showReaction(emoji,name);}}}
  window.addEventListener('dominion:meeting-signal',handleSignal);
  window.addEventListener('dominion:meeting-snapshot',event=>{
    state.meetingSnapshot=event.detail||null;void window.DominionZoomBehavior?.refreshChatRecipients?.();
    Promise.resolve(meeting?.context?.()).then(ctx=>{if(state.meetingSnapshot)state.meetingSnapshot._localParticipantId=String(ctx?.participantId||'');syncRemoteRecordingFromSnapshot();syncRecordingUi();updateRecordingIndicator();}).catch(()=>{syncRecordingUi();updateRecordingIndicator();});
  });
  document.addEventListener('pointerdown',event=>{if(state.reactionMenu&&!state.reactionMenu.contains(event.target)&&event.target!==q('#roomReactions'))closeReactionMenu();},true);
  const overlay=q('#meetingOverlay');
  const observer=new MutationObserver(()=>{if(inMeeting())ensureUi();});
  if(overlay)observer.observe(overlay,{attributes:true,attributeFilter:['hidden']});
  setInterval(()=>{if(inMeeting()){ensureUi();decorateRaisedHands();decorateReactions();syncRecordingUi();updateRecordingIndicator();}else{for(const timer of state.reactionTimers.values())clearTimeout(timer);state.reactionTimers.clear();state.reactions.clear();state.remoteRecorders.clear();state.recordingNoticeSeen.clear();state.raisedHands.clear();state.localHandRaised=false;state.meetingSnapshot=null;state.lastRecordingAllowed=null;if(state.recording)void stopRecording();}},600);
  ensureUi();
  window.DominionMeetingFeatures=Object.freeze({version:'1.4.0-zoom-chat-shell',toggleChat,openReactions,sendReaction,toggleRaiseHand,setLocalHand,lowerParticipantHand,toggleRecording,stopRecording,setVideoLayout,snapshot:()=>({chatOpen:!q('#meetingChatPanel')?.hidden,recording:state.recording,recordingPaused:state.recordingPaused,messageCount:state.messages.length,handRaised:state.localHandRaised,raisedHands:[...state.raisedHands.keys()],reactions:[...state.reactions.entries()].map(([participantId,value])=>({participantId,...value}))})});
})();
