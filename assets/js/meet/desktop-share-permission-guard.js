(()=>{
  'use strict';
  if(window.__DS_DESKTOP_SHARE_PERMISSION_GUARD)return;
  window.__DS_DESKTOP_SHARE_PERMISSION_GUARD='1.0.0';
  if(!window.dominionDesktop?.isDesktop)return;

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const ensureDialog=()=>{
    let dialog=document.getElementById('desktopSharePermissionGuard');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='desktopSharePermissionGuard';
    dialog.innerHTML=`<div class="ds-permission-guard-card"><button type="button" class="ds-permission-close" aria-label="Close">×</button><span class="ds-permission-tag">SCREEN SHARING</span><h2 data-title>Allow Screen Recording</h2><p data-copy>DominionStar Meet needs macOS Screen & System Audio Recording permission before it can show screens and windows.</p><div class="ds-permission-actions"><button type="button" data-settings>Open System Settings</button><button type="button" data-restart hidden>Restart DominionStar Meet</button><button type="button" data-cancel>Cancel</button></div><small data-note></small></div>`;
    const style=document.createElement('style');
    style.textContent=`#desktopSharePermissionGuard{z-index:2147483646;width:min(560px,calc(100vw - 36px));border:1px solid #ffffff25;border-radius:18px;padding:0;background:#111925;color:#f5f7fb;box-shadow:0 34px 110px #000e}#desktopSharePermissionGuard::backdrop{background:#020409d9;backdrop-filter:blur(6px)}.ds-permission-guard-card{position:relative;padding:30px}.ds-permission-close{position:absolute;right:14px;top:12px;border:0;background:transparent;color:#d5dbe5;font-size:24px;cursor:pointer}.ds-permission-tag{display:inline-block;color:#e8bc49;font-size:10px;font-weight:850;letter-spacing:.14em}.ds-permission-guard-card h2{margin:10px 0 8px;font-size:22px}.ds-permission-guard-card p{margin:0;color:#b7c0ce;line-height:1.55}.ds-permission-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.ds-permission-actions button{border:1px solid #ffffff25;border-radius:9px;padding:10px 14px;background:#273244;color:#fff;font-weight:760;cursor:pointer}.ds-permission-actions button[data-settings],.ds-permission-actions button[data-restart]{background:linear-gradient(135deg,#f0cf6a,#c99d33);border-color:#e8bc49;color:#16181d}.ds-permission-guard-card small{display:block;margin-top:14px;color:#8f9bad;line-height:1.45}`;
    document.head.append(style);document.body.append(dialog);return dialog;
  };

  const permissionDialog=async state=>{
    const dialog=ensureDialog();const title=dialog.querySelector('[data-title]');const copy=dialog.querySelector('[data-copy]');const note=dialog.querySelector('[data-note]');const settings=dialog.querySelector('[data-settings]');const restart=dialog.querySelector('[data-restart]');
    const needsRestart=Boolean(state?.requiresRestart);const screen=String(state?.screen||'unknown').toLowerCase();
    title.textContent=needsRestart?'Restart to activate screen sharing':'Allow Screen & System Audio Recording';
    copy.textContent=needsRestart?'macOS has the permission change, but this running DominionStar Meet process must restart once before screen capture can begin.':'Open Privacy & Security → Screen & System Audio Recording and enable DominionStar Meet.';
    note.textContent=needsRestart?'Do not reopen Privacy & Security. Restart once, then Share Screen will enumerate your screens and windows.':'After you enable DominionStar Meet, return here and restart the app once. The permission flow will not loop.';
    settings.hidden=needsRestart;restart.hidden=!needsRestart;
    if(!dialog.open)dialog.showModal();
    return new Promise(resolve=>{
      let settled=false;const finish=value=>{if(settled)return;settled=true;if(dialog.open)dialog.close();resolve(value)};
      dialog.querySelector('.ds-permission-close').onclick=()=>finish(false);dialog.querySelector('[data-cancel]').onclick=()=>finish(false);
      restart.onclick=()=>{window.dominionDesktop.relaunchForPermissions?.();finish(false)};
      settings.onclick=async()=>{
        settings.disabled=true;
        try{await window.dominionDesktop.openScreenRecordingSettings?.();title.textContent='Restart to activate screen sharing';copy.textContent='After enabling DominionStar Meet in macOS, restart the app once before trying to share.';note.textContent='Do not click Share repeatedly while the current process is still running.';settings.hidden=true;restart.hidden=false;}finally{settings.disabled=false;}
      };
    });
  };

  const install=()=>{
    const picker=window.DominionDesktopSharePicker;if(!picker?.choose||picker.__dsPermissionGuarded)return false;
    const original=picker.choose.bind(picker);
    picker.choose=async(...args)=>{
      const runtime=await window.dominionDesktop.getRuntimeInfo?.().catch(()=>null);
      if(runtime?.platform==='darwin'){
        const state=await window.dominionDesktop.getScreenPermissionStatus?.().catch(()=>null);
        const screen=String(state?.screen||'unknown').toLowerCase();
        if(state?.requiresRestart){await permissionDialog(state);return null;}
        if(screen!=='granted'){await permissionDialog(state);return null;}
      }
      return original(...args);
    };
    picker.__dsPermissionGuarded=true;return true;
  };

  if(install())return;
  let attempts=0;const timer=setInterval(()=>{attempts+=1;if(install()||attempts>=50)clearInterval(timer)},80);
})();
