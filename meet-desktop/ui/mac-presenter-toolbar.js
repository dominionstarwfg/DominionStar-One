(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{};
  // The floating macOS surface owns native-only layout/show-meeting actions.
  // Live meeting/media controls execute directly in the capture-owning meeting
  // renderer first; the acknowledged native queue remains a bounded fallback.
  const nativeBridge=desktop.macShare||null;
  const rendererBridge=desktop.presenter||null;
  const stateBridge=nativeBridge||rendererBridge;
  const q=s=>document.querySelector(s);
  const toolbar=q('#toolbar'),layoutMenu=q('#layoutMenu'),moreMenu=q('#moreMenu');
  let hideTimer=0,lastPointerAt=Date.now(),menuOpen=false,lastState={paused:false,micOn:false,cameraOn:true};
  const AUTO_HIDE_MS=2300;
  const NATIVE_ONLY_COMMANDS=new Set(['layout-speaker','layout-gallery','layout-hide','show-meeting']);

  const logo=q('#brandLogo');if(logo&&desktop.brand?.logoUrl)logo.src=desktop.brand.logoUrl;
  const menusOpen=()=>Boolean(!layoutMenu?.hidden||!moreMenu?.hidden);
  const setMenuState=async open=>{menuOpen=Boolean(open);toolbar?.classList.toggle('menu-open',menuOpen);try{await nativeBridge?.setMenuOpen?.(menuOpen);}catch{}};
  const reveal=()=>{lastPointerAt=Date.now();toolbar?.classList.remove('auto-hidden');if(hideTimer){clearTimeout(hideTimer);hideTimer=0;}};
  const scheduleHide=()=>{if(hideTimer)clearTimeout(hideTimer);if(menusOpen())return;hideTimer=setTimeout(()=>{hideTimer=0;if(menusOpen())return;if(Date.now()-lastPointerAt<AUTO_HIDE_MS-80){scheduleHide();return;}toolbar?.classList.add('auto-hidden');},AUTO_HIDE_MS);};
  const closeMenus=()=>{if(layoutMenu)layoutMenu.hidden=true;if(moreMenu)moreMenu.hidden=true;void setMenuState(false);scheduleHide();};
  // A mere "sent:true" is not proof that the meeting renderer actually ran
  // the command. Require direct execution, explicit acknowledgement, handled,
  // or ok:true before the toolbar treats a click as successful.
  const accepted=result=>Boolean(result)&&result.sent!==false&&(result.direct===true||result.acknowledged===true||result.handled===true);

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
      // One command path only. On physical macOS, the native presenter bridge
      // owns delivery for every toolbar action and waits for an acknowledgement
      // from the live meeting renderer. This prevents a failed direct attempt
      // from being followed by a second duplicate command through another route.
      if(nativeBridge?.command)return await sendNative(normalized);
      // Non-mac/test fallback only.
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
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',async event=>{
    const control=event.currentTarget,command=String(control.dataset.command||'');closeMenus();control.classList.add('command-pending');control.setAttribute('aria-busy','true');
    try{await send(command);}
    catch(error){console.error(`[DominionStar Meet] Presenter command failed: ${command}`,error);control.classList.add('command-error');setTimeout(()=>control.classList.remove('command-error'),1000);}
    finally{control.classList.remove('command-pending');control.removeAttribute('aria-busy');}
  }));
  document.addEventListener('pointerdown',event=>{reveal();if(!event.target.closest('.menu-wrap'))closeMenus();},{capture:true});
  window.addEventListener('pointermove',()=>{reveal();scheduleHide();},{passive:true});
  window.addEventListener('pointerenter',()=>{reveal();scheduleHide();},{passive:true});
  window.addEventListener('focus',()=>{reveal();scheduleHide();});

  stateBridge?.onState?.(state=>{
    lastState={...lastState,...state};
    const paused=Boolean(state?.paused),micOn=Boolean(state?.micOn),cameraOn=Boolean(state?.cameraOn);
    const pause=q('#pauseLabel'),audio=q('#audioLabel'),video=q('#videoLabel'),label=q('#shareStateLabel'),source=q('#shareSourceLabel'),audioFlag=q('#shareAudioFlag'),optimize=q('#shareOptimizeFlag'),record=q('#recordCommand');
    if(pause)pause.textContent=paused?'Resume':'Pause';if(audio)audio.textContent=micOn?'Mute':'Unmute';if(video)video.textContent=cameraOn?'Stop Video':'Start Video';
    if(label)label.textContent=paused?'Share paused':'You are screen sharing';
    if(source){const raw=String(state?.sourceName||'Shared content');source.textContent=/screen|desktop|display|entire/i.test(raw)?'Entire screen':raw;}
    if(audioFlag)audioFlag.hidden=!state?.shareAudio;if(optimize)optimize.hidden=!state?.optimizeVideo;
    if(record)record.textContent=state?.recording?(state?.recordingPaused?'Resume recording':'Pause recording'):'Record meeting';
  });

  window.DominionMacPresenterToolbar=Object.freeze({version:'2.0.43-single-ack-authority',transport:nativeBridge?.command?'macShare-single-ack':rendererBridge?.command?'presenter-fallback':'unavailable',state:()=>({...lastState})});
  reveal();scheduleHide();
})();