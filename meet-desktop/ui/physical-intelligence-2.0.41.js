(()=>{
  'use strict';
  if(window.DominionPhysicalIntelligence2041)return;
  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s);

  function installPhysicalStyles(){
    if(q('style[data-ds-physical-intelligence-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsPhysicalIntelligence2041='1';
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
      .ds2041-smart-recovery{
        position:fixed!important;
        inset:0!important;
        z-index:9800!important;
        display:grid!important;
        place-items:center!important;
        background:rgba(0,0,0,.58)!important;
        color:#f2f2f3!important;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      }
      .ds2041-smart-recovery[hidden]{display:none!important}
      .ds2041-smart-recovery .ds2041-recovery-card{
        width:min(470px,calc(100vw - 40px))!important;
        padding:22px!important;
        border:1px solid #484a4e!important;
        border-radius:12px!important;
        background:#242527!important;
        box-shadow:0 24px 70px rgba(0,0,0,.62)!important;
      }
      .ds2041-smart-recovery .ds2041-recovery-card p{margin:0 0 5px!important;color:#77aef8!important;font-size:9px!important;font-weight:700!important;letter-spacing:.14em!important}
      .ds2041-smart-recovery .ds2041-recovery-card h3{margin:0 0 8px!important;font-size:17px!important;color:#fff!important}
      .ds2041-smart-recovery .ds2041-recovery-card>span{display:block!important;color:#b7b8bc!important;font-size:12px!important;line-height:1.5!important}
      .ds2041-smart-recovery .ds2041-recovery-actions{display:flex!important;justify-content:flex-end!important;gap:8px!important;margin-top:18px!important}
      .ds2041-smart-recovery .ds2041-recovery-actions button{height:32px!important;padding:0 13px!important;border:1px solid #505257!important;border-radius:6px!important;background:#323337!important;color:#fff!important;font-size:11px!important;cursor:pointer!important}
      .ds2041-smart-recovery .ds2041-recovery-actions .primary{border-color:#0e72ed!important;background:#0e72ed!important}
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
    let lastDiagnostic='idle';

    const timeout=(promise,ms=3600)=>Promise.race([
      Promise.resolve(promise),
      new Promise(resolve=>setTimeout(()=>resolve({ok:false,status:'unknown',detectedBy:'renderer-timeout'}),ms))
    ]);

    async function rawScreenStatus(){
      try{return String((await timeout(desktop.media?.permissions?.(),1800))?.screen||'unknown').toLowerCase();}
      catch{return 'unknown';}
    }

    async function liveScreenAccess(){
      let raw=await rawScreenStatus();
      lastStatus=raw;
      try{
        if(desktop.media?.requestScreen){
          const diagnostic=await timeout(desktop.media.requestScreen(),3600);
          const status=String(diagnostic?.status||raw||'unknown').toLowerCase();
          const ready=Boolean(diagnostic?.ok)||status==='granted';
          lastStatus=ready?'granted':status;
          lastDiagnostic=String(diagnostic?.detectedBy||diagnostic?.probeStatus||'request-screen');
          return {ready,status:lastStatus,raw,restartRequired:Boolean(diagnostic?.restartRequired),diagnostic};
        }
      }catch(error){
        lastDiagnostic=String(error?.message||error||'request-screen-error');
      }
      raw=await rawScreenStatus();
      lastStatus=raw;
      return {ready:raw==='granted',status:raw,raw,restartRequired:false,diagnostic:null};
    }

    function ensureRecovery(){
      installPhysicalStyles();
      if(recovery?.isConnected)return recovery;
      recovery=document.createElement('section');
      recovery.className='ds2041-recovery ds2041-smart-recovery';
      recovery.hidden=true;
      recovery.setAttribute('role','dialog');
      recovery.setAttribute('aria-modal','true');
      recovery.innerHTML='<div class="ds2041-recovery-card"><p>SCREEN SHARING</p><h3 data-title>Checking Screen Recording…</h3><span data-copy>DominionStar Meet is checking whether macOS already allows screen capture.</span><div class="ds2041-recovery-actions"><button type="button" data-cancel>Cancel</button><button type="button" data-settings>Open System Settings</button><button type="button" class="primary" data-restart hidden>Restart DominionStar Meet</button></div></div>';
      document.body.append(recovery);
      recovery.querySelector('[data-cancel]').onclick=()=>{recovery.hidden=true;settingsOpened=false;};
      recovery.querySelector('[data-settings]').onclick=async()=>{
        settingsOpened=true;
        try{await desktop.media?.openPrivacy?.('screen');}catch{}
        await refreshRecovery({probe:false});
      };
      recovery.querySelector('[data-restart]').onclick=()=>void desktop.app?.relaunch?.();
      return recovery;
    }

    function renderRecovery(state={}){
      const box=ensureRecovery(),title=box.querySelector('[data-title]'),copy=box.querySelector('[data-copy]'),restart=box.querySelector('[data-restart]'),settings=box.querySelector('[data-settings]');
      if(state.ready){
        title.textContent='Screen Recording is ready';
        copy.textContent='DominionStar Meet can read your screen. Opening the approved Screens / Files / More chooser…';
        restart.hidden=true;settings.hidden=false;
        return box;
      }
      const status=String(state.status||lastStatus||'unknown');
      if(settingsOpened||state.restartRequired){
        title.textContent='Activate the permission change';
        copy.textContent='macOS has not exposed the new Screen Recording grant to this running process yet. Restart DominionStar Meet once; after that, Share will use the permission without asking again.';
        restart.hidden=false;settings.hidden=false;
      }else if(status==='not-determined'){
        title.textContent='Allow Screen Recording';
        copy.textContent='macOS has not received a Screen Recording decision for DominionStar Meet yet. Use Open System Settings if the native permission prompt does not appear.';
        restart.hidden=true;settings.hidden=false;
      }else{
        title.textContent='Allow Screen Recording';
        copy.textContent='Screen Recording is not currently usable. Enable DominionStar Meet in Privacy & Security → Screen & System Audio Recording.';
        restart.hidden=true;settings.hidden=false;
      }
      return box;
    }

    async function refreshRecovery({probe=true}={}){
      const state=probe?await liveScreenAccess():{ready:false,status:await rawScreenStatus(),restartRequired:false};
      lastStatus=String(state.status||lastStatus||'unknown');
      renderRecovery(state);
      return state;
    }

    async function showRecovery(state=null){
      try{legacy.close?.();}catch{}
      const box=ensureRecovery();
      const resolved=state||await refreshRecovery({probe:true});
      renderRecovery(resolved);
      if(resolved.ready){
        box.hidden=true;settingsOpened=false;
        return legacy.open();
      }
      box.hidden=false;
      return false;
    }

    async function open(){
      if(opening)return false;
      opening=true;
      const box=ensureRecovery();
      box.hidden=false;
      const title=box.querySelector('[data-title]'),copy=box.querySelector('[data-copy]');
      title.textContent='Checking Screen Recording…';
      copy.textContent='DominionStar Meet is checking the live macOS capture state.';
      try{
        const state=await liveScreenAccess();
        if(state.ready){
          settingsOpened=false;
          box.hidden=true;
          return await legacy.open();
        }
        return await showRecovery(state);
      }catch(error){
        lastDiagnostic=String(error?.message||error||'share-entry-error');
        renderRecovery({ready:false,status:lastStatus});
        box.querySelector('[data-title]').textContent='Screen sharing could not open';
        box.querySelector('[data-copy]').textContent='DominionStar Meet could not verify the current Screen Recording state. Open System Settings or restart the app once, then try Share again.';
        box.hidden=false;
        return false;
      }finally{opening=false;}
    }

    function intercept(event){
      const target=event.target;if(!target?.closest)return;
      const primary=target.closest('#roomShare');
      const nextShare=target.closest('[data-inline-command="new-share"]');
      if(!primary&&!nextShare)return;
      const meeting=q('#meetingOverlay');if(!meeting||meeting.hidden)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      target.closest('button')?.blur?.();
      queueMicrotask(()=>void open());
    }

    async function recheckAfterSettings(){
      if(!settingsOpened)return;
      const box=ensureRecovery();
      box.hidden=false;
      box.querySelector('[data-title]').textContent='Checking Screen Recording…';
      box.querySelector('[data-copy]').textContent='DominionStar Meet is checking the permission you just changed.';
      const state=await liveScreenAccess();
      renderRecovery(state);
      if(state.ready){
        box.hidden=true;settingsOpened=false;
        await legacy.open();
        return;
      }
      box.hidden=false;
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
      version:'2.0.41-single-approved-runtime-share-live-permission',
      permissionAware:true,
      open,
      close:()=>{try{legacy.close?.();}catch{}if(recovery)recovery.hidden=true;},
      reload:()=>open(),
      state:()=>({...legacy.state?.(),permissionStatus:lastStatus,permissionDiagnostic:lastDiagnostic,settingsOpened}),
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

  installPhysicalStyles();
  const install=()=>{
    installPhysicalStyles();
    if(!installPermissionAwareShare())setTimeout(install,25);
  };
  setTimeout(install,0);
  window.DominionPhysicalIntelligence2041=Object.freeze({version:'2.0.41',installPhysicalStyles,installPermissionAwareShare});
})();
