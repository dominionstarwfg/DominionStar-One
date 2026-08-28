(()=>{
  'use strict';
  if(window.DominionScheduleController)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const state={items:[],busy:false,loaded:false,error:''};
  const esc=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const digits=value=>String(value||'').replace(/\D/g,'').slice(0,11);
  const formatId=value=>{const d=digits(value);return d.length>6?`${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`:d.length>3?`${d.slice(0,3)} ${d.slice(3)}`:d;};
  const randomPasscode=()=>String(Math.floor(100000+Math.random()*900000));
  const whenMs=item=>Date.parse(String(item.scheduledStart||''))||0;
  const sortItems=items=>items.slice().sort((a,b)=>whenMs(a)-whenMs(b));
  const activeItems=()=>sortItems(state.items.filter(item=>!['cancelled'].includes(String(item.status||''))));
  const upcomingItems=()=>activeItems().filter(item=>String(item.status||'scheduled')==='scheduled'&&(!whenMs(item)||whenMs(item)>=Date.now()-15*60*1000));

  function formatWhen(item){try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.scheduledStart));}catch{return 'No fixed time';}}
  function recurrenceLabel(item){const r=item.recurrence||{},repeat=String(r.repeat||'never');if(repeat==='never')return 'One-time';if(repeat==='weekday')return 'Every weekday';if(repeat==='custom')return `Every ${Number(r.interval)||1} ${String(r.unit||'week')}${Number(r.interval)===1?'':'s'}`;return `Every ${repeat.replace(/ly$/,'')}`;}
  function inviteText(item){return `${item.title}\nMeeting ID: ${formatId(item.roomCode)}\nPasscode: ${item.passcode}\n${recurrenceLabel(item)} · ${formatWhen(item)}`;}
  async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}

  function ensureScheduleOptions(){
    const form=q('#scheduleForm');if(!form||q('#scheduleMeetingIdMode'))return;
    const topic=q('#scheduleTopic')?.closest('label'),dateRow=q('#scheduleDate')?.closest('.two-col'),duration=q('#scheduleDuration')?.closest('label');
    const identity=document.createElement('div');identity.className='schedule-option-grid';identity.innerHTML=`<label><span>Meeting ID</span><select id="scheduleMeetingIdMode"><option value="auto">Generate Automatically</option><option value="personal">Personal Meeting ID</option></select></label><label id="schedulePasscodeField"><span>Passcode</span><input id="schedulePasscode" inputmode="numeric" pattern="[0-9]{3,7}" minlength="3" maxlength="7" value="${randomPasscode()}" required><small>3–7 digits</small></label>`;
    topic?.insertAdjacentElement('afterend',identity);
    const recurrence=document.createElement('div');recurrence.className='schedule-repeat-block';recurrence.innerHTML=`<label><span>Repeat</span><select id="scheduleRepeat"><option value="never">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="weekday">Every weekday</option><option value="custom">Custom</option></select></label><div id="scheduleCustomRepeat" class="schedule-option-grid" hidden><label><span>Repeat every</span><input id="scheduleRepeatInterval" type="number" min="1" max="12" value="1"></label><label><span>Unit</span><select id="scheduleRepeatUnit"><option value="day">Day(s)</option><option value="week" selected>Week(s)</option><option value="month">Month(s)</option></select></label></div>`;
    duration?.insertAdjacentElement('afterend',recurrence);
    const mode=q('#scheduleMeetingIdMode'),passField=q('#schedulePasscodeField'),pass=q('#schedulePasscode'),repeat=q('#scheduleRepeat'),custom=q('#scheduleCustomRepeat');
    const syncMode=()=>{const personal=mode.value==='personal';passField.hidden=personal;pass.required=!personal;if(personal&&repeat.value!=='never')repeat.value='never';custom.hidden=repeat.value!=='custom';};
    mode.addEventListener('change',syncMode);repeat.addEventListener('change',()=>{if(mode.value==='personal'&&repeat.value!=='never'){repeat.value='never';const status=q('#scheduleStatus');if(status){status.hidden=false;status.textContent='Personal Meeting ID is an anytime reusable room. Use Generate Automatically for fixed recurring meetings.';}}custom.hidden=repeat.value!=='custom';});syncMode();
    const security=q('.schedule-security');if(security)security.innerHTML='<strong>Security</strong><span>3–7 digit passcode</span><span>Waiting Room on</span><span>External guests allowed</span>';
    if(dateRow)dateRow.dataset.scheduleIdentityReady='1';
  }

  function defaultSchedule(){
    ensureScheduleOptions();const d=new Date(Date.now()+60*60*1000);d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0);
    const date=q('#scheduleDate'),time=q('#scheduleTime'),topic=q('#scheduleTopic'),duration=q('#scheduleDuration'),pass=q('#schedulePasscode');
    if(date&&!date.value)date.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    if(time&&!time.value)time.value=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    if(topic&&!topic.value)topic.value='DominionStar Meeting';if(duration&&!duration.value)duration.value='60';if(pass)pass.value=randomPasscode();
  }

  async function refresh(){
    if(!meeting?.listSchedules)return;try{const result=await meeting.listSchedules();state.items=Array.isArray(result)?result:[];state.loaded=true;state.error='';render();}catch(error){state.error=String(error?.message||error||'Unable to load scheduled meetings.');state.loaded=true;render();}
  }
  function renderHome(items){
    const card=q('.upcoming-card');if(!card)return;let host=card.querySelector('.scheduled-home-list');if(!host){host=document.createElement('div');host.className='scheduled-home-list';card.append(host);}const empty=card.querySelector('.empty-state'),upcoming=upcomingItems().slice(0,3);
    if(!upcoming.length){if(empty)empty.hidden=false;host.hidden=true;host.innerHTML='';return;}if(empty)empty.hidden=true;host.hidden=false;
    host.innerHTML=upcoming.map(item=>`<article class="scheduled-mini"><div><strong>${esc(item.title)}</strong><small>${esc(recurrenceLabel(item))} · ${esc(formatWhen(item))}</small></div><span>${esc(formatId(item.roomCode))}</span></article>`).join('');
  }
  function renderMeetings(items){
    const list=q('#scheduledMeetingList');if(!list)return;
    if(!items.length){list.innerHTML=`<div class="meetings-empty"><strong>${state.error?'Scheduled meetings unavailable':'No meetings scheduled'}</strong><p>${esc(state.error||'Use Schedule to create a meeting with its own Meeting ID and passcode.')}</p><button type="button" class="secondary-button" data-open-schedule-empty>Schedule a meeting</button></div>`;list.querySelector('[data-open-schedule-empty]')?.addEventListener('click',()=>{defaultSchedule();q('#scheduleDialog')?.showModal();});return;}
    list.innerHTML=items.map(item=>`<article class="scheduled-row" data-schedule-id="${esc(item.scheduleId)}"><div class="scheduled-time"><strong>${esc(formatWhen(item))}</strong><small>${Number(item.durationMinutes)||60} min · ${esc(recurrenceLabel(item))}</small></div><div class="scheduled-copy"><strong>${esc(item.title)}</strong><small>Meeting ID ${esc(formatId(item.roomCode))} · Passcode ${esc(item.passcode)}</small></div><div class="scheduled-actions"><button type="button" data-scheduled-start>${item.status==='started'?'Rejoin':'Start'}</button><button type="button" data-scheduled-copy>Copy invite</button><button type="button" data-scheduled-delete>Delete</button></div></article>`).join('');
    for(const row of qa('.scheduled-row')){const item=items.find(value=>String(value.scheduleId)===row.dataset.scheduleId);if(!item)continue;row.querySelector('[data-scheduled-start]').onclick=()=>void start(item);row.querySelector('[data-scheduled-copy]').onclick=async event=>{const ok=await copyText(inviteText(item));event.currentTarget.textContent=ok?'Copied':'Copy failed';setTimeout(()=>{if(event.currentTarget.isConnected)event.currentTarget.textContent='Copy invite';},1400);};row.querySelector('[data-scheduled-delete]').onclick=()=>void remove(item);}
  }
  function render(){const items=activeItems();renderHome(items);renderMeetings(items);const count=q('#scheduledMeetingCount');if(count)count.textContent=String(items.length);}

  function recurrenceValue(){const repeat=String(q('#scheduleRepeat')?.value||'never');if(repeat==='never')return null;if(repeat==='custom')return {repeat,interval:Math.max(1,Math.min(12,Number(q('#scheduleRepeatInterval')?.value)||1)),unit:String(q('#scheduleRepeatUnit')?.value||'week')};return {repeat,interval:1};}
  async function schedule(event){
    event.preventDefault();event.stopPropagation();if(state.busy)return;ensureScheduleOptions();
    const dialog=q('#scheduleDialog'),status=q('#scheduleStatus'),submit=q('#scheduleSubmit'),title=String(q('#scheduleTopic')?.value||'').trim()||'DominionStar Meeting',date=String(q('#scheduleDate')?.value||''),time=String(q('#scheduleTime')?.value||''),duration=Math.max(15,Math.min(480,Number(q('#scheduleDuration')?.value)||60)),mode=String(q('#scheduleMeetingIdMode')?.value||'auto'),passcode=digits(q('#schedulePasscode')?.value).slice(0,7),recurrence=recurrenceValue();
    if(!date||!time){status.hidden=false;status.textContent='Choose a date and time.';return;}const startsAt=new Date(`${date}T${time}`);if(!Number.isFinite(startsAt.getTime())||startsAt.getTime()<Date.now()-60_000){status.hidden=false;status.textContent='Choose a future start time.';return;}
    if(mode==='personal'&&recurrence){status.hidden=false;status.textContent='Personal Meeting ID is already reusable at any time. Use Generate Automatically for a fixed recurring series.';return;}
    if(mode!=='personal'&&!/^\d{3,7}$/.test(passcode)){status.hidden=false;status.textContent='Passcode must contain 3 to 7 digits.';return;}
    if(!meeting?.schedule){status.hidden=false;status.textContent='Scheduling requires the persistent meeting-identity backend.';return;}
    state.busy=true;submit.disabled=true;submit.textContent='Scheduling…';status.hidden=false;status.textContent='Creating meeting identity…';
    try{const item=await meeting.schedule({title,passcode,scheduledStart:startsAt.toISOString(),durationMinutes:duration,recurrence,waitingRoomEnabled:true,externalGuestsAllowed:true,usePersonalRoom:mode==='personal'});status.textContent=`Scheduled · Meeting ID ${formatId(item.roomCode)}`;await refresh();setTimeout(()=>{dialog?.close();status.hidden=true;},450);}
    catch(error){status.textContent=String(error?.message||error||'Unable to schedule this meeting.');}
    finally{state.busy=false;submit.disabled=false;submit.textContent='Schedule';}
  }
  async function start(item){
    try{const room=await meeting.startSchedule(item.scheduleId);window.DominionPersonalRoom?.beginHostPrejoin?.({...room,title:item.title,passcode:item.passcode},'schedule');await refresh();}
    catch(error){const status=q('#scheduleStatus');if(status){status.hidden=false;status.textContent=String(error?.message||error||'Unable to start this meeting.');}}
  }
  async function remove(item){try{await meeting.cancelSchedule(item.scheduleId);await refresh();}catch(error){state.error=String(error?.message||error);render();}}

  function install(){ensureScheduleOptions();const form=q('#scheduleForm');if(form&&!form.dataset.dsScheduleBound){form.dataset.dsScheduleBound='1';form.addEventListener('submit',event=>void schedule(event));}document.addEventListener('click',event=>{if(event.target.closest?.('[data-open="schedule"]'))defaultSchedule();});q('#scheduleDuration')?.addEventListener('input',event=>{event.target.value=String(Math.max(15,Math.min(480,Number(event.target.value)||60)));});void refresh();}
  const observer=new MutationObserver(()=>{ensureScheduleOptions();if(q('#appShell')&&!q('#appShell').hidden&&!state.loaded)void refresh();});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  install();setInterval(()=>{if(q('#appShell')&&!q('#appShell').hidden)void refresh();},15000);
  window.DominionScheduleController=Object.freeze({render,refresh,read:()=>activeItems(),startById:id=>{const item=activeItems().find(value=>String(value.scheduleId)===String(id));if(item)void start(item);return Boolean(item);}});
})();
