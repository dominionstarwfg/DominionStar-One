(() => {
  'use strict';
  const dock=document.getElementById('filmstrip');
  const track=document.getElementById('filmstripTrack');
  const grip=dock?.querySelector('.dock-grip');
  const participantList=document.getElementById('participantList');
  if(!dock||!track||!grip)return;

  const ICONS={
    collapsed:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    speaker:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 16c1.2-1.7 2.5-2.5 4-2.5s2.8.8 4 2.5"/><circle cx="12" cy="10" r="2.5"/></svg>',
    stack:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/></svg>',
    grid:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    hand:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.6 11.2V6.8a1.6 1.6 0 0 1 3.2 0v3.1-5a1.6 1.6 0 0 1 3.2 0v5-3.6a1.6 1.6 0 0 1 3.2 0v4.3-2a1.6 1.6 0 0 1 3.2 0v5.1c0 4-2.9 7.3-6.9 7.3h-1.2c-2.4 0-4.7-1.1-6.2-3L3.8 15a1.8 1.8 0 0 1 2.6-2.5l1.2 1.1z"/></svg>'
  };
  const modernizeIconography=()=>{
    dock.querySelectorAll('[data-dock-view]').forEach(button=>{
      const icon=ICONS[button.dataset.dockView];
      if(icon&&button.dataset.dsModernIcon!=='1'){
        button.innerHTML=icon;
        button.dataset.dsModernIcon='1';
      }
    });
    const raiseHand=document.querySelector('#raiseHandBtn .raise-hand-icon');
    if(raiseHand&&raiseHand.dataset.dsModernIcon!=='1'){
      raiseHand.innerHTML=ICONS.hand;
      raiseHand.dataset.dsModernIcon='1';
    }
    participantList?.querySelectorAll('.participant-raised-hand').forEach(badge=>{
      if(badge.dataset.dsModernIcon==='1')return;
      const queue=(badge.textContent||'').match(/#\s*(\d+)/)?.[1]||'';
      badge.innerHTML=`${ICONS.hand}${queue?`<span class="raised-hand-queue">#${queue}</span>`:''}`;
      badge.dataset.dsModernIcon='1';
    });
  };

  const MARGIN=12, TOP_SAFE=62, BOTTOM_SAFE=88;
  const VIEW_KEY='ds_meet_dock_view_v2';
  let drag=null, resizeTimer=0;
  const interactive='button,input,select,textarea,a,[contenteditable="true"],[role="button"],[role="menuitem"]';
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const bounds=()=>{
    const rect=dock.getBoundingClientRect();
    return {minX:MARGIN,maxX:Math.max(MARGIN,innerWidth-rect.width-MARGIN),minY:TOP_SAFE,maxY:Math.max(TOP_SAFE,innerHeight-rect.height-BOTTOM_SAFE)};
  };
  const place=(left,top)=>{
    const b=bounds();
    dock.style.setProperty('--ds-dock-left',`${clamp(left,b.minX,b.maxX)}px`);
    dock.style.setProperty('--ds-dock-top',`${clamp(top,b.minY,b.maxY)}px`);
  };
  const setOrientation=orientation=>{
    const horizontal=orientation==='horizontal';
    dock.classList.toggle('ds-dock-horizontal',horizontal);
    dock.classList.toggle('ds-dock-vertical',!horizontal);
    dock.dataset.orientation=horizontal?'horizontal':'vertical';
  };
  const setView=(view='stack',persist=true)=>{
    const allowed=new Set(['collapsed','speaker','stack','grid']);
    const next=allowed.has(view)?view:'stack';
    dock.dataset.view=next;
    dock.classList.toggle('is-collapsed',next==='collapsed');
    dock.classList.toggle('is-speaker-view',next==='speaker');
    dock.classList.toggle('is-grid-view',next==='grid');
    dock.querySelectorAll('[data-dock-view]').forEach(button=>{
      const selected=button.dataset.dockView===next;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    if(persist){try{localStorage.setItem(VIEW_KEY,next);}catch(_){}}
    requestAnimationFrame(reconcile);
  };
  const reset=()=>{
    dock.classList.remove('ds-user-positioned','is-dragging','ds-dock-horizontal','ds-dock-floating');
    dock.classList.add('ds-dock-v2');
    setOrientation('vertical');
    dock.dataset.dockMode='right';
    dock.dataset.positionOwner='dock-layout-v2';
    dock.style.removeProperty('--ds-dock-left');
    dock.style.removeProperty('--ds-dock-top');
    dock.style.removeProperty('left');
    dock.style.removeProperty('top');
    dock.style.removeProperty('right');
    dock.style.removeProperty('bottom');
    dock.style.removeProperty('width');
    dock.style.removeProperty('height');
    dock.style.removeProperty('transform');
  };
  const reconcile=()=>{
    const tiles=[...track.querySelectorAll('.remote-tile')];
    tiles.forEach(tile=>{ if(!tile.querySelector('video')&&!tile.querySelector('.remote-fallback'))tile.remove(); });
    const count=track.querySelectorAll('.remote-tile:not([hidden])').length;
    dock.dataset.count=String(count);
    dock.classList.toggle('has-overflow',count>5);
    modernizeIconography();
    if(dock.classList.contains('ds-user-positioned')){
      const rect=dock.getBoundingClientRect();place(rect.left,rect.top);
    }
  };

  dock.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest(interactive))return;
    const rect=dock.getBoundingClientRect();
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,moved:false};
    dock.setPointerCapture?.(event.pointerId);
  });
  dock.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!drag.moved&&Math.hypot(dx,dy)<4)return;
    if(!drag.moved){drag.moved=true;dock.classList.add('ds-user-positioned','is-dragging');place(drag.left,drag.top);}
    place(drag.left+dx,drag.top+dy);
    event.preventDefault();
  });
  const end=event=>{
    if(!drag||(event?.pointerId!=null&&event.pointerId!==drag.id))return;
    try{dock.releasePointerCapture?.(drag.id);}catch(_){ }
    const moved=drag.moved;
    drag=null;dock.classList.remove('is-dragging');
    if(moved){
      const rect=dock.getBoundingClientRect();
      const nearHorizontalEdge=innerWidth>720&&(rect.top<TOP_SAFE+80||rect.bottom>innerHeight-BOTTOM_SAFE-80);
      setOrientation(nearHorizontalEdge?'horizontal':'vertical');
      reconcile();
    }
  };
  dock.addEventListener('pointerup',end);
  dock.addEventListener('pointercancel',end);
  addEventListener('blur',()=>end());
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(reconcile,50);},{passive:true});
  new MutationObserver(reconcile).observe(track,{childList:true});
  if(participantList)new MutationObserver(modernizeIconography).observe(participantList,{childList:true,subtree:true});
  dock.querySelectorAll('[data-dock-view]').forEach(button=>button.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();setView(button.dataset.dockView);
  }));

  /* Professional meeting controls contract.
     Executive6 owns media state and role state. This last-loaded layer makes
     its quick controls behave like installed meeting software without changing
     the engine: Audio exposes both input and output devices, and co-hosts can
     manage people in the Waiting Room without being allowed to enable/disable
     the Waiting Room itself. */
  const deviceMenu=document.getElementById('deviceMenu');
  const micMenuBtn=document.getElementById('micMenuBtn');
  const microphoneSelect=document.getElementById('microphoneSelect');
  const speakerSelect=document.getElementById('speakerSelect');
  const settingsDialog=document.getElementById('settingsDialog');
  const endAllBtn=document.getElementById('endAllBtn');
  const isLocalHost=()=>Boolean(endAllBtn&&!endAllBtn.hidden);
  const normalizedMenuLabel=button=>String(button?.textContent||'').replace(/^\s*✓\s*/,'').trim();
  const waitingRoomToggleLabel=label=>label==='Enable Waiting Room'||label==='Waiting Room';

  const enforceHostOnlyWaitingRoomToggle=()=>{
    if(!deviceMenu||isLocalHost())return;
    [...deviceMenu.querySelectorAll('button')].forEach(button=>{
      if(waitingRoomToggleLabel(normalizedMenuLabel(button)))button.remove();
    });
  };

  if(deviceMenu){
    new MutationObserver(enforceHostOnlyWaitingRoomToggle).observe(deviceMenu,{childList:true,subtree:true});
    deviceMenu.addEventListener('click',event=>{
      const button=event.target.closest('button');
      if(!isLocalHost()&&waitingRoomToggleLabel(normalizedMenuLabel(button))){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      }
    },true);
  }

  const appendDeviceSection=(label,select,kind)=>{
    if(!deviceMenu||!select)return;
    const heading=document.createElement('strong');
    heading.className='device-menu-section';
    heading.textContent=label;
    deviceMenu.append(heading);
    const options=[...select.options];
    if(!options.length){
      const empty=document.createElement('button');
      empty.type='button';empty.disabled=true;empty.textContent=`No ${label.toLowerCase()} detected`;
      deviceMenu.append(empty);return;
    }
    options.forEach(option=>{
      const button=document.createElement('button');
      button.type='button';
      button.dataset.deviceKind=kind;
      button.dataset.deviceId=option.value;
      button.textContent=`${option.value===select.value?'✓ ':''}${option.textContent}`;
      button.addEventListener('click',()=>{
        select.value=option.value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        deviceMenu.hidden=true;
      });
      deviceMenu.append(button);
    });
  };

  const showProfessionalAudioMenu=anchor=>{
    if(!deviceMenu||!anchor)return;
    const rect=anchor.getBoundingClientRect();
    deviceMenu.style.left=`${Math.max(10,Math.min(innerWidth-325,rect.left))}px`;
    deviceMenu.innerHTML='';
    appendDeviceSection('Microphone',microphoneSelect,'microphone');
    appendDeviceSection('Speaker',speakerSelect,'speaker');
    const settings=document.createElement('button');
    settings.type='button';settings.className='device-settings-link';settings.textContent='Audio Settings…';
    settings.addEventListener('click',()=>{
      deviceMenu.hidden=true;
      if(settingsDialog&&!settingsDialog.open)settingsDialog.showModal?.();
    });
    deviceMenu.append(settings);
    deviceMenu.hidden=false;
    deviceMenu.dataset.dsProfessionalAudio='1';
  };

  if(micMenuBtn&&deviceMenu){
    micMenuBtn.setAttribute('aria-label','Audio options');
    micMenuBtn.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      showProfessionalAudioMenu(event.currentTarget);
    },true);
  }

  reset();
  modernizeIconography();
  let savedView='stack';
  try{savedView=localStorage.getItem(VIEW_KEY)||'stack';}catch(_){}
  setView(savedView,false);
  reconcile();
  window.DSLayoutManager={resetDock:reset,reflowDock:reconcile,restoreDock:reset,setDockView:setView,dockState:()=>({mode:dock.classList.contains('ds-user-positioned')?'floating':'right',orientation:dock.dataset.orientation||'vertical',view:dock.dataset.view||'stack'})};
})();
