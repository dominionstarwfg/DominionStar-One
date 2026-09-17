(()=>{
  'use strict';
  if(window.DominionCameraProfileVisibility2041)return;
  const q=s=>document.querySelector(s);
  const media=window.DominionMediaController;
  if(!media)return;

  function ensureStyles(){
    if(q('style[data-ds-camera-profile-visibility-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsCameraProfileVisibility2041='1';
    style.textContent=`
      #prejoinVideo[hidden],#localMeetingVideo[hidden],#prejoinAvatar[hidden],#stageFallback[hidden]{display:none!important}
      #prejoinVideo:not([hidden]){display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;height:100%!important;object-fit:cover!important}
      #localMeetingVideo:not([hidden]){display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;height:100%!important;object-fit:cover!important}
      #prejoinAvatar:not([hidden]){display:grid!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border-radius:0!important;place-items:center!important;overflow:hidden!important;background:#07111d!important;z-index:1!important}
      #prejoinAvatar:not([hidden]).has-photo{padding:0!important}
      #prejoinAvatar:not([hidden])>img.ds-profile-fallback-photo{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;border-radius:0!important;object-fit:cover!important}
      #stageFallback:not([hidden]){display:grid!important}
      #stageFallback:not([hidden]) #stageAvatar.has-photo{width:124px!important;height:124px!important;overflow:hidden!important;border-radius:22px!important}
      #stageFallback:not([hidden]) #stageAvatar.has-photo>img.ds-profile-fallback-photo{width:100%!important;height:100%!important;object-fit:cover!important}
    `;
    document.head.append(style);
  }

  function sync(){
    ensureStyles();
    const snapshot=media.snapshot?.()||{};
    const stream=media.stream?.()||null;
    const live=Boolean(snapshot.videoLive&&stream?.getVideoTracks?.().some(track=>track.readyState==='live'&&track.enabled!==false));
    const preVideo=q('#prejoinVideo'),roomVideo=q('#localMeetingVideo'),preAvatar=q('#prejoinAvatar'),stageFallback=q('#stageFallback');
    const hideSelf=Boolean(window.DominionPreferences?.read?.('hideSelfView'));

    for(const video of [preVideo,roomVideo]){
      if(!video)continue;
      if(video.srcObject!==stream)video.srcObject=stream;
      if(live){void video.play?.().catch?.(()=>{});}else{try{video.pause?.();}catch{}}
    }

    if(preVideo)preVideo.hidden=!live;
    if(preAvatar)preAvatar.hidden=live;
    if(roomVideo)roomVideo.hidden=!live||hideSelf;
    if(stageFallback)stageFallback.hidden=live&&!hideSelf;
  }

  let timer=0;
  const schedule=()=>{if(timer)return;timer=setTimeout(()=>{timer=0;sync();},0);};
  const unbind=typeof media.onChange==='function'?media.onChange(schedule):()=>{};
  window.addEventListener('dominion:meeting-ui-ready',schedule);
  window.addEventListener('dominion:preference-change',schedule);
  window.addEventListener('dominion:meeting-ended',schedule);
  ensureStyles();schedule();
  window.DominionCameraProfileVisibility2041=Object.freeze({version:'2.0.41',sync,dispose:unbind});
})();
