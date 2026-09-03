(()=>{
  const bridge=window.dominionDesktop?.sharePicker;
  const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
  const loading=$('#loadingState'),error=$('#errorState'),basicGrid=$('#sourceGrid'),advancedGrid=$('#advancedGrid'),filesGrid=$('#filesGrid'),shareButton=$('#shareButton');
  let basicSources=[],selectedId='',activeTab='basic';
  const pref=key=>{try{return localStorage.getItem(key)==='1';}catch{return false;}};
  $('#optimizeVideo').checked=pref('ds_pref_share_optimize');
  $('#shareAudio').checked=pref('ds_pref_share_audio');
  $('#optimizeSharingVideo').checked=pref('ds_pref_share_video_mode');

  const escapeHtml=value=>String(value||'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const sourceKindLabel=source=>source.kind==='screen'?'Desktop':'Application';
  const screenLabel=(source,index)=>{
    const raw=String(source.name||'').trim();
    if(/^screen\s*\d*/i.test(raw)||/^entire screen$/i.test(raw)||/^display\s*\d*/i.test(raw))return `Desktop ${index+1}`;
    return raw||`Desktop ${index+1}`;
  };
  function specialCard({id,name,symbol,meta='',disabled=false,klass=''}){
    return `<button class="source-card${id===selectedId?' selected':''}" type="button" data-source-id="${id}" ${disabled?'disabled':''}><span class="thumb"><span class="source-symbol ${klass}">${symbol}</span></span><span class="source-name">${escapeHtml(name)}</span>${meta?`<span class="source-meta">${escapeHtml(meta)}</span>`:''}</button>`;
  }
  function sourceCard(source,index){
    const name=source.kind==='screen'?screenLabel(source,index):String(source.name||'Application');
    return `<button class="source-card${source.id===selectedId?' selected':''}" type="button" data-source-id="${source.id.replace(/"/g,'&quot;')}"><span class="thumb">${source.thumbnail?`<img src="${source.thumbnail}" alt="">`:'<span class="source-symbol">▣</span>'}</span><span class="source-name">${escapeHtml(name)}</span><span class="source-meta">${sourceKindLabel(source)}</span></button>`;
  }
  function bindSelectable(root){
    root.querySelectorAll('[data-source-id]:not([disabled])').forEach(card=>card.addEventListener('click',()=>{
      selectedId=String(card.dataset.sourceId||'');
      shareButton.disabled=!selectedId;
      renderActiveTab();
    }));
  }
  function renderBasic(){
    const screens=basicSources.filter(source=>source.kind==='screen');
    const windows=basicSources.filter(source=>source.kind==='window');
    const mirrored=windows.find(source=>/iphone|ipad|quicktime|screen mirroring/i.test(String(source.name||'')));
    const cards=[
      ...screens.map((source,index)=>sourceCard(source,index)),
      specialCard({id:'special:whiteboard',name:'Whiteboard',symbol:'✎',disabled:true}),
      mirrored?sourceCard(mirrored,0):specialCard({id:'special:device',name:'iPhone/iPad',symbol:'▯',klass:'device',disabled:true}),
      ...windows.filter(source=>source!==mirrored).map(source=>sourceCard(source,0))
    ];
    basicGrid.innerHTML=cards.join('');
    basicGrid.hidden=false;advancedGrid.hidden=true;filesGrid.hidden=true;loading.hidden=true;error.hidden=true;
    bindSelectable(basicGrid);
  }
  function renderAdvanced(){
    advancedGrid.innerHTML=[
      specialCard({id:'advanced:portion',name:'Portion of Screen',symbol:'▣',disabled:true}),
      specialCard({id:'advanced:audio',name:'Computer Audio',symbol:'◖',klass:'audio',disabled:true}),
      specialCard({id:'advanced:camera',name:'Content from 2nd Camera',symbol:'▥',disabled:true}),
      specialCard({id:'advanced:video',name:'Video File',symbol:'▶',disabled:true})
    ].join('');
    basicGrid.hidden=true;advancedGrid.hidden=false;filesGrid.hidden=true;loading.hidden=true;error.hidden=true;
  }
  function renderFiles(){
    filesGrid.innerHTML=[
      specialCard({id:'files:drive',name:'Google Drive',symbol:'△',disabled:true}),
      specialCard({id:'files:onedrive',name:'Microsoft OneDrive',symbol:'☁',disabled:true}),
      specialCard({id:'files:box',name:'Box',symbol:'□',disabled:true}),
      specialCard({id:'files:dropbox',name:'Dropbox',symbol:'◇',disabled:true})
    ].join('');
    basicGrid.hidden=true;advancedGrid.hidden=true;filesGrid.hidden=false;loading.hidden=true;error.hidden=true;
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
    shareButton.disabled=busy||!selectedId;
  }
  async function refreshBasic(){
    selectedId='';shareButton.disabled=true;setBusy(true);
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
      const firstScreen=basicSources.find(source=>source.kind==='screen');
      selectedId=String(firstScreen?.id||basicSources[0]?.id||'');
      renderActiveTab();
      shareButton.disabled=!selectedId||activeTab!=='basic';
    }catch(err){
      error.hidden=false;loading.hidden=true;basicGrid.hidden=true;$('#errorCopy').textContent=String(err?.message||err||'Unable to load share sources.');
    }finally{$$('.tab').forEach(tab=>tab.disabled=false);}
  }

  $$('.tab').forEach(tab=>tab.addEventListener('click',()=>{
    activeTab=String(tab.dataset.tab||'basic');
    $$('.tab').forEach(item=>item.classList.toggle('active',item===tab));
    if(activeTab!=='basic'){selectedId='';shareButton.disabled=true;}
    renderActiveTab();
  }));
  $('#retrySources').addEventListener('click',()=>void refreshBasic());
  const cancel=()=>void bridge?.cancel?.();$('#cancelTop').addEventListener('click',cancel);$('#cancelBottom').addEventListener('click',cancel);
  shareButton.addEventListener('click',async()=>{
    if(activeTab!=='basic'||!selectedId)return;
    shareButton.disabled=true;shareButton.textContent='Starting…';
    try{
      const optimizeVideo=$('#optimizeVideo').checked||$('#optimizeSharingVideo').checked;
      try{
        localStorage.setItem('ds_pref_share_optimize',optimizeVideo?'1':'0');
        localStorage.setItem('ds_pref_share_audio',$('#shareAudio').checked?'1':'0');
        localStorage.setItem('ds_pref_share_video_mode',$('#optimizeSharingVideo').checked?'1':'0');
      }catch{}
      const result=await bridge?.choose?.(selectedId,{optimizeVideo,shareAudio:$('#shareAudio').checked});
      if(!result?.ok)throw new Error(result?.error||'Unable to select this source.');
    }catch(err){
      shareButton.textContent='Share';shareButton.disabled=false;error.hidden=false;basicGrid.hidden=false;$('#errorCopy').textContent=String(err?.message||err);
    }
  });

  window.dominionDesktop?.environment?.().then(info=>{
    const platform=String(info?.platform||'');const supported=platform==='win32'||platform==='darwin';
    $('#shareAudio').disabled=!supported;$('#shareAudioRow').classList.toggle('disabled',!supported);
  }).catch(()=>{$('#shareAudio').disabled=true;$('#shareAudioRow').classList.add('disabled');});
  void refreshBasic();
})();
