(()=>{
  'use strict';
  if(window.DominionShareRuntimeAuthority2041)return;

  const desktop=window.dominionDesktop||{};
  const pickerBridge=desktop.sharePicker||null;
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const esc=value=>String(value||'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]));
  const pref=(key,fallback=false)=>{try{const v=localStorage.getItem(key);return v===null?fallback:v==='1';}catch{return fallback;}};
  const save=(key,value)=>{try{localStorage.setItem(key,value?'1':'0');}catch{}};
  let root=null;
  let recovery=null;
  let sources=[];
  let selectedId='';
  let busy=false;
  let activeTab='screens';
  let autoRefreshTimer=0;
  let settingsOpened=false;

  function ensureStyle(){
    if(q('style[data-ds-share-runtime-authority-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsShareRuntimeAuthority2041='1';
    style.textContent=`
      .ds2041-share-root{position:fixed;inset:0;z-index:7200;display:grid;place-items:center;background:rgba(0,0,0,.42);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f1f1f2}.ds2041-share-root[hidden]{display:none!important}
      .ds2041-share-window{width:min(900px,calc(100vw - 44px));height:min(620px,calc(100vh - 44px));min-height:520px;display:grid;grid-template-rows:58px minmax(0,1fr) 58px;background:#232426;border:1px solid #44464a;border-radius:11px;box-shadow:0 28px 90px rgba(0,0,0,.62);overflow:hidden}
      .ds2041-share-head{position:relative;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #36373a;background:#292a2c}.ds2041-share-dot{position:absolute;left:15px;top:14px;width:13px;height:13px;border-radius:50%;background:#ff4c5f}.ds2041-share-brand{position:absolute;left:38px;top:11px;height:26px;display:flex;align-items:center;opacity:.72}.ds2041-share-brand img{width:22px;height:22px;border-radius:5px;object-fit:cover}.ds2041-share-tabs{height:39px;display:flex;align-items:center;border:2px solid #1f7ac9;border-radius:10px;overflow:hidden;background:#303135}.ds2041-share-tabs button{width:88px;height:35px;border:0;background:transparent;color:#b9b9bc;font:600 11px inherit}.ds2041-share-tabs button+button{border-left:1px solid rgba(255,255,255,.05)}.ds2041-share-tabs button.active{background:#3e4b58;color:#fff}.ds2041-share-tabs button:disabled{opacity:.55}.ds2041-share-close{position:absolute;right:12px;top:10px;width:30px;height:30px;border:0;background:transparent;color:#c8c9cc;font-size:20px;cursor:pointer}
      .ds2041-share-main{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 315px}.ds2041-share-browser{position:relative;min-width:0;min-height:0;border-right:1px solid #3a3b3f;overflow:auto;padding:16px 18px 20px}.ds2041-share-status{position:absolute;right:14px;top:8px;color:#85868a;font-size:9px}.ds2041-source-section{margin-bottom:16px}.ds2041-source-section>strong{display:block;margin:0 0 10px 4px;font-size:11px;font-weight:600}.ds2041-source-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px 12px}.ds2041-source-section.screen .ds2041-source-grid{grid-template-columns:minmax(180px,210px)}.ds2041-source{position:relative;min-width:0;padding:7px 7px 9px;border:2px solid transparent;border-radius:7px;background:#2a2b2e;color:#fff;text-align:center;cursor:pointer}.ds2041-source:hover{background:#303135}.ds2041-source.selected{border-color:#0d87ff;background:#0d72e6}.ds2041-thumb{position:relative;aspect-ratio:16/9;border-radius:3px;background:#161719;overflow:hidden;display:grid;place-items:center}.ds2041-thumb img{width:100%;height:100%;object-fit:contain;background:#111}.ds2041-source-name{display:block;margin:7px 2px 0;font-size:9.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ds2041-empty,.ds2041-loading{height:100%;min-height:280px;display:grid;place-items:center;align-content:center;gap:9px;color:#aaa;text-align:center;font-size:10px}.ds2041-spinner{width:26px;height:26px;border:3px solid #45464a;border-top-color:#0e72ed;border-radius:50%;animation:ds2041spin .8s linear infinite}@keyframes ds2041spin{to{transform:rotate(360deg)}}
      .ds2041-share-right{min-width:0;min-height:0;padding:12px 14px;background:#292a2c;overflow:auto}.ds2041-presenter-head{height:24px;display:flex;align-items:center;justify-content:space-between;font-size:10px}.ds2041-preview{height:118px;border:1px solid #404145;border-radius:4px;background:#17181a;display:grid;place-items:center;overflow:hidden;color:#7f8083;font-size:9px}.ds2041-preview img{width:100%;height:100%;object-fit:contain}.ds2041-layout-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.ds2041-layout{height:58px;padding:5px;border:1px solid #3b3c40;border-radius:7px;background:#2a2b2d;color:#ddd;font-size:8.5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer}.ds2041-layout.active{border:2px solid #1688ff;background:#30353a}.ds2041-layout:disabled{opacity:.42;cursor:default}.ds2041-layout-glyph{width:48px;height:22px;border:1.4px solid #ececee;border-radius:3px;position:relative}.ds2041-layout.side .ds2041-layout-glyph:after{content:"";position:absolute;top:0;bottom:0;left:50%;border-left:1.3px solid #fff}.ds2041-share-options{margin-top:14px;padding-top:8px}.ds2041-options-title{margin-bottom:7px;font-size:10px;font-weight:600}.ds2041-option{min-height:30px;display:grid;grid-template-columns:16px minmax(0,1fr);align-items:center;gap:6px;color:#eee;font-size:9.5px}.ds2041-option input{width:14px;height:14px;margin:0;accent-color:#0e72ed}.ds2041-more{display:grid;gap:10px}.ds2041-more-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #404145;border-radius:7px;background:#292a2d}.ds2041-more-card strong{font-size:10px}.ds2041-more-card p{margin:4px 0 0;color:#8f9094;font-size:9px}.ds2041-more-card input{accent-color:#0e72ed}
      .ds2041-share-footer{display:flex;align-items:center;justify-content:center;border-top:1px solid #3a3b3e;background:#292a2c}.ds2041-share-button{width:140px;height:34px;border:0;border-radius:7px;background:#0e72ed;color:#fff;font-size:10.5px;font-weight:600;cursor:pointer}.ds2041-share-button:disabled{background:#55565a;color:#aaa;cursor:not-allowed}
      .ds2041-recovery{position:fixed;inset:0;z-index:7300;display:grid;place-items:center;background:rgba(0,0,0,.54);color:#f2f2f3;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ds2041-recovery[hidden]{display:none!important}.ds2041-recovery-card{width:min(470px,calc(100vw - 40px));padding:22px;border:1px solid #484a4e;border-radius:12px;background:#242527;box-shadow:0 24px 70px rgba(0,0,0,.62)}.ds2041-recovery-card p{margin:0 0 5px;color:#77aef8;font-size:9px;font-weight:700;letter-spacing:.14em}.ds2041-recovery-card h3{margin:0 0 8px;font-size:17px}.ds2041-recovery-card span{display:block;color:#b7b8bc;font-size:12px;line-height:1.5}.ds2041-recovery-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ds2041-recovery-actions button{height:32px;padding:0 13px;border:1px solid #505257;border-radius:6px;background:#323337;color:#fff;font-size:11px}.ds2041-recovery-actions .primary{border-color:#0e72ed;background:#0e72ed}
      @media(max-width:880px){.ds2041-share-main{grid-template-columns:minmax(0,1fr) 275px}.ds2041-source-grid{grid-template-columns:repeat(2,minmax(145px,1fr))}}
    `;
    document.head.append(style);
  }

  const screenName=(source,index)=>{const raw=String(source?.name||'').trim();return /^screen\s*\d*/i.test(raw)||/^display\s*\d*/i.test(raw)||/^entire screen$/i.test(raw)?`Desktop ${index+1}`:(raw||`Desktop ${index+1}`);};
  const displayName=source=>source?.kind==='screen'?screenName(source,Math.max(0,sources.filter(item=>item.kind==='screen').indexOf(source))):String(source?.name||'Application');
  const selected=()=>sources.find(item=>String(item.id)===selectedId)||null;

  function stopAutoRefresh(){clearInterval(autoRefreshTimer);autoRefreshTimer=0;}
  function startAutoRefresh(){stopAutoRefresh();if(!pref('ds_pref_share_auto_refresh',true)||activeTab!=='screens'||root?.hidden)return;autoRefreshTimer=setInterval(()=>{if(!busy&&document.visibilityState==='visible'&&root&&!root.hidden)void loadSources({background:true});},3000);}

  function ensureRoot(){
    ensureStyle();
    if(root?.isConnected)return root;
    root=document.createElement('section');root.className='ds2041-share-root';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
    root.innerHTML=`<div class="ds2041-share-window"><header class="ds2041-share-head"><span class="ds2041-share-dot" aria-hidden="true"></span><span class="ds2041-share-brand"><img alt=""></span><nav class="ds2041-share-tabs"><button type="button" data-tab="screens" class="active">Screens</button><button type="button" disabled title="File presenting is not certified yet">Files</button><button type="button" data-tab="more">More</button></nav><button type="button" class="ds2041-share-close" aria-label="Close">×</button></header><section class="ds2041-share-main"><div class="ds2041-share-browser"><span class="ds2041-share-status"></span><div class="ds2041-share-content"></div></div><aside class="ds2041-share-right"><section class="ds2041-presenter"><div class="ds2041-presenter-head"><strong>Presenter layout</strong><span>↗</span></div><div class="ds2041-preview"><span>Select a screen or window</span></div><div class="ds2041-layout-grid"><button class="ds2041-layout active" type="button" data-layout="content"><span class="ds2041-layout-glyph"></span><span>Content only</span></button><button class="ds2041-layout" type="button" disabled><span class="ds2041-layout-glyph"></span><span>As background</span></button><button class="ds2041-layout" type="button" disabled><span class="ds2041-layout-glyph"></span><span>Over the shoulder</span></button><button class="ds2041-layout side" type="button" data-layout="side"><span class="ds2041-layout-glyph"></span><span>Side by side</span></button></div></section><section class="ds2041-share-options"><div class="ds2041-options-title">Share options</div><label class="ds2041-option"><input type="checkbox" data-share-audio><span>Share sound</span></label><label class="ds2041-option"><input type="checkbox" data-optimize><span>Optimize for video sharing</span></label><label class="ds2041-option"><input type="checkbox" data-include-meet><span>Share DominionStar Meet windows</span></label></section></aside></section><footer class="ds2041-share-footer"><button type="button" class="ds2041-share-button" disabled>Share</button></footer></div>`;
    document.body.append(root);
    const logo=root.querySelector('.ds2041-share-brand img');if(logo&&desktop.brand?.logoUrl)logo.src=desktop.brand.logoUrl;
    root.querySelector('.ds2041-share-close').onclick=close;
    root.querySelector('[data-share-audio]').checked=pref('ds_pref_share_audio');
    root.querySelector('[data-optimize]').checked=pref('ds_pref_share_optimize')||pref('ds_pref_share_video_mode');
    root.querySelector('[data-include-meet]').checked=pref('ds_pref_share_include_meet');
    const savedSide=pref('ds_pref_share_side_by_side');if(savedSide){root.querySelector('[data-layout="content"]')?.classList.remove('active');root.querySelector('[data-layout="side"]')?.classList.add('active');}
    root.querySelectorAll('[data-layout]').forEach(button=>button.onclick=()=>{root.querySelectorAll('[data-layout]').forEach(item=>item.classList.toggle('active',item===button));save('ds_pref_share_side_by_side',button.dataset.layout==='side');});
    root.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{activeTab=button.dataset.tab;root.querySelectorAll('[data-tab]').forEach(item=>item.classList.toggle('active',item===button));render();if(activeTab==='screens')startAutoRefresh();else stopAutoRefresh();});
    root.querySelector('[data-include-meet]').onchange=event=>{save('ds_pref_share_include_meet',event.currentTarget.checked);if(activeTab==='screens')void loadSources();};
    root.querySelector('[data-share-audio]').onchange=event=>save('ds_pref_share_audio',event.currentTarget.checked);
    root.querySelector('[data-optimize]').onchange=event=>save('ds_pref_share_optimize',event.currentTarget.checked);
    root.querySelector('.ds2041-share-button').onclick=()=>void commit();
    root.addEventListener('pointerdown',event=>{if(event.target===root)close();});
    return root;
  }

  function renderSources(){
    const content=root.querySelector('.ds2041-share-content'),screens=sources.filter(item=>item.kind==='screen'),windows=sources.filter(item=>item.kind==='window');
    const section=(title,list,klass='')=>!list.length?'':`<section class="ds2041-source-section ${klass}"><strong>${esc(title)}</strong><div class="ds2041-source-grid">${list.map(source=>`<button type="button" class="ds2041-source${String(source.id)===selectedId?' selected':''}" data-source-id="${esc(source.id)}"><span class="ds2041-thumb">${source.thumbnail?`<img src="${esc(source.thumbnail)}" alt="">`:'<span>▣</span>'}</span><span class="ds2041-source-name">${esc(displayName(source))}</span></button>`).join('')}</div></section>`;
    content.innerHTML=section('Entire screen',screens,'screen')+section('Application windows',windows,'window')||'<div class="ds2041-empty">No screens or application windows are available.</div>';
    content.querySelectorAll('[data-source-id]').forEach(card=>card.onclick=()=>{selectedId=String(card.dataset.sourceId||'');content.querySelectorAll('[data-source-id]').forEach(item=>item.classList.toggle('selected',item===card));syncSelected();});
    syncSelected();
  }

  function renderMore(){
    const content=root.querySelector('.ds2041-share-content');
    content.innerHTML=`<div class="ds2041-more"><article class="ds2041-more-card"><div><strong>Share DominionStar Meet windows</strong><p>Include DominionStar Meet windows in the Screens tab.</p></div><input type="checkbox" data-more-include ${pref('ds_pref_share_include_meet')?'checked':''}></article><article class="ds2041-more-card"><div><strong>Live source previews</strong><p>Refresh screen and application previews automatically while this chooser is open.</p></div><input type="checkbox" data-more-refresh ${pref('ds_pref_share_auto_refresh',true)?'checked':''}></article></div>`;
    content.querySelector('[data-more-include]').onchange=event=>{save('ds_pref_share_include_meet',event.currentTarget.checked);root.querySelector('[data-include-meet]').checked=event.currentTarget.checked;};
    content.querySelector('[data-more-refresh]').onchange=event=>save('ds_pref_share_auto_refresh',event.currentTarget.checked);
  }

  function render(){if(!root)return;if(activeTab==='more')renderMore();else renderSources();}

  function syncSelected(){
    const source=selected(),button=root.querySelector('.ds2041-share-button'),preview=root.querySelector('.ds2041-preview');button.disabled=busy||!source;
    preview.innerHTML=source?.thumbnail?`<img src="${esc(source.thumbnail)}" alt="">`:`<span>${source?esc(displayName(source)):'Select a screen or window'}</span>`;
  }

  async function loadSources({background=false}={}){
    if(busy||!pickerBridge?.listSources)return false;
    busy=true;const content=root.querySelector('.ds2041-share-content'),status=root.querySelector('.ds2041-share-status');if(!background){content.innerHTML='<div class="ds2041-loading"><i class="ds2041-spinner"></i><span>Finding screens and application windows…</span></div>';status.textContent='';}
    const includeDominionStar=Boolean(root.querySelector('[data-include-meet]')?.checked);
    try{
      const [screenResult,windowResult]=await Promise.all([pickerBridge.listSources({kind:'screen',includeDominionStar}),pickerBridge.listSources({kind:'window',includeDominionStar})]);
      const next=[...(screenResult?.sources||[]),...(windowResult?.sources||[])];
      if(!next.length){if(background&&sources.length)return true;await showRecovery({screenResult,windowResult});return false;}
      const old=selectedId;sources=[...next.filter(item=>item.kind==='screen'),...next.filter(item=>item.kind==='window').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')))];
      selectedId=String(sources.find(item=>String(item.id)===old)?.id||sources.find(item=>item.kind==='screen')?.id||sources[0]?.id||'');status.textContent='';render();return true;
    }catch(error){if(background&&sources.length)return true;await showRecovery({error:String(error?.message||error||'source_list_failed')});return false;}
    finally{busy=false;syncSelected();}
  }

  function ensureRecovery(){
    ensureStyle();if(recovery?.isConnected)return recovery;
    recovery=document.createElement('section');recovery.className='ds2041-recovery';recovery.hidden=true;recovery.innerHTML='<div class="ds2041-recovery-card"><p>SCREEN SHARING</p><h3>Screen Recording access needs to refresh</h3><span data-copy></span><div class="ds2041-recovery-actions"><button type="button" data-cancel>Cancel</button><button type="button" data-settings>Open System Settings</button><button type="button" class="primary" data-restart>Restart DominionStar Meet</button></div></div>';document.body.append(recovery);
    recovery.querySelector('[data-cancel]').onclick=()=>{recovery.hidden=true;};
    recovery.querySelector('[data-settings]').onclick=async()=>{settingsOpened=true;await desktop.media?.openPrivacy?.('screen').catch?.(()=>{});await refreshRecoveryCopy();};
    recovery.querySelector('[data-restart]').onclick=()=>void desktop.app?.relaunch?.();
    return recovery;
  }

  async function refreshRecoveryCopy(){
    const box=ensureRecovery(),copy=box.querySelector('[data-copy]');let status='unknown';try{status=String((await desktop.media?.permissions?.())?.screen||'unknown').toLowerCase();}catch{}
    if(status==='granted'||settingsOpened)copy.textContent='DominionStar Meet is enabled in Screen & System Audio Recording. Restart this running copy once so macOS can refresh the capture permission, then Share will reopen this approved chooser.';
    else copy.textContent='Enable DominionStar Meet in Privacy & Security → Screen & System Audio Recording. Then return here and restart DominionStar Meet once.';
    box.querySelector('[data-restart]').hidden=!(status==='granted'||settingsOpened);
  }

  async function showRecovery(){close();const box=ensureRecovery();await refreshRecoveryCopy();box.hidden=false;}

  async function open(){
    if(!pickerBridge?.listSources||!pickerBridge?.choose)return false;
    qa('.ds-smart-share-picker,.ds-share-permission,.ds-219-share-recovery,#screenPermissionDialog').forEach(node=>{try{node.hidden=true;}catch{}});
    const panel=ensureRoot();activeTab='screens';panel.querySelectorAll('[data-tab]').forEach(item=>item.classList.toggle('active',item.dataset.tab==='screens'));panel.hidden=false;selectedId='';sources=[];render();const ok=await loadSources();if(ok)startAutoRefresh();return ok;
  }

  function close(){stopAutoRefresh();if(root)root.hidden=true;}

  async function waitForShareCommit(sourceName,wasActive,timeoutMs=5200){
    const desired=String(sourceName||'');
    const deadline=Date.now()+Math.max(1000,Number(timeoutMs)||5200);
    while(Date.now()<deadline){
      const state=window.DominionShareIntegration?.state?.()||{};
      if(state.active&&(!wasActive||!desired||String(state.sourceName||'')===desired))return true;
      await wait(60);
    }
    const state=window.DominionShareIntegration?.state?.()||{};
    return Boolean(state.active&&(!wasActive||!desired||String(state.sourceName||'')===desired));
  }

  async function commit(){
    const source=selected();if(!source||busy||!pickerBridge?.choose)return false;
    const priorState=window.DominionShareIntegration?.state?.()||{};
    busy=true;syncSelected();stopAutoRefresh();
    const button=root.querySelector('.ds2041-share-button'),status=root.querySelector('.ds2041-share-status');
    button.textContent='Starting share…';if(status)status.textContent='Preparing selected content…';
    const options={shareAudio:Boolean(root.querySelector('[data-share-audio]')?.checked),optimizeVideo:Boolean(root.querySelector('[data-optimize]')?.checked)};
    try{
      const result=await pickerBridge.choose(source.id,options);if(result?.ok===false)throw new Error(result.error||'share_source_not_available');
      save('ds_pref_share_audio',options.shareAudio);save('ds_pref_share_optimize',options.optimizeVideo);
      const committed=await waitForShareCommit(source.name,Boolean(priorState.active));
      if(!committed)throw new Error('Screen sharing did not become active. Please choose the source again.');
      if(status)status.textContent='';close();return true;
    }
    catch(error){
      if(status)status.textContent=String(error?.message||error||'That source could not start.');
      if(activeTab==='screens')startAutoRefresh();return false;
    }
    finally{busy=false;button.textContent='Share';syncSelected();}
  }

  function intercept(event){
    const target=event.target;if(!target?.closest)return;
    const primary=target.closest('#roomShare');const newShare=target.closest('[data-inline-command="new-share"]');if(!primary&&!newShare)return;
    const meeting=q('#meetingOverlay');if(!meeting||meeting.hidden)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    target.closest('button')?.blur?.();queueMicrotask(()=>void open());
  }

  window.addEventListener('click',intercept,true);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&root&&!root.hidden){event.preventDefault();close();}},true);
  window.DominionShareRuntimeAuthority2041=Object.freeze({version:'2.0.41-single-approved-runtime-share',open,close,reload:()=>loadSources(),state:()=>({visible:Boolean(root&&!root.hidden),selectedId,sourceCount:sources.length,busy,activeTab}),dispose:()=>{stopAutoRefresh();window.removeEventListener('click',intercept,true);root?.remove();recovery?.remove();}});
})();
