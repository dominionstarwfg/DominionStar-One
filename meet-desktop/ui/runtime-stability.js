(()=>{
  'use strict';
  if(window.DominionRuntimeStability)return;

  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const disposed=new Set();
  const htmlDescriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  let frame=0;
  let meetingObserver=null;
  let sideObserver=null;
  let observedMeeting=null;
  let observedSideKey='';
  let dockBound=null;
  let dockDrag=null;
  let surfaceDrag=null;
  let surfaceMouseDrag=null;
  let surfaceDragGlobalBound=false;
  let physicalPrimed=false;
  let legacyPrimed=false;
  let shareOpening=false;
  let runtimeHostMenu=null;

  const meetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const participantRows=()=>qa('#participantRoster [data-participant-id]');

  function closeRuntimeHostMenu(){
    runtimeHostMenu?.remove();runtimeHostMenu=null;
    q('#roomHostTools')?.setAttribute('aria-expanded','false');
  }

  function positionRuntimeHostMenu(menu,anchor){
    if(!menu||!anchor)return;
    const ar=anchor.getBoundingClientRect(),mr=menu.getBoundingClientRect(),width=mr.width||280,height=mr.height||240;
    const left=clamp(ar.left+ar.width/2-width/2,12,Math.max(12,innerWidth-width-12));
    const top=Math.max(12,ar.top-height-10);
    menu.style.setProperty('left',`${Math.round(left)}px`,'important');
    menu.style.setProperty('right','auto','important');
    menu.style.setProperty('top',`${Math.round(top)}px`,'important');
    menu.style.setProperty('bottom','auto','important');
  }

  function appendRuntimeHostCommand(menu,label,handler,{selected=false,disabled=false}={}){
    const button=document.createElement('button');button.type='button';button.className=`ds-command-item${selected?' selected':''}`;button.disabled=Boolean(disabled);button.setAttribute('role','menuitem');
    button.innerHTML=`<span>${selected?'✓':''}</span><strong>${label}</strong>`;
    button.onclick=event=>{event.preventDefault();event.stopPropagation();closeRuntimeHostMenu();Promise.resolve(handler?.()).catch(()=>{});};
    menu.append(button);return button;
  }

  async function openRuntimeHostTools(anchor){
    closeRuntimeHostMenu();
    const menu=document.createElement('div');menu.className='ds-command-menu ds-runtime-host-tools';menu.setAttribute('role','menu');
    const heading=document.createElement('div');heading.className='ds-command-menu-heading';heading.textContent='Host Tools';menu.append(heading);
    document.body.append(menu);runtimeHostMenu=menu;anchor?.setAttribute('aria-expanded','true');
    appendRuntimeHostCommand(menu,'Open Participants',()=>setParticipants(true));
    appendRuntimeHostCommand(menu,'Copy meeting information',async()=>{const text=String(q('#roomCodeLabel')?.textContent||'').trim();if(text)await navigator.clipboard?.writeText?.(text);});
    const divider=document.createElement('div');divider.className='ds-command-divider';divider.setAttribute('role','separator');menu.append(divider);
    let ctx={},snapshot={};
    try{ctx=await window.dominionDesktop?.meeting?.context?.()||{};if(ctx.roomId)snapshot=await window.dominionDesktop?.meeting?.snapshot?.(ctx.roomId)||{};}catch{}
    if(runtimeHostMenu!==menu)return;
    const locked=Boolean(snapshot.meetingLocked),muteOnEntry=Boolean(snapshot.muteOnEntry),roomId=ctx.roomId;
    appendRuntimeHostCommand(menu,locked?'Unlock Meeting':'Lock Meeting',()=>window.dominionDesktop?.meeting?.setSecurity?.(roomId,{locked:!locked,muteOnEntry}),{selected:locked,disabled:!roomId});
    appendRuntimeHostCommand(menu,'Mute Participants on Entry',()=>window.dominionDesktop?.meeting?.setSecurity?.(roomId,{locked,muteOnEntry:!muteOnEntry}),{selected:muteOnEntry,disabled:!roomId});
    requestAnimationFrame(()=>positionRuntimeHostMenu(menu,anchor));
  }

  function guardSnapshotHtml(node){
    if(!node||node.dataset.dsRuntimeHtmlGuard==='1'||!htmlDescriptor?.get||!htmlDescriptor?.set)return;
    let lastRaw=null;
    Object.defineProperty(node,'innerHTML',{
      configurable:true,
      get(){return htmlDescriptor.get.call(this);},
      set(value){
        const next=String(value??'');
        if(next===lastRaw)return;
        lastRaw=next;
        this.dataset.dsRuntimeSnapshotDirty='1';
        htmlDescriptor.set.call(this,next);
      }
    });
    node.dataset.dsRuntimeHtmlGuard='1';
  }

  function installSnapshotDomGuards(){
    guardSnapshotHtml(q('#participantRoster'));
    guardSnapshotHtml(q('#waitingQueue'));
  }

  function disposeLoop(name){
    if(disposed.has(name))return;
    const controller=window[name];
    if(!controller?.dispose)return;
    try{controller.dispose();disposed.add(name);}catch(error){console.warn(`[DominionStar Meet] Could not retire ${name} background reconciliation.`,error);}
  }

  function retireBackgroundReconcilers(){
    for(const name of ['DominionZoomAdaptiveParity','DominionZoomParticipantsReference2041','DominionZoomProductionPolish','DominionApprovedReferenceParity','DominionZoomBehavior','DominionZoomPhysicalAcceptance'])disposeLoop(name);
  }

  function primePhysicalControls(){
    if(physicalPrimed||!meetingOpen())return;
    const controller=window.DominionZoomPhysicalAcceptance;if(!controller)return;
    physicalPrimed=true;
    try{controller.sync?.();}catch(error){console.warn('[DominionStar Meet] Physical control priming failed.',error);}
    const host=q('#roomHostTools');if(host){host.onclick=null;host.dataset.dsPhysicalAuthority='runtime-owned';}
    try{controller.dispose?.();}catch(error){console.warn('[DominionStar Meet] Physical background retirement failed.',error);}
  }

  function primeLegacyStructure(){
    if(legacyPrimed||!meetingOpen())return;
    legacyPrimed=true;
    window.DominionZoomProductionPolish?.sync?.();
    window.DominionZoomParticipantsReference2041?.sync?.();
    window.DominionApprovedReferenceParity?.sync?.();
  }

  function ensureToolbarZones(){
    const footer=q('.meeting-footer');if(!footer)return false;
    let left=footer.querySelector(':scope > .ds-runtime-toolbar-left');
    let center=footer.querySelector(':scope > .ds-runtime-toolbar-center');
    let right=footer.querySelector(':scope > .ds-runtime-toolbar-right');
    if(!left||!center||!right){
      left=document.createElement('div');left.className='ds-runtime-toolbar-zone ds-runtime-toolbar-left';left.setAttribute('role','presentation');
      center=document.createElement('div');center.className='ds-runtime-toolbar-zone ds-runtime-toolbar-center';center.setAttribute('role','presentation');
      right=document.createElement('div');right.className='ds-runtime-toolbar-zone ds-runtime-toolbar-right';right.setAttribute('role','presentation');
      footer.append(left,center,right);
    }
    const carets=qa('.meeting-footer .av-device-caret');
    const audioCaret=carets.find(node=>node.dataset.kind==='audio'||/audio/i.test(node.getAttribute('aria-label')||''));
    const videoCaret=carets.find(node=>node.dataset.kind==='video'||/video/i.test(node.getAttribute('aria-label')||''));
    const move=(zone,node)=>{if(node&&node.parentNode!==zone)zone.append(node);};
    for(const node of [q('#roomMic'),audioCaret,q('#roomCamera'),videoCaret])move(left,node);
    for(const id of ['roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomHostTools','roomMore'])move(center,q(`#${id}`));
    move(right,q('#roomExitButton'));
    footer.dataset.dsRuntimeToolbarZones='1';
    return true;
  }

  function suppressLegacyReactionHand(){
    const tray=q('.ds-reaction-tray');if(!tray)return false;
    for(const node of tray.querySelectorAll(':scope > .ds-raise-hand,:scope > .ds-reaction-divider'))node.remove();
    return true;
  }

  function ensureViewport(){
    const overlay=q('#meetingOverlay'),shell=overlay?.querySelector('.meeting-shell'),body=overlay?.querySelector('.meeting-body');
    if(!overlay||!shell||!body)return;
    const width=Math.max(1,window.innerWidth||document.documentElement.clientWidth||0);
    const height=Math.max(1,window.innerHeight||document.documentElement.clientHeight||0);
    overlay.style.setProperty('--ds-runtime-vw',`${width}px`);
    overlay.style.setProperty('--ds-runtime-vh',`${height}px`);
    overlay.style.setProperty('width',`${width}px`,'important');
    overlay.style.setProperty('height',`${height}px`,'important');
    shell.style.setProperty('width','100%','important');
    shell.style.setProperty('height','100%','important');
    body.style.setProperty('width','100%','important');
    body.style.setProperty('height','100%','important');
  }

  function hasWaitingPeople(){
    const queue=q('#waitingQueue');
    if(!queue)return false;
    return [...queue.children].some(node=>node.matches?.('[data-wait],[data-participant-id],[data-waiting-id],.waiting-person,.queue-card'));
  }

  function participantPriority(row){
    const small=String(row.querySelector('.person-copy small')?.textContent||'').toLowerCase();
    const self=/\byou\b|\bme\b/.test(small)||row.dataset.dsAdaptiveSelf==='1';
    const role=String(row.dataset.participantRole||'participant').toLowerCase().replace('-','');
    const raised=row.dataset.raisedHand==='1'||Boolean(row.querySelector('.raised-hand-indicator'));
    const mic=row.querySelector('.ds-participant-media .ds-media-state');
    const micOn=Boolean(mic?.classList.contains('on'));
    return self?0:role==='host'?1:role==='cohost'?2:raised?3:micOn?4:5;
  }

  function sortParticipants(){
    const roster=q('#participantRoster');if(!roster)return;
    const rows=participantRows();
    const sorted=[...rows].sort((a,b)=>participantPriority(a)-participantPriority(b)||String(a.dataset.participantName||'').localeCompare(String(b.dataset.participantName||''),undefined,{numeric:true,sensitivity:'base'}));
    if(sorted.some((row,index)=>row!==rows[index])){
      const fragment=document.createDocumentFragment();for(const row of sorted)fragment.append(row);roster.append(fragment);
    }
  }

  function syncParticipantsSurface(){
    const side=q('.room-side'),roster=q('#participantRoster');if(!side||!roster)return;
    const count=participantRows().length;
    side.dataset.dsRuntimeCount=String(count);
    const title=side.querySelector('.room-side-head strong');if(title)title.textContent=`Participants (${count})`;
    const subtitle=side.querySelector('.room-side-head small');if(subtitle)subtitle.textContent=count===1?'1 person in this meeting':`${count} people in this meeting`;
    const head=side.querySelector('.room-side-head');
    if(head&&!head.querySelector('[data-ds-runtime-close-participants]')){const close=document.createElement('button');close.type='button';close.dataset.dsRuntimeCloseParticipants='1';close.setAttribute('aria-label','Close participants');close.textContent='×';head.append(close);}
    const search=side.querySelector('.zoom-participant-search');if(search)search.hidden=count<7;
    const waiting=q('#waitingQueueSection');if(waiting)waiting.hidden=!hasWaitingPeople();
    sortParticipants();
    const dirty=roster.dataset.dsRuntimeSnapshotDirty==='1'||roster.dataset.dsRuntimeDecorated!=='1';
    if(dirty){
      window.DominionZoomPhysicalAcceptance?.decorateParticipantRows?.();
      roster.dataset.dsRuntimeDecorated='1';
      roster.dataset.dsRuntimeSnapshotDirty='0';
    }
  }

  function setParticipants(show){
    const overlay=q('#meetingOverlay'),side=q('.room-side'),button=q('#roomParticipants');if(!overlay||!side)return false;
    if(show)closeChat(false);
    side.hidden=!show;
    overlay.classList.toggle('participants-hidden',!show);
    button?.setAttribute('aria-pressed',String(show));
    if(show){
      side.dataset.zoomPanelMode='popout';
      side.dataset.dsAdaptiveMode='floating';
      side.dataset.dsRuntimePanel='participants';
      syncParticipantsSurface();
    }
    layoutSideSurface();
    return show;
  }

  function closeChat(layoutAfter=true){
    const panel=q('#meetingChatPanel'),button=q('#roomChat');if(!panel)return false;
    panel.hidden=true;button?.setAttribute('aria-pressed','false');
    q('#meetingOverlay')?.classList.remove('ds-chat-docked','ds-chat-floating');
    if(layoutAfter)layoutSideSurface();
    return false;
  }

  function setChat(show){
    const panel=q('#meetingChatPanel'),button=q('#roomChat');if(!panel)return false;
    if(show)setParticipants(false);
    if(window.DominionMeetingFeatures?.toggleChat)window.DominionMeetingFeatures.toggleChat(Boolean(show));
    else panel.hidden=!show;
    panel.hidden=!show;button?.setAttribute('aria-pressed',String(show));
    if(show){
      panel.dataset.dsRuntimePanel='chat';
      const refresh=window.DominionZoomBehavior?.refreshChatRecipients?.();
      Promise.resolve(refresh).catch(()=>{}).finally(()=>{
        if(!meetingOpen()||panel.hidden)return;
        // The old production-polish timer/observer stays retired. Chat policy
        // state is created asynchronously by refreshChatRecipients(), so run
        // exactly one structural pass after that state exists to mount the
        // host Chat options control, then immediately reassert final geometry.
        try{window.DominionZoomProductionPolish?.sync?.();}catch(error){console.warn('[DominionStar Meet] Chat structural polish failed.',error);}
        layoutSideSurface();
      });
      requestAnimationFrame(()=>q('#meetingChatInput')?.focus());
    }
    layoutSideSurface();
    return show;
  }

  function openShareFromRuntime(button=q('#roomShare')){
    if(shareOpening||!meetingOpen())return false;
    const integration=window.DominionShareIntegration;
    if(!integration?.open){window.DominionMeetingNotifications?.toast?.('Screen sharing is still initializing. Try again.','info');return false;}
    shareOpening=true;button?.classList.add('ds-share-checking');
    // Functional commands must never depend on a paint frame. Electron may
    // throttle requestAnimationFrame when a window is obscured/backgrounded;
    // that previously left Share visibly "checking" without ever starting the
    // native permission/picker path. Start the integration immediately and
    // reserve animation frames for visuals only.
    Promise.resolve().then(()=>integration.open()).catch(error=>window.DominionMeetingNotifications?.toast?.(String(error?.message||error||'Screen sharing could not start.'),'error')).finally(()=>{shareOpening=false;button?.classList.remove('ds-share-checking');});
    return true;
  }

  function dragAxisDelta(event,state,axis){
    const cap=axis==='x'?'X':'Y',movement=Number(event[`movement${cap}`]||0);
    state[`movement${cap}`]=(state[`movement${cap}`]||0)+movement;
    const values=[
      Number(event[`client${cap}`])-state[`startClient${cap}`],
      Number(event[`page${cap}`])-state[`startPage${cap}`],
      Number(event[`screen${cap}`])-state[`startScreen${cap}`],
      state[`movement${cap}`]
    ].filter(Number.isFinite);
    return values.reduce((best,value)=>Math.abs(value)>Math.abs(best)?value:best,0);
  }

  function applyFloatingDrag(event,state){
    const {panel}=state,body=q('.meeting-body');if(!panel||!body||panel.hidden)return;
    const br=body.getBoundingClientRect();
    const deltaX=dragAxisDelta(event,state,'x'),deltaY=dragAxisDelta(event,state,'y');
    const left=clamp(state.originLeft+deltaX,10,Math.max(10,br.width-panel.offsetWidth-10));
    const top=clamp(state.originTop+deltaY,10,Math.max(10,br.height-panel.offsetHeight-10));
    panel.style.setProperty('left',`${left}px`,'important');
    panel.style.setProperty('right','auto','important');
    panel.style.setProperty('top',`${top}px`,'important');
    event.preventDefault();
  }

  function moveFloatingSurface(event){
    if(!surfaceDrag||surfaceDrag.id!==event.pointerId)return;
    surfaceDrag.panel.dataset.dsRuntimePointerMoves=String((Number(surfaceDrag.panel.dataset.dsRuntimePointerMoves)||0)+1);
    applyFloatingDrag(event,surfaceDrag);
  }

  function endFloatingSurfaceDrag(event){
    if(!surfaceDrag||(event?.pointerId!=null&&event.pointerId!==surfaceDrag.id))return;
    const panel=surfaceDrag.panel;surfaceDrag=null;panel?.classList.remove('dragging');
  }

  function moveFloatingSurfaceMouse(event){
    if(!surfaceMouseDrag)return;
    surfaceMouseDrag.panel.dataset.dsRuntimeMouseMoves=String((Number(surfaceMouseDrag.panel.dataset.dsRuntimeMouseMoves)||0)+1);
    applyFloatingDrag(event,surfaceMouseDrag);
  }

  function endFloatingSurfaceMouse(){
    if(!surfaceMouseDrag)return;
    const panel=surfaceMouseDrag.panel;surfaceMouseDrag=null;panel?.classList.remove('dragging');
  }

  function delegatedFloatingPanel(event){
    const handle=event.target?.closest?.('#meetingOverlay .room-side-head,#meetingOverlay #meetingChatPanel>header');
    if(!handle)return null;
    const panel=handle.closest?.('.room-side,#meetingChatPanel');
    if(!panel||panel.hidden||panel.dataset.dsRuntimeMode!=='floating')return null;
    return {panel,handle};
  }

  function beginDelegatedFloatingPointer(event){const hit=delegatedFloatingPanel(event);if(hit)beginFloatingDrag(hit.panel,event,'pointer');}
  function beginDelegatedFloatingMouse(event){const hit=delegatedFloatingPanel(event);if(hit)beginFloatingDrag(hit.panel,event,'mouse');}

  function ensureFloatingSurfaceDocumentDrag(){
    if(surfaceDragGlobalBound)return;surfaceDragGlobalBound=true;
    // Window-capture is the final movement authority. It runs before any
    // retired/legacy document or title-bar listeners can stop propagation.
    window.addEventListener('pointerdown',beginDelegatedFloatingPointer,true);
    window.addEventListener('mousedown',beginDelegatedFloatingMouse,true);
    window.addEventListener('pointermove',moveFloatingSurface,true);
    window.addEventListener('pointerup',endFloatingSurfaceDrag,true);
    window.addEventListener('pointercancel',endFloatingSurfaceDrag,true);
    window.addEventListener('mousemove',moveFloatingSurfaceMouse,true);
    window.addEventListener('mouseup',endFloatingSurfaceMouse,true);
  }

  function beginFloatingDrag(panel,event,kind='pointer'){
    if(event.button!==0||event.target.closest?.('button,input,select,textarea,a'))return;
    const body=q('.meeting-body');if(!body)return;
    const pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect();
    const inlineLeft=parseFloat(panel.style.left),inlineTop=parseFloat(panel.style.top);
    const state={
      panel,
      originLeft:Number.isFinite(inlineLeft)?inlineLeft:pr.left-br.left,
      originTop:Number.isFinite(inlineTop)?inlineTop:pr.top-br.top,
      startClientX:Number(event.clientX),startClientY:Number(event.clientY),
      startPageX:Number(event.pageX),startPageY:Number(event.pageY),
      startScreenX:Number(event.screenX),startScreenY:Number(event.screenY),
      movementX:0,movementY:0
    };
    panel.dataset.dsRuntimeUserPositioned='1';panel.classList.add('dragging');
    if(kind==='mouse')surfaceMouseDrag=state;
    else{surfaceDrag={...state,id:event.pointerId};try{event.currentTarget?.setPointerCapture?.(event.pointerId);}catch{}}
    event.preventDefault();
  }

  function installFloatingSurfaceDrag(panel){
    if(!panel||panel.dataset.dsRuntimeDragBound==='1')return;
    const handle=panel.matches('.room-side')?panel.querySelector('.room-side-head'):panel.querySelector('header');
    if(!handle)return;
    ensureFloatingSurfaceDocumentDrag();
    panel.dataset.dsRuntimeDragBound='1';
    handle.style.setProperty('cursor','move','important');
  }

  function layoutSideSurface(){
    const overlay=q('#meetingOverlay'),body=q('.meeting-body'),stage=q('.stage'),participants=q('.room-side'),chat=q('#meetingChatPanel');
    if(!overlay||!body||!stage)return;
    ensureViewport();
    const bodyWidth=Math.max(1,body.clientWidth),bodyHeight=Math.max(1,body.clientHeight);
    const participantsOpen=Boolean(participants&&!participants.hidden),chatOpen=Boolean(chat&&!chat.hidden);
    const panel=chatOpen?chat:participantsOpen?participants:null;
    if(panel){
      const width=Math.min(410,Math.max(300,Math.round(bodyWidth*.31)));
      const height=Math.min(590,Math.max(340,Math.round(bodyHeight*.72)));
      panel.dataset.dsRuntimeMode='floating';
      panel.dataset.zoomPanelMode='popout';
      panel.style.setProperty('position','absolute','important');
      panel.style.setProperty('bottom','auto','important');
      const targetWidth=Math.max(1,Math.min(width,bodyWidth-24)),targetHeight=Math.max(1,Math.min(height,bodyHeight-24));
      panel.style.setProperty('min-width','0px','important');
      panel.style.setProperty('min-height','0px','important');
      panel.style.setProperty('width',`${targetWidth}px`,'important');
      panel.style.setProperty('height',`${targetHeight}px`,'important');
      panel.style.setProperty('max-width','calc(100% - 24px)','important');
      panel.style.setProperty('max-height','calc(100% - 24px)','important');
      panel.style.setProperty('resize','none','important');
      panel.style.setProperty('transform','none','important');
      panel.style.setProperty('z-index','2600','important');
      const pw=Math.min(Math.max(1,panel.offsetWidth||targetWidth),Math.max(1,bodyWidth-24)),ph=Math.min(Math.max(1,panel.offsetHeight||targetHeight),Math.max(1,bodyHeight-24));
      let left=Math.max(10,Math.round((bodyWidth-pw)/2)),top=Math.max(10,Math.round((bodyHeight-ph)/2));
      if(panel.dataset.dsRuntimeUserPositioned==='1'){
        const currentLeft=parseFloat(panel.style.left),currentTop=parseFloat(panel.style.top);
        if(Number.isFinite(currentLeft))left=clamp(currentLeft,10,Math.max(10,bodyWidth-pw-10));
        if(Number.isFinite(currentTop))top=clamp(currentTop,10,Math.max(10,bodyHeight-ph-10));
      }
      panel.style.setProperty('left',`${left}px`,'important');
      panel.style.setProperty('right','auto','important');
      panel.style.setProperty('top',`${top}px`,'important');
      overlay.dataset.dsRuntimeSide='center-floating';
      installFloatingSurfaceDrag(panel);
    }else overlay.dataset.dsRuntimeSide='none';
    stage.style.setProperty('left','0px','important');
    stage.style.setProperty('top','0px','important');
    stage.style.setProperty('bottom','0px','important');
    stage.style.setProperty('right','0px','important');
    stage.style.removeProperty('margin-right');
  }

  function installVideoDockDrag(){
    const dock=q('#participantVideoDock');if(!dock||dock===dockBound)return;
    dockBound=dock;dock.dataset.dsRuntimeWholePanelDrag='1';
    dock.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest?.('button,input,select,textarea,.participant-video-resize'))return;
      const stage=q('.stage');if(!stage||dock.hidden)return;
      const dr=dock.getBoundingClientRect();
      dockDrag={id:event.pointerId,dx:event.clientX-dr.left,dy:event.clientY-dr.top};
      dock.setPointerCapture?.(event.pointerId);dock.classList.add('user-positioned','dragging');dock.style.right='auto';dock.style.bottom='auto';event.preventDefault();
    },true);
    dock.addEventListener('pointermove',event=>{
      if(!dockDrag||event.pointerId!==dockDrag.id)return;const stage=q('.stage');if(!stage)return;const sr=stage.getBoundingClientRect();
      const left=clamp(event.clientX-sr.left-dockDrag.dx,8,Math.max(8,sr.width-dock.offsetWidth-8));
      const top=clamp(event.clientY-sr.top-dockDrag.dy,8,Math.max(8,sr.height-dock.offsetHeight-8));
      dock.style.left=`${left}px`;dock.style.top=`${top}px`;event.preventDefault();
    },true);
    const end=event=>{if(!dockDrag||(event?.pointerId!=null&&event.pointerId!==dockDrag.id))return;dockDrag=null;dock.classList.remove('dragging');};
    dock.addEventListener('pointerup',end,true);dock.addEventListener('pointercancel',end,true);
  }

  function syncVideoDockGeometry(){
    const overlay=q('#meetingOverlay'),stage=q('.stage'),dock=q('#participantVideoDock');
    if(!overlay||!stage||!dock||dock.hidden)return false;
    if(dock.classList.contains('gallery-stage')||dock.classList.contains('multi-speaker-stage'))return false;

    const sr=stage.getBoundingClientRect();
    const width=Math.max(1,sr.width||stage.clientWidth||0);
    const height=Math.max(1,sr.height||stage.clientHeight||0);
    const compact=width<760;
    const userPositioned=dock.classList.contains('user-positioned');

    dock.dataset.dsRuntimeDockMode=userPositioned?'user':compact?'top':'right';
    dock.style.setProperty('position','absolute','important');
    dock.style.setProperty('bottom','auto','important');
    dock.style.setProperty('transform','none','important');
    dock.style.setProperty('z-index','205','important');

    const body=dock.querySelector('.participant-video-dock-body');

    if(userPositioned){
      const dw=Math.min(Math.max(1,dock.offsetWidth||176),Math.max(1,width-16));
      const dh=Math.min(Math.max(1,dock.offsetHeight||120),Math.max(1,height-16));
      const currentLeft=parseFloat(dock.style.left);
      const currentTop=parseFloat(dock.style.top);
      const left=clamp(Number.isFinite(currentLeft)?currentLeft:Math.max(8,width-dw-14),8,Math.max(8,width-dw-8));
      const top=clamp(Number.isFinite(currentTop)?currentTop:14,8,Math.max(8,height-dh-8));
      dock.style.setProperty('left',`${left}px`,'important');
      dock.style.setProperty('top',`${top}px`,'important');
      dock.style.setProperty('right','auto','important');
      dock.style.setProperty('max-width','calc(100% - 16px)','important');
      dock.style.setProperty('max-height','calc(100% - 16px)','important');
      return true;
    }

    dock.style.removeProperty('left');
    dock.style.removeProperty('top');
    dock.style.removeProperty('right');
    dock.style.removeProperty('width');
    dock.style.removeProperty('max-width');
    dock.style.removeProperty('max-height');

    if(compact){
      dock.style.setProperty('left','14px','important');
      dock.style.setProperty('right','14px','important');
      dock.style.setProperty('top','10px','important');
      dock.style.setProperty('width','auto','important');
      dock.style.setProperty('max-width','calc(100% - 28px)','important');
      dock.style.setProperty('max-height','190px','important');
      if(body){
        body.style.setProperty('grid-template-columns','repeat(auto-fit,minmax(142px,1fr))','important');
        body.style.setProperty('grid-auto-flow','column','important');
        body.style.setProperty('overflow-x','auto','important');
        body.style.setProperty('overflow-y','hidden','important');
      }
    }else{
      dock.style.setProperty('left','auto','important');
      dock.style.setProperty('right','14px','important');
      dock.style.setProperty('top','14px','important');
      dock.style.setProperty('width','auto','important');
      dock.style.setProperty('max-height','calc(100% - 28px)','important');
      if(body){
        body.style.setProperty('grid-template-columns','176px','important');
        body.style.setProperty('grid-auto-flow','row','important');
        body.style.setProperty('overflow-x','hidden','important');
        body.style.setProperty('overflow-y','auto','important');
      }
    }
    return true;
  }

  function syncNow(){
    frame=0;installSnapshotDomGuards();retireBackgroundReconcilers();ensureViewport();observeSideVisibility();
    if(!meetingOpen())return;
    primePhysicalControls();primeLegacyStructure();ensureToolbarZones();
    syncParticipantsSurface();layoutSideSurface();installVideoDockDrag();syncVideoDockGeometry();
    window.DominionZoomScreenshotReference?.sync?.();
    q('#meetingOverlay')?.setAttribute('data-ds-runtime-stable','1');
  }

  function schedule(){if(frame)return;frame=requestAnimationFrame(syncNow);}

  function observeMeetingVisibility(){
    const overlay=q('#meetingOverlay');if(!overlay||overlay===observedMeeting)return;
    meetingObserver?.disconnect();observedMeeting=overlay;
    meetingObserver=new MutationObserver(()=>syncNow());
    meetingObserver.observe(overlay,{attributes:true,attributeFilter:['hidden']});
  }

  function observeSideVisibility(){
    const side=q('.room-side'),chat=q('#meetingChatPanel');
    const key=`${side?'p':'-'}${chat?'c':'-'}`;if(key===observedSideKey)return;
    sideObserver?.disconnect();observedSideKey=key;if(!side&&!chat)return;
    sideObserver=new MutationObserver(()=>schedule());
    if(side)sideObserver.observe(side,{attributes:true,attributeFilter:['hidden']});
    if(chat)sideObserver.observe(chat,{attributes:true,attributeFilter:['hidden']});
  }

  document.addEventListener('click',event=>{
    const settingsClose=event.target.closest?.('#settingsDialog .modal-close,#settingsDialog button[value="cancel"]');
    if(settingsClose){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const dialog=q('#settingsDialog');if(dialog?.open)dialog.close('cancel');return;
    }
    const share=event.target.closest?.('#roomShare');
    if(share&&meetingOpen()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();share.blur();openShareFromRuntime(share);return;
    }
    const reactions=event.target.closest?.('#roomReactions');
    if(reactions&&meetingOpen()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      window.DominionMeetingFeatures?.openReactions?.(reactions);
      queueMicrotask(suppressLegacyReactionHand);
      requestAnimationFrame(()=>{
        const tray=q('.ds-reaction-tray')||q('.meeting-reaction-menu');if(!tray)return;const r=reactions.getBoundingClientRect(),w=tray.offsetWidth||330,h=tray.offsetHeight||68;
        const left=clamp(r.left+r.width/2-w/2,10,Math.max(10,innerWidth-w-10)),top=Math.max(10,r.top-h-10);
        tray.style.setProperty('left',`${left}px`,'important');tray.style.setProperty('right','auto','important');tray.style.setProperty('top',`${top}px`,'important');tray.style.setProperty('bottom','auto','important');
      });
      return;
    }
    const hostTools=event.target.closest?.('#roomHostTools');
    if(hostTools&&meetingOpen()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      q('.ds-ref-host-tools-panel')?.remove();
      qa('.meeting-command-menu,.ds-command-menu').forEach(node=>{if(node!==runtimeHostMenu)node.remove();});
      void openRuntimeHostTools(hostTools);
      return;
    }
    if(runtimeHostMenu&&!runtimeHostMenu.contains(event.target)&&!event.target.closest?.('#roomHostTools'))closeRuntimeHostMenu();
    const more=event.target.closest?.('#roomMore');
    if(more&&meetingOpen()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      window.DominionMeetingParity?.openMore?.(more);
      return;
    }
    const participants=event.target.closest?.('#roomParticipants');
    if(participants&&meetingOpen()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      setParticipants(q('.room-side')?.hidden!==false);return;
    }
    const chat=event.target.closest?.('#roomChat');
    if(chat&&meetingOpen()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      setChat(q('#meetingChatPanel')?.hidden!==false);return;
    }
    if(event.target.closest?.('.room-side-head button[aria-label="Close participants"]')){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();setParticipants(false);return;
    }
    if(event.target.closest?.('#meetingChatPanel [data-chat-close]')){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();closeChat();return;
    }
  },true);

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('dominion:meeting-ui-ready',()=>{observeMeetingVisibility();observeSideVisibility();installSnapshotDomGuards();syncNow();setTimeout(schedule,80);});
  window.addEventListener('dominion:meeting-snapshot',schedule);
  window.addEventListener('dominion:waiting-room-update',schedule);
  window.addEventListener('dominion:participant-presence',schedule);
  window.addEventListener('dominion:meeting-signal',schedule);
  window.addEventListener('dominion:meeting-ended',()=>{physicalPrimed=false;legacyPrimed=false;shareOpening=false;schedule();});

  observeMeetingVisibility();observeSideVisibility();installSnapshotDomGuards();schedule();setTimeout(()=>{observeMeetingVisibility();observeSideVisibility();installSnapshotDomGuards();schedule();},120);setTimeout(schedule,700);

  window.DominionRuntimeStability=Object.freeze({version:'2.0.32-adaptive-video-dock',sync:syncNow,schedule,setParticipants,setChat,closeChat,openShare:openShareFromRuntime,layoutSideSurface,syncVideoDockGeometry,syncParticipantsSurface,ensureToolbarZones,suppressLegacyReactionHand,retireBackgroundReconcilers,installSnapshotDomGuards});
})();