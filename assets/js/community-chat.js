(async () => {
  const gate=document.getElementById('chatGate');
  const app=document.getElementById('chatApp');
  const list=document.getElementById('chatMessageList');
  const form=document.getElementById('chatComposer');
  const result=document.getElementById('chatResult');
  const statusEl=document.getElementById('chatConnectionStatus');
  const unread=document.getElementById('chatUnreadBadge');
  const emailPref=document.getElementById('chatEmailPreference');

  let client,session,profile,channel,pollTimer,reconnectTimer,typingTimer;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  const setStatus=(text,type='connecting')=>{
    statusEl.textContent=text;
    statusEl.className=`community-${type}`;
  };

  if(!window.DSAuth?.ready){
    gate.innerHTML='<h1>Authentication configuration is missing.</h1>';
    return;
  }

  client=await window.DSAuth.init();
  const auth=await client.auth.getSession();
  session=auth.data.session;
  if(!session){location.href='/member-login/';return;}

  const p=await client.from('member_profiles')
    .select('id,full_name,preferred_name,email,rank,exclusive_member_number,verification_status,avatar_path')
    .eq('id',session.user.id).single();
  profile=p.data;

  if(p.error||profile?.verification_status!=='approved'){
    gate.innerHTML='<h1>Founder approval is required for Community Chat.</h1>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');
  await client.rpc('community_set_presence',{area:'community-chat',online:true});

  async function fetchProfiles(ids){
    const unique=[...new Set(ids.filter(Boolean))];
    if(!unique.length)return {};
    const r=await client.from('member_profiles')
      .select('id,full_name,preferred_name,rank,exclusive_member_number,avatar_path')
      .in('id',unique);
    if(r.error)throw r.error;
    return Object.fromEntries((r.data||[]).map(item=>[item.id,item]));
  }

  async function signedAvatar(path){
    if(!path)return null;
    const r=await client.storage.from('member-avatars').createSignedUrl(path,3600);
    return r.data?.signedUrl||null;
  }

  async function loadMessages(scroll=true){
    try{
      const q=await client.rpc('list_community_chat',{result_limit:200});

      if(q.error)throw q.error;

      const messages=q.data||[];
      const profileMap=Object.fromEntries(messages.map(message=>[
        message.user_id,
        {
          id:message.user_id,
          full_name:message.author_full_name,
          preferred_name:message.author_preferred_name,
          rank:message.author_rank,
          exclusive_member_number:message.author_exclusive_number,
          avatar_path:message.author_avatar_path
        }
      ]));
      const paths=[...new Set(Object.values(profileMap).map(p=>p.avatar_path).filter(Boolean))];
      const avatarPairs=await Promise.all(paths.map(async path=>[path,await signedAvatar(path)]));
      const avatarMap=Object.fromEntries(avatarPairs);

      list.innerHTML=messages.length?messages.map(m=>{
        const author=profileMap[m.user_id]||{};
        const mine=m.user_id===session.user.id;
        const avatar=author.avatar_path?avatarMap[author.avatar_path]:null;
        const initial=(author.preferred_name||author.full_name||'M').slice(0,1);
        return `
        <article class="community-chat-message ${mine?'mine':''}">
          <div class="community-chat-avatar">${avatar?`<img src="${avatar}" alt="">`:esc(initial)}</div>
          <div class="community-chat-bubble">
            <header>
              <strong>${esc(author.preferred_name||author.full_name||'Member')}</strong>
              <span>${esc(author.rank||'TA')}</span>
              ${author.exclusive_member_number?`<span>#${author.exclusive_member_number}</span>`:''}
              <small>${new Date(m.created_at).toLocaleString()}</small>
            </header>
            <p>${esc(m.body)}</p>
          </div>
        </article>`;
      }).join(''):'<div class="member-empty-state"><h2>No chat messages yet.</h2><p>Start the conversation.</p></div>';

      if(scroll)list.scrollTop=list.scrollHeight;
      await client.rpc('community_chat_mark_seen');
      unread.classList.add('member-hidden');
      setStatus('Live','live');
    }catch(error){
      list.innerHTML=`<div class="community-error-state"><h2>Chat could not load.</h2><p>${esc(error.message||error)}</p></div>`;
      setStatus('Retry required','offline');
    }
  }

  async function connect(){
    if(channel)await client.removeChannel(channel);
    setStatus('Connecting…','connecting');

    channel=client.channel('dominionstar-chat-v64')
      .on('postgres_changes',{event:'*',schema:'public',table:'community_chat_messages'},()=>loadMessages(true))
      .on('postgres_changes',{event:'*',schema:'public',table:'community_typing'},async()=>{
        const t=await client.from('community_typing').select('user_id,is_typing,updated_at').eq('room_key','community').eq('is_typing',true).neq('user_id',session.user.id).gte('updated_at',new Date(Date.now()-5000).toISOString());
        const typingRows=t.data||[];
        const typingProfiles=await window.DSData.fetchProfiles(client,typingRows.map(x=>x.user_id),'id,full_name,preferred_name');
        const typingNames=typingRows.map(x=>typingProfiles[x.user_id]?.preferred_name||typingProfiles[x.user_id]?.full_name||'A member');
        document.getElementById('chatTypingStatus').textContent=typingNames.join(', ')+(typingNames.length?' is typing…':'');
      })
      .subscribe(state=>{
        if(state==='SUBSCRIBED'){
          setStatus('Live','live');
          clearInterval(pollTimer);
          pollTimer=setInterval(()=>loadMessages(false),30000);
        }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(state)){
          setStatus('Reconnecting…','offline');
          clearTimeout(reconnectTimer);
          reconnectTimer=setTimeout(connect,5000);
        }
      });
  }

  
  form.body.addEventListener('input',async()=>{
    await client.rpc('community_set_typing',{target_room:'community',typing:true});
    clearTimeout(typingTimer);
    typingTimer=setTimeout(()=>client.rpc('community_set_typing',{target_room:'community',typing:false}),1800);
  });

form.addEventListener('submit',async e=>{
    e.preventDefault();
    const body=form.body.value.trim();
    if(!body)return;

    const button=document.getElementById('chatSendButton');
    button.disabled=true;
    button.textContent='Sending…';

    const sent=await client.from('community_chat_messages').insert({
      user_id:session.user.id,
      body
    });

    if(!sent.error&&emailPref.checked){
      await client.rpc('queue_community_email_notifications',{
        sender_id:session.user.id,
        chat_body:body
      });
    }

    button.disabled=false;
    button.textContent='Send Message';

    if(sent.error){
      result.textContent=sent.error.message;
      result.className='member-message show error';
      return;
    }

    form.reset();
    result.textContent=emailPref.checked
      ? 'Message sent. Email alerts were queued for opted-in members.'
      : 'Message sent.';
    result.className='member-message show success';
    await loadMessages(true);
  });

  const pref=await client.from('notification_preferences')
    .select('community_email_enabled')
    .eq('user_id',session.user.id).maybeSingle();

  emailPref.checked=Boolean(pref.data?.community_email_enabled);
  emailPref.addEventListener('change',async()=>{
    await client.from('notification_preferences').upsert({
      user_id:session.user.id,
      community_email_enabled:emailPref.checked,
      updated_at:new Date().toISOString()
    });
  });

  document.getElementById('chatRefresh').addEventListener('click',()=>loadMessages(true));

  await loadMessages(true);
  await connect();

  addEventListener('beforeunload',()=>{
    clearInterval(pollTimer);
    clearTimeout(reconnectTimer);
    clearTimeout(typingTimer);client.rpc('community_set_typing',{target_room:'community',typing:false});client.rpc('community_set_presence',{area:'community-chat',online:false});if(channel)client.removeChannel(channel);
  });
})();
