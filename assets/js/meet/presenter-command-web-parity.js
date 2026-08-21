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

  const slideControl = () => {
    window.dispatchEvent(new CustomEvent('dominion:slide-control-open'));
    return true;
  };

  const route = safe => {
    if (safe === 'audio') return click('micBtn');
    if (safe === 'video') return click('camBtn');
    if (safe === 'participants') return click('participantsBtn');
    if (safe === 'chat') return click('chatBtn');
    if (safe === 'reactions') return click('reactionBtn');
    if (safe === 'pause') return click('pauseShareBtn');
    if (safe === 'new-share') return click('newShareBtn');
    if (safe === 'stop') return click('stopShareBtn');
    if (safe === 'slide-control') return slideControl();
    if (safe === 'show-meeting') {
      document.getElementById('meeting')?.focus?.({ preventScroll: true });
      return true;
    }
    if (safe === 'annotate') {
      void annotate();
      return true;
    }
    return false;
  };

  const unsubscribe = window.dominionDesktop.onPresenterCommand(command => {
    route(String(command || ''));
  });

  window.DominionPresenterCommandParity = Object.freeze({
    version: '1.2.0',
    unsubscribe,
    route,
    newShare: () => click('newShareBtn'),
    annotate,
    slideControl
  });
})();
