(async()=>{
  const gate=document.getElementById('directoryGate'),app=document.getElementById('directoryApp'),grid=document.getElementById('directoryGrid');
  let client,session,members=[],presence={};
  // Preserve request progress when presence or signed-photo updates rerender cards.
  const connectStates=new Map();
  const publicDirectoryV2=window.DOMINIONSTAR_AGENT_DATA_FEATURES?.publicMemberProfilesV2===true;
  const directoryTable='member_public_profiles';
  const directoryFields='id,full_name,preferred_name,rank,city,state,avatar_path,exclusive_member_number,verification_status';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return;}
  client=await window.DSAuth.init();session=(await client.auth.getSession()).data.session;
  if(!session){location.href='/member-login/';return;}
  const own=await client.from('member_profiles').select('verification_status').eq('id',session.user.id).single();
  if(own.error||own.data?.verification_status!=='approved'){gate.innerHTML='<h1>Founder approval is required.</h1>';return;}
  if(!publicDirectoryV2){
    gate.innerHTML='<h1>Member Directory temporarily unavailable</h1><p>Privacy-protected member listings require the approved directory release.</p><a class="btn btn-outline" href="/member-dashboard/">Return to Dashboard</a>';
    return;
  }
  gate.classList.add('member-hidden');app.classList.remove('member-hidden');
  const timeout=(promise,ms=12000)=>Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('The directory request took too long.')),ms))
  ]);
  const showError=message=>{
    grid.innerHTML='<div class="dsx-directory-feedback" role="alert"><strong>Member Directory unavailable</strong><p>'+esc(message||'Unable to load approved members.')+'</p><button type="button" id="directoryRetry">Retry loading members</button></div>';
    document.getElementById('directoryRetry')?.addEventListener('click',load,{once:true});
  };
  async function load(){
    grid.innerHTML='<div class="dsx-directory-feedback" role="status"><strong>Loading approved members…</strong><p>Connecting to the secure directory.</p></div>';
    try{
      const m=await timeout(client.from(directoryTable).select(directoryFields).eq('verification_status','approved').order('full_name'));
      if(m.error)throw new Error(m.error.message||'Could not load member profiles.');
      members=m.data||[];
      render();
      // Presence is optional: its availability must not block the approved directory.
      Promise.resolve(client.from('community_presence').select('user_id,is_online,last_seen_at'))
        .then(p=>{if(!p.error){presence=Object.fromEntries((p.data||[]).map(x=>[x.user_id,x]));render();}})
        .catch(()=>{});
    }catch(error){showError(error.message);}
  }
  const avatarCache=new Map(),avatarRequests=new Map();
  async function avatar(path){
    if(!path)return null;
    const cached=avatarCache.get(path);
    if(cached&&cached.expiresAt>Date.now())return cached.url;
    if(avatarRequests.has(path))return avatarRequests.get(path);
    const request=(async()=>{
      try{
        const r=await timeout(client.storage.from('member-avatars').createSignedUrl(path,3600),5000);
        const url=r.error?null:(r.data?.signedUrl||null);
        if(url)avatarCache.set(path,{url,expiresAt:Date.now()+55*60*1000});
        return url;
      }catch{return null;}
    })().finally(()=>avatarRequests.delete(path));
    avatarRequests.set(path,request);
    return request;
  }
  const initials=name=>String(name||'M').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'M';
  const wireAvatarFallbacks=root=>{
    root?.querySelectorAll?.('img.member-directory-photo').forEach(image=>{
      image.addEventListener('error',()=>image.remove(),{once:true});
    });
  };
  let renderVersion=0;
  function render(){
    const version=++renderVersion;
    const q=document.getElementById('directorySearch').value.trim().toLowerCase();
    const rank=document.getElementById('directoryRank').value;
    const filtered=members.filter(m=>m.id!==session.user.id).filter(m=>{
      const hay=[m.full_name,m.preferred_name,m.rank,null,m.city,m.state].filter(Boolean).join(' ').toLowerCase();
      return(!q||hay.includes(q))&&(!rank||m.rank===rank);
    });
    // Render names, initials and actions immediately; signed profile photos are optional.
    const cards=filtered.map(m=>{
      const active=presence[m.id]&&Date.now()-new Date(presence[m.id].last_seen_at).getTime()<120000;
      const memberName=m.preferred_name||m.full_name||'Member';
      const connectState=connectStates.get(m.id)||'idle';
      const connectLabel=connectState==='sending'?'Sending…'
        :connectState==='sent'?'Requested'
        :connectState==='exists'?'Connection exists'
        :connectState==='failed'?'Retry Connect':'Connect';
      return `<article class="member-directory-card" data-member-id="${esc(m.id)}">
        <div class="member-directory-avatar"><span class="member-directory-fallback" aria-hidden="true">${esc(initials(memberName))}</span><span class="${active?'online':'offline'}"></span></div>
        <h2>${esc(memberName)}</h2>
        <p>${esc(m.rank||'TA')}${m.exclusive_member_number?` · Exclusive #${m.exclusive_member_number}`:''}</p>
        <small>${esc([m.city,m.state].filter(Boolean).join(', ')||'Location not listed')}</small>
        <div class="member-directory-actions">
          <a class="btn btn-outline" href="/direct-messages/?member=${encodeURIComponent(m.id)}">Message</a>
          <button class="btn btn-outline connect-member" data-id="${esc(m.id)}" type="button" ${connectState==='sending'||connectState==='sent'||connectState==='exists'?'disabled':''}>${connectLabel}</button>
        </div>
      </article>`;
    });
    grid.innerHTML=cards.length?cards.join(''):'<div class="member-empty-state"><h2>No members found.</h2></div>';
    // Maintain the original fallback initializer for any already-present photos.
    wireAvatarFallbacks(grid);
    grid.querySelectorAll('.connect-member').forEach(b=>b.addEventListener('click',async()=>{
      const recipient=b.dataset.id;
      if(!recipient||recipient===session.user.id||connectStates.get(recipient)==='sending')return;
      connectStates.set(recipient,'sending');
      render();
      try{
        // Explicit pending state is mandatory in the hardened connection RLS.
        const r=await timeout(client.from('member_connections').insert({
          requester_id:session.user.id,recipient_id:recipient,status:'pending'
        }),12000);
        if(r.error&&r.error.code!=='23505')throw r.error;
        connectStates.set(recipient,r.error?'exists':'sent');
      }catch(_error){
        // A denied/offline request is recoverable, never a permanently dead button.
        connectStates.set(recipient,'failed');
      }
      render();
    }));
    // Ignore responses from a previous search, rank filter or presence refresh.
    filtered.filter(m=>m.avatar_path).forEach(m=>{
      void avatar(m.avatar_path).then(url=>{
        if(!url||version!==renderVersion)return;
        const card=Array.from(grid.querySelectorAll('.member-directory-card'))
          .find(node=>node.dataset.memberId===String(m.id));
        const frame=card?.querySelector('.member-directory-avatar');
        if(!frame||frame.querySelector('img'))return;
        const name=m.preferred_name||m.full_name||'Member';
        frame.insertAdjacentHTML('beforeend',`<img class="member-directory-photo" src="${esc(url)}" alt="${esc(name)}">`);
        wireAvatarFallbacks(frame);
      });
    });
  }
  document.getElementById('directorySearch').addEventListener('input',render);
  document.getElementById('directoryRank').addEventListener('change',render);
  await load();
  // Presence is best-effort and must never hold the directory in a loading state.
  Promise.resolve(client.rpc('community_set_presence',{area:'member-directory',online:true})).catch(()=>{});

})();
