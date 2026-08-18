(() => {
  'use strict';
  if (window.DominionPresentationHandoff) return;

  const engine = window.DominionStarMeetingEngine;
  if (!engine) return;

  const state = {
    presenterId: '',
    epoch: 0,
    transition: Promise.resolve()
  };

  const snapshot = () => engine.snapshot?.() || {};
  const isPrivileged = snap => Boolean(snap?.isHost || snap?.role === 'host' || snap?.role === 'cohost');

  const notify = detail => {
    window.dispatchEvent(new CustomEvent('dominion:presentation-handoff',{detail}));
    window.DominionRuntime?.events?.publish?.({
      type:'presentation.handoff',
      source:'meet-ui',
      meetingId:String(snapshot().roomId||''),
      correlationId:String(detail.epoch),
      payload:detail
    });
  };

  const resetPresentationTools = async detail => {
    const annotation = window.DominionShareAnnotation;
    try { annotation?.close?.(); } catch (_) {}
    if (isPrivileged(snapshot())) {
      try { await annotation?.clear?.(); } catch (_) {}
    }
    try { await window.DominionRemoteControl?.resetForPresenterChange?.(detail); } catch (_) {}
    notify(detail);
  };

  const transitionTo = (nextPresenterId, reason='presenter-change') => {
    const next = String(nextPresenterId || '');
    state.transition = state.transition.then(async () => {
      const previous = state.presenterId;
      if (previous === next) return false;
      state.epoch += 1;
      state.presenterId = next;
      document.body.dataset.presentationEpoch = String(state.epoch);
      document.body.dataset.presentationParticipantId = next;
      const detail = Object.freeze({
        epoch:state.epoch,
        previousPresenterId:previous,
        nextPresenterId:next,
        reason:String(reason||'presenter-change'),
        changedAt:Date.now()
      });
      if (previous) await resetPresentationTools(detail);
      else notify(detail);
      return true;
    }).catch(()=>false);
    return state.transition;
  };

  engine.on?.('screen-state',payload=>{
    const participantId = String(payload?.participantId || '');
    if (!participantId) return;
    if (payload.active) transitionTo(participantId,'remote-share-start');
    else if (state.presenterId === participantId) transitionTo('','remote-share-end');
  });

  engine.on?.('screen-stream',()=>{
    const participantId = String(snapshot().participantId || 'self');
    transitionTo(participantId,'local-share-start');
  });

  engine.on?.('screen-ended',()=>{
    const participantId = String(snapshot().participantId || '');
    if (!state.presenterId || state.presenterId === participantId) transitionTo('','local-share-end');
  });

  window.DominionPresentationHandoff = Object.freeze({
    version:'1.0.0',
    transitionTo,
    snapshot:()=>({presenterId:state.presenterId,epoch:state.epoch})
  });
})();
