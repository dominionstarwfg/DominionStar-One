/* Recognition review: strictly approved-member Community announcements, no fabricated awards.
   Server/RLS is the authority for announcements; this UI is not an immutable ledger. */
(async()=>{
  'use strict';
  const gate=document.getElementById('recognitionGate'),app=document.getElementById('recognitionApp');
  const feed=document.getElementById('recognitionFeed'),refresh=document.getElementById('recognitionRefresh');
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  if(!window.DSAuth?.ready){gate.textContent='Authentication configuration is unavailable.';return;}
  let client,session;
  try{
    client=await window.DSAuth.init();
    const auth=await client.auth.getSession();session=auth.data?.session;
    if(!session){location.replace('/member-login/');return;}
    const result=await client.from('member_profiles').select('verification_status').eq('id',session.user.id).single();
    if(result.error||result.data?.verification_status!=='approved'){
      gate.textContent='Recognition is available to approved DominionStar members.';return;
    }
  }catch{gate.textContent='Could not verify membership. Please refresh or sign in again.';return;}
  gate.classList.add('member-hidden');app.classList.remove('member-hidden');
  const load=async()=>{
    refresh.disabled=true;feed.textContent='Loading recognition announcements…';
    try{
      const result=await client.rpc('list_community_feed',{result_limit:100});
      if(result.error)throw result.error;
      const posts=(Array.isArray(result.data)?result.data:[])
        .filter(p=>p && p.post_type==='announcement' && typeof p.title==='string' && p.title.startsWith('Leadership Recognition · '))
        .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      if(!posts.length){
        feed.innerHTML='<div class="recognition-post"><h3>No community recognitions published yet</h3><p>Founder-selected advancement announcements will appear here after they are published.</p></div>';
        return;
      }
      feed.innerHTML=posts.map(post=>{
        const url='/community/?post='+encodeURIComponent(post.id);
        const when=new Date(post.created_at);
        const date=Number.isFinite(when.getTime())?when.toLocaleDateString():'Date unavailable';
        return '<article class="recognition-post"><span class="eyebrow">Community Recognition</span><h3>'+esc(post.title)+'</h3><p>'+esc(post.body||'')+'</p><span class="recognition-date">'+esc(date)+'</span><a href="'+esc(url)+'">Open original post</a></article>';
      }).join('');
    }catch(error){feed.textContent='Recognition announcements are unavailable. '+(error?.message||'Please try again.');}
    finally{refresh.disabled=false;}
  };
  refresh.addEventListener('click',load);
  await load();
})();