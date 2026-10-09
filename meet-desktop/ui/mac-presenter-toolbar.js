(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{};
  // During an active macOS share, the floating presenter surface uses the
  // acknowledged native bridge as the command authority. That bridge wakes and
  // coordinates the capture-owning meeting renderer; direct renderer IPC is a
  // bounded fallback only when the native presenter bridge is unavailable.
  const nativeBridge=desktop.macShare||null;
  const rendererBridge=desktop.presenter||null;
  const stateBridge=nativeBridge||rendererBridge;
  const q=s=>document.querySelector(s);
  const toolbar=q('#toolbar'),layoutMenu=q('#layoutMenu'),moreMenu=q('#moreMenu');
  let hideTimer=0,lastPointerAt=Date.now(),menuOpen=false,nativeHidden=false,lastForceRevealAt=0,lastState={paused:false,micOn:false,cameraOn:true};
  const AUTO_HIDE_MS=2400;
  let qaPresenterTrace=false;void desktop.environment?.().then(env=>{qaPresenterTrace=Boolean(env?.qaPresenterFixtures);}).catch(()=>{});

  const logo=q('#brandLogo');if(logo&&desktop.brand?.logoUrl)logo.src=desktop.brand.logoUrl;
  const menusOpen=()=>Boolean(!layoutMenu?.hidden||!moreMenu?.hidden);
  const setMenuState=async open=>{menuOpen=Boolean(open);toolbar?.classList.toggle('menu-open',menuOpen);try{await nativeBridge?.setMenuOpen?.(menuOpen);}catch{}};
  const setNativeHidden=hidden=>{const next=Boolean(hidden);if(nativeHidden===next)return;nativeHidden=next;try{void nativeBridge?.setToolbarHidden?.(next);}catch{}};
  const reveal=()=>{lastPointerAt=Date.now();toolbar?.classList.remove('auto-hidden');setNativeHidden(false);if(hideTimer){clearTimeout(hideTimer);hideTimer=0;}};
  const scheduleHide=()=>{if(hideTimer)clearTimeout(hideTimer);if(menusOpen())return;hideTimer=setTimeout(()=>{hideTimer=0;if(menusOpen())return;if(Date.now()-lastPointerAt<AUTO_HIDE_MS-80){scheduleHide();return;}toolbar?.classList.add('auto-hidden');setNativeHidden(true);},AUTO_HIDE_MS);};
  const closeMenus=()=>{if(layoutMenu)layoutMenu.hidden=true;if(moreMenu)moreMenu.hidden=true;void setMenuState(false);scheduleHide();};
  // A mere "sent:true" is not proof that the meeting renderer actually ran
  // the command. Require direct execution, explicit acknowledgement, handled,
  // or ok:true before the toolbar treats a click as successful.
  const accepted=result=>Boolean(result)&&result.sent!==false&&result.ok!==false&&(result.ok===true||result.direct===true||result.acknowledged===true||result.handled===true);

  async function sendNative(command){
    if(!nativeBridge?.command)throw new Error('mac_presenter_transport_unavailable');
    const normalized=String(command||'');
    const result=await nativeBridge.command(normalized);
    if(accepted(result))return result;
    throw new Error(result?.error||'mac_presenter_command_not_acknowledged');
  }

  async function sendRenderer(command){
    if(!rendererBridge?.command)throw new Error('presenter_transport_unavailable');
    const result=await rendererBridge.command(command);
    if(accepted(result))return result;
    throw new Error(result?.error||'presenter_command_not_confirmed');
  }

  const send=async command=>{
    reveal();const normalized=String(command||'');
    try{
      // The native macOS bridge now executes the meeting renderer dispatcher
      // directly first and falls back to acknowledged queue delivery only if
      // direct execution is unavailable.
      if(nativeBridge?.command)return await sendNative(normalized);
      if(rendererBridge?.command)return await sendRenderer(normalized);
      throw new Error('presenter_transport_unavailable');
    }finally{scheduleHide();}
  };

  q('#layoutButton')?.addEventListener('click',event=>{event.stopPropagation();reveal();if(moreMenu)moreMenu.hidden=true;if(layoutMenu)layoutMenu.hidden=!layoutMenu.hidden;void setMenuState(menusOpen());});
  q('#moreButton')?.addEventListener('click',event=>{event.stopPropagation();reveal();if(layoutMenu)layoutMenu.hidden=true;if(moreMenu)moreMenu.hidden=!moreMenu.hidden;void setMenuState(menusOpen());});
  q('#stopShare')?.addEventListener('click',async event=>{
    const button=event.currentTarget;if(button.disabled)return;const label=q('#stopShareLabel');
    button.disabled=true;button.setAttribute('aria-busy','true');if(label)label.textContent='Stopping…';
    try{await send('stop');}
    catch(error){console.error('[DominionStar Meet] Stop share command failed.',error);button.disabled=false;button.removeAttribute('aria-busy');if(label)label.textContent='Stop Share';toolbar?.classList.add('command-error');setTimeout(()=>toolbar?.classList.remove('command-error'),1200);}
  });
  const applyAcknowledgedAvState=command=>{
    if(command==='audio-on'||command==='audio-off')lastState={...lastState,micOn:command==='audio-on'};
    if(command==='video-on'||command==='video-off')lastState={...lastState,cameraOn:command==='video-on'};
    const audio=q('[data-command="audio"]'),video=q('[data-command="video"]'),audioLabel=q('#audioLabel'),videoLabel=q('#videoLabel');
    audio?.classList.toggle('is-off',!lastState.micOn);video?.classList.toggle('is-off',!lastState.cameraOn);
    if(audioLabel)audioLabel.textContent=lastState.micOn?'Mute':'Unmute';
    if(videoLabel)videoLabel.textContent=lastState.cameraOn?'Stop Video':'Start Video';
  };
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',async event=>{
    const control=event.currentTarget;if(qaPresenterTrace)console.error(`QA_MAC_TOOLBAR_CLICK command=${String(control?.dataset?.command||'')} disabled=${control?.disabled?1:0} busy=${control?.getAttribute('aria-busy')==='true'?1:0}`);
    if(control.disabled||control.getAttribute('aria-busy')==='true')return;let command=String(control.dataset.command||'');
    if(command==='audio')command=Boolean(lastState?.micOn)?'audio-off':'audio-on';
    if(command==='video')command=Boolean(lastState?.cameraOn)?'video-off':'video-on';
    if(command==='pause')command=Boolean(lastState?.paused)?'resume-share':'pause-share';
    if(command==='annotate'&&String(lastState?.companion||'')==='annotate')command='annotate-close';
    closeMenus();control.disabled=true;control.classList.add('command-pending');control.setAttribute('aria-busy','true');
    try{await send(command);applyAcknowledgedAvState(command);}
    catch(error){console.error(`[DominionStar Meet] Presenter command failed: ${command}`,error);control.classList.add('command-error');setTimeout(()=>control.classList.remove('command-error'),1000);}
    finally{control.disabled=false;control.classList.remove('command-pending');control.removeAttribute('aria-busy');}
  }));
  document.addEventListener('pointerdown',event=>{reveal();if(!event.target.closest('.menu-wrap'))closeMenus();},{capture:true});
  window.addEventListener('pointermove',()=>{reveal();scheduleHide();},{passive:true});
  window.addEventListener('pointerenter',()=>{reveal();scheduleHide();},{passive:true});
  window.addEventListener('focus',()=>{reveal();scheduleHide();});

  stateBridge?.onState?.(state=>{
    lastState={...lastState,...state};
    const forcedAt=Math.max(0,Number(state?.forceRevealAt)||0);if(forcedAt>lastForceRevealAt){lastForceRevealAt=forcedAt;reveal();scheduleHide();}
    const paused=Boolean(state?.paused),micOn=Boolean(state?.micOn),cameraOn=Boolean(state?.cameraOn);
    const pause=q('#pauseLabel'),pauseGlyph=q('#pauseGlyph'),toolbar=q('#toolbar'),audio=q('#audioLabel'),video=q('#videoLabel'),label=q('#shareStateLabel'),source=q('#shareSourceLabel'),audioFlag=q('#shareAudioFlag'),optimize=q('#shareOptimizeFlag'),record=q('#recordCommand'),hostTools=q('#presenterHostTools');
    toolbar?.classList.toggle('is-paused',paused);
    if(pause)pause.textContent=paused?'Resume':'Pause Share';
    if(pauseGlyph)pauseGlyph.innerHTML=paused?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5 18 12 8 18.5z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
    if(audio)audio.textContent=micOn?'Mute':'Unmute';if(video)video.textContent=cameraOn?'Stop Video':'Start Video';
    const audioButton=q('[data-command="audio"]'),videoButton=q('[data-command="video"]');
    const voiceLevel=Math.max(0,Math.min(1,Number(state?.voiceLevel)||0));
    if(qaPresenterTrace&&(voiceLevel>0||state?.speaking))console.error(`QA_MAC_TOOLBAR_VOICE level=${voiceLevel.toFixed(3)} speaking=${state?.speaking?1:0} mic=${micOn?1:0}`);
    const speaking=Boolean(micOn&&state?.speaking&&voiceLevel>0);
    const voiceBucket=!speaking?0:voiceLevel>.55?3:voiceLevel>.22?2:1;
    audioButton?.classList.toggle('is-off',!micOn);audioButton?.classList.toggle('is-speaking',speaking);videoButton?.classList.toggle('is-off',!cameraOn);
    if(audioButton)audioButton.dataset.voiceLevel=String(voiceBucket);
    audioButton?.setAttribute('aria-pressed',String(!micOn));videoButton?.setAttribute('aria-pressed',String(!cameraOn));
    if(label)label.textContent=paused?'Share paused':'You are screen sharing';
    if(source){const raw=String(state?.sourceName||'Shared content');source.textContent=/screen|desktop|display|entire/i.test(raw)?'Entire screen':raw;}
    if(audioFlag)audioFlag.hidden=!state?.shareAudio;if(optimize)optimize.hidden=!state?.optimizeVideo;
    if(hostTools){const self=(state?.participants||[]).find(item=>item?.self),role=String(self?.role||'participant').toLowerCase();hostTools.hidden=!['host','cohost'].includes(role);}
    if(record)record.textContent=state?.recording?(state?.recordingPaused?'Resume recording':'Pause recording'):'Record meeting';
  });

  window.DominionMacPresenterToolbar=Object.freeze({version:'2.0.45-stateful-share-chrome',transport:nativeBridge?.command?'macShare-direct-first':rendererBridge?.command?'presenter-fallback':'unavailable',state:()=>({...lastState})});
  reveal();scheduleHide();
})();