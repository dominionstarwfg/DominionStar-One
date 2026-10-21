(async () => {
  const gate = document.getElementById('communityGate');
  const app = document.getElementById('communityApp');
  const feed = document.getElementById('communityFeed');
  const postForm = document.getElementById('communityPostForm');
  const postResult = document.getElementById('communityPostResult');
  const typeFilter = document.getElementById('communityTypeFilter');
  const search = document.getElementById('communitySearch');
  const preferenceForm = document.getElementById('communityPreferenceForm');
  const preferenceResult = document.getElementById('communityPreferenceResult');
  const liveStatus = document.getElementById('communityLiveStatus');

  let supabase;
  let session;
  let profile;
  let allPosts = [];
  let realtimeChannel = null;
  let pollTimer = null;
  let reconnectTimer = null;
  let isFounder = false;
  let feedRequestVersion = 0;
  let currentAvatarMap = {};

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));


  // Link presentation: only explicit HTTPS/HTTP URLs are clickable, never raw HTML.
  const linkify = value => String(value ?? '').split(/(https?:\/\/[^\s<>"']+)/gi).map(part => {
    if (!/^https?:\/\//i.test(part)) return esc(part);
    const trailing=(part.match(/[).,!?;:]+$/)||[])[0]||'';
    const candidate=part.slice(0,part.length-trailing.length);
    try {
      const url=new URL(candidate);
      if (!['http:','https:'].includes(url.protocol)) return esc(part);
      return '<a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer nofollow">'+esc(candidate)+'</a>'+esc(trailing);
    } catch {
      return esc(part);
    }
  }).join('');

  const copyCommunityText=async (text) => {
    if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable in this browser. Please use a secure connection.');
    await navigator.clipboard.writeText(text);
  };

  const show = (target,text,type='info') => {
    target.textContent=text;
    target.className=`member-message show ${type}`;
  };

  const setConnection = (state, detail='') => {
    liveStatus.textContent = detail || state;
    liveStatus.className =
      state === 'Live' ? 'community-live' :
      state === 'Offline' ? 'community-offline' :
      'community-connecting';
  };

  if (!window.DSAuth?.ready) {
    gate.innerHTML='<p class="eyebrow">Unavailable</p><h1>Authentication configuration is missing.</h1>';
    return;
  }

  supabase=await window.DSAuth.init();
  const auth=await supabase.auth.getSession();
  session=auth.data.session;

  if (!session) {
    location.href='/member-login/';
    return;
  }

  const profileResult=await supabase
    .from('member_profiles')
    .select('id,full_name,preferred_name,email,rank,founding_member,exclusive_member_number,verification_status,role,is_founder,avatar_path')
    .eq('id',session.user.id)
    .single();

  profile=profileResult.data;

  if (profileResult.error || profile?.verification_status!=='approved') {
    gate.innerHTML='<p class="eyebrow">Founder Approval Required</p><h1>Community access is available to approved members.</h1>';
    return;
  }

  // Composer identity is the authenticated user, never a demo name.
  const composerName=String(profile.preferred_name||profile.full_name||'Member').trim()||'Member';
  const composerFullName=String(profile.full_name||composerName).trim()||'Member';
  const composerInitials=composerFullName.split(/\s+/).filter(Boolean).slice(0,2)
    .map(part=>part[0]).join('').toUpperCase()||'DS';
  const nameNode=document.getElementById('communityComposerName');
  const rankNode=document.getElementById('communityComposerRank');
  const foundingNode=document.getElementById('communityComposerFounding');
  const initialsNode=document.getElementById('communityComposerInitials');
  const photoNode=document.getElementById('communityComposerAvatar');
  if(nameNode)nameNode.textContent=composerFullName;
  if(rankNode)rankNode.textContent='Contract Level: '+String(profile.rank||'—');
  if(initialsNode)initialsNode.textContent=composerInitials;
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
  if(photoNode && profile.avatar_path){
    Promise.resolve()
      .then(()=>supabase.storage.from('member-avatars').createSignedUrl(profile.avatar_path,3600))
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
      .catch(()=>{ /* Initials remain visible when Storage is unavailable. */ });
  }

  // Founder controls require server authorization; profile fields and email
  // are informational and cannot grant elevated privileges.
  const founderResult=await supabase.rpc('is_dominionstar_founder');
  isFounder=founderResult.error==null && founderResult.data===true;

  if (isFounder) {
    document.getElementById('founderAnnouncementOption')?.classList.remove('member-hidden');
    document.getElementById('pinPostControl')?.classList.remove('member-hidden');
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  function reactionLabel(type) {
    return {
      like:'👍 Like',
      celebrate:'🎉 Celebrate',
      support:'🤝 Support',
      insightful:'💡 Insightful'
    }[type];
  }

  async function fetchProfiles(userIds) {
    const ids=[...new Set(userIds.filter(Boolean))];
    if (!ids.length) return {};

    const result=await supabase
      .from('member_profiles')
      .select('id,full_name,preferred_name,rank,exclusive_member_number,avatar_path')
      .in('id',ids);

    if (result.error) throw result.error;
    return Object.fromEntries((result.data||[]).map(item=>[item.id,item]));
  }

  async function resolveAvatars(profileMap) {
    const paths=[...new Set(
      Object.values(profileMap).map(item=>item.avatar_path).filter(Boolean)
    )];

    const pairs=await Promise.all(paths.map(async path=>{
      const signed=await supabase.storage.from('member-avatars').createSignedUrl(path,3600);
      return [path,signed.data?.signedUrl||null];
    }));

    return Object.fromEntries(pairs);
  }

  function renderFeed(avatarMap=currentAvatarMap) {
    const query=search.value.trim().toLowerCase();
    const type=typeFilter.value;

    const filtered=allPosts.filter(post=>{
      const member=post.author||{};
      const haystack=[
        post.title,post.body,post.post_type,
        member.full_name,member.preferred_name,member.rank
      ].filter(Boolean).join(' ').toLowerCase();

      return (!type || post.post_type===type) && (!query || haystack.includes(query));
    });

    feed.innerHTML=filtered.length ? filtered.map(post=>{
      const member=post.author||{};
      const comments=(post.comments||[]).filter(comment=>!comment.is_deleted);
      const reactions=post.reactions||[];
      const reactionCounts={like:0,celebrate:0,support:0,insightful:0};
      reactions.forEach(item=>{
        if(Object.prototype.hasOwnProperty.call(reactionCounts,item.reaction)){
          reactionCounts[item.reaction]++;
        }
      });

      const avatar=member.avatar_path ? avatarMap[member.avatar_path] : null;
      const initial=(member.preferred_name||member.full_name||'M').slice(0,1);

      return `
      <article class="community-post-card ${post.is_pinned?'pinned':''}" data-id="${esc(post.id)}">
        <header class="community-post-header">
          <div class="community-post-avatar">${avatar?`<img src="${esc(avatar)}" alt="">`:esc(initial)}</div>
          <div class="community-post-author">
            <strong>${esc(member.preferred_name||member.full_name||'DominionStar Member')}</strong>
            <span>${esc(member.rank||'TA')}</span>
            ${member.exclusive_member_number?`<span>Founding #${member.exclusive_member_number}</span>`:''}
            <small>${new Date(post.created_at).toLocaleString()}</small>
          </div>
          <div class="community-post-type ${esc(post.post_type)}">${esc(post.post_type)}</div>
          <div class="community-post-options">
            <button class="community-options-trigger" type="button" aria-label="More options for this post" aria-expanded="false" aria-haspopup="true">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
            </button>
            <div class="community-options-menu" role="group" aria-label="Post actions" hidden>
              <button type="button" data-post-action="copy">Copy post text</button>
              <button type="button" data-post-action="link">Copy post link</button>
            </div>
          </div>
        </header>

        ${post.is_pinned?'<div class="community-pinned-label">Pinned by Founder</div>':''}
        ${post.is_locked?'<div class="community-locked-label">Discussion locked</div>':''}
        ${post.title?`<h2>${esc(post.title)}</h2>`:''}
        <p class="community-post-body">${linkify(post.body)}</p>

        <div class="community-reaction-row">
          ${['like','celebrate','support','insightful'].map(reaction=>`
            <button class="community-reaction-button" data-reaction="${reaction}" type="button">
              ${reactionLabel(reaction)} <b>${reactionCounts[reaction]}</b>
            </button>`).join('')}
        </div>

        ${isFounder?`
          <div class="community-moderation-row">
            <button class="btn btn-outline moderate-pin" type="button">${post.is_pinned?'Unpin':'Pin'}</button>
            <button class="btn btn-outline moderate-lock" type="button">${post.is_locked?'Unlock':'Lock'}</button>
            <button class="btn btn-outline moderate-delete" type="button">Hide</button>
          </div>`:''}

        <section class="community-comment-section">
          <div class="community-comment-list">
            ${comments.map(comment=>{
              const author=comment.author||{};
              const commentAvatar=author.avatar_path?avatarMap[author.avatar_path]:null;
              const commentInitial=(author.preferred_name||author.full_name||'M').slice(0,1);
              return `
              <article class="community-comment">
                <div class="community-comment-avatar">${commentAvatar?`<img src="${esc(commentAvatar)}" alt="">`:esc(commentInitial)}</div>
                <div>
                  <strong>${esc(author.preferred_name||author.full_name||'Member')}</strong>
                  <p>${esc(comment.body)}</p>
                  <small>${new Date(comment.created_at).toLocaleString()}</small>
                </div>
              </article>`;
            }).join('')}
          </div>

          ${post.is_locked?'':`
            <form class="community-comment-form">
              <input name="body" maxlength="1500" required placeholder="Write a comment…">
              <button class="btn btn-outline" type="submit">Reply</button>
            </form>`}
        </section>
      </article>`;
    }).join('') : '<div class="member-empty-state"><h2>No matching community posts.</h2><p>Create the first discussion or change the filter.</p></div>';

    wireActions();
  }

  function wireActions() {
    // Each card's options menu uses the same feed data already authorized by
    // list_community_feed. Menus change presentation; never grant moderation.
    const dismissOptions=()=>{
      feed.querySelectorAll('.community-post-options').forEach(wrap=>{
        const menu=wrap.querySelector('.community-options-menu');
        const trigger=wrap.querySelector('.community-options-trigger');
        if(menu)menu.hidden=true;
        trigger?.setAttribute('aria-expanded','false');
      });
    };
    feed.querySelectorAll('.community-options-trigger').forEach(trigger=>{
      trigger.addEventListener('click',event=>{
        event.stopPropagation();
        const menu=trigger.parentElement.querySelector('.community-options-menu');
        const wasClosed=menu.hidden;
        dismissOptions();
        menu.hidden=!wasClosed;
        trigger.setAttribute('aria-expanded',String(wasClosed));
      });
    });
    feed.querySelectorAll('[data-post-action]').forEach(button=>{
      button.addEventListener('click',async ()=>{
        const card=button.closest('.community-post-card');
        const post=allPosts.find(item=>String(item.id)===card?.dataset.id);
        dismissOptions();
        if(!post)return;
        const text=button.dataset.postAction==='copy'
          ? [post.title,post.body].filter(Boolean).join('\n\n')
          : new URL('/community/?post='+encodeURIComponent(post.id),location.origin).href;
        try{
          await copyCommunityText(text);
          show(postResult,button.dataset.postAction==='copy'?'Post text copied.':'Post link copied.','success');
        }catch(error){show(postResult,error.message,'error');}
      });
    });

    feed.querySelectorAll('.community-reaction-button').forEach(button=>{
      button.addEventListener('click',async()=>{
        const card=button.closest('.community-post-card');
        const original=button.textContent;button.disabled=true;button.textContent='Updating…';
        const result=await supabase.rpc('community_toggle_reaction',{
          target_message_id:card.dataset.id,
          target_reaction:button.dataset.reaction
        });
        if(result.error){show(postResult,result.error.message,'error');button.disabled=false;button.textContent=original;return;}
        await loadPosts(false);
        show(postResult,'Reaction saved and feed refreshed.','success');
      });
    });

    feed.querySelectorAll('.community-comment-form').forEach(form=>{
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        const card=form.closest('.community-post-card');
        const body=form.body.value.trim();
        const button=form.querySelector('button');
        const original=button.textContent;button.disabled=true;button.textContent='Posting…';

        const insert=await supabase.from('community_comments').insert({
          message_id:card.dataset.id,
          user_id:session.user.id,
          body
        });

        if(!insert.error){
          await supabase.rpc('community_notify_mentions',{
            target_message_id:card.dataset.id,
            message_body:body
          });
        }

        if(insert.error){show(postResult,insert.error.message,'error');button.disabled=false;button.textContent=original;return;}
        form.reset();
        await loadPosts(false);
        show(postResult,'Comment saved and feed refreshed.','success');
      });
    });

    if(isFounder){
      feed.querySelectorAll('.community-post-card').forEach(card=>{
        const post=allPosts.find(item=>item.id===card.dataset.id);
        card.querySelector('.moderate-pin')?.addEventListener('click',event=>moderate(post.id,{new_is_pinned:!post.is_pinned},event.currentTarget));
        card.querySelector('.moderate-lock')?.addEventListener('click',event=>moderate(post.id,{new_is_locked:!post.is_locked},event.currentTarget));
        card.querySelector('.moderate-delete')?.addEventListener('click',async event=>{
          if(confirm('Hide this Community post?')) await moderate(post.id,{new_is_deleted:true},event.currentTarget);
        });
      });
    }
  }

  async function moderate(id,changes,button){
    const original=button?.textContent;if(button){button.disabled=true;button.textContent='Updating…';}
    const result=await supabase.rpc('founder_moderate_community_post',{
      target_message_id:id,
      new_is_pinned:changes.new_is_pinned??null,
      new_is_deleted:changes.new_is_deleted??null,
      new_is_locked:changes.new_is_locked??null
    });
    if(result.error){show(postResult,result.error.message,'error');if(button){button.disabled=false;button.textContent=original;}return;}
    await loadPosts(false);
    show(postResult,'Moderation saved and feed refreshed.','success');
  }

  async function loadPosts(showLoading=true){
    const requestVersion=++feedRequestVersion;
    if(showLoading)feed.innerHTML='<p>Loading Community Feed…</p>';

    try{
      const postsResult=await supabase.rpc('list_community_feed',{result_limit:100});
      if(postsResult.error)throw postsResult.error;
      const posts=postsResult.data||[];
      const postIds=posts.map(post=>post.id).filter(Boolean);

      // Comments and reactions must be requested only for visible feed IDs.
      // This is data minimization; backend RLS still must enforce access.
      const [commentsResult,reactionsResult]=postIds.length
        ? await Promise.all([
            supabase.from('community_comments')
              .select('id,message_id,user_id,body,is_deleted,created_at')
              .in('message_id',postIds)
              .eq('is_deleted',false)
              .order('created_at',{ascending:true}),
            supabase.from('community_reactions')
              .select('id,message_id,user_id,reaction')
              .in('message_id',postIds)
          ])
        : [{data:[],error:null},{data:[],error:null}];


      if(commentsResult.error)throw commentsResult.error;
      if(reactionsResult.error)throw reactionsResult.error;
      const comments=commentsResult.data||[];
      const reactions=reactionsResult.data||[];
      const userIds=[
        ...posts.map(item=>item.user_id),
        ...comments.map(item=>item.user_id)
      ];
      const commentProfileMap=await fetchProfiles(comments.map(item=>item.user_id));
      const postAuthors=Object.fromEntries(posts.map(post=>[
        post.user_id,
        {
          id:post.user_id,
          full_name:post.author_full_name,
          preferred_name:post.author_preferred_name,
          rank:post.author_rank,
          exclusive_member_number:post.author_exclusive_number,
          avatar_path:post.author_avatar_path
        }
      ]));
      const combinedProfiles={...commentProfileMap,...postAuthors};
      const avatarMap=await resolveAvatars(combinedProfiles);
      if(requestVersion!==feedRequestVersion)return;
      currentAvatarMap=avatarMap;

      allPosts=posts.map(post=>({
        ...post,
        author:postAuthors[post.user_id]||null,
        comments:comments.filter(comment=>comment.message_id===post.id).map(comment=>({
          ...comment,
          author:commentProfileMap[comment.user_id]||null
        })),
        reactions:reactions.filter(reaction=>reaction.message_id===post.id)
      })).sort((a,b)=>(Number(b.is_pinned)-Number(a.is_pinned))||(new Date(b.created_at)-new Date(a.created_at)));

      renderFeed(avatarMap);
      const sharedId=new URLSearchParams(location.search).get('post');
      if(sharedId){
        const target=[...feed.querySelectorAll('.community-post-card')].find(card=>card.dataset.id===sharedId);
        if(target){
          target.classList.add('community-shared-target');
          if(showLoading)target.scrollIntoView({block:'center',behavior:'smooth'});
        }
      }
      setConnection('Live','Live');
    }catch(error){
      if(requestVersion!==feedRequestVersion)return;
      feed.innerHTML=`
        <div class="community-error-state">
          <h2>Community could not load.</h2>
          <p>${esc(error.message||error)}</p>
          <button id="communityRetry" class="btn btn-gold" type="button">Retry</button>
        </div>`;
      document.getElementById('communityRetry')?.addEventListener('click',()=>loadPosts(true));
      setConnection('Offline','Retry required');
    }
  }

  async function connectRealtime(){
    if(realtimeChannel)await supabase.removeChannel(realtimeChannel);
    setConnection('Connecting','Connecting…');

    realtimeChannel=supabase.channel('dominionstar-community-v632a')
      .on('postgres_changes',{event:'*',schema:'public',table:'community_messages'},()=>loadPosts(false))
      .on('postgres_changes',{event:'*',schema:'public',table:'community_comments'},()=>loadPosts(false))
      .on('postgres_changes',{event:'*',schema:'public',table:'community_reactions'},()=>loadPosts(false))
      .subscribe(status=>{
        if(status==='SUBSCRIBED'){
          setConnection('Live','Live');
          clearInterval(pollTimer);
          pollTimer=setInterval(()=>loadPosts(false),60000);
        }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
          setConnection('Offline','Reconnecting…');
          clearTimeout(reconnectTimer);
          reconnectTimer=setTimeout(connectRealtime,5000);
        }
      });
  }

  postForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!postForm.reportValidity())return;

    const button=document.getElementById('communityPostSubmit');
    button.disabled=true;
    button.textContent='Publishing…';

    const payload={
      user_id:session.user.id,
      title:postForm.elements.namedItem('title').value.trim()||null,
      body:postForm.elements.namedItem('body').value.trim(),
      post_type:postForm.elements.namedItem('post_type').value,
      is_pinned:isFounder?postForm.elements.namedItem('is_pinned').checked:false
    };

    const insert=await supabase.from('community_messages').insert(payload).select('id,created_at').single();

    if(insert.error){
      show(postResult,insert.error.message,'error');
      button.disabled=false;button.textContent='Publish Post';return;
    }

    await supabase.rpc('community_notify_mentions',{
      target_message_id:insert.data.id,
      message_body:payload.body
    });

    button.textContent='Verifying…';
    await loadPosts(false);
    if(!allPosts.some(post=>post.id===insert.data.id)){
      show(postResult,'The server accepted the post, but it was not returned in the Community feed.','error');
      button.disabled=false;button.textContent='Publish Post';return;
    }
    postForm.reset();
    show(postResult,'Post verified at the top of the Community feed.','success');
    button.disabled=false;button.textContent='Publish Post';
  });

  typeFilter.addEventListener('change',()=>renderFeed());
  search.addEventListener('input',()=>renderFeed());
  document.getElementById('communityRefresh')?.addEventListener('click',async event=>{
    const button=event.currentTarget,original=button.textContent;button.disabled=true;button.textContent='Refreshing…';
    await loadPosts(true);button.disabled=false;button.textContent=original;
  });

  const preference=await supabase.from('notification_preferences')
    .select('*').eq('user_id',session.user.id).maybeSingle();

  if(preference.data){
    preferenceForm.founder_updates.checked=preference.data.founder_updates;
    preferenceForm.community_mentions.checked=preference.data.community_mentions;
    preferenceForm.email_digest.value=preference.data.email_digest;
  }

  preferenceForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=preferenceForm.querySelector('[type="submit"]'),original=button.textContent;
    button.disabled=true;button.textContent='Saving…';show(preferenceResult,'Saving preferences…');
    const expected={
      user_id:session.user.id,
      founder_updates:preferenceForm.founder_updates.checked,
      community_mentions:preferenceForm.community_mentions.checked,
      email_digest:preferenceForm.email_digest.value,
      updated_at:new Date().toISOString()
    };
    const save=await supabase.from('notification_preferences').upsert(expected).select('*').single();
    if(save.error){show(preferenceResult,save.error.message,'error');button.disabled=false;button.textContent=original;return;}
    const verify=await supabase.from('notification_preferences').select('*').eq('user_id',session.user.id).single();
    if(verify.error||Boolean(verify.data.founder_updates)!==expected.founder_updates||Boolean(verify.data.community_mentions)!==expected.community_mentions||verify.data.email_digest!==expected.email_digest){
      show(preferenceResult,verify.error?.message||'The server did not retain the saved preferences.','error');button.disabled=false;button.textContent=original;return;
    }
    show(preferenceResult,'Preferences verified. Refreshing…','success');
    setTimeout(()=>window.location.reload(),700);
  });

  document.getElementById('communityLogout').addEventListener('click',()=>window.DSAuth.signOut());

  await loadPosts(true);
  await supabase.rpc('community_mark_seen');
  await connectRealtime();

  addEventListener('beforeunload',()=>{
    clearInterval(pollTimer);
    clearTimeout(reconnectTimer);
    if(realtimeChannel)supabase.removeChannel(realtimeChannel);
  });
})();
