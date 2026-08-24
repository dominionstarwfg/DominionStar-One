(()=>{
  'use strict';
  if(window.DominionIllustrationUiParity)return;

  const $=id=>document.getElementById(id);
  const toolbar=$('meetingToolbar');
  const moreBtn=$('moreBtn');
  const shareMoreBtn=$('shareMoreBtn');
  const shareStatusBar=$('shareStatusBar');
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
    #recordBtn .record-dot{width:17px;height:17px;border:2px solid currentColor;border-radius:50%;display:grid;place-items:center}
    #recordBtn .record-dot::after{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
    #recordBtn.is-recording{color:#ff6370!important}
    #recordingIndicator{position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:2147482500;display:flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid rgba(255,95,108,.32);border-radius:999px;background:rgba(23,8,11,.92);color:#fff;font-size:11px;font-weight:750;box-shadow:0 12px 34px rgba(0,0,0,.32);backdrop-filter:blur(14px)}
    #recordingIndicator[hidden]{display:none!important}
    #recordingIndicator .recording-live-dot{width:8px;height:8px;border-radius:50%;background:#ff4d5d;box-shadow:0 0 0 4px rgba(255,77,93,.15)}
    #shareStatusBar.ds-native-presenter-active{display:none!important}

    /* Approved source-picker composition: branded, source-first, Zoom-familiar. */
    #desktopSharePicker.ds-approved-source-picker{width:min(900px,92vw)!important;height:min(650px,86vh)!important}
    #desktopSharePicker.ds-approved-source-picker main{display:flex!important;flex-direction:column!important;min-height:0!important}
    #desktopSharePicker.ds-approved-source-picker .ds-share-content{flex:1 1 auto!important;min-height:0!important;overflow:auto!important}
    #desktopSharePicker.ds-approved-source-picker .ds-share-sources{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important;padding:20px!important}
    #desktopSharePicker.ds-approved-source-picker aside{flex:0 0 auto!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px 12px!important;padding:13px 20px!important;border-left:0!important;border-top:1px solid #ffffff17!important;background:#0d131de8!important}
    #desktopSharePicker.ds-approved-source-picker aside>strong{grid-column:1/-1!important;font-size:11px!important;color:#f7e3a8!important}
    #desktopSharePicker.ds-approved-source-picker aside label{margin:0!important;padding:9px 11px!important;align-items:center!important}
    #desktopSharePicker.ds-approved-source-picker aside p,#desktopSharePicker.ds-approved-source-picker aside small{grid-column:1/-1!important}
    @media(max-width:720px){#desktopSharePicker.ds-approved-source-picker .ds-share-sources{grid-template-columns:1fr!important}#desktopSharePicker.ds-approved-source-picker aside{grid-template-columns:1fr!important}}
  `;
  document.head.append(style);

  const primarySecondaryIds=['raiseHandBtn','transcribeBtn','meetingIntelligenceBtn'];
  const secondaryLabels=new Map([
    ['raiseHandBtn','Raise Hand'],
    ['transcribeBtn','Transcribe'],
    ['meetingIntelligenceBtn','AI Notes']
  ]);

  const ensureRecordingIndicator=()=>{
    let indicator=$('recordingIndicator');
    if(indicator)return indicator;
    indicator=document.createElement('div');
    indicator.id='recordingIndicator';
    indicator.hidden=true;
    indicator.setAttribute('role','status');
    indicator.setAttribute('aria-live','polite');
    indicator.innerHTML='<span class="recording-live-dot"></span><span>Recording</span>';
    document.body.append(indicator);
    return indicator;
  };

  const syncRecordingUi=recording=>{
    const button=$('recordBtn');
    const indicator=ensureRecordingIndicator();
    if(button){
      button.classList.toggle('is-recording',Boolean(recording));
      button.setAttribute('aria-pressed',recording?'true':'false');
      button.setAttribute('aria-label',recording?'Stop recording':'Record meeting');
      const label=button.querySelector('.tool-label');
      if(label)label.textContent=recording?'Stop Recording':'Record';
    }
    indicator.hidden=!recording;
  };

  const ensureRecordControl=()=>{
    if(!toolbar)return null;
    let button=$('recordBtn');
    if(!button){
      button=document.createElement('button');
      button.id='recordBtn';
      button.className='tool-button';
      button.type='button';
      button.setAttribute('aria-label','Record meeting');
      button.setAttribute('aria-pressed','false');
      button.innerHTML='<span class="tool-icon record-dot" aria-hidden="true"></span><span class="tool-label">Record</span>';
      const reaction=$('reactionBtn');
      toolbar.insertBefore(button,reaction||moreBtn||leaveBtn||null);
      button.addEventListener('click',async()=>{
        const recording=window.DominionLocalRecording;
        if(!recording?.toggle){
          window.dispatchEvent(new CustomEvent('dominion:recording-error',{detail:{message:'Recording is not ready yet.'}}));
          return;
        }
        if(!recording.isRecording()&&!window.confirm('Start local recording? A visible Recording indicator will remain on screen until you stop.'))return;
        try{await recording.toggle();syncRecordingUi(recording.isRecording());}
        catch(error){
          syncRecordingUi(false);
          window.alert(String(error?.message||'Recording could not start.'));
        }
      });
    }
    syncRecordingUi(Boolean(window.DominionLocalRecording?.isRecording?.()));
    return button;
  };

  const normalizeToolbar=()=>{
    primarySecondaryIds.forEach(id=>$(id)?.classList.add('ds-illustration-secondary'));
    if(hostToolsBtn){
      const label=hostToolsBtn.querySelector('.tool-label');
      if(label)label.textContent='Security';
      hostToolsBtn.setAttribute('aria-label','Security');
      const participants=$('participantsBtn');
      if(toolbar&&participants&&hostToolsBtn.parentElement===toolbar)toolbar.insertBefore(hostToolsBtn,participants);
    }
    ensureRecordControl();
    const record=$('recordBtn');
    const reaction=$('reactionBtn');
    if(toolbar&&record&&reaction&&record.nextElementSibling!==reaction)toolbar.insertBefore(record,reaction);
    if(leaveBtn){
      const isHost=Boolean(endAllBtn&&!endAllBtn.hidden);
      const label=leaveBtn.querySelector('.tool-label');
      if(label)label.textContent=isHost?'End':'Leave';
      leaveBtn.setAttribute('aria-label',isHost?'End meeting options':'Leave meeting');
    }
  };

  const normalizeSharePicker=()=>{
    const picker=$('desktopSharePicker');
    if(!picker)return false;
    picker.classList.add('ds-approved-source-picker');
    const tabs=[...picker.querySelectorAll('[data-filter]')];
    const applicationTab=tabs.find(button=>button.dataset.filter==='window');
    if(applicationTab)applicationTab.textContent='Applications';
    const brandStrong=picker.querySelector('.ds-share-brand strong');
    const brandSmall=picker.querySelector('.ds-share-brand small');
    if(brandStrong)brandStrong.textContent='Choose what to share';
    if(brandSmall)brandSmall.textContent='Select a screen or application window.';
    return true;
  };

  const syncDesktopPresenterUi=()=>{
    const localDesktop=Boolean(window.dominionDesktop?.isDesktop&&document.body.classList.contains('local-presentation-active'));
    if(shareStatusBar)shareStatusBar.classList.toggle('ds-native-presenter-active',localDesktop);
    if(localDesktop)window.dominionDesktop.showPresenterToolbar?.();
    normalizeSharePicker();
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

  addEventListener('dominion:recording-started',()=>syncRecordingUi(true));
  addEventListener('dominion:recording-stopped',()=>syncRecordingUi(false));
  addEventListener('dominion:recording-error',event=>{syncRecordingUi(false);const message=String(event.detail?.message||'Recording error');console.error('DominionStar recording:',message);});
  [moreBtn,shareMoreBtn].forEach(button=>button?.addEventListener('click',()=>setTimeout(decorateGeneralMore,0)));
  if(deviceMenu)new MutationObserver(()=>setTimeout(decorateGeneralMore,0)).observe(deviceMenu,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  if(endAllBtn)new MutationObserver(normalizeToolbar).observe(endAllBtn,{attributes:true,attributeFilter:['hidden']});
  const toastLayer=$('toastLayer');
  if(toastLayer)new MutationObserver(()=>refineJoinRequests()).observe(toastLayer,{childList:true,subtree:true});
  if(filmstripTrack)new MutationObserver(enforceOnePersonDockRule).observe(filmstripTrack,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  new MutationObserver(syncDesktopPresenterUi).observe(document.body,{attributes:true,attributeFilter:['class']});
  new MutationObserver(normalizeSharePicker).observe(document.documentElement,{childList:true,subtree:true});
  installPanelPersistence(participantsPanel);
  installPanelPersistence(chatPanel);
  addEventListener('resize',()=>{[participantsPanel,chatPanel].forEach(panel=>{if(panel&&!panel.hidden)restorePanelGeometry(panel);});},{passive:true});

  normalizeToolbar();
  normalizeSharePicker();
  syncDesktopPresenterUi();
  refineJoinRequests();
  enforceOnePersonDockRule();

  window.DominionIllustrationUiParity=Object.freeze({
    version:'1.3.0',
    normalizeToolbar,
    normalizeSharePicker,
    syncDesktopPresenterUi,
    ensureRecordControl,
    syncRecordingUi,
    decorateGeneralMore,
    refineJoinRequests,
    enforceOnePersonDockRule,
    savePanelGeometry,
    restorePanelGeometry
  });
})();
