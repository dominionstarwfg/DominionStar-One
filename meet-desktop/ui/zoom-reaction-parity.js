(()=>{
  if(window.DominionZoomReactionParity)return;

  const DURATION_MS=10000;
  let observer=null;
  const timers=new WeakMap();
  const esc=value=>String(value||'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));

  function canonicalize(node){
    if(!(node instanceof HTMLElement))return;
    if(node.classList.contains('ds-reaction-float')&&node.dataset.dsReactionParity==='10s')return;
    if(!node.classList.contains('meeting-reaction-bubble')&&!node.classList.contains('ds-reaction-float'))return;

    let canonical;
    if(node.classList.contains('meeting-reaction-bubble')){
      const emoji=String(node.querySelector('b')?.textContent||'');
      const name=String(node.querySelector('span')?.textContent||'Participant');
      if(!emoji)return;
      canonical=document.createElement('div');
      canonical.className='ds-reaction-float';
      canonical.innerHTML=`<b>${esc(emoji)}</b><span>${esc(name)}</span>`;
    }else{
      canonical=node.cloneNode(true);
    }

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
    if(root instanceof HTMLElement&&(root.classList.contains('meeting-reaction-bubble')||root.classList.contains('ds-reaction-float')))canonicalize(root);
    root?.querySelectorAll?.('.meeting-reaction-bubble,.ds-reaction-float').forEach(canonicalize);
  }

  observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes)scan(node);
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  scan();

  window.DominionZoomReactionParity=Object.freeze({
    version:'2.0.18',
    durationMs:DURATION_MS,
    scan,
    canonicalize,
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
