(() => {
  'use strict';
  if (window.DominionHostCohostUiParity) return;

  const normalizeWaitingCopy = root => {
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll('.waiting-room-banner small').forEach(node => {
      if (/Host action required/i.test(node.textContent || '')) {
        node.textContent = 'Waiting Room · Host or co-host action';
      }
    });
  };

  normalizeWaitingCopy(document);

  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes || []) {
            if (node?.nodeType === 1) normalizeWaitingCopy(node);
          }
        }
      })
    : null;

  observer?.observe(document.documentElement, { childList: true, subtree: true });

  window.DominionHostCohostUiParity = Object.freeze({
    version: '1.0.0',
    refresh: () => normalizeWaitingCopy(document),
    disconnect: () => observer?.disconnect()
  });
})();
