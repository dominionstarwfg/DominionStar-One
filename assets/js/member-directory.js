(async()=>{
  const gate=document.getElementById('directoryGate'),app=document.getElementById('directoryApp'),grid=document.getElementById('directoryGrid');
  let client,session,members=[],presence={};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return;}
  client=await window.DSAuth.init();session=(await client.auth.getSession()).data.session;
  if(!session){location.href='/member-login/';return;}
  const own=await client.from('member_profiles').select('verification_status').eq('id',session.user.id).single();
  if(own.error||own.data?.verification_status!=='approved'){gate.innerHTML='<h1>Founder approval is required.</h1>';return;}
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
      const m=await timeout(client.from('member_profiles').select('id,full_name,preferred_name,rank,agent_code,city,state,avatar_path,exclusive_member_number').eq('verification_status','approved').order('full_name'));
      if(m.error)throw new Error(m.error.message||'Could not load member profiles.');
      members=m.data||[];
      render();
      // Presence is optional: its availability must not block the approved directory.
      Promise.resolve(client.from('community_presence').select('user_id,is_online,last_seen_at'))
        .then(p=>{if(!p.error){presence=Object.fromEntries((p.data||[]).map(x=>[x.user_id,x]));render();}})
        .catch(()=>{});
    }catch(error){showError(error.message);}
  }
  async function avatar(path){
    if(!path)return null;
    try{
      const r=await timeout(client.storage.from('member-avatars').createSignedUrl(path,3600),5000);
      return r.error?null:(r.data?.signedUrl||null);
    }catch{return null;}
  }
  const initials=name=>String(name||'M').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'M';
  const wireAvatarFallbacks=root=>{
    root?.querySelectorAll?.('img.member-directory-photo').forEach(image=>{
      image.addEventListener('error',()=>image.remove(),{once:true});
    });
  };
  async function render(){
    const q=document.getElementById('directorySearch').value.trim().toLowerCase();
    const rank=document.getElementById('directoryRank').value;
    const filtered=members.filter(m=>{const hay=[m.full_name,m.preferred_name,m.rank,m.agent_code,m.city,m.state].filter(Boolean).join(' ').toLowerCase();return(!q||hay.includes(q))&&(!rank||m.rank===rank);});
    const cards=await Promise.all(filtered.map(async m=>{
      const pic=await avatar(m.avatar_path);const active=presence[m.id]&&Date.now()-new Date(presence[m.id].last_seen_at).getTime()<120000;
      const memberName=m.preferred_name||m.full_name||'Member';
      return `<article class="member-directory-card">
        <div class="member-directory-avatar"><span class="member-directory-fallback" aria-hidden="true">${esc(initials(memberName))}</span>${pic?`<img class="member-directory-photo" src="${esc(pic)}" alt="${esc(memberName)}">`:''}<span class="${active?'online':'offline'}"></span></div>
        <h2>${esc(m.preferred_name||m.full_name||'Member')}</h2>
        <p>${esc(m.rank||'TA')}${m.exclusive_member_number?` · Exclusive #${m.exclusive_member_number}`:''}</p>
        <small>${esc([m.city,m.state].filter(Boolean).join(', ')||'Location not listed')}</small>
        <div class="member-directory-actions">
          <a class="btn btn-outline" href="/direct-messages/?member=${encodeURIComponent(m.id)}">Message</a>
          <button class="btn btn-outline connect-member" data-id="${m.id}" type="button">Connect</button>
        </div>
      </article>`;
    }));
    grid.innerHTML=cards.length?cards.join(''):'<div class="member-empty-state"><h2>No members found.</h2></div>';
    wireAvatarFallbacks(grid);
    grid.querySelectorAll('.connect-member').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const r=await client.from('member_connections').insert({requester_id:session.user.id,recipient_id:b.dataset.id});b.textContent=r.error?(r.error.code==='23505'?'Requested':'Unable'):'Requested';}));
  }
  document.getElementById('directorySearch').addEventListener('input',render);
  document.getElementById('directoryRank').addEventListener('change',render);
  await load();
  // Presence is best-effort and must never hold the directory in a loading state.
  Promise.resolve(client.rpc('community_set_presence',{area:'member-directory',online:true})).catch(()=>{});

})();
