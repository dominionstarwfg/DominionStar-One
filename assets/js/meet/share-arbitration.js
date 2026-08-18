(() => {
  'use strict';
  if (window.DominionShareArbitration) return;

  const engine = window.DominionStarMeetingEngine;
  const shareButton = document.getElementById('shareBtn');
  if (!engine || !shareButton) return;

  const state = { busy:false };
  const snapshot = () => engine.snapshot?.() || {};
  const handoff = () => window.DominionPresentationHandoff?.snapshot?.() || { presenterId:'', epoch:0 };
  const isPrivileged = snap => Boolean(snap?.isHost || snap?.role === 'host' || snap?.role === 'cohost');
  const localParticipantId = () => String(snapshot().participantId || '');

  const toast = message => {
    try {
      window.DominionMeetToast?.(message);
      if (window.DominionMeetToast) return;
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('dominion:meet-toast',{detail:{message:String(message||'')}}));
  };

  const waitForPresenter = (expected, timeoutMs=5000) => new Promise(resolve => {
    const wanted = String(expected || '');
    const started = Date.now();
    const check = () => {
      if (String(handoff().presenterId || '') === wanted) return resolve(true);
      if (Date.now() - started >= timeoutMs) return resolve(false);
      setTimeout(check, 50);
    };
    check();
  });

  const interruptAndShare = async presenterId => {
    if (state.busy) return false;
    state.busy = true;
    shareButton.disabled = true;
    try {
      const current = String(presenterId || '');
      if (current) {
        await engine.moderate?.(current,'stop-share');
        const cleared = await waitForPresenter('');
        if (!cleared) throw new Error('The current screen share did not stop in time.');
      }
      await engine.shareScreen();
      return true;
    } catch (error) {
      toast(error?.message || 'Could not take over screen sharing.');
      return false;
    } finally {
      state.busy = false;
      shareButton.disabled = false;
    }
  };

  shareButton.addEventListener('click', event => {
    const current = String(handoff().presenterId || '');
    const local = localParticipantId();
    if (!current || current === local || current === 'self') return;

    const snap = snapshot();
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!isPrivileged(snap)) {
      toast('Someone is already sharing. Wait until their share ends.');
      return;
    }
    void interruptAndShare(current);
  }, true);

  window.DominionShareArbitration = Object.freeze({
    version:'1.0.0',
    mode:'one-participant-at-a-time',
    canInterrupt:()=>isPrivileged(snapshot()),
    activePresenterId:()=>String(handoff().presenterId || ''),
    interruptAndShare
  });
})();