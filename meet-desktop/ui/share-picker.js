(()=>{
  const bridge=window.dominionDesktop?.sharePicker;
  const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
  const loading=$('#loadingState'),error=$('#errorState'),basicGrid=$('#sourceGrid'),screenGrid=$('#screenGrid'),windowGrid=$('#windowGrid'),advancedGrid=$('#advancedGrid'),filesGrid=$('#filesGrid'),shareButton=$('#shareButton');
  let basicSources=[],selectedId='',activeTab='basic',sharing=false;

  const pref=key=>{try{return localStorage.getItem(key)==='1';}catch{return false;}};
  $('#optimizeVideo').checked=pref('ds_pref_share_optimize')||pref('ds_pref_share_video_mode');
  $('#optimizeSharingVideo').checked=$('#optimizeVideo').checked;
  $('#shareAudio').checked=pref('ds_pref_share_audio');

  const escapeHtml=value=>String(value||'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const sourceKindLabel=source=>source.kind==='screen'?'Entire screen':'Application window';
  const screenLabel=(source,index)=>{
    const raw=String(source.name||'').trim();
    if(/^screen\s*\d*/i.test(raw)||/^entire screen$/i.test(raw)||/^display\s*\d*/i.test(raw))return `Desktop ${index+1}`;
    return raw||`Desktop ${index+1}`;
  };
  const sourceDisplayName=(source,index=0)=>source.kind==='screen'?screenLabel(source,index):String(source.name||'Application');
  const selectedSource=()=>basicSources.find(source=>String(source.id)===selectedId)||null;

  function setBrand(){
    const logo=$('#pickerLogo'),src=String(window.dominionDesktop?.brand?.logoUrl||'');
    if(logo&&src)logo.src=src;
  }

  function specialCard({id,name,symbol,meta='',disabled=false,klass=''}){
    return `<button class="source-card${id===selectedId?' selected':''}" type="button" data-source-id="${escapeHtml(id)}" ${disabled?'disabled':''} role="option" aria-selected="${id===selectedId?'true':'false'}"><span class="thumb"><span class="source-symbol ${klass}">${symbol}</span></span><span class="source-name">${escapeHtml(name)}</span>${meta?`<span class="source-meta">${escapeHtml(meta)}</span>`:''}</button>`;
  }

  function sourceCard(source,index){
    const name=sourceDisplayName(source,index);
    const icon=source.icon?`<img class="source-icon" src="${source.icon}" alt="">`:'';
    return `<button class="source-card${source.id===selectedId?' selected':''}" type="button" data-source-id="${escapeHtml(source.id)}" title="${escapeHtml(name)}" role="option" aria-selected="${source.id===selectedId?'true':'false'}"><span class="thumb">${source.thumbnail?`<img class="preview" src="${source.thumbnail}" alt="">`:'<span class="source-symbol">▣</span>'}${icon}</span><span class="source-name">${escapeHtml(name)}</span><span class="source-meta">${sourceKindLabel(source)}</span></button>`;
  }

  function updateSelectionSummary(){
    const summary=$('#selectionSummary'),label=$('#selectionLabel'),source=selectedSource();
    const ready=Boolean(source&&activeTab==='basic');
    summary?.classList.toggle('ready',ready);
    if(label)label.textContent=ready?`Selected: ${sourceDisplayName(source,basicSources.filter(item=>item.kind==='screen').indexOf(source))}`:'Choose a screen or window';
    shareButton.disabled=sharing||!ready;
  }

  function paintSelection(){
    basicGrid.querySelectorAll('[data-source-id]').forEach(card=>{
      const selected=String(card.dataset.sourceId||'')===selectedId;
      card.classList.toggle('selected',selected);
      card.setAttribute('aria-selected',selected?'true':'false');
    });
    updateSelectionSummary();
  }

  function selectSource(id,{focus=false}={}){
    selectedId=String(id||'');
    paintSelection();
    if(focus)basicGrid.querySelector(`[data-source-id="${CSS.escape(selectedId)}"]`)?.focus();
  }

  function bindSelectable(root){
    const cards=[...root.querySelectorAll('[data-source-id]:not([disabled])')];
    cards.forEach(card=>{
      card.addEventListener('click',()=>selectSource(card.dataset.sourceId));
      card.addEventListener('dblclick',()=>{selectSource(card.dataset.sourceId);void shareNow();});
      card.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();selectSource(card.dataset.sourceId);if(event.key==='Enter')void shareNow();return;}
        const all=[...basicGrid.querySelectorAll('[data-source-id]:not([disabled])')];
        const current=all.indexOf(card);if(current<0)return;
        const columns=innerWidth<=760?2:innerWidth<=980?3:4;
        let next=current;
        if(event.key==='ArrowRight')next=Math.min(all.length-1,current+1);
        else if(event.key==='ArrowLeft')next=Math.max(0,current-1);
        else if(event.key==='ArrowDown')next=Math.min(all.length-1,current+columns);
        else if(event.key==='ArrowUp')next=Math.max(0,current-columns);
        else return;
        event.preventDefault();all[next]?.focus();
      });
    });
  }

  function renderGroup(grid,sources){
    if(!sources.length){grid.innerHTML='<div class="empty-source">No shareable sources are available in this section.</div>';return;}
    grid.innerHTML=sources.map((source,index)=>sourceCard(source,index)).join('');
    bindSelectable(grid);
  }

  function renderBasic(){
    const screens=basicSources.filter(source=>source.kind==='screen');
    const windows=basicSources.filter(source=>source.kind==='window');
    renderGroup(screenGrid,screens);
    renderGroup(windowGrid,windows);
    $('#screenCount').textContent=`${screens.length} ${screens.length===1?'screen':'screens'}`;
    $('#windowCount').textContent=`${windows.length} ${windows.length===1?'window':'windows'}`;
    basicGrid.hidden=false;advancedGrid.hidden=true;filesGrid.hidden=true;loading.hidden=true;error.hidden=true;
    paintSelection();
  }

  function renderAdvanced(){
    advancedGrid.innerHTML=[
      specialCard({id:'advanced:portion',name:'Portion of Screen',symbol:'▣',meta:'Select a resizable area',disabled:true}),
      specialCard({id:'advanced:audio',name:'Computer Audio',symbol:'◖',meta:'Audio only',disabled:true,klass:'audio'}),
      specialCard({id:'advanced:camera',name:'Content from 2nd Camera',symbol:'▥',meta:'Document or secondary camera',disabled:true}),
      specialCard({id:'advanced:video',name:'Video File',symbol:'▶',meta:'Optimized local playback',disabled:true})
    ].join('');
    basicGrid.hidden=true;advancedGrid.hidden=false;filesGrid.hidden=true;loading.hidden=true;error.hidden=true;updateSelectionSummary();
  }

  function renderFiles(){
    filesGrid.innerHTML=[
      specialCard({id:'files:drive',name:'Google Drive',symbol:'△',meta:'Cloud file sharing',disabled:true}),
      specialCard({id:'files:onedrive',name:'Microsoft OneDrive',symbol:'☁',meta:'Cloud file sharing',disabled:true}),
      specialCard({id:'files:box',name:'Box',symbol:'□',meta:'Cloud file sharing',disabled:true}),
      specialCard({id:'files:dropbox',name:'Dropbox',symbol:'◇',meta:'Cloud file sharing',disabled:true})
    ].join('');
    basicGrid.hidden=true;advancedGrid.hidden=true;filesGrid.hidden=false;loading.hidden=true;error.hidden=true;updateSelectionSummary();
  }

  function renderActiveTab(){
    if(activeTab==='advanced')renderAdvanced();
    else if(activeTab==='files')renderFiles();
    else renderBasic();
  }

  function setBusy(busy){
    loading.hidden=!busy;
    if(busy){error.hidden=true;basicGrid.hidden=true;advancedGrid.hidden=true;filesGrid.hidden=true;}
    $$('.tab').forEach(tab=>tab.disabled=busy);
    sharing=Boolean(busy&&selectedId);
    updateSelectionSummary();
  }

  async function refreshBasic(){
    const priorSelection=selectedId;setBusy(true);
    try{
      const [screenResult,windowResult]=await Promise.all([
        bridge?.listSources?.({includeDominionStar:false,kind:'screen'}),
        bridge?.listSources?.({includeDominionStar:false,kind:'window'})
      ]);
      const failed=[screenResult,windowResult].filter(result=>!result?.ok);
      if(failed.length===2){
        error.hidden=false;loading.hidden=true;basicGrid.hidden=true;
        const timedOut=failed.some(result=>result?.timedOut);
        $('#errorCopy').textContent=timedOut?'Source discovery is taking too long. Your meeting is still active; try again.':(failed[0]?.error||'Check Screen Recording permission and try again.');
        return;
      }
      basicSources=[...(screenResult?.sources||[]),...(windowResult?.sources||[])];
      const remembered=basicSources.find(source=>String(source.id)===priorSelection);
      const firstScreen=basicSources.find(source=>source.kind==='screen');
      selectedId=String(remembered?.id||firstScreen?.id||basicSources[0]?.id||'');
      renderActiveTab();
    }catch(err){
      error.hidden=false;loading.hidden=true;basicGrid.hidden=true;$('#errorCopy').textContent=String(err?.message||err||'Unable to load share sources.');
    }finally{sharing=false;$$('.tab').forEach(tab=>tab.disabled=false);updateSelectionSummary();}
  }

  async function shareNow(){
    if(sharing||activeTab!=='basic'||!selectedId)return;
    sharing=true;shareButton.disabled=true;shareButton.textContent='Sharing…';
    try{
      const optimizeVideo=$('#optimizeVideo').checked;
      $('#optimizeSharingVideo').checked=optimizeVideo;
      try{
        localStorage.setItem('ds_pref_share_optimize',optimizeVideo?'1':'0');
        localStorage.setItem('ds_pref_share_audio',$('#shareAudio').checked?'1':'0');
        localStorage.setItem('ds_pref_share_video_mode',optimizeVideo?'1':'0');
      }catch{}
      const result=await bridge?.choose?.(selectedId,{optimizeVideo,shareAudio:$('#shareAudio').checked});
      if(!result?.ok)throw new Error(result?.error||'Unable to select this source.');
    }catch(err){
      sharing=false;shareButton.textContent='Share';error.hidden=false;basicGrid.hidden=false;$('#errorCopy').textContent=String(err?.message||err);updateSelectionSummary();
    }
  }

  $$('.tab').forEach(tab=>tab.addEventListener('click',()=>{
    activeTab=String(tab.dataset.tab||'basic');
    $$('.tab').forEach(item=>item.classList.toggle('active',item===tab));
    renderActiveTab();
  }));

  $('#retrySources').addEventListener('click',()=>void refreshBasic());
  const cancel=()=>void bridge?.cancel?.();
  $('#cancelTop').addEventListener('click',cancel);$('#cancelBottom').addEventListener('click',cancel);
  shareButton.addEventListener('click',()=>void shareNow());
  $('#optimizeVideo').addEventListener('change',event=>{$('#optimizeSharingVideo').checked=Boolean(event.currentTarget.checked);});

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();cancel();}
    if(event.key==='Enter'&&activeTab==='basic'&&selectedId&&!sharing&&!event.target?.matches?.('button,input')){event.preventDefault();void shareNow();}
  });

  window.dominionDesktop?.environment?.().then(info=>{
    const platform=String(info?.platform||'');const supported=platform==='win32'||platform==='darwin';
    $('#shareAudio').disabled=!supported;$('#shareAudioRow').classList.toggle('disabled',!supported);
  }).catch(()=>{$('#shareAudio').disabled=true;$('#shareAudioRow').classList.add('disabled');});

  setBrand();
  void refreshBasic();
})();
