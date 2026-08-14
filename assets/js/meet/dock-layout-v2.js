(()=>{
  'use strict';
  const dock=document.getElementById('filmstrip');
  const track=document.getElementById('filmstripTrack');
  if(!dock||!track)return;
  const interactive='button,input,select,textarea,a,[role="button"],[contenteditable="true"],video';
  const storageKey='ds-meet-dock-layout-v3';
  let drag=null;
  let manual=false;
  let lastMode='';

  const saved=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}};
  const store=()=>{try{const rect=dock.getBoundingClientRect();localStorage.setItem(storageKey,JSON.stringify({left:rect.left,top:rect.top,orientation:dock.dataset.orientation||'vertical'}))}catch{}};
  const count=()=>track.querySelectorAll('.remote-tile:not([hidden])').length;
  const visibleLimit=()=>Math.max(1,Math.min(5,Number(dock.style.getPropertyValue('--dock-visible-count'))||5));
  const announce=()=>window.dispatchEvent(new CustomEvent('dominionstar:dock-layout',{detail:{orientation:dock.dataset.orientation,count:count(),visible:visibleLimit()}}));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  function place(edge,{preserve=false}={}){
    const margin=12,topSafe=60,bottomSafe=86;
    const rect=dock.getBoundingClientRect();
    const horizontal=edge==='top'||edge==='bottom';
    dock.dataset.orientation=horizontal?'horizontal':'vertical';
    dock.dataset.edge=edge;
    dock.classList.toggle('dock-horizontal',horizontal);
    dock.classList.toggle('dock-vertical',!horizontal);
    let left=edge==='left'?margin:edge==='right'?innerWidth-rect.width-margin:clamp((innerWidth-rect.width)/2,margin,Math.max(margin,innerWidth-rect.width-margin));
    let top=edge==='top'?topSafe:edge==='bottom'?innerHeight-rect.height-bottomSafe:clamp(rect.top||topSafe,topSafe,Math.max(topSafe,innerHeight-rect.height-bottomSafe));
    if(preserve){const old=saved();if(old){left=clamp(old.left,margin,Math.max(margin,innerWidth-rect.width-margin));top=clamp(old.top,topSafe,Math.max(topSafe,innerHeight-rect.height-bottomSafe));}}
    Object.assign(dock.style,{left:`${Math.round(left)}px`,top:`${Math.round(top)}px`,right:'auto',bottom:'auto'});
    announce();
  }

  function applyLayout(layout={}){
    const mode=layout.mode||(innerWidth<560||innerHeight<390?'mini':innerWidth<820||innerHeight<560?'compact':innerWidth<1180||innerHeight<700?'narrow':'wide');
    const changed=mode!==lastMode;
    lastMode=mode;
    document.documentElement.dataset.desktopLayout=mode;
    document.documentElement.dataset.nativeWindowStyle=layout.nativeWindowStyle||'';
    dock.style.setProperty('--dock-visible-count',String(Math.min(5,Math.max(1,Number(layout.maxVisibleTiles)||5))));
    if(mode==='wide'){
      if(!manual||changed)place('right',{preserve:manual&&!changed});
    }else{
      // A contracted window needs a horizontal dock so the stage keeps its
      // usable width. This transition intentionally overrides an old wide
      // position that no longer fits.
      place('top');
    }
    dock.classList.toggle('dock-mini',mode==='mini');
    document.body.classList.toggle('desktop-mini-window',mode==='mini');
  }

  dock.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest(interactive))return;
    const rect=dock.getBoundingClientRect();
    drag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,active:false};
    dock.setPointerCapture?.(event.pointerId);
  });
  dock.addEventListener('pointermove',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!drag.active&&Math.hypot(dx,dy)<4)return;
    drag.active=true;manual=true;dock.classList.add('is-dragging');
    const left=clamp(drag.left+dx,8,Math.max(8,innerWidth-dock.offsetWidth-8));
    const top=clamp(drag.top+dy,54,Math.max(54,innerHeight-dock.offsetHeight-82));
    Object.assign(dock.style,{left:`${left}px`,top:`${top}px`,right:'auto',bottom:'auto'});
  });
  dock.addEventListener('pointerup',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(drag.active){
      const rect=dock.getBoundingClientRect();
      const edges={left:rect.left,right:innerWidth-rect.right,top:rect.top-54,bottom:innerHeight-rect.bottom-82};
      const edge=Object.entries(edges).sort((a,b)=>a[1]-b[1])[0][0];
      place(edge);store();
    }
    dock.classList.remove('is-dragging');dock.releasePointerCapture?.(event.pointerId);drag=null;
  });
  dock.addEventListener('pointercancel',()=>{dock.classList.remove('is-dragging');drag=null;});

  const desktop=window.dominionDesktop;
  desktop?.onWindowLayout?.(applyLayout);
  desktop?.getWindowLayout?.().then(layout=>layout&&applyLayout(layout)).catch(()=>applyLayout());
  let resizeFrame=0;
  addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>applyLayout());},{passive:true});
  new MutationObserver(()=>announce()).observe(track,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  const previous=saved();
  if(previous){manual=true;place(previous.orientation==='horizontal'?'top':'right',{preserve:true});}
  else applyLayout();
})();

