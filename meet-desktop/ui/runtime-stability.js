(()=>{
  'use strict';
  if(window.DominionRuntimeStability)return;

  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const stabilityCss=[...document.querySelectorAll('link[rel="stylesheet"]')].find(node=>String(node.getAttribute('href')||'').endsWith('/runtime-stability.css')||String(node.getAttribute('href')||'')==='./runtime-stability.css');
  const keepStabilityCssLast=()=>{
    if(!stabilityCss||stabilityCss.parentElement!==document.head)return;
    const styles=[...document.head.querySelectorAll('link[rel="stylesheet"]')];
    if(styles.at(-1)!==stabilityCss)document.head.append(stabilityCss);
  };
  keepStabilityCssLast();
  const headStyleObserver=new MutationObserver(mutations=>{
    if(mutations.some(m=>[...m.addedNodes].some(node=>node?.nodeType===1&&node.matches?.('link[rel="stylesheet"]'))))queueMicrotask(keepStabilityCssLast);
  });
  headStyleObserver.observe(document.head,{childList:true});
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const isMac=/Mac|darwin/i.test([navigator.platform,navigator.userAgent,navigator.userAgentData?.platform].filter(Boolean).join(' '));
  const desktopSurface=Boolean(window.dominionDesktop)||isMac;
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
  let surfaceResize=null;
  let topBarIdleTimer=0;
  let topBarBound=false;
  const SURFACE_GEOMETRY_KEY='ds_meet_floating_surface_geometry_v1';
  let physicalPrimed=false;
  let legacyPrimed=false;
  let shareOpening=false;

  const meetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const participantRows=()=>qa('#participantRoster [data-participant-id]');
  const surfaceKey=panel=>panel?.matches?.('.room-side')?'participants':panel?.id==='meetingChatPanel'?'chat':'surface';
  function readSurfaceGeometry(panel){
    try{const all=JSON.parse(localStorage.getItem(SURFACE_GEOMETRY_KEY)||'{}');const value=all?.[surfaceKey(panel)];return value&&typeof value==='object'?value:null;}catch{return null;}
  }
  function writeSurfaceGeometry(panel){
    if(!panel)return;
    const body=q('.meeting-body');if(!body)return;const pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect();
    const value={left:Math.round(pr.left-br.left),top:Math.round(pr.top-br.top),width:Math.round(pr.width),height:Math.round(pr.height)};
    try{const all=JSON.parse(localStorage.getItem(SURFACE_GEOMETRY_KEY)||'{}');all[surfaceKey(panel)]=value;localStorage.setItem(SURFACE_GEOMETRY_KEY,JSON.stringify(all));}catch{}
  }
  function clearSurfaceGeometry(panel){
    try{const all=JSON.parse(localStorage.getItem(SURFACE_GEOMETRY_KEY)||'{}');delete all[surfaceKey(panel)];localStorage.setItem(SURFACE_GEOMETRY_KEY,JSON.stringify(all));}catch{}
  }
  function restoreSurfaceGeometry(panel,bodyWidth,bodyHeight){
    const saved=readSurfaceGeometry(panel);if(!saved)return false;
    const minW=panel?.matches?.('.room-side')?286:300,minH=panel?.matches?.('.room-side')?300:300;
    const width=clamp(Number(saved.width)||minW,minW,Math.max(minW,bodyWidth-20));
    const height=clamp(Number(saved.height)||minH,minH,Math.max(minH,bodyHeight-20));
    const left=clamp(Number(saved.left)||10,10,Math.max(10,bodyWidth-width-10));
    const top=clamp(Number(saved.top)||10,10,Math.max(10,bodyHeight-height-10));
    panel.dataset.dsRuntimeUserPositioned='1';panel.dataset.dsAdaptiveUserPositioned='1';
    panel.style.setProperty('left',`${left}px`,'important');panel.style.setProperty('right','auto','important');
    panel.style.setProperty('top',`${top}px`,'important');panel.style.setProperty('bottom','auto','important');
    panel.style.setProperty('width',`${width}px`,'important');panel.style.setProperty('height',`${height}px`,'important');
    return true;
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
    for(const name of ['DominionZoomAdaptiveParity','DominionZoomProductionPolish','DominionApprovedReferenceParity','DominionZoomBehavior','DominionZoomPhysicalAcceptance','DominionZoomParticipantsReference2041'])disposeLoop(name);
  }

  function primePhysicalControls(){
    if(physicalPrimed||!meetingOpen())return;
    const controller=window.DominionZoomPhysicalAcceptance;if(!controller)return;
    physicalPrimed=true;
    try{controller.sync?.();}catch(error){console.warn('[DominionStar Meet] Physical control priming failed.',error);}
    try{controller.dispose?.();}catch(error){console.warn('[DominionStar Meet] Physical background retirement failed.',error);}
  }

  function primeLegacyStructure(){
    if(legacyPrimed||!meetingOpen())return;
    legacyPrimed=true;
    window.DominionZoomProductionPolish?.sync?.();
    window.DominionApprovedReferenceParity?.sync?.();
    window.DominionZoomParticipantsReference2041?.sync?.();
  }

  function ensureRuntimeDeviceCaret(button,kind){
    if(!button)return null;
    const footer=button.closest('.meeting-footer');
    const label=(kind==='audio'?'Audio':'Video')+' options';
    const candidates=footer?[...footer.querySelectorAll('.av-device-caret')].filter(node=>node.dataset.kind===kind||String(node.getAttribute('aria-label')||'').toLowerCase().includes(kind)):[];
    let caret=candidates.find(node=>node.dataset.dsRuntimeCaretSlot==='1')||candidates[0]||null;
    for(const node of candidates){if(node!==caret)node.remove();}
    for(const node of [...button.parentElement.children]){
      if(node===button||node===caret)continue;
      const aria=String(node.getAttribute?.('aria-label')||'').toLowerCase();
      if(node.matches?.('.attached-device-caret,[data-kind="'+kind+'"]')||aria===label.toLowerCase())node.remove();
    }
    if(!caret){
      caret=document.createElement('button');
      caret.type='button';
      caret.className='av-device-caret attached-device-caret';
      caret.dataset.kind=kind;
      caret.setAttribute('aria-label',label);
      caret.innerHTML='<span aria-hidden="true">⌃</span>';
      button.insertAdjacentElement('afterend',caret);
    }
    caret.dataset.dsRuntimeCaretSlot='1';
    caret.disabled=false;
    button.classList.add('has-device-caret');
    return caret;
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
    footer.style.setProperty('display','grid','important');
    footer.style.setProperty('grid-template-columns','minmax(190px,1fr) auto minmax(115px,1fr)','important');
    footer.style.setProperty('align-items','center','important');
    footer.style.setProperty('column-gap','10px','important');
    left.style.setProperty('grid-column','1','important');
    left.style.setProperty('justify-self','start','important');
    left.style.setProperty('justify-content','flex-start','important');
    left.style.setProperty('min-width','190px','important');
    center.style.setProperty('grid-column','2','important');
    center.style.setProperty('justify-self','center','important');
    center.style.setProperty('justify-content','center','important');
    right.style.setProperty('grid-column','3','important');
    right.style.setProperty('justify-self','end','important');
    right.style.setProperty('justify-content','flex-end','important');
    ensureRuntimeDeviceCaret(q('#roomMic'),'audio');
    ensureRuntimeDeviceCaret(q('#roomCamera'),'video');
    const carets=qa('.meeting-footer .av-device-caret');
    const audioCaret=carets.find(node=>node.dataset.kind==='audio'||/audio/i.test(node.getAttribute('aria-label')||''));
    const videoCaret=carets.find(node=>node.dataset.kind==='video'||/video/i.test(node.getAttribute('aria-label')||''));
    const move=(zone,node)=>{if(node&&node.parentNode!==zone)zone.append(node);};
    for(const node of [q('#roomMic'),audioCaret,q('#roomCamera'),videoCaret])move(left,node);
    for(const id of ['roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomHostTools','roomMore'])move(center,q(`#${id}`));
    move(right,q('#roomExitButton'));
    footer.dataset.dsRuntimeToolbarZones='1';
    queueMicrotask(()=>{try{window.DominionAVSettings?.bindToolbar?.();}catch(error){console.warn('[DominionStar Meet] AV quick-menu rebind failed.',error);}});
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

  function canonicalizeParticipantRows(){
    for(const row of participantRows()){
      let actions=row.querySelector('.participant-actions');
      if(!actions){
        actions=document.createElement('span');
        actions.className='participant-actions';
        row.append(actions);
      }
      const moreCandidates=[...row.querySelectorAll('.participant-more,.ds-participant-more,[data-participant-more]')];
      let more=moreCandidates.find(node=>actions.contains(node))||moreCandidates[0]||null;
      for(const node of moreCandidates){if(node!==more)node.remove();}
      if(more&&more.parentElement!==actions)actions.append(more);
      for(const node of [...row.children]){
        if(node===actions||node.matches?.('.person-badge,.person-copy,.participant-media-state,.ds-participant-share-state'))continue;
        const txt=String(node.textContent||'').replace(/\s/g,'');
        if(/^(?:\.{3}|…|•••)$/.test(txt))node.remove();
      }
    }
  }

  function syncParticipantsSurface(){
    const side=q('.room-side'),roster=q('#participantRoster');if(!side||!roster)return;
    canonicalizeParticipantRows();
    const count=participantRows().length;
    side.dataset.dsRuntimeCount=String(count);
    const title=side.querySelector('.room-side-head strong');if(title)title.textContent=`Participants (${count})`;
    const subtitle=side.querySelector('.room-side-head small');if(subtitle)subtitle.textContent=count===1?'1 person in this meeting':`${count} people in this meeting`;
    let search=side.querySelector('.zoom-participant-search');
    if(!search){
      const head=side.querySelector('.room-side-head');
      if(head){
        search=document.createElement('div');
        search.className='zoom-participant-search';
        search.innerHTML='<input type="search" autocomplete="off" spellcheck="false" placeholder="Search participants" aria-label="Search participants">';
        head.insertAdjacentElement('afterend',search);
        const input=search.querySelector('input');
        input?.addEventListener('input',()=>{
          const needle=String(input.value||'').trim().toLowerCase();
          for(const row of participantRows()){
            const name=String(row.dataset.participantName||row.textContent||'').toLowerCase();
            row.hidden=Boolean(needle&&!name.includes(needle));
          }
        });
      }
    }
    if(search)search.hidden=count<7;
    const waiting=q('#waitingQueueSection');if(waiting)waiting.hidden=!hasWaitingPeople();
    sortParticipants();
    const dirty=roster.dataset.dsRuntimeSnapshotDirty==='1'||roster.dataset.dsRuntimeDecorated!=='1';
    if(dirty){
      window.DominionZoomPhysicalAcceptance?.decorateParticipantRows?.();
      roster.dataset.dsRuntimeDecorated='1';
      roster.dataset.dsRuntimeSnapshotDirty='0';
    }
  }

  function closeMeetingTransients(){
    try{window.DominionZoomScreenshotReference?.closeTransient?.();}catch{}
    try{window.DominionParticipantControls?.closeMenu?.();}catch{}
    for(const selector of ['.ds-ref-participant-bulk-menu','.zoom-participant-bulk-menu','.participant-control-menu','.zoom-participant-layout-menu','.zoom-chat-policy-menu','.meeting-more-menu','.security-menu']){
      for(const node of document.querySelectorAll(selector))node.remove();
    }
  }

  function setParticipants(show){
    const overlay=q('#meetingOverlay'),side=q('.room-side'),button=q('#roomParticipants');if(!overlay||!side)return false;
    closeMeetingTransients();
    if(show)closeChat(false);
    side.hidden=!show;
    overlay.classList.toggle('participants-hidden',!show);
    button?.setAttribute('aria-pressed',String(show));
    if(show){
      side.dataset.zoomPanelMode='runtime';
      side.dataset.dsAdaptiveMode='floating';
      side.dataset.dsRuntimePanel='participants';
      syncParticipantsSurface();
    }
    layoutSideSurface();
    return show;
  }

  function closeChat(layoutAfter=true){
    const panel=q('#meetingChatPanel'),button=q('#roomChat');if(!panel)return false;
    closeMeetingTransients();
    panel.hidden=true;button?.setAttribute('aria-pressed','false');
    q('#meetingOverlay')?.classList.remove('ds-chat-docked','ds-chat-floating');
    if(layoutAfter)layoutSideSurface();
    return false;
  }

  function setChat(show){
    const panel=q('#meetingChatPanel'),button=q('#roomChat');if(!panel)return false;
    closeMeetingTransients();
    if(show)setParticipants(false);
    if(window.DominionMeetingFeatures?.toggleChat)window.DominionMeetingFeatures.toggleChat(Boolean(show));
    else panel.hidden=!show;
    panel.hidden=!show;button?.setAttribute('aria-pressed',String(show));
    if(show){
      panel.dataset.dsRuntimePanel='chat';
      panel.dataset.zoomPanelMode='runtime';
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

  function installFloatingSurfaceDrag(panel){
    if(!panel||panel.dataset.dsRuntimeDragBound==='1')return;
    const liveHandle=()=>panel.matches('.room-side')?panel.querySelector('.room-side-head'):panel.querySelector('header');
    const initialHandle=liveHandle();if(!initialHandle)return;
    panel.dataset.dsRuntimeDragBound='1';
    initialHandle.style.cursor='grab';

    const eligible=event=>{
      const handle=liveHandle();if(!handle||!handle.contains(event.target))return false;
      if(event.button!==0||event.target.closest?.('button,input,select,textarea,a'))return false;
      return true;
    };
    const begin=event=>{
      if(surfaceDrag||!eligible(event))return;
      const body=q('.meeting-body');if(!body)return;
      const pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect();
      surfaceDrag={panel,id:event.pointerId??null,dx:event.clientX-pr.left,dy:event.clientY-pr.top};
      panel.dataset.dsRuntimeUserPositioned='1';
      panel.dataset.dsAdaptiveUserPositioned='1';
      panel.dataset.dsRuntimeDragBegin=String((Number(panel.dataset.dsRuntimeDragBegin)||0)+1);
      panel.style.setProperty('left',`${pr.left-br.left}px`,'important');
      panel.style.setProperty('top',`${pr.top-br.top}px`,'important');
      panel.style.setProperty('right','auto','important');
      panel.style.setProperty('bottom','auto','important');
      panel.style.setProperty('width',`${pr.width}px`,'important');
      panel.style.setProperty('height',`${pr.height}px`,'important');
      panel.classList.add('dragging');
      panel.style.setProperty('animation','none','important');
      event.preventDefault();
    };
    const move=event=>{
      if(!surfaceDrag||surfaceDrag.panel!==panel)return;
      if(event.pointerId!=null&&surfaceDrag.id!=null&&event.pointerId!==surfaceDrag.id)return;
      const body=q('.meeting-body');if(!body)return;const br=body.getBoundingClientRect();
      const left=clamp(event.clientX-br.left-surfaceDrag.dx,10,Math.max(10,br.width-panel.offsetWidth-10));
      const top=clamp(event.clientY-br.top-surfaceDrag.dy,10,Math.max(10,br.height-panel.offsetHeight-10));
      panel.style.setProperty('left',`${left}px`,'important');
      panel.style.setProperty('top',`${top}px`,'important');
      panel.dataset.dsRuntimeDragMove=String((Number(panel.dataset.dsRuntimeDragMove)||0)+1);
      event.preventDefault();
    };
    const end=event=>{
      if(!surfaceDrag||surfaceDrag.panel!==panel)return;
      if(event?.pointerId!=null&&surfaceDrag.id!=null&&event.pointerId!==surfaceDrag.id)return;
      surfaceDrag=null;panel.classList.remove('dragging');
      panel.dataset.dsRuntimeDragEnd=String((Number(panel.dataset.dsRuntimeDragEnd)||0)+1);
      writeSurfaceGeometry(panel);
    };

    document.addEventListener('pointerdown',begin,true);
    document.addEventListener('pointermove',move,true);
    document.addEventListener('pointerup',end,true);
    document.addEventListener('pointercancel',end,true);
  }

  function installFloatingSurfaceResize(panel){
    if(!panel||panel.dataset.dsRuntimeResizeBound==='1')return;
    panel.dataset.dsRuntimeResizeBound='1';
    const directions=['n','s','e','w','ne','nw','se','sw'];
    for(const dir of directions){
      const handle=document.createElement('span');handle.className='ds-runtime-resize-handle';handle.dataset.dsResize=dir;handle.setAttribute('aria-hidden','true');panel.append(handle);
    }
    const begin=event=>{
      const handle=event.target.closest?.('.ds-runtime-resize-handle');if(!handle||event.button!==0||surfaceResize)return;
      const body=q('.meeting-body');if(!body)return;const pr=panel.getBoundingClientRect(),br=body.getBoundingClientRect();
      surfaceResize={panel,id:event.pointerId??null,dir:String(handle.dataset.dsResize||'se'),startX:event.clientX,startY:event.clientY,left:pr.left-br.left,top:pr.top-br.top,width:pr.width,height:pr.height,bodyWidth:br.width,bodyHeight:br.height};
      panel.dataset.dsRuntimeUserPositioned='1';panel.dataset.dsAdaptiveUserPositioned='1';panel.classList.add('resizing');
      handle.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopPropagation();
    };
    const move=event=>{
      if(!surfaceResize||surfaceResize.panel!==panel)return;
      if(event.pointerId!=null&&surfaceResize.id!=null&&event.pointerId!==surfaceResize.id)return;
      const s=surfaceResize,dx=event.clientX-s.startX,dy=event.clientY-s.startY,dir=s.dir,minW=286,minH=300;
      let left=s.left,top=s.top,width=s.width,height=s.height;
      if(dir.includes('e'))width=clamp(s.width+dx,minW,Math.max(minW,s.bodyWidth-s.left-10));
      if(dir.includes('s'))height=clamp(s.height+dy,minH,Math.max(minH,s.bodyHeight-s.top-10));
      if(dir.includes('w')){const nextLeft=clamp(s.left+dx,10,Math.max(10,s.left+s.width-minW));width=clamp(s.width+(s.left-nextLeft),minW,Math.max(minW,s.bodyWidth-nextLeft-10));left=nextLeft;}
      if(dir.includes('n')){const nextTop=clamp(s.top+dy,10,Math.max(10,s.top+s.height-minH));height=clamp(s.height+(s.top-nextTop),minH,Math.max(minH,s.bodyHeight-nextTop-10));top=nextTop;}
      panel.style.setProperty('left',`${left}px`,'important');panel.style.setProperty('top',`${top}px`,'important');
      panel.style.setProperty('right','auto','important');panel.style.setProperty('bottom','auto','important');
      panel.style.setProperty('width',`${width}px`,'important');panel.style.setProperty('height',`${height}px`,'important');
      event.preventDefault();event.stopPropagation();
    };
    const end=event=>{
      if(!surfaceResize||surfaceResize.panel!==panel)return;
      if(event?.pointerId!=null&&surfaceResize.id!=null&&event.pointerId!==surfaceResize.id)return;
      surfaceResize=null;panel.classList.remove('resizing');writeSurfaceGeometry(panel);
    };
    panel.addEventListener('pointerdown',begin,true);panel.addEventListener('pointermove',move,true);panel.addEventListener('pointerup',end,true);panel.addEventListener('pointercancel',end,true);
  }

  function installMeetingTopBarAutoHide(){
    const overlay=q('#meetingOverlay'),head=overlay?.querySelector('.meeting-head');if(!overlay||!head)return false;
    const show=()=>{
      overlay.dataset.dsRuntimeTopbarHidden='0';clearTimeout(topBarIdleTimer);
      if(meetingOpen())topBarIdleTimer=setTimeout(()=>{if(meetingOpen())overlay.dataset.dsRuntimeTopbarHidden='1';},2400);
    };
    if(!topBarBound){
      topBarBound=true;
      overlay.addEventListener('pointermove',show,{passive:true});
      overlay.addEventListener('pointerdown',show,{passive:true});
      overlay.addEventListener('pointerenter',show,{passive:true});
      head.addEventListener('pointerenter',show,{passive:true});
      window.addEventListener('blur',()=>{clearTimeout(topBarIdleTimer);});
    }
    show();return true;
  }

  function ensurePanelClose(panel){
    if(!panel)return;
    const participants=panel.matches('.room-side');
    let header=participants?panel.querySelector('.room-side-head'):panel.querySelector('header');
    if(!header)return;
    if(participants&&desktopSurface){
      const participantHeaders=[...panel.querySelectorAll(':scope > .room-side-head')];
      header=participantHeaders[0]||header;
      for(const duplicateHeader of participantHeaders.slice(1))duplicateHeader.remove();
      for(const stray of [...panel.querySelectorAll('.ds-panel-traffic')]){if(!header.contains(stray))stray.remove();}
      for(const legacy of [...panel.querySelectorAll('.ds-participants-traffic,.ds-participants-popout')])legacy.remove();
      panel.classList.remove('ds-panel-wide','ds-panel-collapsed');
      const trafficSets=[...header.querySelectorAll('.ds-panel-traffic')];
      let traffic=trafficSets.find(node=>node.dataset.dsRuntimeParticipantChrome==='1')||trafficSets[0]||null;
      for(const duplicate of trafficSets){if(duplicate!==traffic)duplicate.remove();}
      if(!traffic){
        traffic=document.createElement('div');traffic.className='ds-panel-traffic';header.prepend(traffic);
      }
      traffic.dataset.dsRuntimeParticipantChrome='1';
      traffic.setAttribute('aria-label','Participant window controls');
      if(traffic.querySelectorAll(':scope > button').length!==3||!traffic.querySelector('.ds-traffic-close')||!traffic.querySelector('.ds-traffic-minimize')||!traffic.querySelector('.ds-traffic-restore')){
        traffic.innerHTML='<button type="button" class="ds-traffic-close" aria-label="Close participants"></button><button type="button" class="ds-traffic-minimize" aria-label="Minimize participants"></button><button type="button" class="ds-traffic-restore" aria-label="Restore participants"></button>';
        delete traffic.dataset.dsRuntimeBound;
      }
      if(traffic.dataset.dsRuntimeBound!=='1'){
        traffic.dataset.dsRuntimeBound='1';
        traffic.querySelector('.ds-traffic-close').onclick=event=>{event.preventDefault();event.stopPropagation();setParticipants(false);};
        traffic.querySelector('.ds-traffic-minimize').onclick=event=>{event.preventDefault();event.stopPropagation();panel.classList.add('ds-panel-minimized');layoutSideSurface();};
        traffic.querySelector('.ds-traffic-restore').onclick=event=>{event.preventDefault();event.stopPropagation();panel.classList.remove('ds-panel-minimized');clearSurfaceGeometry(panel);panel.dataset.dsRuntimeUserPositioned='0';layoutSideSurface();};
      }
      let headerAction=header.querySelector('.ds-participant-header-action');
      if(!headerAction){
        headerAction=document.createElement('button');
        headerAction.type='button';headerAction.className='ds-participant-header-action';
        headerAction.setAttribute('aria-label','Return participants to default position');
        headerAction.title='Return to default position';
        headerAction.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h9v9M17 7l-6 6M6 11v7h7"/></svg>';
        header.append(headerAction);
      }
      if(headerAction.dataset.dsRuntimeBound!=='1'){
        headerAction.dataset.dsRuntimeBound='1';
        headerAction.onclick=event=>{event.preventDefault();event.stopPropagation();panel.classList.remove('ds-panel-minimized');clearSurfaceGeometry(panel);panel.dataset.dsRuntimeUserPositioned='0';layoutSideSurface();};
      }
    }
    let close=participants?header.querySelector('button[aria-label="Close participants"]'):header.querySelector('[data-chat-close]');
    if(!close){
      close=document.createElement('button');close.type='button';close.textContent='×';
      if(participants)close.setAttribute('aria-label','Close participants');
      else{close.dataset.chatClose='1';close.setAttribute('aria-label','Close chat');}
      header.append(close);
    }
    if(close.dataset.dsRuntimeCloseBound!=='1'){
      close.dataset.dsRuntimeCloseBound='1';
      close.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
        participants?setParticipants(false):closeChat();
      },true);
    }
    if(!participants){
      let actions=header.querySelector('.zoom-chat-header-actions');
      if(!actions){
        actions=document.createElement('div');actions.className='zoom-chat-header-actions';
        header.insertBefore(actions,close);
        actions.append(close);
      }
      let more=actions.querySelector('.zoom-chat-more');
      if(!more){
        more=document.createElement('button');more.type='button';more.className='zoom-chat-more';more.textContent='•••';more.setAttribute('aria-label','Chat options');
        actions.insertBefore(more,close);
      }
      more.hidden=false;
      if(more.dataset.dsRuntimeChatMoreBound!=='1'){
        more.dataset.dsRuntimeChatMoreBound='1';
        more.onclick=event=>{
          event.preventDefault();event.stopPropagation();
          for(const node of document.querySelectorAll('.ds-runtime-chat-options'))node.remove();
          const menu=document.createElement('div');menu.className='zoom-chat-policy-menu ds-runtime-chat-options';
          const select=q('#meetingChatPolicy');
          const role=String(q('#roomRole')?.textContent||'').trim().toLowerCase().replace(/[-\s]/g,'');
          const manager=['host','cohost'].includes(role)||q('.meeting-footer')?.dataset.approvedRoleState==='manager';
          if(manager&&select){
            const heading=document.createElement('button');heading.type='button';heading.disabled=true;heading.textContent='Participant can chat with';menu.append(heading);
            for(const option of [...select.options]){
              const item=document.createElement('button');item.type='button';item.textContent=String(option.textContent||option.value).replace(/^Participants (can|cannot) chat:\s*/i,'');
              item.classList.toggle('selected',option.value===select.value);
              item.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));menu.remove();};
              menu.append(item);
            }
          }else{
            const item=document.createElement('button');item.type='button';item.textContent='Close chat';item.onclick=()=>{menu.remove();closeChat();};menu.append(item);
          }
          document.body.append(menu);
          const r=more.getBoundingClientRect(),width=manager?265:210;
          menu.style.left=`${Math.max(10,Math.min(innerWidth-width-10,r.right-width))}px`;
          menu.style.top=`${Math.max(10,r.top-menu.offsetHeight-8)}px`;
        };
      }
    }
  }

  function layoutSideSurface(){
    const overlay=q('#meetingOverlay'),body=q('.meeting-body'),stage=q('.stage'),participants=q('.room-side'),chat=q('#meetingChatPanel');
    if(!overlay||!body||!stage)return;
    ensureViewport();
    const bodyWidth=Math.max(1,body.clientWidth),bodyHeight=Math.max(1,body.clientHeight);
    const participantsOpen=Boolean(participants&&!participants.hidden),chatOpen=Boolean(chat&&!chat.hidden);
    const panel=chatOpen?chat:participantsOpen?participants:null;
    if(panel){
      const baseWidth=panel===chat?330:318;
      const baseHeight=panel===chat?440:390;
      const minPanelHeight=panel===chat?300:390;
      const width=Math.min(baseWidth,Math.max(1,bodyWidth-24));
      const height=Math.min(baseHeight,Math.max(minPanelHeight,bodyHeight-82));
      panel.dataset.dsRuntimeMode='floating';
      panel.dataset.dsAdaptiveMode='floating';
      panel.dataset.zoomPanelMode='runtime';
      overlay.classList.remove('ds-chat-docked');
      if(panel===chat)overlay.classList.add('ds-chat-floating');
      panel.style.setProperty('position','absolute','important');
      panel.style.setProperty('width',`${width}px`,'important');
      panel.style.setProperty('max-width','calc(100% - 20px)','important');
      panel.style.setProperty('max-height','calc(100% - 20px)','important');
      panel.style.setProperty('transform','none','important');
      panel.style.setProperty('z-index','2600','important');
      const restored=panel.dataset.dsRuntimeUserPositioned!=='1'&&restoreSurfaceGeometry(panel,bodyWidth,bodyHeight);
      if(panel.dataset.dsRuntimeUserPositioned==='1'||restored){
        const saved=readSurfaceGeometry(panel)||{},pw=Math.min(Number(saved.width)||panel.offsetWidth||width,bodyWidth-20),ph=Math.min(Number(saved.height)||panel.offsetHeight||height,bodyHeight-20);
        const currentLeft=parseFloat(panel.style.left),currentTop=parseFloat(panel.style.top);
        const left=Number.isFinite(currentLeft)?clamp(currentLeft,10,Math.max(10,bodyWidth-pw-10)):Math.max(10,bodyWidth-pw-10);
        const top=Number.isFinite(currentTop)?clamp(currentTop,10,Math.max(10,bodyHeight-ph-10)):10;
        panel.style.setProperty('left',`${left}px`,'important');
        panel.style.setProperty('right','auto','important');
        panel.style.setProperty('top',`${top}px`,'important');
        panel.style.setProperty('bottom','auto','important');
        panel.style.setProperty('width',`${pw}px`,'important');
        panel.style.setProperty('height',`${ph}px`,'important');
      }else if(panel===participants){
        const ph=Math.min(390,Math.max(1,bodyHeight-20));
        const pw=Math.min(318,Math.max(1,bodyWidth-20));
        panel.style.setProperty('left',`${Math.max(10,(bodyWidth-pw)/2)}px`,'important');
        panel.style.setProperty('right','auto','important');
        panel.style.setProperty('top',`${Math.max(10,(bodyHeight-ph)/2)}px`,'important');
        panel.style.setProperty('bottom','auto','important');
        panel.style.setProperty('width',`${pw}px`,'important');
        panel.style.setProperty('height',`${ph}px`,'important');
      }else{
        panel.style.setProperty('left','auto','important');
        panel.style.setProperty('right','24px','important');
        panel.style.setProperty('top','46px','important');
        panel.style.setProperty('bottom','auto','important');
        panel.style.setProperty('height',`${Math.min(height,Math.max(minPanelHeight,bodyHeight-28))}px`,'important');
      }
      overlay.dataset.dsRuntimeSide='floating';
      ensurePanelClose(panel);
      installFloatingSurfaceDrag(panel);
      installFloatingSurfaceResize(panel);
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
    const userPositioned=dock.classList.contains('user-positioned');

    dock.dataset.dsRuntimeDockMode=userPositioned?'user':'right';
    if(!userPositioned){dock.dataset.anchor='right';dock.dataset.orientation='vertical';}
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

    const tiles=[...dock.querySelectorAll('.remote-peer-tile')].filter(tile=>!tile.hidden&&!tile.classList.contains('stage-promoted'));
    const count=Math.max(1,tiles.length);
    const visibleRows=Math.min(5,count);
    const tileWidth=176,tileHeight=99,gap=5,padding=10,headerHeight=28;
    const desiredHeight=Math.min(548,headerHeight+(visibleRows*tileHeight)+Math.max(0,visibleRows-1)*gap+padding);
    dock.dataset.dsRuntimeVisibleCount=String(tiles.length);
    dock.dataset.dsRuntimeColumns='1';
    dock.style.setProperty('left','auto','important');
    dock.style.setProperty('right','14px','important');
    dock.style.setProperty('top','14px','important');
    dock.style.setProperty('width','188px','important');
    dock.style.setProperty('height',`${Math.min(desiredHeight,Math.max(127,height-28))}px`,'important');
    dock.style.setProperty('max-width','188px','important');
    dock.style.setProperty('max-height','calc(100% - 28px)','important');
    if(body){
      body.style.setProperty('grid-template-columns','176px','important');
      body.style.setProperty('grid-auto-flow','row','important');
      body.style.setProperty('grid-auto-rows','99px','important');
      body.style.setProperty('overflow-x','hidden','important');
      body.style.setProperty('overflow-y',count>5?'auto':'hidden','important');
      body.style.setProperty('align-content','start','important');
    }
    return true;
  }

  let syncRunning=false,pendingSync=false;
  function syncNow(){
    if(syncRunning){pendingSync=true;return;}
    syncRunning=true;frame=0;
    try{
      installSnapshotDomGuards();retireBackgroundReconcilers();ensureViewport();observeSideVisibility();
      if(!meetingOpen())return;
      primePhysicalControls();primeLegacyStructure();ensureToolbarZones();installMeetingTopBarAutoHide();
      syncParticipantsSurface();layoutSideSurface();installVideoDockDrag();syncVideoDockGeometry();
      if(!q('#meetingOverlay')?.hasAttribute('data-ds-runtime-reference-primed')){
        window.DominionZoomScreenshotReference?.sync?.();
        q('#meetingOverlay')?.setAttribute('data-ds-runtime-reference-primed','1');
      }
      q('#meetingOverlay')?.setAttribute('data-ds-runtime-stable','1');
    } finally {
      syncRunning=false;
      if(pendingSync){pendingSync=false;schedule();}
    }
  }

  function syncDirect(){
    if(syncRunning){
      pendingSync=true;
      if(meetingOpen()){
        ensureViewport();
        ensureToolbarZones();
        window.DominionZoomScreenshotReference?.sync?.();
      }
      return;
    }
    return syncNow();
  }

  function schedule(){if(frame||syncRunning){pendingSync=true;return;}frame=requestAnimationFrame(syncNow);}

  function observeMeetingVisibility(){
    const overlay=q('#meetingOverlay');if(!overlay||overlay===observedMeeting)return;
    meetingObserver?.disconnect();observedMeeting=overlay;
    meetingObserver=new MutationObserver(()=>schedule());
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
      return;
    }
    const hostTools=event.target.closest?.('#roomHostTools');
    if(hostTools&&meetingOpen()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const ref=window.DominionZoomScreenshotReference;
      if(typeof ref?.openHostToolsPanel==='function')void ref.openHostToolsPanel();
      else void window.DominionMeetingParity?.openSecurity?.(hostTools);
      return;
    }
    const more=event.target.closest?.('#roomMore');
    if(more&&meetingOpen()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const ref=window.DominionZoomScreenshotReference;
      if(typeof ref?.openMeetingMore==='function')ref.openMeetingMore(more);
      else window.DominionMeetingParity?.openMore?.(more);
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
  let meetingSignalTimer=0;
  const scheduleMeetingSignal=()=>{
    if(meetingSignalTimer)return;
    meetingSignalTimer=setTimeout(()=>{meetingSignalTimer=0;schedule();},80);
  };
  window.addEventListener('dominion:meeting-snapshot',schedule);
  window.addEventListener('dominion:waiting-room-update',schedule);
  window.addEventListener('dominion:participant-presence',schedule);
  window.addEventListener('dominion:meeting-signal',scheduleMeetingSignal);
  window.addEventListener('dominion:meeting-ended',()=>{closeMeetingTransients();physicalPrimed=false;legacyPrimed=false;shareOpening=false;const overlay=q('#meetingOverlay');overlay?.removeAttribute('data-ds-runtime-reference-primed');if(meetingSignalTimer){clearTimeout(meetingSignalTimer);meetingSignalTimer=0;}schedule();});

  observeMeetingVisibility();observeSideVisibility();installSnapshotDomGuards();schedule();setTimeout(()=>{observeMeetingVisibility();observeSideVisibility();installSnapshotDomGuards();schedule();},120);setTimeout(schedule,700);

  window.DominionRuntimeStability=Object.freeze({version:'2.0.53-canonical-chat-inset',sync:syncDirect,schedule,setParticipants,setChat,closeChat,openShare:openShareFromRuntime,layoutSideSurface,syncVideoDockGeometry,syncParticipantsSurface,ensureToolbarZones,suppressLegacyReactionHand,retireBackgroundReconcilers,installSnapshotDomGuards});
})();