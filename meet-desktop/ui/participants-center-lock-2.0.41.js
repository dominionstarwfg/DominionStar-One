(()=>{
  'use strict';
  if(window.DominionParticipantsCenterLock2041)return;

  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  let frame=0;

  function syncEncryption(){
    const head=q('#meetingOverlay .meeting-head');if(!head)return;
    const exec=[...head.querySelectorAll('.ds-exec-encrypted')];
    const approved=[...head.querySelectorAll('.ds-approved-encryption')];
    if(exec.length){
      exec.slice(1).forEach(node=>node.remove());
      approved.forEach(node=>node.remove());
      exec[0].setAttribute('aria-label','Encrypted media transport');
      return;
    }
    approved.slice(1).forEach(node=>node.remove());
  }

  function cleanLegacyParticipantDecorations(){
    for(const row of qa('#participantRoster [data-participant-id]')){
      for(const node of row.querySelectorAll('.ds-participant-role-badge,.ds-participant-self-label,.ds-host-row-more'))node.remove();
    }
    q('#meetingOverlay .room-side')?.classList.remove('ds-center-lock');
  }

  function sync(){
    frame=0;
    syncEncryption();
    cleanLegacyParticipantDecorations();
    window.DominionRuntimeStability?.layoutSideSurface?.();
    window.DominionZoomPhysicalAcceptance?.decorateParticipantRows?.();
  }

  function schedule(){if(frame)return;frame=requestAnimationFrame(sync);}

  window.addEventListener('dominion:meeting-ui-ready',schedule,true);
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-participant-role','data-participant-self']});

  window.DominionParticipantsCenterLock2041=Object.freeze({
    version:'2.0.43-compatibility-no-geometry',
    sync,
    center:()=>window.DominionRuntimeStability?.layoutSideSurface?.(),
    dispose:()=>{observer.disconnect();window.removeEventListener('dominion:meeting-ui-ready',schedule,true);if(frame)cancelAnimationFrame(frame);}
  });
  sync();
})();
