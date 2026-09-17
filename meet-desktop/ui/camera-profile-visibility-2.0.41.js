(()=>{
  'use strict';
  if(window.DominionCameraProfileVisibility2041)return;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const media=window.DominionMediaController;
  if(!media)return;

  let headObserver=null;

  function ensureStyles(){
    if(q('style[data-ds-camera-profile-visibility-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsCameraProfileVisibility2041='1';
    style.textContent=`
      #prejoinVideo[hidden],#localMeetingVideo[hidden],#prejoinAvatar[hidden],#stageFallback[hidden]{display:none!important}
      #prejoinVideo:not([hidden]),#localMeetingVideo:not([hidden]){display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;height:100%!important;object-fit:cover!important;position:relative!important;z-index:2!important;background:#020812!important}
      #prejoinAvatar:not([hidden]){display:grid!important;visibility:visible!important;opacity:1!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;place-items:center!important;overflow:hidden!important;background:radial-gradient(circle at 50% 42%,#10233a 0,#07111d 52%,#020812 100%)!important;z-index:1!important}
      #prejoinAvatar:not([hidden])>img.ds-profile-fallback-photo{display:block!important;width:180px!important;height:180px!important;min-width:180px!important;min-height:180px!important;max-width:min(42%,180px)!important;max-height:min(72%,180px)!important;aspect-ratio:1/1!important;border-radius:26px!important;object-fit:cover!important;box-shadow:0 14px 46px rgba(0,0,0,.42)!important}
      #prejoinAvatar:not([hidden]):not(.has-photo){font-size:54px!important;font-weight:700!important}
      #stageFallback:not([hidden]){display:grid!important}
      #stageFallback:not([hidden]) #stageAvatar.has-photo{width:132px!important;height:132px!important;overflow:hidden!important;border-radius:22px!important}
      #stageFallback:not([hidden]) #stageAvatar.has-photo>img.ds-profile-fallback-photo{width:100%!important;height:100%!important;object-fit:cover!important}
    `;
    document.head.append(style);
  }

  function liveVideoState(){
    const snapshot=media.snapshot?.()||{};
    const stream=media.stream?.()||null;
    const track=stream?.getVideoTracks?.().find(t=>t.readyState==='live'&&t.enabled!==false)||null;
    return {snapshot,stream,track,live:Boolean(snapshot.cameraOn&&track)};
  }

  function playVideo(video,stream,track){
    if(!video||!stream)return;
    video.muted=true;video.playsInline=true;video.autoplay=true;
    const trackId=String(track?.id||'');
    if(video.srcObject!==stream||video.dataset.dsVideoTrackId!==trackId){
      try{video.pause?.();}catch{}
      try{video.srcObject=null;}catch{}
      video.srcObject=stream;
      video.dataset.dsVideoTrackId=trackId;
    }
    const attempt=()=>{try{const p=video.play?.();if(p&&typeof p.catch==='function')p.catch(()=>{});}catch{}};
    attempt();
    if(video.readyState<2){video.onloadedmetadata=attempt;video.oncanplay=attempt;}
  }

  function encryptionCandidates(){
    const head=q('#meetingOverlay .meeting-head')||q('.meeting-head');
    if(!head)return [];
    const leaves=[...head.querySelectorAll('*')].filter(el=>el.isConnected&&!el.hidden&&String(el.textContent||'').trim()==='Encrypted'&&![...el.children].some(child=>String(child.textContent||'').trim()==='Encrypted'));
    const roots=[];
    for(const leaf of leaves){
      let root=leaf;
      while(root.parentElement&&root.parentElement!==head){
        const parent=root.parentElement;
        const text=String(parent.textContent||'').trim();
        if(text!=='Encrypted')break;
        root=parent;
      }
      if(!roots.includes(root))roots.push(root);
    }
    return roots;
  }

  function dedupeEncryption(){
    const badges=encryptionCandidates();
    if(!badges.length)return;
    const keep=badges.find(el=>el.dataset.dsCanonicalEncryption==='1')||badges.find(el=>String(el.textContent||'').trim()==='Encrypted')||badges[0];
    keep.dataset.dsCanonicalEncryption='1';
    keep.hidden=false;
    keep.setAttribute('aria-label','Encrypted');
    for(const badge of badges){if(badge!==keep)badge.remove();}
  }

  function sync(){
    ensureStyles();
    const {stream,track,live}=liveVideoState();
    const preVideo=q('#prejoinVideo'),roomVideo=q('#localMeetingVideo'),preAvatar=q('#prejoinAvatar'),stageFallback=q('#stageFallback');
    const hideSelf=Boolean(window.DominionPreferences?.read?.('hideSelfView'));

    if(live){
      playVideo(preVideo,stream,track);playVideo(roomVideo,stream,track);
    }else{
      for(const video of [preVideo,roomVideo]){if(!video)continue;try{video.pause?.();}catch{}}
    }

    if(preVideo){preVideo.hidden=!live;preVideo.setAttribute('aria-hidden',live?'false':'true');}
    if(preAvatar){preAvatar.hidden=live;preAvatar.setAttribute('aria-hidden',live?'true':'false');}
    if(roomVideo){roomVideo.hidden=!live||hideSelf;roomVideo.setAttribute('aria-hidden',(!live||hideSelf)?'true':'false');}
    if(stageFallback){stageFallback.hidden=live&&!hideSelf;stageFallback.setAttribute('aria-hidden',(live&&!hideSelf)?'true':'false');}
    dedupeEncryption();
  }

  function bindHeadObserver(){
    const head=q('#meetingOverlay .meeting-head')||q('.meeting-head');
    if(!head||headObserver)return;
    headObserver=new MutationObserver(()=>dedupeEncryption());
    headObserver.observe(head,{childList:true,subtree:true});
    dedupeEncryption();
  }

  let timer=0;
  const schedule=()=>{if(timer)return;timer=setTimeout(()=>{timer=0;sync();bindHeadObserver();},0);};
  const unbind=typeof media.onChange==='function'?media.onChange(schedule):()=>{};
  for(const name of ['dominion:meeting-ui-ready','dominion:preference-change','dominion:meeting-ended','dominion:meeting-snapshot'])window.addEventListener(name,schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  ensureStyles();schedule();
  window.DominionCameraProfileVisibility2041=Object.freeze({version:'2.0.41',sync,dedupeEncryption,dispose(){try{unbind();}catch{}headObserver?.disconnect();headObserver=null;}});
})();