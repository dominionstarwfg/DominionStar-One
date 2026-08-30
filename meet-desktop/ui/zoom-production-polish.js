(()=>{
  if(window.DominionZoomProductionPolish)return;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  let participantMenu=null,participantLayoutMenu=null,chatPolicyMenu=null;
  const LEGACY_PANEL_KEY='ds_zoom_participant_panel_geometry_v1';
  try{localStorage.removeItem(LEGACY_PANEL_KEY);}catch{}
  const localRole=()=>String(q('#roomRole')?.textContent||'').trim().toLowerCase().replace('-','');
  const manager=()=>['host','cohost'].includes(localRole());
  const meetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const setHidden=(node,value)=>{const next=Boolean(value);if(node&&node.hidden!==next)node.hidden=next;};
  const positionAbove=(menu,anchor,width=245)=>{
    if(!menu||!anchor)return;const r=anchor.getBoundingClientRect();
    const left=Math.max(10,Math.min(innerWidth-width-10,r.left+r.width/2-width/2));
    const top=Math.max(10,r.top-menu.offsetHeight-9);menu.style.left=`${left}px`;menu.style.top=`${top}px`;
  };
  const positionBelow=(menu,anchor,width=190)=>{
    if(!menu||!anchor)return;const r=anchor.getBoundingClientRect();
    const left=Math.max(10,Math.min(innerWidth-width-10,r.left));
    const top=Math.min(innerHeight-menu.offsetHeight-10,r.bottom+7);menu.style.left=`${left}px`;menu.style.top=`${Math.max(10,top)}px`;
  };

  function normalizeCarets(){
    for(const caret of qa('.meeting-footer .av-device-caret')){
      if(caret.dataset.productionNormalized==='1')continue;
      const label=String(caret.getAttribute('aria-label')||'').toLowerCase();
      caret.dataset.kind=label.includes('audio')?'audio':'video';caret.dataset.productionNormalized='1';
      caret.classList.add('attached-device-caret');caret.innerHTML='<span aria-hidden="true">⌃</span>';
    }
  }

  function ensureHostTools(){
    const footer=q('.meeting-footer'),more=q('#roomMore');if(!footer||!more)return;
    let button=q('#roomHostTools');
    if(!button){
      button=document.createElement('button');button.id='roomHostTools';button.type='button';button.className='zoom-host-tools-control';button.setAttribute('aria-label','Host Tools');
      button.innerHTML='<span class="ds-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6z"/><path d="M8.5 12h7M12 8.5v7"/></svg></span><span class="ds-control-label">Host Tools</span>';
      footer.insertBefore(button,more);
      button.onclick=()=>{
        const security=q('#roomSecurity');if(!security)return;
        security.click();requestAnimationFrame(()=>{const menu=q('.security-menu');if(menu)positionAbove(menu,button,250);});
      };
    }
    setHidden(button,!manager());
  }

  function participantPanelMode(side=q('.room-side')){return side?.dataset.zoomPanelMode==='popout'?'popout':'docked';}
  function dockParticipantPanel(side=q('.room-side')){
    if(!side)return;side.dataset.zoomPanelMode='docked';
    side.style.setProperty('position','absolute','important');
    side.style.setProperty('left','auto','important');
    side.style.setProperty('right','10px','important');
    side.style.setProperty('top','10px','important');
    side.style.setProperty('bottom','10px','important');
    side.style.setProperty('transform','none','important');
    side.style.setProperty('width','var(--ds-panel-w)','important');
    side.style.setProperty('height','auto','important');
  }
  function popOutParticipantPanel(side=q('.room-side')){
    const body=q('.meeting-body');if(!side||!body)return;side.dataset.zoomPanelMode='popout';
    const bounds=body.getBoundingClientRect();
    const width=Math.max(350,Math.min(410,bounds.width-40));
    const height=Math.max(380,Math.min(590,bounds.height-40));
    const left=Math.max(12,(bounds.width-width)/2),top=Math.max(12,(bounds.height-height)/2);
    side.style.setProperty('position','absolute','important');
    side.style.setProperty('left',`${left}px`,'important');
    side.style.setProperty('right','auto','important');
    side.style.setProperty('top',`${top}px`,'important');
    side.style.setProperty('bottom','auto','important');
    side.style.setProperty('transform','none','important');
    side.style.setProperty('width',`${width}px`,'important');
    side.style.setProperty('height',`${height}px`,'important');
  }
  function normalizeParticipantPanel(){
    const side=q('.room-side');if(!side)return;
    if(participantPanelMode(side)==='popout'){
      side.style.setProperty('position','absolute','important');
      side.style.setProperty('right','auto','important');
      side.style.setProperty('bottom','auto','important');
      side.style.setProperty('transform','none','important');
      if(!side.style.left||side.style.left==='auto')popOutParticipantPanel(side);
      return;
    }
    dockParticipantPanel(side);
  }
  function closeParticipantLayoutMenu(){participantLayoutMenu?.remove();participantLayoutMenu=null;}
  function openParticipantLayoutMenu(anchor){
    closeParticipantLayoutMenu();const side=q('.room-side');if(!side)return;
    participantLayoutMenu=document.createElement('div');participantLayoutMenu.className='zoom-participant-layout-menu';participantLayoutMenu.setAttribute('role','menu');
    const action=document.createElement('button');action.type='button';action.setAttribute('role','menuitem');
    const popout=participantPanelMode(side)==='popout';action.textContent=popout?'Merge to Meeting':'Pop Out';
    action.onclick=()=>{popout?dockParticipantPanel(side):popOutParticipantPanel(side);closeParticipantLayoutMenu();};
    participantLayoutMenu.append(action);document.body.append(participantLayoutMenu);positionBelow(participantLayoutMenu,anchor,190);
  }
  function ensureParticipantLayoutControl(){
    const side=q('.room-side'),head=side?.querySelector('.room-side-head');if(!side||!head)return;
    if(!side.dataset.zoomPanelMode)side.dataset.zoomPanelMode='docked';
    let button=head.querySelector('.zoom-participant-layout-button');
    if(!button){
      button=document.createElement('button');button.type='button';button.className='zoom-participant-layout-button';button.setAttribute('aria-label','Participant panel options');button.setAttribute('aria-haspopup','menu');button.innerHTML='<span aria-hidden="true">▾</span>';
      head.prepend(button);button.onclick=event=>{event.stopPropagation();openParticipantLayoutMenu(button);};
    }
    if(head.dataset.zoomDragAuthority!=='1'){
      head.dataset.zoomDragAuthority='1';
      head.addEventListener('pointerdown',event=>{if(participantPanelMode(side)==='docked'&&!event.target.closest('button'))event.stopImmediatePropagation();},true);
    }
  }

  function ensureParticipantSearch(){
    const side=q('.room-side'),head=side?.querySelector('.room-side-head');if(!side||!head)return;
    let wrap=side.querySelector('.zoom-participant-search');
    if(!wrap){
      wrap=document.createElement('div');wrap.className='zoom-participant-search';wrap.innerHTML='<input type="search" autocomplete="off" spellcheck="false" placeholder="Search participants" aria-label="Search participants">';
      head.insertAdjacentElement('afterend',wrap);
      const input=wrap.querySelector('input');
      input.addEventListener('input',()=>{
        const needle=String(input.value||'').trim().toLowerCase();
        for(const row of qa('#participantRoster [data-participant-id],#participantRoster .person-row')){
          const name=String(row.dataset.participantName||row.textContent||'').toLowerCase();setHidden(row,Boolean(needle&&!name.includes(needle)));
        }
      });
    }
  }

  function closeParticipantMenu(){participantMenu?.remove();participantMenu=null;}
  function openParticipantBulkMenu(anchor){
    closeParticipantMenu();participantMenu=document.createElement('div');participantMenu.className='zoom-participant-bulk-menu';
    const add=(label,type)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{closeParticipantMenu();void window.DominionParticipantControls?.sendAll?.(type);};participantMenu.append(b);};
    add('Ask All to Unmute','host:ask-unmute');add('Stop Video for All','host:stop-video');add('Ask All to Start Video','host:ask-start-video');add('Lower All Hands','host:lower-hand');
    document.body.append(participantMenu);positionAbove(participantMenu,anchor,230);
  }
  async function copyInvite(){
    const title=String(q('#roomTitle')?.textContent||'DominionStar Meeting').trim(),meta=String(q('#roomCodeLabel')?.textContent||'').trim();const text=`${title}\n${meta}`.trim();
    try{await navigator.clipboard.writeText(text);window.DominionMeetingNotifications?.toast?.('Meeting invitation copied');}catch{}
  }
  function ensureParticipantFooter(){
    const side=q('.room-side');if(!side)return;const legacy=q('#participantBulkActions');setHidden(legacy,true);
    let footer=side.querySelector('.zoom-participant-footer');
    if(!footer){
      footer=document.createElement('div');footer.className='zoom-participant-footer';
      footer.innerHTML='<button type="button" data-zoom-invite>Invite</button><button type="button" data-zoom-mute-all>Mute All</button><button type="button" class="zoom-participant-more" aria-label="More participant controls">•••</button>';
      side.append(footer);footer.querySelector('[data-zoom-invite]').onclick=()=>void copyInvite();footer.querySelector('[data-zoom-mute-all]').onclick=()=>void window.DominionParticipantControls?.sendAll?.('host:mute');footer.querySelector('.zoom-participant-more').onclick=event=>{event.stopPropagation();openParticipantBulkMenu(event.currentTarget);};
    }
    setHidden(footer,!manager());
  }

  function normalizeChatPanel(){
    const panel=q('#meetingChatPanel');if(!panel)return;
    panel.style.setProperty('position','absolute','important');
    panel.style.setProperty('left','auto','important');
    panel.style.setProperty('right','10px','important');
    panel.style.setProperty('top','10px','important');
    panel.style.setProperty('bottom','10px','important');
    panel.style.setProperty('width','var(--ds-panel-w)','important');
    panel.style.setProperty('height','auto','important');
  }

  function closeChatPolicyMenu(){chatPolicyMenu?.remove();chatPolicyMenu=null;}
  function openChatPolicyMenu(anchor){
    closeChatPolicyMenu();const select=q('#meetingChatPolicy');if(!select)return;chatPolicyMenu=document.createElement('div');chatPolicyMenu.className='zoom-chat-policy-menu';
    const heading=document.createElement('button');heading.type='button';heading.disabled=true;heading.textContent='Participant can chat with';chatPolicyMenu.append(heading);
    for(const option of [...select.options]){
      const b=document.createElement('button');b.type='button';b.textContent=String(option.textContent||option.value).replace(/^Participants (can|cannot) chat:\s*/i,'');b.classList.toggle('selected',option.value===select.value);
      b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));closeChatPolicyMenu();};chatPolicyMenu.append(b);
    }
    document.body.append(chatPolicyMenu);positionAbove(chatPolicyMenu,anchor,265);
  }
  function ensureChatChrome(){
    const panel=q('#meetingChatPanel'),header=panel?.querySelector('header'),close=header?.querySelector('[data-chat-close]');if(!panel||!header||!close)return;
    if(!q('#meetingChatPolicy'))return;
    let actions=header.querySelector('.zoom-chat-header-actions');
    if(!actions){actions=document.createElement('div');actions.className='zoom-chat-header-actions';const more=document.createElement('button');more.type='button';more.className='zoom-chat-more';more.textContent='•••';more.setAttribute('aria-label','Chat options');more.onclick=event=>{event.stopPropagation();openChatPolicyMenu(more);};actions.append(more);header.insertBefore(actions,close);actions.append(close);}
    const more=actions.querySelector('.zoom-chat-more');setHidden(more,!manager());
  }

  function normalizeReactionMenu(){const menu=q('.meeting-reaction-menu');if(!menu)return;menu.style.left='18px';menu.style.right='auto';menu.style.top='auto';menu.style.bottom='94px';}
  function normalizePermissionDialog(){
    const dialog=q('#screenPermissionDialog'),copy=dialog?.querySelector('[data-permission-copy]');if(!dialog||!copy||dialog.hidden)return;
    const next='Screen sharing permission is not active for this running copy yet. Open System Settings and enable DominionStar Meet. When you return, click Share Screen again — DominionStar Meet will re-check the actual capture permission automatically.';
    if(copy.textContent!==next)copy.textContent=next;
  }
  function cleanMoreMenu(){
    if(!manager()||!q('#roomHostTools')||q('#roomHostTools').hidden)return;
    for(const menu of qa('.meeting-more-menu:not(.security-menu)')){
      for(const button of [...menu.querySelectorAll('button')]){
        if(/^host\s+tools$/i.test(String(button.textContent||'').trim()))button.remove();
      }
    }
  }
  function ensureMoreAuthority(){
    const more=q('#roomMore');if(!more||more.dataset.productionMoreAuthority==='1'||typeof more.onclick!=='function')return;
    const legacy=more.onclick;
    more.dataset.productionMoreAuthority='1';
    more.onclick=event=>{const result=legacy.call(more,event);cleanMoreMenu();return result;};
  }

  function sync(){
    if(!meetingOpen()){closeParticipantMenu();closeParticipantLayoutMenu();closeChatPolicyMenu();return;}
    normalizeCarets();ensureHostTools();ensureMoreAuthority();ensureParticipantLayoutControl();normalizeParticipantPanel();ensureParticipantSearch();ensureParticipantFooter();normalizeChatPanel();ensureChatChrome();normalizeReactionMenu();normalizePermissionDialog();cleanMoreMenu();
  }
  document.addEventListener('pointerdown',event=>{
    if(participantMenu&&!participantMenu.contains(event.target)&&!event.target.closest?.('.zoom-participant-more'))closeParticipantMenu();
    if(participantLayoutMenu&&!participantLayoutMenu.contains(event.target)&&!event.target.closest?.('.zoom-participant-layout-button'))closeParticipantLayoutMenu();
    if(chatPolicyMenu&&!chatPolicyMenu.contains(event.target)&&!event.target.closest?.('.zoom-chat-more'))closeChatPolicyMenu();
  },true);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#roomParticipants'))requestAnimationFrame(()=>{ensureParticipantLayoutControl();normalizeParticipantPanel();});
    if(event.target.closest?.('#roomChat'))requestAnimationFrame(normalizeChatPanel);
    if(event.target.closest?.('#roomMore'))cleanMoreMenu();
  });
  window.addEventListener('dominion:meeting-ui-ready',()=>setTimeout(sync,0));
  const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});
  const timer=setInterval(sync,900);sync();
  window.DominionZoomProductionPolish=Object.freeze({version:'1.5.0',sync,dockParticipantPanel,popOutParticipantPanel,participantPanelMode,dispose:()=>{clearInterval(timer);observer.disconnect();closeParticipantMenu();closeParticipantLayoutMenu();closeChatPolicyMenu();}});
})();
