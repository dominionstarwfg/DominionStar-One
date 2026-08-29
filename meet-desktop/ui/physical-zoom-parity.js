(()=>{
  if(window.DominionPhysicalZoomParity)return;
  const q=s=>document.querySelector(s);
  const desktop=window.dominionDesktop||{};
  let currentUser=null;

  function initials(name){return String(name||'DominionStar Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()||'DS';}
  function setFallback(node,user,label=''){if(!node)return;const name=String(user?.name||label||'DominionStar Member'),url=String(user?.avatarUrl||'').trim();node.classList.toggle('profile-photo-fallback',Boolean(url));if(url){node.style.backgroundImage=`url("${url.replace(/"/g,'%22')}")`;node.style.backgroundSize='cover';node.style.backgroundPosition='center';node.textContent='';node.setAttribute('aria-label',`${name} profile picture`);}else{node.style.removeProperty('background-image');node.textContent=initials(name);node.setAttribute('aria-label',name);}}
  function syncLocalProfile(){if(!currentUser)return;setFallback(q('#prejoinAvatar'),currentUser);setFallback(q('#stageAvatar'),currentUser);const local=q('#localVideoDockTile .remote-peer-fallback');if(local){setFallback(local,currentUser);const span=local.querySelector('span');if(span)span.hidden=Boolean(currentUser.avatarUrl);}}

  function nearbyCaret(button){if(!button)return null;const next=button.nextElementSibling;if(next?.classList?.contains('av-device-caret'))return next;const footer=button.closest('.meeting-footer');if(!footer)return null;const kind=button.id==='roomMic'?'Audio':'Video';return [...footer.querySelectorAll('.av-device-caret')].find(node=>String(node.getAttribute('aria-label')||'').startsWith(kind))||null;}
  function attachCaret(button){const caret=nearbyCaret(button);if(!button||!caret)return false;caret.classList.add('zoom-attached-caret');caret.dataset.controlFor=button.id;button.classList.add('zoom-split-main');if(button.nextElementSibling!==caret)button.insertAdjacentElement('afterend',caret);return true;}
  function normalizeToolbar(){const footer=q('.meeting-footer');if(!footer)return;attachCaret(q('#roomMic'));attachCaret(q('#roomCamera'));for(const caret of footer.querySelectorAll('.av-device-caret')){const target=caret.dataset.controlFor&&q(`#${caret.dataset.controlFor}`);if(target&&target.nextElementSibling!==caret)target.insertAdjacentElement('afterend',caret);}}

  let raf=0;
  function scheduleSync(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{normalizeToolbar();syncLocalProfile();});}
  function observe(){const root=q('#meetingOverlay')||document.body;const observer=new MutationObserver(scheduleSync);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','aria-pressed']});window.addEventListener('dominion:meeting-ui-ready',scheduleSync);window.addEventListener('dominion:meeting-entered',scheduleSync);}
  async function loadIdentity(){try{const state=await desktop.auth?.getState?.();currentUser=state?.user||null;syncLocalProfile();}catch{}desktop.auth?.onChanged?.(state=>{currentUser=state?.user||null;scheduleSync();});}

  loadIdentity();observe();setTimeout(scheduleSync,0);setTimeout(scheduleSync,500);
  window.DominionPhysicalZoomParity=Object.freeze({version:'1.0.0',normalizeToolbar,syncLocalProfile});
})();
