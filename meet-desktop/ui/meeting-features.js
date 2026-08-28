(()=>{
  if(window.DominionMeetingFeatures)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const reactions=['👍','👏','❤️','😂','🎉','🤔'];
  const state={messages:[],reactionMenu:null,recording:false,recorder:null,recordChunks:[],recordStream:null,recordCanvas:null,recordFrame:0,audioContext:null};
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
      const panel=document.createElement('aside');panel.id='meetingChatPanel';panel.className='meeting-chat-panel';panel.hidden=true;panel.innerHTML='<header><strong>Meeting Chat</strong><button type="button" data-chat-close aria-label="Close chat">×</button></header><div id="meetingChatMessages" class="meeting-chat-messages"><div class="meeting-chat-empty">Messages sent in this meeting appear here.</div></div><form id="meetingChatForm" class="meeting-chat-form"><input id="meetingChatInput" maxlength="2000" autocomplete="off" placeholder="Message everyone"><button type="submit">Send</button></form>';body.append(panel);panel.querySelector('[data-chat-close]').onclick=()=>toggleChat(false);panel.querySelector('form').onsubmit=sendChat;
    }
    if(!q('#meetingReactionLayer')){const layer=document.createElement('div');layer.id='meetingReactionLayer';layer.className='meeting-reaction-layer';body.append(layer);}
    if(!q('#meetingRecordingIndicator')){const indicator=document.createElement('div');indicator.id='meetingRecordingIndicator';indicator.className='meeting-recording-indicator';indicator.hidden=true;indicator.innerHTML='<i></i><span>Recording</span>';body.append(indicator);}
    const ensureButton=(id,label,before,handler)=>{let b=q(`#${id}`);if(b)return b;b=document.createElement('button');b.id=id;b.type='button';b.className='meeting-control';b.textContent=label;b.onclick=handler;footer.insertBefore(b,before||exit);return b;};
    ensureButton('roomChat','Chat',q('#roomSettings')||exit,()=>toggleChat());
    ensureButton('roomRecord','Record',q('#roomSettings')||exit,()=>void toggleRecording());
    ensureButton('roomReactions','Reactions',q('#roomSettings')||exit,event=>openReactions(event.currentTarget));
    window.DominionMeetingParity?.install?.();
    return true;
  }

  function toggleChat(force){ensureUi();const panel=q('#meetingChatPanel'),button=q('#roomChat');if(!panel)return;const show=typeof force==='boolean'?force:panel.hidden;panel.hidden=!show;button?.setAttribute('aria-pressed',String(show));if(show)requestAnimationFrame(()=>q('#meetingChatInput')?.focus());return show;}
  function renderMessages(){const box=q('#meetingChatMessages');if(!box)return;if(!state.messages.length){box.innerHTML='<div class="meeting-chat-empty">Messages sent in this meeting appear here.</div>';return;}box.innerHTML=state.messages.slice(-200).map(m=>`<article class="meeting-chat-message${m.own?' own':''}"><strong>${esc(m.name)}</strong><p>${esc(m.text)}</p><time>${esc(nowLabel(m.at))}</time></article>`).join('');box.scrollTop=box.scrollHeight;}
  function appendMessage(message){state.messages.push(message);renderMessages();if(!message.own&&q('#meetingChatPanel')?.hidden){const button=q('#roomChat');button?.classList.add('has-unread');setTimeout(()=>button?.classList.remove('has-unread'),5000);}}
  async function sendChat(event){event?.preventDefault?.();const input=q('#meetingChatInput'),text=String(input?.value||'').trim();if(!text)return;input.value='';const payload={text:text.slice(0,2000),name:localName(),at:new Date().toISOString()};appendMessage({...payload,own:true});await broadcast('chat',payload);}

  function closeReactionMenu(){state.reactionMenu?.remove();state.reactionMenu=null;}
  function openReactions(anchor=q('#roomReactions')){ensureUi();closeReactionMenu();if(!anchor)return;const menu=document.createElement('div');menu.className='meeting-reaction-menu';for(const emoji of reactions){const b=document.createElement('button');b.type='button';b.textContent=emoji;b.setAttribute('aria-label',`React ${emoji}`);b.onclick=()=>{closeReactionMenu();void sendReaction(emoji);};menu.append(b);}document.body.append(menu);state.reactionMenu=menu;const r=anchor.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-menu.offsetWidth-10,r.left))}px`;menu.style.bottom=`${Math.max(76,innerHeight-r.top+8)}px`;}
  function showReaction(emoji,name){ensureUi();const layer=q('#meetingReactionLayer');if(!layer)return;const bubble=document.createElement('div');bubble.className='meeting-reaction-bubble';bubble.innerHTML=`<b>${esc(emoji)}</b><span>${esc(name)}</span>`;layer.append(bubble);setTimeout(()=>bubble.remove(),3300);}
  async function sendReaction(emoji){if(!reactions.includes(emoji))return;const payload={emoji,name:localName(),at:new Date().toISOString()};showReaction(emoji,payload.name);await broadcast('reaction',payload);}

  function visibleStageVideo(){return [q('#sharedContentVideo'),q('#remoteShareVideo'),q('#remoteActiveSpeakerStage'),q('#localMeetingVideo')].find(video=>video&&!video.hidden&&video.srcObject&&video.readyState>=2)||null;}
  function stopRecordResources(){cancelAnimationFrame(state.recordFrame);state.recordFrame=0;for(const track of state.recordStream?.getTracks?.()||[]){try{track.stop();}catch{}}state.recordStream=null;try{state.audioContext?.close?.();}catch{}state.audioContext=null;state.recordCanvas=null;}
  async function buildRecordingStream(){
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Recording canvas unavailable.');state.recordCanvas=canvas;
    const draw=()=>{const source=visibleStageVideo();ctx.fillStyle='#030913';ctx.fillRect(0,0,canvas.width,canvas.height);if(source?.videoWidth){const scale=Math.min(canvas.width/source.videoWidth,canvas.height/source.videoHeight),w=source.videoWidth*scale,h=source.videoHeight*scale;ctx.drawImage(source,(canvas.width-w)/2,(canvas.height-h)/2,w,h);}state.recordFrame=requestAnimationFrame(draw);};draw();
    const stream=canvas.captureStream(30);
    try{
      const ac=new AudioContext(),dest=ac.createMediaStreamDestination();state.audioContext=ac;const sources=[];
      const local=window.DominionMediaController?.stream?.();if(local?.getAudioTracks?.().length)sources.push(local);
      for(const audio of qa('#remoteAudioBin audio'))if(audio.srcObject?.getAudioTracks?.().length)sources.push(audio.srcObject);
      for(const source of sources){try{ac.createMediaStreamSource(source).connect(dest);}catch{}}
      for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
    }catch{}
    state.recordStream=stream;return stream;
  }
  async function startRecording(){
    if(state.recording)return;const stream=await buildRecordingStream();const choices=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];const mime=choices.find(type=>MediaRecorder.isTypeSupported?.(type))||'';const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);state.recordChunks=[];state.recorder=recorder;recorder.ondataavailable=e=>{if(e.data?.size)state.recordChunks.push(e.data);};recorder.onstop=()=>{const blob=new Blob(state.recordChunks,{type:recorder.mimeType||'video/webm'});const url=URL.createObjectURL(blob),a=document.createElement('a');const stamp=new Date().toISOString().replace(/[:.]/g,'-');a.href=url;a.download=`DominionStar-Meet-${stamp}.webm`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);state.recordChunks=[];stopRecordResources();};recorder.start(1000);state.recording=true;q('#meetingRecordingIndicator').hidden=false;const button=q('#roomRecord');button?.classList.add('recording');if(button){const label=button.querySelector('.ds-control-label');if(label)label.textContent='Stop Record';else button.textContent='Stop Record';}window.DominionMeetingParity?.install?.();}
  async function stopRecording(){if(!state.recording)return;state.recording=false;q('#meetingRecordingIndicator').hidden=true;const button=q('#roomRecord');button?.classList.remove('recording');if(button){const label=button.querySelector('.ds-control-label');if(label)label.textContent='Record';else button.textContent='Record';}if(state.recorder&&state.recorder.state!=='inactive')state.recorder.stop();else stopRecordResources();state.recorder=null;}
  async function toggleRecording(){try{state.recording?await stopRecording():await startRecording();}catch(error){stopRecordResources();state.recording=false;const title=q('#foundationTitle'),copy=q('#foundationCopy'),dialog=q('#foundationDialog');if(title)title.textContent='Recording unavailable';if(copy)copy.textContent=String(error?.message||error);if(dialog&&!dialog.open)dialog.showModal();}}

  function setVideoLayout(mode){const dock=q('#participantVideoDock');if(!dock)return;dock.classList.remove('layout-speaker');if(mode==='hide'){dock.hidden=true;return;}dock.hidden=false;if(mode==='speaker')dock.classList.add('layout-speaker');window.DominionMeetingParity?.syncVideoDock?.();}

  function handleSignal(event){const detail=event.detail||{},payload=detail.payload||{};if(detail.type==='chat'){const text=String(payload.text||'').trim();if(text)appendMessage({text:text.slice(0,2000),name:String(payload.name||detail.fromDisplayName||'Participant'),at:payload.at||detail.createdAt,own:false});}else if(detail.type==='reaction'){const emoji=String(payload.emoji||'');if(reactions.includes(emoji))showReaction(emoji,String(payload.name||detail.fromDisplayName||'Participant'));}}
  window.addEventListener('dominion:meeting-signal',handleSignal);
  document.addEventListener('pointerdown',event=>{if(state.reactionMenu&&!state.reactionMenu.contains(event.target)&&event.target!==q('#roomReactions'))closeReactionMenu();},true);
  const observer=new MutationObserver(()=>{if(inMeeting())ensureUi();});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  setInterval(()=>{if(inMeeting())ensureUi();else if(state.recording)void stopRecording();},600);
  ensureUi();
  window.DominionMeetingFeatures=Object.freeze({toggleChat,openReactions,sendReaction,toggleRecording,setVideoLayout,snapshot:()=>({chatOpen:!q('#meetingChatPanel')?.hidden,recording:state.recording,messageCount:state.messages.length})});
})();
