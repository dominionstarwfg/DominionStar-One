(()=>{
  'use strict';
  if(window.DominionOptionalFeatureLoader)return;
  const desktop=new URLSearchParams(location.search).get('desktop')==='1';
  const loaded=new Map();
  const load=(src,marker)=>{
    if(loaded.has(marker))return loaded.get(marker);
    const existing=document.querySelector(`script[${marker}]`);
    if(existing){const promise=existing.dataset.dsLoaded==='1'?Promise.resolve(existing):new Promise(resolve=>{existing.addEventListener('load',()=>resolve(existing),{once:true});existing.addEventListener('error',()=>resolve(existing),{once:true});});loaded.set(marker,promise);return promise;}
    const promise=new Promise(resolve=>{const node=document.createElement('script');node.src=src;node.async=false;node.setAttribute(marker,'1');node.addEventListener('load',()=>{node.dataset.dsLoaded='1';resolve(node);},{once:true});node.addEventListener('error',()=>resolve(node),{once:true});document.head.append(node);});
    loaded.set(marker,promise);return promise;
  };
  const personalRoom=()=>load('/assets/js/meet-next/personal-room.js?v=3-browser-only','data-ds-optional-personal-room');
  const transcription=()=>load('/assets/js/meet/live-transcription.js?v=5-on-demand','data-ds-optional-transcription');
  const intelligence=()=>load('/assets/js/meet/meeting-intelligence.js?v=2-on-demand','data-ds-optional-intelligence');

  // Desktop has its own account-backed Personal Room authority on Meet Home.
  // Browser users retain the historical Personal Room editor.
  if(!desktop){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void personalRoom(),{once:true});
    else void personalRoom();
  }

  const featureForTarget=target=>{
    if(target?.closest?.('#transcribeBtn'))return transcription;
    if(target?.closest?.('#meetingIntelligenceBtn'))return intelligence;
    return null;
  };

  // Warm the local module before click when possible.
  document.addEventListener('pointerenter',event=>{const feature=featureForTarget(event.target);if(feature)void feature();},true);
  document.addEventListener('focusin',event=>{const feature=featureForTarget(event.target);if(feature)void feature();},true);

  // Guarantee the first click works even if the module was not already warm.
  let replaying=false;
  document.addEventListener('click',async event=>{
    if(replaying)return;
    const feature=featureForTarget(event.target);if(!feature)return;
    const button=event.target.closest('button');if(!button)return;
    const marker=button.id==='transcribeBtn'?'data-ds-optional-transcription':'data-ds-optional-intelligence';
    if(document.querySelector(`script[${marker}][data-ds-loaded="1"]`))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    await feature();
    replaying=true;try{button.click();}finally{replaying=false;}
  },true);

  window.DominionOptionalFeatureLoader=Object.freeze({version:'1.1.0-reliable-lazy',personalRoom,transcription,intelligence});
})();