(()=>{
  if(window.DominionShareIntegration)return;
  const desktop=window.dominionDesktop||null;
  const bridge=desktop?.share||null;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const addStyle=href=>{if(document.querySelector(`link[href="${href}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);};
  const addScript=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});

  async function findMeetingSurface(){for(let i=0;i<120;i++){const overlay=document.querySelector('#meetingOverlay');if(overlay&&window.DominionMediaController)return overlay;await wait(50);}return null;}
  function toast(message,kind=''){let node=document.querySelector('#shareToast');if(!node){node=document.createElement('div');node.id='shareToast';document.body.append(node);}node.className=`share-toast ${kind}`.trim();node.textContent=String(message||'');node.hidden=false;clearTimeout(node.__timer);node.__timer=setTimeout(()=>{node.hidden=true;},4200);}

  async function boot(){
    addStyle('./share.css');
    if(!window.DominionShareController)await addScript('./share-controller.js');
    const overlay=await findMeetingSurface();
    if(!overlay)return;
    const media=window.DominionMediaController,share=window.DominionShareController;
    const footer=overlay.querySelector('.meeting-footer'),stage=overlay.querySelector('.stage'),side=overlay.querySelector('.room-side');
    if(!footer||!stage)return;

    const button=document.createElement('button');button.id='roomShare';button.className='meeting-control room-share-control';button.type='button';button.textContent='Share Screen';footer.insertBefore(button,overlay.querySelector('#roomExitButton'));
    const sharedVideo=document.createElement('video');sharedVideo.id='sharedContentVideo';sharedVideo.className='shared-content-video';sharedVideo.autoplay=true;sharedVideo.playsInline=true;sharedVideo.muted=true;sharedVideo.hidden=true;stage.append(sharedVideo);
    const label=document.createElement('div');label.id='shareStageLabel';label.className='share-stage-label';label.hidden=true;stage.append(label);
    const cameraTile=document.createElement('video');cameraTile.id='presenterCameraTile';cameraTile.className='presenter-camera-tile';cameraTile.autoplay=true;cameraTile.playsInline=true;cameraTile.muted=true;cameraTile.hidden=true;stage.append(cameraTile);

    function applyLayout(){
      const state=share.snapshot(),mediaState=media.snapshot();
      overlay.classList.toggle('share-active',state.active);
      sharedVideo.hidden=!state.active;
      label.hidden=!state.active;
      if(state.active){
        const output=share.outputStream();if(sharedVideo.srcObject!==output)sharedVideo.srcObject=output;
        label.innerHTML=`<strong>${state.paused?'Paused':'Sharing'}</strong> · ${String(state.sourceName||'Shared content').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}`;
        const local=media.stream();if(cameraTile.srcObject!==local)cameraTile.srcObject=local;cameraTile.hidden=!mediaState.videoLive;
      }else{sharedVideo.srcObject=null;cameraTile.srcObject=null;cameraTile.hidden=true;side?.classList.remove('collapsed');}
      void bridge?.captureState?.({paused:state.paused,micOn:mediaState.micOn,cameraOn:mediaState.cameraOn,sourceName:state.sourceName});
    }

    button.addEventListener('click',event=>{
      event.currentTarget.blur();
      if(!bridge){toast('Screen sharing runs in the installed DominionStar Meet app.');return;}
      if(share.snapshot().active){toast('A share is already active. Use the floating toolbar to pause or stop it.');return;}
      requestAnimationFrame(()=>setTimeout(()=>{void bridge.openPicker().catch(error=>toast(error?.message||'Unable to open screen sharing.','error'));},0));
    });

    bridge?.onSourceSelected?.(async selection=>{
      try{await share.start({name:selection?.name,options:selection?.options||{}});applyLayout();}
      catch(error){await share.stop().catch(()=>{});applyLayout();toast(error?.message||'Screen sharing could not start.','error');}
    });

    share.onChange(()=>applyLayout());
    media.onChange(()=>{if(share.snapshot().active)applyLayout();});

    bridge?.onPresenterCommand?.(async command=>{
      try{
        if(command==='pause'){await share.togglePause(sharedVideo);applyLayout();return;}
        if(command==='stop'){await share.stop();applyLayout();return;}
        if(command==='audio'){await media.setMicrophone(!media.snapshot().micOn);applyLayout();return;}
        if(command==='video'){await media.setCamera(!media.snapshot().cameraOn);applyLayout();return;}
        if(command==='participants'){side?.classList.toggle('collapsed');return;}
        if(command==='show-meeting'){window.focus();return;}
      }catch(error){toast(error?.message||'Share control failed.','error');}
    });

    window.DominionShareIntegration=Object.freeze({open:()=>bridge?.openPicker?.(),stop:()=>share.stop(),state:()=>share.snapshot()});
  }
  void boot();
})();
