(()=>{
  if(window.DominionProfilePhotoFallback)return;
  const desktop=window.dominionDesktop||{};
  if(!desktop.isDesktop)return;

  const state={user:null,participants:new Map(),waiting:new Map(),authRefreshAt:0};
  const initials=value=>String(value||'DominionStar Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'DS';
  const safePhotoUrl=value=>{const url=String(value||'').trim();return /^https:\/\//i.test(url)?url:'';};
  const q=selector=>document.querySelector(selector),qa=selector=>[...document.querySelectorAll(selector)];

  function ensureStyles(){
    if(document.querySelector('style[data-ds-profile-photo-fallback]'))return;
    const style=document.createElement('style');style.dataset.dsProfilePhotoFallback='1';style.textContent=`
      .ds-profile-fallback-photo{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit}
      .remote-peer-fallback.has-photo{background:radial-gradient(circle at 50% 35%,#1d3045,#0b1420)!important;padding:0!important}
      .remote-peer-fallback .ds-profile-fallback-photo{position:relative;width:58px;height:58px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px rgba(255,255,255,.18),0 8px 24px rgba(0,0,0,.3);z-index:1}
      .remote-peer-fallback .ds-profile-fallback-photo[hidden]{display:none}
      .remote-peer-fallback.has-photo>span{display:none!important}
      .person-badge .ds-profile-fallback-photo,.preview-avatar .ds-profile-fallback-photo,.stage-avatar .ds-profile-fallback-photo{width:100%;height:100%;border-radius:inherit;object-fit:cover}
    `;document.head.append(style);
  }

  function setBoxPhoto(box,url,fallbackText,{refreshLocal=false}={}){
    if(!box)return;
    const photoUrl=safePhotoUrl(url),fallback=String(fallbackText||'DS');
    let img=box.querySelector(':scope > img.ds-profile-fallback-photo');
    if(!photoUrl){if(img)img.remove();box.classList.remove('has-photo');if(box.textContent!==fallback)box.textContent=fallback;box.dataset.dsAvatarUrl='';return;}
    if(img&&box.dataset.dsAvatarUrl===photoUrl){box.classList.add('has-photo');return;}
    box.textContent='';img=document.createElement('img');img.className='ds-profile-fallback-photo';img.alt='';img.referrerPolicy='no-referrer';img.src=photoUrl;box.dataset.dsAvatarUrl=photoUrl;box.classList.add('has-photo');
    img.onerror=()=>{if(img.parentElement===box)img.remove();box.classList.remove('has-photo');box.dataset.dsAvatarUrl='';box.textContent=fallback;if(refreshLocal)void refreshAuth(true);};
    box.append(img);
  }

  function setTilePhoto(fallback,url,fallbackText,{refreshLocal=false}={}){
    if(!fallback)return;
    const photoUrl=safePhotoUrl(url),label=String(fallbackText||'DS');
    let span=fallback.querySelector(':scope > span');if(!span){span=document.createElement('span');fallback.append(span);}span.textContent=label;
    let img=fallback.querySelector(':scope > img.ds-profile-fallback-photo');
    if(!photoUrl){img?.remove();fallback.classList.remove('has-photo');fallback.dataset.dsAvatarUrl='';span.hidden=false;return;}
    if(!img){img=document.createElement('img');img.className='ds-profile-fallback-photo';img.alt='';img.referrerPolicy='no-referrer';fallback.prepend(img);}
    if(fallback.dataset.dsAvatarUrl!==photoUrl){img.src=photoUrl;fallback.dataset.dsAvatarUrl=photoUrl;}
    fallback.classList.add('has-photo');img.hidden=false;span.hidden=true;
    img.onerror=()=>{img.hidden=true;fallback.classList.remove('has-photo');fallback.dataset.dsAvatarUrl='';span.hidden=false;if(refreshLocal)void refreshAuth(true);};
  }

  function paintLocal(){
    const user=state.user||{},name=String(user.name||'DominionStar Member'),avatarUrl=safePhotoUrl(user.avatarUrl),label=initials(name);
    setBoxPhoto(q('#prejoinAvatar'),avatarUrl,label,{refreshLocal:true});
    setBoxPhoto(q('#stageAvatar'),avatarUrl,label,{refreshLocal:true});
    const localDock=q('#localVideoDockTile .remote-peer-fallback');if(localDock)setTilePhoto(localDock,avatarUrl,label,{refreshLocal:true});
  }

  function paintParticipants(){
    for(const tile of qa('.remote-peer-tile[data-peer-id]')){
      const id=String(tile.dataset.peerId||''),person=state.participants.get(id);if(!person)continue;
      setTilePhoto(tile.querySelector('.remote-peer-fallback'),person.avatarUrl,initials(person.displayName));
    }
    for(const row of qa('[data-participant-id]')){
      const id=String(row.dataset.participantId||''),person=state.participants.get(id);if(!person)continue;
      setBoxPhoto(row.querySelector('.person-badge'),person.avatarUrl,initials(person.displayName));
    }
    for(const row of qa('[data-wait]')){
      const id=String(row.dataset.wait||''),person=state.waiting.get(id);if(!person)continue;
      setBoxPhoto(row.querySelector('.person-badge'),person.avatarUrl,initials(person.displayName));
    }
  }

  function paintAll(){ensureStyles();paintLocal();paintParticipants();}

  async function refreshAuth(force=false){
    const now=Date.now();if(!force&&now-state.authRefreshAt<5000)return state.user;
    state.authRefreshAt=now;
    try{const authState=await desktop.auth?.getState?.();state.user=authState?.signedIn?authState.user:null;paintLocal();return state.user;}catch{return state.user;}
  }

  function acceptSnapshot(snapshot={}){
    state.participants=new Map((snapshot.participants||[]).filter(item=>item?.participantId).map(item=>[String(item.participantId),item]));paintParticipants();
  }
  function acceptWaiting(items=[]){state.waiting=new Map((items||[]).filter(item=>item?.participantId).map(item=>[String(item.participantId),item]));paintParticipants();}
  function resetMeeting(){state.participants.clear();state.waiting.clear();paintParticipants();}

  desktop.auth?.onChanged?.(authState=>{state.user=authState?.signedIn?authState.user:null;state.authRefreshAt=Date.now();paintLocal();});
  window.addEventListener('dominion:meeting-snapshot',event=>acceptSnapshot(event.detail||{}));
  window.addEventListener('dominion:waiting-room-update',event=>acceptWaiting(event.detail?.items||[]));
  window.addEventListener('dominion:meeting-ended',resetMeeting);

  const observer=new MutationObserver(()=>queueMicrotask(paintAll));
  observer.observe(document.body,{subtree:true,childList:true});

  const api=Object.freeze({
    refresh:()=>refreshAuth(true),
    state:()=>({user:state.user,participants:[...state.participants.values()],waiting:[...state.waiting.values()]}),
    applyForTesting:({user=null,participants=[],waiting=[]}={})=>{state.user=user;acceptSnapshot({participants});acceptWaiting(waiting);paintAll();return true;}
  });
  window.DominionProfilePhotoFallback=api;
  ensureStyles();void refreshAuth(true);paintAll();
})();
