(()=>{
  'use strict';
  const desktop=window.dominionDesktop||{};
  // The floating macOS surface owns native-only layout/show-meeting actions,
  // but meeting/media actions must execute in the share-owning renderer. The
  // generic presenter bridge reaches window.__DominionPresenterDispatch via
  // the direct renderer authority in share-service.mjs, which is the same
  // renderer that owns microphone, camera, display capture, chat and roster.
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
  // the command. Physical-Mac capture can keep the renderer alive while a
  // one-way delivery never reaches the command callback. Only accept a direct
  // execution, an explicit acknowledgement, a handled result, or ok:true.
  const accepted=result=>Boolean(result)&&result.sent!==false&&(result.direct===true||result.acknowledged===true||result.handled===true||result.ok===true);

  async function sendThrough(bridge,command,label){
    if(!bridge?.command)throw new Error(`${label}_transport_unavailable`);
    const result=await bridge.command(command);
    if(accepted(result))return result;
    throw new Error(result?.error||`${label}_command_not_confirmed`);
  }

  const send=async command=>{
    reveal();const normalized=String(command||'');
    try{
      // Layout and explicit meeting visibility are BrowserWindow concerns and
      // stay on the native Mac overlay. Everything else first tries the direct
      // renderer authority. If that returns only an unconfirmed "sent" result,
      // immediately fall back to the acknowledged Mac delivery path.
      if(NATIVE_ONLY_COMMANDS.has(normalized)){
        try{return await sendThrough(nativeBridge,normalized,'mac_presenter');}
        catch(error){if(rendererBridge?.command)return sendThrough(rendererBridge,normalized,'presenter');throw error;}
      }
      try{return await sendThrough(rendererBridge,normalized,'presenter');}
      catch(error){if(nativeBridge?.command)return sendThrough(nativeBridge,normalized,'mac_presenter');throw error;}
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

  window.DominionMacPresenterToolbar=Object.freeze({version:'2.0.41-confirmed-command-delivery',transport:rendererBridge?.command?'presenter-confirmed-first':nativeBridge?.command?'macShare-acknowledged':'unavailable',state:()=>({...lastState})});
  reveal();scheduleHide();
})();