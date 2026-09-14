(()=>{
  'use strict';
  if(window.DominionPhysicalIntelligence2041)return;
  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function installPhysicalStyles(){
    if(q('style[data-ds-physical-intelligence-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsPhysicalIntelligence2041='1';
    style.textContent=`
      #prejoinOverlay .prejoin-effects-row{
        position:absolute!important;left:auto!important;right:16px!important;top:282px!important;bottom:auto!important;
        width:auto!important;max-width:max-content!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;
        display:block!important;background:transparent!important;border:0!important;z-index:8!important;
      }
      #prejoinOverlay .prejoin-backgrounds-button{
        width:auto!important;min-width:0!important;max-width:max-content!important;height:28px!important;margin:0!important;padding:0 10px!important;
        display:inline-flex!important;flex:none!important;align-items:center!important;justify-content:center!important;gap:5px!important;
        border:1px solid #55565a!important;border-radius:6px!important;background:rgba(24,25,27,.92)!important;
        box-shadow:0 3px 12px rgba(0,0,0,.28)!important;color:#fff!important;
      }
      #prejoinOverlay .prejoin-backgrounds-button>span:last-child{display:block!important;width:auto!important;min-width:0!important;flex:none!important}
      #prejoinOverlay .prejoin-backgrounds-button strong{display:block!important;white-space:nowrap!important;font-size:10px!important;font-weight:500!important}
      #prejoinOverlay .prejoin-backgrounds-button small{display:none!important}

      /* Permission guidance stays inside the approved picker. Never stack a
         DominionStar modal over the macOS Screen Recording prompt. */
      .ds2041-recovery,.ds2041-smart-recovery,#screenPermissionDialog,.ds-share-permission,.ds-219-share-recovery{display:none!important}
      .ds2041-permission-placeholder .ds2041-thumb{background:#1682ef!important;color:#fff!important}
      .ds2041-permission-warning{width:54px;height:46px;display:grid;place-items:center;position:relative;color:#fff;font-size:30px;line-height:1}
      .ds2041-permission-warning:before{content:'△';font-size:58px;font-weight:700;line-height:.8;color:#fff}
      .ds2041-permission-warning:after{content:'!';position:absolute;left:0;right:0;top:7px;text-align:center;font-size:22px;font-weight:800;color:#1682ef}
      .ds2041-permission-note{margin-top:12px;padding:11px 12px;border:1px solid #424448;border-radius:7px;background:#292a2d;color:#b7b8bc;font-size:10px;line-height:1.45}
      .ds2041-permission-note strong{display:block;margin-bottom:4px;color:#f1f1f2;font-size:10.5px}
      .ds2041-permission-copy{display:block;color:#a9aaae}
      .ds2041-permission-inline-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}
      .ds2041-permission-inline-actions button{height:29px;padding:0 11px;border:1px solid #55575b;border-radius:6px;background:#333438;color:#fff;font-size:10px;cursor:pointer}
      .ds2041-permission-inline-actions button.primary{background:#0e72ed;border-color:#0e72ed}
      .ds2041-permission-inline-actions button.warning{background:#8d3a20;border-color:#b04b2a}
      .ds2041-permission-inline-actions button[hidden]{display:none!important}
    `;
    document.head.append(style);
  }

  function installPickerFirstShare(){
    const legacy=window.DominionShareRuntimeAuthority2041;
    if(!legacy?.open||!legacy?.reload||!legacy?.dispose||legacy.pickerFirstPermission)return false;

    // Remove the old click listener but retain its certified picker methods.
    legacy.dispose();
    let opening=false;
    let blocked=false;
    let settingsOpened=false;
    let focusTimer=0;
    let refreshGeneration=0;
    let focusRefreshGeneration=0;
    let permissionRequestInFlight=false;
    let privacyIdentityCache=null;

    const pickerRoot=()=>q('.ds2041-share-root');
    const hideRejectedRecovery=()=>qa('.ds2041-recovery,.ds2041-smart-recovery,#screenPermissionDialog,.ds-share-permission,.ds-219-share-recovery').forEach(node=>{try{node.hidden=true;}catch{}});

    async function screenPermissionStatus(){
      try{return String((await desktop.media?.permissions?.())?.screen||'unknown').toLowerCase();}
      catch{return 'unknown';}
    }

    async function privacyIdentity(){
      if(privacyIdentityCache)return privacyIdentityCache;
      try{privacyIdentityCache=await desktop.app?.privacyIdentity?.()||null;}
      catch{privacyIdentityCache=null;}
      return privacyIdentityCache;
    }

    async function adHocIdentityIsUnstable(){
      const identity=await privacyIdentity();
      return identity?.stableAcrossRebuilds===false;
    }

    function bindPermissionActions(root){
      const openSettings=root?.querySelector('[data-open-screen-settings]');
      if(openSettings)openSettings.onclick=async()=>{
        settingsOpened=true;
        const status=root.querySelector('.ds2041-share-status');
        if(status)status.textContent='Screen Recording settings opened';
        try{await desktop.media?.openPrivacy?.('screen');}catch{}
      };
      const restart=root?.querySelector('[data-restart-screen-permission]');
      if(restart)restart.onclick=async()=>{
        restart.disabled=true;
        restart.textContent='Reopening…';
        try{await desktop.app?.relaunch?.();}
        catch{restart.disabled=false;restart.textContent='Quit & Reopen DominionStar Meet';}
      };
      const reset=root?.querySelector('[data-reset-screen-permission]');
      if(reset)reset.onclick=async()=>{
        reset.disabled=true;
        reset.textContent='Resetting this build…';
        const status=root.querySelector('.ds2041-share-status');
        if(status)status.textContent='Resetting DominionStar Screen Recording authorization…';
        try{
          const result=await desktop.app?.resetScreenPermission?.();
          if(!result?.ok)throw new Error(result?.error||'Screen Recording reset failed.');
          if(status)status.textContent='Authorization reset — reopening DominionStar Meet…';
          await desktop.app?.relaunch?.();
        }catch(error){
          reset.disabled=false;
          reset.textContent='Reset & Reauthorize This Build';
          if(status)status.textContent='Screen Recording reset failed';
          const copy=root.querySelector('.ds2041-permission-copy');
          if(copy)copy.textContent=String(error?.message||error||'Unable to reset Screen Recording. Open System Settings and remove/re-add DominionStar Meet manually.');
        }
      };
    }

    function showPermissionPlaceholders({message='',showRestart=false,showReset=false,statusText='Screen Recording permission required'}={}){
      const root=pickerRoot();if(!root)return false;
      hideRejectedRecovery();root.hidden=false;blocked=true;
      const content=root.querySelector('.ds2041-share-content');
      const status=root.querySelector('.ds2041-share-status');
      const preview=root.querySelector('.ds2041-preview');
      const share=root.querySelector('.ds2041-share-button');
      if(status)status.textContent=statusText;
      const copy=message||'macOS controls Screen Recording access. Use the system permission prompt, or open Privacy & Security below. The picker will recheck automatically when you return.';
      if(content)content.innerHTML=`<section class="ds2041-source-section screen"><strong>Entire screen</strong><div class="ds2041-source-grid"><button type="button" class="ds2041-source selected ds2041-permission-placeholder" data-permission-source="desktop"><span class="ds2041-thumb"><span class="ds2041-permission-warning"></span></span><span class="ds2041-source-name">Desktop 1</span></button></div></section><section class="ds2041-source-section window"><strong>Application windows</strong><div class="ds2041-permission-note"><strong>Screen Recording access</strong><span class="ds2041-permission-copy"></span><div class="ds2041-permission-inline-actions"><button type="button" class="primary" data-open-screen-settings>Open System Settings</button><button type="button" data-restart-screen-permission${showRestart?'':' hidden'}>Quit & Reopen DominionStar Meet</button><button type="button" class="warning" data-reset-screen-permission${showReset?'':' hidden'}>Reset & Reauthorize This Build</button></div></div></section>`;
      const copyNode=content?.querySelector('.ds2041-permission-copy');if(copyNode)copyNode.textContent=copy;
      if(preview)preview.innerHTML='<span class="ds2041-permission-warning"></span>';
      if(share){share.disabled=false;share.textContent='Share';}
      bindPermissionActions(root);
      return true;
    }

    async function blockedRecoveryState({fromSettings=false,reportedStatus=''}={}){
      const permission=reportedStatus||await screenPermissionStatus();
      const unstable=await adHocIdentityIsUnstable();
      const staleAdHocGrant=permission==='granted'&&unstable;
      if(staleAdHocGrant){
        return {
          showRestart:false,
          showReset:true,
          statusText:'This QA build needs fresh Screen Recording authorization',
          message:'This DominionStar QA build is ad-hoc signed. macOS can leave the previous build’s switch enabled even though this exact rebuilt app is a different privacy identity. Reset only DominionStar Meet’s Screen Recording record, reopen, then approve the native macOS prompt for this build.'
        };
      }
      const showRestart=fromSettings||permission==='granted';
      return {
        showRestart,
        showReset:false,
        statusText:permission==='granted'?'Permission granted — reopen may be required':'Screen Recording permission required',
        message:showRestart
          ? 'macOS reports Screen Recording access, but this running process still cannot read screen previews. Quit and reopen DominionStar Meet once.'
          : 'Use the macOS Screen Recording prompt to grant access. If macOS does not show the prompt again, open Privacy & Security and enable DominionStar Meet.'
      };
    }

    async function refreshPicker({fromSettings=false}={}){
      const generation=++refreshGeneration;
      hideRejectedRecovery();
      const root=pickerRoot();if(root)root.hidden=false;
      try{
        const ok=await legacy.reload();
        if(generation!==refreshGeneration)return false;
        hideRejectedRecovery();
        const current=pickerRoot();if(current)current.hidden=false;
        if(ok){
          blocked=false;settingsOpened=false;
          const status=current?.querySelector('.ds2041-share-status');if(status)status.textContent='';
          return true;
        }
      }catch{}
      if(generation!==refreshGeneration)return false;
      showPermissionPlaceholders(await blockedRecoveryState({fromSettings}));
      return false;
    }

    async function refreshAfterFocus(){
      if(!blocked)return false;
      const generation=++focusRefreshGeneration;
      for(const delay of [180,650,1400]){
        await wait(delay);
        if(generation!==focusRefreshGeneration||!blocked)return !blocked;
        if(await refreshPicker({fromSettings:true}))return true;
      }
      return false;
    }

    async function requestPermissionFromPicker(){
      if(permissionRequestInFlight)return false;
      permissionRequestInFlight=true;
      const root=pickerRoot();if(!root){permissionRequestInFlight=false;return false;}
      const status=root.querySelector('.ds2041-share-status');if(status)status.textContent='Checking Screen Recording permission…';
      try{
        const result=await Promise.race([
          Promise.resolve(desktop.media?.requestScreen?.()),
          new Promise(resolve=>setTimeout(()=>resolve({ok:false,status:'timeout'}),4200))
        ]);
        if(result?.ok||String(result?.status||'').toLowerCase()==='granted'){
          if(await refreshPicker())return true;
        }else if(await refreshPicker())return true;
        const reported=String(result?.status||'unknown').toLowerCase();
        const state=await blockedRecoveryState({fromSettings:settingsOpened,reportedStatus:reported});
        if(reported!=='granted'&&!settingsOpened){
          state.message='Grant Screen Recording in the native macOS prompt. If the prompt is no longer visible, open System Settings below. No second DominionStar permission dialog will cover the picker.';
        }
        showPermissionPlaceholders(state);
      }catch{
        showPermissionPlaceholders();
      }finally{permissionRequestInFlight=false;}
      return false;
    }

    async function open(){
      if(opening)return false;opening=true;
      try{
        // Zoom parity: open the approved chooser first. Permission is a state
        // of the chooser, never a gate in front of the chooser.
        const ok=await legacy.open();
        hideRejectedRecovery();
        const root=pickerRoot();if(root)root.hidden=false;
        if(ok){blocked=false;settingsOpened=false;return true;}
        showPermissionPlaceholders();
        return true;
      }catch{
        hideRejectedRecovery();showPermissionPlaceholders();return true;
      }finally{opening=false;}
    }

    function intercept(event){
      const target=event.target;if(!target?.closest)return;
      const primary=target.closest('#roomShare');
      const nextShare=target.closest('[data-inline-command="new-share"]');
      const placeholderShare=blocked&&target.closest('.ds2041-share-button');
      if(!primary&&!nextShare&&!placeholderShare)return;
      if(placeholderShare){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();queueMicrotask(()=>void requestPermissionFromPicker());return;}
      const meeting=q('#meetingOverlay');if(!meeting||meeting.hidden)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();target.closest('button')?.blur?.();queueMicrotask(()=>void open());
    }

    const onFocus=()=>{
      if(!blocked)return;
      clearTimeout(focusTimer);
      focusTimer=setTimeout(()=>void refreshAfterFocus(),180);
    };
    const onVisibility=()=>{if(document.visibilityState==='visible')onFocus();};

    window.addEventListener('click',intercept,true);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisibility);

    window.DominionShareRuntimeAuthority2041=Object.freeze({
      version:'2.0.41-picker-first-identity-aware-permission',pickerFirstPermission:true,
      open,
      close:()=>{try{legacy.close?.();}catch{}blocked=false;settingsOpened=false;focusRefreshGeneration++;},
      reload:()=>refreshPicker(),
      state:()=>({...legacy.state?.(),permissionBlocked:blocked,settingsOpened}),
      dispose:()=>{clearTimeout(focusTimer);focusRefreshGeneration++;window.removeEventListener('click',intercept,true);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);try{legacy.dispose?.();}catch{};}
    });
    return true;
  }

  installPhysicalStyles();
  const install=()=>{installPhysicalStyles();if(!installPickerFirstShare())setTimeout(install,25);};
  setTimeout(install,0);
  window.DominionPhysicalIntelligence2041=Object.freeze({version:'2.0.41-picker-first-identity-aware-permission',installPhysicalStyles,installPickerFirstShare});
})();
