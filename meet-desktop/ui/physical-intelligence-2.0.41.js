(()=>{
  'use strict';
  if(window.DominionPhysicalIntelligence2041)return;
  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s);

  function installPrejoinRepair(){
    if(q('style[data-ds-physical-prejoin-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsPhysicalPrejoin2041='1';
    style.textContent=`
      #prejoinOverlay .prejoin-effects-row{
        position:absolute!important;
        left:auto!important;
        right:16px!important;
        top:282px!important;
        bottom:auto!important;
        width:auto!important;
        max-width:max-content!important;
        height:auto!important;
        min-height:0!important;
        margin:0!important;
        padding:0!important;
        display:block!important;
        background:transparent!important;
        border:0!important;
        z-index:8!important;
      }
      #prejoinOverlay .prejoin-backgrounds-button{
        width:auto!important;
        min-width:0!important;
        max-width:max-content!important;
        height:28px!important;
        margin:0!important;
        padding:0 10px!important;
        display:inline-flex!important;
        flex:none!important;
        align-items:center!important;
        justify-content:center!important;
        gap:5px!important;
        border:1px solid #55565a!important;
        border-radius:6px!important;
        background:rgba(24,25,27,.92)!important;
        box-shadow:0 3px 12px rgba(0,0,0,.28)!important;
        color:#fff!important;
      }
      #prejoinOverlay .prejoin-backgrounds-button>span:last-child{display:block!important;width:auto!important;min-width:0!important;flex:none!important}
      #prejoinOverlay .prejoin-backgrounds-button strong{display:block!important;white-space:nowrap!important;font-size:10px!important;font-weight:500!important}
      #prejoinOverlay .prejoin-backgrounds-button small{display:none!important}
    `;
    document.head.append(style);
  }

  function installPermissionAwareShare(){
    const legacy=window.DominionShareRuntimeAuthority2041;
    if(!legacy?.open||!legacy?.dispose||legacy.permissionAware)return false;
    legacy.dispose();

    let recovery=null;
    let settingsOpened=false;
    let opening=false;
    let focusTimer=0;
    let lastStatus='unknown';

    const screenStatus=async()=>{
      try{return String((await desktop.media?.permissions?.())?.screen||'unknown').toLowerCase();}
      catch{return 'unknown';}
    };

    function ensureRecovery(){
      if(recovery?.isConnected)return recovery;
      recovery=document.createElement('section');
      recovery.className='ds2041-recovery ds2041-smart-recovery';
      recovery.hidden=true;
      recovery.innerHTML='<div class="ds2041-recovery-card"><p>SCREEN SHARING</p><h3 data-title>Allow Screen Recording</h3><span data-copy></span><div class="ds2041-recovery-actions"><button type="button" data-cancel>Cancel</button><button type="button" data-settings>Open System Settings</button><button type="button" class="primary" data-restart hidden>Restart DominionStar Meet</button></div></div>';
      document.body.append(recovery);
      recovery.querySelector('[data-cancel]').onclick=()=>{recovery.hidden=true;settingsOpened=false;};
      recovery.querySelector('[data-settings]').onclick=async()=>{
        const status=await screenStatus();lastStatus=status;settingsOpened=true;
        if(status==='not-determined'){
          // First-ever macOS registration may require the native TCC prompt.
          // Hide our recovery UI so the user never sees two permission dialogs stacked.
          recovery.hidden=true;
          try{await desktop.media?.requestScreen?.();}catch{}
          return;
        }
        try{await desktop.media?.openPrivacy?.('screen');}catch{}
        await refreshRecovery();
      };
      recovery.querySelector('[data-restart]').onclick=()=>void desktop.app?.relaunch?.();
      return recovery;
    }

    async function refreshRecovery(){
      const box=ensureRecovery(),title=box.querySelector('[data-title]'),copy=box.querySelector('[data-copy]'),restart=box.querySelector('[data-restart]');
      const status=await screenStatus();lastStatus=status;
      if(status==='granted'){
        title.textContent='Screen Recording is ready';
        copy.textContent='DominionStar Meet can now read your screen. Opening the approved Screens / Files / More chooser…';
        restart.hidden=true;
        return {status,ready:true};
      }
      if(settingsOpened){
        title.textContent='Activate the permission change';
        copy.textContent='macOS has not exposed the new Screen Recording grant to this running process yet. Restart DominionStar Meet once; after that, Share will use the permission without asking again.';
        restart.hidden=false;
        return {status,ready:false,restartRequired:true};
      }
      title.textContent='Allow Screen Recording';
      copy.textContent='DominionStar Meet only asks for Screen Recording when it is not available. Enable DominionStar Meet in Privacy & Security → Screen & System Audio Recording.';
      restart.hidden=true;
      return {status,ready:false,restartRequired:false};
    }

    async function showRecovery(){
      try{legacy.close?.();}catch{}
      const box=ensureRecovery();
      const state=await refreshRecovery();
      if(state.ready){box.hidden=true;settingsOpened=false;return legacy.open();}
      box.hidden=false;return false;
    }

    async function open(){
      if(opening)return false;
      opening=true;
      try{
        const status=await screenStatus();lastStatus=status;
        if(status==='granted'){
          settingsOpened=false;
          if(recovery)recovery.hidden=true;
          return await legacy.open();
        }
        return await showRecovery();
      }finally{opening=false;}
    }

    function intercept(event){
      const target=event.target;if(!target?.closest)return;
      const primary=target.closest('#roomShare');
      const nextShare=target.closest('[data-inline-command="new-share"]');
      if(!primary&&!nextShare)return;
      const meeting=q('#meetingOverlay');if(!meeting||meeting.hidden)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      target.closest('button')?.blur?.();queueMicrotask(()=>void open());
    }

    async function recheckAfterSettings(){
      if(!settingsOpened||!recovery||recovery.hidden)return;
      const state=await refreshRecovery();
      if(state.ready){recovery.hidden=true;settingsOpened=false;await open();}
    }

    const onFocus=()=>{
      if(!settingsOpened)return;
      clearTimeout(focusTimer);focusTimer=setTimeout(()=>void recheckAfterSettings(),350);
    };
    const onVisibility=()=>{if(document.visibilityState==='visible')onFocus();};

    window.addEventListener('click',intercept,true);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisibility);

    window.DominionShareRuntimeAuthority2041=Object.freeze({
      version:'2.0.41-single-approved-runtime-share-permission-aware',
      permissionAware:true,
      open,
      close:()=>{try{legacy.close?.();}catch{}if(recovery)recovery.hidden=true;},
      reload:()=>open(),
      state:()=>({...legacy.state?.(),permissionStatus:lastStatus,settingsOpened}),
      dispose:()=>{
        clearTimeout(focusTimer);
        window.removeEventListener('click',intercept,true);
        window.removeEventListener('focus',onFocus);
        document.removeEventListener('visibilitychange',onVisibility);
        try{legacy.dispose?.();}catch{}
        recovery?.remove();
      }
    });
    return true;
  }

  installPrejoinRepair();
  const install=()=>{
    installPrejoinRepair();
    if(!installPermissionAwareShare())setTimeout(install,25);
  };
  setTimeout(install,0);
  window.DominionPhysicalIntelligence2041=Object.freeze({version:'2.0.41',installPrejoinRepair,installPermissionAwareShare});
})();
