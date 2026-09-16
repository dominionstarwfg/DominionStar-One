(()=>{
'use strict';
if(window.DominionHostToolsWindowLock2041)return;
window.DominionHostToolsWindowLock2041={locked:true};

const selector='.ds-ref-host-tools-panel';

function detachHostTools(){
  const meeting=document.querySelector('#meetingOverlay');
  if(!meeting)return;
  document.querySelectorAll(selector).forEach(panel=>{
    if(panel.parentElement!==meeting){
      meeting.appendChild(panel);
    }
    if(!panel.classList.contains('ds-host-tools-viewport-lock')){
      panel.classList.add('ds-host-tools-viewport-lock');
    }
  });
}

const observer=new MutationObserver(()=>detachHostTools());
observer.observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('click',event=>{
  if(event.target.closest('#roomHostTools')){
    requestAnimationFrame(()=>requestAnimationFrame(detachHostTools));
  }
},true);

document.addEventListener('dominion:meeting-ui-ready',()=>requestAnimationFrame(detachHostTools));
document.addEventListener('DOMContentLoaded',detachHostTools,{once:true});

detachHostTools();
})();
