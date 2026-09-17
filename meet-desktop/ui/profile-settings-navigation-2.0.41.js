(()=>{
  'use strict';
  if(window.DominionProfileSettingsNavigation2041)return;
  const q=s=>document.querySelector(s);
  const desktop=window.dominionDesktop||{};
  let authState=null;

  function ensureStyles(){
    if(q('style[data-ds-profile-settings-nav-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsProfileSettingsNav2041='1';
    style.textContent=`
      .sidebar .ds-profile-nav{margin-top:auto}
      .sidebar .ds-profile-nav+.settings-nav{margin-top:8px}
      .ds-profile-nav .ds-profile-nav-avatar{position:relative;width:24px;height:24px;border-radius:50%;overflow:visible;display:grid;place-items:center;background:linear-gradient(145deg,#d8ab38,#8b6719);color:#10151d;font-size:9px;font-weight:850;border:1px solid rgba(229,184,66,.45)}
      .ds-profile-nav .ds-profile-nav-avatar img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
      .ds-profile-nav .ds-profile-nav-avatar.no-photo::after{content:'+';position:absolute;right:-5px;bottom:-4px;width:11px;height:11px;border-radius:50%;display:grid;place-items:center;background:#2f80ed;color:white;font-size:9px;font-weight:900;box-shadow:0 0 0 2px #091522}
      #settingsDialog{max-height:min(760px,calc(100vh - 36px));overflow:hidden}
      #settingsDialog>form{max-height:min(760px,calc(100vh - 36px));overflow:auto;padding:0 24px 18px;scrollbar-gutter:stable}
      #settingsDialog>form>header{position:sticky;top:0;z-index:5;margin:0 -24px 16px;padding:22px 24px 16px;background:linear-gradient(180deg,#0d1928 78%,rgba(13,25,40,.94));border-bottom:1px solid rgba(255,255,255,.08)}
      #settingsDialog .modal-close{position:relative;z-index:6;flex:none}
      #settingsDialog .settings-list{padding-top:2px}
      #settingsDialog .settings-row:focus-visible,#settingsDialog .modal-close:focus-visible,#settingsDialog .ds-settings-done:focus-visible{outline:2px solid #58a6ff;outline-offset:2px}
      #settingsDialog .ds-settings-done-wrap{position:sticky;bottom:-18px;z-index:5;margin:16px -24px -18px;padding:12px 24px 16px;display:flex;justify-content:flex-end;background:linear-gradient(0deg,#0d1928 78%,rgba(13,25,40,.94));border-top:1px solid rgba(255,255,255,.08)}
      #settingsDialog .ds-settings-done{min-width:86px}
      #settingsDialog .settings-row.ds-profile-settings-row{order:-10;border-color:rgba(229,184,66,.24);background:linear-gradient(145deg,rgba(229,184,66,.08),rgba(255,255,255,.025))}
      #profileDialog .profile-photo-actions{align-items:flex-start;flex-wrap:wrap}
      #profileDialog .profile-photo-actions::before{content:'Profile picture';width:100%;font-size:10px;font-weight:800;color:#aebbc9;margin-bottom:2px}
      #profileDialog .account-avatar{width:58px;height:58px;border-radius:50%}
      @media(max-width:800px){.sidebar .ds-profile-nav{margin-top:auto}.sidebar .ds-profile-nav+.settings-nav{margin-top:6px}}
    `;
    document.head.append(style);
  }

  function initials(name){return String(name||'DominionStar Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]?.toUpperCase()||'').join('')||'DS';}
  function avatarUrl(user){const raw=String(user?.avatarUrl||'').trim();return /^https:\/\//i.test(raw)||/^data:image\//i.test(raw)?raw:'';}
  function paintNavAvatar(){
    const host=q('.ds-profile-nav-avatar');if(!host)return;
    const user=authState?.signedIn?authState.user:null,url=avatarUrl(user),label=initials(user?.name);
    host.textContent='';host.classList.toggle('no-photo',!url);
    if(url){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=url;img.onerror=()=>{host.textContent=label;host.classList.add('no-photo');};host.append(img);}else host.textContent=label;
  }

  function openProfile(){
    const settings=q('#settingsDialog');if(settings?.open)settings.close();
    const profile=q('#profileDialog');if(profile&&!profile.open)profile.showModal();
    setTimeout(()=>q('#changeProfilePicture')?.focus(),40);
  }

  function installProfileNav(){
    const sidebar=q('.sidebar'),settings=q('.settings-nav');if(!sidebar||!settings||q('.ds-profile-nav'))return false;
    const button=document.createElement('button');button.type='button';button.className='nav-button ds-profile-nav';button.setAttribute('aria-label','Profile and profile picture');button.title='Profile';
    button.innerHTML='<span class="ds-profile-nav-avatar no-photo">DS</span><span>Profile</span>';
    button.onclick=openProfile;sidebar.insertBefore(button,settings);paintNavAvatar();return true;
  }

  function installSettingsProfileRow(){
    const list=q('#settingsDialog .settings-list');if(!list)return false;
    let row=q('#settingsDialog .ds-profile-settings-row');
    if(!row){row=document.createElement('button');row.type='button';row.className='settings-row ds-profile-settings-row';row.innerHTML='<span><strong>Profile</strong><small>Profile picture and account</small></span><span>›</span>';list.prepend(row);}
    row.onclick=openProfile;return true;
  }

  function installSettingsDone(){
    const form=q('#settingsDialog>form');if(!form||q('#settingsDialog .ds-settings-done-wrap'))return false;
    const wrap=document.createElement('div');wrap.className='ds-settings-done-wrap';const done=document.createElement('button');done.type='button';done.className='primary-button ds-settings-done';done.textContent='Done';done.onclick=()=>q('#settingsDialog')?.close();wrap.append(done);form.append(wrap);return true;
  }

  function normalizeSettingsOnOpen(){
    const dialog=q('#settingsDialog');if(!dialog)return;
    dialog.addEventListener('close',()=>{const form=dialog.querySelector('form');if(form)form.scrollTop=0;dialog.scrollTop=0;});
    const original=dialog.showModal?.bind(dialog);
    if(original&&!dialog.dataset.dsSettingsShowWrapped){
      dialog.dataset.dsSettingsShowWrapped='1';
      dialog.showModal=function(){const form=dialog.querySelector('form');if(form)form.scrollTop=0;dialog.scrollTop=0;return original();};
    }
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const rect=dialog.getBoundingClientRect();
      const inside=event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
      if(!inside)dialog.close();
    });
  }

  async function refreshAuth(){
    try{authState=await desktop.auth?.getState?.()||authState;}catch{}
    paintNavAvatar();
  }
  function sync(){ensureStyles();installProfileNav();installSettingsProfileRow();installSettingsDone();paintNavAvatar();}

  desktop.auth?.onChanged?.(state=>{authState=state;paintNavAvatar();});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const profile=q('#profileDialog'),settings=q('#settingsDialog');
    if(profile?.open){event.preventDefault();profile.close();return;}
    if(settings?.open){event.preventDefault();settings.close();}
  },true);
  window.addEventListener('dominion:preference-change',sync,true);
  const observer=new MutationObserver(sync);observer.observe(document.documentElement,{subtree:true,childList:true});
  ensureStyles();normalizeSettingsOnOpen();sync();void refreshAuth();
  window.DominionProfileSettingsNavigation2041=Object.freeze({version:'2.0.41',sync,openProfile,refresh:refreshAuth});
})();
