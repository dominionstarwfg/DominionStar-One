(()=>{
  if(window.DominionProfilePhotoFallback)return;
  const desktop=window.dominionDesktop||{};

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

  function localGalleryIdentityWanted(){
    const overlay=q('#meetingOverlay');if(!overlay||overlay.hidden)return false;
    const sharing=overlay.classList.contains('share-active')||document.body.classList.contains('remote-share-active');if(sharing)return false;
    const mode=String(overlay.dataset.viewMode||'');if(!['gallery','multi'].includes(mode))return false;
    return !Boolean(window.DominionPreferences?.read?.('hideSelfView'));
  }

  function syncDockCount(dock){
    if(!dock)return;
    const tiles=qa('#participantVideoDock .remote-peer-tile').filter(tile=>!tile.hidden&&!tile.classList.contains('stage-promoted')),count=tiles.length;
    dock.dataset.count=String(Math.min(count,9));dock.classList.toggle('dock-empty',count===0);dock.hidden=count===0;
    for(let i=1;i<=9;i++)dock.classList.toggle(`count-${i}`,Math.min(count,9)===i);
    if(count>0)dock.dataset.orientation='grid';
  }

  let localVisibilityObserver=null,observedTile=null,observedDock=null;
  function observeLocalVisibility(tile,dock){
    if(!tile||!dock||(observedTile===tile&&observedDock===dock))return;
    localVisibilityObserver?.disconnect();observedTile=tile;observedDock=dock;
    localVisibilityObserver=new MutationObserver(()=>schedulePaint());
    localVisibilityObserver.observe(tile,{attributes:true,attributeFilter:['hidden']});
    localVisibilityObserver.observe(dock,{attributes:true,attributeFilter:['hidden']});
  }

  function syncLocalGalleryIdentity(){
    const tile=q('#localVideoDockTile'),dock=q('#participantVideoDock');if(!tile||!dock)return;
    observeLocalVisibility(tile,dock);
    const overlay=q('#meetingOverlay'),mode=String(overlay?.dataset.viewMode||''),sharing=Boolean(overlay?.classList.contains('share-active')||document.body.classList.contains('remote-share-active'));
    if(sharing||!['gallery','multi'].includes(mode))return;
    const hideSelf=Boolean(window.DominionPreferences?.read?.('hideSelfView'));
    if(hideSelf){if(!tile.hidden)tile.hidden=true;syncDockCount(dock);return;}

    const snapshot=window.DominionMediaController?.snapshot?.()||{},stream=window.DominionMediaController?.stream?.()||null;
    const live=Boolean(snapshot.videoLive&&stream?.getVideoTracks?.().some(track=>track.readyState==='live'));
    const video=tile.querySelector('video'),fallback=tile.querySelector('.remote-peer-fallback');
    if(tile.hidden)tile.hidden=false;
    if(live){
      if(video){if(video.srcObject!==stream)video.srcObject=stream;video.hidden=false;void video.play().catch(()=>{});}
      if(fallback)fallback.hidden=true;
    }else{
      if(video){if(video.srcObject)video.srcObject=null;video.hidden=true;}
      if(fallback)fallback.hidden=false;
    }
    syncDockCount(dock);
  }

  function paintLocal(){
    const user=state.user||{},name=String(user.name||'DominionStar Member'),avatarUrl=safePhotoUrl(user.avatarUrl),label=initials(name);
    setBoxPhoto(q('#prejoinAvatar'),avatarUrl,label,{refreshLocal:true});
    setBoxPhoto(q('#stageAvatar'),avatarUrl,label,{refreshLocal:true});
    const localDock=q('#localVideoDockTile .remote-peer-fallback');if(localDock)setTilePhoto(localDock,avatarUrl,label,{refreshLocal:true});
    syncLocalGalleryIdentity();
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
    state.participants=new Map((snapshot.participants||[]).filter(item=>item?.participantId).map(item=>[String(item.participantId),item]));paintParticipants();schedulePaint();
  }
  function acceptWaiting(items=[]){state.waiting=new Map((items||[]).filter(item=>item?.participantId).map(item=>[String(item.participantId),item]));paintParticipants();}
  function resetMeeting(){state.participants.clear();state.waiting.clear();localVisibilityObserver?.disconnect();localVisibilityObserver=null;observedTile=null;observedDock=null;paintParticipants();}

  desktop.auth?.onChanged?.(authState=>{state.user=authState?.signedIn?authState.user:null;state.authRefreshAt=Date.now();paintLocal();});
  window.addEventListener('dominion:meeting-snapshot',event=>acceptSnapshot(event.detail||{}));
  window.addEventListener('dominion:waiting-room-update',event=>acceptWaiting(event.detail?.items||[]));
  window.addEventListener('dominion:meeting-ended',resetMeeting);
  window.addEventListener('dominion:preference-change',()=>schedulePaint());
  window.addEventListener('dominion:host-view-layout',()=>schedulePaint());

  // Dynamic meeting surfaces (remote tiles, roster rows, waiting-room rows and
  // the local floating dock) are created after this module loads. Repaint them
  // on a bounded timer instead of a microtask. A MutationObserver that queues a
  // DOM-mutating paintAll() microtask can feed itself indefinitely and starve
  // Electron's renderer/CDP event loop.
  let repaintTimer=0;
  function schedulePaint(){
    if(repaintTimer)return;
    repaintTimer=window.setTimeout(()=>{repaintTimer=0;paintAll();},32);
  }
  const observer=new MutationObserver(schedulePaint);
  observer.observe(document.body,{subtree:true,childList:true});
  window.DominionMediaController?.onChange?.(schedulePaint);

  const api=Object.freeze({
    refresh:()=>refreshAuth(true),
    state:()=>({user:state.user,participants:[...state.participants.values()],waiting:[...state.waiting.values()]}),
    applyForTesting:({user=null,participants=[],waiting=[]}={})=>{state.user=user;acceptSnapshot({participants});acceptWaiting(waiting);paintAll();return true;},
    syncLocalGalleryIdentity
  });
  window.DominionProfilePhotoFallback=api;
  ensureStyles();void refreshAuth(true);paintAll();
})();
