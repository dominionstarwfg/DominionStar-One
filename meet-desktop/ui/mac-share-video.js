(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{};
  const bridge=desktop.macShare||null;
  const q=s=>document.querySelector(s);
  let cameraStream=null;
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

  async function stopCamera(){
    const video=q('#cameraPreview');
    for(const track of cameraStream?.getTracks?.()||[])try{track.stop();}catch{}
    cameraStream=null;
    if(video){video.srcObject=null;video.hidden=true;}
    q('#cameraFallback').hidden=false;
  }

  async function startCamera(){
    if(!cameraOn)return stopCamera();
    if(cameraStream?.getVideoTracks?.().some(track=>track.readyState==='live')){q('#cameraPreview').hidden=false;q('#cameraFallback').hidden=true;return;}
    try{
      cameraStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360}},audio:false});
      const video=q('#cameraPreview');video.srcObject=cameraStream;video.hidden=false;q('#cameraFallback').hidden=true;await video.play().catch(()=>{});
    }catch{await stopCamera();}
  }

  const logo=q('#brandLogo');if(logo&&desktop.brand?.logoUrl)logo.src=desktop.brand.logoUrl;
  void loadIdentity();
  bridge?.onState?.(state=>{
    cameraOn=state?.cameraOn!==false;
    const mic=q('#micState');if(mic)mic.style.color=state?.micOn===false?'#ff5668':'#9aa0a8';
    if(cameraOn)void startCamera();else void stopCamera();
  });
  window.addEventListener('beforeunload',()=>{for(const track of cameraStream?.getTracks?.()||[])try{track.stop();}catch{}});
  void startCamera();
})();
