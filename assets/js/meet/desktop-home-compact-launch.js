(()=>{
  'use strict';
  if(window.DominionCompactHomeLaunch)return;
  const route=String(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(route!=='/meet-home')return;

  const digits=value=>String(value||'').replace(/\D/g,'');
  const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  const ROOM_KEYS=['ds_meet_personal_room_v2','ds_meet_personal_room_v1'];
  const IDENTITY_KEY='ds_meet_identity_preferences_v1';

  const readRoom=()=>{
    for(const key of ROOM_KEYS){
      const raw=readJson(key,null);const id=digits(raw?.personalRoomId||raw?.personal_room_id||'').slice(0,10);
      if(id.length!==10)continue;
      return {
        personalRoomId:id,
        personalLinkName:String(raw?.personalLinkName||raw?.personal_link_name||'').trim(),
        passcode:digits(raw?.passcode||'').slice(0,6),
        waitingRoomEnabled:Boolean(raw?.waitingRoomEnabled??raw?.waiting_room_enabled)
      };
    }
    return null;
  };

  const startButton=document.querySelector('.action[data-action="new"]');
  if(!startButton)return;
  const personalButton=document.querySelector('.action[data-action="personal"]');
  personalButton?.remove?.();
  const strong=startButton.querySelector('strong'),small=startButton.querySelector('small');
  if(strong)strong.textContent='Start Meeting';
  if(small)small.textContent='Personal Room or one-time ID';
  const empty=document.querySelector('#meetings .empty');
  if(empty)empty.innerHTML='No upcoming meeting is loaded yet.<br>Schedule one or start a meeting.';

  const style=document.createElement('style');
  style.dataset.dsCompactHomeLaunchStyle='1';
  style.textContent=`
    #dsStartMeetingDialog{width:min(520px,calc(100vw - 36px));padding:0;border:1px solid rgba(255,255,255,.13);border-radius:22px;background:linear-gradient(160deg,#182131,#0b111a 72%);color:#f7f9fc;box-shadow:0 34px 110px rgba(0,0,0,.72);overflow:hidden}
    #dsStartMeetingDialog::backdrop{background:rgba(2,5,10,.72);backdrop-filter:blur(12px)}
    .ds-start-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.08)}
    .ds-start-head p{margin:5px 0 0;color:#95a3b7;font-size:12px;line-height:1.5}.ds-start-head strong{font-size:20px}
    .ds-start-close{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.07);color:#eef2f7;font-size:21px;cursor:pointer}
    .ds-start-body{padding:22px 24px;display:grid;gap:16px}
    .ds-start-choice{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.035)}
    .ds-start-choice strong,.ds-start-choice small{display:block}.ds-start-choice small{margin-top:5px;color:#8f9caf;line-height:1.45}
    .ds-modern-switch{appearance:none;-webkit-appearance:none;width:48px;height:28px;flex:0 0 48px;margin:0;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:#303a49;position:relative;cursor:pointer;transition:.18s}
    .ds-modern-switch:before{content:'';position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#f7f9fc;box-shadow:0 2px 8px rgba(0,0,0,.35);transition:.18s}
    .ds-modern-switch:checked{background:#d4a83e;border-color:#e4be5c}.ds-modern-switch:checked:before{transform:translateX(20px);background:#15120a}
    .ds-start-summary{padding:13px 15px;border-radius:12px;background:#0b111b;color:#9facbd;font-size:12px;line-height:1.5}
    .ds-start-status{min-height:18px;color:#e7c86e;font-size:12px}
    .ds-start-footer{display:flex;justify-content:flex-end;gap:9px;padding:15px 24px;border-top:1px solid rgba(255,255,255,.08);background:rgba(4,8,13,.45)}
    .ds-start-footer button{border-radius:10px;padding:10px 17px;font-weight:800;cursor:pointer}.ds-start-cancel{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.055);color:#edf2f8}.ds-start-go{border:1px solid #ddb44b;background:#d4a83e;color:#181207}
  `;
  document.head.append(style);

  const dialog=document.createElement('dialog');dialog.id='dsStartMeetingDialog';
  dialog.innerHTML=`<div class="ds-start-head"><div><strong>Start Meeting</strong><p>Choose the meeting identity for this session.</p></div><button class="ds-start-close" type="button" aria-label="Close">×</button></div><div class="ds-start-body"><label class="ds-start-choice"><span><strong>Use Personal Room</strong><small>On keeps your permanent meeting ID. Off creates a fresh one-time meeting.</small></span><input id="dsUsePersonalRoom" class="ds-modern-switch" type="checkbox" role="switch"></label><div id="dsStartMeetingSummary" class="ds-start-summary"></div><div id="dsStartMeetingStatus" class="ds-start-status" role="status"></div></div><div class="ds-start-footer"><button type="button" class="ds-start-cancel">Cancel</button><button type="button" class="ds-start-go">Start Meeting</button></div>`;
  document.body.append(dialog);

  const toggle=dialog.querySelector('#dsUsePersonalRoom'),summary=dialog.querySelector('#dsStartMeetingSummary'),status=dialog.querySelector('#dsStartMeetingStatus');
  const identity=()=>({usePersonalForInstant:true,...(readJson(IDENTITY_KEY,{})||{})});
  const render=()=>{
    const room=readRoom();
    if(toggle.checked&&room){const id=room.personalRoomId;summary.textContent=`Personal Room · ${id.slice(0,3)} ${id.slice(3,6)} ${id.slice(6)} · your permanent meeting identity.`;status.textContent='';return;}
    if(toggle.checked&&!room){summary.textContent='Personal Room is not configured for this account yet.';status.textContent='Turn Personal Room off to start with a fresh meeting ID.';return;}
    summary.textContent='One-time meeting · DominionStar Meet will create a fresh meeting ID for this session.';status.textContent='';
  };
  toggle.onchange=render;

  startButton.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    const pref=identity(),room=readRoom();toggle.checked=room?pref.usePersonalForInstant!==false:false;render();
    if(!dialog.open)dialog.showModal();
  };
  dialog.querySelector('.ds-start-close').onclick=()=>dialog.close();
  dialog.querySelector('.ds-start-cancel').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.querySelector('.ds-start-go').onclick=()=>{
    const usePersonal=Boolean(toggle.checked),room=readRoom();
    writeJson(IDENTITY_KEY,{...identity(),usePersonalForInstant:usePersonal});
    if(usePersonal){
      if(!room){render();return;}
      const params=new URLSearchParams({desktop:'1',action:'desktop-new',host:'1',room:room.personalRoomId});
      if(room.passcode)params.set('passcode',room.passcode);if(room.waitingRoomEnabled)params.set('waiting','1');if(room.personalLinkName)params.set('personal',room.personalLinkName);
      location.href=`/meet/?${params.toString()}`;
      return;
    }
    location.href='/meet/?desktop=1&action=new';
  };

  window.DominionCompactHomeLaunch=Object.freeze({version:'1.0.0',open:()=>startButton.click()});
})();