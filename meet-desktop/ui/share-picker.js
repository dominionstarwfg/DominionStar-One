(()=>{
  const bridge=window.dominionDesktop?.sharePicker;
  const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
  let allSources=[],filter='screen',selectedId='';
  const loading=$('#loadingState'),error=$('#errorState'),grid=$('#sourceGrid'),shareButton=$('#shareButton'),selectedName=$('#selectedName');
  const pref=key=>{try{return localStorage.getItem(key)==='1';}catch{return false;}};
  $('#optimizeVideo').checked=pref('ds_pref_share_optimize');$('#shareAudio').checked=pref('ds_pref_share_audio');

  function setBusy(busy){loading.hidden=!busy;if(busy){error.hidden=true;grid.hidden=true;}$$('button,input').forEach(control=>{if(control.id==='cancelTop'||control.id==='cancelBottom')return;if(busy&&control.id!=='retrySources')control.disabled=true;});}
  function restoreControls(){for(const tab of $$('.tab'))tab.disabled=false;$('#optimizeVideo').disabled=false;$('#showDominionStar').disabled=false;shareButton.disabled=!selectedId;}
  function render(){
    const sources=allSources.filter(source=>source.kind===filter);
    grid.innerHTML=sources.map(source=>`<button class="source-card${source.id===selectedId?' selected':''}" type="button" data-source-id="${source.id.replace(/"/g,'&quot;')}"><span class="thumb">${source.thumbnail?`<img src="${source.thumbnail}" alt="">`:'<span>No preview</span>'}</span><span class="source-name">${escapeHtml(source.name)}</span></button>`).join('');
    grid.hidden=false;loading.hidden=true;error.hidden=true;
    $$('[data-source-id]').forEach(card=>card.addEventListener('click',()=>{selectedId=card.dataset.sourceId;const source=allSources.find(item=>item.id===selectedId);selectedName.textContent=source?.name||'Selected source';shareButton.disabled=false;render();}));
  }
  const escapeHtml=value=>String(value||'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));

  async function refresh(){
    selectedId='';selectedName.textContent='Choose a source';shareButton.disabled=true;setBusy(true);
    try{
      const result=await bridge?.listSources?.({includeDominionStar:$('#showDominionStar').checked});
      if(!result?.ok){error.hidden=false;loading.hidden=true;grid.hidden=true;$('#errorCopy').textContent=result?.timedOut?'Source discovery is taking too long. Your meeting is still active; try again.':(result?.error||'Check Screen Recording permission and try again.');return;}
      allSources=result.sources||[];render();
    }catch(err){error.hidden=false;loading.hidden=true;grid.hidden=true;$('#errorCopy').textContent=String(err?.message||err||'Unable to load share sources.');}
    finally{restoreControls();}
  }

  $$('.tab').forEach(tab=>tab.addEventListener('click',()=>{filter=tab.dataset.filter;$$('.tab').forEach(item=>item.classList.toggle('active',item===tab));render();}));
  $('#showDominionStar').addEventListener('change',()=>void refresh());
  $('#retrySources').addEventListener('click',()=>void refresh());
  const cancel=()=>void bridge?.cancel?.();$('#cancelTop').addEventListener('click',cancel);$('#cancelBottom').addEventListener('click',cancel);
  shareButton.addEventListener('click',async()=>{
    if(!selectedId)return;
    shareButton.disabled=true;shareButton.textContent='Starting…';
    try{const result=await bridge?.choose?.(selectedId,{optimizeVideo:$('#optimizeVideo').checked,shareAudio:$('#shareAudio').checked});if(!result?.ok)throw new Error(result?.error||'Unable to select this source.');}
    catch(err){shareButton.textContent='Share';shareButton.disabled=false;error.hidden=false;grid.hidden=false;$('#errorCopy').textContent=String(err?.message||err);}
  });

  window.dominionDesktop?.environment?.().then(info=>{const platform=String(info?.platform||'');const supported=platform==='win32'||platform==='darwin';$('#shareAudio').disabled=!supported;$('#shareAudioRow').classList.toggle('disabled',!supported);$('#audioSupportCopy').textContent=supported?'Include system audio from the shared desktop when the operating system permits it.':'System audio sharing is unavailable on this desktop platform.';}).catch(()=>{$('#shareAudio').disabled=true;});
  void refresh();
})();
