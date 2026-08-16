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
  async function load(){
    const [m,p]=await Promise.all([
      client.from('member_profiles').select('id,full_name,preferred_name,rank,agent_code,city,state,avatar_path,exclusive_member_number').eq('verification_status','approved').order('full_name'),
      client.from('community_presence').select('user_id,is_online,last_seen_at')
    ]);
    if(m.error){grid.innerHTML=`<p>${esc(m.error.message)}</p>`;return;}
    members=m.data||[];presence=Object.fromEntries((p.data||[]).map(x=>[x.user_id,x]));render();
  }
  async function avatar(path){if(!path)return null;const r=await client.storage.from('member-avatars').createSignedUrl(path,3600);return r.data?.signedUrl||null;}
  async function render(){
    const q=document.getElementById('directorySearch').value.trim().toLowerCase();
    const rank=document.getElementById('directoryRank').value;
    const filtered=members.filter(m=>{const hay=[m.full_name,m.preferred_name,m.rank,m.agent_code,m.city,m.state].filter(Boolean).join(' ').toLowerCase();return(!q||hay.includes(q))&&(!rank||m.rank===rank);});
    const cards=await Promise.all(filtered.map(async m=>{
      const pic=await avatar(m.avatar_path);const active=presence[m.id]&&Date.now()-new Date(presence[m.id].last_seen_at).getTime()<120000;
      return `<article class="member-directory-card">
        <div class="member-directory-avatar">${pic?`<img src="${pic}" alt="">`:esc((m.preferred_name||m.full_name||'M').slice(0,1))}<span class="${active?'online':'offline'}"></span></div>
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
    grid.querySelectorAll('.connect-member').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const r=await client.from('member_connections').insert({requester_id:session.user.id,recipient_id:b.dataset.id});b.textContent=r.error?(r.error.code==='23505'?'Requested':'Unable'):'Requested';}));
  }
  document.getElementById('directorySearch').addEventListener('input',render);
  document.getElementById('directoryRank').addEventListener('change',render);
  await client.rpc('community_set_presence',{area:'member-directory',online:true});await load();
})();
