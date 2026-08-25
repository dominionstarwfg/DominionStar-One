(()=>{
  'use strict';
  if(window.DominionOptionalFeatureLoader)return;
  const desktop=new URLSearchParams(location.search).get('desktop')==='1';
  const loaded=new Map();
  const load=(src,marker)=>{
    if(loaded.has(marker))return loaded.get(marker);
    const existing=document.querySelector(`script[${marker}]`);
    if(existing)return Promise.resolve(existing);
    const promise=new Promise(resolve=>{const node=document.createElement('script');node.src=src;node.async=false;node.setAttribute(marker,'1');node.onload=()=>resolve(node);node.onerror=()=>resolve(node);document.head.append(node);});
    loaded.set(marker,promise);return promise;
  };
  const personalRoom=()=>load('/assets/js/meet-next/personal-room.js?v=3-browser-only','data-ds-optional-personal-room');
  const transcription=()=>load('/assets/js/meet/live-transcription.js?v=5-on-demand','data-ds-optional-transcription');
  const intelligence=()=>load('/assets/js/meet/meeting-intelligence.js?v=2-on-demand','data-ds-optional-intelligence');

  // The desktop has a dedicated Home/Settings authority. The old dashboard
  // Personal Room editor is browser-only and must not compete with desktop
  // identity state.
  if(!desktop){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void personalRoom(),{once:true});
    else void personalRoom();
  }

  document.addEventListener('pointerdown',event=>{
    if(event.target.closest?.('#transcribeBtn'))void transcription();
    if(event.target.closest?.('#meetingIntelligenceBtn'))void intelligence();
  },true);
  document.addEventListener('mouseenter',event=>{
    if(event.target.closest?.('#transcribeBtn'))void transcription();
    if(event.target.closest?.('#meetingIntelligenceBtn'))void intelligence();
  },true);

  window.DominionOptionalFeatureLoader=Object.freeze({version:'1.0.0',personalRoom,transcription,intelligence});
})();