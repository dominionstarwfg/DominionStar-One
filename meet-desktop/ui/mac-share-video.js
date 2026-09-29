(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{};
  const bridge=desktop.macShare||null;
  const q=s=>document.querySelector(s);

  let cameraOn=true;
  let micOn=false;
  let cameraId='';
  let mirrored=true;
  let previewStream=null;
  let previewLive=false;
  let previewGeneration=0;
  let qaInteractionFixtures=false;
  let qaCanvasTimer=0;

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

  const stopTracks=stream=>{for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}};

  function stopQaCanvas(){
    if(qaCanvasTimer){clearInterval(qaCanvasTimer);qaCanvasTimer=0;}
  }

  function stopPreview(){
    previewGeneration+=1;
    stopQaCanvas();
    stopTracks(previewStream);
    previewStream=null;
    previewLive=false;
    const video=q('#cameraPreview');
    if(video){try{video.pause();}catch{}video.srcObject=null;}
  }

  function render(){
    const video=q('#cameraPreview'),fallback=q('#cameraFallback'),pending=q('#cameraPending'),dock=q('#dock');
    const showLive=Boolean(cameraOn&&previewLive);
    if(video){
      video.hidden=!showLive;
      video.style.transform=mirrored?'scaleX(-1)':'none';
    }
    // Profile identity is strictly camera-off state. When the camera is on but
    // the preview is still opening, keep a neutral live-camera surface instead
    // of lying to the user with a profile fallback.
    if(fallback)fallback.hidden=Boolean(cameraOn);
    if(pending)pending.hidden=!Boolean(cameraOn&&!previewLive);
    if(dock){
      dock.dataset.cameraOn=cameraOn?'1':'0';
      dock.dataset.videoOwner='presenter-device-preview';
      dock.dataset.livePreview=showLive?'1':'0';
    }
  }

  function makeQaPreviewStream(){
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
    const context=canvas.getContext('2d',{alpha:false});
    const paint=()=>{
      context.fillStyle='#112a3f';context.fillRect(0,0,canvas.width,canvas.height);
      context.fillStyle='#f0c769';context.beginPath();context.arc(320,180,92,0,Math.PI*2);context.fill();
      context.fillStyle='#fff';context.font='600 24px -apple-system,BlinkMacSystemFont,sans-serif';context.textAlign='center';
      context.fillText('LIVE CAMERA',320,188);
    };
    paint();qaCanvasTimer=setInterval(paint,250);
    return canvas.captureStream(8);
  }

  async function openPreview(){
    const generation=++previewGeneration;
    if(!cameraOn){stopPreview();render();return;}

    let stream=null;
    try{
      if(qaInteractionFixtures){
        stream=makeQaPreviewStream();
      }else{
        const video={
          width:{ideal:640},
          height:{ideal:360},
          frameRate:{ideal:15,max:20}
        };
        if(cameraId)video.deviceId={ideal:cameraId};
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video});
      }

      if(generation!==previewGeneration||!cameraOn){stopTracks(stream);return;}
      const track=stream?.getVideoTracks?.()[0]||null;
      if(!track)throw new Error('presenter_camera_track_unavailable');

      previewStream=stream;
      const video=q('#cameraPreview');
      if(video){
        video.srcObject=stream;
        try{await video.play();}catch{}
      }
      if(generation!==previewGeneration||!cameraOn){stopPreview();return;}

      previewLive=true;
      track.addEventListener('ended',()=>{
        if(generation!==previewGeneration)return;
        previewLive=false;previewStream=null;render();
        if(cameraOn)setTimeout(()=>{if(generation===previewGeneration&&cameraOn)void openPreview();},300);
      },{once:true});
      render();
    }catch(error){
      stopTracks(stream);
      if(generation!==previewGeneration)return;
      previewStream=null;previewLive=false;render();
      console.error('[DominionStar Meet] Presenter camera preview unavailable.',error);
    }
  }

  function syncPreview(){
    if(!cameraOn){stopPreview();render();return;}
    const track=previewStream?.getVideoTracks?.()[0]||null;
    const actualId=String(track?.getSettings?.().deviceId||'');
    if(track&&track.readyState==='live'&&(!cameraId||!actualId||actualId===cameraId)){
      previewLive=true;render();return;
    }
    stopPreview();
    void openPreview();
  }

  const menu=q('#videoMoreMenu'),menuButton=q('#videoMoreButton');
  function closeMenu(){if(menu)menu.hidden=true;if(menuButton)menuButton.setAttribute('aria-expanded','false');}
  function toggleMenu(){
    if(!menu||!menuButton)return;
    menu.hidden=!menu.hidden;menuButton.setAttribute('aria-expanded',String(!menu.hidden));
  }
  async function presenterCommand(command){
    try{
      const result=await bridge?.command?.(String(command||''));
      if(result?.ok===false)throw new Error(result?.error||'presenter_command_failed');
      return true;
    }catch(error){console.error('[DominionStar Meet] Presenter video command failed.',error);return false;}
  }
  menuButton?.addEventListener('click',event=>{event.stopPropagation();toggleMenu();});
  q('#videoMenuAudio')?.addEventListener('click',async()=>{closeMenu();await presenterCommand(micOn?'audio-off':'audio-on');});
  q('#videoMenuCamera')?.addEventListener('click',async()=>{closeMenu();await presenterCommand(cameraOn?'video-off':'video-on');});
  q('#videoMenuSpeaker')?.addEventListener('click',async()=>{closeMenu();await presenterCommand('layout-speaker');});
  q('#videoMenuGallery')?.addEventListener('click',async()=>{closeMenu();await presenterCommand('layout-gallery');});
  q('#videoMenuHide')?.addEventListener('click',async()=>{closeMenu();await presenterCommand('layout-hide');});
  document.addEventListener('pointerdown',event=>{if(!event.target?.closest?.('#videoMoreButton,#videoMoreMenu'))closeMenu();},true);
  window.addEventListener('mouseleave',()=>closeMenu(),{passive:true});
  window.addEventListener('blur',()=>closeMenu());
  window.addEventListener('pagehide',()=>{closeMenu();stopPreview();},{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)closeMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});

  async function boot(){
    try{
      const environment=await desktop.environment?.();
      qaInteractionFixtures=Boolean(environment?.qaPresenterFixtures||environment?.qaInteractionFixtures);
    }catch{}
    await loadIdentity();
    render();
    syncPreview();
  }

  bridge?.onState?.(state=>{
    const nextCameraOn=state?.cameraOn!==false;
    micOn=state?.micOn!==false;
    const nextCameraId=String(state?.cameraId||'');
    const nextMirror=state?.mirror!==false;
    const deviceChanged=nextCameraId!==cameraId;
    const cameraChanged=nextCameraOn!==cameraOn;
    cameraOn=nextCameraOn;cameraId=nextCameraId;mirrored=nextMirror;

    const mic=q('#micState');
    if(mic){
      const voiceLevel=Math.max(0,Math.min(1,Number(state?.voiceLevel)||0));
      const speaking=Boolean(micOn&&state?.speaking&&voiceLevel>0);
      const voiceBucket=!speaking?0:voiceLevel>.55?3:voiceLevel>.22?2:1;
      mic.dataset.voiceLevel=String(voiceBucket);
      mic.classList.toggle('speaking',speaking);
      mic.classList.toggle('muted',!micOn);
      mic.title=!micOn?'Muted':speaking?'Speaking':'Microphone on';
    }
    const audioAction=q('#videoMenuAudio'),cameraAction=q('#videoMenuCamera');
    if(audioAction)audioAction.textContent=micOn?'Mute':'Unmute';
    if(cameraAction)cameraAction.textContent=cameraOn?'Stop Video':'Start Video';

    if(cameraChanged||deviceChanged)syncPreview();
    else render();
  });

  window.addEventListener('beforeunload',stopPreview,{once:true});
  window.addEventListener('unload',stopPreview,{once:true});
  void boot();
})();