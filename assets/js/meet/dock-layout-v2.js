(()=>{
  'use strict';
  const dock=document.getElementById('filmstrip');
  const track=document.getElementById('filmstripTrack');
  if(!dock||!track)return;
  const interactive='button,input,select,textarea,a,[role="button"],[contenteditable="true"],video';
  const storageKey='ds-meet-dock-layout-v3';
  let drag=null;
  let manual=false;
  let lastMode='';

  const saved=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}};
  const store=()=>{try{const rect=dock.getBoundingClientRect();localStorage.setItem(storageKey,JSON.stringify({left:rect.left,top:rect.top,orientation:dock.dataset.orientation||'vertical'}))}catch{}};
  const count=()=>track.querySelectorAll('.remote-tile:not([hidden])').length;
  const visibleLimit=()=>Math.max(1,Math.min(5,Number(dock.style.getPropertyValue('--dock-visible-count'))||5));
  const announce=()=>window.dispatchEvent(new CustomEvent('dominionstar:dock-layout',{detail:{orientation:dock.dataset.orientation,count:count(),visible:visibleLimit()}}));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  function place(edge,{preserve=false}={}){
    const margin=12,topSafe=60,bottomSafe=86;
    const rect=dock.getBoundingClientRect();
    const horizontal=edge==='top'||edge==='bottom';
    dock.dataset.orientation=horizontal?'horizontal':'vertical';
    dock.dataset.edge=edge;
    dock.classList.toggle('dock-horizontal',horizontal);
    dock.classList.toggle('dock-vertical',!horizontal);
    let left=edge==='left'?margin:edge==='right'?innerWidth-rect.width-margin:clamp((innerWidth-rect.width)/2,margin,Math.max(margin,innerWidth-rect.width-margin));
    let top=edge==='top'?topSafe:edge==='bottom'?innerHeight-rect.height-bottomSafe:clamp(rect.top||topSafe,topSafe,Math.max(topSafe,innerHeight-rect.height-bottomSafe));
    if(preserve){const old=saved();if(old){left=clamp(old.left,margin,Math.max(margin,innerWidth-rect.width-margin));top=clamp(old.top,topSafe,Math.max(topSafe,innerHeight-rect.height-bottomSafe));}}
    Object.assign(dock.style,{left:`${Math.round(left)}px`,top:`${Math.round(top)}px`,right:'auto',bottom:'auto'});
    announce();
  }

  function applyLayout(layout={}){
    const mode=layout.mode||(innerWidth<560||innerHeight<390?'mini':innerWidth<820||innerHeight<560?'compact':innerWidth<1180||innerHeight<700?'narrow':'wide');
    const changed=mode!==lastMode;
    lastMode=mode;
    document.documentElement.dataset.desktopLayout=mode;
    document.documentElement.dataset.nativeWindowStyle=layout.nativeWindowStyle||'';
    dock.style.setProperty('--dock-visible-count',String(Math.min(5,Math.max(1,Number(layout.maxVisibleTiles)||5))));
    if(mode==='wide'){
      if(!manual||changed)place('right',{preserve:manual&&!changed});
    }else{
      place('top');
    }
    dock.classList.toggle('dock-mini',mode==='mini');
    document.body.classList.toggle('desktop-mini-window',mode==='mini');
  }

  dock.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest(interactive))return;
    const rect=dock.getBoundingClientRect();
    drag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,active:false};
    dock.setPointerCapture?.(event.pointerId);
  });
  dock.addEventListener('pointermove',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!drag.active&&Math.hypot(dx,dy)<4)return;
    drag.active=true;manual=true;dock.classList.add('is-dragging');
    const left=clamp(drag.left+dx,8,Math.max(8,innerWidth-dock.offsetWidth-8));
    const top=clamp(drag.top+dy,54,Math.max(54,innerHeight-dock.offsetHeight-82));
    Object.assign(dock.style,{left:`${left}px`,top:`${top}px`,right:'auto',bottom:'auto'});
  });
  dock.addEventListener('pointerup',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(drag.active){
      const rect=dock.getBoundingClientRect();
      const edges={left:rect.left,right:innerWidth-rect.right,top:rect.top-54,bottom:innerHeight-rect.bottom-82};
      const edge=Object.entries(edges).sort((a,b)=>a[1]-b[1])[0][0];
      place(edge);store();
    }
    dock.classList.remove('is-dragging');dock.releasePointerCapture?.(event.pointerId);drag=null;
  });
  dock.addEventListener('pointercancel',()=>{dock.classList.remove('is-dragging');drag=null;});

  const desktop=window.dominionDesktop;
  desktop?.onWindowLayout?.(applyLayout);
  desktop?.getWindowLayout?.().then(layout=>layout&&applyLayout(layout)).catch(()=>applyLayout());
  let resizeFrame=0;
  addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>applyLayout());},{passive:true});
  new MutationObserver(()=>announce()).observe(track,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  const previous=saved();
  if(previous){manual=true;place(previous.orientation==='horizontal'?'top':'right',{preserve:true});}
  else applyLayout();
})();

