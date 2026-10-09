(()=>{
  if(window.DominionShareIntegration||window.__DominionShareIntegrationBooting)return;
  window.__DominionShareIntegrationBooting=true;
  const desktop=window.dominionDesktop||null;
  const bridge=desktop?.share||null;
  const macPresenter=desktop?.macShare||null;
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
    const environment=await desktop?.environment?.().catch(()=>null);
    const sameRendererPresenter=String(environment?.platform||'')==='darwin';
    const qaPresenterTrace=Boolean(environment?.qaPresenterFixtures);
    const qaKeepMacPresenterHidden=Boolean(environment?.qaKeepMacPresenterHidden);
    const footer=overlay.querySelector('.meeting-footer'),stage=overlay.querySelector('.stage');
    if(!footer||!stage)return;
    let presenterCommitted=false;
    let lastPresenterStateSignature='';
    let macRemoteFrameTimer=0;
    let macDockSyncTimer=0;
    let presenterLocalParticipantId='';
    const refreshPresenterLocalParticipantId=async()=>{
      try{const ctx=await desktop?.meeting?.context?.();presenterLocalParticipantId=String(ctx?.participantId||presenterLocalParticipantId||'');}catch{}
      return presenterLocalParticipantId;
    };
    void refreshPresenterLocalParticipantId();
    window.addEventListener('dominion:meeting-snapshot',()=>{void refreshPresenterLocalParticipantId().then(()=>{if(sameRendererPresenter&&share.snapshot().active){publishMacPresenterState();syncMacCameraFramePump();}});});
    window.addEventListener('dominion:remote-media-state',()=>{if(sameRendererPresenter&&share.snapshot().active)publishMacPresenterState();});
    if(sameRendererPresenter&&macPresenter?.onShowMeeting){
      macPresenter.onShowMeeting(payload=>{document.body.classList.toggle('ds-native-mac-show-meeting',Boolean(payload?.visible));});
    }
    const ensureNativeMeetingVisible=async()=>{
      if(!sameRendererPresenter||!share.snapshot().active)return;
      if(document.body.classList.contains('ds-native-mac-show-meeting'))return;
      try{await macPresenter?.showMeeting?.();}catch{}
      document.body.classList.add('ds-native-mac-show-meeting');
    };
    const scheduleMacVideoDockSync=(delay=40)=>{
      if(!sameRendererPresenter)return;
      clearTimeout(macDockSyncTimer);
      macDockSyncTimer=setTimeout(()=>{
        macDockSyncTimer=0;
        if(!share.snapshot().active)return;
        try{window.DominionMeetingParity?.syncVideoDock?.();}catch{}
      },Math.max(0,Number(delay)||0));
    };
    const localPresenterMirror=document.createElement('video');
    let localImageCapture=null,localImageCaptureTrackId='',localFrameCaptureBusy=false;
    localPresenterMirror.autoplay=true;localPresenterMirror.playsInline=true;localPresenterMirror.muted=true;
    localPresenterMirror.setAttribute('aria-hidden','true');
    localPresenterMirror.style.cssText='position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;opacity:.001;pointer-events:none';
    document.body.append(localPresenterMirror);
    const effectiveLocalCameraOn=()=>{
      const snap=media.snapshot(),stream=media.stream();
      return Boolean(snap.cameraOn&&snap.videoLive&&stream?.getVideoTracks?.().some(track=>track.readyState==='live'&&track.enabled!==false));
    };
    const syncLocalPresenterMirror=()=>{
      if(!sameRendererPresenter||!share.snapshot().active||!effectiveLocalCameraOn()){
        if(localPresenterMirror.srcObject)localPresenterMirror.srcObject=null;
        return false;
      }
      const stream=media.stream();
      if(localPresenterMirror.srcObject!==stream)localPresenterMirror.srcObject=stream;
      void localPresenterMirror.play().catch(()=>{});
      return true;
    };
    const frameCanvas=document.createElement('canvas');frameCanvas.width=504;frameCanvas.height=264;
    const frameContext=frameCanvas.getContext('2d',{alpha:false,desynchronized:true,colorSpace:'srgb'});
    if(frameContext){frameContext.imageSmoothingEnabled=true;frameContext.imageSmoothingQuality='high';}
    const encodePresenterFrame=()=>frameCanvas.toDataURL('image/webp',.84);
    const presenterParticipants=()=>{
      const mediaState=media.snapshot(),rows=[...overlay.querySelectorAll('#participantRoster [data-participant-id]')],seen=new Set(),list=[];
      for(const row of rows){
        const id=String(row.dataset.participantId||'');if(!id||seen.has(id))continue;seen.add(id);
        const self=row.dataset.participantSelf==='1'||row.dataset.dsAdaptiveSelf==='1'||Boolean(presenterLocalParticipantId&&id===presenterLocalParticipantId),tile=self?null:overlay.querySelector(`#participantVideoDock .remote-peer-tile[data-participant-id="${CSS.escape(id)}"],#remoteTileStrip .remote-peer-tile[data-peer-id="${CSS.escape(id)}"]`);
        const role=String(row.dataset.participantRole||'participant').toLowerCase();
        const name=String(row.dataset.participantName||row.querySelector('.participant-name-text')?.textContent||row.querySelector('strong')?.textContent||'Participant').trim();
        const avatar=String(row.querySelector('.person-badge img')?.src||'');
        const micOn=self?Boolean(mediaState.micOn):tile?tile.dataset.micOn==='1':Boolean(row.querySelector('[data-participant-mic].on'))
        const cameraOn=self?effectiveLocalCameraOn():tile?tile.dataset.cameraOn==='1':Boolean(row.querySelector('[data-participant-video].on'))
        list.push({participantId:id,name,role,self,micOn,cameraOn,avatar});
      }
      if(!list.some(item=>item.self)){
        const selfRow=presenterLocalParticipantId
          ?overlay.querySelector(`#participantRoster [data-participant-id="${CSS.escape(presenterLocalParticipantId)}"]`)
          :overlay.querySelector('#participantRoster [data-participant-self="1"],#participantRoster [data-ds-adaptive-self="1"]');
        if(selfRow){
          const id=String(selfRow.dataset.participantId||presenterLocalParticipantId||'local-self'),name=String(selfRow.dataset.participantName||'You').trim()||'You',role=String(selfRow.dataset.participantRole||'participant').toLowerCase();
          const existing=list.find(item=>item.participantId===id);
          if(existing){existing.self=true;existing.micOn=Boolean(mediaState.micOn);existing.cameraOn=effectiveLocalCameraOn();}
          else list.unshift({participantId:id,name,role,self:true,micOn:Boolean(mediaState.micOn),cameraOn:effectiveLocalCameraOn(),avatar:String(selfRow.querySelector('.person-badge img')?.src||'')});
        }else if(list.length===0){
          list.unshift({participantId:'local-self',name:'You',role:'participant',self:true,micOn:Boolean(mediaState.micOn),cameraOn:effectiveLocalCameraOn(),avatar:''});
        }
      }
      return list.slice(0,12);
    };
    const publishMacRemoteFrames=()=>{
      if(!sameRendererPresenter||!share.snapshot().active||!macPresenter?.videoFrame||!frameContext)return;
      // Keep native presenter participant identity/state synchronized before
      // delivering frames so the video surface never drops a valid camera frame
      // for an ID it has not learned yet.
      publishMacPresenterState();
      const participantState=presenterParticipants();
      const selfPerson=participantState.find(item=>item.self)||null;
      if(qaPresenterTrace)console.error(`QA_MAC_FRAME_PUMP participants=${participantState.length} self=${String(selfPerson?.participantId||'')} camera=${selfPerson?.cameraOn?1:0} active=${share.snapshot().active?1:0}`);
      const selfId=String(selfPerson?.participantId||presenterLocalParticipantId||'local-self');
      const stateById=new Map(participantState.map(item=>[String(item.participantId||''),item]));
      const seen=new Set();
      const sendVideoFrame=(video,id)=>{
        if(!video||!id||seen.has(id)||video.readyState<2||!video.videoWidth||!video.videoHeight)return false;
        try{
          frameContext.fillStyle='#111';frameContext.fillRect(0,0,frameCanvas.width,frameCanvas.height);
          const sourceRatio=video.videoWidth/video.videoHeight,targetRatio=frameCanvas.width/frameCanvas.height;let sx=0,sy=0,sw=video.videoWidth,sh=video.videoHeight;
          if(sourceRatio>targetRatio){sw=Math.round(video.videoHeight*targetRatio);sx=Math.round((video.videoWidth-sw)/2);}else if(sourceRatio<targetRatio){sh=Math.round(video.videoWidth/targetRatio);sy=Math.round((video.videoHeight-sh)/2);}
          frameContext.drawImage(video,sx,sy,sw,sh,0,0,frameCanvas.width,frameCanvas.height);
          const dataUrl=encodePresenterFrame();macPresenter.videoFrame({participantId:id,dataUrl,at:Date.now()});seen.add(id);return true;
        }catch{return false;}
      };
      // Local presenter video mirrors the authoritative DominionMediaController
      // stream directly. Prefer ImageCapture from the already-owned camera track
      // so the native filmstrip never depends on an offscreen <video> reaching
      // HAVE_CURRENT_DATA. This does not acquire a second camera stream.
      if(selfPerson?.cameraOn){
        const localTrack=media.stream()?.getVideoTracks?.().find(track=>track.readyState==='live'&&track.enabled!==false)||null;
        if(localTrack&&typeof ImageCapture==='function'&&!localFrameCaptureBusy){
          if(!localImageCapture||localImageCaptureTrackId!==localTrack.id){try{localImageCapture=new ImageCapture(localTrack);localImageCaptureTrackId=localTrack.id;}catch{localImageCapture=null;localImageCaptureTrackId='';}}
          if(localImageCapture){
            localFrameCaptureBusy=true;
            void localImageCapture.grabFrame().then(bitmap=>{
              try{
                frameContext.fillStyle='#111';frameContext.fillRect(0,0,frameCanvas.width,frameCanvas.height);
                const sourceRatio=bitmap.width/bitmap.height,targetRatio=frameCanvas.width/frameCanvas.height;let sx=0,sy=0,sw=bitmap.width,sh=bitmap.height;
                if(sourceRatio>targetRatio){sw=Math.round(bitmap.height*targetRatio);sx=Math.round((bitmap.width-sw)/2);}else if(sourceRatio<targetRatio){sh=Math.round(bitmap.width/targetRatio);sy=Math.round((bitmap.height-sh)/2);}
                frameContext.drawImage(bitmap,sx,sy,sw,sh,0,0,frameCanvas.width,frameCanvas.height);
                const dataUrl=encodePresenterFrame();if(qaPresenterTrace)console.error(`QA_MAC_FRAME_GENERATED participant=${selfId} bytes=${dataUrl.length}`);macPresenter.videoFrame({participantId:selfId,dataUrl,at:Date.now()});
              }catch{}finally{try{bitmap.close?.();}catch{}}
            }).catch(error=>{if(qaPresenterTrace)console.error(`QA_MAC_FRAME_GRAB_FAILED ${String(error?.message||error||'unknown')}`);if(syncLocalPresenterMirror())sendVideoFrame(localPresenterMirror,selfId);}).finally(()=>{localFrameCaptureBusy=false;});
          }else if(syncLocalPresenterMirror())sendVideoFrame(localPresenterMirror,selfId);
        }else if(syncLocalPresenterMirror())sendVideoFrame(localPresenterMirror,selfId);
      }
      const tiles=[...overlay.querySelectorAll('#participantVideoDock .remote-peer-tile:not(.local-video-dock-tile),#remoteTileStrip .remote-peer-tile')];
      for(const tile of tiles){
        const id=String(tile.dataset.participantId||tile.dataset.peerId||''),person=stateById.get(id)||null;
        if(!id||seen.has(id)||!(person?.cameraOn||tile.dataset.cameraOn==='1'))continue;
        sendVideoFrame(tile.querySelector('video'),id);
      }
    };
    const stopMacRemoteFramePump=()=>{if(macRemoteFrameTimer){clearInterval(macRemoteFrameTimer);macRemoteFrameTimer=0;}};
    const syncMacCameraFramePump=()=>{
      if(!sameRendererPresenter||!share.snapshot().active){stopMacRemoteFramePump();return;}
      if(!macRemoteFrameTimer)macRemoteFrameTimer=setInterval(publishMacRemoteFrames,66);
      publishMacRemoteFrames();
    };
    let lastVoiceSentAt=0,lastVoiceSpeaking=false,lastVoiceLevel=0;
    const forwardVoiceLevel=event=>{
      if(!sameRendererPresenter||!share.snapshot().active)return;
      const detail=event?.detail||{};
      const level=Math.max(0,Math.min(1,Number(detail.level)||0));
      const speaking=Boolean(detail.speaking&&level>0);
      const now=performance.now();
      const changed=speaking!==lastVoiceSpeaking||Math.abs(level-lastVoiceLevel)>=.08;
      if(!changed&&now-lastVoiceSentAt<90)return;
      lastVoiceSentAt=now;lastVoiceSpeaking=speaking;lastVoiceLevel=level;
      try{
        if(qaPresenterTrace)console.error(`QA_MAC_VOICE_SEND level=${level.toFixed(3)} speaking=${speaking?1:0} active=${share.snapshot().active?1:0}`);
        bridge?.voiceLevel?.({level,speaking});
      }catch{}
    };
    window.addEventListener('dominion:local-voice-level',forwardVoiceLevel);

    let button=overlay.querySelector('#roomShare');if(!button){button=document.createElement('button');button.id='roomShare';button.className='meeting-control room-share-control';button.type='button';button.textContent='Share';button.setAttribute('aria-label','Share Screen');footer.insertBefore(button,overlay.querySelector('#roomExitButton'));}window.DominionMeetingParity?.decorateControls?.();
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
    function clearCompanion(){
      const previous=String(companionKind||document.body.dataset.dsShareCompanion||'');
      if(previous)setCompanion('');
      if(sameRendererPresenter&&['participants','chat'].includes(previous)&&document.body.classList.contains('ds-native-mac-show-meeting')){
        document.body.classList.remove('ds-native-mac-show-meeting');
        try{void Promise.resolve(desktop?.macShare?.showMeeting?.()).catch(()=>{});}catch{}
      }
    }

    function lockNativeAnnotationRenderer(){
      if(!sameRendererPresenter||!share.snapshot().active)return;
      document.body.classList.add('ds-native-mac-presenter-share');
      const tools=document.querySelector('.share-annotation-tools');
      if(tools)tools.style.setProperty('display','none','important');
    }

    function publishMacPresenterState(){
      if(!sameRendererPresenter||!share.snapshot().active)return;
      const state=share.snapshot(),mediaState=media.snapshot(),featureState=window.DominionMeetingFeatures?.snapshot?.()||{};
      try{
        const payload={
          paused:state.paused,micOn:mediaState.micOn,cameraOn:effectiveLocalCameraOn(),
          cameraId:String(mediaState.cameraId||''),mirror:mediaState.mirror!==false,
          sourceName:state.sourceName,shareAudio:Boolean(state.options?.shareAudio),
          optimizeVideo:Boolean(state.options?.optimizeVideo),
          handRaised:Boolean(featureState.handRaised),recording:Boolean(featureState.recording),
          recordingPaused:Boolean(featureState.recordingPaused),companion:companionKind,
          companionOpen:Boolean(companionKind),participants:presenterParticipants()
        };
        const signature=JSON.stringify(payload);
        if(signature===lastPresenterStateSignature)return;
        lastPresenterStateSignature=signature;
        const pending=bridge?.captureState?.(payload);
        void Promise.resolve(pending).catch(()=>{});
      }catch{}
    }

    function applyLayout(){
      if(window.__DOMINION_QA_SKIP_SHARE_LAYOUT)return;
      const state=share.snapshot(),mediaState=media.snapshot();
      if(sameRendererPresenter&&state.active){
        // Native macOS presenter mode is visually independent from the meeting
        // renderer. This class is the authoritative signal used by all later
        // reconciliation layers so none of them can recreate a second share
        // toolbar/banner or expose the dark meeting surface underneath.
        document.body.classList.add('ds-native-mac-presenter-share');
        overlay.classList.remove('share-active','ds-ref-presenter-visible');
        inlinePresenter.hidden=true;
        label.hidden=true;
        sharedVideo.hidden=true;
        cameraTile.hidden=true;
        return;
      }
      document.body.classList.remove('ds-native-mac-presenter-share');
      overlay.classList.toggle('share-active',state.active);
      // On macOS the share-owning renderer must not visibly mirror the
      // captured screen back into itself. That recursive compositor path can
      // stall the renderer during active display capture. Keep the video
      // element attached to the stream for Pause-frame capture, but do not
      // paint it on the presenter surface.
      sharedVideo.hidden=!state.active||sameRendererPresenter;
      label.hidden=!state.active;
      inlinePresenter.hidden=!state.active;
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
        // The participant video dock is the single visible camera authority
        // during every share session, including when viewing another participant's
        // share. Never create a detached local camera tile beside the smart dock.
        if(cameraTile.srcObject)cameraTile.srcObject=null;
        cameraTile.hidden=true;
      }else{clearTimeout(macDockSyncTimer);macDockSyncTimer=0;document.body.classList.remove('ds-native-mac-presenter-share','ds-native-mac-show-meeting');sharedVideo.srcObject=null;cameraTile.srcObject=null;cameraTile.hidden=true;presenterCommitted=false;window.DominionShareAnnotation?.deactivate?.();clearCompanion();}
      // On macOS, defer the video-dock reconciliation out of the share-state
      // transaction, but do not skip it. Skipping it leaves a previously hidden
      // local tile hidden for the entire share session, so the presenter cannot
      // mirror live camera frames.
      if(sameRendererPresenter&&state.active)scheduleMacVideoDockSync(40);
      else window.DominionMeetingParity?.syncVideoDock?.();
      const featureState=window.DominionMeetingFeatures?.snapshot?.()||{};void bridge?.captureState?.({paused:state.paused,micOn:mediaState.micOn,cameraOn:effectiveLocalCameraOn(),cameraId:String(mediaState.cameraId||''),mirror:mediaState.mirror!==false,sourceName:state.sourceName,shareAudio:Boolean(state.options?.shareAudio),optimizeVideo:Boolean(state.options?.optimizeVideo),handRaised:Boolean(featureState.handRaised),recording:Boolean(featureState.recording),recordingPaused:Boolean(featureState.recordingPaused),companion:companionKind,companionOpen:Boolean(companionKind),participants:presenterParticipants()});
      syncMacCameraFramePump();
    }

    function commitPresenterMode(){
      const state=share.snapshot();
      if(!state.active||presenterCommitted)return false;
      presenterCommitted=true;
      // Native macOS presenter mode becomes authoritative here. Seed presenter
      // state and camera-frame transport immediately so initial video delivery
      // cannot depend on a later share-listener or media-listener turn.
      if(sameRendererPresenter){
        publishMacPresenterState();
        syncLocalPresenterMirror();
        syncMacCameraFramePump();
      }else bridge?.presenterCommitted?.({sourceName:state.sourceName,paused:state.paused});
      return true;
    }

    async function beginShare({replace=false}={}){
      if(replace&&window.DominionShareRuntimeAuthority2041?.open)return window.DominionShareRuntimeAuthority2041.open();
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

    async function openPickerWithPermission(){
      clearCompanion();
      const replacing=Boolean(share.snapshot().active);
      // While an active macOS share is running, New Share must open the
      // dedicated source-picker BrowserWindow. Keeping source discovery out of
      // the capture-owning meeting renderer avoids re-entering legacy meeting
      // layout/media code and gives the presenter a predictable replacement
      // flow with independent cancel/focus behavior.
      if(sameRendererPresenter&&replacing){
        const entry=await resolveShareEntry('granted');
        return entry.mode==='custom'||entry.mode==='native';
      }
      const approved=window.DominionShareRuntimeAuthority2041;
      if(approved?.open)return approved.open();
      return beginShare({replace:replacing});
    }

    button.addEventListener('click',event=>{
      event.currentTarget.blur();
      if(!share.snapshot().active&&window.DominionMeetingSecurity?.allows?.('share')===false){toast('The host disabled participant screen sharing.','error');return;}
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

    let shareWasActive=Boolean(share.snapshot().active);
    function cleanupStoppedShareSurfaces(){
      lastPresenterStateSignature='';
      stopMacCameraFramePump();stopMacRemoteFramePump();
      document.body.classList.remove('ds-native-mac-presenter-share','ds-native-mac-show-meeting');
      overlay.classList.remove('share-active','ds-ref-presenter-visible');
      try{window.DominionShareRuntimeAuthority2041?.close?.();}catch{}
      try{const pending=desktop?.sharePicker?.cancel?.();void Promise.resolve(pending).catch(()=>{});}catch{}
      try{window.DominionActiveShareHomeParity2041?.restoreMeeting?.();}catch{}
      // The green perimeter/toolbar/video dock are separate native BrowserWindows.
      // Explicitly notify the main process whenever renderer share state becomes
      // inactive so a stopped, failed, or replaced capture can never leave stale
      // presenter chrome on screen.
      try{const stopped=desktop?.share?.captureStopped?.();void Promise.resolve(stopped).catch(()=>{});}catch{}
    }
    share.onChange(state=>{
      // Physical-Mac diagnostic isolation: prove whether capture itself or the
      // share-active DOM/layout reconciliation is responsible for renderer
      // starvation. Production never sets this flag.
      if(!window.__DOMINION_QA_SKIP_SHARE_LAYOUT)applyLayout();
      const active=Boolean(state?.active);
      if(sameRendererPresenter&&active){
        // applyLayout intentionally returns early in native presenter mode.
        // Publish the authoritative share state separately so Pause/Resume and
        // other share-only transitions immediately reach the floating surfaces.
        publishMacPresenterState();
        syncMacCameraFramePump();
      }
      if(!active&&(shareWasActive||document.body.classList.contains('ds-native-mac-presenter-share')||overlay.classList.contains('share-active')))cleanupStoppedShareSurfaces();
      shareWasActive=active;
    });
    media.onChange(()=>{if(!share.snapshot().active){if(localPresenterMirror.srcObject)localPresenterMirror.srcObject=null;return;}if(sameRendererPresenter){syncLocalPresenterMirror();publishMacPresenterState();syncMacCameraFramePump();return;}applyLayout();});

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
      const finish=result=>{try{window.DominionPhysicalDiagnostics?.record?.('presenter-command-result',{command,qaCommandId,...(result||{})});}catch{}return result;};
      try{
        // Pause/Resume uses explicit target commands so direct execution plus
        // an acknowledged fallback can never toggle twice and cancel itself.
        if(command==='pause'||command==='pause-share'||command==='resume-share'){
          const current=Boolean(share.snapshot().paused);
          const target=command==='pause-share'?true:command==='resume-share'?false:!current;
          if(target!==current){
            if(target)await share.pause(sharedVideo);
            else await share.resume();
          }
          const actualPaused=Boolean(share.snapshot().paused);
          if(actualPaused!==target)return finish({handled:false,command,target,paused:actualPaused,error:'pause_state_not_reached'});
          return finish({handled:true,command,target,paused:actualPaused});
        }
        if(command==='stop'){clearCompanion();await share.stop();return finish({handled:true,command});}
        if(command==='audio'||command==='audio-on'||command==='audio-off'){
          const target=command==='audio-on'?true:command==='audio-off'?false:!media.snapshot().micOn;
          console.info('[DominionStar Meet] presenter AV intent',{kind:'microphone',target,command});
          await media.setMicrophone(target);if(sameRendererPresenter)publishMacPresenterState();else applyLayout();return finish({handled:true,command,target,actual:Boolean(media.snapshot().micOn)});
        }
        if(command==='video'||command==='video-on'||command==='video-off'){
          const target=command==='video-on'?true:command==='video-off'?false:!media.snapshot().cameraOn;
          console.info('[DominionStar Meet] presenter AV intent',{kind:'camera',target,command});
          await media.setCamera(target);
          if(sameRendererPresenter){scheduleMacVideoDockSync(0);publishMacPresenterState();syncMacCameraFramePump();}
          else applyLayout();
          const videoState=media.snapshot(),actualCamera=Boolean(videoState.cameraOn),videoLive=Boolean(videoState.videoLive);
          if(actualCamera!==target||(target&&!videoLive))return finish({handled:false,command,target,actual:actualCamera,videoLive,error:'camera_state_not_reached'});
          return finish({handled:true,command,target,actual:actualCamera,videoLive});
        }
        if(command.startsWith('participant:')){
          const parts=command.split(':'),action=String(parts[1]||''),id=decodeURIComponent(parts.slice(2).join(':')||'');
          if(!id)return {handled:false,command,error:'participant_id_missing'};
          const controls=window.DominionParticipantControls,row=overlay.querySelector(`#participantRoster [data-participant-id="${CSS.escape(id)}"]`);
          if(action==='mute'){await controls?.sendParticipant?.(id,'host:mute');return {handled:true,command};}
          if(action==='ask-unmute'){await controls?.sendParticipant?.(id,'host:ask-unmute');return {handled:true,command};}
          if(action==='stop-video'){await controls?.sendParticipant?.(id,'host:stop-video');return {handled:true,command};}
          if(action==='ask-video'){await controls?.sendParticipant?.(id,'host:ask-start-video');return {handled:true,command};}
          if(action==='chat'){window.DominionRuntimeStability?.setParticipants?.(false);window.DominionRuntimeStability?.setChat?.(true);controls?.openParticipantChat?.(id);setCompanion('chat');return {handled:true,command};}
          if(action==='spotlight'){await controls?.toggleSpotlightParticipant?.(id);return {handled:true,command};}
          if(action==='rename'){window.DominionRuntimeStability?.setChat?.(false);window.DominionRuntimeStability?.setParticipants?.(true);setCompanion('participants');controls?.renameParticipant?.(id,String(row?.dataset.participantName||'Participant'));return {handled:true,command};}
          if(action==='cohost'){const role=String(row?.dataset.participantRole||'participant').toLowerCase();await desktop?.meeting?.setCohost?.(id,role!=='cohost');return {handled:true,command};}
          if(action==='remove'){await desktop?.meeting?.removeParticipant?.(id);return {handled:true,command};}
          return {handled:false,command,error:'participant_action_unavailable'};
        }
        if(command==='participants'){
          window.DominionShareAnnotation?.deactivate?.();
          window.DominionRuntimeStability?.setChat?.(false);
          window.DominionRuntimeStability?.setParticipants?.(true);
          setCompanion('participants');return {handled:true,command};
        }
        if(command==='chat'){
          window.DominionShareAnnotation?.deactivate?.();
          window.DominionRuntimeStability?.setParticipants?.(false);
          window.DominionRuntimeStability?.setChat?.(true);
          setCompanion('chat');return {handled:true,command};
        }
        if(command==='annotate'){
          window.DominionRuntimeStability?.setParticipants?.(false);
          window.DominionRuntimeStability?.setChat?.(false);
          lockNativeAnnotationRenderer();
          const active=Boolean(window.DominionShareAnnotation?.toggle?.());
          lockNativeAnnotationRenderer();
          setCompanion(active?'annotate':'');
          if(!sameRendererPresenter)applyLayout();
          return {handled:true,command};
        }
        if(command.startsWith('annotate-')){
          lockNativeAnnotationRenderer();
          const annotation=window.DominionShareAnnotation;
          const action=command.slice('annotate-'.length);
          if(action==='close'){annotation?.deactivate?.();clearCompanion();return {handled:true,command};}
          if(!annotation?.snapshot?.().active)annotation?.activate?.();
          lockNativeAnnotationRenderer();
          if(['pen','highlight','laser','erase'].includes(action))annotation?.setMode?.(action);
          else if(action.startsWith('shape-'))annotation?.setMode?.(action.slice('shape-'.length));
          else if(action.startsWith('width-'))annotation?.setWidth?.(action.slice('width-'.length));
          else if(action==='undo')annotation?.undo?.();
          else if(action==='clear')annotation?.clear?.();
          else if(action==='color-red')annotation?.setColor?.('#ff3b30');
          else if(action==='color-blue')annotation?.setColor?.('#2d8cff');
          else if(action==='color-green')annotation?.setColor?.('#28c76f');
          else if(action==='color-white')annotation?.setColor?.('#ffffff');
          else return {handled:false,command};
          setCompanion('annotate');
          return {handled:true,command};
        }
        if(command==='new-share'){await openPickerWithPermission();return {handled:true,command};}
        if(command==='polls'){await ensureNativeMeetingVisible();window.DominionMeetingTools?.openPolls?.();return {handled:true,command};}
        if(command==='whiteboard'){await ensureNativeMeetingVisible();window.DominionMeetingTools?.openWhiteboard?.();return {handled:true,command};}
        if(command==='apps'){await ensureNativeMeetingVisible();window.DominionMeetingTools?.openApps?.();return {handled:true,command};}
        if(command==='host-tools'){await ensureNativeMeetingVisible();const host=q('#roomHostTools');if(host&&!host.hidden){window.DominionMeetingParity?.openSecurity?.(host);return {handled:true,command};}return {handled:false,command,error:'host_tools_unavailable'};}
        if(command==='audio-settings'){await ensureNativeMeetingVisible();const d=q('#settingsDialog');if(d&&!d.open)d.showModal();void window.DominionAVSettings?.openAudio?.();return {handled:true,command};}
        if(command==='video-settings'){await ensureNativeMeetingVisible();const d=q('#settingsDialog');if(d&&!d.open)d.showModal();void window.DominionAVSettings?.openVideo?.();return {handled:true,command};}
        if(command==='captions'){await ensureNativeMeetingVisible();q('#roomCaptions')?.click();return {handled:true,command};}
        if(command==='layout-speaker'){window.DominionMeetingFeatures?.setVideoLayout?.('speaker');return {handled:true,command};}
        if(command==='layout-gallery'){window.DominionMeetingFeatures?.setVideoLayout?.('gallery');return {handled:true,command};}
        if(command==='layout-hide'){window.DominionMeetingFeatures?.setVideoLayout?.('hide');return {handled:true,command};}
        if(command.startsWith('reaction:')){await window.DominionMeetingFeatures?.sendReaction?.(command.slice('reaction:'.length));if(sameRendererPresenter)publishMacPresenterState();else applyLayout();return {handled:true,command};}
        if(command==='toggle-hand'){await window.DominionMeetingFeatures?.toggleRaiseHand?.();if(sameRendererPresenter)publishMacPresenterState();else applyLayout();return {handled:true,command};}
        if(command==='record'){await window.DominionMeetingFeatures?.toggleRecording?.();if(sameRendererPresenter)publishMacPresenterState();else applyLayout();return {handled:true,command};}
        if(command==='stop-record'){await window.DominionMeetingFeatures?.stopRecording?.();if(sameRendererPresenter)publishMacPresenterState();else applyLayout();return {handled:true,command};}
        if(command==='show-meeting'){clearCompanion();window.focus();return {handled:true,command};}
        return {handled:false,command};
      }catch(error){toast(error?.message||'Share control failed.','error');return finish({handled:false,command,error:String(error?.message||error||'share_control_failed')});}
    }
    window.__DominionPresenterDispatch=dispatchPresenterCommand;
    bridge?.onPresenterCommand?.(rawCommand=>dispatchPresenterCommand(rawCommand));

    window.DominionShareIntegration=Object.freeze({open:options=>beginShare(options||{}),stop:options=>share.stop(options||{}),state:()=>share.snapshot(),screenCaptureProven:()=>locallyProven(),commitPresenterMode,dispatchPresenterCommand});
    window.addEventListener('beforeunload',stopMacRemoteFramePump,{once:true});
  }
  void boot().catch(error=>console.error('[DominionStar Meet] Share Integration boot failed.',error)).finally(()=>{window.__DominionShareIntegrationBooting=false;});
})();