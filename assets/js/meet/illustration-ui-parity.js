(()=>{
  'use strict';
  if(window.DominionIllustrationUiParity)return;

  const $=id=>document.getElementById(id);
  const toolbar=$('meetingToolbar');
  const moreBtn=$('moreBtn');
  const shareMoreBtn=$('shareMoreBtn');
  const deviceMenu=$('deviceMenu');
  const filmstrip=$('filmstrip');
  const filmstripTrack=$('filmstripTrack');
  const participantsBtn=$('participantsBtn');
  const participantsPanel=$('participantsPanel');
  const chatPanel=$('chatPanel');
  const endAllBtn=$('endAllBtn');
  const leaveBtn=$('leaveBtn');
  const hostToolsBtn=$('hostToolsBtn');

  const PANEL_STORAGE_PREFIX='dominionstar.meet.panel.geometry.v1.';
  const style=document.createElement('style');
  style.dataset.dsIllustrationUiParity='1';
  style.textContent=`
    #meetingToolbar .ds-illustration-secondary{display:none!important}
    #participantsPanel,#chatPanel{resize:both;overflow:auto;max-width:calc(100vw - 16px);max-height:calc(100vh - 96px);min-width:280px;min-height:220px}
    .join-request-toast.waiting-room-banner{z-index:2147483000!important}
  `;
  document.head.append(style);

  const primarySecondaryIds=['raiseHandBtn','transcribeBtn','meetingIntelligenceBtn'];
  const secondaryLabels=new Map([
    ['raiseHandBtn','Raise Hand'],
    ['transcribeBtn','Transcribe'],
    ['meetingIntelligenceBtn','AI Notes']
  ]);

  const normalizeToolbar=()=>{
    primarySecondaryIds.forEach(id=>$(id)?.classList.add('ds-illustration-secondary'));
    if(hostToolsBtn){
      const label=hostToolsBtn.querySelector('.tool-label');
      if(label)label.textContent='Security';
      hostToolsBtn.setAttribute('aria-label','Security');
      const participants=$('participantsBtn');
      if(toolbar&&participants&&hostToolsBtn.parentElement===toolbar)toolbar.insertBefore(hostToolsBtn,participants);
    }
    if(leaveBtn){
      const isHost=Boolean(endAllBtn&&!endAllBtn.hidden);
      const label=leaveBtn.querySelector('.tool-label');
      if(label)label.textContent=isHost?'End':'Leave';
      leaveBtn.setAttribute('aria-label',isHost?'End meeting options':'Leave meeting');
    }
  };

  const appendSecondaryAction=(sourceId,label)=>{
    if(!deviceMenu)return;
    const source=$(sourceId);
    if(!source)return;
    const exists=[...deviceMenu.querySelectorAll('button')].some(button=>String(button.textContent||'').trim()===label);
    if(exists)return;
    const button=document.createElement('button');
    button.type='button';
    button.dataset.dsIllustrationSecondary=sourceId;
    button.textContent=label;
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      deviceMenu.hidden=true;
      source.click();
    });
    deviceMenu.append(button);
  };

  const decorateGeneralMore=()=>{
    if(!deviceMenu||deviceMenu.hidden)return;
    const title=String(deviceMenu.querySelector('strong')?.textContent||'');
    if(!/\bMore\b/i.test(title))return;
    primarySecondaryIds.forEach(id=>appendSecondaryAction(id,secondaryLabels.get(id)));
  };

  const refineJoinRequest=node=>{
    if(!(node instanceof Element)||!node.matches('.join-request-toast.waiting-room-banner'))return;
    const strong=node.querySelector('.waiting-room-copy strong');
    const small=node.querySelector('.waiting-room-copy small');
    if(strong){
      const current=String(strong.textContent||'').trim();
      const name=current.replace(/\s+(?:is waiting to join|wants to join)$/i,'').trim()||'A participant';
      strong.textContent=`${name} wants to join`;
    }
    if(small)small.textContent='Waiting room';
    const decline=node.querySelector('[data-toast-deny]');
    if(decline){
      const participantId=decline.dataset.toastDeny||'';
      decline.removeAttribute('data-toast-deny');
      decline.dataset.toastView=participantId;
      decline.classList.remove('deny');
      decline.classList.add('view');
      decline.textContent='View';
    }
  };

  const refineJoinRequests=()=>document.querySelectorAll('.join-request-toast.waiting-room-banner').forEach(refineJoinRequest);

  const enforceOnePersonDockRule=()=>{
    if(!filmstrip||!filmstripTrack)return;
    const remoteTiles=[...filmstripTrack.querySelectorAll('.remote-tile:not([hidden])')]
      .filter(tile=>tile.dataset.tile!=='self');
    if(remoteTiles.length===0)filmstrip.hidden=true;
  };

  const panelStorageKey=panel=>`${PANEL_STORAGE_PREFIX}${panel.id}`;
  const clampPanelGeometry=(panel,geometry)=>{
    const width=Math.min(Math.max(Number(geometry.width)||panel.offsetWidth||340,280),Math.max(280,innerWidth-16));
    const height=Math.min(Math.max(Number(geometry.height)||panel.offsetHeight||420,220),Math.max(220,innerHeight-96));
    const left=Math.min(Math.max(Number(geometry.left)||8,8),Math.max(8,innerWidth-width-8));
    const top=Math.min(Math.max(Number(geometry.top)||72,72),Math.max(72,innerHeight-height-8));
    return {left,top,width,height};
  };

  const savePanelGeometry=panel=>{
    if(!panel||panel.hidden)return;
    try{
      const rect=panel.getBoundingClientRect();
      const geometry=clampPanelGeometry(panel,{left:rect.left,top:rect.top,width:rect.width,height:rect.height});
      localStorage.setItem(panelStorageKey(panel),JSON.stringify(geometry));
    }catch{}
  };

  const restorePanelGeometry=panel=>{
    if(!panel)return false;
    try{
      const raw=localStorage.getItem(panelStorageKey(panel));
      if(!raw)return false;
      const geometry=clampPanelGeometry(panel,JSON.parse(raw));
      panel.style.left=`${Math.round(geometry.left)}px`;
      panel.style.top=`${Math.round(geometry.top)}px`;
      panel.style.right='auto';
      panel.style.bottom='auto';
      panel.style.width=`${Math.round(geometry.width)}px`;
      panel.style.height=`${Math.round(geometry.height)}px`;
      return true;
    }catch{return false;}
  };

  const installPanelPersistence=panel=>{
    if(!panel)return;
    let saveTimer=0;
    const queueSave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>savePanelGeometry(panel),160);};
    new ResizeObserver(queueSave).observe(panel);
    panel.addEventListener('pointerup',queueSave,true);
    panel.addEventListener('transitionend',queueSave);
    new MutationObserver(()=>{
      if(!panel.hidden)requestAnimationFrame(()=>restorePanelGeometry(panel));
    }).observe(panel,{attributes:true,attributeFilter:['hidden']});
    if(!panel.hidden)requestAnimationFrame(()=>restorePanelGeometry(panel));
  };

  document.addEventListener('click',event=>{
    const view=event.target.closest?.('[data-toast-view]');
    if(view){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const participantId=view.dataset.toastView||'';
      if(participantsPanel?.hidden)participantsBtn?.click();
      setTimeout(()=>{
        const admit=participantId?document.querySelector(`[data-admit="${CSS.escape(participantId)}"]`):null;
        const row=admit?.closest('.participant-row');
        row?.scrollIntoView?.({block:'nearest'});
        admit?.focus?.({preventScroll:true});
      },0);
      view.closest('.join-request-toast')?.remove();
    }
  },true);

  [moreBtn,shareMoreBtn].forEach(button=>button?.addEventListener('click',()=>setTimeout(decorateGeneralMore,0)));
  if(deviceMenu)new MutationObserver(()=>setTimeout(decorateGeneralMore,0)).observe(deviceMenu,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  if(endAllBtn)new MutationObserver(normalizeToolbar).observe(endAllBtn,{attributes:true,attributeFilter:['hidden']});
  const toastLayer=$('toastLayer');
  if(toastLayer)new MutationObserver(()=>refineJoinRequests()).observe(toastLayer,{childList:true,subtree:true});
  if(filmstripTrack)new MutationObserver(enforceOnePersonDockRule).observe(filmstripTrack,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  installPanelPersistence(participantsPanel);
  installPanelPersistence(chatPanel);
  addEventListener('resize',()=>{[participantsPanel,chatPanel].forEach(panel=>{if(panel&&!panel.hidden)restorePanelGeometry(panel);});},{passive:true});

  normalizeToolbar();
  refineJoinRequests();
  enforceOnePersonDockRule();

  window.DominionIllustrationUiParity=Object.freeze({
    version:'1.1.0',
    normalizeToolbar,
    decorateGeneralMore,
    refineJoinRequests,
    enforceOnePersonDockRule,
    savePanelGeometry,
    restorePanelGeometry
  });
})();
