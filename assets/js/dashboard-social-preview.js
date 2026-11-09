(async()=>{
  'use strict';

  const form=document.getElementById('dashboardComposerForm');
  const body=document.getElementById('dashboardComposerBody');
  const publish=document.getElementById('dashboardComposerPublish');
  const status=document.getElementById('dashboardComposerStatus');
  const target=document.getElementById('dashboardSocialPreview');
  const avatar=document.getElementById('dashboardComposerAvatar');
  const initialsNode=document.getElementById('dashboardComposerInitials');

  if(!form||!body||!publish||!target||!window.DSAuth?.ready||!window.DSDashboardSocial?.mount)return;

  const initials=value=>String(value||'DS').trim().split(/\s+/).filter(Boolean).slice(0,2)
    .map(part=>part.charAt(0)).join('').toUpperCase()||'DS';

  const setStatus=(message,state='')=>{
    if(!status)return;
    status.textContent=message;
    status.dataset.state=state;
  };

  let client;
  try{client=await window.DSAuth.init();}catch{return;}
  const session=(await client.auth.getSession()).data?.session;
  if(!session?.user?.id)return;

  const profileResult=await client.from('member_profiles')
    .select('full_name,preferred_name,verification_status,avatar_path')
    .eq('id',session.user.id).maybeSingle();
  const profile=profileResult.data;
  if(profileResult.error||profile?.verification_status!=='approved')return;

  const displayName=profile.preferred_name||profile.full_name||'DominionStar Member';
  if(initialsNode)initialsNode.textContent=initials(displayName);

  if(avatar&&profile.avatar_path){
    try{
      const signed=await client.storage.from('member-avatars').createSignedUrl(profile.avatar_path,3600);
      if(!signed.error&&signed.data?.signedUrl){
        avatar.onerror=()=>{
          avatar.classList.add('member-hidden');
          avatar.removeAttribute('src');
          initialsNode?.classList.remove('member-hidden');
        };
        avatar.onload=()=>{
          avatar.classList.remove('member-hidden');
          initialsNode?.classList.add('member-hidden');
        };
        avatar.src=signed.data.signedUrl;
      }
    }catch{ /* Initials stay visible. */ }
  }

  const refresh=async()=>{
    await window.DSDashboardSocial.mount({
      client,
      memberId:session.user.id,
      target,
      resultLimit:1
    });
  };

  try{await refresh();}
  catch(_error){
    target.innerHTML='<div class="dashboard-empty-compact"><strong>Network preview unavailable.</strong><p>Open Feed to continue.</p><a href="/feed/">Open Feed →</a></div>';
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const text=body.value.trim();
    if(!text){setStatus('Write something before posting.','error');body.focus();return;}

    publish.disabled=true;
    publish.textContent='Posting…';
    setStatus('Publishing…','pending');

    try{
      const inserted=await client.from('community_messages').insert({
        user_id:session.user.id,
        title:null,
        body:text.slice(0,2000),
        post_type:'discussion',
        is_pinned:false
      }).select('id').single();
      if(inserted.error)throw inserted.error;

      // Community mention/reply delivery is triggered by the verified
      // saved source row in Supabase after the coordinated SQL cutover.
      // Do not call the revoked, caller-body RPC from the browser.

      body.value='';
      await target.__ds30Controller?.refresh?.();
      setStatus('Posted to your network.','success');
    }catch(error){
      setStatus(error?.message||'Your post could not be published.','error');
    }finally{
      publish.disabled=false;
      publish.innerHTML='➤ <span>Post</span>';
    }
  });
})();