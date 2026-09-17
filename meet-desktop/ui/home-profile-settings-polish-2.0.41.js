(()=>{
  'use strict';
  if(window.DominionHomeProfileSettingsPolish2041)return;

  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const desktop=window.dominionDesktop||{};
  let authState=null;

  const initials=value=>String(value||'DominionStar Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'DS';
  const safeUrl=value=>{const url=String(value||'').trim();return /^https:\/\//i.test(url)||/^data:image\/(?:png|jpe?g|webp);base64,/i.test(url)?url:'';};

  function setPhoto(node,user){
    if(!node)return;
    const url=safeUrl(user?.avatarUrl),label=initials(user?.name);
    node.textContent='';node.classList.toggle('has-photo',Boolean(url));
    if(url){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=url;img.onerror=()=>{node.classList.remove('has-photo');node.textContent=label;};node.append(img);}
    else node.textContent=label;
  }

  function openProfile(){
    const dialog=q('#profileDialog');if(!dialog)return;
    if(!dialog.open)dialog.showModal();
    window.setTimeout(()=>q('#changeProfilePicture')?.focus(),0);
  }

  function ensureProfileCard(){
    const actions=q('#homeSection .quick-actions');if(!actions)return;
    let card=actions.querySelector('.ds-home-profile');
    if(!card){
      card=document.createElement('button');card.type='button';card.className='action-card ds-home-profile';
      card.innerHTML='<span class="action-icon ds-home-profile-photo" aria-hidden="true">DS</span><strong>Profile</strong><small>Photo & account</small>';
      card.addEventListener('click',openProfile);actions.append(card);
    }
    setPhoto(card.querySelector('.ds-home-profile-photo'),authState?.user||null);
  }

  function ensureSettingsProfileRow(){
    const list=q('#settingsDialog .settings-list');if(!list)return;
    let row=list.querySelector('.ds-settings-profile-row');
    if(!row){
      row=document.createElement('button');row.type='button';row.className='settings-row ds-settings-profile-row';
      row.innerHTML='<span><strong>Profile & Account</strong><small>Profile photo, identity, and account</small></span><span>›</span>';
      row.addEventListener('click',()=>{const settings=q('#settingsDialog');if(settings?.open)settings.close();window.setTimeout(openProfile,0);});
      list.prepend(row);
    }
  }

  function showSettingsList(){
    const dialog=q('#settingsDialog');if(!dialog)return;
    const list=dialog.querySelector('.settings-list'),note=dialog.querySelector('.settings-note'),detail=dialog.querySelector('#avSettingsDetail');
    dialog.classList.remove('av-video-settings-open');
    if(list)list.hidden=false;if(note)note.hidden=false;if(detail)detail.hidden=true;
    const form=dialog.querySelector('form');if(form)form.scrollTop=0;
  }

  function ensureSettingsFooter(){
    const dialog=q('#settingsDialog'),form=dialog?.querySelector('form');if(!dialog||!form)return;
    let footer=form.querySelector('.ds-settings-footer');
    if(!footer){
      footer=document.createElement('div');footer.className='ds-settings-footer';
      footer.innerHTML='<span>Use Back to return to Settings. Press Esc or Close to exit.</span><button type="button" class="primary-button" data-ds-settings-close>Close</button>';
      footer.querySelector('[data-ds-settings-close]').onclick=()=>dialog.close();
      form.append(footer);
    }
  }

  function bindSettingsNavigation(){
    const dialog=q('#settingsDialog');if(!dialog||dialog.dataset.dsNavigationBound==='1')return;
    dialog.dataset.dsNavigationBound='1';
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      const detail=dialog.querySelector('#avSettingsDetail');
      if(detail&&!detail.hidden){event.preventDefault();event.stopPropagation();showSettingsList();}
    },true);
    dialog.addEventListener('close',showSettingsList);
  }

  function refreshProfileUi(){
    ensureProfileCard();
    const top=q('#profileAvatar');if(top)setPhoto(top,authState?.user||null);
    const dialogAvatar=q('#profileDialogAvatar');if(dialogAvatar)setPhoto(dialogAvatar,authState?.user||null);
  }

  async function refreshAuth(){
    try{authState=await desktop.auth?.getState?.()||authState;}catch{}
    refreshProfileUi();
  }

  function sync(){
    ensureProfileCard();ensureSettingsProfileRow();ensureSettingsFooter();bindSettingsNavigation();refreshProfileUi();
  }

  desktop.auth?.onChanged?.(state=>{authState=state;refreshProfileUi();});
  window.addEventListener('dominion:meeting-ui-ready',sync,true);
  const observer=new MutationObserver(sync);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open']});
  const timer=setInterval(sync,700);
  void refreshAuth();sync();

  window.DominionHomeProfileSettingsPolish2041=Object.freeze({version:'2.0.41',sync,refresh:refreshAuth,openProfile,dispose:()=>{clearInterval(timer);observer.disconnect();}});
})();
