(()=>{
  'use strict';
  if(window.DominionScheduleController)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const STORE='ds_meet_scheduled_v2';
  const MAX_ITEMS=80;
  const esc=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const digits=value=>String(value||'').replace(/\D/g,'').slice(0,10);
  const formatId=value=>{const d=digits(value);return d.length>6?`${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`:d.length>3?`${d.slice(0,3)} ${d.slice(3)}`:d;};
  const randomPasscode=()=>String(Math.floor(100000+Math.random()*900000));
  const identity=()=>String(q('#profileName')?.textContent||'DominionStar Member').trim()||'DominionStar Member';
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
  const write=items=>{try{localStorage.setItem(STORE,JSON.stringify(items.slice(0,MAX_ITEMS)));}catch{}};
  const whenMs=item=>Date.parse(`${item.date||''}T${item.time||'00:00'}`)||0;
  const sortItems=items=>items.slice().sort((a,b)=>whenMs(a)-whenMs(b));
  const activeItems=()=>sortItems(read().filter(item=>item.status!=='deleted'&&item.status!=='ended'));
  let busy=false,pendingScheduledId='',activeScheduledId='',inScheduledMeeting=false;

  function defaultSchedule(){
    const d=new Date(Date.now()+60*60*1000);d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0);
    const date=q('#scheduleDate'),time=q('#scheduleTime'),topic=q('#scheduleTopic'),duration=q('#scheduleDuration');
    if(date&&!date.value)date.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    if(time&&!time.value)time.value=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    if(topic&&!topic.value)topic.value='DominionStar Meeting';
    if(duration&&!duration.value)duration.value='60';
  }
  function formatWhen(item){try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${item.date}T${item.time}`));}catch{return `${item.date||''} ${item.time||''}`.trim();}}
  function inviteText(item){return `${item.title}\nMeeting ID: ${formatId(item.roomCode)}\nPasscode: ${item.passcode}\nScheduled: ${formatWhen(item)}`;}
  async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}
  function updateRecord(id,patch){const items=read();const index=items.findIndex(item=>item.id===id);if(index<0)return false;items[index]={...items[index],...patch};write(items);render();return true;}

  function renderHome(items){
    const card=q('.upcoming-card');if(!card)return;
    let host=card.querySelector('.scheduled-home-list');if(!host){host=document.createElement('div');host.className='scheduled-home-list';card.append(host);}
    const empty=card.querySelector('.empty-state');
    const upcoming=items.filter(item=>item.status==='scheduled'&&whenMs(item)>=Date.now()-15*60*1000).slice(0,3);
    if(!upcoming.length){if(empty)empty.hidden=false;host.hidden=true;host.innerHTML='';return;}
    if(empty)empty.hidden=true;host.hidden=false;
    host.innerHTML=upcoming.map(item=>`<article class="scheduled-mini" data-scheduled-id="${esc(item.id)}"><div><strong>${esc(item.title)}</strong><small>${esc(formatWhen(item))}</small></div><span>${esc(formatId(item.roomCode))}</span></article>`).join('');
  }
  function renderMeetings(items){
    const list=q('#scheduledMeetingList');if(!list)return;
    if(!items.length){list.innerHTML='<div class="meetings-empty"><strong>No meetings scheduled</strong><p>Use Schedule to create a meeting with a real Meeting ID and passcode.</p><button type="button" class="secondary-button" data-open-schedule-empty>Schedule a meeting</button></div>';list.querySelector('[data-open-schedule-empty]')?.addEventListener('click',()=>{defaultSchedule();q('#scheduleDialog')?.showModal();});return;}
    list.innerHTML=items.map(item=>`<article class="scheduled-row" data-scheduled-id="${esc(item.id)}"><div class="scheduled-time"><strong>${esc(formatWhen(item))}</strong><small>${Number(item.duration)||60} min</small></div><div class="scheduled-copy"><strong>${esc(item.title)}</strong><small>Meeting ID ${esc(formatId(item.roomCode))} · Passcode ${esc(item.passcode)}</small></div><div class="scheduled-actions"><button type="button" data-scheduled-start>${item.status==='started'?'Rejoin':'Start'}</button><button type="button" data-scheduled-copy>Copy invite</button><button type="button" data-scheduled-delete>Delete</button></div></article>`).join('');
    for(const row of qa('.scheduled-row')){
      const id=row.dataset.scheduledId,item=items.find(value=>value.id===id);if(!item)continue;
      row.querySelector('[data-scheduled-start]').onclick=()=>start(item);
      row.querySelector('[data-scheduled-copy]').onclick=async event=>{const ok=await copyText(inviteText(item));event.currentTarget.textContent=ok?'Copied':'Copy failed';setTimeout(()=>{if(event.currentTarget.isConnected)event.currentTarget.textContent='Copy invite';},1400);};
      row.querySelector('[data-scheduled-delete]').onclick=()=>void remove(item);
    }
  }
  function render(){const items=activeItems();renderHome(items);renderMeetings(items);const count=q('#scheduledMeetingCount');if(count)count.textContent=String(items.length);}

  async function schedule(event){
    event.preventDefault();event.stopPropagation();if(busy)return;
    const dialog=q('#scheduleDialog'),status=q('#scheduleStatus'),submit=q('#scheduleSubmit');
    const title=String(q('#scheduleTopic')?.value||'').trim()||'DominionStar Meeting',date=String(q('#scheduleDate')?.value||''),time=String(q('#scheduleTime')?.value||''),duration=Math.max(15,Math.min(480,Number(q('#scheduleDuration')?.value)||60));
    if(!date||!time){if(status){status.hidden=false;status.textContent='Choose a date and time.';}return;}
    const startsAt=Date.parse(`${date}T${time}`);if(!Number.isFinite(startsAt)||startsAt<Date.now()-60_000){if(status){status.hidden=false;status.textContent='Choose a future start time.';}return;}
    if(!meeting?.create){if(status){status.hidden=false;status.textContent='Scheduling requires the installed DominionStar Meet desktop app.';}return;}
    busy=true;if(submit){submit.disabled=true;submit.textContent='Scheduling…';}if(status){status.hidden=false;status.textContent='Creating secure meeting credentials…';}
    const passcode=randomPasscode();
    try{
      // Meet V2 creates the secure room immediately. Waiting Room is forced on
      // so attendees cannot enter an unattended scheduled room before the host.
      const room=await meeting.create({title,passcode,waitingRoomEnabled:true,externalGuestsAllowed:true});
      const item={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,roomId:String(room.roomId||''),roomCode:String(room.roomCode||''),participantId:String(room.participantId||''),joinToken:String(room.joinToken||''),title,date,time,duration,passcode,createdAt:new Date().toISOString(),status:'scheduled'};
      const items=read();items.push(item);write(sortItems(items));
      if(status)status.textContent=`Scheduled · Meeting ID ${formatId(item.roomCode)}`;
      render();setTimeout(()=>{dialog?.close();if(status)status.hidden=true;},500);
    }catch(error){if(status){status.hidden=false;status.textContent=String(error?.message||error||'Unable to schedule this meeting.');}}
    finally{busy=false;if(submit){submit.disabled=false;submit.textContent='Schedule';}}
  }

  function start(item){
    const join=q('#joinDialog');if(!join)return;
    const room=q('#joinRoomCode'),pass=q('#joinPasscode'),name=q('#joinDisplayName');
    if(room)room.value=formatId(item.roomCode);if(pass)pass.value=item.passcode;if(name&&!name.value)name.value=identity();
    pendingScheduledId=item.id;document.body.dataset.scheduledHostTitle=item.title;join.showModal();
  }
  async function remove(item){
    const items=read().filter(value=>value.id!==item.id);write(items);render();
    if(item.roomId&&meeting?.end){try{await meeting.end(item.roomId);}catch{/* Room may already have ended; local deletion still succeeds. */}}
  }
  function beginScheduledPrejoin(){
    if(!pendingScheduledId)return;activeScheduledId=pendingScheduledId;pendingScheduledId='';document.body.dataset.scheduledHostStart='1';
  }
  function decorateScheduledPrejoin(){
    if(document.body.dataset.scheduledHostStart!=='1')return;
    const overlay=q('#prejoinOverlay');if(!overlay||overlay.hidden)return;
    const title=q('#prejoinTitle'),button=q('#prejoinContinue');if(title)title.textContent=document.body.dataset.scheduledHostTitle||'DominionStar Meeting';if(button)button.textContent='Start';
  }
  function cancelScheduledPrejoin(){activeScheduledId='';inScheduledMeeting=false;document.body.dataset.scheduledHostStart='';document.body.dataset.scheduledHostTitle='';}
  function syncScheduledLifecycle(){
    const visible=Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
    if(activeScheduledId&&visible&&!inScheduledMeeting){inScheduledMeeting=true;updateRecord(activeScheduledId,{status:'started',startedAt:new Date().toISOString()});document.body.dataset.scheduledHostStart='';}
    else if(activeScheduledId&&inScheduledMeeting&&!visible){updateRecord(activeScheduledId,{status:'ended',endedAt:new Date().toISOString()});activeScheduledId='';inScheduledMeeting=false;document.body.dataset.scheduledHostTitle='';}
  }

  function install(){
    const form=q('#scheduleForm');if(form&&!form.dataset.dsScheduleBound){form.dataset.dsScheduleBound='1';form.addEventListener('submit',event=>void schedule(event));}
    document.addEventListener('click',event=>{if(event.target.closest?.('[data-open="schedule"]'))defaultSchedule();if(event.target.closest?.('#prejoinCancel,#closePrejoin'))cancelScheduledPrejoin();});
    document.addEventListener('submit',event=>{if(event.target?.id==='joinMeetingForm'&&pendingScheduledId)beginScheduledPrejoin();},true);
    q('#scheduleDuration')?.addEventListener('input',event=>{event.target.value=String(Math.max(15,Math.min(480,Number(event.target.value)||60)));});
    render();
  }
  const observer=new MutationObserver(()=>{decorateScheduledPrejoin();syncScheduledLifecycle();});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  install();
  window.addEventListener('storage',event=>{if(event.key===STORE)render();});
  window.DominionScheduleController=Object.freeze({render,read:()=>activeItems(),startById:id=>{const item=activeItems().find(value=>value.id===id);if(item)start(item);return Boolean(item);}});
})();
