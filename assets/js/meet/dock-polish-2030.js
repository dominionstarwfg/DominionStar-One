(() => {
  'use strict';
  if (window.DominionDockPolish2030) return;

  const dock = document.getElementById('filmstrip');
  const track = document.getElementById('filmstripTrack');
  const grip = dock?.querySelector('.dock-grip');
  if (!dock || !track || !grip) return;

  const POSITION_KEY='ds_meet_dock_geometry_v3';
  const MIN_WIDTH=188, MAX_WIDTH=520, MIN_HEIGHT=120, MAX_HEIGHT=760;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  const style = document.createElement('style');
  style.dataset.dsDockPolish2030 = '1';
  style.textContent = `
    #filmstrip.ds-dock-v2,
    #filmstrip.ds-dock-v2 .remote-tile,
    #filmstrip.ds-dock-v2 .dock-grip{cursor:default!important;}
    #filmstrip.ds-dock-v2.is-dragging,
    #filmstrip.ds-dock-v2.is-dragging .dock-grip{cursor:default!important;}
    #filmstrip.ds-dock-v2 .dock-grip{touch-action:none!important;cursor:move!important;}
    #filmstrip.ds-dock-v2 .remote-tile video{width:100%!important;height:100%!important;object-fit:cover!important;image-rendering:auto!important;filter:none!important;transform:translateZ(0);backface-visibility:hidden;-webkit-backface-visibility:hidden;}
    #filmstrip.ds-dock-v2 .remote-tile{overflow:hidden!important;}
    #filmstrip.ds-dock-v2{--ds-dock-width:244px;--ds-dock-tile-height:137px;}
    #filmstrip.ds-dock-v2 .remote-tile .tile-mic{display:grid!important;position:absolute!important;right:8px!important;bottom:7px!important;z-index:6!important;width:24px!important;height:24px!important;place-items:center!important;border-radius:6px!important;background:rgba(4,7,11,.74)!important;color:#fff!important;backdrop-filter:blur(8px)!important;}
    #filmstrip.ds-dock-v2.ds-user-resized{width:var(--ds-dock-user-width)!important;max-width:calc(100vw - 24px)!important;height:var(--ds-dock-user-height)!important;max-height:calc(100vh - 110px)!important;}
    #filmstrip.ds-dock-v2.ds-user-resized .filmstrip-track{max-height:none!important;height:100%!important;}
    #filmstrip .ds-dock-resize-handle{position:absolute!important;right:2px!important;bottom:2px!important;width:16px!important;height:16px!important;z-index:40!important;cursor:nwse-resize!important;pointer-events:auto!important;touch-action:none!important;border-right:2px solid rgba(255,255,255,.55)!important;border-bottom:2px solid rgba(255,255,255,.55)!important;border-radius:0 0 4px 0!important;}
    @media (max-width:900px){#filmstrip.ds-dock-v2{--ds-dock-width:196px;--ds-dock-tile-height:110px;}}
  `;
  document.head.append(style);

  const saveGeometry=()=>{
    try{
      const rect=dock.getBoundingClientRect();
      localStorage.setItem(POSITION_KEY,JSON.stringify({left:Math.round(rect.left),top:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height),orientation:dock.dataset.orientation||'vertical',resized:dock.classList.contains('ds-user-resized')}));
    }catch(_){ }
  };
  const restoreGeometry=()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(POSITION_KEY)||'null');
      if(!saved)return;
      if(Number.isFinite(saved.left)&&Number.isFinite(saved.top)){
        const width=clamp(Number(saved.width)||dock.offsetWidth,MIN_WIDTH,Math.min(MAX_WIDTH,innerWidth-24));
        const height=clamp(Number(saved.height)||dock.offsetHeight,MIN_HEIGHT,Math.min(MAX_HEIGHT,innerHeight-110));
        dock.classList.add('ds-user-positioned');
        dock.style.setProperty('--ds-dock-left',`${clamp(saved.left,12,Math.max(12,innerWidth-width-12))}px`);
        dock.style.setProperty('--ds-dock-top',`${clamp(saved.top,62,Math.max(62,innerHeight-height-88))}px`);
        if(saved.resized){dock.classList.add('ds-user-resized');dock.style.setProperty('--ds-dock-user-width',`${width}px`);dock.style.setProperty('--ds-dock-user-height',`${height}px`);}
        const horizontal=saved.orientation==='horizontal';
        dock.classList.toggle('ds-dock-horizontal',horizontal);dock.classList.toggle('ds-dock-vertical',!horizontal);dock.dataset.orientation=horizontal?'horizontal':'vertical';
      }
    }catch(_){ }
  };

  document.addEventListener('pointerdown', event => {
    const target = event.target;
    if (!(target instanceof Element) || !dock.contains(target)) return;
    if (target.closest('button,input,select,textarea,a,[contenteditable="true"],[role="button"],[role="menuitem"],.ds-dock-resize-handle')) return;
    if (target.closest('.dock-grip')) return;
    event.stopPropagation();
  }, true);

  let gesture = null;
  grip.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = dock.getBoundingClientRect();
    gesture = {id:event.pointerId,startY:event.clientY,startTop:rect.top};
  }, true);

  const settleOrientation = event => {
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.id)) return;
    const rect = dock.getBoundingClientRect();
    const upwardTravel = gesture.startY - Number(event?.clientY ?? gesture.startY);
    const explicitTopDock = rect.top <= 22 && upwardTravel >= 34 && innerWidth > 720;
    dock.classList.toggle('ds-dock-horizontal', explicitTopDock);
    dock.classList.toggle('ds-dock-vertical', !explicitTopDock);
    dock.dataset.orientation = explicitTopDock ? 'horizontal' : 'vertical';
    gesture = null;
    requestAnimationFrame(saveGeometry);
  };
  grip.addEventListener('pointerup', settleOrientation, true);
  grip.addEventListener('pointercancel', () => { gesture = null; }, true);

  dock.addEventListener('pointerup', event => {
    const wasGrip = event.target instanceof Element && Boolean(event.target.closest('.dock-grip'));
    if (!wasGrip) return;
    requestAnimationFrame(saveGeometry);
  });

  const resizeHandle=document.createElement('span');
  resizeHandle.className='ds-dock-resize-handle';
  resizeHandle.setAttribute('aria-hidden','true');
  dock.append(resizeHandle);
  let resizeGesture=null;
  resizeHandle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const rect=dock.getBoundingClientRect();
    resizeGesture={id:event.pointerId,x:event.clientX,y:event.clientY,width:rect.width,height:rect.height};
    resizeHandle.setPointerCapture?.(event.pointerId);
  });
  resizeHandle.addEventListener('pointermove',event=>{
    if(!resizeGesture||event.pointerId!==resizeGesture.id)return;
    const width=clamp(resizeGesture.width+event.clientX-resizeGesture.x,MIN_WIDTH,Math.min(MAX_WIDTH,innerWidth-24));
    const height=clamp(resizeGesture.height+event.clientY-resizeGesture.y,MIN_HEIGHT,Math.min(MAX_HEIGHT,innerHeight-110));
    dock.classList.add('ds-user-resized');
    dock.style.setProperty('--ds-dock-user-width',`${Math.round(width)}px`);
    dock.style.setProperty('--ds-dock-user-height',`${Math.round(height)}px`);
    event.preventDefault();
  });
  const endResize=event=>{
    if(!resizeGesture||(event?.pointerId!=null&&event.pointerId!==resizeGesture.id))return;
    try{resizeHandle.releasePointerCapture?.(resizeGesture.id);}catch(_){ }
    resizeGesture=null;saveGeometry();
  };
  resizeHandle.addEventListener('pointerup',endResize);
  resizeHandle.addEventListener('pointercancel',endResize);

  const normalizeTilePixels = () => {
    track.querySelectorAll('.remote-tile video').forEach(video => {
      const tile = video.closest('.remote-tile');
      const rect = tile?.getBoundingClientRect();
      if (!rect) return;
      video.style.width = `${Math.max(1, Math.round(rect.width))}px`;
      video.style.height = `${Math.max(1, Math.round(rect.height))}px`;
    });
  };
  new ResizeObserver(()=>{normalizeTilePixels();if(!resizeGesture)saveGeometry();}).observe(dock);
  new MutationObserver(normalizeTilePixels).observe(track,{childList:true,subtree:true});
  addEventListener('resize',()=>{restoreGeometry();normalizeTilePixels();},{passive:true});
  restoreGeometry();
  requestAnimationFrame(normalizeTilePixels);

  window.DominionDockPolish2030 = Object.freeze({
    version:'1.1.0',
    normalizeTilePixels,
    saveGeometry,
    restoreGeometry,
    snapshot:()=>({orientation:dock.dataset.orientation||'vertical',count:track.querySelectorAll('.remote-tile:not([hidden])').length,resized:dock.classList.contains('ds-user-resized')})
  });
})();