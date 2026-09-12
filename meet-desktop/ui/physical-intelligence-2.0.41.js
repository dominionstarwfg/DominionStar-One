(()=>{
  'use strict';
  if(window.DominionPhysicalIntelligence2041)return;
  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];

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

      /* Permission belongs inside the approved picker, never in front of it. */
      .ds2041-recovery,.ds2041-smart-recovery,#screenPermissionDialog,.ds-share-permission,.ds-219-share-recovery{display:none!important}
      .ds2041-permission-placeholder .ds2041-thumb{background:#1682ef!important;color:#fff!important}
      .ds2041-permission-warning{width:54px;height:46px;display:grid;place-items:center;position:relative;color:#fff;font-size:30px;line-height:1}
      .ds2041-permission-warning:before{content:'△';font-size:58px;font-weight:700;line-height:.8;color:#fff}
      .ds2041-permission-warning:after{content:'!';position:absolute;left:0;right:0;top:7px;text-align:center;font-size:22px;font-weight:800;color:#1682ef}
      .ds2041-permission-note{margin-top:12px;padding:10px 12px;border:1px solid #424448;border-radius:7px;background:#292a2d;color:#aaa;font-size:10px;line-height:1.45}
      .ds2041-permission-modal{position:absolute;inset:0;z-index:4;display:grid;place-items:center;background:rgba(0,0,0,.30)}
      .ds2041-permission-modal[hidden]{display:none!important}
      .ds2041-permission-card{width:min(430px,calc(100% - 42px));padding:20px;border:1px solid #4b4d51;border-radius:11px;background:#252628;box-shadow:0 20px 55px rgba(0,0,0,.55)}
      .ds2041-permission-card h3{margin:0 0 7px;color:#fff;font-size:17px}.ds2041-permission-card p{margin:0;color:#b8b9bd;font-size:11px;line-height:1.5}
      .ds2041-permission-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ds2041-permission-actions button{height:32px;padding:0 13px;border:1px solid #55575b;border-radius:6px;background:#333438;color:#fff;font-size:11px}.ds2041-permission-actions .primary{background:#0e72ed;border-color:#0e72ed}
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

    const pickerRoot=()=>q('.ds2041-share-root');
    const hideRejectedRecovery=()=>qa('.ds2041-recovery,.ds2041-smart-recovery,#screenPermissionDialog,.ds-share-permission,.ds-219-share-recovery').forEach(node=>{try{node.hidden=true;}catch{}});

    function ensurePermissionModal(){
      const root=pickerRoot();if(!root)return null;
      let modal=root.querySelector('.ds2041-permission-modal');if(modal)return modal;
      modal=document.createElement('div');modal.className='ds2041-permission-modal';modal.hidden=true;
      modal.innerHTML='<div class="ds2041-permission-card"><h3>Allow DominionStar Meet to share your screen</h3><p data-copy>Open System Settings → Privacy & Security → Screen & System Audio Recording, then enable DominionStar Meet. Return here and the picker will refresh automatically.</p><div class="ds2041-permission-actions"><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-settings>Open System Settings</button></div></div>';
      root.querySelector('.ds2041-share-window')?.append(modal);
      modal.querySelector('[data-cancel]').onclick=()=>{modal.hidden=true;};
      modal.querySelector('[data-settings]').onclick=async()=>{settingsOpened=true;try{await desktop.media?.openPrivacy?.('screen');}catch{}};
      return modal;
    }

    function showPermissionPlaceholders(){
      const root=pickerRoot();if(!root)return false;
      hideRejectedRecovery();root.hidden=false;blocked=true;
      const content=root.querySelector('.ds2041-share-content');
      const status=root.querySelector('.ds2041-share-status');
      const preview=root.querySelector('.ds2041-preview');
      const share=root.querySelector('.ds2041-share-button');
      if(status)status.textContent='Screen Recording permission required';
      if(content)content.innerHTML='<section class="ds2041-source-section screen"><strong>Entire screen</strong><div class="ds2041-source-grid"><button type="button" class="ds2041-source selected ds2041-permission-placeholder" data-permission-source="desktop"><span class="ds2041-thumb"><span class="ds2041-permission-warning"></span></span><span class="ds2041-source-name">Desktop 1</span></button></div></section><section class="ds2041-source-section window"><strong>Application windows</strong><div class="ds2041-permission-note">Allow Screen Recording to preview application windows. This picker will update automatically when macOS grants access.</div></section>';
      if(preview)preview.innerHTML='<span class="ds2041-permission-warning"></span>';
      if(share){share.disabled=false;share.textContent='Share';}
      return true;
    }

    function showPermissionModal(copy=''){
      showPermissionPlaceholders();const modal=ensurePermissionModal();if(!modal)return false;
      const node=modal.querySelector('[data-copy]');if(node&&copy)node.textContent=copy;modal.hidden=false;return true;
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
          current?.querySelector('.ds2041-permission-modal')?.setAttribute('hidden','');
          const status=current?.querySelector('.ds2041-share-status');if(status)status.textContent='';
          return true;
        }
      }catch{}
      if(generation!==refreshGeneration)return false;
      showPermissionPlaceholders();
      if(fromSettings){
        const modal=ensurePermissionModal();
        const copy=modal?.querySelector('[data-copy]');
        if(copy)copy.textContent='macOS still has not exposed the new Screen Recording grant to this running QA copy. If the switch is on, quit and reopen DominionStar Meet once. Stable signed builds will retain the permission like Zoom.';
        if(modal)modal.hidden=false;
      }
      return false;
    }

    async function requestPermissionFromPicker(){
      const root=pickerRoot();if(!root)return false;
      const status=root.querySelector('.ds2041-share-status');if(status)status.textContent='Waiting for Screen Recording permission…';
      try{
        const result=await Promise.race([
          Promise.resolve(desktop.media?.requestScreen?.()),
          new Promise(resolve=>setTimeout(()=>resolve({ok:false,status:'timeout'}),4200))
        ]);
        if(result?.ok||String(result?.status||'').toLowerCase()==='granted'){
          return refreshPicker();
        }
      }catch{}
      showPermissionModal();
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

    async function recheckAfterSettings(){
      if(!settingsOpened)return;
      const root=pickerRoot();if(root)root.hidden=false;
      await refreshPicker({fromSettings:true});
    }
    const onFocus=()=>{if(!settingsOpened)return;clearTimeout(focusTimer);focusTimer=setTimeout(()=>void recheckAfterSettings(),300);};
    const onVisibility=()=>{if(document.visibilityState==='visible')onFocus();};

    window.addEventListener('click',intercept,true);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisibility);

    window.DominionShareRuntimeAuthority2041=Object.freeze({
      version:'2.0.41-picker-first-permission-parity',pickerFirstPermission:true,
      open,
      close:()=>{try{legacy.close?.();}catch{}blocked=false;settingsOpened=false;},
      reload:()=>refreshPicker(),
      state:()=>({...legacy.state?.(),permissionBlocked:blocked,settingsOpened}),
      dispose:()=>{clearTimeout(focusTimer);window.removeEventListener('click',intercept,true);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);try{legacy.dispose?.();}catch{};}
    });
    return true;
  }

  installPhysicalStyles();
  const install=()=>{installPhysicalStyles();if(!installPickerFirstShare())setTimeout(install,25);};
  setTimeout(install,0);
  window.DominionPhysicalIntelligence2041=Object.freeze({version:'2.0.41-picker-first-permission',installPhysicalStyles,installPickerFirstShare});
})();
