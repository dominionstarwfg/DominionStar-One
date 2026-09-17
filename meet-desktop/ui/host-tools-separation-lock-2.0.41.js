(()=>{
  'use strict';
  if(window.DominionHostToolsSeparationLock2041)return;

  const q=s=>document.querySelector(s);
  let frame=0,lastHost=null;

  const iconSvg=body=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="width:20px;height:20px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round">${body}</svg>`;
  const moreIcons=Object.freeze({
    'Record':iconSvg('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>'),
    'Show captions':iconSvg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10.2a2.4 2.4 0 1 0 0 3.6M17 10.2a2.4 2.4 0 1 0 0 3.6"/>'),
    'Breakout rooms':iconSvg('<rect x="3.5" y="4" width="7" height="6" rx="1.2"/><rect x="13.5" y="4" width="7" height="6" rx="1.2"/><rect x="3.5" y="14" width="7" height="6" rx="1.2"/><rect x="13.5" y="14" width="7" height="6" rx="1.2"/>'),
    'Polls/quizzes':iconSvg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 16v-3M12 16V8M16 16v-5"/>'),
    'Docs':iconSvg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>'),
    'Whiteboards':iconSvg('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M8 13l6.5-6.5 2 2L10 15H8z"/>'),
    'Apps':iconSvg('<rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/>'),
    'Meeting info':iconSvg('<circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.3h.01"/>'),
    'Transfer to room':iconSvg('<path d="M13 5h6v14h-6M10 8l4 4-4 4M14 12H3"/>'),
    'Settings':iconSvg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5"/><circle cx="12" cy="12" r="7"/>')
  });

  function applyMoreSemanticIcons(){
    const menu=q('.ds-ref-meeting-more-grid');
    if(!menu)return;
    for(const button of menu.querySelectorAll('.ds-ref-meeting-more-items button')){
      const spans=button.querySelectorAll('span');
      const label=String(spans[spans.length-1]?.textContent||'').trim();
      const icon=button.querySelector('.ds-ref-more-icon');
      const svg=moreIcons[label];
      if(!icon||!svg||icon.dataset.dsSemanticIcon==='1')continue;
      icon.innerHTML=svg;
      icon.dataset.dsSemanticIcon='1';
      icon.style.setProperty('width','22px');
      icon.style.setProperty('height','22px');
      icon.style.setProperty('display','grid');
      icon.style.setProperty('place-items','center');
      icon.style.setProperty('font-size','0');
      icon.style.setProperty('line-height','1');
    }
  }

  function meetingOpen(){
    const overlay=q('#meetingOverlay');
    return Boolean(overlay&&!overlay.hidden);
  }

  function centerParticipantsOnce(panel){
    if(!panel||panel.hidden||!meetingOpen())return;
    const width=Math.min(Math.max(panel.offsetWidth||390,320),Math.max(320,innerWidth-24));
    const height=Math.min(Math.max(panel.offsetHeight||520,310),Math.max(310,innerHeight-24));
    const left=Math.max(12,Math.round((innerWidth-width)/2));
    const top=Math.max(12,Math.round((innerHeight-height)/2));
    panel.classList.add('ds-center-lock');
    panel.style.setProperty('position','fixed','important');
    panel.style.setProperty('width',`${width}px`,'important');
    panel.style.setProperty('height',`${height}px`,'important');
    panel.style.setProperty('left',`${left}px`,'important');
    panel.style.setProperty('right','auto','important');
    panel.style.setProperty('top',`${top}px`,'important');
    panel.style.setProperty('bottom','auto','important');
    panel.style.setProperty('transform','none','important');
    panel.dataset.dsFinalCentered='1';
  }

  function placeHost(host,panel){
    if(!host)return;
    host.style.setProperty('position','fixed','important');
    host.style.setProperty('width','248px','important');
    host.style.setProperty('min-width','248px','important');
    host.style.setProperty('max-width','248px','important');
    host.style.setProperty('right','20px','important');
    host.style.setProperty('left','auto','important');
    host.style.setProperty('top','136px','important');
    host.style.setProperty('bottom','auto','important');
    host.style.setProperty('transform','none','important');
    host.style.setProperty('z-index','4600','important');

    if(!panel||panel.hidden)return;
    const p=panel.getBoundingClientRect();
    const h=host.getBoundingClientRect();
    const overlaps=!(h.right<=p.left-16||h.left>=p.right+16||h.bottom<=p.top-16||h.top>=p.bottom+16);
    if(!overlaps)return;

    const rightCandidate=p.right+16;
    if(rightCandidate+248<=innerWidth-12){
      host.style.setProperty('left',`${Math.round(rightCandidate)}px`,'important');
      host.style.setProperty('right','auto','important');
      return;
    }
    const leftCandidate=p.left-16-248;
    if(leftCandidate>=12){
      host.style.setProperty('left',`${Math.round(leftCandidate)}px`,'important');
      host.style.setProperty('right','auto','important');
    }
  }

  function sync(){
    frame=0;
    applyMoreSemanticIcons();
    if(!meetingOpen()){lastHost=null;return;}
    const panel=q('#meetingOverlay .room-side.ds-participants-reference')||q('#meetingOverlay .room-side');
    const host=q('.ds-ref-host-tools-panel');
    if(!host){lastHost=null;return;}
    if(host!==lastHost){
      lastHost=host;
      centerParticipantsOnce(panel);
      requestAnimationFrame(()=>placeHost(host,panel));
      return;
    }
    placeHost(host,panel);
  }

  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(sync);
  }

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','style']});
  window.addEventListener('resize',schedule,true);
  window.addEventListener('dominion:meeting-ui-ready',schedule,true);

  window.DominionHostToolsSeparationLock2041=Object.freeze({
    version:'2.0.41',
    sync,
    dispose:()=>{observer.disconnect();window.removeEventListener('resize',schedule,true);window.removeEventListener('dominion:meeting-ui-ready',schedule,true);if(frame)cancelAnimationFrame(frame);}
  });

  sync();
})();
