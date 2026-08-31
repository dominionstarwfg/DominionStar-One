(()=>{
  if(window.DominionShareIntegration)return;
  const desktop=window.dominionDesktop||null;
  const bridge=desktop?.share||null;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const addStyle=href=>{if(document.querySelector(`link[href="${href}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);};
  const addScript=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});

  async function findMeetingSurface(){for(let i=0;i<120;i++){const overlay=document.querySelector('#meetingOverlay');if(overlay&&window.DominionMediaController)return overlay;await wait(50);}return null;}
  function toast(message,kind=''){let node=document.querySelector('#shareToast');if(!node){node=document.createElement('div');node.id='shareToast';document.body.append(node);}node.className=`share-toast ${kind}`.trim();node.textContent=String(message||'');node.hidden=false;clearTimeout(node.__timer);node.__timer=setTimeout(()=>{node.hidden=true;},6500);}
  function showScreenPermissionDialog(status='unknown',restartRequired=false){
    let dialog=document.querySelector('#screenPermissionDialog');
    if(!dialog){
      dialog=document.createElement('section');dialog.id='screenPermissionDialog';dialog.className='share-permission-dialog';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','false');
      dialog.innerHTML='<div class="share-permission-card"><div class="share-permission-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="3"/><path d="m8 11 4-4 4 4M12 7v8M8 21h8"/></svg></div><div><p>SCREEN SHARING PERMISSION</p><h3>Screen sharing was blocked by macOS</h3><span data-permission-copy>DominionStar Meet could not start a native screen capture.</span></div><div class="share-permission-actions"><button type="button" data-permission-cancel>Not now</button><button type="button" data-permission-reset>Reset & Reauthorize</button><button type="button" data-permission-open>Open System Settings</button></div></div>';
      document.body.append(dialog);
      dialog.querySelector('[data-permission-cancel]').onclick=()=>{dialog.hidden=true;};
      dialog.querySelector('[data-permission-open]').onclick=async()=>{await window.dominionDesktop?.media?.openPrivacy?.('screen').catch?.(()=>{});dialog.hidden=true;};
      dialog.querySelector('[data-permission-reset]').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await window.dominionDesktop?.app?.resetScreenPermission?.();dialog.hidden=true;await window.dominionDesktop?.media?.openPrivacy?.('screen').catch?.(()=>{});}finally{button.disabled=false;}};
    }
    const copy=dialog.querySelector('[data-permission-copy]');
    if(copy)copy.textContent=restartRequired?'macOS reports the grant, but this running process cannot use it yet. Fully restart DominionStar Meet after granting access.':`The native macOS capture request returned ${status}. Enable DominionStar Meet in Privacy & Security → Screen & System Audio Recording, then retry.`;
    dialog.hidden=false;
  }
  function isPermissionFailure(error){
    const name=String(error?.name||'').toLowerCase(),message=String(error?.message||error||'').toLowerCase();
    return name==='notallowederror'||name==='securityerror'||message.includes('permission')||message.includes('denied')||message.includes('not allowed');
  }
  async function resolveShareEntry(){
    if(!bridge)throw new Error('Screen sharing runs in the installed DominionStar Meet app.');
    // Do not preflight Screen Recording with getMediaAccessStatus/getSources.
    // On macOS 15+ Electron hands getDisplayMedia directly to Apple's system
    // content-sharing picker. Older systems receive the custom picker fallback.
    const result=await bridge.openPicker();
    if(result?.permissionRequired){showScreenPermissionDialog(String(result.status||'unknown'),Boolean(result.restartRequired));return {mode:'blocked'};}
    if(result?.nativeSystemPicker)return {mode:'native'};
    return {mode:result?.opened===false?'blocked':'custom'};
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

    let button=overlay.querySelector('#roomShare');if(!button){button=document.createElement('button');button.id='roomShare';button.className='meeting-control room-share-control';button.type='button';button.textContent='Share Screen';footer.insertBefore(button,overlay.querySelector('#roomExitButton'));}window.DominionMeetingParity?.decorateControls?.();
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
      const featureState=window.DominionMeetingFeatures?.snapshot?.()||{};void bridge?.captureState?.({paused:state.paused,micOn:mediaState.micOn,cameraOn:mediaState.cameraOn,sourceName:state.sourceName,shareAudio:Boolean(state.options?.shareAudio),optimizeVideo:Boolean(state.options?.optimizeVideo),handRaised:Boolean(featureState.handRaised),recording:Boolean(featureState.recording),recordingPaused:Boolean(featureState.recordingPaused)});
    }

    async function beginShare({replace=false}={}){
      if(!bridge){toast('Screen sharing runs in the installed DominionStar Meet app.');return false;}
      const entry=await resolveShareEntry();
      if(entry.mode==='blocked')return false;
      if(entry.mode==='custom')return true; // source-selected event completes fallback flow.
      try{
        const options={shareAudio:true,optimizeVideo:false};
        if(replace){await share.replaceSource({name:'Shared content',options});window.DominionShareAnnotation?.deactivate?.();}
        else await share.start({name:'Shared content',options});
        applyLayout();
        if(replace)toast('Screen share changed.');
        return true;
      }catch(error){
        applyLayout();
        if(isPermissionFailure(error)){
          const status=await window.dominionDesktop?.media?.requestScreen?.().catch(()=>null);
          showScreenPermissionDialog(String(status?.status||error?.name||'denied'),Boolean(status?.restartRequired));
        }else if(String(error?.name||'')!=='AbortError')toast(error?.message||'Screen sharing could not start.','error');
        return false;
      }
    }

    button.addEventListener('click',event=>{
      event.currentTarget.blur();
      if(!bridge){toast('Screen sharing runs in the installed DominionStar Meet app.');return;}
      if(share.snapshot().active){toast('A share is already active. Use the floating toolbar to pause, annotate, start a new share, or stop.');return;}
      requestAnimationFrame(()=>setTimeout(()=>{void beginShare().catch(error=>toast(error?.message||'Unable to open screen sharing.','error'));},0));
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
        if(isPermissionFailure(error))showScreenPermissionDialog(String(error?.name||'denied'),false);
        else toast(replacing?(error?.message||'The new source could not start. Your current share is still active.'):(error?.message||'Screen sharing could not start.'),'error');
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
        if(command==='new-share'){await beginShare({replace:share.snapshot().active});return;}
        if(command==='layout-speaker'){window.DominionMeetingFeatures?.setVideoLayout?.('speaker');return;}
        if(command==='layout-gallery'){window.DominionMeetingFeatures?.setVideoLayout?.('gallery');return;}
        if(command==='layout-hide'){window.DominionMeetingFeatures?.setVideoLayout?.('hide');return;}
        if(command.startsWith('reaction:')){await window.DominionMeetingFeatures?.sendReaction?.(command.slice('reaction:'.length));applyLayout();return;}
        if(command==='toggle-hand'){await window.DominionMeetingFeatures?.toggleRaiseHand?.();applyLayout();return;}
        if(command==='record'){await window.DominionMeetingFeatures?.toggleRecording?.();applyLayout();return;}
        if(command==='stop-record'){await window.DominionMeetingFeatures?.stopRecording?.();applyLayout();return;}
        if(command==='show-meeting'){window.focus();return;}
      }catch(error){toast(error?.message||'Share control failed.','error');}
    });

    window.DominionShareIntegration=Object.freeze({open:options=>beginShare(options||{}),stop:()=>share.stop(),state:()=>share.snapshot()});
  }
  void boot();
})();
