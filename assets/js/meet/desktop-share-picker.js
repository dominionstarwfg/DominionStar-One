(()=>{
  'use strict';
  if(!window.dominionDesktop?.isDesktop)return;
  const REQUIRED_BRIDGE_VERSION=9;
  const escape=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  const ensure=()=>{
    let dialog=document.getElementById('desktopSharePicker');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='desktopSharePicker';
    dialog.innerHTML=`<form method="dialog">
      <header><div class="ds-share-brand"><img src="/assets/logo.jpeg" alt=""><span><b>DOMINIONSTAR MEET</b><strong>Share your screen</strong><small>Choose exactly what meeting participants can see.</small></span></div><button value="cancel" aria-label="Close">×</button></header>
      <nav><button type="button" class="active" data-filter="all">Screens</button><button type="button" data-filter="window">Application windows</button></nav>
      <main>
        <section class="ds-share-content">
          <div class="ds-share-permission" data-permission hidden>
            <span class="ds-permission-badge" data-permission-badge>SCREEN ACCESS</span>
            <strong data-permission-title>Allow screen sharing</strong>
            <p data-permission-copy>DominionStar Meet needs macOS permission before it can display screens and application windows.</p>
            <div class="ds-share-permission-actions"><button type="button" data-open-settings>Open System Settings</button><button type="button" class="restart" data-restart-app>Restart DominionStar Meet</button></div>
            <small data-permission-note>After changing Screen & System Audio Recording in macOS, restart DominionStar Meet once so the new permission applies to this app session.</small>
          </div>
          <div class="ds-share-sources" data-sources></div>
        </section>
        <aside><strong>Sharing options</strong><label><input type="checkbox" data-share-audio> <span>Share sound</span></label><label><input type="checkbox" data-optimize> <span>Optimize for video sharing</span></label><label><input type="checkbox" data-own-windows> <span>Share DominionStar windows</span></label><p data-audio-note></p><small>DominionStar windows stay private by default to prevent the endless mirror effect.</small></aside>
      </main>
      <footer><span data-selection-label>Select a screen or window</span><div><button value="cancel">Cancel</button><button type="button" class="primary" data-confirm disabled>Share</button></div></footer>
    </form>`;
    const style=document.createElement('style');
    style.textContent=`#desktopSharePicker{width:min(1080px,92vw);height:min(720px,86vh);padding:0;border:1px solid #ffffff20;border-radius:20px;background:radial-gradient(circle at 16% 0,#243149 0,#111722 38%,#090d14 100%);color:#f4f6f8;box-shadow:0 36px 120px #000e}#desktopSharePicker::backdrop{background:radial-gradient(circle at center,#111827cc,#020409f2);backdrop-filter:blur(9px)}#desktopSharePicker form{height:100%;display:flex;flex-direction:column}#desktopSharePicker header,#desktopSharePicker footer{display:flex;align-items:center;justify-content:space-between}#desktopSharePicker header{padding:18px 22px;background:linear-gradient(135deg,#1e293bcc,#111827e8);border-bottom:1px solid #ffffff17}#desktopSharePicker header button{border:0;background:transparent;color:#d9dee5;font-size:25px;cursor:pointer}.ds-share-brand{display:flex;align-items:center;gap:13px}.ds-share-brand img{width:44px;height:44px;border-radius:12px;object-fit:cover;box-shadow:0 0 0 1px #e8bc4955,0 8px 24px #0008}.ds-share-brand span{display:block}.ds-share-brand b{display:block;margin-bottom:3px;color:#e8bc49;font-size:10px;letter-spacing:.16em}.ds-share-brand strong,.ds-share-brand small{display:block}.ds-share-brand strong{font-size:19px;letter-spacing:-.01em}.ds-share-brand small{margin-top:4px;color:#aeb9c9}#desktopSharePicker nav{display:flex;gap:26px;padding:0 20px;background:#101722cc;border-bottom:1px solid #ffffff15}#desktopSharePicker nav button{border:0;border-bottom:3px solid transparent;padding:13px 2px;background:transparent;color:#bfc7d2;font-weight:750;cursor:pointer}#desktopSharePicker nav button.active{border-color:#e8bc49;color:#fff}#desktopSharePicker main{min-height:0;flex:1;display:grid;grid-template-columns:minmax(0,1fr) 260px}.ds-share-content{min-width:0;overflow:auto}.ds-share-sources{padding:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-content:start}.ds-share-source{padding:8px;border:2px solid #ffffff14;border-radius:14px;background:linear-gradient(145deg,#222c3a,#151c27);color:#fff;text-align:left;cursor:pointer;box-shadow:0 12px 30px #0005;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.ds-share-source[hidden]{display:none}.ds-share-source:hover{transform:translateY(-2px);background:linear-gradient(145deg,#2a3647,#182130);border-color:#ffffff2e;box-shadow:0 18px 38px #0008}.ds-share-source.selected{border-color:#e8bc49;box-shadow:0 0 0 2px #e8bc4933,0 18px 42px #0009}.ds-share-source img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:9px;background:#070a0f}.ds-share-source strong{display:block;padding:9px 3px 2px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ds-share-source small{display:block;padding:0 3px 4px;color:#95a2b4}#desktopSharePicker aside{padding:24px;background:linear-gradient(180deg,#151d29,#0d131d);border-left:1px solid #ffffff17;display:flex;flex-direction:column;gap:16px}#desktopSharePicker aside>strong{color:#f7e3a8;letter-spacing:.02em}#desktopSharePicker aside label{display:flex;gap:9px;align-items:flex-start;padding:12px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff08;font-weight:650;cursor:pointer}#desktopSharePicker aside input{accent-color:#e8bc49}#desktopSharePicker aside p,#desktopSharePicker aside small{margin:0;color:#aeb7c3;font-size:12px;line-height:1.45}.ds-share-permission{max-width:610px;margin:56px auto;padding:42px;border:1px solid #e8bc493d;border-radius:18px;background:linear-gradient(145deg,#1b2533,#111824);box-shadow:inset 0 1px #ffffff0d,0 24px 60px #0005;text-align:center}.ds-permission-badge{display:inline-block;margin-bottom:13px;padding:5px 9px;border:1px solid #e8bc4938;border-radius:999px;color:#e8bc49;font-size:10px;font-weight:850;letter-spacing:.13em}.ds-share-permission strong{display:block;color:#f8e5ab;font-size:21px}.ds-share-permission p{max-width:500px;margin:10px auto 18px;color:#bdc5cf;line-height:1.55}.ds-share-permission small{display:block;max-width:520px;margin:14px auto 0;color:#8996a8;line-height:1.5}.ds-share-permission-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.ds-share-permission button{padding:10px 15px;border:1px solid #e8bc4955;border-radius:9px;background:linear-gradient(135deg,#f0cf6a,#c99d33);color:#171a20;font-weight:800;cursor:pointer;box-shadow:0 10px 28px #0007}.ds-share-permission button.restart{background:#202a38;color:#f3f6fa;border-color:#ffffff25;box-shadow:none}#desktopSharePicker footer{margin-top:auto;padding:15px 22px;background:#0d131ce8;border-top:1px solid #ffffff17}#desktopSharePicker footer span{color:#b8c0cb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#desktopSharePicker footer button{border:1px solid #5a6471;border-radius:8px;padding:10px 18px;background:#333a45;color:#fff;margin-left:8px;font-weight:750;cursor:pointer}#desktopSharePicker footer .primary{background:linear-gradient(135deg,#f0cf6a,#c99d33);color:#171a20;border-color:#e8bc49;box-shadow:0 9px 24px #0006}#desktopSharePicker footer .primary:disabled{opacity:.4;cursor:not-allowed}@media(max-width:820px){#desktopSharePicker main{grid-template-columns:1fr}#desktopSharePicker aside{border-left:0;border-top:1px solid #ffffff17;display:grid;grid-template-columns:repeat(3,1fr)}#desktopSharePicker aside>strong,#desktopSharePicker aside p,#desktopSharePicker aside small{grid-column:1/-1}.ds-share-sources{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
    document.head.append(style);
    document.body.append(dialog);
    return dialog;
  };

  const permissionCopy=(status='unknown')=>{
    const normalized=String(status||'unknown').toLowerCase();
    if(normalized==='granted')return{
      badge:'RESTART REQUIRED',
      title:'Screen access is enabled',
      copy:'macOS has Screen Recording enabled for DominionStar Meet, but this running app session has not received shareable sources yet.',
      note:'Restart DominionStar Meet once. Your meeting settings are preserved and screen/window choices should load after relaunch.',
      restart:true
    };
    if(normalized==='not-determined')return{
      badge:'MACOS PERMISSION',
      title:'Approve screen sharing',
      copy:'Complete the macOS Screen Recording prompt for DominionStar Meet. macOS controls this permission outside the meeting.',
      note:'If you enable access in Privacy & Security, restart DominionStar Meet once before sharing.',
      restart:true
    };
    if(['denied','restricted'].includes(normalized))return{
      badge:'SCREEN ACCESS BLOCKED',
      title:'Allow Screen Recording',
      copy:'Open Privacy & Security → Screen & System Audio Recording and enable DominionStar Meet.',
      note:'After changing the macOS permission, restart DominionStar Meet once so the new access applies to this app session.',
      restart:true
    };
    return{
      badge:'SCREEN ACCESS',
      title:'Screen sharing is not available yet',
      copy:'DominionStar Meet could not read shareable screens or windows from macOS.',
      note:'Check Screen & System Audio Recording, then restart DominionStar Meet and try Share again.',
      restart:true
    };
  };

  window.DominionDesktopSharePicker={choose:async()=>{
    const runtime=await window.dominionDesktop.getRuntimeInfo?.().catch(()=>null);
    const bridgeVersion=Number(runtime?.bridgeVersion||window.dominionDesktop.bridgeVersion||0);
    if(bridgeVersion<REQUIRED_BRIDGE_VERSION){
      alert('This website requires the audited DominionStar Meet desktop capture update. Update the desktop app, then completely reopen it.');
      return null;
    }
    const dialog=ensure();
    const list=dialog.querySelector('[data-sources]');
    const permission=dialog.querySelector('[data-permission]');
    const permissionBadge=dialog.querySelector('[data-permission-badge]');
    const permissionTitle=dialog.querySelector('[data-permission-title]');
    const permissionText=dialog.querySelector('[data-permission-copy]');
    const permissionNote=dialog.querySelector('[data-permission-note]');
    const restartButton=dialog.querySelector('[data-restart-app]');
    const confirm=dialog.querySelector('[data-confirm]');
    const audio=dialog.querySelector('[data-share-audio]');
    const optimize=dialog.querySelector('[data-optimize]');
    const ownWindows=dialog.querySelector('[data-own-windows]');
    const note=dialog.querySelector('[data-audio-note]');
    const selectionLabel=dialog.querySelector('[data-selection-label]');
    let sources=[];
    let selected='';
    let filter='all';

    permission.hidden=true;
    list.hidden=false;
    confirm.disabled=true;
    audio.checked=false;
    optimize.checked=false;
    ownWindows.checked=false;
    audio.disabled=!window.dominionDesktop.supportsSystemAudioShare;
    note.textContent=audio.disabled?'Computer sound is not offered on this platform until a verified native audio path is available. Microphone audio continues normally.':'Computer sound will be included in the presentation.';
    selectionLabel.textContent='Select a screen or window';

    const showPermission=screenStatus=>{
      const copy=permissionCopy(screenStatus);
      permissionBadge.textContent=copy.badge;
      permissionTitle.textContent=copy.title;
      permissionText.textContent=copy.copy;
      permissionNote.textContent=copy.note;
      restartButton.hidden=!copy.restart||typeof window.dominionDesktop.relaunchForPermissions!=='function';
      permission.hidden=false;
      list.hidden=true;
      confirm.disabled=true;
      selectionLabel.textContent=copy.title;
    };

    dialog.querySelector('[data-open-settings]').onclick=async()=>{
      await window.dominionDesktop.openScreenRecordingSettings?.();
      permissionNote.textContent='After enabling DominionStar Meet in macOS, return here and choose Restart DominionStar Meet.';
    };
    restartButton.onclick=async()=>{
      restartButton.disabled=true;
      restartButton.textContent='Restarting…';
      const accepted=await window.dominionDesktop.relaunchForPermissions?.().catch(()=>false);
      if(!accepted){restartButton.disabled=false;restartButton.textContent='Restart DominionStar Meet';}
    };

    const render=()=>{
      const visible=sources.filter(source=>filter==='all'||source.kind===filter);
      list.innerHTML=visible.length?visible.map(source=>`<button type="button" class="ds-share-source${source.id===selected?' selected':''}" data-source="${escape(source.id)}"><img src="${source.thumbnail}" alt=""><strong>${escape(source.name)}</strong><small>${source.kind==='screen'?'Entire screen':'Application window'}</small></button>`).join(''):'<p>No screen or application window is currently available.</p>';
    };

    const screenStatus=async()=>{
      const result=await window.dominionDesktop.getScreenPermissionStatus?.().catch(()=>null);
      return String(result?.screen||'unknown').toLowerCase();
    };

    const loadSources=async()=>{
      selected='';
      confirm.disabled=true;
      permission.hidden=true;
      list.hidden=false;
      selectionLabel.textContent='Loading screens and windows…';
      list.innerHTML='<p>Loading screens and windows…</p>';
      const before=runtime?.platform==='darwin'?await screenStatus():'granted';
      sources=await window.dominionDesktop.getShareSources({includeOwnWindows:ownWindows.checked});
      let after=runtime?.platform==='darwin'?await screenStatus():before;
      if(!sources.length&&runtime?.platform==='darwin'&&after==='granted'){
        await sleep(260);
        sources=await window.dominionDesktop.getShareSources({includeOwnWindows:ownWindows.checked});
        after=await screenStatus();
      }
      if(!sources.length&&runtime?.platform==='darwin'){
        showPermission(after||before);
        return;
      }
      permission.hidden=true;
      list.hidden=false;
      selectionLabel.textContent='Select a screen or window';
      render();
    };

    dialog.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{
      filter=button.dataset.filter;
      dialog.querySelectorAll('[data-filter]').forEach(item=>item.classList.toggle('active',item===button));
      render();
    });
    ownWindows.onchange=loadSources;
    list.onclick=event=>{
      const button=event.target.closest('[data-source]');
      if(!button)return;
      selected=button.dataset.source;
      const source=sources.find(item=>item.id===selected);
      confirm.disabled=!source;
      selectionLabel.textContent=source?`Ready to share: ${source.name}`:'Select a screen or window';
      render();
    };

    if(!dialog.open)dialog.showModal();
    await loadSources();
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;dialog.removeEventListener('close',closed);if(dialog.open)dialog.close();resolve(value)};
      const closed=()=>finish(null);
      dialog.addEventListener('close',closed,{once:true});
      confirm.onclick=()=>{
        const source=sources.find(item=>item.id===selected);
        if(!source)return;
        finish({sourceId:source.id,sourceName:source.name,displayId:source.displayId,kind:source.kind,audio:audio.checked&&!audio.disabled,optimize:optimize.checked,shareOwnWindow:Boolean(source.ownWindow)});
      };
    });
  }};
})();
