(()=>{
  if(!window.dominionDesktop?.isDesktop)return;
  const REQUIRED_BRIDGE_VERSION=9;
  const escape=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

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
          <div class="ds-share-permission" data-permission hidden><strong>Allow Screen Recording</strong><p>DominionStar Meet needs macOS Screen Recording permission to show safe screen and window choices.</p><button type="button" data-open-settings>Open System Settings</button><small>After allowing DominionStar Meet, completely quit and reopen the app.</small></div>
          <div class="ds-share-sources" data-sources></div>
        </section>
        <aside><strong>Sharing options</strong><label><input type="checkbox" data-share-audio> Share sound</label><label><input type="checkbox" data-optimize> Optimize for video sharing</label><label><input type="checkbox" data-own-windows> Share DominionStar windows</label><p data-audio-note></p><small>DominionStar windows stay private by default to prevent the endless mirror effect.</small></aside>
      </main>
      <footer><span data-selection-label>Select a screen or window</span><div><button value="cancel">Cancel</button><button type="button" class="primary" data-confirm disabled>Share</button></div></footer>
    </form>`;
    const style=document.createElement('style');
    style.textContent=`#desktopSharePicker{width:min(1080px,92vw);height:min(720px,86vh);padding:0;border:1px solid #3d4654;border-radius:14px;box-shadow:0 28px 90px #000b;background:#20252d;color:#f4f6f8}#desktopSharePicker::backdrop{background:#05080dc9}#desktopSharePicker form{height:100%;display:flex;flex-direction:column}#desktopSharePicker header,#desktopSharePicker footer{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#262c35}#desktopSharePicker header{border-bottom:1px solid #424a56}#desktopSharePicker header strong,#desktopSharePicker header small{display:block}#desktopSharePicker header strong{font-size:20px}#desktopSharePicker header small{margin-top:4px;color:#b8c0cb}#desktopSharePicker header button{border:0;background:transparent;color:#d9dee5;font-size:25px}#desktopSharePicker nav{display:flex;gap:26px;padding:0 20px;border-bottom:1px solid #414955;background:#262c35}#desktopSharePicker nav button{border:0;border-bottom:3px solid transparent;padding:13px 2px;background:transparent;color:#bfc7d2;font-weight:750}#desktopSharePicker nav button.active{border-color:#c6a451;color:#fff}#desktopSharePicker main{min-height:0;flex:1;display:grid;grid-template-columns:minmax(0,1fr) 260px}.ds-share-content{min-width:0;overflow:auto}.ds-share-sources{padding:20px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;align-content:start}.ds-share-source{padding:7px;border:3px solid transparent;border-radius:11px;background:#303741;color:#fff;text-align:left;cursor:pointer}.ds-share-source[hidden]{display:none}.ds-share-source:hover{background:#37404c}.ds-share-source.selected{border-color:#d1ab47}.ds-share-source img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:6px;background:#141820}.ds-share-source strong{display:block;padding:9px 3px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ds-share-source small{padding:0 3px;color:#b4bdc8}#desktopSharePicker aside{padding:20px;border-left:1px solid #424a56;background:#292f38;display:flex;flex-direction:column;gap:16px}#desktopSharePicker aside>strong{font-size:16px}#desktopSharePicker aside label{display:flex;gap:9px;align-items:flex-start;font-weight:650}#desktopSharePicker aside p,#desktopSharePicker aside small{margin:0;color:#aeb7c3;font-size:12px;line-height:1.45}.ds-share-permission{margin:28px;padding:30px;border:1px solid #4a5360;border-radius:12px;text-align:center;background:#292f38}.ds-share-permission strong{font-size:19px}.ds-share-permission p,.ds-share-permission small{display:block;color:#bdc5cf}.ds-share-permission button{margin:8px 0 14px;padding:10px 15px;border:0;border-radius:8px;background:#c4a04a;color:#171a20;font-weight:800}#desktopSharePicker footer{margin-top:auto;border-top:1px solid #424a56}#desktopSharePicker footer span{color:#b8c0cb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#desktopSharePicker footer button{border:1px solid #5a6471;border-radius:8px;padding:10px 18px;background:#333a45;color:#fff;margin-left:8px;font-weight:750}#desktopSharePicker footer .primary{background:#c4a04a;color:#171a20;border-color:#c4a04a}#desktopSharePicker footer .primary:disabled{opacity:.4}`;
    style.textContent+=`#desktopSharePicker{border-color:#ffffff20;border-radius:20px;background:radial-gradient(circle at 16% 0,#243149 0,#111722 38%,#090d14 100%);box-shadow:0 36px 120px #000e}#desktopSharePicker::backdrop{background:radial-gradient(circle at center,#111827cc,#020409f2);backdrop-filter:blur(9px)}#desktopSharePicker header{padding:18px 22px;background:linear-gradient(135deg,#1e293bcc,#111827e8);border-bottom-color:#ffffff17}.ds-share-brand{display:flex;align-items:center;gap:13px}.ds-share-brand img{width:44px;height:44px;border-radius:12px;object-fit:cover;box-shadow:0 0 0 1px #e8bc4955,0 8px 24px #0008}.ds-share-brand span{display:block}.ds-share-brand b{display:block;margin-bottom:3px;color:#e8bc49;font-size:10px;letter-spacing:.16em}.ds-share-brand strong{font-size:19px!important;letter-spacing:-.01em}.ds-share-brand small{color:#aeb9c9!important}#desktopSharePicker nav{background:#101722cc;border-bottom-color:#ffffff15}#desktopSharePicker nav button{cursor:pointer}#desktopSharePicker nav button.active{border-color:#e8bc49;color:#fff}.ds-share-sources{padding:24px;gap:18px}.ds-share-source{padding:8px;border:2px solid #ffffff14;border-radius:14px;background:linear-gradient(145deg,#222c3a,#151c27);box-shadow:0 12px 30px #0005;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.ds-share-source:hover{transform:translateY(-2px);background:linear-gradient(145deg,#2a3647,#182130);border-color:#ffffff2e;box-shadow:0 18px 38px #0008}.ds-share-source.selected{border-color:#e8bc49;box-shadow:0 0 0 2px #e8bc4933,0 18px 42px #0009}.ds-share-source img{border-radius:9px;background:#070a0f}.ds-share-source strong{font-size:13px}.ds-share-source small{display:block;padding-bottom:4px;color:#95a2b4}#desktopSharePicker aside{padding:24px;background:linear-gradient(180deg,#151d29,#0d131d);border-left-color:#ffffff17}#desktopSharePicker aside>strong{color:#f7e3a8;letter-spacing:.02em}#desktopSharePicker aside label{padding:12px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff08;cursor:pointer}#desktopSharePicker aside input{accent-color:#e8bc49}.ds-share-permission{margin:34px;padding:44px;border-color:#e8bc493d;border-radius:16px;background:linear-gradient(145deg,#1b2533,#111824);box-shadow:inset 0 1px #ffffff0d}.ds-share-permission strong{color:#f8e5ab}.ds-share-permission button{background:linear-gradient(135deg,#f0cf6a,#c99d33);box-shadow:0 10px 28px #0007}#desktopSharePicker footer{padding:15px 22px;background:#0d131ce8;border-top-color:#ffffff17}#desktopSharePicker footer button{cursor:pointer}#desktopSharePicker footer .primary{background:linear-gradient(135deg,#f0cf6a,#c99d33);border-color:#e8bc49;box-shadow:0 9px 24px #0006}`;
    document.head.append(style);
    document.body.append(dialog);
    return dialog;
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
    const confirm=dialog.querySelector('[data-confirm]');
    const audio=dialog.querySelector('[data-share-audio]');
    const optimize=dialog.querySelector('[data-optimize]');
    const ownWindows=dialog.querySelector('[data-own-windows]');
    const note=dialog.querySelector('[data-audio-note]');
    const selectionLabel=dialog.querySelector('[data-selection-label]');
    let sources=[];
    let selected='';
    let filter='all';

    // Electron/macOS can retain a stale Screen Recording status after the user
    // grants access. Always attempt real source enumeration; only show the
    // permission help state when that attempt produces no shareable sources.
    permission.hidden=true;
    list.hidden=false;
    confirm.disabled=true;
    audio.checked=false;
    optimize.checked=false;
    ownWindows.checked=false;
    audio.disabled=!window.dominionDesktop.supportsSystemAudioShare;
    note.textContent=audio.disabled?'Computer sound is not offered on this platform until a verified native audio path is available. Microphone audio continues normally.':'Computer sound will be included in the presentation.';
    selectionLabel.textContent='Select a screen or window';
    dialog.querySelector('[data-open-settings]').onclick=()=>window.dominionDesktop.openScreenRecordingSettings?.();

    const render=()=>{
      const visible=sources.filter(source=>filter==='all'||source.kind===filter);
      list.innerHTML=visible.length?visible.map(source=>`<button type="button" class="ds-share-source${source.id===selected?' selected':''}" data-source="${escape(source.id)}"><img src="${source.thumbnail}" alt=""><strong>${escape(source.name)}</strong><small>${source.kind==='screen'?'Entire screen':'Application window'}</small></button>`).join(''):'<p>No shareable source is available. On macOS, allow Screen Recording and restart DominionStar Meet.</p>';
    };
    const loadSources=async()=>{
      selected='';
      confirm.disabled=true;
      selectionLabel.textContent='Loading screens and windows…';
      list.innerHTML='<p>Loading screens and windows…</p>';
      sources=await window.dominionDesktop.getShareSources({includeOwnWindows:ownWindows.checked});
      if(!sources.length&&runtime?.platform==='darwin'){
        permission.hidden=false;
        list.hidden=true;
        selectionLabel.textContent='Screen Recording permission required';
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
      dialog.showModal();
    });
  }};
})();
