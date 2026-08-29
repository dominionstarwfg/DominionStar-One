(()=>{
  'use strict';
  if(window.DominionPersonalRoom)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const state={room:null,loading:false,error:'',hostStart:null};
  const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const digits=v=>String(v||'').replace(/\D/g,'');
  const formatId=v=>{const d=digits(v);return d.length>6?`${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`:d.length>3?`${d.slice(0,3)} ${d.slice(3)}`:d;};
  const randomPasscode=()=>String(Math.floor(100000+Math.random()*900000));
  const signedIn=()=>Boolean(q('#appShell')&&!q('#appShell').hidden&&q('#profileName')?.textContent?.trim());

  async function load(force=false){
    if(!meeting?.personalRoom||state.loading||(!force&&state.room)||!signedIn())return state.room;
    state.loading=true;state.error='';
    try{state.room=await meeting.personalRoom();render();return state.room;}
    catch(error){state.error=String(error?.message||error||'Personal Room unavailable.');render();return null;}
    finally{state.loading=false;}
  }

  function ensureEditDialog(){
    let dialog=q('#personalRoomDialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='personalRoomDialog';dialog.className='modal personal-room-modal';
    dialog.innerHTML=`<form id="personalRoomForm"><header><div><p class="eyebrow">PERSONAL ROOM</p><h2>Personal Meeting Room</h2></div><button class="modal-close" type="button" data-personal-close aria-label="Close">×</button></header><div class="personal-id-readout"><span>Personal Meeting ID</span><strong id="personalRoomId">—</strong><small>This ID stays the same unless the Personal Room is replaced.</small></div><label><span>Passcode</span><input id="personalRoomPasscode" inputmode="numeric" pattern="[0-9]{3,7}" minlength="3" maxlength="7" required><small>3–7 digits. Changing the passcode does not change the Personal Meeting ID.</small></label><label class="personal-toggle"><span><strong>Use Personal Meeting ID for instant meetings</strong><small>When enabled, New Meeting reuses this Personal Room.</small></span><input id="personalUseInstant" type="checkbox"></label><label class="personal-toggle"><span><strong>Waiting Room</strong><small>Participants wait for the host to admit them.</small></span><input id="personalWaiting" type="checkbox"></label><label class="personal-toggle"><span><strong>Allow external guests</strong><small>Guests may join with the Meeting ID and passcode.</small></span><input id="personalGuests" type="checkbox"></label><p id="personalRoomStatus" class="schedule-status" role="status" aria-live="polite" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-personal-close>Cancel</button><button id="personalRoomSave" type="submit" class="primary-button">Save</button></div></form>`;
    document.body.append(dialog);
    qa('[data-personal-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
    dialog.querySelector('form').addEventListener('submit',event=>void save(event));
    return dialog;
  }

  async function openEditor(){
    await load(true);if(!state.room)return;
    const dialog=ensureEditDialog();q('#personalRoomId').textContent=formatId(state.room.roomCode);q('#personalRoomPasscode').value=String(state.room.passcode||'');q('#personalUseInstant').checked=state.room.useForInstant!==false;q('#personalWaiting').checked=state.room.waitingRoomEnabled!==false;q('#personalGuests').checked=state.room.externalGuestsAllowed!==false;q('#personalRoomStatus').hidden=true;if(!dialog.open)dialog.showModal();
  }
  async function save(event){
    event.preventDefault();const status=q('#personalRoomStatus'),button=q('#personalRoomSave'),passcode=digits(q('#personalRoomPasscode')?.value);
    if(!/^\d{3,7}$/.test(passcode)){status.hidden=false;status.textContent='Passcode must contain 3 to 7 digits.';return;}
    button.disabled=true;status.hidden=false;status.textContent='Saving Personal Room…';
    try{state.room=await meeting.updatePersonalRoom({passcode,useForInstant:q('#personalUseInstant').checked,waitingRoomEnabled:q('#personalWaiting').checked,externalGuestsAllowed:q('#personalGuests').checked});status.textContent='Personal Room saved.';render();setTimeout(()=>q('#personalRoomDialog')?.close(),450);}
    catch(error){status.textContent=String(error?.message||error||'Unable to save Personal Room.');}
    finally{button.disabled=false;}
  }

  function ensureSettingsRow(){
    const list=q('#settingsDialog .settings-list');if(!list||q('[data-personal-room-settings]'))return;
    const row=document.createElement('button');row.type='button';row.className='settings-row';row.dataset.personalRoomSettings='1';row.innerHTML='<span><strong>Personal Room</strong><small>Personal Meeting ID, passcode, Waiting Room</small></span><span>›</span>';row.onclick=()=>{q('#settingsDialog')?.close();void openEditor();};
    const meetingRow=[...list.querySelectorAll('.settings-row')].find(x=>x.querySelector('strong')?.textContent?.trim()==='Meetings');meetingRow?.insertAdjacentElement('afterend',row)||list.prepend(row);
  }

  function ensureMeetingCard(){
    const section=q('#meetingsSection'),list=q('#scheduledMeetingList');if(!section||!list)return null;
    let card=q('#personalRoomCard');if(card)return card;
    card=document.createElement('section');card.id='personalRoomCard';card.className='personal-room-card';list.insertAdjacentElement('beforebegin',card);return card;
  }
  function renderCard(){
    const card=ensureMeetingCard();if(!card)return;
    if(!state.room){card.innerHTML=`<div><p class="eyebrow">PERSONAL ROOM</p><h2>Personal Meeting Room</h2><p>${esc(state.error||'Loading your permanent meeting room…')}</p></div>`;return;}
    card.innerHTML=`<div class="personal-room-copy"><p class="eyebrow">PERSONAL ROOM</p><h2>Personal Meeting Room</h2><p>Your permanent DominionStar meeting room for people you meet with regularly.</p><div class="personal-credentials"><span><small>Meeting ID</small><strong>${esc(formatId(state.room.roomCode))}</strong></span><span><small>Passcode</small><strong>${esc(state.room.passcode)}</strong></span></div></div><div class="personal-room-actions"><button type="button" class="primary-button" data-personal-start>Start</button><button type="button" class="secondary-button" data-personal-copy>Copy invite</button><button type="button" class="secondary-button" data-personal-edit>Edit</button></div>`;
    card.querySelector('[data-personal-start]').onclick=()=>void startPersonal();card.querySelector('[data-personal-edit]').onclick=()=>void openEditor();card.querySelector('[data-personal-copy]').onclick=async e=>{const text=`DominionStar Meet\nMeeting ID: ${formatId(state.room.roomCode)}\nPasscode: ${state.room.passcode}`;try{await navigator.clipboard.writeText(text);e.currentTarget.textContent='Copied';setTimeout(()=>{if(e.currentTarget.isConnected)e.currentTarget.textContent='Copy invite';},1200);}catch{}};
  }

  function configureNewMeeting(){
    const form=q('#newMeetingForm');if(!form||form.dataset.dsPersonalConfigured)return;
    form.dataset.dsPersonalConfigured='1';
    const passInput=q('#newMeetingPasscode');if(passInput){passInput.maxLength=7;passInput.pattern='[0-9]{3,7}';}
    const passLabel=passInput?.closest('label');
    const choice=document.createElement('div');choice.className='personal-new-meeting-choice';choice.innerHTML='<label class="personal-toggle"><span><strong>Use Personal Meeting ID</strong><small id="newMeetingPersonalSummary">Use your permanent Personal Room.</small></span><input id="newMeetingUsePersonal" type="checkbox"></label>';
    passLabel?.insertAdjacentElement('beforebegin',choice);
    const toggle=q('#newMeetingUsePersonal');
    const sync=()=>{const personal=Boolean(toggle?.checked);if(passLabel)passLabel.hidden=personal;if(personal&&state.room)q('#newMeetingPersonalSummary').textContent=`${formatId(state.room.roomCode)} · Passcode ${state.room.passcode}`;else q('#newMeetingPersonalSummary').textContent='Use your permanent Personal Room.';};
    toggle?.addEventListener('change',sync);
    form.addEventListener('submit',async event=>{
      if(!toggle?.checked||!state.room)return;
      event.preventDefault();event.stopImmediatePropagation();const button=q('#startMeetingButton'),error=q('#newMeetingError');button.disabled=true;error.hidden=true;
      try{const room=await meeting.startPersonalRoom();state.hostStart=room;q('#newMeetingDialog')?.close();beginHostPrejoin(room,'personal');}
      catch(e){error.textContent=String(e?.message||e);error.hidden=false;}
      finally{button.disabled=false;}
    },true);
    q('[data-action="new-meeting"]')?.addEventListener('click',()=>{void load().then(()=>{toggle.checked=Boolean(state.room&&state.room.useForInstant!==false);if(!toggle.checked&&passInput)passInput.value=randomPasscode();sync();});},true);
    sync();
  }

  function beginHostPrejoin(room,kind){
    const join=q('#joinDialog'),form=q('#joinMeetingForm');if(!join||!form)return;
    q('#joinRoomCode').value=formatId(room.roomCode);q('#joinPasscode').value=room.passcode;const name=q('#joinDisplayName');if(name&&!name.value)name.value=q('#profileName')?.textContent||'DominionStar Member';
    document.body.dataset.persistentHostStart=kind;document.body.dataset.persistentHostRoomId=String(room.roomId||'');document.body.dataset.persistentHostTitle=kind==='personal'?'Personal Meeting Room':String(room.title||'DominionStar Meeting');
    if(join.open)join.close();form.requestSubmit();
  }
  async function startPersonal(){await load(true);if(!state.room)return;try{const room=await meeting.startPersonalRoom();state.hostStart=room;beginHostPrejoin(room,'personal');}catch(error){state.error=String(error?.message||error);renderCard();}}

  function decorateHostPrejoin(){
    const kind=document.body.dataset.persistentHostStart;if(!kind)return;const overlay=q('#prejoinOverlay');if(!overlay||overlay.hidden)return;
    const title=q('#prejoinTitle'),button=q('#prejoinContinue'),nextTitle=document.body.dataset.persistentHostTitle||'DominionStar Meeting';
    if(title&&title.textContent!==nextTitle)title.textContent=nextTitle;
    if(button&&button.textContent!=='Start')button.textContent='Start';
  }
  function interceptHostCancel(){
    for(const id of ['#prejoinCancel','#closePrejoin']){const b=q(id);if(!b||b.dataset.dsPersistentCancel)return;b.dataset.dsPersistentCancel='1';b.addEventListener('click',()=>{const roomId=document.body.dataset.persistentHostRoomId;if(roomId)void meeting?.end?.(roomId).catch(()=>{});clearHostStart();},true);}
  }
  function clearHostStart(){document.body.dataset.persistentHostStart='';document.body.dataset.persistentHostRoomId='';document.body.dataset.persistentHostTitle='';state.hostStart=null;}
  function watchMeetingEntry(){if(q('#meetingOverlay')&&!q('#meetingOverlay').hidden&&document.body.dataset.persistentHostStart)clearHostStart();}
  function render(){ensureSettingsRow();renderCard();configureNewMeeting();if(state.room){const small=q('.action-card.new-meeting small');if(small)small.textContent=state.room.useForInstant!==false?'Start your Personal Room':'Start instantly';}}

  const observer=new MutationObserver(()=>{ensureSettingsRow();configureNewMeeting();decorateHostPrejoin();interceptHostCancel();watchMeetingEntry();if(signedIn()&&!state.room&&!state.loading)void load();});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  setInterval(()=>{if(signedIn()&&!state.room&&!state.loading)void load();ensureSettingsRow();configureNewMeeting();},1000);
  ensureEditDialog();render();void load();
  window.DominionPersonalRoom=Object.freeze({load,room:()=>state.room,openEditor,start:startPersonal,beginHostPrejoin});
})();
