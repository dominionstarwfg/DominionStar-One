(()=>{
  'use strict';
  if(window.DominionApprovedReferenceParity)return;

  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const TOOLBAR_ORDER=['roomMic','roomCamera','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomMore','roomExitButton'];
  const HOST_TOOLBAR_ORDER=['roomMic','roomCamera','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomHostTools','roomMore','roomExitButton'];
  let chatTargetMenu=null;
  let observer=null;
  let timer=0;
  let syncQueued=false;

  const HAND_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.8 11.2V6.4a1.35 1.35 0 0 1 2.7 0v3.8-5.1a1.35 1.35 0 1 1 2.7 0v5.1-4.3a1.35 1.35 0 1 1 2.7 0v5.2-2.9a1.35 1.35 0 1 1 2.7 0v5.1c0 4.7-2.8 7.7-7.1 7.7-3 0-5.2-1.3-6.8-3.8l-2-3.1a1.45 1.45 0 0 1 2.3-1.75l2.8 2.85z"/></svg>';
  const SHIELD_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5.2 6v5.1c0 4.4 2.6 7.8 6.8 9.9 4.2-2.1 6.8-5.5 6.8-9.9V6z"/><path d="m8.7 12 2.1 2.1 4.6-5"/></svg>';

  const meetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const handRaised=()=>Boolean(window.DominionMeetingFeatures?.snapshot?.().handRaised);
  const setAttr=(node,name,value)=>{const next=String(value);if(node&&node.getAttribute(name)!==next)node.setAttribute(name,next);};
  const setData=(node,key,value)=>{const next=String(value);if(node&&node.dataset[key]!==next)node.dataset[key]=next;};
  const setClass=(node,name,on)=>{if(node&&node.classList.contains(name)!==Boolean(on))node.classList.toggle(name,Boolean(on));};
  const setText=(node,value)=>{const next=String(value);if(node&&node.textContent!==next)node.textContent=next;};

  function requestSync(){
    if(syncQueued)return;
    syncQueued=true;
    requestAnimationFrame(()=>{syncQueued=false;sync();});
  }

  function ensureTransportSecurityIndicator(){
    const head=q('.meeting-head');if(!head)return null;
    let status=head.querySelector('.ds-approved-encryption');
    if(!status){
      status=document.createElement('div');status.className='ds-approved-encryption';status.setAttribute('role','status');status.setAttribute('aria-label','Encrypted media transport');status.title='Media is encrypted in transit by WebRTC DTLS-SRTP. End-to-end encryption is not currently enabled.';
      status.innerHTML=`<span class="ds-approved-encryption-icon">${SHIELD_ICON}</span><span>Encrypted</span>`;
      const view=q('#meetingViewButton');if(view)head.insertBefore(status,view);else head.append(status);
    }
    return status;
  }

  function ensureRaiseHandControl(){
    const footer=q('.meeting-footer'),exit=q('#roomExitButton');if(!footer||!exit)return null;
    let button=q('#roomRaiseHand');
    if(!button){
      button=document.createElement('button');button.id='roomRaiseHand';button.type='button';button.className='meeting-control ds-approved-raise-hand';button.dataset.approvedDedicatedRaiseHand='1';button.setAttribute('aria-label','Raise hand');
      button.innerHTML=`<span class="ds-control-icon">${HAND_ICON}</span><span class="ds-control-label">Raise hand</span>`;
      button.onclick=async()=>{button.disabled=true;try{await window.DominionMeetingFeatures?.toggleRaiseHand?.();syncRaiseHandState();}finally{button.disabled=false;}};
      footer.insertBefore(button,exit);
    }
    syncRaiseHandState();return button;
  }

  function syncRaiseHandState(){
    const button=q('#roomRaiseHand');if(!button)return;
    const raised=handRaised();
    setClass(button,'hand-raised',raised);
    setAttr(button,'aria-pressed',raised);
    setAttr(button,'aria-label',raised?'Lower hand':'Raise hand');
    setText(button.querySelector('.ds-control-label'),raised?'Lower hand':'Raise hand');
  }

  function removeDuplicateReactionHand(){
    for(const menu of qa('.meeting-reaction-menu')){
      const hand=menu.querySelector('.reaction-hand-button');
      if(hand){const previous=hand.previousElementSibling;if(previous?.classList.contains('reaction-divider'))previous.remove();hand.remove();}
      setData(menu,'approvedReactionOnly','1');
    }
  }

  function arrangeToolbar(){
    const footer=q('.meeting-footer');if(!footer)return;
    ensureRaiseHandControl();
    // Never move existing toolbar DOM nodes. CSS order is the final visual
    // authority; this prevents competing reconciliation loops from making
    // controls dance left/right while idle.
    setData(footer,'approvedToolbarOrder',HOST_TOOLBAR_ORDER.join('|'));
  }

  function closeChatTargetMenu(){if(chatTargetMenu){chatTargetMenu.remove();chatTargetMenu=null;}}

  function positionChatTargetMenu(menu,anchor){
    if(!menu||!anchor)return;const rect=anchor.getBoundingClientRect(),width=Math.min(280,Math.max(220,rect.width+120));
    const left=Math.max(10,Math.min(innerWidth-width-10,rect.left));const top=Math.min(innerHeight-menu.offsetHeight-10,rect.bottom+7);
    menu.style.left=`${left}px`;menu.style.top=`${Math.max(10,top)}px`;menu.style.width=`${width}px`;
  }

  function openChatTargetMenu(anchor){
    closeChatTargetMenu();const select=q('#meetingChatRecipient');if(!select)return;
    chatTargetMenu=document.createElement('div');chatTargetMenu.className='ds-approved-chat-target-menu';chatTargetMenu.setAttribute('role','menu');
    const targets=[...select.options].filter(option=>option.value!=='everyone');
    if(!targets.length){const empty=document.createElement('div');empty.className='ds-approved-chat-target-empty';empty.textContent='No other participants';chatTargetMenu.append(empty);}else{
      for(const option of targets){const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=String(option.textContent||'Participant').replace(/\s*·\s*Direct Message\s*$/i,'');button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));closeChatTargetMenu();q('#meetingChatInput')?.focus();syncChatNavigation();};chatTargetMenu.append(button);}
    }
    document.body.append(chatTargetMenu);positionChatTargetMenu(chatTargetMenu,anchor);
  }

  function selectEveryone(){
    const select=q('#meetingChatRecipient');if(!select)return;select.value='everyone';select.dispatchEvent(new Event('change',{bubbles:true}));closeChatTargetMenu();q('#meetingChatInput')?.focus();syncChatNavigation();
  }

  function syncChatNavigation(){
    const panel=q('#meetingChatPanel'),select=q('#meetingChatRecipient');if(!panel||!select)return;
    const recipientRow=panel.querySelector('.meeting-chat-recipient');if(recipientRow){setAttr(recipientRow,'aria-hidden','true');setData(recipientRow,'approvedHidden','1');}
    const nav=panel.querySelector('.ds-adaptive-chat-nav');if(!nav)return;
    const everyone=nav.querySelector('[data-chat-everyone]'),newChat=nav.querySelector('[data-chat-new]');
    if(everyone){setText(everyone,'Everyone');everyone.onclick=selectEveryone;}
    if(newChat){setText(newChat,'＋ New chat');newChat.onclick=event=>{event.stopPropagation();openChatTargetMenu(newChat);};}
    const everyoneSelected=String(select.value||'everyone')==='everyone';setClass(everyone,'active',everyoneSelected);setClass(newChat,'active',!everyoneSelected);
    setData(panel,'approvedChatChrome','zoom-clean');
  }

  function syncVideoPanel(){
    const dock=q('#participantVideoDock');if(!dock)return;
    setData(dock,'approvedFilmstrip','1');setAttr(dock,'aria-label','Participant video panel');
    const head=dock.querySelector('.participant-video-dock-head');if(head)setAttr(head,'aria-hidden','true');
    for(const tile of qa('#participantVideoDock .remote-peer-tile'))setData(tile,'approvedVideoTile','1');
  }

  function sync(){
    // Mount the dedicated toolbar control before meeting entry so showing the
    // meeting does not introduce a late geometry shift.
    ensureRaiseHandControl();arrangeToolbar();
    if(!meetingOpen()){closeChatTargetMenu();return;}
    ensureTransportSecurityIndicator();removeDuplicateReactionHand();syncRaiseHandState();syncChatNavigation();syncVideoPanel();
  }

  document.addEventListener('click',event=>{
    const newChat=event.target.closest?.('#meetingChatPanel [data-chat-new]');
    if(newChat){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openChatTargetMenu(newChat);return;}
    const everyone=event.target.closest?.('#meetingChatPanel [data-chat-everyone]');
    if(everyone){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();selectEveryone();return;}
    if(chatTargetMenu&&!chatTargetMenu.contains(event.target))closeChatTargetMenu();
    if(event.target.closest?.('#roomReactions'))requestAnimationFrame(removeDuplicateReactionHand);
    if(event.target.closest?.('#roomChat'))requestAnimationFrame(()=>{window.DominionZoomAdaptiveParity?.syncChat?.();syncChatNavigation();});
  },true);
  window.addEventListener('dominion:meeting-ui-ready',requestSync);
  window.addEventListener('dominion:meeting-snapshot',requestSync);
  window.addEventListener('resize',requestSync);
  // Observe structural changes and meeting visibility only. Never observe class
  // or aria-pressed because this authority updates those states itself; doing
  // so creates a self-triggering mutation loop that can starve the renderer.
  observer=new MutationObserver(requestSync);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  timer=setInterval(requestSync,1200);sync();

  window.DominionApprovedReferenceParity=Object.freeze({version:'2.0.22',toolbarOrder:[...TOOLBAR_ORDER],hostToolbarOrder:[...HOST_TOOLBAR_ORDER],sync,requestSync,arrangeToolbar,ensureRaiseHandControl,syncChatNavigation,syncVideoPanel,dispose:()=>{clearInterval(timer);observer.disconnect();closeChatTargetMenu();}});
})();