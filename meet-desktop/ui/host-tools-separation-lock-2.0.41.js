(()=>{
  'use strict';
  if(window.DominionHostToolsSeparationLock2041)return;

  const q=s=>document.querySelector(s);
  let frame=0,lastHost=null;

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
