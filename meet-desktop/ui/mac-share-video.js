(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{},bridge=desktop.macShare||null;
  const q=s=>document.querySelector(s);
  let cameraOn=true,micOn=false,cameraId='',mirrored=true,previewStream=null,previewLive=false,previewGeneration=0;
  let qaInteractionFixtures=false,qaCanvasTimer=0,videoLayout='strip',participants=[],identity={name:'You',avatar:''},lastSignature='';
  let speaking=false,pinnedId='',activeMenuId='';
  const remoteFrames=new Map();

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

  const stopTracks=stream=>{for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}};
  function stopQaCanvas(){if(qaCanvasTimer){clearInterval(qaCanvasTimer);qaCanvasTimer=0;}}
  function stopPreview(){
    previewGeneration+=1;stopQaCanvas();stopTracks(previewStream);previewStream=null;previewLive=false;
    const video=q('.video-tile[data-self="1"] video');if(video){try{video.pause();}catch{}video.srcObject=null;}
  }
  function makeQaPreviewStream(){
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const context=canvas.getContext('2d',{alpha:false});
    const paint=()=>{context.fillStyle='#112a3f';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#f0c769';context.beginPath();context.arc(320,180,92,0,Math.PI*2);context.fill();context.fillStyle='#fff';context.font='600 24px -apple-system,BlinkMacSystemFont,sans-serif';context.textAlign='center';context.fillText('LIVE CAMERA',320,188);};
    paint();qaCanvasTimer=setInterval(paint,250);return canvas.captureStream(8);
  }
  function attachLocalPreview(){
    const tile=q('.video-tile[data-self="1"]'),video=tile?.querySelector('video'),fallback=tile?.querySelector('.video-fallback');
    if(!tile||!video)return;
    const live=Boolean(cameraOn&&previewLive&&previewStream?.getVideoTracks?.().some(track=>track.readyState==='live'));
    if(live){if(video.srcObject!==previewStream)video.srcObject=previewStream;video.style.transform=mirrored?'scaleX(-1)':'none';video.hidden=false;if(fallback)fallback.hidden=true;void video.play().catch(()=>{});}
    else{video.hidden=true;if(video.srcObject&&!cameraOn)video.srcObject=null;if(fallback)fallback.hidden=false;}
  }
  async function openPreview(){
    const generation=++previewGeneration;if(!cameraOn){stopPreview();attachLocalPreview();return;}
    let stream=null;
    try{
      if(qaInteractionFixtures)stream=makeQaPreviewStream();
      else{
        const video={width:{ideal:640},height:{ideal:360},frameRate:{ideal:15,max:20}};if(cameraId)video.deviceId={ideal:cameraId};
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video});
      }
      if(generation!==previewGeneration||!cameraOn){stopTracks(stream);return;}
      const track=stream?.getVideoTracks?.()[0]||null;if(!track)throw new Error('presenter_camera_track_unavailable');
      previewStream=stream;previewLive=true;attachLocalPreview();
      track.addEventListener('ended',()=>{if(generation!==previewGeneration)return;previewLive=false;previewStream=null;attachLocalPreview();if(cameraOn)setTimeout(()=>{if(generation===previewGeneration&&cameraOn)void openPreview();},300);},{once:true});
    }catch(error){stopTracks(stream);if(generation!==previewGeneration)return;previewStream=null;previewLive=false;attachLocalPreview();console.error('[DominionStar Meet] Presenter camera preview unavailable.',error);}
  }
  function syncPreview(){
    if(!cameraOn){stopPreview();attachLocalPreview();return;}
    const track=previewStream?.getVideoTracks?.()[0]||null,actualId=String(track?.getSettings?.().deviceId||'');
    if(track&&track.readyState==='live'&&(!cameraId||!actualId||actualId===cameraId)){previewLive=true;attachLocalPreview();return;}
    stopPreview();void openPreview();
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
  function syncStripNavigation(){
    const stack=q('#videoStack'),up=q('#videoScrollUp'),down=q('#videoScrollDown');if(!stack||!up||!down)return;
    const active=videoLayout==='strip'&&participants.length>5;
    stack.classList.toggle('has-overflow',active);up.hidden=!active;down.hidden=!active;
    if(!active){stack.scrollTop=0;up.disabled=true;down.disabled=true;return;}
    const max=Math.max(0,stack.scrollHeight-stack.clientHeight);
    up.disabled=stack.scrollTop<=2;down.disabled=stack.scrollTop>=max-2;
  }
  function scrollStrip(direction){
    const stack=q('#videoStack');if(!stack||videoLayout!=='strip'||participants.length<=5)return;
    const first=stack.querySelector('.video-tile'),step=Math.max(1,Math.round((first?.getBoundingClientRect().height||132)+2));
    stack.scrollBy({top:direction*step,behavior:'smooth'});setTimeout(syncStripNavigation,180);
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
    const list=orderedParticipants(),signature=JSON.stringify({layout:videoLayout,pinnedId,list:list.map(p=>[p.participantId,p.name,p.role,p.self,p.micOn,p.cameraOn,p.avatar])});
    if(!force&&signature===lastSignature){syncSpeaking();attachLocalPreview();return;}
    lastSignature=signature;
    const stack=q('#videoStack');if(!stack)return;stack.textContent='';
    for(const person of list){
      const tile=document.createElement('article');tile.className='video-tile';tile.dataset.participantId=person.participantId;tile.dataset.self=person.self?'1':'0';
      const frame=remoteFrames.get(person.participantId)||'';
      const avatar=person.avatar?'<img class="fallback-avatar" alt="" src="'+escapeHtml(person.avatar)+'">':'';
      tile.innerHTML=`
        ${person.self?'<video autoplay muted playsinline hidden></video>':'<img class="remote-frame" alt="" hidden>'}
        <div class="video-fallback">${avatar}<span>${escapeHtml(initials(person.name))}</span></div>
        <div class="video-tile-actions">
          <button type="button" class="video-primary-action" data-video-primary>${escapeHtml(primaryLabel(person))}</button>
          <button type="button" class="video-more-action" data-video-more aria-label="More options for ${escapeHtml(person.name)}">•••</button>
        </div>
        <div class="video-tile-name">${person.micOn?'':mutedIcon()}<strong>${escapeHtml(person.name)}</strong></div>`;
      const fallback=tile.querySelector('.video-fallback'),fallbackAvatar=tile.querySelector('.fallback-avatar'),fallbackInitials=tile.querySelector('.video-fallback span');
      if(fallbackAvatar){fallbackAvatar.onload=()=>{if(fallbackInitials)fallbackInitials.hidden=true;};fallbackAvatar.onerror=()=>{fallbackAvatar.hidden=true;if(fallbackInitials)fallbackInitials.hidden=false;};}
      if(!person.self&&person.cameraOn&&frame){const img=tile.querySelector('.remote-frame');img.src=frame;img.hidden=false;if(fallback)fallback.hidden=true;}
      tile.querySelector('[data-video-primary]').addEventListener('click',event=>{event.stopPropagation();void runPrimary(person);});
      tile.querySelector('[data-video-more]').addEventListener('click',event=>{event.stopPropagation();openMenu(person,tile);});
      stack.append(tile);
    }
    syncSpeaking();attachLocalPreview();syncStripNavigation();
    if(activeMenuId&&!participants.some(item=>item.participantId===activeMenuId))closeMenu();
  }
  function syncSpeaking(){
    for(const tile of document.querySelectorAll('.video-tile'))tile.classList.toggle('speaking',tile.dataset.self==='1'&&speaking);
  }
  function applyRemoteFrame(payload={}){
    const id=String(payload.participantId||''),dataUrl=String(payload.dataUrl||'');if(!id||!dataUrl)return;
    remoteFrames.set(id,dataUrl);const person=participants.find(item=>item.participantId===id);if(!person?.cameraOn)return;
    const tile=q(`.video-tile[data-participant-id="${CSS.escape(id)}"]`),img=tile?.querySelector('.remote-frame'),fallback=tile?.querySelector('.video-fallback');
    if(img){img.src=dataUrl;img.hidden=false;if(fallback)fallback.hidden=true;}
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
    lastSignature='';renderParticipants(true);requestAnimationFrame(syncStripNavigation);
  }
  q('#videoViewSpeaker')?.addEventListener('click',()=>void presenterCommand('layout-speaker'));
  q('#videoViewStrip')?.addEventListener('click',()=>void presenterCommand('layout-strip'));
  q('#videoViewGallery')?.addEventListener('click',()=>void presenterCommand('layout-gallery'));
  q('#videoViewHide')?.addEventListener('click',()=>void presenterCommand('layout-hide'));
  q('#videoScrollUp')?.addEventListener('click',()=>scrollStrip(-1));
  q('#videoScrollDown')?.addEventListener('click',()=>scrollStrip(1));
  q('#videoStack')?.addEventListener('scroll',syncStripNavigation,{passive:true});

  document.addEventListener('pointerdown',event=>{if(!event.target?.closest?.('#videoActionMenu,[data-video-more]'))closeMenu();},true);
  window.addEventListener('blur',closeMenu);document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  window.addEventListener('pagehide',()=>{closeMenu();stopPreview();},{once:true});

  async function boot(){
    try{const environment=await desktop.environment?.();qaInteractionFixtures=Boolean(environment?.qaPresenterFixtures||environment?.qaInteractionFixtures);}catch{}
    await loadIdentity();participants=normalizedParticipants(participants);renderParticipants(true);syncPreview();
  }

  bridge?.onState?.(state=>{
    const nextCameraOn=state?.cameraOn!==false,nextMicOn=state?.micOn!==false,nextCameraId=String(state?.cameraId||''),nextMirror=state?.mirror!==false;
    const cameraChanged=nextCameraOn!==cameraOn,deviceChanged=nextCameraId!==cameraId,mirrorChanged=nextMirror!==mirrored;
    cameraOn=nextCameraOn;micOn=nextMicOn;cameraId=nextCameraId;mirrored=nextMirror;speaking=Boolean(micOn&&state?.speaking);
    if(state?.videoLayout&&state.videoLayout!=='hide')videoLayout=String(state.videoLayout);
    participants=normalizedParticipants(state?.participants);
    setLayoutActive(videoLayout);renderParticipants();
    if(cameraChanged||deviceChanged)syncPreview();else if(mirrorChanged)attachLocalPreview();else attachLocalPreview();
  });
  bridge?.onVideoFrame?.(applyRemoteFrame);

  window.addEventListener('beforeunload',stopPreview,{once:true});
  window.addEventListener('unload',stopPreview,{once:true});
  void boot();
})();