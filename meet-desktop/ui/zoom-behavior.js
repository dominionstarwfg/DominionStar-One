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
    leaveDialog.innerHTML='<div class="zoom-leave-card"><header><div><p>MEETING</p><h2>End or leave meeting</h2></div><button type="button" data-zoom-leave-close aria-label="Close">×</button></header><p class="zoom-leave-copy">Zoom-style host leave requires transferring host control first. DominionStar will not bypass that safeguard.</p><div class="zoom-leave-actions"><button type="button" class="secondary" data-zoom-host-handoff>Assign Host & Leave</button><button type="button" class="danger" data-zoom-end-all>End Meeting for All</button><button type="button" class="cancel" data-zoom-leave-close>Cancel</button></div><p class="zoom-leave-status" role="status" aria-live="polite"></p></div>';
    document.body.append(leaveDialog);
    qa('[data-zoom-leave-close]').forEach(button=>button.addEventListener('click',()=>leaveDialog.close()));
    leaveDialog.querySelector('[data-zoom-host-handoff]').addEventListener('click',()=>showHostHandoffBlocker());
    leaveDialog.querySelector('[data-zoom-end-all]').addEventListener('click',()=>void endForAll());
    return leaveDialog;
  }

  function showHostHandoffBlocker(){
    const dialog=ensureLeaveDialog(),status=dialog.querySelector('.zoom-leave-status');
    status.textContent='Host transfer is required before leaving and remains a release blocker until the transfer authority is certified. Use End Meeting for All or Cancel in this QA build.';
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
  function appendChat({text,name,own=false,privateMessage=false,peerName='',at=Date.now()}){
    const box=chatMessages();if(!box)return;
    box.querySelector('.meeting-chat-empty')?.remove();
    const article=document.createElement('article');article.className=`meeting-chat-message${own?' own':''}${privateMessage?' private':''}`;
    const scope=privateMessage?(own?`Private to ${peerName||'participant'}`:`Private from ${name}`):'Everyone';
    article.innerHTML=`<strong>${esc(name)} <span class="meeting-chat-scope">${esc(scope)}</span></strong><p>${esc(text)}</p><time>${new Date(at||Date.now()).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time>`;
    box.append(article);while(box.children.length>200)box.firstElementChild?.remove();box.scrollTop=box.scrollHeight;
    if(!own&&q('#meetingChatPanel')?.hidden){const button=q('#roomChat');button?.classList.add('has-unread');setTimeout(()=>button?.classList.remove('has-unread'),5000);}
  }

  async function refreshChatRecipients(){
    const select=q('#meetingChatRecipient');if(!select)return;
    const current=select.value||'everyone';const list=await peers();
    const signature=list.map(p=>`${String(p.participantId)}:${String(p.displayName||'Participant')}`).join('|');
    if(select.dataset.recipientSignature!==signature){
      select.dataset.recipientSignature=signature;
      select.innerHTML='<option value="everyone">Everyone</option>'+list.map(p=>`<option value="${esc(p.participantId)}">${esc(p.displayName||'Participant')}</option>`).join('');
    }
    if([...select.options].some(option=>option.value===current))select.value=current;else select.value='everyone';
  }

  async function sendZoomChat(event){
    event?.preventDefault?.();
    const input=q('#meetingChatInput'),select=q('#meetingChatRecipient'),text=String(input?.value||'').trim();if(!text||!meeting?.sendSignal)return;
    input.value='';const target=String(select?.value||'everyone'),list=await peers();const payload={text:text.slice(0,2000),name:localName(),at:new Date().toISOString(),private:target!=='everyone'};
    if(target==='everyone'){
      appendChat({...payload,own:true,privateMessage:false});
      await Promise.allSettled(list.map(p=>meeting.sendSignal(p.participantId,'chat',payload)));
      return;
    }
    const peer=list.find(p=>String(p.participantId)===target);if(!peer){appendChat({text:'That participant is no longer in the meeting.',name:'DominionStar Meet',own:true});await refreshChatRecipients();return;}
    payload.toName=String(peer.displayName||'Participant');
    appendChat({...payload,own:true,privateMessage:true,peerName:payload.toName});
    await meeting.sendSignal(target,'chat',payload);
  }

  function patchChat(){
    const panel=q('#meetingChatPanel'),form=q('#meetingChatForm'),input=q('#meetingChatInput');if(!panel||!form||!input)return;
    let created=false;
    if(!q('#meetingChatRecipient')){
      const select=document.createElement('select');select.id='meetingChatRecipient';select.className='meeting-chat-recipient';select.setAttribute('aria-label','Chat recipient');select.innerHTML='<option value="everyone">Everyone</option>';form.insertBefore(select,input);created=true;
    }
    form.onsubmit=sendZoomChat;chatPatched=true;
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
    if(chatPatched&&!q('#meetingChatPanel')?.hidden)void refreshChatRecipients();
  }

  const syncTimer=setInterval(sync,900);
  sync();
  window.DominionZoomBehavior=Object.freeze({version:'1.0.3',sync,admitAll,refreshChatRecipients,dispose:()=>clearInterval(syncTimer)});
})();
