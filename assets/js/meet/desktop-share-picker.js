(()=>{
  'use strict';
  if(!window.dominionDesktop?.isDesktop)return;

  const REQUIRED_BRIDGE_VERSION=9;
  const PERMISSION_RESTART_KEY='ds_meet_screen_permission_restart_v1';
  const escape=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const withTimeout=(promise,ms,fallback)=>new Promise(resolve=>{let settled=false;const timer=setTimeout(()=>{if(settled)return;settled=true;resolve(fallback);},ms);Promise.resolve(promise).then(value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);}).catch(()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(fallback);});});
  const readRestartMarker=()=>{try{return Number(localStorage.getItem(PERMISSION_RESTART_KEY)||0)>0;}catch{return false;}};
  const markRestartNeeded=()=>{try{localStorage.setItem(PERMISSION_RESTART_KEY,String(Date.now()));}catch{}};
  const clearRestartMarker=()=>{try{localStorage.removeItem(PERMISSION_RESTART_KEY);}catch{}};

  const ensure=()=>{
    let dialog=document.getElementById('desktopSharePicker');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='desktopSharePicker';
    dialog.innerHTML=`<form method="dialog">
      <header><div class="ds-share-brand"><img src="/assets/logo.jpeg" alt=""><span><b>DOMINIONSTAR MEET</b><strong>Share your screen</strong><small>Choose exactly what meeting participants can see.</small></span></div><button value="cancel" aria-label="Close">×</button></header>
      <nav><button type="button" class="active" data-filter="screen">Screens</button><button type="button" data-filter="window">Application windows</button></nav>
      <main><section class="ds-share-content">
        <div class="ds-share-permission" data-permission hidden><span class="ds-permission-badge" data-permission-badge>SCREEN ACCESS</span><strong data-permission-title>Allow screen sharing</strong><p data-permission-copy></p><div class="ds-share-permission-actions"><button type="button" data-open-settings>Open System Settings</button><button type="button" class="secondary" data-retry-capture hidden>Retry</button><button type="button" class="secondary" data-restart-app hidden>Restart DominionStar Meet</button></div><small data-permission-note></small></div>
        <div class="ds-share-loading" data-loading hidden><span></span><strong>Loading screens and windows…</strong></div>
        <div class="ds-share-sources" data-sources></div>
      </section><aside><strong>Sharing options</strong><label class="ds-share-switch-row"><span>Share sound</span><input type="checkbox" role="switch" data-share-audio></label><label class="ds-share-switch-row"><span>Optimize for video sharing</span><input type="checkbox" role="switch" data-optimize></label><label class="ds-share-switch-row"><span>Share DominionStar windows</span><input type="checkbox" role="switch" data-own-windows></label><p data-audio-note></p><small>DominionStar windows stay private by default to prevent mirror recursion.</small></aside></main>
      <footer><span data-selection-label>Select a screen</span><div><button value="cancel">Cancel</button><button type="button" class="primary" data-confirm disabled>Share</button></div></footer>
    </form>`;
    const style=document.createElement('style');
    style.textContent=`#desktopSharePicker{position:fixed;left:50%;top:7vh;transform:translateX(-50%);z-index:2147483000;width:min(1080px,92vw);height:min(720px,86vh);padding:0;border:1px solid #ffffff20;border-radius:20px;background:radial-gradient(circle at 16% 0,#243149 0,#111722 38%,#090d14 100%);color:#f4f6f8;box-shadow:0 36px 120px #000e}#desktopSharePicker::backdrop{background:transparent}#desktopSharePicker form{height:100%;display:flex;flex-direction:column}#desktopSharePicker header,#desktopSharePicker footer{display:flex;align-items:center;justify-content:space-between}#desktopSharePicker header{padding:18px 22px;background:linear-gradient(135deg,#1e293bcc,#111827e8);border-bottom:1px solid #ffffff17}#desktopSharePicker header button{border:0;background:transparent;color:#d9dee5;font-size:25px;cursor:pointer}.ds-share-brand{display:flex;align-items:center;gap:13px}.ds-share-brand img{width:44px;height:44px;border-radius:12px;object-fit:cover}.ds-share-brand b{display:block;margin-bottom:3px;color:#e8bc49;font-size:10px;letter-spacing:.16em}.ds-share-brand strong,.ds-share-brand small{display:block}.ds-share-brand strong{font-size:19px}.ds-share-brand small{margin-top:4px;color:#aeb9c9}#desktopSharePicker nav{display:flex;gap:26px;padding:0 20px;background:#101722cc;border-bottom:1px solid #ffffff15}#desktopSharePicker nav button{border:0;border-bottom:3px solid transparent;padding:13px 2px;background:transparent;color:#bfc7d2;font-weight:750;cursor:pointer}#desktopSharePicker nav button.active{border-color:#e8bc49;color:#fff}#desktopSharePicker main{min-height:0;flex:1;display:grid;grid-template-columns:minmax(0,1fr) 260px}.ds-share-content{min-width:0;overflow:auto;position:relative}.ds-share-sources{padding:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-content:start}.ds-share-source{padding:8px;border:2px solid #ffffff14;border-radius:14px;background:linear-gradient(145deg,#222c3a,#151c27);color:#fff;text-align:left;cursor:pointer;box-shadow:0 12px 30px #0005}.ds-share-source:hover{border-color:#ffffff35;transform:translateY(-1px)}.ds-share-source.selected{border-color:#e8bc49;box-shadow:0 0 0 2px #e8bc4933,0 18px 42px #0009}.ds-share-source img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:9px;background:#070a0f}.ds-share-source strong{display:block;padding:9px 3px 2px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ds-share-source small{display:block;padding:0 3px 4px;color:#95a2b4}.ds-share-loading{min-height:260px;display:grid;place-items:center;align-content:center;gap:14px;color:#bfc8d5}.ds-share-loading span{width:34px;height:34px;border:3px solid #ffffff22;border-top-color:#e8bc49;border-radius:50%;animation:dsShareSpin .8s linear infinite}@keyframes dsShareSpin{to{transform:rotate(360deg)}}#desktopSharePicker aside{padding:24px;background:linear-gradient(180deg,#151d29,#0d131d);border-left:1px solid #ffffff17;display:flex;flex-direction:column;gap:16px}#desktopSharePicker aside>strong{color:#f7e3a8}.ds-share-switch-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff08;font-weight:650;cursor:pointer}.ds-share-switch-row input{appearance:none;-webkit-appearance:none;width:42px;height:24px;flex:0 0 42px;border-radius:999px;border:1px solid #ffffff26;background-color:#2a3444;background-image:radial-gradient(circle at 12px 50%,#fff 0 7px,transparent 7.5px);cursor:pointer}.ds-share-switch-row input:checked{background-color:#2f80ed;border-color:#55a2ff;background-image:radial-gradient(circle at 30px 50%,#fff 0 7px,transparent 7.5px)}#desktopSharePicker aside p,#desktopSharePicker aside small{margin:0;color:#aeb7c3;font-size:12px;line-height:1.45}.ds-share-permission{max-width:610px;margin:56px auto;padding:42px;border:1px solid #e8bc493d;border-radius:18px;background:linear-gradient(145deg,#1b2533,#111824);text-align:center}.ds-permission-badge{display:inline-block;margin-bottom:13px;padding:5px 9px;border:1px solid #e8bc4938;border-radius:999px;color:#e8bc49;font-size:10px;font-weight:850;letter-spacing:.13em}.ds-share-permission strong{display:block;color:#f8e5ab;font-size:21px}.ds-share-permission p{max-width:500px;margin:10px auto 18px;color:#bdc5cf;line-height:1.55}.ds-share-permission small{display:block;max-width:520px;margin:14px auto 0;color:#8996a8;line-height:1.5}.ds-share-permission-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.ds-share-permission button{padding:10px 15px;border:1px solid #e8bc4955;border-radius:9px;background:linear-gradient(135deg,#f0cf6a,#c99d33);color:#171a20;font-weight:800;cursor:pointer}.ds-share-permission button.secondary{background:#202a38;color:#f3f6fa;border-color:#ffffff25}#desktopSharePicker footer{margin-top:auto;padding:15px 22px;background:#0d131ce8;border-top:1px solid #ffffff17}#desktopSharePicker footer span{color:#b8c0cb}#desktopSharePicker footer button{border:1px solid #5a6471;border-radius:8px;padding:10px 18px;background:#333a45;color:#fff;margin-left:8px;font-weight:750;cursor:pointer}#desktopSharePicker footer .primary{background:linear-gradient(135deg,#f0cf6a,#c99d33);color:#171a20;border-color:#e8bc49}#desktopSharePicker footer .primary:disabled{opacity:.4;cursor:not-allowed}@media(max-width:820px){#desktopSharePicker main{grid-template-columns:1fr}#desktopSharePicker aside{border-left:0;border-top:1px solid #ffffff17}.ds-share-sources{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
    document.head.append(style);document.body.append(dialog);return dialog;
  };

  const savedShareDefaults=()=>{
    try{for(let i=0;i<localStorage.length;i+=1){const key=localStorage.key(i);if(!key?.startsWith('ds_meet_preferences:'))continue;const prefs=JSON.parse(localStorage.getItem(key)||'{}');return {shareSound:Boolean(prefs.shareSound),shareOptimize:Boolean(prefs.shareOptimize),shareOwnWindows:Boolean(prefs.shareOwnWindows)};}}catch{}
    return {shareSound:false,shareOptimize:false,shareOwnWindows:false};
  };

  window.DominionDesktopSharePicker={choose:async()=>{
    const dialog=ensure();
    const list=dialog.querySelector('[data-sources]'),loading=dialog.querySelector('[data-loading]'),permission=dialog.querySelector('[data-permission]'),permissionBadge=dialog.querySelector('[data-permission-badge]'),permissionTitle=dialog.querySelector('[data-permission-title]'),permissionText=dialog.querySelector('[data-permission-copy]'),permissionNote=dialog.querySelector('[data-permission-note]'),settingsButton=dialog.querySelector('[data-open-settings]'),retryButton=dialog.querySelector('[data-retry-capture]'),restartButton=dialog.querySelector('[data-restart-app]'),confirm=dialog.querySelector('[data-confirm]'),audio=dialog.querySelector('[data-share-audio]'),optimize=dialog.querySelector('[data-optimize]'),ownWindows=dialog.querySelector('[data-own-windows]'),note=dialog.querySelector('[data-audio-note]'),selectionLabel=dialog.querySelector('[data-selection-label]');
    let sources=[],selected='',filter='screen',loadToken=0,runtime={platform:window.dominionDesktop.platform,bridgeVersion:window.dominionDesktop.bridgeVersion};
    const defaults=savedShareDefaults();audio.checked=defaults.shareSound;optimize.checked=defaults.shareOptimize;ownWindows.checked=defaults.shareOwnWindows;audio.disabled=!window.dominionDesktop.supportsSystemAudioShare;note.textContent=audio.disabled?'Computer sound is not available on this platform. Microphone audio continues normally.':'Computer sound will be included when Share sound is enabled.';
    permission.hidden=true;loading.hidden=true;list.hidden=true;confirm.disabled=true;selectionLabel.textContent='Preparing screen sharing…';
    if(!dialog.open)dialog.show();
    window.dispatchEvent(new CustomEvent('dominionstar:share-picker-opened'));

    const runtimeResult=await withTimeout(window.dominionDesktop.getRuntimeInfo?.(),1800,null);if(runtimeResult&&typeof runtimeResult==='object')runtime=runtimeResult;
    const bridgeVersion=Number(runtime?.bridgeVersion||window.dominionDesktop.bridgeVersion||0);if(bridgeVersion<REQUIRED_BRIDGE_VERSION){if(dialog.open)dialog.close();throw new Error('DominionStar Meet desktop capture is out of date. Reopen the latest desktop build.');}

    const status=async()=>await withTimeout(window.dominionDesktop.getScreenPermissionStatus?.(),1200,{screen:'unknown',captureReady:false,requiresRestart:false,captureError:'permission-status-timeout'});
    const requestSources=()=>withTimeout(window.dominionDesktop.getShareSources({includeOwnWindows:ownWindows.checked}),3200,[]);
    const showProblem=(state,{freshProcessProbe=false}={})=>{
      const screen=String(state?.screen||'unknown').toLowerCase();const granted=screen==='granted';const restartNeeded=Boolean(state?.requiresRestart||readRestartMarker());
      permission.hidden=false;loading.hidden=true;list.hidden=true;confirm.disabled=true;
      settingsButton.hidden=granted;retryButton.hidden=!granted;restartButton.hidden=!restartNeeded;
      if(restartNeeded&&!freshProcessProbe){permissionBadge.textContent='RESTART ONCE';permissionTitle.textContent='Apply screen access';permissionText.textContent='Screen permission changed outside DominionStar Meet. Restart the app once before another capture attempt.';permissionNote.textContent='The meeting remains responsive. Do not reopen Privacy & Security unless macOS still shows DominionStar Meet disabled.';}
      else if(granted){permissionBadge.textContent='SCREEN ACCESS';permissionTitle.textContent='Screen access is active';permissionText.textContent='macOS reports screen access, but no shareable source was returned.';permissionNote.textContent='Use Retry. If macOS recently changed this permission, restart DominionStar Meet once.';}
      else{permissionBadge.textContent='MACOS SCREEN ACCESS';permissionTitle.textContent=screen==='not-determined'?'Allow Screen Recording':'Screen Recording is blocked';permissionText.textContent='Open Privacy & Security → Screen & System Audio Recording and enable DominionStar Meet.';permissionNote.textContent='DominionStar Meet will close this picker before opening Settings. When you return, the meeting stays usable. Restart the app once, then press Share Screen again.';}
      selectionLabel.textContent=permissionTitle.textContent;
    };
    const render=()=>{const visible=sources.filter(source=>source.kind===filter);list.innerHTML=visible.length?visible.map(source=>`<button type="button" class="ds-share-source${source.id===selected?' selected':''}" data-source="${escape(source.id)}"><img src="${source.thumbnail}" alt=""><strong>${escape(source.name)}</strong><small>${source.kind==='screen'?'Entire screen':'Application window'}</small></button>`).join(''):`<div style="grid-column:1/-1;padding:56px 20px;text-align:center;color:#9eabba"><strong>No ${filter==='screen'?'screens':'application windows'} available</strong><p>Use Retry to refresh the source list.</p></div>`;};

    const loadSources=async({allowFreshProcessProbe=false}={})=>{
      const token=++loadToken;selected='';confirm.disabled=true;permission.hidden=true;list.hidden=true;loading.hidden=false;selectionLabel.textContent='Checking screen access…';
      let permissionState=null;
      if(runtime?.platform==='darwin'){
        permissionState=await status();if(token!==loadToken||!dialog.open)return;
        const screen=String(permissionState?.screen||'unknown').toLowerCase();
        if(screen!=='granted'&&!allowFreshProcessProbe){showProblem(permissionState);return;}
      }
      selectionLabel.textContent='Loading screens and windows…';let next=[];
      for(const delay of [0,240,600]){if(delay)await sleep(delay);if(token!==loadToken||!dialog.open)return;next=await requestSources();if(Array.isArray(next)&&next.length)break;}
      if(token!==loadToken||!dialog.open)return;
      sources=Array.isArray(next)?next:[];loading.hidden=true;
      if(sources.length){clearRestartMarker();permission.hidden=true;list.hidden=false;selectionLabel.textContent=filter==='screen'?'Select a screen':'Select an application window';render();return;}
      if(runtime?.platform==='darwin'){showProblem(permissionState||await status(),{freshProcessProbe:allowFreshProcessProbe});return;}
      permission.hidden=true;list.hidden=false;selectionLabel.textContent='No share sources available';render();
    };

    settingsButton.onclick=async()=>{
      // Critical physical-Mac boundary: never leave a capture transaction alive
      // while System Settings owns focus. Close this picker first, remember that
      // a fresh process may probe the real source list, and do nothing on focus.
      markRestartNeeded();
      ++loadToken;
      if(dialog.open)dialog.close('cancel');
      await withTimeout(window.dominionDesktop.openScreenRecordingSettings?.(),1200,false);
    };
    retryButton.onclick=()=>void loadSources({allowFreshProcessProbe:true});
    restartButton.onclick=()=>{if(dialog.open)dialog.close('cancel');void window.dominionDesktop.relaunchForPermissions?.();};
    ownWindows.onchange=()=>void loadSources({allowFreshProcessProbe:true});
    dialog.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.filter||'screen';dialog.querySelectorAll('[data-filter]').forEach(item=>item.classList.toggle('active',item===button));selected='';confirm.disabled=true;selectionLabel.textContent=filter==='screen'?'Select a screen':'Select an application window';render();});
    list.onclick=event=>{const button=event.target.closest('[data-source]');if(!button)return;selected=button.dataset.source||'';list.querySelectorAll('[data-source]').forEach(item=>item.classList.toggle('selected',item===button));const source=sources.find(item=>item.id===selected);selectionLabel.textContent=source?.name||'Selected source';confirm.disabled=!selected;};

    const freshProcessProbe=runtime?.platform==='darwin'&&readRestartMarker();
    void loadSources({allowFreshProcessProbe:freshProcessProbe});

    return await new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;dialog.removeEventListener('close',onClose);resolve(value);};
      const onClose=()=>finish(null);dialog.addEventListener('close',onClose,{once:true});
      confirm.onclick=()=>{const source=sources.find(item=>item.id===selected);if(!source)return;finish({sourceId:source.id,sourceName:source.name,displayId:source.displayId||'',kind:source.kind||'screen',audio:Boolean(audio.checked&&!audio.disabled),optimize:Boolean(optimize.checked),shareOwnWindow:Boolean(ownWindows.checked)});if(dialog.open)dialog.close('share');};
    });
  }};
})();
