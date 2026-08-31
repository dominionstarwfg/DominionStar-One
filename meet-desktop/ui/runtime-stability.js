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
  let physicalPrimed=false;

  const meetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const participantRows=()=>qa('#participantRoster [data-participant-id]');

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
    for(const name of ['DominionZoomAdaptiveParity','DominionZoomProductionPolish','DominionApprovedReferenceParity','DominionZoomBehavior','DominionZoomPhysicalAcceptance'])disposeLoop(name);
  }

  function primePhysicalControls(){
    if(physicalPrimed||!meetingOpen())return;
    const controller=window.DominionZoomPhysicalAcceptance;if(!controller)return;
    physicalPrimed=true;
    try{controller.sync?.();}catch(error){console.warn('[DominionStar Meet] Physical control priming failed.',error);}
    try{controller.dispose?.();}catch(error){console.warn('[DominionStar Meet] Physical background retirement failed.',error);}
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
    const search=side.querySelector('.zoom-participant-search');if(search)search.hidden=count<7;
    const waiting=q('#waitingQueueSection');if(waiting)waiting.hidden=!hasWaitingPeople();
    sortParticipants();
    window.DominionZoomPhysicalAcceptance?.decorateParticipantRows?.();
    roster.dataset.dsRuntimeSnapshotDirty='0';
  }

  function setParticipants(show){
    const overlay=q('#meetingOverlay'),side=q('.room-side'),button=q('#roomParticipants');if(!overlay||!side)return false;
    if(show)closeChat(false);
    side.hidden=!show;
    overlay.classList.toggle('participants-hidden',!show);
    button?.setAttribute('aria-pressed',String(show));
    if(show){
      side.dataset.zoomPanelMode='docked';
      side.dataset.dsAdaptiveMode='docked';
      side.dataset.dsRuntimePanel='participants';
      syncParticipantsSurface();
    }
    // User actions must be transactional: visibility and geometry are committed
    // before this click returns. Do not defer the visible result to RAF; macOS
    // can throttle RAF and make later clicks appear to trigger earlier actions.
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
    if(show){panel.dataset.dsRuntimePanel='chat';void window.DominionZoomBehavior?.refreshChatRecipients?.();requestAnimationFrame(()=>q('#meetingChatInput')?.focus());}
    layoutSideSurface();
    return show;
  }

  function layoutSideSurface(){
    const overlay=q('#meetingOverlay'),body=q('.meeting-body'),stage=q('.stage'),participants=q('.room-side'),chat=q('#meetingChatPanel');
    if(!overlay||!body||!stage)return;
    ensureViewport();
    const bodyWidth=Math.max(1,body.clientWidth),bodyHeight=Math.max(1,body.clientHeight);
    const participantsOpen=Boolean(participants&&!participants.hidden),chatOpen=Boolean(chat&&!chat.hidden);
    const panel=chatOpen?chat:participantsOpen?participants:null;
    let reserve=0;
    if(panel){
      const wide=bodyWidth>=940;
      if(wide){
        const width=clamp(Math.round(bodyWidth*.25),330,390);
        reserve=width+10;
        panel.dataset.dsRuntimeMode='docked';
        panel.style.setProperty('position','absolute','important');
        panel.style.setProperty('left','auto','important');
        panel.style.setProperty('right','0px','important');
        panel.style.setProperty('top','0px','important');
        panel.style.setProperty('bottom','0px','important');
        panel.style.setProperty('width',`${width}px`,'important');
        panel.style.setProperty('height','100%','important');
        panel.style.setProperty('max-width','none','important');
        panel.style.setProperty('max-height','none','important');
        panel.style.setProperty('transform','none','important');
        overlay.dataset.dsRuntimeSide='docked';
      }else{
        const width=Math.min(360,Math.max(286,bodyWidth-24));
        const height=Math.min(560,Math.max(320,bodyHeight-24));
        panel.dataset.dsRuntimeMode='floating';
        panel.style.setProperty('position','absolute','important');
        panel.style.setProperty('left',`${Math.max(12,(bodyWidth-width)/2)}px`,'important');
        panel.style.setProperty('right','auto','important');
        panel.style.setProperty('top',`${Math.max(12,(bodyHeight-height)/2)}px`,'important');
        panel.style.setProperty('bottom','auto','important');
        panel.style.setProperty('width',`${width}px`,'important');
        panel.style.setProperty('height',`${height}px`,'important');
        panel.style.setProperty('max-width','calc(100% - 24px)','important');
        panel.style.setProperty('max-height','calc(100% - 24px)','important');
        panel.style.setProperty('transform','none','important');
        overlay.dataset.dsRuntimeSide='floating';
      }
    }else overlay.dataset.dsRuntimeSide='none';
    stage.style.setProperty('left','0px','important');
    stage.style.setProperty('top','0px','important');
    stage.style.setProperty('bottom','0px','important');
    stage.style.setProperty('right',`${reserve}px`,'important');
    stage.style.removeProperty('margin-right');
  }

  function installVideoDockDrag(){
    const dock=q('#participantVideoDock');if(!dock||dock===dockBound)return;
    dockBound=dock;dock.dataset.dsRuntimeWholePanelDrag='1';
    dock.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest?.('button,input,select,textarea,.participant-video-resize'))return;
      const stage=q('.stage');if(!stage||dock.hidden)return;
      const dr=dock.getBoundingClientRect(),sr=stage.getBoundingClientRect();
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

  function syncNow(){
    frame=0;installSnapshotDomGuards();retireBackgroundReconcilers();ensureViewport();observeSideVisibility();
    if(!meetingOpen())return;
    primePhysicalControls();
    window.DominionZoomProductionPolish?.sync?.();
    window.DominionApprovedReferenceParity?.sync?.();
    syncParticipantsSurface();layoutSideSurface();installVideoDockDrag();
    q('#meetingOverlay')?.setAttribute('data-ds-runtime-stable','1');
  }

  function schedule(){if(frame)return;frame=requestAnimationFrame(syncNow);}

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
  window.addEventListener('dominion:meeting-ui-ready',()=>{observeMeetingVisibility();observeSideVisibility();installSnapshotDomGuards();schedule();setTimeout(schedule,80);});
  window.addEventListener('dominion:meeting-snapshot',schedule);
  window.addEventListener('dominion:waiting-room-update',schedule);
  window.addEventListener('dominion:participant-presence',schedule);
  window.addEventListener('dominion:meeting-ended',()=>{physicalPrimed=false;schedule();});

  observeMeetingVisibility();observeSideVisibility();installSnapshotDomGuards();schedule();setTimeout(()=>{observeMeetingVisibility();observeSideVisibility();installSnapshotDomGuards();schedule();},120);setTimeout(schedule,700);

  window.DominionRuntimeStability=Object.freeze({version:'2.0.22-physical-runtime-fix',sync:syncNow,schedule,setParticipants,setChat,closeChat,layoutSideSurface,syncParticipantsSurface,retireBackgroundReconcilers,installSnapshotDomGuards});
})();