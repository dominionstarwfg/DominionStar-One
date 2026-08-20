(() => {
  'use strict';
  if (window.DominionPresenterCommandParity) return;
  if (!window.dominionDesktop?.isDesktop || !window.dominionDesktop?.onPresenterCommand) return;

  const click = id => {
    const node = document.getElementById(id);
    if (!node || node.disabled) return false;
    node.click();
    return true;
  };

  const annotate = async () => {
    const annotation = window.DominionShareAnnotation;
    if (!annotation?.open) return false;
    return Boolean(await annotation.open().catch(() => false));
  };

  const unsubscribe = window.dominionDesktop.onPresenterCommand(command => {
    const safe = String(command || '');
    if (safe === 'new-share') {
      click('newShareBtn');
      return;
    }
    if (safe === 'annotate') {
      void annotate();
      return;
    }
    if (safe === 'show-meeting') {
      document.getElementById('meeting')?.focus?.({ preventScroll: true });
    }
  });

  window.DominionPresenterCommandParity = Object.freeze({
    version: '1.0.0',
    unsubscribe,
    newShare: () => click('newShareBtn'),
    annotate
  });
})();
