(() => {
  'use strict';
  if (window.DominionHostCohostUiParity) return;

  const meetingAuthority = () => {
    try {
      const snapshot = window.DominionStarMeetingEngine?.snapshot?.() || {};
      const role = String(snapshot.role || '').toLowerCase();
      return Object.freeze({
        isHost: Boolean(snapshot.isHost || role === 'host'),
        isCohost: Boolean(!snapshot.isHost && role === 'cohost'),
        role
      });
    } catch {
      return Object.freeze({ isHost: false, isCohost: false, role: '' });
    }
  };

  const normalizeWaitingCopy = root => {
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll('.waiting-room-banner small').forEach(node => {
      if (/Host action required/i.test(node.textContent || '')) {
        node.textContent = 'Waiting Room · Host or co-host action';
      }
    });
  };

  // Zoom-class authority boundary: a co-host may admit/remove/manage people in
  // an already-active Waiting Room, but only the host may enable/disable the
  // Waiting Room itself. Keep the broader co-host Host Tools surface intact;
  // remove only the host-exclusive Waiting Room switch.
  const enforceCohostWaitingRoomBoundary = root => {
    const authority = meetingAuthority();
    if (!authority.isCohost) return false;
    const scope = root?.querySelectorAll ? root : document;
    let changed = false;
    scope.querySelectorAll('#deviceMenu button, .device-menu button').forEach(button => {
      const label = String(button.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^(?:Enable Waiting Room|Waiting Room)$/i.test(label)) return;
      button.remove();
      changed = true;
    });
    return changed;
  };

  const refresh = root => {
    normalizeWaitingCopy(root);
    enforceCohostWaitingRoomBoundary(root);
  };

  refresh(document);

  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes || []) {
            if (node?.nodeType === 1) refresh(node);
          }
        }
        enforceCohostWaitingRoomBoundary(document);
      })
    : null;

  observer?.observe(document.documentElement, { childList: true, subtree: true });

  // Capture the event before legacy menu handlers. This makes the role boundary
  // deterministic even if an old menu node appears for a frame before the
  // mutation observer removes it.
  const guardHostOnlyWaitingRoomToggle = event => {
    const authority = meetingAuthority();
    if (!authority.isCohost) return;
    const button = event.target?.closest?.('#deviceMenu button, .device-menu button');
    if (!button) return;
    const label = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/^(?:Enable Waiting Room|Waiting Room)$/i.test(label)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    button.remove();
  };
  document.addEventListener('click', guardHostOnlyWaitingRoomToggle, true);

  window.DominionHostCohostUiParity = Object.freeze({
    version: '1.1.0',
    authority: meetingAuthority,
    refresh: () => refresh(document),
    enforceCohostWaitingRoomBoundary: () => enforceCohostWaitingRoomBoundary(document),
    disconnect: () => {
      observer?.disconnect();
      document.removeEventListener('click', guardHostOnlyWaitingRoomToggle, true);
    }
  });
})();
