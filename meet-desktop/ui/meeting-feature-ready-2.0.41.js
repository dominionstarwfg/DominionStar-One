(()=>{
  'use strict';
  if(window.DominionMeetingFeatureReady2041)return;

  const hydrate=()=>{
    const api=window.DominionMeetingFeatures;
    if(!api)return false;

    // meeting-features.js can load before app.js finishes creating #meetingOverlay
    // because app.js awaits media-controller.js during bootstrap. Calling the
    // public chat API with force=false is an idempotent way to run its private
    // ensureUi() without opening Chat. That creates Chat, Reactions and their
    // supporting surfaces as soon as the meeting shell exists.
    try{api.toggleChat?.(false);}catch(error){
      console.warn('[DominionStar Meet] Meeting feature hydration failed.',error);
      return false;
    }

    requestAnimationFrame(()=>{
      try{window.DominionRuntimeStability?.sync?.();}catch{}
      try{window.DominionZoomScreenshotReference?.sync?.();}catch{}
      try{window.DominionZoomProductionPolish?.sync?.();}catch{}
    });
    return Boolean(document.querySelector('#roomChat')&&document.querySelector('#roomReactions'));
  };

  const onMeetingUiReady=()=>{hydrate();};
  window.addEventListener('dominion:meeting-ui-ready',onMeetingUiReady);

  // Also repair late-load/reload ordering if the meeting shell already exists.
  if(document.querySelector('#meetingOverlay'))onMeetingUiReady();

  window.DominionMeetingFeatureReady2041=Object.freeze({
    version:'2.0.41',
    hydrate,
    dispose:()=>window.removeEventListener('dominion:meeting-ui-ready',onMeetingUiReady)
  });
})();
