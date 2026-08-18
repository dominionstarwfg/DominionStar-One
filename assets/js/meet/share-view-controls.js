(() => {
  'use strict';

  const button = document.getElementById('shareViewerMoreBtn');
  const menu = document.getElementById('deviceMenu');
  const stage = document.getElementById('stage');
  const video = document.getElementById('stageVideo');
  const filmstrip = document.getElementById('filmstrip');
  if (!button || !menu || !stage || !video) return;

  const originalOpen = button.onclick;
  if (typeof originalOpen !== 'function') return;

  const view = { mode: 'fit', zoom: 100 };

  const closeMenu = () => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  const fitPercent = () => {
    const vw = Number(video.videoWidth || 0);
    const vh = Number(video.videoHeight || 0);
    const sw = Math.max(1, stage.clientWidth || 1);
    const sh = Math.max(1, stage.clientHeight || 1);
    if (!vw || !vh) return 100;
    return Math.max(1, Math.min(100, Math.round(Math.min(sw / vw, sh / vh) * 100)));
  };

  const applyView = (mode, zoom = 100) => {
    view.mode = mode;
    view.zoom = zoom;
    stage.dataset.shareView = mode;
    stage.dataset.shareZoom = String(zoom);
    video.style.transformOrigin = '50% 50%';
    video.style.transition = 'transform .12s ease';
    video.style.objectFit = 'contain';
    video.style.transform = mode === 'fit' ? '' : `scale(${zoom / 100})`;
    stage.style.overflow = 'hidden';
  };

  const makeAction = (label, action, checked = false) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'device-menu-item ds-share-view-action';
    item.setAttribute('role', 'menuitem');
    item.innerHTML = `<span class="ds-share-view-check" aria-hidden="true">${checked ? '✓' : ''}</span><span>${label}</span>`;
    item.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      await action();
      closeMenu();
    });
    return item;
  };

  const enhanceMenu = () => {
    const title = menu.querySelector('.menu-title');
    if (!title || title.textContent.trim() !== 'Shared Screen') return;
    const body = menu.querySelector('.utility-menu-body') || menu;
    if (body.querySelector('[data-ds-share-view-controls="1"]')) return;

    const controls = document.createElement('div');
    controls.dataset.dsShareViewControls = '1';
    controls.className = 'ds-share-view-controls';

    const section = document.createElement('div');
    section.className = 'device-menu-section';
    section.textContent = 'View';
    controls.append(section);

    controls.append(makeAction(`Fit to window (${fitPercent()}%)`, () => applyView('fit'), view.mode === 'fit'));
    [50, 100, 150, 200, 300].forEach(percent => {
      const label = `${percent}%${percent === 100 ? ' (Original size)' : ''}`;
      controls.append(makeAction(label, () => applyView('zoom', percent), view.mode === 'zoom' && view.zoom === percent));
    });

    controls.append(makeAction(document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen', async () => {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else await document.getElementById('meeting')?.requestFullscreen?.();
    }));

    controls.append(makeAction(filmstrip?.hidden ? 'Show video panel' : 'Hide video panel', () => {
      if (filmstrip) filmstrip.hidden = !filmstrip.hidden;
    }));

    body.prepend(controls);
  };

  button.onclick = event => {
    originalOpen.call(button, event);
    queueMicrotask(enhanceMenu);
  };

  new MutationObserver(() => {
    if (!menu.hidden) enhanceMenu();
  }).observe(menu, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

  if (!document.querySelector('script[data-ds-share-annotation]')) {
    const annotationScript = document.createElement('script');
    annotationScript.src = '/assets/js/meet/share-annotation.js?v=1-operation-2030';
    annotationScript.dataset.dsShareAnnotation = '1';
    document.head.append(annotationScript);
  }

  window.DominionShareViewerControls = Object.freeze({
    version: '1.1.0',
    applyView,
    snapshot: () => ({ ...view, fitPercent: fitPercent() })
  });
})();