(()=>{
  if(window.DominionZoomContractBridge)return;
  const apply=node=>{
    if(!(node instanceof HTMLElement))return;
    const decorate=element=>{
      if(element.classList.contains('ds-command-menu')){
        element.classList.add('meeting-more-menu');
        const heading=String(element.querySelector('.ds-command-menu-heading')?.textContent||'').trim();
        if(heading==='View')element.classList.add('ds-view-command-menu');
        if(heading==='Host Tools'||heading==='More')element.classList.add('ds-bottom-command-menu');
      }
      if(element.classList.contains('ds-reaction-tray'))element.classList.add('meeting-reaction-menu');
    };
    decorate(node);
    for(const child of node.querySelectorAll?.('.ds-command-menu,.ds-reaction-tray')||[])decorate(child);
  };

  const style=document.createElement('style');
  style.dataset.dsZoomContractBridge='1';
  style.textContent=[
    '.ds-reaction-tray.meeting-reaction-menu{display:flex!important;z-index:3800!important;pointer-events:auto!important}',
    '.ds-command-menu.meeting-more-menu{display:block!important;z-index:3600!important;pointer-events:auto!important}',
    '.ds-command-menu.ds-view-command-menu{top:64px!important;bottom:auto!important}',
    '.ds-command-menu.ds-bottom-command-menu{top:auto!important;bottom:88px!important}',
    '#meetingChatPanel{width:400px!important;min-width:390px!important;max-width:400px!important}',
    '#meetingChatPanel header strong{font-size:16px!important}',
    '#meetingChatInput{font-size:14px!important;line-height:1.4!important;min-height:58px!important}'
  ].join('');
  document.head.append(style);

  // Menus are top-level transient surfaces. Observe only direct body children;
  // never patch DOM prototypes and never observe the entire subtree. This keeps
  // compatibility decoration off the hot video/participant rendering path.
  const observer=new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)apply(node);
  });
  if(document.body)observer.observe(document.body,{childList:true});
  for(const node of document.querySelectorAll('.ds-command-menu,.ds-reaction-tray'))apply(node);

  window.DominionZoomContractBridge=Object.freeze({
    version:'2.0.22',
    apply,
    dispose:()=>observer.disconnect()
  });
})();