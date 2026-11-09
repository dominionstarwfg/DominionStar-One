(async()=>{
  const gate=document.getElementById('directoryGate'),app=document.getElementById('directoryApp'),grid=document.getElementById('directoryGrid');
  let client,session,members=[],presence={},connections=[],connectionsReady=false,connectionIssue='';
  // Connection actions and pending requests are only shown for server-authorized
  // rows. These local maps guard duplicate clicks, not database authorization.
  const connectStates=new Map(),connectionBusy=new Set();
  const connectionPanel=document.getElementById('directoryConnectionPanel');
  const connectionList=document.getElementById('directoryInvitations');
  const connectionStatus=document.getElementById('directoryConnectionStatus');
  const publicDirectoryV2=window.DOMINIONSTAR_AGENT_DATA_FEATURES?.publicMemberProfilesV2===true;
  const directoryTable='member_public_profiles';
  const directoryFields='id,full_name,preferred_name,rank,city,state,avatar_path,exclusive_member_number,verification_status';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return;}
  try {
    client=await window.DSAuth.init();
    if(!client)throw new Error('Authentication service unavailable');
    const auth=await client.auth.getSession();
    if(auth.error)throw auth.error;
    session=auth.data?.session||null;
  } catch(_error) {
    gate.innerHTML='<h1>Unable to verify your session</h1><p>Check your connection and refresh before opening the member directory.</p>';
    return;
  }
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
      connectionsReady=false;
      render();
      // Connections load separately so network problems do not conceal members.
      void loadConnections();
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
  // The SELECT policy returns only connections where the signed-in member
  // is a participant. Additional client checks prevent accidental misuse.
  function relationshipFor(memberId){
    const relevant=connections.filter(row=>
      (row.requester_id===session.user.id&&row.recipient_id===memberId)||
      (row.recipient_id===session.user.id&&row.requester_id===memberId));
    const weight=row=>row.status==='accepted'?5:row.status==='blocked'?4
      :row.status==='pending'&&row.recipient_id===session.user.id?3
      :row.status==='pending'?2:1;
    return relevant.sort((a,b)=>weight(b)-weight(a))[0]||null;
  }

  function renderRequests(){
    if(!connectionPanel||!connectionList||!connectionStatus)return;
    const incoming=connectionsReady
      ? connections.filter(row=>row.recipient_id===session.user.id&&row.status==='pending')
      :[];
    // Keep a small requests panel available for manual refresh when empty.
    connectionPanel.classList.toggle('member-hidden',
      !connectionsReady&&!connectionIssue);
    connectionStatus.textContent=connectionIssue||(!connectionsReady?'Checking connection requests…':'');
    if(!connectionsReady){connectionList.innerHTML='';return;}
    connectionList.innerHTML=incoming.length?incoming.map(row=>{
      // A former requester may have hidden their identity since sending.
      // Never read their private profile or infer a name from Agent Code.
      const peer=members.find(member=>member.id===row.requester_id);
      const name=peer?.preferred_name||peer?.full_name||'Member';
      const busy=connectionBusy.has(row.id);
      return `<div class="dsx-connection-request" data-connection-id="${esc(row.id)}">
        <strong>${esc(name)}</strong><span>sent you a connection request</span>
        <div class="dsx-connection-actions">
          <button class="btn btn-outline" type="button" data-connection-response="accepted" data-id="${esc(row.id)}" ${busy?'disabled':''}>Accept</button>
          <button class="btn btn-outline" type="button" data-connection-response="declined" data-id="${esc(row.id)}" ${busy?'disabled':''}>Decline</button>
        </div>
      </div>`;
    }).join(''):'<p class="dsx-connection-empty">No pending connection requests.</p>';
    connectionList.querySelectorAll?.('[data-connection-response]').forEach(button=>
      button.addEventListener('click',()=>void transitionConnection(
        button.dataset.id,button.dataset.connectionResponse)));
  }

  async function loadConnections(){
    try{
      const id=session.user.id;
      const result=await timeout(client.from('member_connections')
        .select('id,requester_id,recipient_id,status,created_at')
        .or('requester_id.eq.'+id+',recipient_id.eq.'+id),12000);
      if(result.error)throw result.error;
      connections=(result.data||[]).filter(row=>
        row.requester_id===id||row.recipient_id===id);
      connectionsReady=true;
      connectionIssue='';
    }catch(_error){
      // Unknown connection state must not enable a duplicate invitation.
      connectionsReady=false;
      connectionIssue='Connections could not be verified. Refresh requests to try again.';
    }
    renderRequests();
    render();
  }

  async function transitionConnection(id,action){
    const row=connections.find(item=>item.id===id);
    if(!row||connectionBusy.has(id)||!connectionsReady)return;
    const isCancel=action==='cancel';
    if(isCancel && (row.requester_id!==session.user.id||row.status!=='pending'))return;
    if(!isCancel && (row.recipient_id!==session.user.id||
      row.status!=='pending'||!['accepted','declined'].includes(action)))return;
    connectionBusy.add(id);
    renderRequests();
    render();
    try{
      const result=await timeout(isCancel
        ?client.rpc('cancel_my_member_connection',{target_connection_id:id})
        :client.rpc('respond_my_member_connection',{
          target_connection_id:id,target_status:action
        }),12000);
      if(result.error)throw result.error;
      if(result.data!==true)throw new Error('The pending request has already changed.');
      await loadConnections();
      if(!connectionsReady){
        // The RPC confirmed the change, but the follow-up SELECT failed.
        // Do not claim the inbox is synchronized until a verified refresh.
        connectionIssue='Connection change saved. Refresh requests to confirm its latest status.';
      }else{
        if(isCancel)connectStates.delete(row.recipient_id);
        connectionIssue=isCancel?'Pending request cancelled.':
          action==='accepted'?'Connection accepted.':'Request declined.';
      }
    }catch(_error){
      connectionIssue='Connection action could not be completed. Check its status and retry.';
    }finally{
      connectionBusy.delete(id);
      renderRequests();
      render();
    }
  }

  document.getElementById('directoryConnectionsRefresh')?.addEventListener(
    'click',()=>void loadConnections());

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
      const relation=relationshipFor(m.id);
      const locally=connectStates.get(m.id)||'idle';
      const connectState=locally==='sending'?'sending'
        :!connectionsReady?'loading'
        :relation?.status==='accepted'?'accepted'
        :relation?.status==='blocked'?'unavailable'
        :relation?.status==='pending'&&relation.recipient_id===session.user.id?'incoming'
        :relation?.status==='pending'?'outgoing'
        :relation?.status==='declined'?'unavailable'
        :locally;
      const connectLabel=connectState==='loading'?'Checking…'
        :connectState==='sending'?'Sending…'
        :connectState==='sent'?'Requested'
        :connectState==='exists'?'Connection exists'
        :connectState==='accepted'?'Connected'
        :connectState==='unavailable'?'Unavailable'
        :connectState==='incoming'?'Review request'
        :connectState==='outgoing'?'Cancel request'
        :connectState==='failed'?'Retry Connect':'Connect';
      const connectAction=connectState==='outgoing'?'cancel'
        :connectState==='incoming'?'review':'request';
      const connectDisabled=['loading','sending','sent','exists','accepted','unavailable']
        .includes(connectState)||(
          connectAction==='cancel'&&connectionBusy.has(relation?.id));
      return `<article class="member-directory-card" data-member-id="${esc(m.id)}">
        <div class="member-directory-avatar"><span class="member-directory-fallback" aria-hidden="true">${esc(initials(memberName))}</span><span class="${active?'online':'offline'}"></span></div>
        <h2>${esc(memberName)}</h2>
        <p>${esc(m.rank||'TA')}${m.exclusive_member_number?` · Exclusive #${m.exclusive_member_number}`:''}</p>
        <small>${esc([m.city,m.state].filter(Boolean).join(', ')||'Location not listed')}</small>
        <div class="member-directory-actions">
          <a class="btn btn-outline" href="/direct-messages/?member=${encodeURIComponent(m.id)}">Message</a>
          <button class="btn btn-outline connect-member" data-id="${esc(m.id)}" data-action="${connectAction}" data-connection-id="${esc(relation?.id||'')}" type="button" ${connectDisabled?'disabled':''}>${connectLabel}</button>
        </div>
      </article>`;
    });
    grid.innerHTML=cards.length?cards.join(''):'<div class="member-empty-state"><h2>No members found.</h2></div>';
    // Maintain the original fallback initializer for any already-present photos.
    wireAvatarFallbacks(grid);
    grid.querySelectorAll('.connect-member').forEach(b=>b.addEventListener('click',async()=>{
      const recipient=b.dataset.id;
      if(!recipient||recipient===session.user.id||!connectionsReady)return;
      if(b.dataset.action==='review'){
        connectionPanel?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
        return;
      }
      if(b.dataset.action==='cancel'){
        void transitionConnection(b.dataset.connectionId,'cancel');
        return;
      }
      if(relationshipFor(recipient)||connectStates.get(recipient)==='sending')return;
      connectStates.set(recipient,'sending');
      render();
      try{
        // Only a pending invitation is permitted by the hardened INSERT policy.
        const r=await timeout(client.from('member_connections').insert({
          requester_id:session.user.id,recipient_id:recipient,status:'pending'
        }),12000);
        if(r.error&&r.error.code!=='23505')throw r.error;
        connectStates.set(recipient,r.error?'exists':'sent');
        await loadConnections();
      }catch(_error){
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
