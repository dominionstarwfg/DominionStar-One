(()=>{
  'use strict';
  if(window.DominionMeetingFeatureReady2041)return;

  let reactionObserver=null;
  let observedReactionButton=null;

  const enforceReactionLabel=()=>{
    const button=document.querySelector('#roomReactions');
    if(!button)return false;
    const label=button.querySelector('.ds-control-label');
    if(!label)return false;
    if(label.textContent!=='Reactions')label.textContent='Reactions';
    label.style.setProperty('display','block','important');
    label.style.setProperty('visibility','visible','important');
    label.style.setProperty('opacity','1','important');
    label.style.setProperty('white-space','nowrap','important');
    button.setAttribute('aria-label','Reactions');
    return true;
  };

  const observeReactionLabel=()=>{
    const button=document.querySelector('#roomReactions');
    if(!button)return false;
    if(button===observedReactionButton){enforceReactionLabel();return true;}
    reactionObserver?.disconnect();
    observedReactionButton=button;
    reactionObserver=new MutationObserver(()=>enforceReactionLabel());
    reactionObserver.observe(button,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class']});
    enforceReactionLabel();
    return true;
  };

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

    observeReactionLabel();
    requestAnimationFrame(()=>{
      try{window.DominionRuntimeStability?.sync?.();}catch{}
      try{window.DominionZoomScreenshotReference?.sync?.();}catch{}
      try{window.DominionZoomProductionPolish?.sync?.();}catch{}
      enforceReactionLabel();
      requestAnimationFrame(enforceReactionLabel);
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
    enforceReactionLabel,
    dispose:()=>{
      window.removeEventListener('dominion:meeting-ui-ready',onMeetingUiReady);
      reactionObserver?.disconnect();reactionObserver=null;observedReactionButton=null;
    }
  });
})();
