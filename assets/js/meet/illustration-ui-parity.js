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
  const endAllBtn=$('endAllBtn');
  const leaveBtn=$('leaveBtn');
  const hostToolsBtn=$('hostToolsBtn');

  const style=document.createElement('style');
  style.dataset.dsIllustrationUiParity='1';
  style.textContent=`
    #meetingToolbar .ds-illustration-secondary{display:none!important}
    #participantsPanel,#chatPanel{resize:both;max-width:calc(100vw - 16px);max-height:calc(100vh - 96px)}
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

    // The approved blueprint names the privileged shield control Security.
    // Keep the existing authority logic and menu; only restore the approved
    // primary-bar label and position.
    if(hostToolsBtn){
      const label=hostToolsBtn.querySelector('.tool-label');
      if(label)label.textContent='Security';
      hostToolsBtn.setAttribute('aria-label','Security');
      const participants=$('participantsBtn');
      const cameraGroup=$('camBtn')?.closest('.control-group');
      if(toolbar&&participants&&cameraGroup&&hostToolsBtn.parentElement===toolbar){
        toolbar.insertBefore(hostToolsBtn,participants);
      }
    }

    // Zoom-style host bar says End; attendee/co-host remains Leave. The click
    // path is unchanged and still opens the existing safe Leave/End dialog.
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
      return;
    }
  },true);

  [moreBtn,shareMoreBtn].forEach(button=>button?.addEventListener('click',()=>setTimeout(decorateGeneralMore,0)));
  if(deviceMenu)new MutationObserver(()=>setTimeout(decorateGeneralMore,0)).observe(deviceMenu,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  if(endAllBtn)new MutationObserver(normalizeToolbar).observe(endAllBtn,{attributes:true,attributeFilter:['hidden']});
  const toastLayer=$('toastLayer');
  if(toastLayer)new MutationObserver(()=>refineJoinRequests()).observe(toastLayer,{childList:true,subtree:true});
  if(filmstripTrack)new MutationObserver(enforceOnePersonDockRule).observe(filmstripTrack,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});

  normalizeToolbar();
  refineJoinRequests();
  enforceOnePersonDockRule();

  window.DominionIllustrationUiParity=Object.freeze({
    version:'1.0.0',
    normalizeToolbar,
    decorateGeneralMore,
    refineJoinRequests,
    enforceOnePersonDockRule
  });
})();
