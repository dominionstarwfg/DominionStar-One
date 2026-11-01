(async()=>{
  'use strict';

  const gate=document.getElementById('feedGate');
  const app=document.getElementById('feedApp');
  const form=document.getElementById('feedPageComposer');
  const body=document.getElementById('feedComposerBody');
  const publish=document.getElementById('feedComposerPublish');
  const statusNode=document.getElementById('feedComposerStatus');
  const stream=document.getElementById('feedPageStream');
  const refresh=document.getElementById('feedRefresh');

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'
  }[char]));

  const initials=value=>String(value||'DS').trim().split(/\s+/).filter(Boolean).slice(0,2)
    .map(part=>part.charAt(0)).join('').toUpperCase()||'DS';

  const showStatus=(message,type='')=>{
    if(!statusNode)return;
    statusNode.textContent=message;
    statusNode.dataset.state=type;
  };

  if(!window.DSAuth?.ready){
    gate.innerHTML='<p class="eyebrow">Unavailable</p><h1>Authentication configuration is missing.</h1>';
    return;
  }

  let client;
  try{client=await window.DSAuth.init();}
  catch(_error){
    gate.innerHTML='<p class="eyebrow">Unavailable</p><h1>Unable to verify your DominionStar session.</h1>';
    return;
  }

  const session=(await client.auth.getSession()).data?.session;
  if(!session?.user?.id){location.href='/member-login/';return;}

  const profileResult=await client.from('member_profiles')
    .select('id,full_name,preferred_name,rank,founding_member,exclusive_member_number,verification_status,avatar_path')
    .eq('id',session.user.id).maybeSingle();

  const profile=profileResult.data;
  if(profileResult.error||profile?.verification_status!=='approved'){
    gate.innerHTML='<p class="eyebrow">Founder Approval Required</p><h1>Feed access is available to approved members.</h1>';
    return;
  }

  const fullName=String(profile.full_name||profile.preferred_name||session.user.email||'DominionStar Member').trim();
  document.getElementById('feedPageName').textContent=fullName;
  document.getElementById('feedPageRank').textContent='Contract Level: '+String(profile.rank||'—');
  const initialsNode=document.getElementById('feedPageInitials');
  const photoNode=document.getElementById('feedPageAvatar');
  if(initialsNode)initialsNode.textContent=initials(fullName);

  const foundingNode=document.getElementById('feedPageFounding');
  if(foundingNode){
    const number=Number(profile.exclusive_member_number);
    const founding=profile.founding_member===true;
    foundingNode.textContent=founding
      ? (Number.isInteger(number)&&number>=1&&number<=20
          ? 'Founding Member #'+String(number).padStart(2,'0')
          : 'Founding Member')
      : '';
    foundingNode.classList.toggle('member-hidden',!founding);
  }

  if(photoNode&&profile.avatar_path){
    Promise.resolve()
      .then(()=>client.storage.from('member-avatars').createSignedUrl(profile.avatar_path,3600))
      .then(result=>{
        if(result.error||!result.data?.signedUrl)return;
        photoNode.onerror=()=>{
          photoNode.classList.add('member-hidden');
          photoNode.removeAttribute('src');
          initialsNode?.classList.remove('member-hidden');
        };
        photoNode.onload=()=>{
          photoNode.classList.remove('member-hidden');
          initialsNode?.classList.add('member-hidden');
        };
        photoNode.src=result.data.signedUrl;
      })
      .catch(()=>{ /* Initials stay visible when Storage is unavailable. */ });
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  const mountFeed=async()=>{
    if(!window.DSDashboardSocial?.mount)throw new Error('Social feed module is unavailable.');
    if(stream.__ds30Controller?.refresh){
      await stream.__ds30Controller.refresh();
      return;
    }
    await window.DSDashboardSocial.mount({
      client,
      memberId:session.user.id,
      target:stream
    });
  };

  try{await mountFeed();}
  catch(error){
    stream.innerHTML='<div class="dashboard-empty-compact dashboard-load-error"><strong>Feed could not load.</strong><p>'+
      esc(error?.message||'Unknown error')+'</p></div>';
  }

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const text=body?.value.trim()||'';
    if(!text){
      showStatus('Write something before posting.','error');
      body?.focus();
      return;
    }
    if(!publish)return;

    publish.disabled=true;
    publish.textContent='Posting…';
    showStatus('Publishing to your network…','pending');

    try{
      const insert=await client.from('community_messages').insert({
        user_id:session.user.id,
        title:null,
        body:text.slice(0,2000),
        post_type:'discussion',
        is_pinned:false
      }).select('id').single();
      if(insert.error)throw insert.error;

      const mention=await client.rpc('community_notify_mentions',{
        target_message_id:insert.data.id,
        message_body:text.slice(0,2000)
      });
      if(mention.error && !['PGRST202','42883'].includes(String(mention.error.code||''))){
        console.warn('Mention notification could not complete:',mention.error);
      }

      body.value='';
      await mountFeed();
      showStatus('Posted to your Feed.','success');
    }catch(error){
      showStatus(error?.message||'Your post could not be published.','error');
    }finally{
      publish.disabled=false;
      publish.textContent='Post to Feed';
    }
  });

  refresh?.addEventListener('click',async()=>{
    refresh.disabled=true;
    try{await mountFeed();showStatus('Feed refreshed.','success');}
    catch(error){showStatus(error?.message||'Feed refresh failed.','error');}
    finally{refresh.disabled=false;}
  });
})();