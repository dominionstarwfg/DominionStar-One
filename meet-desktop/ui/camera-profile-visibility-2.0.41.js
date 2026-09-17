(()=>{
  'use strict';
  if(window.DominionCameraProfileVisibility2041)return;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const media=window.DominionMediaController;
  if(!media)return;

  let qualityTrack=null,qualityPending=false,headObserver=null;

  function ensureStyles(){
    if(q('style[data-ds-camera-profile-visibility-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsCameraProfileVisibility2041='1';
    style.textContent=`
      #prejoinVideo[hidden],#localMeetingVideo[hidden],#prejoinAvatar[hidden],#stageFallback[hidden]{display:none!important}
      #prejoinVideo:not([hidden]),#localMeetingVideo:not([hidden]){display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;height:100%!important;object-fit:cover!important;position:relative!important;z-index:2!important;background:#020812!important}
      #prejoinAvatar:not([hidden]){display:grid!important;visibility:visible!important;opacity:1!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;place-items:center!important;overflow:hidden!important;background:radial-gradient(circle at 50% 42%,#10233a 0,#07111d 52%,#020812 100%)!important;z-index:1!important}
      #prejoinAvatar:not([hidden])>img.ds-profile-fallback-photo{display:block!important;width:min(40%,240px)!important;height:auto!important;max-width:240px!important;max-height:78%!important;aspect-ratio:1/1!important;border-radius:22px!important;object-fit:cover!important;box-shadow:0 12px 42px rgba(0,0,0,.38)!important}
      #prejoinAvatar:not([hidden]):not(.has-photo){font-size:42px!important;font-weight:700!important}
      #stageFallback:not([hidden]){display:grid!important}
      #stageFallback:not([hidden]) #stageAvatar.has-photo{width:124px!important;height:124px!important;overflow:hidden!important;border-radius:22px!important}
      #stageFallback:not([hidden]) #stageAvatar.has-photo>img.ds-profile-fallback-photo{width:100%!important;height:100%!important;object-fit:cover!important}
    `;
    document.head.append(style);
  }

  function liveVideoState(){
    const snapshot=media.snapshot?.()||{};
    const stream=media.stream?.()||null;
    const track=stream?.getVideoTracks?.().find(t=>t.readyState==='live'&&t.enabled!==false)||null;
    return {snapshot,stream,track,live:Boolean(snapshot.cameraOn&&snapshot.videoLive&&track)};
  }

  async function requestBestCameraQuality(track){
    if(!track||track===qualityTrack||qualityPending||typeof track.applyConstraints!=='function')return;
    qualityTrack=track;qualityPending=true;
    try{
      const caps=track.getCapabilities?.()||{};
      const maxW=Number(caps.width?.max)||1920,maxH=Number(caps.height?.max)||1080,maxF=Number(caps.frameRate?.max)||30;
      const width=Math.min(1920,maxW),height=Math.min(1080,maxH),fps=Math.min(30,maxF);
      await track.applyConstraints({width:{ideal:width},height:{ideal:height},frameRate:{ideal:fps,max:fps}});
      const settings=track.getSettings?.()||{};
      document.documentElement.dataset.dsCameraWidth=String(settings.width||width);
      document.documentElement.dataset.dsCameraHeight=String(settings.height||height);
      document.documentElement.dataset.dsCameraFps=String(Math.round(settings.frameRate||fps));
    }catch{
      try{await track.applyConstraints({width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}});}catch{}
    }finally{qualityPending=false;}
  }

  function playVideo(video,stream){
    if(!video)return;
    video.muted=true;video.playsInline=true;video.autoplay=true;
    if(video.srcObject!==stream)video.srcObject=stream;
    const attempt=()=>{try{const p=video.play?.();if(p&&typeof p.catch==='function')p.catch(()=>{});}catch{}};
    attempt();
    if(video.readyState<2){video.onloadedmetadata=attempt;video.oncanplay=attempt;}
  }

  function sync(){
    ensureStyles();
    const {stream,track,live}=liveVideoState();
    const preVideo=q('#prejoinVideo'),roomVideo=q('#localMeetingVideo'),preAvatar=q('#prejoinAvatar'),stageFallback=q('#stageFallback');
    const hideSelf=Boolean(window.DominionPreferences?.read?.('hideSelfView'));

    if(live){
      void requestBestCameraQuality(track);
      playVideo(preVideo,stream);playVideo(roomVideo,stream);
    }else{
      for(const video of [preVideo,roomVideo]){if(!video)continue;try{video.pause?.();}catch{}}
    }

    if(preVideo){preVideo.hidden=!live;preVideo.setAttribute('aria-hidden',live?'false':'true');}
    if(preAvatar){preAvatar.hidden=live;preAvatar.setAttribute('aria-hidden',live?'true':'false');}
    if(roomVideo){roomVideo.hidden=!live||hideSelf;roomVideo.setAttribute('aria-hidden',(!live||hideSelf)?'true':'false');}
    if(stageFallback){stageFallback.hidden=live&&!hideSelf;stageFallback.setAttribute('aria-hidden',(live&&!hideSelf)?'true':'false');}
    dedupeEncryption();
  }

  function encryptionBadges(){
    const root=q('#meetingOverlay')||document;
    return qa('#meetingOverlay *').filter(el=>{
      if(!el.isConnected||el.hidden)return false;
      if(String(el.textContent||'').trim()!=='Encrypted')return false;
      return ![...el.children].some(child=>String(child.textContent||'').trim()==='Encrypted');
    });
  }

  function dedupeEncryption(){
    const badges=encryptionBadges();
    if(badges.length<2)return;
    const keep=badges.find(el=>el.dataset.dsCanonicalEncryption==='1')||badges[0];
    keep.dataset.dsCanonicalEncryption='1';
    for(const badge of badges){if(badge!==keep)badge.remove();}
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