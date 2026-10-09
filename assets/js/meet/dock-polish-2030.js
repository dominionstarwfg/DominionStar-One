(() => {
  'use strict';
  if (window.DominionDockPolish2030) return;

  const dock = document.getElementById('filmstrip');
  const track = document.getElementById('filmstripTrack');
  const grip = dock?.querySelector('.dock-grip');
  if (!dock || !track || !grip) return;

  const style = document.createElement('style');
  style.dataset.dsDockPolish2030 = '1';
  style.textContent = `
    #filmstrip.ds-dock-v2,
    #filmstrip.ds-dock-v2 .remote-tile,
    #filmstrip.ds-dock-v2 .dock-grip{cursor:default!important;}
    #filmstrip.ds-dock-v2.is-dragging,
    #filmstrip.ds-dock-v2.is-dragging .dock-grip{cursor:default!important;}
    #filmstrip.ds-dock-v2 .dock-grip{touch-action:none!important;}
    #filmstrip.ds-dock-v2 .remote-tile video{
      width:100%!important;height:100%!important;object-fit:cover!important;
      image-rendering:auto!important;filter:none!important;transform:translateZ(0);
      backface-visibility:hidden;-webkit-backface-visibility:hidden;
    }
    #filmstrip.ds-dock-v2 .remote-tile{overflow:hidden!important;}
    #filmstrip.ds-dock-v2{--ds-dock-width:244px;--ds-dock-tile-height:137px;}
    @media (max-width:900px){#filmstrip.ds-dock-v2{--ds-dock-width:196px;--ds-dock-tile-height:110px;}}
  `;
  document.head.append(style);

  // The existing layout listens on the dock itself. Block accidental body/tile
  // drags so only the dedicated grip starts repositioning. Interactive controls
  // remain untouched.
  document.addEventListener('pointerdown', event => {
    const target = event.target;
    if (!(target instanceof Element) || !dock.contains(target)) return;
    if (target.closest('button,input,select,textarea,a,[contenteditable="true"],[role="button"],[role="menuitem"]')) return;
    if (target.closest('.dock-grip')) return;
    event.stopPropagation();
  }, true);

  // Orientation should never flip merely because the dock touches the right or
  // left edge. Horizontal mode is an explicit top-dock gesture: the user must
  // release the grip in a narrow top target after a meaningful upward drag.
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
  };
  grip.addEventListener('pointerup', settleOrientation, true);
  grip.addEventListener('pointercancel', () => { gesture = null; }, true);

  // Correct legacy orientation changes one frame after their pointerup handler.
  dock.addEventListener('pointerup', event => {
    const wasGrip = event.target instanceof Element && Boolean(event.target.closest('.dock-grip'));
    if (!wasGrip) return;
    const snapshot = gesture;
    requestAnimationFrame(() => {
      if (!snapshot) return;
      const rect = dock.getBoundingClientRect();
      const upwardTravel = snapshot.startY - event.clientY;
      const explicitTopDock = rect.top <= 22 && upwardTravel >= 34 && innerWidth > 720;
      dock.classList.toggle('ds-dock-horizontal', explicitTopDock);
      dock.classList.toggle('ds-dock-vertical', !explicitTopDock);
      dock.dataset.orientation = explicitTopDock ? 'horizontal' : 'vertical';
    });
  });

  // Keep media tiles crisp when the layout changes size by avoiding fractional
  // dimensions that force Chromium to resample the decoded frame unnecessarily.
  const normalizeTilePixels = () => {
    track.querySelectorAll('.remote-tile video').forEach(video => {
      const tile = video.closest('.remote-tile');
      const rect = tile?.getBoundingClientRect();
      if (!rect) return;
      video.style.width = `${Math.max(1, Math.round(rect.width))}px`;
      video.style.height = `${Math.max(1, Math.round(rect.height))}px`;
    });
  };
  new ResizeObserver(normalizeTilePixels).observe(dock);
  new MutationObserver(normalizeTilePixels).observe(track,{childList:true,subtree:true});
  addEventListener('resize', normalizeTilePixels, {passive:true});
  requestAnimationFrame(normalizeTilePixels);

  window.DominionDockPolish2030 = Object.freeze({
    version:'1.0.0',
    normalizeTilePixels,
    snapshot:()=>({orientation:dock.dataset.orientation||'vertical',count:track.querySelectorAll('.remote-tile:not([hidden])').length})
  });
})();