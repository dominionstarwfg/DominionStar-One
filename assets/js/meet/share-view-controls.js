(() => {
  'use strict';

  const button = document.getElementById('shareViewerMoreBtn');
  const menu = document.getElementById('deviceMenu');
  const stage = document.getElementById('stage');
  const video = document.getElementById('stageVideo');
  const filmstrip = document.getElementById('filmstrip');
  const meetingToolbar = document.getElementById('meetingToolbar');
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

  const waitForAnnotation = async () => {
    if (window.DominionShareAnnotation?.open) return window.DominionShareAnnotation;
    const script = document.querySelector('script[data-ds-share-annotation]');
    if (!script) return null;
    await Promise.race([
      new Promise(resolve => {
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', resolve, { once: true });
      }),
      new Promise(resolve => setTimeout(resolve, 4000))
    ]);
    return window.DominionShareAnnotation || null;
  };

  const positionAnnotationToolbar = () => {
    const annotationToolbar = document.querySelector('.ds-annotation-toolbar');
    if (!annotationToolbar) return;
    const localPresenter = document.body.classList.contains('local-presentation-active');
    const normalToolbarVisible = !localPresenter && meetingToolbar && !meetingToolbar.hidden;
    const occupiedHeight = normalToolbarVisible ? Math.ceil(meetingToolbar.getBoundingClientRect().height || 0) : 0;
    annotationToolbar.style.bottom = `${Math.max(18, occupiedHeight + 18)}px`;
  };

  const openAnnotation = async () => {
    const annotation = await waitForAnnotation();
    if (!annotation?.open) return false;
    const opened = await annotation.open();
    if (opened) requestAnimationFrame(positionAnnotationToolbar);
    return opened;
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

    const annotateAction = makeAction('Annotate', openAnnotation);
    annotateAction.dataset.dsAnnotationAction = '1';
    controls.append(annotateAction);

    body.prepend(controls);
  };

  button.onclick = event => {
    originalOpen.call(button, event);
    queueMicrotask(enhanceMenu);
  };

  new MutationObserver(() => {
    if (!menu.hidden) enhanceMenu();
  }).observe(menu, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

  const prewarmAnnotationSurface = () => {
    const annotation = window.DominionShareAnnotation;
    if (!document.body.classList.contains('presentation-active') || !annotation?.open) return;
    Promise.resolve(annotation.open()).then(opened => {
      if (opened) annotation.close();
    }).catch(()=>{});
  };

  let presentationWasActive = document.body.classList.contains('presentation-active');
  const watchPresentation = () => {
    const active = document.body.classList.contains('presentation-active');
    if (active && !presentationWasActive) prewarmAnnotationSurface();
    presentationWasActive = active;
    if (active) requestAnimationFrame(positionAnnotationToolbar);
  };
  new MutationObserver(watchPresentation).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',()=>requestAnimationFrame(positionAnnotationToolbar),{passive:true});

  if (!document.querySelector('script[data-ds-share-annotation]')) {
    const annotationScript = document.createElement('script');
    annotationScript.src = '/assets/js/meet/share-annotation.js?v=1-operation-2030';
    annotationScript.dataset.dsShareAnnotation = '1';
    annotationScript.addEventListener('load',()=>{
      presentationWasActive = document.body.classList.contains('presentation-active');
      if (presentationWasActive) prewarmAnnotationSurface();
    },{once:true});
    document.head.append(annotationScript);
  }

  if (!document.querySelector('script[data-ds-share-spotlight]')) {
    const spotlightScript = document.createElement('script');
    spotlightScript.src = '/assets/js/meet/share-spotlight.js?v=1-operation-2030';
    spotlightScript.dataset.dsShareSpotlight = '1';
    document.head.append(spotlightScript);
  }

  if (!document.querySelector('script[data-ds-presentation-handoff]')) {
    const handoffScript = document.createElement('script');
    handoffScript.src = '/assets/js/meet/presentation-handoff.js?v=1-operation-2030';
    handoffScript.dataset.dsPresentationHandoff = '1';
    document.head.append(handoffScript);
  }

  if (!document.querySelector('script[data-ds-share-arbitration]')) {
    const arbitrationScript = document.createElement('script');
    arbitrationScript.src = '/assets/js/meet/share-arbitration.js?v=1-operation-2030';
    arbitrationScript.dataset.dsShareArbitration = '1';
    arbitrationScript.addEventListener('load',()=>{
      if (document.querySelector('script[data-ds-share-arbitration-ui]')) return;
      const uiScript=document.createElement('script');
      uiScript.src='/assets/js/meet/share-arbitration-ui.js?v=1-operation-2030';
      uiScript.dataset.dsShareArbitrationUi='1';
      document.head.append(uiScript);
    },{once:true});
    document.head.append(arbitrationScript);
  }

  window.DominionShareViewerControls = Object.freeze({
    version: '1.7.0',
    applyView,
    snapshot: () => ({ ...view, fitPercent: fitPercent() })
  });
})();