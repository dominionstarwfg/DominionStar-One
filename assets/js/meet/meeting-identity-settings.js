(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const ROOM_KEY = 'ds_meet_personal_room_v2';
  const LEGACY_ROOM_KEY = 'ds_meet_personal_room_v1';
  const PREF_KEY = 'ds_meet_identity_preferences_v1';
  const SCHEDULE_KEY = 'ds_meet_scheduled_v1';

  const randomDigits = length => Array.from({length},()=>Math.floor(Math.random()*10)).join('');
  const digitsOnly = value => String(value||'').replace(/\D/g,'');
  const formatMeetingId = value => {
    const digits=digitsOnly(value).slice(0,10);
    return digits.length===10?digits.replace(/(\d{3})(\d{3})(\d{4})/,'$1 $2 $3'):digits;
  };
  const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch(_){return fallback;}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}};
  const readRoom=()=>readJson(ROOM_KEY)||readJson(LEGACY_ROOM_KEY)||null;
  const readPrefs=()=>({
    usePersonalForInstant:true,
    defaultScheduleIdentity:'personal',
    generatedRequirePasscode:true,
    generatedWaitingRoom:false,
    ...readJson(PREF_KEY,{})
  });
  const savePrefs=value=>writeJson(PREF_KEY,value);

  const ensureRoom=()=>{
    let room=readRoom();
    if(room?.personalRoomId)return room;
    room={
      personalRoomId:randomDigits(10),
      personalLinkName:`member-${randomDigits(5)}`,
      passcode:randomDigits(6),
      waitingRoomEnabled:false
    };
    writeJson(ROOM_KEY,room);writeJson(LEGACY_ROOM_KEY,room);
    return room;
  };

  const ensureSettingsStyles=()=>{
    if(document.getElementById('dsMeetingSettingsPolish'))return;
    const style=document.createElement('style');
    style.id='dsMeetingSettingsPolish';
    style.textContent=`
      .personal-room-dialog .personal-room-body{display:grid;gap:14px!important;padding-top:18px!important}
      .personal-room-dialog .ds-identity-settings{display:grid;gap:14px;padding-bottom:4px}
      .personal-room-dialog .ds-settings-section-heading,.personal-room-dialog .ds-personal-room-heading{display:grid;gap:5px;margin:0;padding:0 1px}
      .personal-room-dialog .ds-settings-section-heading strong,.personal-room-dialog .ds-personal-room-heading strong{font-size:13px;letter-spacing:.02em;color:#f5f7fb}
      .personal-room-dialog .ds-settings-section-heading small,.personal-room-dialog .ds-personal-room-heading small{font-size:12px;line-height:1.45;color:#929fb1}
      .personal-room-dialog .ds-personal-room-heading{margin-top:4px;padding-top:18px;border-top:1px solid #ffffff18}
      .personal-room-dialog .schedule-toggle{margin:0!important}
      .personal-room-dialog .schedule-toggle>span{display:grid!important;gap:4px!important}
      .personal-room-dialog .schedule-toggle>span>strong{line-height:1.25}
      .personal-room-dialog .schedule-toggle>span>small{line-height:1.4}
      .personal-room-dialog .personal-room-body>label{margin:0!important}
      .personal-room-dialog .personal-room-body>label>span:first-child{display:block;margin-bottom:7px;line-height:1.3}
      .personal-room-dialog .personal-room-body>label>small{display:block;margin-top:7px;line-height:1.4}
    `;
    document.head.append(style);
  };

  const renamePersonalRoomLabels=()=>{
    const setLabel=(controlId,text)=>{
      const control=$(controlId);
      const label=control?.closest('label');
      const title=label?.querySelector(':scope > span:first-child');
      if(title)title.textContent=text;
    };
    setLabel('personalLinkName','Personal link');
    setLabel('personalRoomId','Personal Meeting ID');
    setLabel('personalRoomPasscode','Passcode');
    setLabel('personalRoomLink','Invite link');
  };

  const injectSettingsControls=()=>{
    const dialog=$('personalRoomDialog');
    if(!dialog)return;
    ensureSettingsStyles();
    const header=dialog.querySelector('header strong');
    const headerCopy=dialog.querySelector('header small');
    if(header)header.textContent='Meeting Settings';
    if(headerCopy)headerCopy.textContent='Set your meeting identity and Personal Room defaults.';
    const body=dialog.querySelector('.personal-room-body');
    if(!body)return;
    renamePersonalRoomLabels();
    if(body.querySelector('[data-ds-identity-settings="1"]'))return;

    const prefs=readPrefs();
    const section=document.createElement('section');
    section.dataset.dsIdentitySettings='1';
    section.className='ds-identity-settings';
    section.innerHTML=`
      <div class="ds-settings-section-heading"><strong>Meeting identity</strong><small>Choose which Meeting ID DominionStar uses for instant and scheduled meetings.</small></div>
      <label class="schedule-toggle"><input id="usePersonalForInstant" type="checkbox" ${prefs.usePersonalForInstant?'checked':''}><span><strong>Use Personal Room for instant meetings</strong><small>New Meeting opens your permanent Meeting ID instead of creating a new one.</small></span></label>
      <label><span>Default Meeting ID when scheduling</span><select id="defaultScheduleIdentity"><option value="personal" ${prefs.defaultScheduleIdentity==='personal'?'selected':''}>Personal Room</option><option value="generated" ${prefs.defaultScheduleIdentity==='generated'?'selected':''}>Generate a unique Meeting ID</option></select></label>
      <div class="ds-personal-room-heading"><strong>Personal Room</strong><small>Your permanent link, Meeting ID, passcode, and Waiting Room settings.</small></div>`;
    body.prepend(section);

    const persist=()=>{
      const current=readPrefs();
      savePrefs({
        ...current,
        usePersonalForInstant:Boolean($('usePersonalForInstant')?.checked),
        defaultScheduleIdentity:$('defaultScheduleIdentity')?.value==='generated'?'generated':'personal'
      });
    };
    ['usePersonalForInstant','defaultScheduleIdentity'].forEach(id=>$(id)?.addEventListener('change',persist));
  };

  const convertDashboardPersonalRoomToSettings=()=>{
    const button=$('personalMeetingAction');
    if(!button)return;
    const strong=button.querySelector('strong');
    const small=button.querySelector('small');
    if(strong)strong.textContent='Settings';
    if(small)small.textContent='Meeting identity & defaults';
    button.dataset.dsMeetingSettings='1';
  };

  const injectScheduleIdentity=()=>{
    const form=$('scheduleMeetingForm');
    if(!form||form.querySelector('[data-ds-schedule-identity="1"]'))return;
    const body=form.querySelector('.schedule-body');
    if(!body)return;
    const prefs=readPrefs();
    const room=ensureRoom();
    const block=document.createElement('label');
    block.dataset.dsScheduleIdentity='1';
    block.innerHTML=`<span>Meeting ID</span><select id="scheduleIdentity"><option value="personal" ${prefs.defaultScheduleIdentity==='personal'?'selected':''}>Personal Room — ${formatMeetingId(room.personalRoomId)}</option><option value="generated" ${prefs.defaultScheduleIdentity==='generated'?'selected':''}>Generate a unique Meeting ID</option></select><small>Personal Room keeps your permanent ID. Choose generated when the audience should not reuse your permanent room.</small>`;
    const duration=$('scheduleDuration')?.closest('label');
    if(duration)duration.after(block);else body.prepend(block);
    const syncPreview=()=>{
      const personal=$('scheduleIdentity')?.value!=='generated';
      const id=personal?room.personalRoomId:'Generated when saved';
      if($('scheduledIdPreview'))$('scheduledIdPreview').textContent=personal?formatMeetingId(id):id;
      if(personal){
        if($('scheduleRequirePasscode'))$('scheduleRequirePasscode').checked=Boolean(room.passcode);
        if($('scheduleWaitingRoom'))$('scheduleWaitingRoom').checked=Boolean(room.waitingRoomEnabled);
        if($('scheduledPasscodePreview'))$('scheduledPasscodePreview').textContent=room.passcode||'No passcode';
      }
    };
    $('scheduleIdentity')?.addEventListener('change',syncPreview);
    syncPreview();
  };

  const startPersonalInstant=event=>{
    const trigger=event.target.closest?.('#newMeetingAction');
    if(!trigger)return;
    const prefs=readPrefs();
    if(!prefs.usePersonalForInstant)return;
    const room=ensureRoom();
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    window.__DS_START_AS_HOST=true;
    window.__DS_WAITING_ROOM=Boolean(room.waitingRoomEnabled);
    window.__DS_MEETING_PASSCODE=String(room.passcode||'');
    if($('roomId'))$('roomId').value=formatMeetingId(room.personalRoomId);
    if($('meetingPasscode'))$('meetingPasscode').value=String(room.passcode||'');
    const params=new URLSearchParams({room:String(room.personalRoomId),personal:String(room.personalLinkName||''),host:'1'});
    history.replaceState(null,'',`${location.pathname}?${params.toString()}${new URLSearchParams(location.search).get('desktop')==='1'?'&desktop=1':''}`);
    if(typeof window.DominionStarEnterHostPrejoin==='function'){
      window.DominionStarEnterHostPrejoin({room:room.personalRoomId,passcode:room.passcode||'',waitingRoom:Boolean(room.waitingRoomEnabled),autoShare:false});
      return;
    }
    setTimeout(()=>trigger.click(),0);
  };

  const scheduleCapture=event=>{
    const form=event.target;
    if(form?.id!=='scheduleMeetingForm')return;
    const identity=$('scheduleIdentity')?.value||readPrefs().defaultScheduleIdentity;
    if(identity!=='personal')return;
    const room=ensureRoom();
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const topic=String($('scheduleTopic')?.value||'DominionStar Meeting').trim();
    const date=String($('scheduleDate')?.value||'');
    const time=String($('scheduleTime')?.value||'');
    const duration=Number($('scheduleDuration')?.value||60);
    const recurring=Boolean($('scheduleRecurring')?.checked);
    const frequency=String($('scheduleFrequency')?.value||'weekly');
    const requirePasscode=Boolean($('scheduleRequirePasscode')?.checked);
    const waitingRoom=Boolean($('scheduleWaitingRoom')?.checked);
    const item={
      id:String(room.personalRoomId),
      meetingId:String(room.personalRoomId),
      identity:'personal',
      personalLinkName:String(room.personalLinkName||''),
      topic,date,time,duration,recurring,frequency,
      passcode:requirePasscode?String(room.passcode||''):'',
      waitingRoom,
      createdAt:new Date().toISOString()
    };
    const list=readJson(SCHEDULE_KEY,[])||[];
    const occurrenceKey=`${item.id}:${date}:${time}:${topic}`;
    item.occurrenceKey=occurrenceKey;
    const next=[...list.filter(existing=>existing?.occurrenceKey!==occurrenceKey),item];
    writeJson(SCHEDULE_KEY,next);
    $('scheduleDialog')?.close();
    window.dispatchEvent(new CustomEvent('dominion:scheduled-meeting-saved',{detail:item}));
    const layer=$('toastLayer');
    if(layer){const toast=document.createElement('div');toast.className='toast';toast.textContent=`Scheduled with Personal Room ${formatMeetingId(item.id)}`;layer.append(toast);setTimeout(()=>toast.remove(),3000);}
  };

  document.addEventListener('click',startPersonalInstant,true);
  document.addEventListener('submit',scheduleCapture,true);

  const init=()=>{
    ensureRoom();
    convertDashboardPersonalRoomToSettings();
    injectSettingsControls();
    injectScheduleIdentity();
    const scheduleAction=$('scheduleMeetingAction');
    scheduleAction?.addEventListener('click',()=>setTimeout(injectScheduleIdentity,0));
    const personalAction=$('personalMeetingAction');
    personalAction?.addEventListener('click',event=>{
      if(!personalAction.dataset.dsMeetingSettings)return;
      event.preventDefault();event.stopPropagation();
      injectSettingsControls();
      const dialog=$('personalRoomDialog');
      if(dialog?.showModal&&!dialog.open)dialog.showModal();
    },true);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

  window.DominionMeetingIdentitySettings=Object.freeze({
    version:'1.1.0',
    room:()=>({...ensureRoom()}),
    preferences:()=>({...readPrefs()})
  });
})();
