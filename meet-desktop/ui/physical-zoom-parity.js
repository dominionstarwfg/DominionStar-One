(()=>{
  if(window.DominionPhysicalZoomParity)return;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||{};
  let currentUser=null,raf=0,lastBroadcastKey='',mediaState={};

  function initials(name){return String(name||'DominionStar Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()||'DS';}
  function setFallback(node,user,label=''){if(!node)return;const name=String(user?.name||label||'DominionStar Member'),url=String(user?.avatarUrl||'').trim();node.classList.toggle('profile-photo-fallback',Boolean(url));if(url){node.style.backgroundImage=`url("${url.replace(/"/g,'%22')}")`;node.style.backgroundSize='cover';node.style.backgroundPosition='center';node.textContent='';node.setAttribute('aria-label',`${name} profile picture`);}else{node.style.removeProperty('background-image');node.textContent=initials(name);node.setAttribute('aria-label',name);}}
  function syncLocalProfile(){if(!currentUser)return;setFallback(q('#prejoinAvatar'),currentUser);setFallback(q('#stageAvatar'),currentUser);const local=q('#localVideoDockTile .remote-peer-fallback');if(local){setFallback(local,currentUser);const span=local.querySelector('span');if(span)span.hidden=Boolean(currentUser.avatarUrl);}}
  function syncRemoteProfiles(){for(const [id,state] of Object.entries(mediaState)){if(!state?.avatarUrl)continue;const tile=q(`#remoteTileStrip .remote-peer-tile[data-peer-id="${CSS.escape(id)}"]`),fallback=tile?.querySelector('.remote-peer-fallback');if(!fallback)continue;fallback.classList.add('profile-photo-fallback');fallback.style.backgroundImage=`url("${String(state.avatarUrl).replace(/"/g,'%22')}")`;fallback.style.backgroundSize='cover';fallback.style.backgroundPosition='center';const span=fallback.querySelector('span');if(span)span.hidden=true;}}

  function ensureFeatureControls(){
    if(!q('#meetingOverlay'))return false;
    if(!q('#roomChat')||!q('#roomReactions'))window.DominionMeetingFeatures?.toggleChat?.(false);
    return Boolean(q('#roomChat')&&q('#roomReactions'));
  }
  function nearbyCaret(button){if(!button)return null;const next=button.nextElementSibling;if(next?.classList?.contains('av-device-caret'))return next;const footer=button.closest('.meeting-footer');if(!footer)return null;const kind=button.id==='roomMic'?'Audio':'Video';return [...footer.querySelectorAll('.av-device-caret')].find(node=>String(node.getAttribute('aria-label')||'').startsWith(kind))||null;}
  function attachCaret(button){const caret=nearbyCaret(button);if(!button||!caret)return false;caret.classList.add('zoom-attached-caret');caret.dataset.controlFor=button.id;button.classList.add('zoom-split-main');if(button.nextElementSibling!==caret)button.insertAdjacentElement('afterend',caret);return button.nextElementSibling===caret;}
  function normalizeToolbar(){const footer=q('.meeting-footer');if(!footer)return false;ensureFeatureControls();window.DominionMeetingParity?.install?.();const micAttached=attachCaret(q('#roomMic')),videoAttached=attachCaret(q('#roomCamera'));for(const caret of footer.querySelectorAll('.av-device-caret')){const target=caret.dataset.controlFor&&q(`#${caret.dataset.controlFor}`);if(target&&target.nextElementSibling!==caret)target.insertAdjacentElement('afterend',caret);}return micAttached&&videoAttached;}

  function dismissFalseInstallGate(){const dialog=q('#foundationDialog'),title=q('#foundationTitle');if(dialog?.open&&String(title?.textContent||'').trim()==='Install DominionStar Meet first')dialog.close();}
  function useNativeParticipants(){const button=q('#roomParticipants');if(!button||button.dataset.physicalParticipants)return;button.dataset.physicalParticipants='1';button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const side=q('.room-side');if(side)side.hidden=true;q('#meetingOverlay')?.classList.add('participants-hidden');button.setAttribute('aria-pressed','false');void desktop.participants?.toggle?.();},true);}

  async function broadcastMediaState(force=false){
    const controller=window.DominionMediaController,snap=controller?.snapshot?.();if(!snap)return;let ctx={};try{ctx=await meeting.context?.()||{};}catch{}if(!ctx.participantId||!ctx.roomId)return;
    const local={micOn:Boolean(snap.micOn),cameraOn:Boolean(snap.cameraOn),avatarUrl:String(currentUser?.avatarUrl||''),name:String(currentUser?.name||q('#profileName')?.textContent||'Participant')};mediaState[String(ctx.participantId)]=local;void desktop.participants?.updateMediaState?.(mediaState);
    const key=JSON.stringify([ctx.participantId,local.micOn,local.cameraOn,local.avatarUrl]);if(!force&&key===lastBroadcastKey)return;lastBroadcastKey=key;
    try{const room=await meeting.snapshot?.(ctx.roomId),peers=(room?.participants||[]).filter(p=>String(p.participantId||'')!==String(ctx.participantId)&&['admitted','joined'].includes(String(p.state||'joined')));await Promise.allSettled(peers.map(p=>meeting.sendSignal?.(p.participantId,'host:media-state',{...local,at:new Date().toISOString()})));}catch{}
  }
  function onMeetingSignal(event){const detail=event.detail||{};if(String(detail.type||'')!=='host:media-state')return;const id=String(detail.fromParticipantId||'');if(!id)return;mediaState[id]={...(mediaState[id]||{}),...(detail.payload||{})};syncRemoteProfiles();void desktop.participants?.updateMediaState?.(mediaState);}
  function bindMedia(){const controller=window.DominionMediaController;if(!controller?.onChange||controller.__physicalZoomBound)return;controller.__physicalZoomBound=true;controller.onChange(()=>{scheduleSync();void broadcastMediaState();});}

  function scheduleSync(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{ensureFeatureControls();normalizeToolbar();syncLocalProfile();syncRemoteProfiles();useNativeParticipants();dismissFalseInstallGate();bindMedia();});}
  function observe(){const observer=new MutationObserver(scheduleSync);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','aria-pressed','open']});window.addEventListener('dominion:meeting-ui-ready',scheduleSync);window.addEventListener('dominion:meeting-entered',()=>{scheduleSync();void broadcastMediaState(true);});window.addEventListener('dominion:meeting-ended',()=>{mediaState={};lastBroadcastKey='';void desktop.participants?.close?.();});window.addEventListener('dominion:meeting-signal',onMeetingSignal,true);}
  async function loadIdentity(){try{const state=await desktop.auth?.getState?.();currentUser=state?.user||null;syncLocalProfile();}catch{}desktop.auth?.onChanged?.(state=>{currentUser=state?.user||null;scheduleSync();void broadcastMediaState(true);});}

  loadIdentity();observe();setTimeout(scheduleSync,0);setTimeout(()=>{scheduleSync();void broadcastMediaState(true);},600);
  window.DominionPhysicalZoomParity=Object.freeze({version:'1.2.0-toolbar-bootstrap',ensureFeatureControls,normalizeToolbar,syncLocalProfile,broadcastMediaState});
})();
