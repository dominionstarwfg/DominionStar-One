(()=>{
  if(window.DominionZoomContractBridge)return;
  const apply=node=>{
    if(!(node instanceof HTMLElement))return;
    if(node.classList.contains('ds-command-menu'))node.classList.add('meeting-more-menu');
    if(node.classList.contains('ds-reaction-tray'))node.classList.add('meeting-reaction-menu');
    for(const child of node.querySelectorAll?.('.ds-command-menu,.ds-reaction-tray')||[]){if(child.classList.contains('ds-command-menu'))child.classList.add('meeting-more-menu');if(child.classList.contains('ds-reaction-tray'))child.classList.add('meeting-reaction-menu');}
  };
  const style=document.createElement('style');style.dataset.dsZoomContractBridge='1';style.textContent='.ds-reaction-tray.meeting-reaction-menu{display:flex!important}.ds-command-menu.meeting-more-menu{display:block!important}';document.head.append(style);
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)apply(node);});observer.observe(document.body,{childList:true,subtree:true});
  for(const node of document.querySelectorAll('.ds-command-menu,.ds-reaction-tray'))apply(node);
  window.DominionZoomContractBridge=Object.freeze({version:'1.0.0',dispose:()=>observer.disconnect()});
})();
