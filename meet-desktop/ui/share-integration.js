(()=>{
  if(window.DominionShareIntegration||window.__DominionShareIntegrationBooting)return;
  window.__DominionShareIntegrationBooting=true;
  const desktop=window.dominionDesktop||null;
  const bridge=desktop?.share||null;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2';
  let companionKind='';
  const addStyle=href=>{if(document.querySelector(`link[href="${href}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);};
  const addScript=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});

  async function findMeetingSurface(){for(let i=0;i<120;i++){const overlay=document.querySelector('#meetingOverlay');if(overlay&&window.DominionMediaController)return overlay;await wait(50);}return null;}
  function toast(message,kind=''){let node=document.querySelector('#shareToast');if(!node){node=document.createElement('div');node.id='shareToast';document.body.append(node);}node.className=`share-toast ${kind}`.trim();node.textContent=String(message||'');node.hidden=false;clearTimeout(node.__timer);node.__timer=setTimeout(()=>{node.hidden=true;},6500);}
  const markCaptureProven=()=>{try{localStorage.setItem(SCREEN_CAPTURE_PROVEN_KEY,'1');}catch{}};
  const locallyProven=()=>{try{return localStorage.getItem(SCREEN_CAPTURE_PROVEN_KEY)==='1';}catch{return false;}};
  async function grantedScreenPermission(){
    if(locallyProven())return true;
    const permissions=await desktop?.media?.permissions?.().catch(()=>null);
    const granted=String(permissions?.screen||'').toLowerCase()==='granted';
    if(granted)markCaptureProven();
    return granted;
  }
  function showScreenPermissionDialog(status='unknown',restartRequired=false){
    let dialog=document.querySelector('#screenPermissionDialog');
    if(!dialog){
      dialog=document.createElement('section');dialog.id='screenPermissionDialog';dialog.className='share-permission-dialog';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','false');
      dialog.innerHTML='<div class="share-permission-card"><div class="share-permission-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="3"/><path d="m8 11 4-4 4 4M12 7v8M8 21h8"/></svg></div><div class="share-permission-copy"><p>SCREEN SHARING</p><h3>Allow Screen Recording</h3><span data-permission-copy>Enable DominionStar Meet in macOS Privacy & Security, then return here.</span></div><div class="share-permission-actions"><button type="button" data-permission-cancel>Cancel</button><button type="button" data-permission-open>Open Settings</button><button type="button" data-permission-retry>I’ve Enabled It</button><button type="button" data-permission-restart hidden>Restart App</button></div></div>';
      document.body.append(dialog);
      dialog.querySelector('[data-permission-cancel]').onclick=()=>{dialog.hidden=true;};
      dialog.querySelector('[data-permission-open]').onclick=async()=>{await window.dominionDesktop?.media?.openPrivacy?.('screen').catch?.(()=>{});};
      dialog.querySelector('[data-permission-retry]').onclick=async event=>{const retry=event.currentTarget;retry.disabled=true;try{dialog.hidden=true;await window.DominionShareIntegration?.open?.();}finally{retry.disabled=false;}};
      dialog.querySelector('[data-permission-restart]').onclick=async event=>{event.currentTarget.disabled=true;try{await desktop?.app?.relaunch?.();}catch{event.currentTarget.disabled=false;}};
    }
    const copy=dialog.querySelector('[data-permission-copy]');
    const retry=dialog.querySelector('[data-permission-retry]');
    const restart=dialog.querySelector('[data-permission-restart]');
    if(restartRequired){
      if(copy)copy.textContent='macOS reports access, but this running process still cannot capture. Restart DominionStar Meet once to refresh the permission identity.';
      if(retry)retry.hidden=true;if(restart)restart.hidden=false;
    }else{
      if(copy){
        if(status==='denied'||status==='restricted')copy.textContent='In Privacy & Security → Screen & System Audio Recording, enable DominionStar Meet. Return here when it is enabled.';
        else copy.textContent='Allow DominionStar Meet in Privacy & Security → Screen & System Audio Recording, then return here.';
      }
      if(retry)retry.hidden=false;if(restart)restart.hidden=true;
    }
    dialog.hidden=false;
  }
  function isPermissionFailure(error){
    const name=String(error?.name||'').toLowerCase(),message=String(error?.message||error||'').toLowerCase();
    return name==='notallowederror'||name==='securityerror'||message.includes('permission')||message.includes('denied')||message.includes('not allowed');
  }
  async function resolveShareEntry(permission='unknown'){
    if(!bridge)throw new Error('Screen sharing runs in the installed DominionStar Meet app.');
    const result=await bridge.openPicker(permission);
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
    let presenterCommitted=false;

    let button=overlay.querySelector('#roomShare');if(!button){button=document.createElement('button');button.id='roomShare';button.className='meeting-control room-share-control';button.type='button';button.textContent='Share Screen';footer.insertBefore(button,overlay.querySelector('#roomExitButton'));}window.DominionMeetingParity?.decorateControls?.();
    let sharedVideo=stage.querySelector('#sharedContentVideo');if(!sharedVideo){sharedVideo=document.createElement('video');sharedVideo.id='sharedContentVideo';sharedVideo.className='shared-content-video';sharedVideo.autoplay=true;sharedVideo.playsInline=true;sharedVideo.muted=true;sharedVideo.hidden=true;stage.append(sharedVideo);}
    let label=stage.querySelector('#shareStageLabel');if(!label){label=document.createElement('div');label.id='shareStageLabel';label.className='share-stage-label';label.hidden=true;stage.append(label);}
    let cameraTile=stage.querySelector('#presenterCameraTile');if(!cameraTile){cameraTile=document.createElement('video');cameraTile.id='presenterCameraTile';cameraTile.className='presenter-camera-tile';cameraTile.autoplay=true;cameraTile.playsInline=true;cameraTile.muted=true;cameraTile.hidden=true;stage.append(cameraTile);}

    function setCompanion(kind=''){
      companionKind=String(kind||'');
      if(companionKind)document.body.dataset.dsShareCompanion=companionKind;else delete document.body.dataset.dsShareCompanion;
      void bridge?.captureState?.({companion:companionKind,companionOpen:Boolean(companionKind)}).catch?.(()=>{});
    }
    function clearCompanion(){if(companionKind||document.body.dataset.dsShareCompanion)setCompanion('');}

    function applyLayout(){
      const state=share.snapshot(),mediaState=media.snapshot();
      overlay.classList.toggle('share-active',state.active);
      sharedVideo.hidden=!state.active;
      label.hidden=!state.active;
      if(state.active){
        const output=share.outputStream();if(sharedVideo.srcObject!==output)sharedVideo.srcObject=output;
        label.innerHTML=`<strong>${state.paused?'Paused':state.annotating?'Annotating':'Sharing'}</strong> · ${String(state.sourceName||'Shared content').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}`;
        const local=media.stream();if(cameraTile.srcObject!==local)cameraTile.srcObject=local;cameraTile.hidden=!mediaState.videoLive;
      }else{sharedVideo.srcObject=null;cameraTile.srcObject=null;cameraTile.hidden=true;presenterCommitted=false;window.DominionShareAnnotation?.deactivate?.();clearCompanion();}
      window.DominionMeetingParity?.syncVideoDock?.();
      const featureState=window.DominionMeetingFeatures?.snapshot?.()||{};void bridge?.captureState?.({paused:state.paused,micOn:mediaState.micOn,cameraOn:mediaState.cameraOn,sourceName:state.sourceName,shareAudio:Boolean(state.options?.shareAudio),optimizeVideo:Boolean(state.options?.optimizeVideo),handRaised:Boolean(featureState.handRaised),recording:Boolean(featureState.recording),recordingPaused:Boolean(featureState.recordingPaused),companion:companionKind,companionOpen:Boolean(companionKind)});
    }

    function commitPresenterMode(){
      const state=share.snapshot();
      if(!state.active||presenterCommitted)return false;
      presenterCommitted=true;
      bridge?.presenterCommitted?.({sourceName:state.sourceName,paused:state.paused});
      return true;
    }

    async function beginShare({replace=false}={}){
      if(!bridge){toast('Screen sharing runs in the installed DominionStar Meet app.');return false;}
      button.classList.add('ds-share-checking');
      try{
        const proven=replace||share.snapshot().active||await grantedScreenPermission();
        const permission=proven?'granted':'unknown';
        const entry=await resolveShareEntry(permission);
        if(entry.mode==='blocked')return false;
        if(entry.mode==='custom')return true;
        try{
          const options={shareAudio:true,optimizeVideo:false};
          if(replace){await share.replaceSource({name:'Shared content',options});window.DominionShareAnnotation?.deactivate?.();}
          else await share.start({name:'Shared content',options});
          markCaptureProven();applyLayout();
          if(!replace)commitPresenterMode();
          if(replace)toast('Screen share changed.');
          return true;
        }catch(error){
          applyLayout();
          if(isPermissionFailure(error)){
            const diagnostic=await desktop?.media?.requestScreen?.().catch(()=>null);
            const status=String(diagnostic?.status||error?.name||'denied').toLowerCase();
            showScreenPermissionDialog(status,status==='granted'||Boolean(diagnostic?.restartRequired));
          }else if(String(error?.name||'')!=='AbortError')toast(error?.message||'Screen sharing could not start.','error');
          return false;
        }
      }finally{
        button.classList.remove('ds-share-checking');
      }
    }

    async function openPickerWithPermission(){clearCompanion();return beginShare({replace:share.snapshot().active});}

    button.addEventListener('click',event=>{
      event.currentTarget.blur();
      if(!bridge){toast('Screen sharing runs in the installed DominionStar Meet app.');return;}
      if(share.snapshot().active){toast('A share is already active. Use the floating presenter toolbar to pause, start a new share, or stop.');return;}
      queueMicrotask(()=>{void beginShare().catch(error=>toast(error?.message||'Unable to open screen sharing.','error'));});
    });

    bridge?.onSourceSelected?.(async selection=>{
      const replacing=share.snapshot().active;
      try{
        if(replacing){await share.replaceSource({name:selection?.name,options:selection?.options||{}});window.DominionShareAnnotation?.deactivate?.();}
        else await share.start({name:selection?.name,options:selection?.options||{}});
        markCaptureProven();applyLayout();
        if(!replacing)commitPresenterMode();
        if(replacing)toast(`Now sharing ${String(selection?.name||'new source')}`);
      }catch(error){
        applyLayout();
        if(isPermissionFailure(error)){
          const diagnostic=await desktop?.media?.requestScreen?.().catch(()=>null);
          const status=String(diagnostic?.status||error?.name||'denied').toLowerCase();
          showScreenPermissionDialog(status,status==='granted'||Boolean(diagnostic?.restartRequired));
        }else toast(replacing?(error?.message||'The new source could not start. Your current share is still active.'):(error?.message||'Screen sharing could not start.'),'error');
      }
    });

    share.onChange(()=>applyLayout());
    media.onChange(()=>{if(share.snapshot().active)applyLayout();});

    const companionObserver=new MutationObserver(()=>{
      if(!share.snapshot().active||!companionKind)return;
      const chat=overlay.querySelector('#meetingChatPanel'),participants=overlay.querySelector('.room-side'),annotation=overlay.querySelector('.share-annotation-overlay');
      if(companionKind==='chat'&&chat?.hidden)clearCompanion();
      else if(companionKind==='participants'&&participants?.hidden)clearCompanion();
      else if(companionKind==='annotate'&&annotation?.hidden)clearCompanion();
    });
    companionObserver.observe(overlay,{subtree:true,attributes:true,attributeFilter:['hidden']});

    bridge?.onPresenterCommand?.(async rawCommand=>{
      const command=String(rawCommand?.command||rawCommand||'');
      try{
        if(command==='pause'){await share.togglePause(sharedVideo);applyLayout();return;}
        if(command==='stop'){clearCompanion();await share.stop();applyLayout();return;}
        if(command==='audio'){await media.setMicrophone(!media.snapshot().micOn);applyLayout();return;}
        if(command==='video'){await media.setCamera(!media.snapshot().cameraOn);applyLayout();return;}
        if(command==='participants'){window.DominionRuntimeStability?.setChat?.(false);window.DominionRuntimeStability?.setParticipants?.(true);setCompanion('participants');return;}
        if(command==='chat'){window.DominionRuntimeStability?.setParticipants?.(false);window.DominionRuntimeStability?.setChat?.(true);setCompanion('chat');return;}
        if(command==='annotate'){const active=Boolean(window.DominionShareAnnotation?.toggle?.());setCompanion(active?'annotate':'');applyLayout();return;}
        if(command==='new-share'){await openPickerWithPermission();return;}
        if(command==='layout-speaker'){window.DominionMeetingFeatures?.setVideoLayout?.('speaker');return;}
        if(command==='layout-gallery'){window.DominionMeetingFeatures?.setVideoLayout?.('gallery');return;}
        if(command==='layout-hide'){window.DominionMeetingFeatures?.setVideoLayout?.('hide');return;}
        if(command.startsWith('reaction:')){await window.DominionMeetingFeatures?.sendReaction?.(command.slice('reaction:'.length));applyLayout();return;}
        if(command==='toggle-hand'){await window.DominionMeetingFeatures?.toggleRaiseHand?.();applyLayout();return;}
        if(command==='record'){await window.DominionMeetingFeatures?.toggleRecording?.();applyLayout();return;}
        if(command==='stop-record'){await window.DominionMeetingFeatures?.stopRecording?.();applyLayout();return;}
        if(command==='show-meeting'){clearCompanion();window.focus();return;}
      }catch(error){toast(error?.message||'Share control failed.','error');}
    });

    window.DominionShareIntegration=Object.freeze({open:options=>beginShare(options||{}),stop:()=>share.stop(),state:()=>share.snapshot(),screenCaptureProven:()=>locallyProven(),commitPresenterMode});
  }
  void boot().catch(error=>console.error('[DominionStar Meet] Share Integration boot failed.',error)).finally(()=>{window.__DominionShareIntegrationBooting=false;});
})();