(()=>{
  const desktop=window.dominionDesktop||{},bridge=desktop.sharePicker;
  const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
  let screens=[],windows=[],selectedId='';
  const loading=$('#loadingState'),error=$('#errorState'),content=$('#sourceContent'),shareButton=$('#shareButton'),selectedName=$('#selectedName');
  const pref=key=>{try{return localStorage.getItem(key)==='1';}catch{return false;}};
  $('#optimizeVideo').checked=pref('ds_pref_share_optimize');$('#shareAudio').checked=pref('ds_pref_share_audio');
  const escapeHtml=value=>String(value||'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const timeout=(promise,ms=6000)=>new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{if(done)return;done=true;const err=new Error('Share source discovery did not finish. macOS may require DominionStar Meet to restart after Screen Recording permission changes.');err.code='share_source_timeout';reject(err);},ms);Promise.resolve(promise).then(value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);},reason=>{if(done)return;done=true;clearTimeout(timer);reject(reason);});});

  let restartButton=$('#restartDominionStar');
  if(!restartButton){restartButton=document.createElement('button');restartButton.id='restartDominionStar';restartButton.type='button';restartButton.textContent='Restart DominionStar Meet';restartButton.hidden=true;error.querySelector('div')?.append(restartButton);}

  function setBusy(busy){loading.hidden=!busy;if(busy){error.hidden=true;content.hidden=true;}for(const control of $$('button,input')){if(control.id==='cancelBottom'||control.id==='openPrivacySettings'||control.id==='restartDominionStar')continue;control.disabled=Boolean(busy);}}
  function restoreControls(){shareButton.disabled=!selectedId;$('#optimizeVideo').disabled=false;$('#showDominionStar').disabled=false;$('#shareAudio').disabled=false;$('#retrySources').disabled=false;}
  function card(source){return `<button class="source-card${source.id===selectedId?' selected':''}" type="button" data-source-id="${escapeHtml(source.id)}"><span class="thumb">${source.thumbnail?`<img src="${source.thumbnail}" alt="">`:'<span>No preview</span>'}</span><span class="source-name">${escapeHtml(source.name)}</span></button>`;}
  function bindCards(){for(const node of $$('[data-source-id]'))node.onclick=()=>{selectedId=String(node.dataset.sourceId||'');const source=[...screens,...windows].find(item=>String(item.id)===selectedId);selectedName.textContent=source?.name||'Selected source';shareButton.disabled=!selectedId;render();};}
  function render(){
    $('#screenGrid').innerHTML=screens.map(card).join('')||'<div class="empty-group">No display was returned by macOS.</div>';
    $('#windowGrid').innerHTML=windows.map(card).join('')||'<div class="empty-group">No application windows are available.</div>';
    content.hidden=false;loading.hidden=true;error.hidden=true;restartButton.hidden=true;bindCards();
  }
  function showError(copy,{restart=false}={}){loading.hidden=true;content.hidden=true;error.hidden=false;restartButton.hidden=!restart;$('#errorCopy').textContent=String(copy||'DominionStar Meet could not load shareable screens.');}

  async function refresh(){
    selectedId='';selectedName.textContent='Choose a source';shareButton.disabled=true;setBusy(true);restartButton.hidden=true;
    try{
      const includeDominionStar=$('#showDominionStar').checked;
      const screenResult=await timeout(bridge?.listSources?.({includeDominionStar,kind:'screen'}));
      if(!screenResult?.ok){showError(screenResult?.timedOut?'macOS did not return screen sources in time. If you just enabled Screen Recording, restart DominionStar Meet once.':screenResult?.error||'Screen sources are unavailable.',{restart:Boolean(screenResult?.timedOut||screenResult?.permissionRequired)});return;}
      screens=screenResult.sources||[];
      const windowResult=await timeout(bridge?.listSources?.({includeDominionStar,kind:'window'}));
      if(!windowResult?.ok){showError(windowResult?.timedOut?'Application-window discovery timed out. If Screen Recording was just enabled, restart DominionStar Meet once.':windowResult?.error||'Application windows are unavailable.',{restart:Boolean(windowResult?.timedOut||windowResult?.permissionRequired)});return;}
      windows=windowResult.sources||[];
      const first=screens[0]||windows[0]||null;if(first){selectedId=String(first.id);selectedName.textContent=String(first.name||'Selected source');}
      render();
    }catch(err){showError(String(err?.message||err||'Unable to load share sources.'),{restart:err?.code==='share_source_timeout'});}
    finally{restoreControls();}
  }

  $('#showDominionStar').addEventListener('change',()=>void refresh());
  $('#retrySources').addEventListener('click',()=>void refresh());
  $('#openPrivacySettings').addEventListener('click',()=>void desktop.media?.openPrivacy?.('screen'));
  restartButton.addEventListener('click',()=>void desktop.app?.restart?.());
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
