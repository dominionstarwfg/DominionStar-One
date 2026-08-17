(() => {
  const VERSION = '6.3.0';

  window.DOMINIONSTAR_RUNTIME = {
    version: VERSION,
    report(error, context = 'runtime') {
      const detail = {
        version: VERSION,
        context,
        message: error?.message || String(error),
        stack: error?.stack || '',
        path: location.pathname,
        timestamp: new Date().toISOString()
      };
      console.error('[DominionStar]', detail);
      try {
        sessionStorage.setItem('dominionstar-last-error', JSON.stringify(detail));
      } catch {}
    }
  };

  window.addEventListener('error', event => {
    window.DOMINIONSTAR_RUNTIME.report(event.error || event.message, 'window-error');
  });

  window.addEventListener('unhandledrejection', event => {
    window.DOMINIONSTAR_RUNTIME.report(event.reason, 'unhandled-promise');
  });

  document.documentElement.dataset.dsVersion = VERSION;
})();
