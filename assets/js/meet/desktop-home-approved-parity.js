(() => {
  'use strict';
  if (window.DominionDesktopHomeApprovedParity) return;

  const route = String(location.pathname || '/').replace(/\/+$/, '') || '/';
  if (route !== '/meet-home' || !window.dominionDesktop?.isDesktop) return;

  // Hide the retired readiness line synchronously before the next paint, then
  // remove it from the DOM. This prevents even a transient flash while keeping
  // the cleanup fail-safe if stale cached markup is ever encountered.
  const cleanupStyle = document.createElement('style');
  cleanupStyle.id = 'ds-approved-home-cleanup';
  cleanupStyle.textContent = '.status-line{display:none!important}';
  (document.head || document.documentElement).appendChild(cleanupStyle);

  const apply = () => {
    document.querySelector('.status-line')?.remove();
    document.documentElement.dataset.dsApprovedDesktopHome = '1';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  window.DominionDesktopHomeApprovedParity = Object.freeze({
    version: '1.1.0-no-readiness-flash',
    apply
  });
})();
