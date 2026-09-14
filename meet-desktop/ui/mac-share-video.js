(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{};
  const bridge=desktop.macShare||null;
  const q=s=>document.querySelector(s);
  let cameraOn=true;

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

  function renderCameraOwnership(){
    const video=q('#cameraPreview');
    if(video){video.srcObject=null;video.hidden=true;}
    const fallback=q('#cameraFallback');if(fallback)fallback.hidden=false;
    const dock=q('#dock');if(dock){dock.dataset.cameraOn=cameraOn?'1':'0';dock.dataset.videoOwner='meeting-renderer';}
  }

  const logo=q('#brandLogo');if(logo&&desktop.brand?.logoUrl)logo.src=desktop.brand.logoUrl;
  void loadIdentity();
  renderCameraOwnership();
  bridge?.onState?.(state=>{
    cameraOn=state?.cameraOn!==false;
    const mic=q('#micState');if(mic)mic.style.color=state?.micOn===false?'#ff5668':'#9aa0a8';
    renderCameraOwnership();
  });
})();