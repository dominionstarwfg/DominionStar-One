(()=>{
  if(window.DominionZoomReactionParity)return;

  const DURATION_MS=10000;
  const MAX_ACTIVE=72;
  let observer=null;
  let observedLayer=null;
  let sequence=0;
  const timers=new WeakMap();
  const active=[];
  const esc=value=>String(value||'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const hash=value=>{let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};

  function reactionLayer(){return document.querySelector('#meetingReactionLayer');}
  function stage(){return document.querySelector('#meetingOverlay .stage');}

  function trimActive(){
    while(active.length>MAX_ACTIVE){
      const node=active.shift();
      if(!node?.isConnected)continue;
      const timer=timers.get(node);if(timer)clearTimeout(timer);
      timers.delete(node);node.remove();
    }
  }

  function blossom(layer,emoji,seed,left,bottom){
    if(!['❤️','👏','👍'].includes(emoji))return;
    // Zoom does not blossom every reaction. Use a deterministic pseudo-random
    // sample so high-volume reactions feel organic without a costly RNG/timer
    // loop and remain stable in packaged QA.
    if(seed%6!==0)return;
    const count=3+(seed%4);
    const fragment=document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const satellite=document.createElement('div');
      satellite.className='ds-reaction-float ds-reaction-satellite';
      satellite.dataset.dsReactionSatellite='1';
      const spread=((seed>>(i%16))%76)-38;
      const lift=18+((seed>>(i%12))%92);
      const size=25+((seed+i*19)%18);
      satellite.style.left=`calc(${left}% + ${spread}px)`;
      satellite.style.bottom=`${bottom+lift}px`;
      satellite.style.animationDuration=`${6.1+((seed+i)%17)/10}s`;
      satellite.style.animationDelay=`${(i%4)*.08}s`;
      satellite.style.willChange='transform,opacity';
      satellite.innerHTML=`<b style="font-size:${size}px">${esc(emoji)}</b>`;
      fragment.append(satellite);
      setTimeout(()=>satellite.remove(),7600+(i%4)*120);
    }
    layer.append(fragment);
  }

  function canonicalize(node){
    if(!(node instanceof HTMLElement))return;
    if(node.classList.contains('ds-reaction-float')&&node.dataset.dsReactionParity==='10s')return;
    if(!node.classList.contains('meeting-reaction-bubble')&&!node.classList.contains('ds-reaction-float'))return;

    const emoji=String(node.querySelector('b')?.textContent||'');
    const name=String(node.querySelector('span')?.textContent||'Participant');
    if(!emoji)return;

    const serial=++sequence;
    const seed=hash(`${emoji}|${name}|${serial}`);
    const lane=seed%7;
    const left=5.5+lane*2.9+((seed%19)-9)/10;
    const bottom=24+(seed%42);
    const dense=active.filter(item=>item?.isConnected).length>14;
    const showName=!dense||serial%3===0;

    let canonical;
    if(node.classList.contains('meeting-reaction-bubble')){
      canonical=document.createElement('div');
      canonical.className='ds-reaction-float ds-zoom-floating-reaction';
      canonical.innerHTML=`<b>${esc(emoji)}</b>${showName?`<span>${esc(name)}</span>`:'<span hidden></span>'}`;
    }else{
      canonical=node.cloneNode(true);
      canonical.classList.add('ds-zoom-floating-reaction');
      const label=canonical.querySelector('span');if(label&&!showName)label.hidden=true;
    }

    canonical.dataset.dsReactionParity='10s';
    canonical.dataset.dsReactionLane=String(lane);
    canonical.style.left=`${left}%`;
    canonical.style.right='auto';
    canonical.style.bottom=`${bottom}px`;
    canonical.style.setProperty('animation-duration','10s','important');
    canonical.style.animationDelay=`${(seed%7)*.025}s`;
    canonical.style.willChange='transform,opacity';
    canonical.style.pointerEvents='none';
    node.replaceWith(canonical);

    active.push(canonical);trimActive();
    blossom(canonical.parentElement,emoji,seed,left,bottom);

    const timer=setTimeout(()=>{
      if(canonical.isConnected)canonical.remove();
      timers.delete(canonical);
      const index=active.indexOf(canonical);if(index>=0)active.splice(index,1);
    },DURATION_MS);
    timers.set(canonical,timer);
  }

  function processAdded(node){
    if(!(node instanceof HTMLElement))return;
    if(node.dataset.dsReactionSatellite==='1')return;
    if(node.classList.contains('meeting-reaction-bubble')||node.classList.contains('ds-reaction-float'))canonicalize(node);
    node.querySelectorAll?.('.meeting-reaction-bubble,.ds-reaction-float:not([data-ds-reaction-satellite="1"])').forEach(canonicalize);
  }

  function mount(){
    const layer=reactionLayer();if(!layer)return false;
    const targetStage=stage();if(targetStage&&layer.parentElement!==targetStage)targetStage.append(layer);
    layer.dataset.dsZoomReactionLane='left';
    if(layer!==observedLayer){
      observer?.disconnect();observedLayer=layer;
      observer=new MutationObserver(records=>{
        for(const record of records)for(const node of record.addedNodes)processAdded(node);
      });
      // Narrow observer only: direct reaction children. Never observe the whole
      // document or the reaction subtree, so a blossom cannot recursively wake
      // the renderer the way the old implementation did.
      observer.observe(layer,{childList:true});
    }
    return true;
  }

  function scan(root=document){
    mount();
    if(root instanceof HTMLElement&&(root.classList.contains('meeting-reaction-bubble')||root.classList.contains('ds-reaction-float')))canonicalize(root);
    root?.querySelectorAll?.('.meeting-reaction-bubble,.ds-reaction-float:not([data-ds-reaction-satellite="1"])').forEach(canonicalize);
  }

  window.addEventListener('dominion:meeting-ui-ready',()=>{mount();scan();});
  window.addEventListener('dominion:meeting-snapshot',()=>mount());
  window.addEventListener('resize',()=>mount(),{passive:true});
  queueMicrotask(()=>{mount();scan();});

  window.DominionZoomReactionParity=Object.freeze({
    version:'2.0.22',
    durationMs:DURATION_MS,
    scan,
    canonicalize,
    mount,
    dispose(){
      observer?.disconnect();observer=null;observedLayer=null;
      for(const node of [...active]){const timer=timers.get(node);if(timer)clearTimeout(timer);node.remove();}
      active.length=0;
    }
  });
})();