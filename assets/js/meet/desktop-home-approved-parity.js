(() => {
  'use strict';
  if (window.DominionDesktopHomeApprovedParity) return;

  const route = String(location.pathname || '/').replace(/\/+$/, '') || '/';
  if (route !== '/meet-home' || !window.dominionDesktop?.isDesktop) return;

  const apply = () => {
    // The approved desktop illustration keeps the Today card clean. The
    // experimental readiness banner was never part of the approved Home flow.
    document.querySelector('.status-line')?.remove();
    document.documentElement.dataset.dsApprovedDesktopHome = '1';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  window.DominionDesktopHomeApprovedParity = Object.freeze({
    version: '1.0.0',
    apply
  });
})();
