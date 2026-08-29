(()=>{
  if(window.DominionMeetingParity)return;
  const desktop=window.dominionDesktop||{};
  const media=()=>window.DominionMediaController||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const GEOMETRY_KEY='ds_zoom_video_dock_geometry_v1';
  const PANEL_KEY='ds_zoom_participant_panel_geometry_v1';
  const SVG=Object.freeze({
    mic:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></svg>',
    video:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
    security:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6z"/><path d="m9 12 2 2 4-5"/></svg>',
    participants:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20a6 6 0 0 1 12 0M14 19a4.8 4.8 0 0 1 7 0"/></svg>',
    share:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="3"/><path d="m8 11 4-4 4 4M12 7v8M8 21h8"/></svg>',
    settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06-2.12 2.12-.06-.06a1.8 1.8 0 0 0-1.98-.36A1.8 1.8 0 0 0 14.6 20.4V21h-5v-.6a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-1.98.36l-.06.06-2.12-2.12.06-.06A1.8 1.8 0 0 0 4.76 15 1.8 1.8 0 0 0 3.1 13.9H3v-3h.1A1.8 1.8 0 0 0 4.76 9.8a1.8 1.8 0 0 0-.36-1.98l-.06-.06 2.12-2.12.06.06a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 9.6 4.4V4h5v.4a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 1.98-.36l.06-.06a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.66 1.1h.1v3h-.1A1.8 1.8 0 0 0 19.4 15z"/></svg>',
    more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    exit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h9a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8M12 8l-4 4 4 4M8 12h9"/></svg>'
  });
  let moreMenu=null,securityMenu=null,viewMenu=null,panelDrag=null,dockDrag=null,dockResize=null,shareSplitDrag=null,lastMeta='',spotlightParticipantId='',activeSpeakerIds=[]; const VIEW_KEY='ds_meet_view_mode',SHARE_SPLIT_KEY='ds_meet_share_split_ratio';
  if(!document.querySelector('link[data-ds-meeting-parity]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./meeting-parity.css';link.dataset.dsMeetingParity='1';document.head.append(link);}
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const formatCode=value=>String(value||'').replace(/\D/g,'').replace(/(\d{3})(?=\d)/g,'$1 ').trim();
  const meetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const sharing=()=>Boolean(q('#meetingOverlay')?.classList.contains('share-active')||document.body.classList.contains('remote-share-active'));
  const readView=()=>{try{const v=localStorage.getItem(VIEW_KEY);return ['speaker','gallery','multi'].includes(v)?v:'speaker';}catch{return 'speaker';}};
  const saveView=value=>{try{localStorage.setItem(VIEW_KEY,value);}catch{}};
  const readShareSplit=()=>{try{return clamp(Number(localStorage.getItem(SHARE_SPLIT_KEY))||.74,.52,.86);}catch{return .74;}};
  const saveShareSplit=value=>{try{localStorage.setItem(SHARE_SPLIT_KEY,String(clamp(value,.52,.86)));}catch{}};
  function applyViewMode(value=readView()){
    const mode=['speaker','gallery','multi'].includes(value)?value:'speaker',overlay=q('#meetingOverlay'),dock=q('#participantVideoDock');
    if(!overlay)return mode;overlay.dataset.viewMode=mode;saveView(mode);
    overlay.classList.toggle('view-speaker',mode==='speaker');overlay.classList.toggle('view-gallery',mode==='gallery');overlay.classList.toggle('view-multi',mode==='multi');
    dock?.classList.toggle('gallery-stage',mode==='gallery'&&!sharing());
    dock?.classList.toggle('multi-speaker-stage',mode==='multi'&&!sharing());
    syncVideoDock();return mode;
  }

  function syncBrand(){
    const logo=String(desktop.brand?.logoUrl||'');if(!logo)return;
    for(const target of qa('.brand-mark,.auth-brand')){
      if(target.querySelector('img[data-ds-real-logo]'))continue;
      const img=document.createElement('img');img.src=logo;img.alt='DominionStar';img.dataset.dsRealLogo='1';img.className='ds-real-brand-logo';
      if(target.classList.contains('brand-mark')){target.textContent='';target.append(img);}else target.prepend(img);
    }
    const head=q('.meeting-head');if(head&&!head.querySelector('.ds-meeting-brand')){const wrap=document.createElement('div');wrap.className='ds-meeting-brand';wrap.innerHTML=`<img src="${logo}" alt="DominionStar"><strong>DominionStar Meet</strong>`;head.prepend(wrap);}
  }

  function syncGreeting(){
    const heading=q('#welcomeHeading'),profile=q('#profileName');if(!heading||!profile)return;
    const name=String(profile.textContent||'').trim();if(!name||name==='DominionStar')return;
    const first=name.split(/\s+/)[0],hour=new Date().getHours(),greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';heading.textContent=`${greeting}, ${first}`;
  }

  async function syncMeetingMeta(){
    if(!meetingOpen()||!desktop.meeting?.context)return;
    try{const ctx=await desktop.meeting.context();const id=formatCode(ctx?.roomCode),pass=String(ctx?.passcode||'');const label=q('#roomCodeLabel');if(label&&id){const next=`Meeting ID ${id}${pass?`  •  Passcode ${pass}`:''}`;if(label.textContent!==next)label.textContent=next;lastMeta=next;}}catch{}
  }

  function decorate(button,icon){
    if(!button||!icon||button.querySelector('.ds-control-icon'))return;
    const text=String(button.textContent||button.getAttribute('aria-label')||'Control').trim();button.textContent='';const i=document.createElement('span');i.className='ds-control-icon';i.innerHTML=icon;const l=document.createElement('span');l.className='ds-control-label';l.textContent=text;button.append(i,l);button.setAttribute('aria-label',text);
  }
  function decorateControls(){decorate(q('#roomMic'),SVG.mic);decorate(q('#roomCamera'),SVG.video);decorate(q('#roomSecurity'),SVG.security);decorate(q('#roomParticipants'),SVG.participants);decorate(q('#roomShare'),SVG.share);decorate(q('#roomSettings'),SVG.settings);decorate(q('#roomMore'),SVG.more);decorate(q('#roomExitButton'),SVG.exit);}
  function ensureViewButton(){
    const head=q('.meeting-head');if(!head)return null;let button=q('#meetingViewButton');if(button)return button;
    button=document.createElement('button');button.id='meetingViewButton';button.type='button';button.className='meeting-view-button';button.textContent='View';button.setAttribute('aria-haspopup','menu');
    head.append(button);button.onclick=event=>{event.stopPropagation();openViewMenu(button);};return button;
  }
  function openViewMenu(anchor){
    closeMenus();viewMenu=menuAt(anchor,'meeting-more-menu view-menu');const current=readView();
    const items=[['speaker',sharing()?'Side-by-side: Speaker':'Speaker'],['gallery',sharing()?'Side-by-side: Gallery':'Gallery'],['multi',sharing()?'Side-by-side: Multi-speaker':'Multi-speaker']];
    for(const [mode,label] of items){const b=document.createElement('button');b.type='button';b.textContent=`${current===mode?'✓ ':''}${label}`;b.onclick=()=>{applyViewMode(mode);closeMenus();};viewMenu.append(b);}
    if(sharing()){
      const divider=document.createElement('div');divider.className='view-menu-divider';viewMenu.append(divider);
      const visible=window.DominionPreferences?.read?.('shareVideoDock')!==false;
      const panel=document.createElement('button');panel.type='button';panel.textContent=visible?'Hide Video Panel':'Show Video Panel';
      panel.onclick=()=>{window.DominionPreferences?.write?.('shareVideoDock',!visible);syncShareLayout();syncVideoDock();closeMenus();};viewMenu.append(panel);
    }
  }

  function ensureShareSplitter(){
    const stage=q('.stage');if(!stage)return null;let splitter=q('#shareLayoutSplitter');if(splitter)return splitter;
    splitter=document.createElement('div');splitter.id='shareLayoutSplitter';splitter.className='share-layout-splitter';splitter.hidden=true;splitter.setAttribute('role','separator');splitter.setAttribute('aria-orientation','vertical');splitter.setAttribute('aria-label','Resize shared content and participant video');
    stage.append(splitter);
    splitter.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;const rect=stage.getBoundingClientRect();shareSplitDrag={id:event.pointerId,left:rect.left,width:rect.width};splitter.setPointerCapture?.(event.pointerId);event.preventDefault();
    });
    splitter.addEventListener('pointermove',event=>{
      if(!shareSplitDrag||event.pointerId!==shareSplitDrag.id)return;
      const ratio=clamp((event.clientX-shareSplitDrag.left)/Math.max(1,shareSplitDrag.width),.52,.86);stage.style.setProperty('--share-content-ratio',String(ratio));saveShareSplit(ratio);
    });
    const end=event=>{if(!shareSplitDrag||(event?.pointerId!=null&&event.pointerId!==shareSplitDrag.id))return;shareSplitDrag=null;};
    splitter.addEventListener('pointerup',end);splitter.addEventListener('pointercancel',end);
    return splitter;
  }
  function syncShareLayout(){
    const overlay=q('#meetingOverlay'),stage=q('.stage'),dock=q('#participantVideoDock'),splitter=ensureShareSplitter();if(!overlay||!stage||!dock||!splitter)return;
    const active=sharing(),mode=readView(),showPanel=window.DominionPreferences?.read?.('shareVideoDock')!==false;
    overlay.classList.toggle('share-side-by-side',active&&showPanel);
    overlay.classList.toggle('share-panel-hidden',active&&!showPanel);
    overlay.dataset.shareView=active?mode:'';
    splitter.hidden=!(active&&showPanel);
    qa('#participantVideoDock .remote-peer-tile').forEach(tile=>tile.classList.remove('share-featured'));
    if(active&&showPanel&&mode==='speaker'){
      const featured=(spotlightParticipantId?q(`#participantVideoDock .remote-peer-tile[data-peer-id="${CSS.escape(spotlightParticipantId)}"]`):null)
        ||q('#participantVideoDock .remote-peer-tile.active-speaker')
        ||qa('#participantVideoDock .remote-peer-tile').find(tile=>!tile.hidden&&!tile.classList.contains('local-video-dock-tile'))
        ||q('#localVideoDockTile');
      featured?.classList.add('share-featured');
    }
    if(active&&!showPanel)dock.hidden=true;
    if(active&&showPanel){
      stage.style.setProperty('--share-content-ratio',String(readShareSplit()));
      dock.classList.remove('gallery-stage','multi-speaker-stage');
      dock.dataset.orientation='vertical';
      dock.dataset.anchor='right';
      dock.classList.remove('user-positioned');
      dock.style.left='';dock.style.top='14px';dock.style.right='14px';dock.style.bottom='14px';
    }else{
      stage.style.removeProperty('--share-content-ratio');
    }
  }

  function savePanelGeometry(){const side=q('.room-side'),body=q('.meeting-body');if(!side||!body||side.hidden)return;try{const a=side.getBoundingClientRect(),b=body.getBoundingClientRect();localStorage.setItem(PANEL_KEY,JSON.stringify({left:a.left-b.left,top:a.top-b.top,width:a.width,height:a.height}));}catch{}}
  function restorePanelGeometry(){const side=q('.room-side'),body=q('.meeting-body');if(!side||!body)return;try{const g=JSON.parse(localStorage.getItem(PANEL_KEY)||'null');if(!g)return;const b=body.getBoundingClientRect(),w=clamp(Number(g.width)||330,260,Math.min(440,b.width-24)),h=clamp(Number(g.height)||520,260,Math.max(260,b.height-24));side.style.width=`${w}px`;side.style.height=`${h}px`;side.style.left=`${clamp(Number(g.left)||12,12,Math.max(12,b.width-w-12))}px`;side.style.top=`${clamp(Number(g.top)||12,12,Math.max(12,b.height-h-12))}px`;side.style.right='auto';side.style.bottom='auto';}catch{}}
  function toggleParticipants(force){const overlay=q('#meetingOverlay'),side=q('.room-side'),button=q('#roomParticipants');if(!overlay||!side)return;const show=typeof force==='boolean'?force:side.hidden;side.hidden=!show;overlay.classList.toggle('participants-hidden',!show);button?.setAttribute('aria-pressed',String(show));if(show)requestAnimationFrame(restorePanelGeometry);}
  function installParticipantPanel(){
    const overlay=q('#meetingOverlay'),side=q('.room-side');if(!overlay||!side||side.dataset.dsZoomPanel)return;side.dataset.dsZoomPanel='1';side.hidden=true;overlay.classList.add('participants-hidden');
    const head=document.createElement('div');head.className='room-side-head';head.innerHTML='<div><strong>Participants</strong><small>Waiting room and participant controls</small></div><button type="button" aria-label="Close participants">×</button>';side.prepend(head);head.querySelector('button').onclick=()=>toggleParticipants(false);
    head.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;const a=side.getBoundingClientRect();panelDrag={id:event.pointerId,dx:event.clientX-a.left,dy:event.clientY-a.top};head.setPointerCapture?.(event.pointerId);side.classList.add('dragging');side.style.right='auto';side.style.bottom='auto';event.preventDefault();});
    head.addEventListener('pointermove',event=>{if(!panelDrag||event.pointerId!==panelDrag.id)return;const body=q('.meeting-body').getBoundingClientRect(),w=side.offsetWidth,h=side.offsetHeight;side.style.left=`${clamp(event.clientX-body.left-panelDrag.dx,10,Math.max(10,body.width-w-10))}px`;side.style.top=`${clamp(event.clientY-body.top-panelDrag.dy,10,Math.max(10,body.height-h-10))}px`;});
    const end=event=>{if(!panelDrag||(event?.pointerId!=null&&event.pointerId!==panelDrag.id))return;panelDrag=null;side.classList.remove('dragging');savePanelGeometry();};head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);new ResizeObserver(()=>{if(!panelDrag)savePanelGeometry();}).observe(side);
  }

  function ensureVideoDock(){
    const stage=q('.stage');if(!stage)return null;let dock=q('#participantVideoDock');if(!dock){dock=document.createElement('aside');dock.id='participantVideoDock';dock.className='participant-video-dock';dock.dataset.anchor='right';dock.hidden=true;dock.innerHTML='<header class="participant-video-dock-head"><span class="dock-grip" aria-hidden="true"><i></i><i></i><i></i></span><strong>Participant video</strong><div><button type="button" data-dock-minimize aria-label="Minimize participant video">−</button><button type="button" data-dock-reset aria-label="Reset participant video position">↺</button></div></header><div class="participant-video-dock-body"></div><span class="participant-video-resize" aria-hidden="true"></span>';stage.append(dock);
      dock.querySelector('[data-dock-minimize]').onclick=()=>{dock.classList.toggle('minimized');dock.querySelector('[data-dock-minimize]').textContent=dock.classList.contains('minimized')?'□':'−';};dock.querySelector('[data-dock-reset]').onclick=()=>resetVideoDock();
      const head=dock.querySelector('.participant-video-dock-head');head.addEventListener('pointerdown',startDockDrag);head.addEventListener('pointermove',moveDockDrag);head.addEventListener('pointerup',endDockDrag);head.addEventListener('pointercancel',endDockDrag);
      const resize=dock.querySelector('.participant-video-resize');resize.addEventListener('pointerdown',startDockResize);resize.addEventListener('pointermove',moveDockResize);resize.addEventListener('pointerup',endDockResize);resize.addEventListener('pointercancel',endDockResize);restoreVideoDock();
    }
    const body=dock.querySelector('.participant-video-dock-body'),track=q('#remoteTileStrip');if(track&&track.parentElement!==body)body.append(track);
    let local=dock.querySelector('#localVideoDockTile');if(!local){local=document.createElement('article');local.id='localVideoDockTile';local.className='remote-peer-tile local-video-dock-tile';local.hidden=true;local.innerHTML='<video autoplay playsinline muted></video><div class="remote-peer-fallback"><span>YOU</span></div><footer><strong>You</strong><small>Local</small></footer>';body.prepend(local);}
    return dock;
  }

  const dockStageRect=()=>q('.stage')?.getBoundingClientRect()||null;
  function startDockDrag(event){if(event.button!==0||event.target.closest('button'))return;const dock=q('#participantVideoDock'),stage=dockStageRect();if(!dock||!stage)return;const rect=dock.getBoundingClientRect();dockDrag={id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};event.currentTarget.setPointerCapture?.(event.pointerId);dock.classList.add('dragging','user-positioned');dock.style.right='auto';dock.style.bottom='auto';event.preventDefault();}
  function moveDockDrag(event){if(!dockDrag||event.pointerId!==dockDrag.id)return;const dock=q('#participantVideoDock'),stage=dockStageRect();if(!dock||!stage)return;dock.style.left=`${clamp(event.clientX-stage.left-dockDrag.dx,8,Math.max(8,stage.width-dock.offsetWidth-8))}px`;dock.style.top=`${clamp(event.clientY-stage.top-dockDrag.dy,8,Math.max(8,stage.height-dock.offsetHeight-8))}px`;}
  function nearestAnchor(dock,stage){const r=dock.getBoundingClientRect(),d={left:r.left-stage.left,right:stage.right-r.right,top:r.top-stage.top,bottom:stage.bottom-r.bottom};return Object.entries(d).sort((a,b)=>a[1]-b[1])[0][0];}
  function endDockDrag(event){if(!dockDrag||(event?.pointerId!=null&&event.pointerId!==dockDrag.id))return;const dock=q('#participantVideoDock'),stage=dockStageRect();dockDrag=null;if(dock&&stage){dock.classList.remove('dragging');dock.dataset.anchor=nearestAnchor(dock,stage);saveVideoDock();syncVideoDock();}}
  function startDockResize(event){if(event.button!==0)return;const dock=q('#participantVideoDock');if(!dock)return;const r=dock.getBoundingClientRect();dockResize={id:event.pointerId,x:event.clientX,y:event.clientY,w:r.width,h:r.height};event.currentTarget.setPointerCapture?.(event.pointerId);dock.classList.add('user-resized');event.preventDefault();event.stopPropagation();}
  function moveDockResize(event){if(!dockResize||event.pointerId!==dockResize.id)return;const dock=q('#participantVideoDock'),stage=dockStageRect();if(!dock||!stage)return;dock.style.width=`${clamp(dockResize.w+event.clientX-dockResize.x,150,Math.min(620,stage.width-16))}px`;dock.style.height=`${clamp(dockResize.h+event.clientY-dockResize.y,92,Math.min(620,stage.height-16))}px`;syncVideoDock();}
  function endDockResize(event){if(!dockResize||(event?.pointerId!=null&&event.pointerId!==dockResize.id))return;dockResize=null;saveVideoDock();syncVideoDock();}
  function saveVideoDock(){const dock=q('#participantVideoDock'),stage=dockStageRect();if(!dock||!stage)return;try{const r=dock.getBoundingClientRect();localStorage.setItem(GEOMETRY_KEY,JSON.stringify({left:r.left-stage.left,top:r.top-stage.top,width:r.width,height:r.height,anchor:dock.dataset.anchor||'right',resized:dock.classList.contains('user-resized')}));}catch{}}
  function restoreVideoDock(){const dock=q('#participantVideoDock'),stage=dockStageRect();if(!dock||!stage)return;try{const g=JSON.parse(localStorage.getItem(GEOMETRY_KEY)||'null');if(!g)return;dock.dataset.anchor=['left','right','top','bottom'].includes(g.anchor)?g.anchor:'right';if(g.resized){dock.classList.add('user-resized');dock.style.width=`${clamp(Number(g.width)||220,150,Math.min(620,stage.width-16))}px`;dock.style.height=`${clamp(Number(g.height)||130,92,Math.min(620,stage.height-16))}px`;}dock.classList.add('user-positioned');dock.style.left=`${clamp(Number(g.left)||8,8,Math.max(8,stage.width-(Number(g.width)||dock.offsetWidth)-8))}px`;dock.style.top=`${clamp(Number(g.top)||8,8,Math.max(8,stage.height-(Number(g.height)||dock.offsetHeight)-8))}px`;dock.style.right='auto';dock.style.bottom='auto';}catch{}}
  function resetVideoDock(){const dock=q('#participantVideoDock');if(!dock)return;try{localStorage.removeItem(GEOMETRY_KEY);}catch{}dock.classList.remove('user-positioned','user-resized','minimized');dock.removeAttribute('style');dock.dataset.anchor='right';syncVideoDock();}
  function automaticDockAnchor(){
    const stage=dockStageRect();if(!stage)return 'right';
    return stage.width<900||stage.height<560?'top':'right';
  }

  function ensureActiveSpeakerStage(){const stage=q('.stage');if(!stage)return null;let video=q('#remoteActiveSpeakerStage');if(!video){video=document.createElement('video');video.id='remoteActiveSpeakerStage';video.className='remote-active-speaker-stage';video.autoplay=true;video.playsInline=true;video.hidden=true;stage.append(video);}return video;}
  function syncActiveSpeakerStage(){const activeStage=ensureActiveSpeakerStage();if(!activeStage)return false;qa('.remote-peer-tile.stage-promoted').forEach(tile=>tile.classList.remove('stage-promoted'));if(sharing()){activeStage.hidden=true;activeStage.srcObject=null;q('#meetingOverlay')?.classList.remove('remote-speaker-stage');return false;}const spotlightTile=spotlightParticipantId?q(`#remoteTileStrip .remote-peer-tile[data-peer-id="${CSS.escape(spotlightParticipantId)}"]`):null;const tile=spotlightTile||q('#remoteTileStrip .remote-peer-tile.active-speaker'),source=tile?.querySelector('video');if(!source?.srcObject||source.hidden){activeStage.hidden=true;activeStage.srcObject=null;q('#meetingOverlay')?.classList.remove('remote-speaker-stage');return false;}activeStage.srcObject=source.srcObject;activeStage.hidden=false;tile.classList.add('stage-promoted');q('#meetingOverlay')?.classList.add('remote-speaker-stage');void activeStage.play().catch(()=>{});return true;}
  function setSpotlight(participantId=''){spotlightParticipantId=String(participantId||'');syncVideoDock();return spotlightParticipantId;}
  function syncLocalDockTile(remotePromoted=false){const dock=ensureVideoDock(),tile=q('#localVideoDockTile');if(!dock||!tile)return;const snapshot=media()?.snapshot?.()||{},stream=media()?.stream?.()||null,hideSelf=Boolean(window.DominionPreferences?.read?.('hideSelfView')),should=Boolean(snapshot.videoLive&&!hideSelf&&(sharing()||remotePromoted));tile.hidden=!should;const video=tile.querySelector('video');if(should){if(video.srcObject!==stream)video.srcObject=stream;tile.querySelector('.remote-peer-fallback').hidden=true;void video.play().catch(()=>{});}else{video.srcObject=null;tile.querySelector('.remote-peer-fallback').hidden=false;}}
  function syncVideoDock(){
    const dock=ensureVideoDock();if(!dock)return;const mode=readView(),share=sharing();
    dock.classList.toggle('gallery-stage',mode==='gallery'&&!share);dock.classList.toggle('multi-speaker-stage',mode==='multi'&&!share);
    const promoted=mode==='speaker'?syncActiveSpeakerStage():(()=>{const s=ensureActiveSpeakerStage();if(s){s.hidden=true;s.srcObject=null;}q('#meetingOverlay')?.classList.remove('remote-speaker-stage');qa('.remote-peer-tile.stage-promoted').forEach(tile=>tile.classList.remove('stage-promoted'));return false;})();
    const localShouldAlways=mode!=='speaker'&&!share;
    const localTile=q('#localVideoDockTile'),snapshot=media()?.snapshot?.()||{},stream=media()?.stream?.()||null,hideSelf=Boolean(window.DominionPreferences?.read?.('hideSelfView'));
    if(localShouldAlways&&localTile){const should=Boolean(snapshot.videoLive&&!hideSelf);localTile.hidden=!should;const video=localTile.querySelector('video');if(should){if(video.srcObject!==stream)video.srcObject=stream;localTile.querySelector('.remote-peer-fallback').hidden=true;void video.play().catch(()=>{});}else{video.srcObject=null;}}
    else syncLocalDockTile(promoted);
    const tiles=qa('#participantVideoDock .remote-peer-tile').filter(tile=>!tile.hidden&&!tile.classList.contains('stage-promoted')),count=tiles.length;
    dock.dataset.count=String(Math.min(count,9));dock.classList.toggle('dock-empty',count===0);dock.hidden=count===0;
    for(let i=1;i<=9;i++)dock.classList.toggle(`count-${i}`,Math.min(count,9)===i);
    if(share){syncShareLayout();return;}
    if((mode==='gallery'||mode==='multi')&&!share){dock.dataset.orientation='grid';dock.style.left='';dock.style.top='';dock.style.right='';dock.style.bottom='';return;}
    if(!dock.classList.contains('user-positioned'))dock.dataset.anchor=automaticDockAnchor();
    const anchor=dock.dataset.anchor||'right';dock.dataset.orientation=(anchor==='top'||anchor==='bottom')?'horizontal':'vertical';
    if(!dock.classList.contains('user-positioned')){dock.style.left='';dock.style.top='';dock.style.right=anchor==='left'?'auto':'14px';dock.style.bottom=anchor==='bottom'?'14px':'auto';if(anchor==='left')dock.style.left='14px';else if(anchor==='top')dock.style.top='14px';else if(anchor==='right')dock.style.top='14px';}
  }

  function closeMenus(){moreMenu?.remove();moreMenu=null;securityMenu?.remove();securityMenu=null;viewMenu?.remove();viewMenu=null;}
  function menuAt(anchor,className){const menu=document.createElement('div');menu.className=className;document.body.append(menu);const r=anchor.getBoundingClientRect();menu.style.left=`${clamp(r.left,10,innerWidth-240)}px`;menu.style.bottom=`${Math.max(78,innerHeight-r.top+8)}px`;return menu;}
  async function openSecurity(anchor){
    closeMenus();securityMenu=menuAt(anchor,'meeting-more-menu security-menu');
    const meta=lastMeta||q('#roomCodeLabel')?.textContent||'Meeting protected';
    const role=String(q('#roomRole')?.textContent||'').toLowerCase().replace('-',''),canManage=['host','cohost'].includes(role);
    let snapshot=null,ctx=null;
    try{ctx=await desktop.meeting?.context?.();if(ctx?.roomId&&desktop.meeting?.snapshot)snapshot=await desktop.meeting.snapshot(ctx.roomId);}catch{}
    const locked=Boolean(snapshot?.meetingLocked),muteOnEntry=Boolean(snapshot?.muteOnEntry);
    securityMenu.innerHTML=`<div class="menu-heading"><strong>Security</strong><small>${meta}</small></div><button type="button" data-security-copy>Copy meeting information</button><button type="button" data-security-participants>Open Participants</button>${canManage?`<div class="security-separator"></div><button type="button" data-security-lock aria-pressed="${locked}">${locked?'✓ ':''}Lock Meeting</button><button type="button" data-security-mute-entry aria-pressed="${muteOnEntry}">${muteOnEntry?'✓ ':''}Mute Participants on Entry</button>`:''}`;
    securityMenu.querySelector('[data-security-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(meta);}catch{}closeMenus();};
    securityMenu.querySelector('[data-security-participants]').onclick=()=>{toggleParticipants(true);closeMenus();};
    const persist=async next=>{
      if(!ctx?.roomId||!desktop.meeting?.setSecurity)return;
      try{await desktop.meeting.setSecurity(ctx.roomId,next);closeMenus();void openSecurity(anchor);}catch{}
    };
    const lockButton=securityMenu.querySelector('[data-security-lock]');if(lockButton)lockButton.onclick=()=>void persist({locked:!locked,muteOnEntry});
    const muteButton=securityMenu.querySelector('[data-security-mute-entry]');if(muteButton)muteButton.onclick=()=>void persist({locked,muteOnEntry:!muteOnEntry});
  }
  function openMore(anchor){closeMenus();moreMenu=menuAt(anchor,'meeting-more-menu');const dock=q('#participantVideoDock');const add=(label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{closeMenus();action();};moreMenu.append(b);};add('Meeting settings',()=>{const d=q('#settingsDialog');if(d&&!d.open)d.showModal();});add('Reset participant video panel',resetVideoDock);add('Diagnostics',()=>q('#meetDiagnosticsButton')?.click());if(dock&&!dock.hidden)add('Hide participant video',()=>{dock.hidden=true;});}
  function installMeetingControls(){const footer=q('.meeting-footer'),exit=q('#roomExitButton');if(!footer||!exit)return;if(!q('#roomSecurity')){const b=document.createElement('button');b.id='roomSecurity';b.type='button';b.className='meeting-control';b.textContent='Security';b.onclick=event=>{event.stopPropagation();void openSecurity(b);};footer.insertBefore(b,q('#roomParticipants')||exit);}if(!q('#roomSettings')){const b=document.createElement('button');b.id='roomSettings';b.type='button';b.className='meeting-control';b.textContent='Settings';b.onclick=()=>{const d=q('#settingsDialog');if(d&&!d.open)d.showModal();};footer.insertBefore(b,exit);}if(!q('#roomMore')){const b=document.createElement('button');b.id='roomMore';b.type='button';b.className='meeting-control';b.textContent='More';b.onclick=event=>{event.stopPropagation();openMore(b);};footer.insertBefore(b,exit);}const participants=q('#roomParticipants');if(participants&&!participants.dataset.dsZoomBound){participants.dataset.dsZoomBound='1';participants.setAttribute('aria-pressed','false');participants.addEventListener('click',()=>toggleParticipants());}decorateControls();}

  function install(){syncBrand();syncGreeting();installParticipantPanel();installMeetingControls();ensureViewButton();ensureVideoDock();ensureShareSplitter();applyViewMode(readView());syncShareLayout();syncVideoDock();void syncMeetingMeta();}
  document.addEventListener('pointerdown',event=>{if((moreMenu&&!moreMenu.contains(event.target)&&event.target!==q('#roomMore'))||(securityMenu&&!securityMenu.contains(event.target)&&event.target!==q('#roomSecurity')))closeMenus();},true);
  window.addEventListener('resize',()=>{closeMenus();restorePanelGeometry();restoreVideoDock();syncShareLayout();syncVideoDock();},{passive:true});
  window.addEventListener('dominion:spotlight-change',event=>setSpotlight(event.detail?.participantId||''));
  window.addEventListener('dominion:active-speakers',event=>{activeSpeakerIds=Array.isArray(event.detail?.participantIds)?event.detail.participantIds.slice(0,4):[];syncVideoDock();});
  setInterval(()=>{syncGreeting();if(meetingOpen()){void syncMeetingMeta();syncShareLayout();syncVideoDock();}},700);
  install();
  window.DominionMeetingParity=Object.freeze({version:'2.4.0-zoom-share-layouts',install,toggleParticipants,syncVideoDock,resetVideoDock,syncMeetingMeta,setSpotlight,applyViewMode,syncShareLayout});
})();
