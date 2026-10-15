(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{},bridge=desktop.macShare||null;
  const q=s=>document.querySelector(s);
  let cameraOn=true,micOn=false,cameraId='',mirrored=true;
  let videoLayout='strip',participants=[],identity={name:'You',avatar:''},lastSignature='';
  let speaking=false,pinnedId='',activeMenuId='';
  const liveStreams=new Map();

  const initials=name=>String(name||'Participant').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'DS';
  const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const avatarFrom=user=>String(user?.avatarUrl||user?.avatar_url||user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'');

  async function loadIdentity(){
    try{
      const state=await desktop.auth?.getState?.(),user=state?.user||{};
      identity.name=String(user?.displayName||user?.name||user?.full_name||user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email||'You').trim()||'You';
      identity.avatar=avatarFrom(user);
    }catch{}
  }

  // The meeting renderer is the only camera-capture authority. This floating
  // window receives frames from that existing stream over presenter IPC; it
  // must never make a second getUserMedia() request for the same camera.
  // Companion live video uses one stable MediaStream per participant.
  function detachStream(id){
    const key=String(id||'');liveStreams.delete(key);
    const tile=[...document.querySelectorAll('#videoStack .video-tile')].find(node=>node.dataset.participantId===key);
    const video=tile?.querySelector('video.remote-live-video'),fallback=tile?.querySelector('.video-fallback');
    if(video){video.onloadeddata=null;video.onresize=null;video.srcObject=null;video.hidden=true;}
    if(fallback)fallback.hidden=false;
  }
  function showStream(id,stream){
    const key=String(id||''),person=participants.find(item=>item.participantId===key);
    const tile=[...document.querySelectorAll('#videoStack .video-tile')].find(node=>node.dataset.participantId===key);
    const video=tile?.querySelector('video.remote-live-video'),fallback=tile?.querySelector('.video-fallback');
    if(!video||!person?.cameraOn||!stream)return;
    const changed=video.srcObject!==stream;
    if(changed)video.srcObject=stream;
    const reveal=()=>{
      if(video.srcObject!==stream||!participants.some(item=>item.participantId===key&&item.cameraOn))return;
      if(video.readyState<2||!video.videoWidth||!video.videoHeight)return;
      video.hidden=false;if(fallback)fallback.hidden=true;
    };
    video.onloadeddata=reveal;video.onresize=reveal;
    if(changed||video.paused)void video.play().then(reveal).catch(()=>{});
    reveal();
  }
  function attachLiveStream(id,stream){
    const key=String(id||'');if(!key||!stream)return;
    liveStreams.set(key,stream);showStream(key,stream);
  }

  const localRole=()=>String(participants.find(item=>item.self)?.role||'participant').toLowerCase();
  const canManage=()=>['host','cohost'].includes(localRole());
  function normalizedParticipants(input){
    const out=[],seen=new Set();
    for(const raw of Array.isArray(input)?input:[]){
      const id=String(raw?.participantId||'');if(!id||seen.has(id))continue;seen.add(id);
      out.push({participantId:id,name:String(raw?.name||'Participant').trim()||'Participant',role:String(raw?.role||'participant').toLowerCase(),self:Boolean(raw?.self),micOn:Boolean(raw?.micOn),cameraOn:Boolean(raw?.cameraOn),avatar:String(raw?.avatar||'')});
    }
    if(!out.some(item=>item.self))out.unshift({participantId:'local-self',name:identity.name,role:'participant',self:true,micOn,cameraOn,avatar:identity.avatar});
    const self=out.find(item=>item.self);if(self){self.micOn=micOn;self.cameraOn=cameraOn;if(!self.name||self.name==='You')self.name=identity.name;if(!self.avatar)self.avatar=identity.avatar;}
    return out;
  }
  function orderedParticipants(){
    const list=[...participants];if(pinnedId){const index=list.findIndex(item=>item.participantId===pinnedId);if(index>0){const [p]=list.splice(index,1);list.unshift(p);}}
    return list;
  }
  function mutedIcon(){
    return '<span class="video-muted-mark" aria-label="Muted"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"></path><path class="single-slash" d="M4 4 20 20"></path></svg></span>';
  }
  function primaryLabel(person){
    if(person.self)return person.micOn?'Mute':'Unmute';
    if(!canManage())return 'Chat';
    return person.micOn?'Mute':'Ask to unmute';
  }
  function renderParticipants(force=false){
    const list=orderedParticipants();
    const signature=JSON.stringify({layout:videoLayout,pinnedId,
      list:list.map(p=>[p.participantId,p.name,p.role,p.self,p.micOn,p.cameraOn,p.avatar])});
    if(!force&&signature===lastSignature){syncSpeaking();return;}
    const stack=q('#videoStack');if(!stack)return;
    const dock=q('#dock');if(dock)dock.dataset.scrollable=list.length>5?'1':'0';
    lastSignature=signature;
    const expected=new Set(list.map(person=>person.participantId));
    for(const id of [...liveStreams.keys()])if(!expected.has(id))detachStream(id);
    for(const tile of [...stack.querySelectorAll(':scope > .video-tile')]){
      if(!expected.has(tile.dataset.participantId))tile.remove();
    }
    for(let index=0;index<list.length;index++){
      const person=list[index],id=person.participantId;
      let tile=[...stack.querySelectorAll(':scope > .video-tile')].find(node=>node.dataset.participantId===id);
      if(!tile){
        tile=document.createElement('article');tile.className='video-tile';tile.dataset.participantId=id;
        tile.innerHTML=`
          <video class="remote-live-video" autoplay muted playsinline hidden></video>
          <div class="video-fallback"><span></span></div>
          <div class="video-tile-actions">
            <button type="button" class="video-primary-action" data-video-primary></button>
            <button type="button" class="video-more-action" data-video-more>•••</button>
          </div>
          <div class="video-tile-name"><strong></strong></div>`;
        tile.querySelector('[data-video-primary]').addEventListener('click',event=>{
          event.stopPropagation();
          const current=participants.find(item=>item.participantId===id);
          if(current)void runPrimary(current);
        });
        tile.querySelector('[data-video-more]').addEventListener('click',event=>{
          event.stopPropagation();
          const current=participants.find(item=>item.participantId===id);
          if(current)openMenu(current,tile);
        });
      }
      tile.dataset.self=person.self?'1':'0';
      const name=tile.querySelector('.video-tile-name strong');
      if(name&&name.textContent!==person.name)name.textContent=person.name;
      const primary=tile.querySelector('[data-video-primary]');
      if(primary){const label=primaryLabel(person);if(primary.textContent!==label)primary.textContent=label;}
      const more=tile.querySelector('[data-video-more]');
      if(more)more.setAttribute('aria-label',`More options for ${person.name}`);
      const nameRow=tile.querySelector('.video-tile-name');
      let mutedMark=nameRow?.querySelector('.video-muted-mark');
      if(!person.micOn&&!mutedMark){nameRow.insertAdjacentHTML('afterbegin',mutedIcon());}
      if(person.micOn&&mutedMark)mutedMark.remove();
      const fallback=tile.querySelector('.video-fallback');
      const initialsNode=fallback?.querySelector(':scope > span');
      if(initialsNode){const label=initials(person.name);if(initialsNode.textContent!==label)initialsNode.textContent=label;}
      let avatar=fallback?.querySelector(':scope > img.fallback-avatar');
      if(person.avatar){
        if(!avatar){
          avatar=document.createElement('img');avatar.className='fallback-avatar';avatar.alt='';
          fallback.prepend(avatar);
          avatar.onload=()=>{if(initialsNode)initialsNode.hidden=true;};
          avatar.onerror=()=>{avatar.hidden=true;if(initialsNode)initialsNode.hidden=false;};
        }
        if(avatar.getAttribute('src')!==person.avatar){
          if(initialsNode)initialsNode.hidden=false;
          avatar.hidden=false;avatar.src=person.avatar;
        }
      }else if(avatar){avatar.remove();if(initialsNode)initialsNode.hidden=false;}
      if(!person.cameraOn){
        if(liveStreams.has(id))detachStream(id);
        const video=tile.querySelector('video.remote-live-video');
        if(video)video.hidden=true;
        if(fallback)fallback.hidden=false;
      }else if(liveStreams.has(id)){
        showStream(id,liveStreams.get(id));
      }
      // Keep existing video/media nodes attached when status or ordering changes.
      const position=stack.children[index];
      if(position!==tile)stack.insertBefore(tile,position||null);
    }
    syncSpeaking();
    if(activeMenuId&&!participants.some(item=>item.participantId===activeMenuId))closeMenu();
  }
  function syncSpeaking(){
    for(const tile of document.querySelectorAll('.video-tile'))tile.classList.toggle('speaking',tile.dataset.self==='1'&&speaking);
  }
  async function presenterCommand(command){
    try{const result=await bridge?.command?.(String(command||''));if(result?.ok===false)throw new Error(result?.error||'presenter_command_failed');return true;}
    catch(error){console.error('[DominionStar Meet] Presenter video command failed.',error);return false;}
  }
  const participantCommand=(action,id)=>presenterCommand(`participant:${action}:${encodeURIComponent(String(id||''))}`);
  async function runPrimary(person){
    if(person.self){await presenterCommand(person.micOn?'audio-off':'audio-on');return;}
    if(canManage()){await participantCommand(person.micOn?'mute':'ask-unmute',person.participantId);return;}
    await participantCommand('chat',person.participantId);
  }

  const menu=q('#videoActionMenu');
  function closeMenu(){
    activeMenuId='';if(menu){menu.hidden=true;menu.textContent='';}
    document.querySelectorAll('.video-tile.menu-open').forEach(tile=>tile.classList.remove('menu-open'));
  }
  function addMenuItem(label,handler,{danger=false}={}){
    const button=document.createElement('button');button.type='button';button.role='menuitem';button.textContent=label;if(danger)button.classList.add('danger');
    button.addEventListener('click',()=>{closeMenu();void Promise.resolve(handler()).catch(error=>console.error('[DominionStar Meet] Video menu action failed.',error));});menu.append(button);
  }
  function addSeparator(){const sep=document.createElement('div');sep.className='menu-separator';sep.setAttribute('aria-hidden','true');menu.append(sep);}
  function openMenu(person,tile){
    if(!menu)return;closeMenu();activeMenuId=person.participantId;tile.classList.add('menu-open');menu.textContent='';
    if(person.self){
      addMenuItem(person.micOn?'Mute':'Unmute',()=>presenterCommand(person.micOn?'audio-off':'audio-on'));
      addMenuItem(person.cameraOn?'Stop Video':'Start Video',()=>presenterCommand(person.cameraOn?'video-off':'video-on'));
      addSeparator();addMenuItem('Speaker View',()=>presenterCommand('layout-speaker'));addMenuItem('Participant Strip',()=>presenterCommand('layout-strip'));addMenuItem('Gallery View',()=>presenterCommand('layout-gallery'));addMenuItem('Hide Video Panel',()=>presenterCommand('layout-hide'));
    }else{
      if(canManage()){
        addMenuItem(person.micOn?'Mute':'Ask to Unmute',()=>participantCommand(person.micOn?'mute':'ask-unmute',person.participantId));
        addMenuItem(person.cameraOn?'Stop Video':'Ask to Start Video',()=>participantCommand(person.cameraOn?'stop-video':'ask-video',person.participantId));
        addSeparator();
      }
      addMenuItem('Chat',()=>participantCommand('chat',person.participantId));
      addMenuItem(pinnedId===person.participantId?'Unpin':'Pin',()=>{pinnedId=pinnedId===person.participantId?'':person.participantId;lastSignature='';renderParticipants(true);});
      if(canManage()){
        addMenuItem('Spotlight for Everyone',()=>participantCommand('spotlight',person.participantId));
        addMenuItem('Rename',()=>participantCommand('rename',person.participantId));
        if(localRole()==='host'&&person.role!=='host')addMenuItem(person.role==='cohost'?'Remove Co-host':'Make Co-host',()=>participantCommand('cohost',person.participantId));
        if(person.role!=='host')addMenuItem('Remove',()=>participantCommand('remove',person.participantId),{danger:true});
      }
    }
    menu.hidden=false;
  }

  function setLayoutActive(layout){
    videoLayout=['speaker','strip','gallery'].includes(String(layout))?String(layout):'strip';const dock=q('#dock');if(dock)dock.dataset.layout=videoLayout;
    for(const button of document.querySelectorAll('.video-dock-head [data-layout]'))button.classList.toggle('active',button.dataset.layout===videoLayout);
    // Presenter state arrives repeatedly while screen sharing. Only a layout
    // change invalidates rendered structure; unchanged state must preserve
    // real <video> nodes and any incoming remote-frame image elements.
    // renderParticipants() follows the participant-state update in onState.
  }
  q('#videoViewSpeaker')?.addEventListener('click',()=>void presenterCommand('layout-speaker'));
  q('#videoViewStrip')?.addEventListener('click',()=>void presenterCommand('layout-strip'));
  q('#videoViewGallery')?.addEventListener('click',()=>void presenterCommand('layout-gallery'));
  q('#videoViewHide')?.addEventListener('click',()=>void presenterCommand('layout-hide'));

  document.addEventListener('pointerdown',event=>{if(!event.target?.closest?.('#videoActionMenu,[data-video-more]'))closeMenu();},true);
  window.addEventListener('blur',closeMenu);document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  window.addEventListener('pagehide',()=>{closeMenu();receiver?.stop?.();liveStreams.clear();},{once:true});

  async function boot(){
    await loadIdentity();participants=normalizedParticipants(participants);renderParticipants(true);
  }

  bridge?.onState?.(state=>{
    const nextCameraOn=state?.cameraOn!==false,nextMicOn=state?.micOn!==false,nextCameraId=String(state?.cameraId||''),nextMirror=state?.mirror!==false;
    cameraOn=nextCameraOn;micOn=nextMicOn;cameraId=nextCameraId;mirrored=nextMirror;speaking=Boolean(micOn&&state?.speaking);
    if(state?.videoLayout&&state.videoLayout!=='hide')videoLayout=String(state.videoLayout);
    participants=normalizedParticipants(state?.participants);
    setLayoutActive(videoLayout);renderParticipants();
    // Camera frames are delivered by the meeting's existing media owner.
  });
  const receiver=window.DominionCompanionRTC?.createReceiver?.(bridge,{
    onTrack:(id,stream)=>attachLiveStream(id,stream),
    onClose:id=>detachStream(id),
    onError:error=>console.warn('[DominionStar Meet] Companion receiver:',String(error?.message||error))
  });

  window.addEventListener('beforeunload',()=>{receiver?.stop?.();liveStreams.clear();},{once:true});
  window.addEventListener('unload',()=>{remoteFrames.clear();frameEpoch.clear();},{once:true});
  void boot();
})();