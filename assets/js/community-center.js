(async()=>{
  const gate=document.getElementById('communityCenterGate');
  const app=document.getElementById('communityCenterApp');
  if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return;}
  const client=await window.DSAuth.init();
  const auth=await client.auth.getSession();
  const session=auth.data.session;
  if(!session){location.href='/member-login/';return;}
  const profile=await client.from('member_profiles').select('verification_status').eq('id',session.user.id).single();
  if(profile.error||profile.data?.verification_status!=='approved'){gate.innerHTML='<h1>Founder approval is required.</h1>';return;}
  gate.classList.add('member-hidden');app.classList.remove('member-hidden');
  await client.rpc('community_set_presence',{area:'community-center',online:true});
  async function countOnline(){
    const threshold=new Date(Date.now()-120000).toISOString();
    const r=await client.from('community_presence').select('user_id',{count:'exact',head:true}).eq('is_online',true).gte('last_seen_at',threshold);
    document.getElementById('communityOnlineCount').textContent=r.error?'—':String(r.count||0);
  }
  await countOnline();
  const pulse=setInterval(async()=>{await client.rpc('community_set_presence',{area:'community-center',online:true});await countOnline();},45000);
  document.getElementById('communityCenterLogout').addEventListener('click',()=>window.DSAuth.signOut());
  addEventListener('beforeunload',()=>{clearInterval(pulse);client.rpc('community_set_presence',{area:'community-center',online:false});});
})();
