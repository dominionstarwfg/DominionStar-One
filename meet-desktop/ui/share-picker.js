(()=>{
  const desktop=window.dominionDesktop||{},bridge=desktop.sharePicker;
  const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
  let screens=[],windows=[],selectedId='';
  const loading=$('#loadingState'),error=$('#errorState'),content=$('#sourceContent'),shareButton=$('#shareButton'),selectedName=$('#selectedName');
  const pref=key=>{try{return localStorage.getItem(key)==='1';}catch{return false;}};
  $('#optimizeVideo').checked=pref('ds_pref_share_optimize');$('#shareAudio').checked=pref('ds_pref_share_audio');
  const escapeHtml=value=>String(value||'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));

  function setBusy(busy){loading.hidden=!busy;if(busy){error.hidden=true;content.hidden=true;}for(const control of $$('button,input')){if(control.id==='cancelBottom'||control.id==='openPrivacySettings')continue;control.disabled=Boolean(busy);}}
  function restoreControls(){shareButton.disabled=!selectedId;$('#optimizeVideo').disabled=false;$('#showDominionStar').disabled=false;$('#shareAudio').disabled=false;$('#retrySources').disabled=false;}
  function card(source){return `<button class="source-card${source.id===selectedId?' selected':''}" type="button" data-source-id="${escapeHtml(source.id)}"><span class="thumb">${source.thumbnail?`<img src="${source.thumbnail}" alt="">`:'<span>No preview</span>'}</span><span class="source-name">${escapeHtml(source.name)}</span></button>`;}
  function bindCards(){for(const node of $$('[data-source-id]'))node.onclick=()=>{selectedId=String(node.dataset.sourceId||'');const source=[...screens,...windows].find(item=>String(item.id)===selectedId);selectedName.textContent=source?.name||'Selected source';shareButton.disabled=!selectedId;render();};}
  function render(){
    $('#screenGrid').innerHTML=screens.map(card).join('')||'<div class="empty-group">No display was returned by macOS.</div>';
    $('#windowGrid').innerHTML=windows.map(card).join('')||'<div class="empty-group">No application windows are available.</div>';
    content.hidden=false;loading.hidden=true;error.hidden=true;bindCards();
  }
  function showError(copy){loading.hidden=true;content.hidden=true;error.hidden=false;$('#errorCopy').textContent=String(copy||'DominionStar Meet could not load shareable screens.');}

  async function refresh(){
    selectedId='';selectedName.textContent='Choose a source';shareButton.disabled=true;setBusy(true);
    try{
      const includeDominionStar=$('#showDominionStar').checked;
      const screenResult=await bridge?.listSources?.({includeDominionStar,kind:'screen'});
      if(!screenResult?.ok){showError(screenResult?.timedOut?'macOS source discovery timed out. Try again.':screenResult?.error||'Screen sources are unavailable.');return;}
      screens=screenResult.sources||[];
      const windowResult=await bridge?.listSources?.({includeDominionStar,kind:'window'});
      if(!windowResult?.ok){showError(windowResult?.timedOut?'Application-window discovery timed out. Try again.':windowResult?.error||'Application windows are unavailable.');return;}
      windows=windowResult.sources||[];
      const first=screens[0]||windows[0]||null;if(first){selectedId=String(first.id);selectedName.textContent=String(first.name||'Selected source');}
      render();
    }catch(err){showError(String(err?.message||err||'Unable to load share sources.'));}
    finally{restoreControls();}
  }

  $('#showDominionStar').addEventListener('change',()=>void refresh());
  $('#retrySources').addEventListener('click',()=>void refresh());
  $('#openPrivacySettings').addEventListener('click',()=>void desktop.media?.openPrivacy?.('screen'));
  $('#cancelBottom').addEventListener('click',()=>void bridge?.cancel?.());
  shareButton.addEventListener('click',async()=>{
    if(!selectedId)return;shareButton.disabled=true;shareButton.textContent='Starting…';
    try{
      localStorage.setItem('ds_pref_share_optimize',$('#optimizeVideo').checked?'1':'0');localStorage.setItem('ds_pref_share_audio',$('#shareAudio').checked?'1':'0');
      const result=await bridge?.choose?.(selectedId,{optimizeVideo:$('#optimizeVideo').checked,shareAudio:$('#shareAudio').checked});if(!result?.ok)throw new Error(result?.error||'Unable to select this source.');
    }catch(err){shareButton.textContent='Share';shareButton.disabled=false;showError(String(err?.message||err||'Unable to start sharing.'));}
  });

  desktop.environment?.().then(info=>{const supported=['darwin','win32'].includes(String(info?.platform||''));$('#shareAudio').disabled=!supported;}).catch(()=>{$('#shareAudio').disabled=true;});
  void refresh();
})();
