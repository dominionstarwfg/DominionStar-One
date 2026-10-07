(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{},bridge=desktop.macShare||null;
  const q=s=>document.querySelector(s);
  let cameraOn=true,micOn=false,mirrored=true;
  let videoLayout='strip',participants=[],identity={name:'You',avatar:''},lastSignature='';
  let speaking=false,pinnedId='',activeMenuId='',selfParticipantId='';
  const remoteFrames=new Map();
  const frameDecodeSeq=new Map(),paintedFrames=new Map();

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

  const localRole=()=>String(participants.find(item=>item.self)?.role||'participant').toLowerCase();
  const canManage=()=>['host','cohost'].includes(localRole());
  function normalizedParticipants(input){
    const out=[],seen=new Set();
    for(const raw of Array.isArray(input)?input:[]){
      const id=String(raw?.participantId||'');if(!id||seen.has(id))continue;seen.add(id);
      const explicitSelf=Boolean(raw?.self),self=explicitSelf||Boolean(selfParticipantId&&id===selfParticipantId);
      if(explicitSelf)selfParticipantId=id;
      out.push({participantId:id,name:String(raw?.name||'Participant').trim()||'Participant',role:String(raw?.role||'participant').toLowerCase(),self,micOn:Boolean(raw?.micOn),cameraOn:Boolean(raw?.cameraOn),avatar:String(raw?.avatar||'')});
    }
    const realParticipants=out.filter(item=>item.participantId!=='local-self');
    if(realParticipants.length&&out.some(item=>item.participantId==='local-self')){
      const syntheticIndex=out.findIndex(item=>item.participantId==='local-self');
      if(syntheticIndex>=0)out.splice(syntheticIndex,1);
    }
    if(!out.some(item=>item.self)&&selfParticipantId){
      const known=out.find(item=>item.participantId===selfParticipantId);if(known)known.self=true;
    }
    if(!out.some(item=>item.self)&&out.length===1){out[0].self=true;selfParticipantId=out[0].participantId;}
    if(!out.length){selfParticipantId='local-self';out.push({participantId:selfParticipantId,name:identity.name,role:'participant',self:true,micOn,cameraOn,avatar:identity.avatar});}
    const self=out.find(item=>item.self);if(self){selfParticipantId=self.participantId;self.micOn=micOn;self.cameraOn=cameraOn;if(!self.name||self.name==='You')self.name=identity.name;if(!self.avatar)self.avatar=identity.avatar;}
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
  function paintRemoteFrame(tile,person,dataUrl){
    const id=String(person?.participantId||''),canvas=tile?.querySelector('canvas.remote-frame'),fallback=tile?.querySelector('.video-fallback');
    if(!id||!canvas||!dataUrl)return false;
    if(paintedFrames.get(id)===dataUrl){
      canvas.hidden=false;if(fallback)fallback.hidden=true;canvas.style.transform=person.self&&mirrored?'scaleX(-1)':'none';return true;
    }
    const seq=(frameDecodeSeq.get(id)||0)+1;frameDecodeSeq.set(id,seq);
    const decoder=new Image();decoder.decoding='async';
    decoder.onload=()=>{
      if(frameDecodeSeq.get(id)!==seq||!tile.isConnected)return;
      const cssWidth=Math.max(1,canvas.clientWidth||tile.clientWidth||252),cssHeight=Math.max(1,canvas.clientHeight||tile.clientHeight||132);
      const dpr=Math.min(2,Math.max(1,Number(window.devicePixelRatio)||1));
      const width=Math.max(1,Math.round(cssWidth*dpr)),height=Math.max(1,Math.round(cssHeight*dpr));
      if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
      const context=canvas.getContext('2d',{alpha:false,desynchronized:true,colorSpace:'srgb'});if(!context)return;
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.fillStyle='#111';context.fillRect(0,0,width,height);
      const sourceWidth=decoder.naturalWidth||width,sourceHeight=decoder.naturalHeight||height,sourceRatio=sourceWidth/sourceHeight,targetRatio=width/height;
      let sx=0,sy=0,sw=sourceWidth,sh=sourceHeight;
      if(sourceRatio>targetRatio){sw=Math.round(sourceHeight*targetRatio);sx=Math.round((sourceWidth-sw)/2);}
      else if(sourceRatio<targetRatio){sh=Math.round(sourceWidth/targetRatio);sy=Math.round((sourceHeight-sh)/2);}
      context.drawImage(decoder,sx,sy,sw,sh,0,0,width,height);
      paintedFrames.set(id,dataUrl);canvas.dataset.frameReady='1';canvas.dataset.frameAt=String(Date.now());canvas.hidden=false;
      canvas.style.transform=person.self&&mirrored?'scaleX(-1)':'none';if(fallback)fallback.hidden=true;
    };
    decoder.onerror=()=>{};
    decoder.src=dataUrl;return true;
  }
  function createTile(person,stack){
    const tile=document.createElement('article');tile.className='video-tile';tile.dataset.participantId=person.participantId;
    tile.innerHTML=`
      <canvas class="remote-frame" aria-label="Live participant video" hidden></canvas>
      <div class="video-fallback"><img class="fallback-avatar" alt="" hidden><span></span></div>
      <div class="video-tile-actions">
        <button type="button" class="video-primary-action" data-video-primary></button>
        <button type="button" class="video-more-action" data-video-more>•••</button>
      </div>
      <div class="video-tile-name"><span data-video-mic-state></span><strong></strong></div>`;
    const fallbackAvatar=tile.querySelector('.fallback-avatar'),fallbackInitials=tile.querySelector('.video-fallback span');
    fallbackAvatar.onload=()=>{fallbackAvatar.hidden=false;if(fallbackInitials)fallbackInitials.hidden=true;};
    fallbackAvatar.onerror=()=>{fallbackAvatar.hidden=true;if(fallbackInitials)fallbackInitials.hidden=false;};
    tile.querySelector('[data-video-primary]').addEventListener('click',event=>{
      event.stopPropagation();const current=participants.find(item=>item.participantId===tile.dataset.participantId);if(current)void runPrimary(current);
    });
    tile.querySelector('[data-video-more]').addEventListener('click',event=>{
      event.stopPropagation();const current=participants.find(item=>item.participantId===tile.dataset.participantId);if(current)openMenu(current,tile);
    });
    stack.append(tile);return tile;
  }
  function updateTile(tile,person){
    tile.dataset.self=person.self?'1':'0';
    const frame=remoteFrames.get(person.participantId)||'',canvas=tile.querySelector('canvas.remote-frame'),fallback=tile.querySelector('.video-fallback');
    const fallbackAvatar=tile.querySelector('.fallback-avatar'),fallbackInitials=tile.querySelector('.video-fallback span');
    const live=Boolean(person.cameraOn&&frame);
    if(live)paintRemoteFrame(tile,person,frame);
    else{
      frameDecodeSeq.set(person.participantId,(frameDecodeSeq.get(person.participantId)||0)+1);
      if(canvas){canvas.hidden=true;canvas.dataset.frameReady='0';canvas.style.transform=person.self&&mirrored?'scaleX(-1)':'none';}
      if(fallback)fallback.hidden=false;
    }
    if(fallbackInitials)fallbackInitials.textContent=initials(person.name);
    if(fallbackAvatar){
      if(person.avatar){
        if(fallbackInitials)fallbackInitials.hidden=true;
        fallbackAvatar.hidden=false;
        if(fallbackAvatar.src!==person.avatar)fallbackAvatar.src=person.avatar;
      }else{
        fallbackAvatar.hidden=true;
        if(fallbackInitials)fallbackInitials.hidden=false;
      }
    }
    const primary=tile.querySelector('[data-video-primary]');if(primary)primary.textContent=primaryLabel(person);
    const more=tile.querySelector('[data-video-more]');if(more)more.setAttribute('aria-label',`More options for ${person.name}`);
    const micState=tile.querySelector('[data-video-mic-state]');if(micState)micState.innerHTML=person.micOn?'':mutedIcon();
    const name=tile.querySelector('.video-tile-name strong');if(name&&name.textContent!==person.name)name.textContent=person.name;
  }
  function renderParticipants(force=false){
    const list=orderedParticipants(),signature=JSON.stringify({layout:videoLayout,pinnedId,mirrored,list:list.map(p=>[p.participantId,p.name,p.role,p.self,p.micOn,p.cameraOn,p.avatar])});
    if(!force&&signature===lastSignature){syncSpeaking();return;}
    lastSignature=signature;
    const stack=q('#videoStack');if(!stack)return;stack.classList.toggle('is-scrollable',list.length>5);
    const keep=new Set();
    for(const person of list){
      keep.add(person.participantId);
      let tile=stack.querySelector(`.video-tile[data-participant-id="${CSS.escape(person.participantId)}"]`);
      if(!tile)tile=createTile(person,stack);
      updateTile(tile,person);stack.append(tile);
    }
    for(const tile of [...stack.querySelectorAll('.video-tile')])if(!keep.has(String(tile.dataset.participantId||''))){const id=String(tile.dataset.participantId||'');tile.remove();remoteFrames.delete(id);paintedFrames.delete(id);frameDecodeSeq.delete(id);}
    syncSpeaking();
    if(activeMenuId&&!participants.some(item=>item.participantId===activeMenuId))closeMenu();
  }
  function syncSpeaking(){
    for(const tile of document.querySelectorAll('.video-tile'))tile.classList.toggle('speaking',tile.dataset.self==='1'&&speaking);
  }
  function applyRemoteFrame(payload={}){
    const id=String(payload.participantId||''),dataUrl=String(payload.dataUrl||'');
    if(!id||!['data:image/jpeg;base64,','data:image/webp;base64,','data:image/png;base64,'].some(prefix=>dataUrl.startsWith(prefix)))return;
    remoteFrames.set(id,dataUrl);const person=participants.find(item=>item.participantId===id);if(!person?.cameraOn){if(window.__DOMINION_QA_PRESENTER_TRACE)console.error(`QA_MAC_VIDEO_FRAME_DEFER participant=${id} known=${person?1:0} camera=${person?.cameraOn?1:0} participants=${participants.map(item=>item.participantId).join(',')}`);return;}
    const tile=q(`.video-tile[data-participant-id="${CSS.escape(id)}"]`);
    if(tile){paintRemoteFrame(tile,person,dataUrl);if(window.__DOMINION_QA_PRESENTER_TRACE)console.error(`QA_MAC_VIDEO_FRAME_APPLIED participant=${id} self=${person.self?1:0}`);}
    else if(window.__DOMINION_QA_PRESENTER_TRACE)console.error(`QA_MAC_VIDEO_FRAME_NO_TILE participant=${id}`);
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
    const next=['speaker','strip','gallery'].includes(String(layout))?String(layout):'strip';
    const changed=next!==videoLayout;videoLayout=next;
    const dock=q('#dock');if(dock&&dock.dataset.layout!==videoLayout)dock.dataset.layout=videoLayout;
    for(const button of document.querySelectorAll('.video-dock-head [data-layout]'))button.classList.toggle('active',button.dataset.layout===videoLayout);
    return changed;
  }
  q('#videoViewSpeaker')?.addEventListener('click',()=>void presenterCommand('layout-speaker'));
  q('#videoViewStrip')?.addEventListener('click',()=>void presenterCommand('layout-strip'));
  q('#videoViewGallery')?.addEventListener('click',()=>void presenterCommand('layout-gallery'));
  q('#videoViewHide')?.addEventListener('click',()=>void presenterCommand('layout-hide'));

  document.addEventListener('pointerdown',event=>{if(!event.target?.closest?.('#videoActionMenu,[data-video-more]'))closeMenu();},true);
  window.addEventListener('blur',closeMenu);document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  window.addEventListener('pagehide',closeMenu,{once:true});

  async function boot(){
    const env=await window.dominionDesktop?.environment?.().catch(()=>null);window.__DOMINION_QA_PRESENTER_TRACE=Boolean(env?.qaPresenterFixtures);
    await loadIdentity();participants=normalizedParticipants(participants);renderParticipants(true);
  }

  bridge?.onState?.(state=>{
    cameraOn=state?.cameraOn!==false;micOn=state?.micOn!==false;mirrored=state?.mirror!==false;const dock=q('#dock');if(dock)dock.dataset.cameraOn=cameraOn?'1':'0';const voiceLevel=Math.max(0,Math.min(1,Number(state?.voiceLevel)||0));speaking=Boolean(micOn&&state?.speaking&&voiceLevel>0);if(window.__DOMINION_QA_PRESENTER_TRACE&&voiceLevel>0)console.error(`QA_MAC_VIDEO_VOICE level=${voiceLevel.toFixed(3)} speaking=${speaking?1:0} mic=${micOn?1:0}`);
    if(state?.videoLayout&&state.videoLayout!=='hide')videoLayout=String(state.videoLayout);
    const stateFrames=[];
    for(const frame of Array.isArray(state?.videoFrames)?state.videoFrames:[]){
      const id=String(frame?.participantId||''),dataUrl=String(frame?.dataUrl||'');
      if(!id||!['data:image/jpeg;base64,','data:image/webp;base64,','data:image/png;base64,'].some(prefix=>dataUrl.startsWith(prefix)))continue;
      if(remoteFrames.get(id)!==dataUrl)remoteFrames.set(id,dataUrl);
      stateFrames.push({participantId:id,dataUrl});
    }
    participants=normalizedParticipants(state?.participants);
    const layoutChanged=setLayoutActive(videoLayout);if(layoutChanged)lastSignature='';
    renderParticipants(layoutChanged);
    for(const frame of stateFrames){const person=participants.find(item=>item.participantId===frame.participantId),tile=q(`.video-tile[data-participant-id="${CSS.escape(frame.participantId)}"]`);if(person?.cameraOn&&tile)paintRemoteFrame(tile,person,frame.dataUrl);}
    if(window.__DOMINION_QA_PRESENTER_TRACE&&stateFrames.length)console.error(`QA_MAC_VIDEO_STATE_FRAMES count=${stateFrames.length} participants=${participants.map(item=>item.participantId).join(',')}`);
  });
  bridge?.onVideoFrame?.(applyRemoteFrame);
  void boot();
})();