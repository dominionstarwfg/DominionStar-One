(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{};
  const bridge=desktop.macShare||null;
  const q=s=>document.querySelector(s);
  let cameraOn=true,lastFrame='',mirrored=true;

  const initials=name=>String(name||'DominionStar').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'DS';
  const avatarFrom=user=>String(user?.avatarUrl||user?.avatar_url||user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'');

  async function loadIdentity(){
    try{
      const state=await desktop.auth?.getState?.();
      const user=state?.user||{};
      const name=String(user?.displayName||user?.name||user?.full_name||user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email||'You').trim();
      q('#displayName').textContent=name||'You';
      q('#profileInitials').textContent=initials(name);
      const avatar=avatarFrom(user);if(avatar)q('#profileImage').src=avatar;
    }catch{}
  }

  function render(){
    const mirror=q('#cameraMirror'),fallback=q('#cameraFallback'),dock=q('#dock');
    const showLive=Boolean(cameraOn&&lastFrame);
    if(mirror){
      if(lastFrame&&mirror.src!==lastFrame)mirror.src=lastFrame;
      mirror.hidden=!showLive;
      mirror.style.transform=mirrored?'scaleX(-1)':'none';
    }
    if(fallback)fallback.hidden=showLive;
    if(dock){dock.dataset.cameraOn=cameraOn?'1':'0';dock.dataset.videoOwner='meeting-renderer-frame-mirror';dock.dataset.livePreview=showLive?'1':'0';}
  }

  void loadIdentity();
  render();
  bridge?.onVideoFrame?.(payload=>{
    const live=payload?.cameraLive!==false&&Boolean(payload?.frame);
    lastFrame=live?String(payload.frame):'';
    mirrored=payload?.mirrored!==false;
    render();
  });
  bridge?.onState?.(state=>{
    cameraOn=state?.cameraOn!==false;
    if(!cameraOn)lastFrame='';
    const mic=q('#micState');if(mic){mic.style.color=state?.micOn===false?'#ff3b30':'#31d158';mic.title=state?.micOn===false?'Muted':'Microphone on';}
    render();
  });
})();