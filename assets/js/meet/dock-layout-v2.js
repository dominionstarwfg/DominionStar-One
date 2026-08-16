(() => {
  'use strict';
  const dock=document.getElementById('filmstrip');
  const track=document.getElementById('filmstripTrack');
  const grip=dock?.querySelector('.dock-grip');
  if(!dock||!track||!grip)return;

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
  dock.querySelectorAll('[data-dock-view]').forEach(button=>button.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();setView(button.dataset.dockView);
  }));

  reset();
  let savedView='stack';
  try{savedView=localStorage.getItem(VIEW_KEY)||'stack';}catch(_){}
  setView(savedView,false);
  reconcile();
  window.DSLayoutManager={resetDock:reset,reflowDock:reconcile,restoreDock:reset,setDockView:setView,dockState:()=>({mode:dock.classList.contains('ds-user-positioned')?'floating':'right',orientation:dock.dataset.orientation||'vertical',view:dock.dataset.view||'stack'})};
})();
