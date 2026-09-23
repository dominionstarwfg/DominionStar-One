(()=>{
  'use strict';
  if(window.DominionActiveShareHomeParity2041)return;
  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s);
  let syncFrame=0,lastActive=false;

  function ensureStyle(){
    if(q('style[data-ds-active-share-home-2041]'))return;
    const style=document.createElement('style');style.dataset.dsActiveShareHome2041='1';style.textContent=`
      body.ds-active-share-workspace #homeSection .action-card.ds-back-to-meeting .action-icon{background:#ff6b2c!important}
      body.ds-active-share-workspace #homeSection .action-card.ds-active-meeting-disabled{opacity:.38!important;pointer-events:none!important;filter:saturate(.45)}
      body.ds-active-share-workspace #homeSection:after{content:'You are screen sharing';position:absolute;left:50%;top:67px;transform:translateX(-50%);height:24px;padding:0 12px;border-radius:0 0 6px 6px;background:#23c968;color:#07150d;display:flex;align-items:center;font-size:10px;font-weight:700;z-index:12;box-shadow:0 5px 14px rgba(0,0,0,.22)}
    `;document.head.append(style);
  }

  function primeParticipantsReference(){
    const controller=window.DominionZoomParticipantsReference2041;
    if(!controller)return;
    try{controller.sync?.();}catch{}
    try{window.DominionRuntimeStability?.retireBackgroundReconcilers?.();}catch{}
    try{window.DominionRuntimeStability?.sync?.();}catch{}
  }
  function loadParticipantsReference(){
    if(window.DominionZoomParticipantsReference2041){primeParticipantsReference();return;}
    const existing=document.querySelector('script[data-ds-zoom-participants-reference-2041]');
    if(existing){existing.addEventListener('load',primeParticipantsReference,{once:true});return;}
    const script=document.createElement('script');script.src='./zoom-participants-reference-2.0.41.js';script.dataset.dsZoomParticipantsReference2041='1';script.addEventListener('load',primeParticipantsReference,{once:true});document.head.append(script);
  }

  function shareActive(){return Boolean(q('#meetingOverlay')?.classList.contains('share-active'));}
  function restoreMeeting(){
    const overlay=q('#meetingOverlay');if(!overlay)return false;
    q('#appShell')?.setAttribute('hidden','');q('#waitingOverlay')?.setAttribute('hidden','');q('#prejoinOverlay')?.setAttribute('hidden','');overlay.hidden=false;
    try{window.DominionMeetingParity?.install?.();window.DominionMeetingParity?.syncShareLayout?.();window.DominionMeetingParity?.syncVideoDock?.();window.DominionZoomScreenshotReference?.requestSync?.();primeParticipantsReference();}catch{}
    return true;
  }

  function patchHome(active){
    const back=q('#homeSection .action-card.new-meeting'),join=q('#homeSection .action-card.join'),share=q('#homeSection .action-card.share');
    if(!back)return;
    if(!back.dataset.dsOriginalHtml)back.dataset.dsOriginalHtml=back.innerHTML;
    if(active){
      back.dataset.action='back-to-meeting';back.classList.add('ds-back-to-meeting');
      back.innerHTML='<span class="action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6 4 12l6 6M4 12h10a6 6 0 0 1 6 6"/></svg></span><strong>Back to meeting</strong><small>Return to active meeting</small>';
      for(const node of [join,share]){if(node){node.disabled=true;node.classList.add('ds-active-meeting-disabled');}}
    }else{
      if(back.dataset.dsOriginalHtml)back.innerHTML=back.dataset.dsOriginalHtml;back.dataset.action='new-meeting';back.classList.remove('ds-back-to-meeting');
      for(const node of [join,share]){if(node){node.disabled=false;node.classList.remove('ds-active-meeting-disabled');}}
    }
  }

  function sync(){syncFrame=0;ensureStyle();loadParticipantsReference();const active=shareActive();document.body.classList.toggle('ds-active-share-workspace',active);if(active!==lastActive){lastActive=active;patchHome(active);}else if(active&&q('#homeSection .action-card.new-meeting')?.dataset.action!=='back-to-meeting')patchHome(true);}
  function schedule(){if(syncFrame)return;syncFrame=requestAnimationFrame(sync);}

  document.addEventListener('click',event=>{const back=event.target?.closest?.('#homeSection .action-card[data-action="back-to-meeting"]');if(!back)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();restoreMeeting();},true);
  desktop.macShare?.onShowMeeting?.(()=>restoreMeeting());
  window.addEventListener('dominion:share-state',schedule,true);
  window.addEventListener('dominion:meeting-ended',()=>{lastActive=false;document.body.classList.remove('ds-active-share-workspace');patchHome(false);},true);
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','hidden'],childList:true});
  const timer=setInterval(schedule,650);
  window.DominionActiveShareHomeParity2041=Object.freeze({version:'2.0.41',sync,restoreMeeting,dispose:()=>{clearInterval(timer);observer.disconnect();if(syncFrame)cancelAnimationFrame(syncFrame);}});
  loadParticipantsReference();
  sync();
})();
