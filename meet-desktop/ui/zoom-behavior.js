(()=>{
  if(window.DominionZoomBehavior)return;
  const desktop=window.dominionDesktop||{};
  const meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const esc=value=>String(value||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const localName=()=>String(q('#profileName')?.textContent||q('#stageName')?.textContent||'You').trim()||'You';
  const isMeetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const role=()=>String(q('#roomRole')?.textContent||'').trim().toLowerCase();
  const media=()=>window.DominionMediaController||null;
  let leaveDialog=null;
  let participantMenu=null;
  let renameDialog=null;
  let spotlightParticipantId='';
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


  function closeParticipantMenu(){participantMenu?.remove();participantMenu=null;}
  function participantMenuAt(anchor){
    closeParticipantMenu();const menu=document.createElement('div');menu.className='zoom-participant-menu';document.body.append(menu);
    const r=anchor.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-240,r.right-220))}px`;menu.style.top=`${Math.max(10,Math.min(innerHeight-320,r.bottom+6))}px`;participantMenu=menu;return menu;
  }
  async function sendHostCommand(participantId,command,payload={}){
    if(!meeting?.sendSignal)return;
    await meeting.sendSignal(participantId,`host:${command}`,{...payload,at:new Date().toISOString()});
  }
  async function setSpotlight(participantId){
    const next=spotlightParticipantId===String(participantId||'')?'':String(participantId||'');
    spotlightParticipantId=next;
    window.dispatchEvent(new CustomEvent('dominion:spotlight-change',{detail:{participantId:next}}));
    const list=await peers();
    await Promise.allSettled(list.map(p=>meeting.sendSignal(p.participantId,'host:spotlight',{participantId:next,at:new Date().toISOString()})));
  }
  function ensureRenameDialog(){
    if(renameDialog?.isConnected)return renameDialog;
    renameDialog=document.createElement('dialog');renameDialog.className='zoom-rename-dialog';
    renameDialog.innerHTML='<form method="dialog"><h3>Rename participant</h3><label><span>Name</span><input maxlength="100" autocomplete="off"></label><p class="zoom-rename-status" role="status"></p><div><button type="button" class="secondary" data-rename-cancel>Cancel</button><button type="submit" class="primary">Rename</button></div></form>';
    document.body.append(renameDialog);renameDialog.querySelector('[data-rename-cancel]').onclick=()=>renameDialog.close();return renameDialog;
  }
  async function renameParticipant(participantId,currentName){
    const dialog=ensureRenameDialog(),input=dialog.querySelector('input'),status=dialog.querySelector('.zoom-rename-status'),form=dialog.querySelector('form');
    input.value=String(currentName||'');status.textContent='';if(!dialog.open)dialog.showModal();setTimeout(()=>{input.focus();input.select();},20);
    form.onsubmit=async event=>{event.preventDefault();const name=String(input.value||'').trim();if(!name)return status.textContent='Enter a name.';const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
      try{await meeting.renameParticipant(participantId,name);dialog.close();}catch(error){status.textContent=String(error?.message||error||'Rename failed.');}finally{buttons.forEach(b=>b.disabled=false);}
    };
  }
  async function openParticipantActions(button,row){
    const localRole=role();if(!['host','co-host','cohost'].includes(localRole))return;
    const participantId=String(row.dataset.participantId||''),targetRole=String(row.dataset.participantRole||'participant').toLowerCase(),name=String(row.dataset.participantName||'Participant');
    const menu=participantMenuAt(button);
    const add=(label,action,{danger=false,disabled=false}={})=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;if(danger)b.classList.add('danger');b.onclick=()=>{closeParticipantMenu();void action();};menu.append(b);};
    const isHost=localRole==='host';
    if(targetRole!=='host'){
      add('Mute',()=>sendHostCommand(participantId,'mute'));
      add('Ask to Unmute',()=>sendHostCommand(participantId,'ask-unmute'));
      add('Stop Video',()=>sendHostCommand(participantId,'stop-video'));
      add(spotlightParticipantId===participantId?'Remove Spotlight':'Spotlight for Everyone',()=>setSpotlight(participantId));
      add('Rename',()=>renameParticipant(participantId,name));
      if(isHost)add(targetRole==='cohost'?'Remove Co-host':'Make Co-host',()=>meeting.setCohost(participantId,targetRole!=='cohost'));
      add('Remove',()=>meeting.removeParticipant(participantId),{danger:true});
    }
  }
  function patchParticipantControls(){
    const localRole=role();if(!['host','co-host','cohost'].includes(localRole))return;
    for(const row of qa('#participantRoster .person-row')){
      if(row.dataset.zoomActionsInstalled)return void 0;
      row.dataset.zoomActionsInstalled='1';
      const targetRole=String(row.dataset.participantRole||'participant').toLowerCase();
      if(targetRole==='host')continue;
      const actions=row.querySelector('.participant-actions')||(()=>{const span=document.createElement('span');span.className='participant-actions';row.append(span);return span;})();
      const more=document.createElement('button');more.type='button';more.className='mini-btn zoom-participant-more';more.textContent='More';more.setAttribute('aria-label',`More options for ${row.dataset.participantName||'participant'}`);more.onclick=event=>{event.stopPropagation();void openParticipantActions(more,row);};actions.append(more);
    }
  }
  async function senderAuthority(fromParticipantId){
    const list=await peers();const sender=list.find(p=>String(p.participantId)===String(fromParticipantId));
    const senderRole=String(sender?.role||'').toLowerCase();return {sender,allowed:['host','cohost'].includes(senderRole)};
  }
  function ensureUnmuteDialog(name){
    let dialog=q('#zoomUnmuteRequestDialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='zoomUnmuteRequestDialog';dialog.className='zoom-unmute-dialog';
    dialog.innerHTML='<div><h3>Unmute microphone?</h3><p class="zoom-unmute-copy"></p><div><button type="button" class="secondary" data-unmute-decline>Stay Muted</button><button type="button" class="primary" data-unmute-accept>Unmute</button></div></div>';
    document.body.append(dialog);return dialog;
  }
  async function handleHostControl(event){
    const detail=event.detail||{},type=String(detail.type||'');if(!type.startsWith('host:'))return;
    const {sender,allowed}=await senderAuthority(detail.fromParticipantId);if(!allowed)return;
    const command=type.slice(5),payload=detail.payload||{};
    if(command==='mute'){try{await media()?.setMicrophone?.(false);}catch{}return;}
    if(command==='stop-video'){try{await media()?.setCamera?.(false);}catch{}return;}
    if(command==='ask-unmute'){
      const dialog=ensureUnmuteDialog();dialog.querySelector('.zoom-unmute-copy').textContent=`${String(sender?.displayName||'The host')} asked you to unmute.`;
      dialog.querySelector('[data-unmute-decline]').onclick=()=>dialog.close();
      dialog.querySelector('[data-unmute-accept]').onclick=async()=>{dialog.close();try{await media()?.setMicrophone?.(true);}catch{}};
      if(!dialog.open)dialog.showModal();return;
    }
    if(command==='spotlight'){
      spotlightParticipantId=String(payload.participantId||'');window.dispatchEvent(new CustomEvent('dominion:spotlight-change',{detail:{participantId:spotlightParticipantId}}));return;
    }
  }
  window.addEventListener('dominion:meeting-signal',event=>void handleHostControl(event),true);
  document.addEventListener('pointerdown',event=>{if(participantMenu&&!participantMenu.contains(event.target)&&!event.target.closest?.('.zoom-participant-more'))closeParticipantMenu();},true);

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
    installLeaveGuard();patchChat();syncAdmitAll();patchParticipantControls();
    const exit=q('#roomExitButton');if(exit&&role()==='host'){
      const label=exit.querySelector('.ds-control-label');if(label)label.textContent='End';else exit.textContent='End';
      exit.setAttribute('aria-label','End or leave meeting');
    }
    if(chatPatched&&!q('#meetingChatPanel')?.hidden)void refreshChatRecipients();
  }

  const syncTimer=setInterval(sync,900);
  sync();
  window.DominionZoomBehavior=Object.freeze({version:'1.2.0',sync,admitAll,refreshChatRecipients,showHostHandoffChoices,setSpotlight,dispose:()=>clearInterval(syncTimer)});
})();
