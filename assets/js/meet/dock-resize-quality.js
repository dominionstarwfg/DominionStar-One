(() => {
  'use strict';
  if (window.DominionDockResizeQuality) return;

  const dock = document.getElementById('filmstrip');
  const track = document.getElementById('filmstripTrack');
  if (!dock || !track) return;

  // dock-layout-v2 is the ONLY authority for position, drag, orientation, and
  // right/top docking. This module deliberately owns only user resizing and
  // video pixel presentation so the two concerns cannot fight each other.
  const SIZE_KEY = 'ds_meet_dock_size_v1';
  const MIN_WIDTH = 188;
  const MAX_WIDTH = 520;
  const MIN_HEIGHT = 120;
  const MAX_HEIGHT = 760;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const style = document.createElement('style');
  style.dataset.dsDockResizeQuality = '1';
  style.textContent = `
    #filmstrip.ds-dock-v2{--ds-dock-width:244px;--ds-dock-tile-height:137px}
    #filmstrip.ds-dock-v2 .remote-tile{overflow:hidden!important}
    #filmstrip.ds-dock-v2 .remote-tile video{
      width:100%!important;height:100%!important;object-fit:cover!important;
      image-rendering:auto!important;filter:none!important;transform:translateZ(0);
      backface-visibility:hidden;-webkit-backface-visibility:hidden;
    }
    #filmstrip.ds-dock-v2 .remote-tile .tile-mic{
      display:grid!important;position:absolute!important;right:8px!important;bottom:7px!important;
      z-index:6!important;width:24px!important;height:24px!important;place-items:center!important;
      border-radius:6px!important;background:rgba(4,7,11,.74)!important;color:#fff!important;
      backdrop-filter:blur(8px)!important;
    }
    #filmstrip.ds-dock-v2.ds-user-resized{
      width:var(--ds-dock-user-width)!important;max-width:calc(100vw - 24px)!important;
      height:var(--ds-dock-user-height)!important;max-height:calc(100vh - 110px)!important;
    }
    #filmstrip.ds-dock-v2.ds-user-resized .filmstrip-track{max-height:none!important;height:100%!important}
    #filmstrip .ds-dock-resize-handle{
      position:absolute!important;right:2px!important;bottom:2px!important;width:16px!important;height:16px!important;
      z-index:40!important;cursor:nwse-resize!important;pointer-events:auto!important;touch-action:none!important;
      border-right:2px solid rgba(255,255,255,.55)!important;border-bottom:2px solid rgba(255,255,255,.55)!important;
      border-radius:0 0 4px 0!important;
    }
    @media (max-width:900px){#filmstrip.ds-dock-v2{--ds-dock-width:196px;--ds-dock-tile-height:110px}}
  `;
  document.head.append(style);

  const availableMaxWidth = () => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, innerWidth - 24));
  const availableMaxHeight = () => Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, innerHeight - 110));

  const applySize = (width, height) => {
    const nextWidth = clamp(Number(width) || dock.offsetWidth || 244, MIN_WIDTH, availableMaxWidth());
    const nextHeight = clamp(Number(height) || dock.offsetHeight || 420, MIN_HEIGHT, availableMaxHeight());
    dock.classList.add('ds-user-resized');
    dock.style.setProperty('--ds-dock-user-width', `${Math.round(nextWidth)}px`);
    dock.style.setProperty('--ds-dock-user-height', `${Math.round(nextHeight)}px`);
    return { width: Math.round(nextWidth), height: Math.round(nextHeight) };
  };

  const saveSize = () => {
    if (!dock.classList.contains('ds-user-resized')) return;
    try {
      const rect = dock.getBoundingClientRect();
      const size = applySize(rect.width, rect.height);
      localStorage.setItem(SIZE_KEY, JSON.stringify(size));
    } catch {}
  };

  const restoreSize = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');
      if (!saved) return false;
      applySize(saved.width, saved.height);
      return true;
    } catch {
      return false;
    }
  };

  let resizeGesture = null;
  const resizeHandle = document.createElement('span');
  resizeHandle.className = 'ds-dock-resize-handle';
  resizeHandle.setAttribute('aria-hidden', 'true');
  dock.append(resizeHandle);

  resizeHandle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = dock.getBoundingClientRect();
    resizeGesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height
    };
    resizeHandle.setPointerCapture?.(event.pointerId);
  });

  resizeHandle.addEventListener('pointermove', event => {
    if (!resizeGesture || event.pointerId !== resizeGesture.id) return;
    applySize(
      resizeGesture.width + event.clientX - resizeGesture.x,
      resizeGesture.height + event.clientY - resizeGesture.y
    );
    event.preventDefault();
    event.stopPropagation();
  });

  const finishResize = event => {
    if (!resizeGesture || (event?.pointerId != null && event.pointerId !== resizeGesture.id)) return;
    try { resizeHandle.releasePointerCapture?.(resizeGesture.id); } catch {}
    resizeGesture = null;
    saveSize();
  };
  resizeHandle.addEventListener('pointerup', finishResize);
  resizeHandle.addEventListener('pointercancel', finishResize);

  addEventListener('resize', () => {
    if (dock.classList.contains('ds-user-resized')) saveSize();
  }, { passive: true });

  restoreSize();

  window.DominionDockResizeQuality = Object.freeze({
    version: '1.0.0-single-layout-authority',
    ownership: Object.freeze({ position: 'dock-layout-v2', orientation: 'dock-layout-v2', resize: 'dock-resize-quality' }),
    saveSize,
    restoreSize,
    snapshot: () => ({
      resized: dock.classList.contains('ds-user-resized'),
      orientation: dock.dataset.orientation || 'vertical',
      positionOwner: dock.dataset.positionOwner || 'dock-layout-v2'
    })
  });
})();
