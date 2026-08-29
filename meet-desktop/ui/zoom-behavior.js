(()=>{
  if(window.DominionZoomBehavior)return;
  const desktop=window.dominionDesktop||{};
  const meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const esc=value=>String(value||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const localName=()=>String(q('#profileName')?.textContent||q('#stageName')?.textContent||'You').trim()||'You';
  const isMeetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const role=()=>String(q('#roomRole')?.textContent||'').trim().toLowerCase();
  let leaveDialog=null;
  let chatPatched=false;
  let unreadCount=0;
  let chatPolicy='everyone';
  let queueBusy=false;

  if(!document.querySelector('link[data-ds-zoom-behavior]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='./zoom-behavior.css';link.dataset.dsZoomBehavior='1';document.head.append(link);
  }

  function hardenPasscodes(){
    for(const input of [q('#newMeetingPasscode'),q('#joinPasscode')]){
      if(!input)continue;
      input.maxLength=7;
      input.pattern='[0-9]{3,7}';
      input.title='Passcode must contain 3 to 7 digits';
      input.setAttribute('aria-description','Passcode must contain 3 to 7 digits');
    }
  }

  async function context(){try{return await meeting?.context?.()||{};}catch{return {};}}
  async function peers(){
    if(!meeting?.snapshot)return [];
    const ctx=await context();if(!ctx.roomId)return [];
    try{
      const snap=await meeting.snapshot(ctx.roomId);
      return (snap?.participants||[]).filter(p=>String(p.participantId||'')&&String(p.participantId)!==String(ctx.participantId||'')&&['admitted','joined'].includes(String(p.state||'joined')));
    }catch{return [];}
  }

  function ensureLeaveDialog(){
    if(leaveDialog?.isConnected)return leaveDialog;
    leaveDialog=document.createElement('dialog');
    leaveDialog.id='zoomLeaveDialog';leaveDialog.className='zoom-leave-dialog';
    leaveDialog.innerHTML='<div class="zoom-leave-card"><header><div><p>MEETING</p><h2>End or leave meeting</h2></div><button type="button" data-zoom-leave-close aria-label="Close">×</button></header><p class="zoom-leave-copy">To keep the meeting running, assign another signed-in participant as host before you leave.</p><div class="zoom-host-candidates" hidden></div><div class="zoom-leave-actions"><button type="button" class="secondary" data-zoom-host-handoff>Assign Host & Leave</button><button type="button" class="danger" data-zoom-end-all>End Meeting for All</button><button type="button" class="cancel" data-zoom-leave-close>Cancel</button></div><p class="zoom-leave-status" role="status" aria-live="polite"></p></div>';
    document.body.append(leaveDialog);
    qa('[data-zoom-leave-close]').forEach(button=>button.addEventListener('click',()=>leaveDialog.close()));
    leaveDialog.querySelector('[data-zoom-host-handoff]').addEventListener('click',()=>void showHostHandoffChoices());
    leaveDialog.querySelector('[data-zoom-end-all]').addEventListener('click',()=>void endForAll());
    return leaveDialog;
  }

  async function showHostHandoffChoices(){
    const dialog=ensureLeaveDialog(),status=dialog.querySelector('.zoom-leave-status'),box=dialog.querySelector('.zoom-host-candidates');
    status.textContent='Loading eligible participants…';box.hidden=true;box.innerHTML='';
    try{
      const list=await peers();
      const eligible=list.filter(p=>String(p.role||'').toLowerCase()!=='guest'&&p.canHost!==false);
      if(!eligible.length){
        status.textContent='No eligible signed-in participant is available to become host. Admit or ask a DominionStar member to join, or end the meeting for everyone.';
        return;
      }
      status.textContent='Choose the participant who should become host:';
      for(const participant of eligible){
        const button=document.createElement('button');button.type='button';button.className='zoom-host-candidate';
        const name=String(participant.displayName||'Participant');
        button.innerHTML=`<span><strong>${esc(name)}</strong><small>${String(participant.role||'participant').toLowerCase()==='cohost'?'Co-host':'Participant'}</small></span><span>Assign & Leave</span>`;
        button.addEventListener('click',()=>void transferHostAndLeave(participant,button));
        box.append(button);
      }
      box.hidden=false;
    }catch(error){status.textContent=String(error?.message||error||'Could not load participants.');}
  }

  async function transferHostAndLeave(participant,button){
    const dialog=ensureLeaveDialog(),status=dialog.querySelector('.zoom-leave-status');
    if(!meeting?.transferHostAndLeave){status.textContent='Host transfer authority is unavailable in this build.';return;}
    const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(node=>node.disabled=true);
    status.textContent=`Assigning ${String(participant.displayName||'participant')} as host and leaving…`;
    try{
      await meeting.transferHostAndLeave(participant.participantId);
      dialog.close();location.reload();
    }catch(error){
      const raw=String(error?.message||error||'Host transfer failed.');
      const copy=raw.includes('signed_in_participant_required_for_host')?'Only a signed-in DominionStar participant can receive host control.':raw.includes('participant_not_joined')?'That participant is not fully joined yet.':raw;
      status.textContent=copy;buttons.forEach(node=>node.disabled=false);button?.focus?.();
    }
  }

  async function endForAll(){
    const dialog=ensureLeaveDialog(),status=dialog.querySelector('.zoom-leave-status'),buttons=[...dialog.querySelectorAll('button')];
    buttons.forEach(button=>button.disabled=true);status.textContent='Ending meeting for everyone…';
    try{
      const ctx=await context();if(!ctx.roomId)throw new Error('Meeting context is unavailable.');
      await meeting.end(ctx.roomId);dialog.close();location.reload();
    }catch(error){status.textContent=String(error?.message||error||'Meeting could not close.');buttons.forEach(button=>button.disabled=false);}
  }

  function installLeaveGuard(){
    const button=q('#roomExitButton');if(!button||button.dataset.dsZoomLeaveGuard)return;
    button.dataset.dsZoomLeaveGuard='1';
    button.addEventListener('click',event=>{
      if(role()!=='host')return;
      event.preventDefault();event.stopImmediatePropagation();
      const dialog=ensureLeaveDialog();dialog.querySelector('.zoom-leave-status').textContent='';
      if(!dialog.open)dialog.showModal();
    },true);
  }

  async function admitAll(){
    if(queueBusy||!meeting?.hostQueue||!meeting?.decide)return;
    queueBusy=true;syncAdmitAll();
    try{
      const ctx=await context();if(!ctx.roomId)return;
      const result=await meeting.hostQueue(ctx.roomId);const waiting=(result?.waiting||[]).filter(p=>p.participantId);
      await Promise.allSettled(waiting.map(p=>meeting.decide(p.participantId,'admit')));
    }finally{queueBusy=false;setTimeout(syncAdmitAll,100);}
  }

  function syncAdmitAll(){
    const section=q('#waitingQueueSection'),heading=section?.querySelector('h3');if(!section||!heading)return;
    let button=heading.querySelector('#zoomAdmitAll');
    if(!button){button=document.createElement('button');button.id='zoomAdmitAll';button.type='button';button.className='zoom-admit-all';button.textContent='Admit All';button.addEventListener('click',()=>void admitAll());heading.append(button);}
    const count=qa('#waitingQueue [data-wait]').length;
    button.hidden=count<2;button.disabled=queueBusy;button.textContent=queueBusy?'Admitting…':'Admit All';
  }


  function chatMessages(){return q('#meetingChatMessages');}
  function updateUnread(clear=false){
    if(clear)unreadCount=0;
    const button=q('#roomChat');if(!button)return;
    let badge=button.querySelector('.meeting-chat-unread-badge');
    if(unreadCount<=0){badge?.remove();button.classList.remove('has-unread');button.setAttribute('aria-label','Chat');return;}
    if(!badge){badge=document.createElement('span');badge.className='meeting-chat-unread-badge';button.append(badge);}
    badge.textContent=unreadCount>99?'99+':String(unreadCount);button.classList.add('has-unread');button.setAttribute('aria-label',`Chat, ${unreadCount} unread message${unreadCount===1?'':'s'}`);
  }
  function appendChat({text,name,own=false,privateMessage=false,peerName='',at=Date.now()}){
    const box=chatMessages();if(!box)return;
    box.querySelector('.meeting-chat-empty')?.remove();
    const article=document.createElement('article');article.className=`meeting-chat-message${own?' own':''}${privateMessage?' private':''}`;
    const scope=privateMessage?(own?`Private to ${peerName||'participant'}`:`Private from ${name}`):'Everyone';
    article.innerHTML=`<strong>${esc(name)} <span class="meeting-chat-scope">${esc(scope)}</span></strong><p>${esc(text)}</p><time>${new Date(at||Date.now()).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time>`;
    box.append(article);while(box.children.length>200)box.firstElementChild?.remove();box.scrollTop=box.scrollHeight;
    if(!own&&q('#meetingChatPanel')?.hidden){unreadCount+=1;updateUnread();window.DominionMeetingNotifications?.chat?.(name||'Participant');}
  }

  async function chatSnapshot(){
    const ctx=await context();if(!ctx.roomId||!meeting?.snapshot)return {ctx,list:[],policy:'everyone'};
    try{const snap=await meeting.snapshot(ctx.roomId);return {ctx,snap,list:snap?.participants||[],policy:String(snap?.chatPolicy||'everyone')};}
    catch{return {ctx,list:[],policy:'everyone'};}
  }
  function canManageChat(){const current=role().replace('-','');return ['host','cohost'].includes(current);}
  function ensureChatPolicyControl(panel){
    const header=panel?.querySelector('header');if(!header)return null;
    let select=q('#meetingChatPolicy');
    if(!select){
      select=document.createElement('select');select.id='meetingChatPolicy';select.className='meeting-chat-policy';select.setAttribute('aria-label','Participant chat permissions');
      select.innerHTML='<option value="everyone">Participants can chat: Everyone</option><option value="host_cohost">Participants can chat: Host & Co-hosts</option><option value="disabled">Participants cannot chat</option>';
      header.insertBefore(select,header.querySelector('[data-chat-close]'));
      select.onchange=async()=>{
        const ctx=await context();if(!ctx.roomId||!meeting?.setChatPolicy)return;
        select.disabled=true;
        try{const result=await meeting.setChatPolicy(ctx.roomId,select.value);chatPolicy=String(result?.chatPolicy||select.value);await refreshChatRecipients();}
        catch{select.value=chatPolicy;}
        finally{select.disabled=false;}
      };
    }
    select.hidden=!canManageChat();select.value=chatPolicy;return select;
  }
  async function refreshChatRecipients(){
    const select=q('#meetingChatRecipient'),input=q('#meetingChatInput'),send=q('#meetingChatForm button[type="submit"]');if(!select||!input)return;
    const {ctx,list,policy}=await chatSnapshot();chatPolicy=policy;
    const localId=String(ctx.participantId||''),currentRole=role().replace('-',''),manager=['host','cohost'].includes(currentRole);
    const peersList=list.filter(p=>String(p.participantId||'')&&String(p.participantId)!==localId&&['admitted','joined'].includes(String(p.state||'joined')));
    const current=select.value||'everyone';
    let options='';
    if(manager||policy==='everyone'){
      options='<option value="everyone">Everyone</option>'+peersList.map(p=>`<option value="${esc(p.participantId)}">${esc(p.displayName||'Participant')}</option>`).join('');
      input.disabled=false;if(send)send.disabled=false;
      input.placeholder='Message everyone';
    }else if(policy==='host_cohost'){
      const managers=peersList.filter(p=>['host','cohost'].includes(String(p.role||'').toLowerCase()));
      options='<option value="host_cohost">Host & Co-hosts</option>'+managers.map(p=>`<option value="${esc(p.participantId)}">${esc(p.displayName||'Host')}</option>`).join('');
      input.disabled=managers.length===0;if(send)send.disabled=managers.length===0;
      input.placeholder=managers.length?'Message host & co-hosts':'No host is available';
    }else{
      options='<option value="disabled">Chat disabled by host</option>';input.disabled=true;if(send)send.disabled=true;input.placeholder='Chat disabled by host';
    }
    const signature=`${policy}|${peersList.map(p=>`${String(p.participantId)}:${String(p.displayName||'Participant')}:${String(p.role||'participant')}`).join('|')}`;
    if(select.dataset.recipientSignature!==signature){select.dataset.recipientSignature=signature;select.innerHTML=options;}
    if([...select.options].some(option=>option.value===current))select.value=current;
    ensureChatPolicyControl(q('#meetingChatPanel'));
  }

  async function sendZoomChat(event){
    event?.preventDefault?.();
    const input=q('#meetingChatInput'),select=q('#meetingChatRecipient'),text=String(input?.value||'').trim();if(!text||!meeting?.sendSignal||input?.disabled)return;
    input.value='';const target=String(select?.value||'everyone');const {list}=await chatSnapshot();const ctx=await context();
    const peersList=list.filter(p=>String(p.participantId||'')&&String(p.participantId)!==String(ctx.participantId||'')&&['admitted','joined'].includes(String(p.state||'joined')));
    const payload={text:text.slice(0,2000),name:localName(),at:new Date().toISOString(),private:target!=='everyone'};
    try{
      if(target==='everyone'){
        appendChat({...payload,own:true,privateMessage:false});
        await Promise.allSettled(peersList.map(p=>meeting.sendSignal(p.participantId,'chat',payload)));return;
      }
      if(target==='host_cohost'){
        const managers=peersList.filter(p=>['host','cohost'].includes(String(p.role||'').toLowerCase()));
        if(!managers.length)throw new Error('No host or co-host is available.');
        payload.toName='Host & Co-hosts';appendChat({...payload,own:true,privateMessage:true,peerName:payload.toName});
        await Promise.allSettled(managers.map(p=>meeting.sendSignal(p.participantId,'chat',payload)));return;
      }
      if(target==='disabled')return;
      const peer=peersList.find(p=>String(p.participantId)===target);if(!peer)throw new Error('That participant is no longer in the meeting.');
      payload.toName=String(peer.displayName||'Participant');appendChat({...payload,own:true,privateMessage:true,peerName:payload.toName});await meeting.sendSignal(target,'chat',payload);
    }catch(error){
      appendChat({text:String(error?.message||error||'Message could not be sent.'),name:'DominionStar Meet',own:true});await refreshChatRecipients();
    }
  }

  function patchChat(){
    const panel=q('#meetingChatPanel'),form=q('#meetingChatForm'),input=q('#meetingChatInput');if(!panel||!form||!input)return;
    let created=false;
    if(!q('#meetingChatRecipient')){
      const select=document.createElement('select');select.id='meetingChatRecipient';select.className='meeting-chat-recipient';select.setAttribute('aria-label','Chat recipient');select.innerHTML='<option value="everyone">Everyone</option>';form.insertBefore(select,input);created=true;
    }
    form.onsubmit=sendZoomChat;chatPatched=true;ensureChatPolicyControl(panel);
    const close=panel.querySelector('[data-chat-close]');if(close&&!close.dataset.dsUnreadClear){close.dataset.dsUnreadClear='1';close.addEventListener('click',()=>updateUnread(true));}
    const button=q('#roomChat');if(button&&!button.dataset.dsUnreadClear){button.dataset.dsUnreadClear='1';button.addEventListener('click',()=>{if(q('#meetingChatPanel')&&!q('#meetingChatPanel').hidden)updateUnread(true);},false);}
    if(created||!panel.hidden)void refreshChatRecipients();
  }

  function interceptIncomingChat(event){
    const detail=event.detail||{};if(String(detail.type||'')!=='chat')return;
    event.stopImmediatePropagation();
    const payload=detail.payload||{},text=String(payload.text||'').trim();if(!text)return;
    appendChat({text:text.slice(0,2000),name:String(payload.name||detail.fromDisplayName||'Participant'),privateMessage:Boolean(payload.private),peerName:String(payload.toName||''),at:payload.at||detail.createdAt});
  }
  window.addEventListener('dominion:meeting-signal',interceptIncomingChat,true);

  function sync(){
    hardenPasscodes();
    if(!isMeetingOpen())return;
    installLeaveGuard();patchChat();syncAdmitAll();
    const exit=q('#roomExitButton');if(exit&&role()==='host'){
      const label=exit.querySelector('.ds-control-label');if(label)label.textContent='End';else exit.textContent='End';
      exit.setAttribute('aria-label','End or leave meeting');
    }
    if(chatPatched&&!q('#meetingChatPanel')?.hidden){updateUnread(true);void refreshChatRecipients();}
  }

  const syncTimer=setInterval(sync,900);
  sync();
  window.DominionZoomBehavior=Object.freeze({version:'1.4.0',sync,admitAll,refreshChatRecipients,showHostHandoffChoices,dispose:()=>clearInterval(syncTimer)});
})();
