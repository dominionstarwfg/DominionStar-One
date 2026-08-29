(()=>{
  if(window.DominionShareIntegration)return;
  const desktop=window.dominionDesktop||null;
  const bridge=desktop?.share||null;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const addStyle=href=>{if(document.querySelector(`link[href="${href}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);};
  const addScript=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});

  async function findMeetingSurface(){for(let i=0;i<120;i++){const overlay=document.querySelector('#meetingOverlay');if(overlay&&window.DominionMediaController)return overlay;await wait(50);}return null;}
  function toast(message,kind=''){let node=document.querySelector('#shareToast');if(!node){node=document.createElement('div');node.id='shareToast';document.body.append(node);}node.className=`share-toast ${kind}`.trim();node.textContent=String(message||'');node.hidden=false;clearTimeout(node.__timer);node.__timer=setTimeout(()=>{node.hidden=true;},6500);}
  async function openPickerWithPermission(){
    if(!bridge)throw new Error('Screen sharing runs in the installed DominionStar Meet app.');
    const result=await bridge.openPicker();
    if(result?.permissionRequired){
      const status=String(result.status||'unknown');
      const restart=result.restartRequired?' Restart DominionStar Meet after granting access.':'';
      toast(`macOS Screen Recording permission is ${status}. Allow DominionStar Meet in Privacy & Security > Screen & System Audio Recording.${restart}`,'error');
      return false;
    }
    return result?.opened!==false;
  }

  async function boot(){
    addStyle('./share.css');
    if(!window.DominionShareController)await addScript('./share-controller.js');
    if(!window.DominionShareAnnotation)await addScript('./share-annotation.js');
    const overlay=await findMeetingSurface();
    if(!overlay)return;
    const media=window.DominionMediaController,share=window.DominionShareController;
    const footer=overlay.querySelector('.meeting-footer'),stage=overlay.querySelector('.stage');
    if(!footer||!stage)return;

    let button=overlay.querySelector('#roomShare');if(!button){button=document.createElement('button');button.id='roomShare';button.className='meeting-control room-share-control';button.type='button';button.textContent='Share Screen';footer.insertBefore(button,overlay.querySelector('#roomExitButton'));}
    let sharedVideo=stage.querySelector('#sharedContentVideo');if(!sharedVideo){sharedVideo=document.createElement('video');sharedVideo.id='sharedContentVideo';sharedVideo.className='shared-content-video';sharedVideo.autoplay=true;sharedVideo.playsInline=true;sharedVideo.muted=true;sharedVideo.hidden=true;stage.append(sharedVideo);}
    let label=stage.querySelector('#shareStageLabel');if(!label){label=document.createElement('div');label.id='shareStageLabel';label.className='share-stage-label';label.hidden=true;stage.append(label);}
    let cameraTile=stage.querySelector('#presenterCameraTile');if(!cameraTile){cameraTile=document.createElement('video');cameraTile.id='presenterCameraTile';cameraTile.className='presenter-camera-tile';cameraTile.autoplay=true;cameraTile.playsInline=true;cameraTile.muted=true;cameraTile.hidden=true;stage.append(cameraTile);}

    function applyLayout(){
      const state=share.snapshot(),mediaState=media.snapshot();
      overlay.classList.toggle('share-active',state.active);
      sharedVideo.hidden=!state.active;
      label.hidden=!state.active;
      if(state.active){
        const output=share.outputStream();if(sharedVideo.srcObject!==output)sharedVideo.srcObject=output;
        label.innerHTML=`<strong>${state.paused?'Paused':state.annotating?'Annotating':'Sharing'}</strong> · ${String(state.sourceName||'Shared content').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}`;
        const local=media.stream();if(cameraTile.srcObject!==local)cameraTile.srcObject=local;cameraTile.hidden=!mediaState.videoLive;
      }else{sharedVideo.srcObject=null;cameraTile.srcObject=null;cameraTile.hidden=true;window.DominionShareAnnotation?.deactivate?.();}
      window.DominionMeetingParity?.syncVideoDock?.();
      void bridge?.captureState?.({paused:state.paused,micOn:mediaState.micOn,cameraOn:mediaState.cameraOn,sourceName:state.sourceName,shareAudio:Boolean(state.options?.shareAudio),optimizeVideo:Boolean(state.options?.optimizeVideo)});
    }

    button.addEventListener('click',event=>{
      event.currentTarget.blur();
      if(!bridge){toast('Screen sharing runs in the installed DominionStar Meet app.');return;}
      if(share.snapshot().active){toast('A share is already active. Use the floating toolbar to pause, annotate, start a new share, or stop.');return;}
      requestAnimationFrame(()=>setTimeout(()=>{void openPickerWithPermission().catch(error=>toast(error?.message||'Unable to open screen sharing.','error'));},0));
    });

    bridge?.onSourceSelected?.(async selection=>{
      const replacing=share.snapshot().active;
      try{
        if(replacing){await share.replaceSource({name:selection?.name,options:selection?.options||{}});window.DominionShareAnnotation?.deactivate?.();}
        else await share.start({name:selection?.name,options:selection?.options||{}});
        applyLayout();
        if(replacing)toast(`Now sharing ${String(selection?.name||'new source')}`);
      } catch(error){
        applyLayout();
        toast(replacing?(error?.message||'The new source could not start. Your current share is still active.'):(error?.message||'Screen sharing could not start.'),'error');
      }
    });

    share.onChange(()=>applyLayout());
    media.onChange(()=>{if(share.snapshot().active)applyLayout();});

    bridge?.onPresenterCommand?.(async rawCommand=>{
      const command=String(rawCommand||'');
      try{
        if(command==='pause'){await share.togglePause(sharedVideo);applyLayout();return;}
        if(command==='stop'){await share.stop();applyLayout();return;}
        if(command==='audio'){await media.setMicrophone(!media.snapshot().micOn);applyLayout();return;}
        if(command==='video'){await media.setCamera(!media.snapshot().cameraOn);applyLayout();return;}
        if(command==='participants'){window.DominionMeetingParity?.toggleParticipants?.();return;}
        if(command==='chat'){window.DominionMeetingFeatures?.toggleChat?.();return;}
        if(command==='annotate'){window.DominionShareAnnotation?.toggle?.();applyLayout();return;}
        if(command==='new-share'){await openPickerWithPermission();return;}
        if(command==='layout-speaker'){window.DominionMeetingFeatures?.setVideoLayout?.('speaker');return;}
        if(command==='layout-gallery'){window.DominionMeetingFeatures?.setVideoLayout?.('gallery');return;}
        if(command==='layout-hide'){window.DominionMeetingFeatures?.setVideoLayout?.('hide');return;}
        if(command.startsWith('reaction:')){await window.DominionMeetingFeatures?.sendReaction?.(command.slice('reaction:'.length));return;}
        if(command==='show-meeting'){window.focus();return;}
      }catch(error){toast(error?.message||'Share control failed.','error');}
    });

    window.DominionShareIntegration=Object.freeze({open:()=>openPickerWithPermission(),stop:()=>share.stop(),state:()=>share.snapshot()});
  }
  void boot();
})();
