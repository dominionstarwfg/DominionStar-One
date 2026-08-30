(()=>{
  if(window.DominionZoomReactionParity)return;

  const DURATION_MS=10000;
  let observer=null;
  const timers=new WeakMap();

  function enforce(node){
    if(!(node instanceof HTMLElement)||!node.classList.contains('ds-reaction-float'))return;
    if(node.dataset.dsReactionParity==='10s')return;

    // The legacy physical-acceptance layer still owns reaction construction.
    // Replace its node immediately so its old 6.3-second removal timer targets
    // a detached element, while this canonical node follows Zoom's 10-second
    // meeting-reaction lifetime.
    const canonical=node.cloneNode(true);
    canonical.dataset.dsReactionParity='10s';
    canonical.style.setProperty('animation-duration','10s','important');
    node.replaceWith(canonical);

    const timer=setTimeout(()=>{
      if(canonical.isConnected)canonical.remove();
      timers.delete(canonical);
    },DURATION_MS);
    timers.set(canonical,timer);
  }

  function scan(root=document){
    if(root instanceof HTMLElement&&root.classList.contains('ds-reaction-float'))enforce(root);
    root?.querySelectorAll?.('.ds-reaction-float').forEach(enforce);
  }

  observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes)scan(node);
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  scan();

  window.DominionZoomReactionParity=Object.freeze({
    version:'2.0.17',
    durationMs:DURATION_MS,
    scan,
    dispose(){
      observer?.disconnect();
      observer=null;
      document.querySelectorAll('.ds-reaction-float[data-ds-reaction-parity="10s"]').forEach(node=>{
        const timer=timers.get(node);if(timer)clearTimeout(timer);
        node.remove();
      });
    }
  });
})();