// RC13 quality hardening. This layer is intentionally web-delivered so the same
// camera, screen-share, waiting-room and invite-link behavior applies in both
// DominionStar desktop and supported browser clients without coupling routine
// meeting fixes to the native installer.
(()=>{
  'use strict';
  const engine=window.DominionStarMeetingEngine;
  if(!engine||engine.__dsQualityHardening)return;
  Object.defineProperty(engine,'__dsQualityHardening',{value:'rc13-media-room-parity',enumerable:false});

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));
  const now=()=>globalThis.performance?.now?.()||Date.now();
  const retryableCameraError=error=>{
    const name=String(error?.name||'');
    const message=String(error?.message||'').toLowerCase();
    if(['NotAllowedError','SecurityError','OverconstrainedError'].includes(name))return false;
    return ['NotReadableError','AbortError','TrackStartError'].includes(name)||/could not start video source|device.*busy|camera.*busy|track.*start/.test(message);
  };
  const cameraError=error=>{
    const wrapped=new Error('Camera could not start after automatic recovery. Make sure no other app is holding the camera, then try Start Video once.');
    wrapped.name=error?.name||'CameraUnavailableError';
    wrapped.cause=error;
    return wrapped;
  };

  // Canonicalize legacy/native deep links. Desktop deep links historically used
  // ?meeting= while the web join flow reads ?room=. Supporting both prevents a
  // valid invitation from opening an empty join form.
  try{
    const url=new URL(location.href);
    const legacy=url.searchParams.get('meeting');
    if(legacy&&!url.searchParams.get('room')){
      url.searchParams.set('room',legacy);
      url.searchParams.delete('meeting');
      history.replaceState(history.state,'',`${url.pathname}?${url.searchParams.toString()}${url.hash}`);
    }
  }catch(_){}

  // macOS/USB cameras often need a short hardware-release interval after Video
  // Off. Serialize camera intent and transparently retry only transient capture
  // failures. Permission/security failures still fail immediately.
  const originalToggleVideo=engine.toggleVideo?.bind(engine);
  let cameraQueue=Promise.resolve();
  let cameraIntent=0;
  let lastVideoOffAt=-Infinity;
  if(originalToggleVideo){
    engine.toggleVideo=enabled=>{
      const target=Boolean(enabled);
      const intent=++cameraIntent;
      if(!target){
        lastVideoOffAt=now();
        return originalToggleVideo(false);
      }
      const run=async()=>{
        const releaseAge=now()-lastVideoOffAt;
        if(releaseAge<700)await sleep(700-releaseAge);
        const retryDelays=[0,320,760,1350];
        let lastError=null;
        for(let attempt=0;attempt<retryDelays.length;attempt++){
          if(intent!==cameraIntent)return false;
          if(retryDelays[attempt])await sleep(retryDelays[attempt]);
          if(intent!==cameraIntent)return false;
          try{
            const result=await originalToggleVideo(true);
            if(intent!==cameraIntent){await originalToggleVideo(false).catch?.(()=>{});return false;}
            const snapshot=engine.snapshot?.()||{};
            if(result!==false&&snapshot?.mediaState?.video!==false)return true;
            lastError=new Error('Camera did not enter an active state.');
          }catch(error){
            lastError=error;
            if(!retryableCameraError(error))throw error;
          }
        }
        throw cameraError(lastError);
      };
      cameraQueue=cameraQueue.catch(()=>{}).then(run);
      return cameraQueue;
    };
  }

  // Only one share transaction may own the native/browser picker at a time.
  // Confirm that a real live display track was returned and preserve camera
  // intent across share startup so sharing a screen never silently turns video off.
  const originalShareScreen=engine.shareScreen?.bind(engine);
  let shareFlight=null;
  if(originalShareScreen){
    engine.shareScreen=()=>{
      if(shareFlight)return shareFlight;
      const videoWasOn=Boolean(engine.snapshot?.()?.mediaState?.video);
      shareFlight=(async()=>{
        const stream=await originalShareScreen();
        const displayTrack=stream?.getVideoTracks?.()[0]||null;
        if(!displayTrack||displayTrack.readyState!=='live'){
          await engine.stopScreenShare?.().catch?.(()=>{});
          throw new Error('Screen sharing did not produce a live display track. Open Share Screen and choose the source again.');
        }
        const after=engine.snapshot?.()||{};
        if(videoWasOn&&after?.mediaState?.video===false){
          await engine.toggleVideo(true).catch(()=>{});
        }
        return stream;
      })().finally(()=>{shareFlight=null;});
      return shareFlight;
    };
  }

  // Waiting-room actions are idempotent from the UI perspective. Prevent rapid
  // duplicate Admit/Deny clicks from creating competing broadcasts, and retry a
  // transient transport failure once while preserving host/co-host authorization.
  const wrapParticipantAction=name=>{
    const original=engine[name]?.bind(engine);
    if(!original)return;
    const inflight=new Map();
    engine[name]=participantId=>{
      const id=String(participantId||'');
      if(!id)return Promise.reject(new Error(`A participant is required to ${name}.`));
      if(inflight.has(id))return inflight.get(id);
      const task=(async()=>{
        try{return await original(id);}
        catch(first){await sleep(300);return original(id).catch(()=>{throw first;});}
      })().finally(()=>inflight.delete(id));
      inflight.set(id,task);
      return task;
    };
  };
  wrapParticipantAction('admit');
  wrapParticipantAction('deny');

  // Recover presence/peer state after sleep, Wi-Fi transitions, tab restoration,
  // or a desktop window returning from the background. This is deliberately
  // bounded and does not bypass waiting-room admission or role checks.
  let recoveryTimer=0;
  const scheduleRecovery=()=>{
    clearTimeout(recoveryTimer);
    recoveryTimer=setTimeout(()=>{
      engine.resyncPresence?.().catch?.(()=>{});
      engine.recoverPeers?.().catch?.(()=>{});
    },450);
  };
  addEventListener('online',scheduleRecovery,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleRecovery();});

  // Keep meeting error feedback usable. One hardware failure should produce one
  // message, not a stack of identical toasts that covers the meeting stage.
  const toastLayer=document.getElementById('toastLayer');
  if(toastLayer){
    const recent=new Map();
    const clean=()=>{
      const nodes=[...toastLayer.children];
      for(const node of nodes){
        let text=String(node.textContent||'').trim();
        if(/could not start video source/i.test(text)){
          text='Camera is recovering. If it remains off, make sure no other app is using the camera and try Start Video once.';
          node.textContent=text;
        }
        const seen=recent.get(text)||0;
        const time=Date.now();
        if(text&&time-seen<2600){node.remove();continue;}
        if(text)recent.set(text,time);
      }
      while(toastLayer.children.length>3)toastLayer.firstElementChild?.remove();
      for(const [key,time] of recent){if(Date.now()-time>7000)recent.delete(key);}
    };
    new MutationObserver(clean).observe(toastLayer,{childList:true,subtree:true});
  }

  window.DominionMeetQuality=Object.freeze({
    version:'rc13-media-room-parity',
    canonicalInviteLink({roomId='',passcode='',waiting=false}={}){
      const room=String(roomId).replace(/\s/g,'').slice(0,24);
      const url=new URL('/meet/',location.origin);
      if(room)url.searchParams.set('room',room);
      if(passcode)url.searchParams.set('passcode',String(passcode).replace(/\D/g,'').slice(0,10));
      if(waiting)url.searchParams.set('waiting','1');
      return url.toString();
    }
  });
})();
