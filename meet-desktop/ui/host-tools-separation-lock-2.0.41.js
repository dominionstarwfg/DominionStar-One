(()=>{
  'use strict';
  if(window.DominionHostToolsSeparationLock2041)return;

  const q=s=>document.querySelector(s);
  let frame=0;
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
    const menu=q('.ds-ref-meeting-more-grid');if(!menu)return;
    for(const button of menu.querySelectorAll('.ds-ref-meeting-more-items button')){
      const spans=button.querySelectorAll('span'),label=String(spans[spans.length-1]?.textContent||'').trim(),icon=button.querySelector('.ds-ref-more-icon'),svg=moreIcons[label];
      if(!icon||!svg||icon.dataset.dsSemanticIcon==='1')continue;
      icon.innerHTML=svg;icon.dataset.dsSemanticIcon='1';
      icon.style.setProperty('width','22px');icon.style.setProperty('height','22px');
      icon.style.setProperty('display','grid');icon.style.setProperty('place-items','center');
      icon.style.setProperty('font-size','0');icon.style.setProperty('line-height','1');
    }
  }

  function sync(){
    frame=0;
    applyMoreSemanticIcons();
    window.DominionRuntimeStability?.layoutSideSurface?.();
  }
  function schedule(){if(frame)return;frame=requestAnimationFrame(sync);}

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('resize',schedule,true);
  window.addEventListener('dominion:meeting-ui-ready',schedule,true);

  window.DominionHostToolsSeparationLock2041=Object.freeze({
    version:'2.0.43-compatibility-no-geometry',
    sync,
    dispose:()=>{observer.disconnect();window.removeEventListener('resize',schedule,true);window.removeEventListener('dominion:meeting-ui-ready',schedule,true);if(frame)cancelAnimationFrame(frame);}
  });
  sync();
})();
