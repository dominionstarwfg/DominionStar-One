(()=>{
  if(window.DominionZoomContractBridge)return;

  let chatObserver=null;
  let observedChat=null;

  const hostToolsPrimaryVisible=()=>{
    const button=document.querySelector('#roomHostTools');
    if(!button||button.hidden)return false;
    const style=getComputedStyle(button);
    return style.display!=='none'&&style.visibility!=='hidden';
  };

  const dedupeHostTools=element=>{
    if(!(element instanceof HTMLElement)||!element.classList.contains('meeting-more-menu')||element.classList.contains('security-menu')||!hostToolsPrimaryVisible())return;
    for(const button of element.querySelectorAll('button')){
      if(/^host\s+tools$/i.test(String(button.textContent||'').trim()))button.remove();
    }
    element.dataset.dsHostToolsDeduped='1';
  };

  const ensureChatChrome=panel=>{
    if(!(panel instanceof HTMLElement)||panel.hidden)return;
    const header=panel.querySelector('header');
    if(header&&!panel.querySelector('.ds-adaptive-chat-nav')){
      const nav=document.createElement('div');
      nav.className='ds-adaptive-chat-nav';
      nav.innerHTML='<button type="button" class="active" data-chat-everyone>Everyone</button><button type="button" data-chat-new>＋ New chat</button>';
      header.insertAdjacentElement('afterend',nav);
      nav.querySelector('[data-chat-everyone]').onclick=()=>{const select=document.querySelector('#meetingChatRecipient');if(select){select.value='everyone';select.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('#meetingChatInput')?.focus();};
      nav.querySelector('[data-chat-new]').onclick=()=>document.querySelector('#meetingChatRecipient')?.focus();
    }
    const form=panel.querySelector('#meetingChatForm');
    if(form&&!panel.querySelector('.ds-chat-privacy')){
      const privacy=document.createElement('div');privacy.className='ds-chat-privacy';privacy.textContent='Who can see your messages?';form.before(privacy);
    }
    const send=form?.querySelector('button[type="submit"]');
    if(send&&!send.dataset.dsAdaptiveSend){send.dataset.dsAdaptiveSend='1';send.textContent='➤';send.title='Send';send.setAttribute('aria-label','Send message');}
    window.DominionApprovedReferenceParity?.syncChatNavigation?.();
  };

  const bindChatObserver=()=>{
    const panel=document.querySelector('#meetingChatPanel');
    if(panel===observedChat)return;
    chatObserver?.disconnect();observedChat=panel;
    if(!panel)return;
    chatObserver=new MutationObserver(()=>{if(!panel.hidden)queueMicrotask(()=>ensureChatChrome(panel));});
    chatObserver.observe(panel,{attributes:true,attributeFilter:['hidden']});
    if(!panel.hidden)ensureChatChrome(panel);
  };

  const apply=node=>{
    if(!(node instanceof HTMLElement))return;
    const decorate=element=>{
      if(element.classList.contains('ds-command-menu')){
        element.classList.add('meeting-more-menu');
        const heading=String(element.querySelector('.ds-command-menu-heading')?.textContent||'').trim();
        if(heading==='View')element.classList.add('ds-view-command-menu');
        if(heading==='Host Tools'||heading==='More')element.classList.add('ds-bottom-command-menu');
      }
      dedupeHostTools(element);
      // The legacy ds-reaction-tray is retired. Do not decorate it into the
      // canonical menu class; the only supported chooser is
      // DominionMeetingFeatures.openReactions() -> .meeting-reaction-menu.
    };
    decorate(node);
    for(const child of node.querySelectorAll?.('.ds-command-menu,.meeting-more-menu')||[])decorate(child);
    bindChatObserver();
  };

  const style=document.createElement('style');
  style.dataset.dsZoomContractBridge='1';
  style.textContent=[
    '.meeting-reaction-menu{display:flex!important;z-index:3800!important;pointer-events:auto!important}',
    '.ds-reaction-tray{display:none!important}',
    '.meeting-more-menu{z-index:3600!important;pointer-events:auto!important}',
    '.ds-command-menu.meeting-more-menu{display:block!important}',
    '.ds-command-menu.ds-view-command-menu{top:64px!important;bottom:auto!important}',
    '.ds-command-menu.ds-bottom-command-menu{top:auto!important;bottom:88px!important}',
    '#meetingChatPanel{width:400px!important;min-width:390px!important;max-width:400px!important}',
    '#meetingChatPanel header strong{font-size:16px!important}',
    '#meetingChatInput{font-size:14px!important;line-height:1.4!important;min-height:58px!important}'
  ].join('');
  document.head.append(style);

  // Menus are top-level transient surfaces. Observe only direct body children;
  // never patch DOM prototypes and never observe the entire subtree. Chat has
  // its own narrow hidden-attribute observer so opening it deterministically
  // mounts navigation without a timer or layout reconciliation loop.
  const observer=new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)apply(node);
    bindChatObserver();
  });
  if(document.body)observer.observe(document.body,{childList:true});
  for(const node of document.querySelectorAll('.ds-command-menu,.meeting-more-menu'))apply(node);
  bindChatObserver();

  window.DominionZoomContractBridge=Object.freeze({
    version:'2.0.22-canonical-react-host-tools-chat',
    apply,
    dedupeHostTools,
    ensureChatChrome,
    dispose:()=>{observer.disconnect();chatObserver?.disconnect();}
  });
})();