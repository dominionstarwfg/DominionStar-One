(()=>{
  if(window.DominionShareIntegration||window.__DominionShareIntegrationBooting)return;
  window.__DominionShareIntegrationBooting=true;
  const desktop=window.dominionDesktop||null;
  const bridge=desktop?.share||null;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2';
  // Ad-hoc prototype rebuilds can receive a new macOS TCC identity while
  // Chromium localStorage survives. Never carry capture proof across app
  // launches/builds; trust proof only inside the current renderer session.
  try{localStorage.removeItem(SCREEN_CAPTURE_PROVEN_KEY);}catch{}
  let companionKind='';
  const addStyle=href=>{if(document.querySelector(`link[href="${href}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);};
  const addScript=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});

  async function findMeetingSurface(){for(let i=0;i<120;i++){const overlay=document.querySelector('#meetingOverlay');if(overlay&&window.DominionMediaController)return overlay;await wait(50);}return null;}
  function toast(message,kind=''){let node=document.querySelector('#shareToast');if(!node){node=document.createElement('div');node.id='shareToast';document.body.append(node);}node.className=`share-toast ${kind}`.trim();node.textContent=String(message||'');node.hidden=false;clearTimeout(node.__timer);node.__timer=setTimeout(()=>{node.hidden=true;},6500);}
  const markCaptureProven=()=>{try{sessionStorage.setItem(SCREEN_CAPTURE_PROVEN_KEY,'1');}catch{}};
  const locallyProven=()=>{try{return sessionStorage.getItem(SCREEN_CAPTURE_PROVEN_KEY)==='1';}catch{return false;}};
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
    async function annotationPolicy(){
      try{
        const ctx=await desktop?.meeting?.context?.();
        if(!ctx?.roomId)return {enabled:true,saveAllowed:true};
        const snapshot=await desktop?.meeting?.snapshot?.(ctx.roomId);
        return {enabled:snapshot?.annotationEnabled!==false,saveAllowed:snapshot?.annotationSaveAllowed!==false};
      }catch{return {enabled:true,saveAllowed:true};}
    }
    const environment=await desktop?.environment?.().catch(()=>null);
    const sameRendererPresenter=String(environment?.platform||'')==='darwin';
    const footer=overlay.querySelector('.meeting-footer'),stage=overlay.querySelector('.stage');
    if(!footer||!stage)return;
    let presenterCommitted=false;
    let macMirrorVideo=null,macMirrorCanvas=null,macMirrorContext=null,macMirrorTimer=0,macMirrorBusy=false,lastMacMirrorCameraOn=null,macImageCapture=null,macImageCaptureTrackId='';
    const macVideoFrameBridge=bridge?.publishVideoFrame||null;

    function stopMacVideoMirror({publishOff=true}={}){
      if(macMirrorTimer){clearTimeout(macMirrorTimer);macMirrorTimer=0;}
      macMirrorBusy=false;lastMacMirrorCameraOn=null;
      if(macMirrorVideo){try{macMirrorVideo.pause?.();}catch{}try{macMirrorVideo.srcObject=null;}catch{}try{macMirrorVideo.remove?.();}catch{}macMirrorVideo=null;}
      macMirrorCanvas=null;macMirrorContext=null;macImageCapture=null;macImageCaptureTrackId='';
      if(publishOff&&sameRendererPresenter)try{macVideoFrameBridge?.({cameraOn:false,cameraLive:false,pending:false,frame:'',mirrored:media.snapshot().mirror!==false});}catch{}
    }

    function ensureMacMirrorVideo(stream){
      if(!macMirrorVideo){
        macMirrorVideo=document.createElement('video');macMirrorVideo.autoplay=true;macMirrorVideo.muted=true;macMirrorVideo.playsInline=true;macMirrorVideo.setAttribute('aria-hidden','true');
        Object.assign(macMirrorVideo.style,{position:'fixed',left:'-12000px',top:'0',width:'480px',height:'270px',opacity:'0.001',pointerEvents:'none',zIndex:'-1'});
        document.body.append(macMirrorVideo);
      }
      if(macMirrorVideo.srcObject!==stream){macMirrorVideo.srcObject=stream;try{void macMirrorVideo.play();}catch{}}
      return macMirrorVideo;
    }

    function scheduleMacVideoMirror(delay=90){
      if(!sameRendererPresenter||!share.snapshot().active)return;
      if(macMirrorTimer)clearTimeout(macMirrorTimer);
      macMirrorTimer=setTimeout(()=>{macMirrorTimer=0;void publishMacVideoFrame();},Math.max(45,Number(delay)||90));
    }

    async function publishMacVideoFrame({force=false}={}){
      if(!sameRendererPresenter||!macVideoFrameBridge||!share.snapshot().active||macMirrorBusy)return;
      macMirrorBusy=true;
      try{
        const mediaState=media.snapshot(),stream=media.stream(),track=stream?.getVideoTracks?.().find(item=>item?.readyState==='live')||null;
        const cameraOn=mediaState.cameraOn!==false;
        const mirrored=mediaState.mirror!==false;
        if(!cameraOn){
          if(force||lastMacMirrorCameraOn!==false)macVideoFrameBridge({cameraOn:false,cameraLive:false,pending:false,frame:'',mirrored});
          lastMacMirrorCameraOn=false;return;
        }
        lastMacMirrorCameraOn=true;
        if(!track||track.enabled===false){
          macVideoFrameBridge({cameraOn:true,cameraLive:false,pending:true,frame:'',mirrored});return;
        }
        let frameSource=null,sourceWidth=0,sourceHeight=0,closeFrame=null;
        if(typeof ImageCapture==='function'){
          try{
            const trackId=String(track.id||'');
            if(!macImageCapture||macImageCaptureTrackId!==trackId){macImageCapture=new ImageCapture(track);macImageCaptureTrackId=trackId;}
            const bitmap=await Promise.race([macImageCapture.grabFrame(),wait(220).then(()=>null)]);
            if(bitmap){frameSource=bitmap;sourceWidth=Number(bitmap.width)||0;sourceHeight=Number(bitmap.height)||0;closeFrame=()=>{try{bitmap.close?.();}catch{}};}
          }catch{macImageCapture=null;macImageCaptureTrackId='';}
        }
        if(!frameSource){
          const video=ensureMacMirrorVideo(stream);
          if(video.paused||video.readyState<2){try{await video.play();}catch{}}
          if(video.readyState<2||video.videoWidth<2||video.videoHeight<2){
            macVideoFrameBridge({cameraOn:true,cameraLive:false,pending:true,frame:'',mirrored});return;
          }
          frameSource=video;sourceWidth=Number(video.videoWidth)||480;sourceHeight=Number(video.videoHeight)||270;
        }
        const width=Math.min(640,Math.max(320,sourceWidth||480));
        const height=Math.max(180,Math.round(width*(sourceHeight||270)/Math.max(2,sourceWidth||480)));
        if(!macMirrorCanvas){macMirrorCanvas=document.createElement('canvas');macMirrorContext=macMirrorCanvas.getContext('2d',{alpha:false,desynchronized:true});}
        if(!macMirrorContext){closeFrame?.();return;}
        if(macMirrorCanvas.width!==width)macMirrorCanvas.width=width;if(macMirrorCanvas.height!==height)macMirrorCanvas.height=height;
        macMirrorContext.drawImage(frameSource,0,0,width,height);closeFrame?.();
        macVideoFrameBridge({cameraOn:true,cameraLive:true,pending:false,frame:macMirrorCanvas.toDataURL('image/jpeg',0.72),mirrored});
      }catch{
        try{macVideoFrameBridge?.({cameraOn:media.snapshot().cameraOn!==false,cameraLive:false,pending:true,frame:'',mirrored:media.snapshot().mirror!==false});}catch{}
      }finally{macMirrorBusy=false;scheduleMacVideoMirror(90);}
    }

    let button=overlay.querySelector('#roomShare');if(!button){button=document.createElement('button');button.id='roomShare';button.className='meeting-control room-share-control';button.type='button';button.textContent='Share Screen';footer.insertBefore(button,overlay.querySelector('#roomExitButton'));}window.DominionMeetingParity?.decorateControls?.();
    let sharedVideo=stage.querySelector('#sharedContentVideo');if(!sharedVideo){sharedVideo=document.createElement('video');sharedVideo.id='sharedContentVideo';sharedVideo.className='shared-content-video';sharedVideo.autoplay=true;sharedVideo.playsInline=true;sharedVideo.muted=true;sharedVideo.hidden=true;stage.append(sharedVideo);}
    let label=stage.querySelector('#shareStageLabel');if(!label){label=document.createElement('div');label.id='shareStageLabel';label.className='share-stage-label';label.hidden=true;stage.append(label);}
    let cameraTile=stage.querySelector('#presenterCameraTile');if(!cameraTile){cameraTile=document.createElement('video');cameraTile.id='presenterCameraTile';cameraTile.className='presenter-camera-tile';cameraTile.autoplay=true;cameraTile.playsInline=true;cameraTile.muted=true;cameraTile.hidden=true;stage.append(cameraTile);}

    let inlinePresenter=overlay.querySelector('#inlinePresenterToolbar');
    if(!inlinePresenter){
      inlinePresenter=document.createElement('div');
      inlinePresenter.id='inlinePresenterToolbar';
      inlinePresenter.className='inline-presenter-toolbar';
      inlinePresenter.hidden=true;
      inlinePresenter.innerHTML=`<div class="inline-presenter-status"><strong id="inlineShareState">You are sharing</strong><span id="inlineShareSource">Shared content</span></div><div class="inline-presenter-actions"><button type="button" data-inline-command="audio">Mute</button><button type="button" data-inline-command="video">Stop Video</button><button type="button" data-inline-command="participants">Participants</button><button type="button" data-inline-command="chat">Chat</button><button type="button" data-inline-command="annotate">Annotate</button><button type="button" data-inline-command="pause">Pause</button><button type="button" data-inline-command="new-share">New Share</button><button type="button" class="stop" data-inline-command="stop">Stop Share</button></div>`;
      overlay.append(inlinePresenter);
      inlinePresenter.querySelectorAll('[data-inline-command]').forEach(control=>control.addEventListener('click',()=>void dispatchPresenterCommand(control.dataset.inlineCommand||'')));
    }

    function setCompanion(kind=''){
      companionKind=String(kind||'');
      if(companionKind)document.body.dataset.dsShareCompanion=companionKind;else delete document.body.dataset.dsShareCompanion;
      void bridge?.captureState?.({companion:companionKind,companionOpen:Boolean(companionKind)}).catch?.(()=>{});
    }
    function clearCompanion(){if(companionKind||document.body.dataset.dsShareCompanion)setCompanion('');}

    function applyLayout(){
      const state=share.snapshot(),mediaState=media.snapshot();
      overlay.classList.toggle('share-active',state.active);
      // On macOS the share-owning renderer must not visibly mirror the
      // captured screen back into itself. That recursive compositor path can
      // stall the renderer during active display capture. Keep the video
      // element attached to the stream for Pause-frame capture, but do not
      // paint it on the presenter surface.
      sharedVideo.hidden=!state.active||sameRendererPresenter;
      label.hidden=!state.active;
      inlinePresenter.hidden=!state.active||sameRendererPresenter;
      if(state.active){
        const shareState=inlinePresenter.querySelector('#inlineShareState'),shareSource=inlinePresenter.querySelector('#inlineShareSource');
        if(shareState)shareState.textContent=state.paused?'Share paused':'You are sharing';
        if(shareSource)shareSource.textContent=String(state.sourceName||'Shared content');
        const commandLabel=(name,text)=>{const node=inlinePresenter.querySelector(`[data-inline-command="${name}"]`);if(node)node.textContent=text;};
        commandLabel('pause',state.paused?'Resume':'Pause');
        commandLabel('audio',mediaState.micOn?'Mute':'Unmute');
        commandLabel('video',mediaState.cameraOn?'Stop Video':'Start Video');
      }
      if(state.active){
        const output=share.outputStream();
        if(sameRendererPresenter){if(sharedVideo.srcObject)sharedVideo.srcObject=null;}
        else if(sharedVideo.srcObject!==output)sharedVideo.srcObject=output;
        label.innerHTML=`<strong>${state.paused?'Paused':state.annotating?'Annotating':'Sharing'}</strong> · ${String(state.sourceName||'Shared content').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}`;
        // Zoom-style macOS presenter mode already keeps the participant/video
        // dock available. Do not duplicate the local camera into a second
        // presenter video element; duplicating the camera pipeline while share
        // is active can stall Chromium's renderer on physical Mac.
        if(sameRendererPresenter){if(cameraTile.srcObject)cameraTile.srcObject=null;cameraTile.hidden=true;}
        else{const local=media.stream();if(cameraTile.srcObject!==local)cameraTile.srcObject=local;cameraTile.hidden=!mediaState.videoLive;}
      }else{sharedVideo.srcObject=null;cameraTile.srcObject=null;cameraTile.hidden=true;presenterCommitted=false;stopMacVideoMirror();window.DominionShareAnnotation?.resetForNewShare?.();clearCompanion();}
      // On macOS, do not rebuild/rebind the Zoom-style video dock inside the
      // same transaction that flips Share to active. The existing dock remains
      // visually present, but media rebinding is deferred to normal meeting
      // updates so presenter controls stay responsive.
      if(!(sameRendererPresenter&&state.active))window.DominionMeetingParity?.syncVideoDock?.();
      const featureState=window.DominionMeetingFeatures?.snapshot?.()||{};void bridge?.captureState?.({paused:state.paused,micOn:mediaState.micOn,cameraOn:mediaState.cameraOn,sourceName:state.sourceName,shareAudio:Boolean(state.options?.shareAudio),optimizeVideo:Boolean(state.options?.optimizeVideo),includeMeetWindows:Boolean(state.options?.includeMeetWindows),handRaised:Boolean(featureState.handRaised),recording:Boolean(featureState.recording),recordingPaused:Boolean(featureState.recordingPaused),companion:companionKind,companionOpen:Boolean(companionKind)});
    }

    function commitPresenterMode(){
      const state=share.snapshot(),mediaState=media.snapshot();
      if(!state.active||presenterCommitted)return false;
      presenterCommitted=true;
      // Two-phase handoff: the chooser is already gone and display capture is
      // live before presenter mode may park the meeting. macOS must notify the
      // native presenter authority here; otherwise the in-meeting toolbar stays
      // inside the captured window and the capture renderer can recursively stall.
      try{bridge?.presenterCommitted?.({sourceName:state.sourceName,paused:state.paused,micOn:mediaState.micOn,cameraOn:mediaState.cameraOn,includeMeetWindows:Boolean(state.options?.includeMeetWindows)});}catch{}
      if(sameRendererPresenter){void publishMacVideoFrame({force:true});scheduleMacVideoMirror(90);}
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
          if(replace){await share.replaceSource({name:'Shared content',options});window.DominionShareAnnotation?.resetForNewShare?.();}
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
      const replacing=share.snapshot().active,selectionOptions=selection?.options||{};
      try{
        if(replacing){await share.replaceSource({name:selection?.name,options:selectionOptions});window.DominionShareAnnotation?.resetForNewShare?.();}
        else await share.start({name:selection?.name,options:selectionOptions});
        markCaptureProven();applyLayout();
        if(!replacing&&!selectionOptions.deferPresenterCommit)commitPresenterMode();
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
    media.onChange(()=>{if(share.snapshot().active){applyLayout();if(sameRendererPresenter)void publishMacVideoFrame({force:true});}});

    const companionObserver=new MutationObserver(()=>{
      if(!share.snapshot().active||!companionKind)return;
      const chat=overlay.querySelector('#meetingChatPanel'),participants=overlay.querySelector('.room-side'),annotation=overlay.querySelector('.share-annotation-overlay');
      if(companionKind==='chat'&&chat?.hidden)clearCompanion();
      else if(companionKind==='participants'&&participants?.hidden)clearCompanion();
      else if(companionKind==='annotate'&&annotation?.hidden)clearCompanion();
    });
    companionObserver.observe(overlay,{subtree:true,attributes:true,attributeFilter:['hidden']});

    async function dispatchPresenterCommand(rawCommand){
      const command=String(rawCommand?.command||rawCommand||'');
      const qaCommandId=Number(rawCommand?.qaCommandId||0)||0;
      if(qaCommandId>0)console.error(`QA_PRESENTER_RENDERER_DISPATCH id=${qaCommandId} command=${command}`);
      window.dispatchEvent(new CustomEvent('dominion:presenter-command-dispatch',{detail:{command,qaCommandId}}));
      try{
        // Pause/Resume already emits the authoritative share state, and that
        // listener updates the inline presenter toolbar synchronously. Do not
        // run a second DOM/layout transaction in the promise continuation.
        if(command==='pause'){await share.togglePause(sharedVideo);return {handled:true,command};}
        if(command==='stop'){clearCompanion();await share.stop();applyLayout();return {handled:true,command};}
        if(command==='audio'){await media.setMicrophone(!media.snapshot().micOn);applyLayout();return {handled:true,command};}
        if(command==='video'){await media.setCamera(!media.snapshot().cameraOn);applyLayout();return {handled:true,command};}
        if(command==='participants'){window.DominionRuntimeStability?.setChat?.(false);window.DominionRuntimeStability?.setParticipants?.(true);setCompanion('participants');return {handled:true,command};}
        if(command==='chat'){window.DominionRuntimeStability?.setParticipants?.(false);window.DominionRuntimeStability?.setChat?.(true);setCompanion('chat');return {handled:true,command};}
        if(command==='annotate'){
          // Zoom's in-meeting "Enable/Disable Annotation for Others" setting
          // restricts viewers, not the person who is actively sharing.
          const active=Boolean(window.DominionShareAnnotation?.toggle?.());setCompanion(active?'annotate':'');applyLayout();return {handled:true,command};
        }
        if(command==='new-share'){await openPickerWithPermission();return {handled:true,command};}
        if(command==='layout-speaker'){window.DominionMeetingFeatures?.setVideoLayout?.('speaker');return {handled:true,command};}
        if(command==='layout-gallery'){window.DominionMeetingFeatures?.setVideoLayout?.('gallery');return {handled:true,command};}
        if(command==='layout-hide'){window.DominionMeetingFeatures?.setVideoLayout?.('hide');return {handled:true,command};}
        if(command.startsWith('reaction:')){await window.DominionMeetingFeatures?.sendReaction?.(command.slice('reaction:'.length));applyLayout();return {handled:true,command};}
        if(command==='toggle-hand'){await window.DominionMeetingFeatures?.toggleRaiseHand?.();applyLayout();return {handled:true,command};}
        if(command==='record'){await window.DominionMeetingFeatures?.toggleRecording?.();applyLayout();return {handled:true,command};}
        if(command==='stop-record'){await window.DominionMeetingFeatures?.stopRecording?.();applyLayout();return {handled:true,command};}
        if(command==='show-meeting'){clearCompanion();window.focus();return {handled:true,command};}
        return {handled:false,command};
      }catch(error){toast(error?.message||'Share control failed.','error');return {handled:false,command,error:String(error?.message||error||'share_control_failed')};}
    }
    window.__DominionPresenterDispatch=dispatchPresenterCommand;
    bridge?.onPresenterCommand?.(rawCommand=>dispatchPresenterCommand(rawCommand));

    window.DominionShareIntegration=Object.freeze({open:options=>beginShare(options||{}),stop:()=>share.stop(),state:()=>share.snapshot(),screenCaptureProven:()=>locallyProven(),commitPresenterMode,dispatchPresenterCommand});
  }
  void boot().catch(error=>console.error('[DominionStar Meet] Share Integration boot failed.',error)).finally(()=>{window.__DominionShareIntegrationBooting=false;});
})();