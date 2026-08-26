(()=>{
  'use strict';
  if(window.DominionDesktopHomeController)return;
  const route=String(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(route!=='/meet-home')return;

  const $=id=>document.getElementById(id);
  const digits=value=>String(value||'').replace(/\D/g,'');
  const formatId=value=>{const d=digits(value).slice(0,10);return d.length===10?d.replace(/(\d{3})(\d{3})(\d{4})/,'$1 $2 $3'):d;};
  const slug=value=>String(value||'dominionstar-member').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-').slice(0,48)||'dominionstar-member';
  const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  const esc=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));

  const ROOM_KEYS=['ds_meet_personal_room_v2','ds_meet_personal_room_v1'];
  const IDENTITY_KEY='ds_meet_identity_preferences_v1';
  const SCHEDULE_KEY='ds_meet_scheduled_v1';
  const state={client:null,session:null,profile:null,room:null,prefs:{},identity:{usePersonalForInstant:true,defaultScheduleIdentity:'personal'}};

  const mediaKey=()=>`ds_meet_preferences:${state.session?.user?.id||'anonymous'}`;
  const localPrefs=()=>readJson(mediaKey(),{})||{};
  const localIdentity=()=>({usePersonalForInstant:true,defaultScheduleIdentity:'personal',...(readJson(IDENTITY_KEY,{})||{})});
  const localRoom=()=>{
    for(const key of ROOM_KEYS){
      const raw=readJson(key,null);const id=digits(raw?.personalRoomId||raw?.personal_room_id||'').slice(0,10);
      if(id.length!==10)continue;
      return {personalRoomId:id,personalLinkName:slug(raw?.personalLinkName||raw?.personal_link_name||'dominionstar-member'),passcode:digits(raw?.passcode||'').slice(0,6),waitingRoomEnabled:Boolean(raw?.waitingRoomEnabled??raw?.waiting_room_enabled)};
    }
    return null;
  };
  const cacheRoom=room=>{if(!room?.personalRoomId)return;for(const key of ROOM_KEYS)writeJson(key,room);};

  async function loadAccount(){
    state.client=await window.DSAuth?.init?.();
    state.session=state.client?(await state.client.auth.getSession()).data.session:null;
    if(!state.session){
      location.replace('/member-login/?desktop=1');
      return false;
    }
    const meta=state.session.user.user_metadata||{};
    try{
      const result=await state.client.from('member_profiles').select('full_name,preferred_name,email,agent_code,verification_status,rank,role,is_founder,avatar_path').eq('id',state.session.user.id).maybeSingle();
      if(!result.error)state.profile=result.data||null;
    }catch{}
    state.prefs=localPrefs();
    state.identity=localIdentity();
    await Promise.all([syncRemotePreferences(),syncPersonalRoom()]);
    renderAccount(meta);
    return true;
  }

  async function syncRemotePreferences(){
    if(!state.client||!state.session?.user)return;
    try{
      const result=await state.client.from('meet_user_preferences').select('*').eq('user_id',state.session.user.id).maybeSingle();
      if(result.error||!result.data)return;
      const row=result.data;
      const remote={
        joinMuted:Boolean(row.join_muted),joinCameraOff:Boolean(row.join_camera_off),mirror:row.mirror_video!==false,
        background:String(row.background_mode||state.prefs.background||'none'),brightness:Number(row.brightness??state.prefs.brightness??100),touchAppearance:Number(row.touch_appearance??state.prefs.touchAppearance??0),
        quality:String(row.video_quality||state.prefs.quality||'720'),cameraId:String(row.camera_id||state.prefs.cameraId||''),microphoneId:String(row.microphone_id||state.prefs.microphoneId||''),speakerId:String(row.speaker_id||state.prefs.speakerId||'')
      };
      state.prefs={...state.prefs,...remote};
      writeJson(mediaKey(),state.prefs);
    }catch{}
  }

  async function syncPersonalRoom(){
    state.room=localRoom();
    if(!state.client||!state.session?.user)return state.room;
    try{
      const result=await state.client.from('meet_personal_rooms').select('*').eq('user_id',state.session.user.id).maybeSingle();
      if(!result.error&&result.data){
        const id=digits(result.data.personal_room_id||'').slice(0,10);
        if(id.length===10){
          state.room={personalRoomId:id,personalLinkName:slug(result.data.personal_link_name||state.session.user.email?.split('@')[0]||'dominionstar-member'),passcode:digits(result.data.passcode||'').slice(0,6),waitingRoomEnabled:Boolean(result.data.waiting_room_enabled)};
          cacheRoom(state.room);
        }
      }
    }catch{}
    return state.room;
  }

  function renderAccount(meta={}){
    const displayName=state.profile?.preferred_name||state.profile?.full_name||meta.full_name||meta.name||(state.session?.user?.email||'Meet member').split('@')[0];
    const title=state.profile?.rank||meta.title||'Meet member';
    const email=state.profile?.email||state.session?.user?.email||'';
    let avatarUrl=meta.avatar_url||meta.picture||'';
    const initials=String(displayName||'DS').trim().split(/\s+/).slice(0,2).map(value=>value[0]).join('').toUpperCase();
    const avatar=$('accountAvatar');if(avatar)avatar.textContent=initials;
    if($('accountName'))$('accountName').textContent=displayName;if($('accountTitle'))$('accountTitle').textContent=title;if($('accountEmail'))$('accountEmail').textContent=email;
    if($('profileName'))$('profileName').textContent=displayName;if($('profileTitle'))$('profileTitle').textContent=title;if($('profileEmail'))$('profileEmail').textContent=email;if($('profileAgentCode'))$('profileAgentCode').textContent=state.profile?.agent_code||'Not linked';
    if(state.profile?.avatar_path){state.client.storage.from('member-avatars').createSignedUrl(state.profile.avatar_path,3600).then(result=>{avatarUrl=result.data?.signedUrl||avatarUrl;renderAvatar(avatar,avatarUrl,initials);}).catch(()=>renderAvatar(avatar,avatarUrl,initials));}
    else renderAvatar(avatar,avatarUrl,initials);
    const hour=new Date().getHours();if($('greeting'))$('greeting').textContent=`${hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'}, ${displayName.split(/\s+/)[0]}.`;
    const now=new Date();if($('today'))$('today').innerHTML=`${now.getDate()}<small>${esc(now.toLocaleDateString(undefined,{month:'long',year:'numeric',weekday:'long'}))}</small>`;
  }

  function renderAvatar(node,url,initials){if(!node)return;if(!url){node.textContent=initials;return;}const img=document.createElement('img');img.src=url;img.alt='';img.onerror=()=>{node.textContent=initials;};node.replaceChildren(img);}

  async function populateDevices(){
    let devices=[];try{devices=await navigator.mediaDevices?.enumerateDevices?.()||[];}catch{}
    for(const [id,kind,preferred] of [['desktopCameraSelect','videoinput',state.prefs.cameraId],['desktopMicrophoneSelect','audioinput',state.prefs.microphoneId],['desktopSpeakerSelect','audiooutput',state.prefs.speakerId]]){
      const select=$(id);if(!select)continue;const matches=devices.filter(device=>device.kind===kind);select.replaceChildren(new Option('System default',''));
      matches.forEach((device,index)=>select.add(new Option(device.label||`${kind==='videoinput'?'Camera':kind==='audioinput'?'Microphone':'Speaker'} ${index+1}`,device.deviceId)));
      if(preferred&&[...select.options].some(option=>option.value===preferred))select.value=preferred;
    }
  }

  async function persistPreferences(next){
    state.prefs={...state.prefs,...next,updatedAt:new Date().toISOString()};writeJson(mediaKey(),state.prefs);
    if(!state.client||!state.session?.user)return;
    try{
      await state.client.from('meet_user_preferences').upsert({user_id:state.session.user.id,join_muted:Boolean(state.prefs.joinMuted),join_camera_off:Boolean(state.prefs.joinCameraOff),mirror_video:state.prefs.mirror!==false,background_mode:String(state.prefs.background||'none'),brightness:Number(state.prefs.brightness??100),touch_appearance:Number(state.prefs.touchAppearance??0),video_quality:String(state.prefs.quality||'720'),camera_id:String(state.prefs.cameraId||''),microphone_id:String(state.prefs.microphoneId||''),speaker_id:String(state.prefs.speakerId||''),updated_at:state.prefs.updatedAt},{onConflict:'user_id'});
    }catch(error){console.warn('Meet preference sync deferred',error);}
  }

  function hydrateSettings(){
    state.identity=localIdentity();state.prefs=localPrefs();
    if($('defaultMic'))$('defaultMic').value=state.prefs.joinMuted===false?'on':'muted';
    if($('defaultCamera'))$('defaultCamera').value=state.prefs.joinCameraOff===false?'on':'off';
    if($('desktopMirrorVideo'))$('desktopMirrorVideo').checked=state.prefs.mirror!==false;
    if($('desktopVideoQuality'))$('desktopVideoQuality').value=['360','720','1080'].includes(String(state.prefs.quality))?String(state.prefs.quality):'720';
    if($('desktopBackground'))$('desktopBackground').value=['none','blur','portrait'].includes(String(state.prefs.background))?String(state.prefs.background):'none';
    if($('desktopBrightness'))$('desktopBrightness').value=String(Number.isFinite(Number(state.prefs.brightness))?Number(state.prefs.brightness):100);
    if($('desktopAppearance'))$('desktopAppearance').value=String(Number.isFinite(Number(state.prefs.touchAppearance))?Number(state.prefs.touchAppearance):0);
    if($('desktopBrightnessValue'))$('desktopBrightnessValue').textContent=$('desktopBrightness')?.value||'100';if($('desktopAppearanceValue'))$('desktopAppearanceValue').textContent=$('desktopAppearance')?.value||'0';
    if($('desktopShareSound'))$('desktopShareSound').checked=Boolean(state.prefs.shareSound);if($('desktopShareOptimize'))$('desktopShareOptimize').checked=Boolean(state.prefs.shareOptimize);if($('desktopShareOwnWindows'))$('desktopShareOwnWindows').checked=Boolean(state.prefs.shareOwnWindows);
    if($('settingsUsePersonal'))$('settingsUsePersonal').checked=state.identity.usePersonalForInstant!==false;if($('defaultScheduleIdentity'))$('defaultScheduleIdentity').value=state.identity.defaultScheduleIdentity==='generated'?'generated':'personal';
    if(state.room){if($('personalLinkName'))$('personalLinkName').value=state.room.personalLinkName||'';if($('personalRoomId'))$('personalRoomId').value=formatId(state.room.personalRoomId);if($('requirePasscode'))$('requirePasscode').checked=Boolean(state.room.passcode);if($('personalPasscode'))$('personalPasscode').value=state.room.passcode||'';if($('passcodeField'))$('passcodeField').hidden=!state.room.passcode;if($('waitingRoom'))$('waitingRoom').checked=Boolean(state.room.waitingRoomEnabled);}
    else {if($('personalRoomId'))$('personalRoomId').value='Not configured';if($('settingsStatus'))$('settingsStatus').textContent='Personal Room identity has not been provisioned for this account.';}
  }

  function collectSettings(){
    return {joinMuted:$('defaultMic')?.value!=='on',joinCameraOff:$('defaultCamera')?.value!=='on',mirror:Boolean($('desktopMirrorVideo')?.checked),quality:String($('desktopVideoQuality')?.value||state.prefs.quality||'720'),background:String($('desktopBackground')?.value||state.prefs.background||'none'),brightness:Number($('desktopBrightness')?.value??state.prefs.brightness??100),touchAppearance:Number($('desktopAppearance')?.value??state.prefs.touchAppearance??0),cameraId:String($('desktopCameraSelect')?.value||''),microphoneId:String($('desktopMicrophoneSelect')?.value||''),speakerId:String($('desktopSpeakerSelect')?.value||''),shareSound:Boolean($('desktopShareSound')?.checked),shareOptimize:Boolean($('desktopShareOptimize')?.checked),shareOwnWindows:Boolean($('desktopShareOwnWindows')?.checked)};
  }

  async function saveSettings(){
    const button=$('saveSettings'),status=$('settingsStatus');if(button)button.disabled=true;if(status)status.textContent='Saving…';
    try{
      await persistPreferences(collectSettings());
      state.identity={...localIdentity(),usePersonalForInstant:Boolean($('settingsUsePersonal')?.checked),defaultScheduleIdentity:$('defaultScheduleIdentity')?.value==='generated'?'generated':'personal'};writeJson(IDENTITY_KEY,state.identity);
      if(!state.room?.personalRoomId)throw new Error('Personal Room identity is not configured. DominionStar will not generate a replacement ID locally.');
      const passcode=$('requirePasscode')?.checked?digits($('personalPasscode')?.value||'').slice(0,6):'';if(passcode&&passcode.length<3)throw new Error('Passcode must contain 3–6 digits.');
      const next={personalRoomId:state.room.personalRoomId,personalLinkName:slug($('personalLinkName')?.value||state.room.personalLinkName||state.session.user.email?.split('@')[0]),passcode,waitingRoomEnabled:Boolean($('waitingRoom')?.checked)};
      const result=await state.client.from('meet_personal_rooms').upsert({user_id:state.session.user.id,personal_room_id:next.personalRoomId,personal_link_name:next.personalLinkName,passcode:next.passcode,waiting_room_enabled:next.waitingRoomEnabled,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(result?.error)throw result.error;
      state.room=next;cacheRoom(next);if(status)status.textContent='Settings saved.';setTimeout(()=>$('settingsDialog')?.close?.(),300);
    }catch(error){if(status)status.textContent=error?.message||'Could not save settings.';}finally{if(button)button.disabled=false;}
  }

  async function launchNew({share=false}={}){
    state.identity=localIdentity();
    const usePersonal=state.identity.usePersonalForInstant!==false;
    if(usePersonal)await syncPersonalRoom();
    const params=new URLSearchParams({desktop:'1',action:share?(usePersonal?'desktop-share':'share'):(usePersonal?'desktop-new':'new')});
    if(usePersonal){
      if(!state.room?.personalRoomId){hydrateSettings();if($('settingsStatus'))$('settingsStatus').textContent='Personal Room is not configured. Turn off “Use Personal Room for instant meetings” or configure your Personal Room.';$('settingsDialog')?.showModal?.();return;}
      params.set('host','1');params.set('room',state.room.personalRoomId);if(state.room.passcode)params.set('passcode',state.room.passcode);if(state.room.waitingRoomEnabled)params.set('waiting','1');if(state.room.personalLinkName)params.set('personal',state.room.personalLinkName);
    }
    location.assign(`/meet/?${params.toString()}`);
  }

  function renderMeetings(){
    const source=readJson(SCHEDULE_KEY,[]);const meetings=Array.isArray(source)?source:[];const target=$('meetingList');if(!target)return;
    if(!meetings.length){target.innerHTML='<div class="empty">No upcoming meetings yet.<br>Use Schedule to create one.</div>';return;}
    const sorted=[...meetings].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.time||'').localeCompare(String(b.time||''))).slice(0,8);
    target.innerHTML=sorted.map((item,index)=>`<div class="meeting-item"><span><strong>${esc(item.topic||'DominionStar Meeting')}</strong><small>${esc(item.date||'Date not set')} · ${esc(item.time||'Time not set')}${item.recurring?' · Recurring':''} · ${esc(formatId(item.meetingId||item.id||''))}</small></span><button data-start-scheduled="${index}">Start</button></div>`).join('');
    target.querySelectorAll('[data-start-scheduled]').forEach(button=>button.onclick=()=>{const item=sorted[Number(button.dataset.startScheduled)];if(!item)return;const params=new URLSearchParams({desktop:'1',action:'scheduled',host:'1',room:digits(item.meetingId||item.id||'')});if(item.passcode)params.set('passcode',String(item.passcode));if(item.waitingRoom)params.set('waiting','1');location.assign(`/meet/?${params.toString()}`);});
  }

  function wireUi(){
    renderMeetings();
    if($('newMeeting'))$('newMeeting').onclick=()=>void launchNew({share:false});if($('shareScreen'))$('shareScreen').onclick=()=>void launchNew({share:true});
    if($('joinMeeting'))$('joinMeeting').onclick=()=>location.assign('/meet/?desktop=1&action=join');if($('scheduleMeeting'))$('scheduleMeeting').onclick=()=>location.assign('/meet/?desktop=1&action=schedule');
    if($('settingsNav'))$('settingsNav').onclick=async()=>{await syncPersonalRoom();state.prefs=localPrefs();state.identity=localIdentity();hydrateSettings();await populateDevices();$('settingsDialog')?.showModal?.();};
    if($('closeSettings'))$('closeSettings').onclick=()=>$('settingsDialog')?.close?.();if($('cancelSettings'))$('cancelSettings').onclick=()=>$('settingsDialog')?.close?.();if($('saveSettings'))$('saveSettings').onclick=()=>void saveSettings();
    if($('requirePasscode'))$('requirePasscode').onchange=()=>{if($('passcodeField'))$('passcodeField').hidden=!$('requirePasscode').checked;};if($('personalPasscode'))$('personalPasscode').oninput=()=>{$('personalPasscode').value=digits($('personalPasscode').value).slice(0,6);};if($('personalLinkName'))$('personalLinkName').oninput=()=>{$('personalLinkName').value=slug($('personalLinkName').value);};
    if($('desktopBrightness'))$('desktopBrightness').oninput=()=>{$('desktopBrightnessValue').textContent=$('desktopBrightness').value;};if($('desktopAppearance'))$('desktopAppearance').oninput=()=>{$('desktopAppearanceValue').textContent=$('desktopAppearance').value;};
    if($('homeNav'))$('homeNav').onclick=()=>document.querySelector('.content')?.scrollTo?.({top:0,behavior:'smooth'});if($('meetingsNav'))$('meetingsNav').onclick=()=>$('meetingsSection')?.scrollIntoView?.({behavior:'smooth',block:'start'});
    const profileDialog=$('profileDialog');if($('profileButton'))$('profileButton').onclick=()=>profileDialog?.showModal?.();if($('closeProfile'))$('closeProfile').onclick=()=>profileDialog?.close?.();
    if($('signOut'))$('signOut').onclick=async()=>{try{if(window.DSAuth?.signOut){await window.DSAuth.signOut();return;}await state.client?.auth?.signOut?.();}catch{}location.replace('/member-login/?desktop=1');};
  }

  const ready=(async()=>{if(!await loadAccount())return false;wireUi();return true;})().catch(error=>{console.error('DominionStar desktop Home failed',error);const status=$('settingsStatus');if(status)status.textContent='Meet Home could not initialize. Quit and reopen DominionStar Meet.';return false;});
  window.DominionDesktopHomeController=Object.freeze({version:'2.0.0-settings-own-meeting-identity',ready,snapshot:()=>({room:state.room?{...state.room}:null,prefs:{...state.prefs},identity:{...state.identity}})});
})();
