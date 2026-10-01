(()=>{
  const bridge=window.dominionDesktop?.sharePicker;
  const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
  const loading=$('#loadingState'),error=$('#errorState'),sourceView=$('#sourceGrid'),combinedGrid=$('#combinedGrid'),advancedGrid=$('#advancedGrid'),filesGrid=$('#filesGrid'),shareButton=$('#shareButton'),refreshButton=$('#refreshSources');
  let sources=[],selectedId='',activeTab='screens',sourceFilter='all',sharing=false,refreshInFlight=false,refreshTimer=null;

  const readPref=(key,fallback=false)=>{try{const value=localStorage.getItem(key);return value===null?fallback:value==='1';}catch{return fallback;}};
  const writePref=(key,value)=>{try{localStorage.setItem(key,value?'1':'0');}catch{}};
  $('#optimizeVideo').checked=readPref('ds_pref_share_optimize')||readPref('ds_pref_share_video_mode');
  $('#optimizeSharingVideo').checked=$('#optimizeVideo').checked;
  $('#shareAudio').checked=readPref('ds_pref_share_audio');
  $('#includeMeetWindows').checked=readPref('ds_pref_share_include_meet');
  $('#shareMeetWindowsMirror').checked=$('#includeMeetWindows').checked;
  $('#autoRefresh').checked=readPref('ds_pref_share_auto_refresh',true);

  const escapeHtml=value=>String(value||'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const sourceKindLabel=source=>source.kind==='screen'?'Entire screen':'Application window';
  const screenLabel=(source,index)=>{const raw=String(source.name||'').trim();if(/^screen\s*\d*/i.test(raw)||/^entire screen$/i.test(raw)||/^display\s*\d*/i.test(raw))return `Desktop ${index+1}`;return raw||`Desktop ${index+1}`;};
  const screenSources=()=>sources.filter(source=>source.kind==='screen');
  const selectedScreenIndex=source=>Math.max(0,screenSources().indexOf(source));
  const sourceDisplayName=(source,index=0)=>source.kind==='screen'?screenLabel(source,index):String(source.name||'Application');
  const selectedSource=()=>sources.find(source=>String(source.id)===selectedId)||null;

  function setBrand(){const logo=$('#pickerLogo'),src=String(window.dominionDesktop?.brand?.logoUrl||'');if(logo&&src)logo.src=src;}

  function sourceCard(source){
    const name=sourceDisplayName(source,selectedScreenIndex(source));
    const icon=source.icon?`<img class="source-icon" src="${escapeHtml(source.icon)}" alt="">`:'';
    const preview=source.thumbnail?`<img class="preview" src="${escapeHtml(source.thumbnail)}" alt="">`:'<span class="source-fallback" aria-hidden="true"></span>';
    return `<button class="source-card${String(source.id)===selectedId?' selected':''}" type="button" data-source-id="${escapeHtml(source.id)}" title="${escapeHtml(name)}" role="option" aria-selected="${String(source.id)===selectedId?'true':'false'}"><span class="source-check" aria-hidden="true">✓</span><span class="thumb">${preview}${icon}</span><span class="source-name">${escapeHtml(name)}</span><span class="source-meta">${escapeHtml(sourceKindLabel(source))}</span></button>`;
  }

  function visibleSources(){
    const query=String($('#sourceSearch')?.value||'').trim().toLowerCase();
    return sources.filter(source=>{if(sourceFilter!=='all'&&source.kind!==sourceFilter)return false;if(!query)return true;const name=sourceDisplayName(source,selectedScreenIndex(source)).toLowerCase();return name.includes(query)||sourceKindLabel(source).toLowerCase().includes(query);});
  }

  function updatePreview(){
    const source=selectedSource(),frame=$('#selectionPreviewFrame'),img=$('#selectionPreview'),placeholder=$('#previewPlaceholder');
    if(!source){frame.classList.add('empty');img.hidden=true;img.removeAttribute('src');placeholder.hidden=false;$('#previewName').textContent='Choose a screen or window';$('#previewMeta').textContent='Nothing is shared until you click Share.';$('#previewKind').textContent='No source selected';return;}
    const name=sourceDisplayName(source,selectedScreenIndex(source));$('#previewName').textContent=name;$('#previewMeta').textContent=sourceKindLabel(source);$('#previewKind').textContent=source.kind==='screen'?'Desktop':'Window';
    if(source.thumbnail){img.src=source.thumbnail;img.hidden=false;placeholder.hidden=true;frame.classList.remove('empty');}else{img.hidden=true;img.removeAttribute('src');placeholder.hidden=false;frame.classList.add('empty');}
  }

  function updateSelectionSummary(){
    const source=selectedSource(),summary=$('#selectionSummary'),label=$('#selectionLabel'),ready=Boolean(source);summary?.classList.toggle('ready',ready);if(label)label.textContent=ready?`Selected: ${sourceDisplayName(source,selectedScreenIndex(source))}`:'Choose a screen or window';shareButton.disabled=sharing||!ready;updatePreview();
  }

  function paintSelection(){combinedGrid.querySelectorAll('[data-source-id]').forEach(card=>{const selected=String(card.dataset.sourceId||'')===selectedId;card.classList.toggle('selected',selected);card.setAttribute('aria-selected',selected?'true':'false');});updateSelectionSummary();}
  function selectSource(id,{focus=false}={}){selectedId=String(id||'');paintSelection();if(focus)combinedGrid.querySelector(`[data-source-id="${CSS.escape(selectedId)}"]`)?.focus();}

  function bindSelectable(){
    const cards=[...combinedGrid.querySelectorAll('[data-source-id]')];
    cards.forEach(card=>{
      card.addEventListener('click',()=>selectSource(card.dataset.sourceId));
      card.addEventListener('dblclick',()=>{selectSource(card.dataset.sourceId);void shareNow();});
      card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectSource(card.dataset.sourceId);if(event.key==='Enter')void shareNow();return;}const all=[...combinedGrid.querySelectorAll('[data-source-id]')],current=all.indexOf(card);if(current<0)return;let next=current;if(event.key==='ArrowRight')next=Math.min(all.length-1,current+1);else if(event.key==='ArrowLeft')next=Math.max(0,current-1);else if(event.key==='ArrowDown')next=Math.min(all.length-1,current+3);else if(event.key==='ArrowUp')next=Math.max(0,current-3);else return;event.preventDefault();all[next]?.focus();});
    });
  }

  function sectionMarkup(title,list,klass=''){
    if(!list.length)return '';
    return `<section class="source-section ${klass}"><strong>${escapeHtml(title)}</strong><div class="source-section-grid">${list.map(source=>sourceCard(source)).join('')}</div></section>`;
  }
  function renderSources(){
    const visible=visibleSources(),screens=visible.filter(source=>source.kind==='screen'),windows=visible.filter(source=>source.kind==='window');
    $('#sourceCount').textContent=`${visible.length} ${visible.length===1?'source':'sources'}`;
    $('#sourceHeading').textContent='Screens and application windows';
    if(!visible.length){combinedGrid.innerHTML='<div class="empty-source">No screens or application windows are available.</div>';updateSelectionSummary();return;}
    combinedGrid.innerHTML=sectionMarkup('Entire screen',screens,'screen-section')+sectionMarkup('Application windows',windows,'window-section');bindSelectable();paintSelection();
  }

  function renderActiveTab(){
    const screens=activeTab==='screens',files=activeTab==='files',advanced=activeTab==='advanced';
    $('#screenControls').hidden=true;sourceView.hidden=!screens;filesGrid.hidden=!files;advancedGrid.hidden=!advanced;loading.hidden=true;error.hidden=true;if(screens)renderSources();updateSelectionSummary();
  }

  function setBusy(busy,{initial=false}={}){refreshInFlight=busy;refreshButton?.classList.toggle('refreshing',busy&&!initial);if(refreshButton)refreshButton.disabled=busy;if(initial&&busy){loading.hidden=false;error.hidden=true;sourceView.hidden=true;filesGrid.hidden=true;advancedGrid.hidden=true;}$$('.tab').forEach(tab=>tab.disabled=Boolean(initial&&busy));}
  function setStatus(message=''){const node=$('#sourceStatus');if(node)node.textContent=String(message||'');}

  async function refreshSources({initial=false,background=false}={}){
    if(refreshInFlight||sharing)return;
    const priorSelection=selectedId;setBusy(true,{initial});if(!background)setStatus(initial?'Finding screens and application windows…':'Refreshing previews…');
    try{
      const includeDominionStar=$('#includeMeetWindows').checked;
      const [screenResult,windowResult]=await Promise.all([bridge?.listSources?.({includeDominionStar,kind:'screen'}),bridge?.listSources?.({includeDominionStar,kind:'window'})]);
      const failed=[screenResult,windowResult].filter(result=>!result?.ok);
      if(failed.length===2){if(sources.length){setStatus('Could not refresh previews. Existing sources remain available.');return;}error.hidden=false;loading.hidden=true;sourceView.hidden=true;filesGrid.hidden=true;advancedGrid.hidden=true;const timedOut=failed.some(result=>result?.timedOut);$('#errorCopy').textContent=timedOut?'Source discovery is taking too long. Your meeting is still active; try again.':(failed[0]?.error||'Check Screen Recording permission and try again.');return;}
      const next=[...(screenResult?.sources||[]),...(windowResult?.sources||[])];
      const screens=next.filter(source=>source.kind==='screen');const windows=next.filter(source=>source.kind==='window').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{sensitivity:'base'}));sources=[...screens,...windows];
      const remembered=sources.find(source=>String(source.id)===priorSelection);const firstScreen=sources.find(source=>source.kind==='screen');selectedId=String(remembered?.id||firstScreen?.id||sources[0]?.id||'');renderActiveTab();setStatus('');
    }catch(err){if(sources.length)setStatus('Could not refresh previews. Existing sources remain available.');else{error.hidden=false;loading.hidden=true;sourceView.hidden=true;$('#errorCopy').textContent=String(err?.message||err||'Unable to load share sources.');}}
    finally{setBusy(false,{initial:false});$$('.tab').forEach(tab=>tab.disabled=false);updateSelectionSummary();}
  }

  function stopRefreshTimer(){if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}}
  function startRefreshTimer(){stopRefreshTimer();if(!$('#autoRefresh').checked)return;refreshTimer=setInterval(()=>{if(document.visibilityState!=='visible'||activeTab!=='screens'||sharing)return;void refreshSources({background:true});},2500);}

  async function shareNow(){
    if(sharing||!selectedId)return;
    sharing=true;stopRefreshTimer();shareButton.disabled=true;shareButton.textContent='Sharing…';
    try{
      const optimizeVideo=$('#optimizeVideo').checked,shareAudio=$('#shareAudio').checked;$('#optimizeSharingVideo').checked=optimizeVideo;writePref('ds_pref_share_optimize',optimizeVideo);writePref('ds_pref_share_audio',shareAudio);writePref('ds_pref_share_video_mode',optimizeVideo);writePref('ds_pref_share_side_by_side',$('.layout-option.active')?.dataset.layout==='side');
      const result=await bridge?.choose?.(selectedId,{optimizeVideo,shareAudio});if(!result?.ok)throw new Error(result?.error||'Unable to select this source.');
    }catch(err){sharing=false;shareButton.textContent='Share';error.hidden=true;if(activeTab==='screens')sourceView.hidden=false;setStatus(`Share could not start: ${String(err?.message||err||'Unknown error')}`);updateSelectionSummary();startRefreshTimer();}
  }

  $$('.tab').forEach(tab=>tab.addEventListener('click',()=>{activeTab=String(tab.dataset.tab||'screens');$$('.tab').forEach(item=>item.classList.toggle('active',item===tab));renderActiveTab();}));
  $$('.filter').forEach(button=>button.addEventListener('click',()=>{sourceFilter=String(button.dataset.filter||'all');$$('.filter').forEach(item=>item.classList.toggle('active',item===button));renderSources();}));
  $('#sourceSearch')?.addEventListener('input',renderSources);refreshButton?.addEventListener('click',()=>void refreshSources({background:false}));$('#retrySources').addEventListener('click',()=>void refreshSources({initial:true}));

  $$('.layout-option').forEach(button=>button.addEventListener('click',()=>{if(button.disabled)return;$$('.layout-option').forEach(item=>item.classList.toggle('active',item===button));writePref('ds_pref_share_side_by_side',button.dataset.layout==='side');}));
  if(readPref('ds_pref_share_side_by_side')){const side=$('[data-layout="side"]'),content=$('[data-layout="content"]');content?.classList.remove('active');side?.classList.add('active');}

  const syncMeetWindows=value=>{const checked=Boolean(value);$('#includeMeetWindows').checked=checked;$('#shareMeetWindowsMirror').checked=checked;writePref('ds_pref_share_include_meet',checked);void refreshSources({background:false});};
  $('#includeMeetWindows').addEventListener('change',event=>syncMeetWindows(event.currentTarget.checked));$('#shareMeetWindowsMirror').addEventListener('change',event=>syncMeetWindows(event.currentTarget.checked));
  $('#autoRefresh').addEventListener('change',event=>{writePref('ds_pref_share_auto_refresh',Boolean(event.currentTarget.checked));startRefreshTimer();});
  $('#optimizeVideo').addEventListener('change',event=>{const checked=Boolean(event.currentTarget.checked);$('#optimizeSharingVideo').checked=checked;writePref('ds_pref_share_optimize',checked);});
  $('#shareAudio').addEventListener('change',event=>writePref('ds_pref_share_audio',Boolean(event.currentTarget.checked)));

  const cancel=()=>{stopRefreshTimer();void bridge?.cancel?.();};$('#cancelTop').addEventListener('click',cancel);$('#cancelBottom').addEventListener('click',cancel);shareButton.addEventListener('click',()=>void shareNow());
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancel();}if(event.key==='Enter'&&selectedId&&!sharing&&!event.target?.matches?.('button,input')){event.preventDefault();void shareNow();}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')startRefreshTimer();else stopRefreshTimer();});window.addEventListener('beforeunload',stopRefreshTimer);

  window.dominionDesktop?.environment?.().then(info=>{const platform=String(info?.platform||''),supported=platform==='win32'||platform==='darwin';$('#shareAudio').disabled=!supported;$('#shareAudioRow').classList.toggle('disabled',!supported);}).catch(()=>{$('#shareAudio').disabled=true;$('#shareAudioRow').classList.add('disabled');});
  setBrand();void refreshSources({initial:true}).finally(startRefreshTimer);
})();