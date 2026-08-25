(()=>{
  'use strict';
  if(!window.dominionDesktop?.isDesktop)return;
  if(window.__DS_DESKTOP_HOST_STABILITY_AUTHORITY)return;
  window.__DS_DESKTOP_HOST_STABILITY_AUTHORITY='1.0.0';

  const route=String(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(route!=='/meet-home')return;

  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const digits=value=>String(value||'').replace(/\D/g,'');
  const slug=value=>String(value||'dominionstar-member').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-').slice(0,48)||'dominionstar-member';
  const readJson=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const setStatus=message=>{const node=$('settingsStatus');if(node)node.textContent=message||'';};
  const deviceLabel=(device,index)=>device.label||`${device.kind==='videoinput'?'Camera':device.kind==='audioinput'?'Microphone':'Speaker'} ${index+1}`;

  async function waitForHomeReady(){
    for(let attempt=0;attempt<80;attempt++){
      if($('newMeeting')&&$('saveSettings')&&$('settingsNav')&&window.DSAuth?.init)return true;
      await sleep(100);
    }
    return false;
  }

  async function accountContext(){
    const client=await window.DSAuth?.init?.();
    const session=client?(await client.auth.getSession()).data.session:null;
    return {client,session};
  }

  function roomFromLocal(){
    for(const key of ['ds_meet_personal_room_v2','ds_meet_personal_room_v1']){
      const value=readJson(key,null);
      const personalRoomId=digits(value?.personalRoomId||value?.personal_room_id||'').slice(0,10);
      if(personalRoomId.length===10){
        return {
          personalRoomId,
          personalLinkName:slug(value?.personalLinkName||value?.personal_link_name||'dominionstar-member'),
          passcode:digits(value?.passcode||'').slice(0,6),
          waitingRoomEnabled:Boolean(value?.waitingRoomEnabled??value?.waiting_room_enabled)
        };
      }
    }
    return null;
  }

  async function authoritativeRoom(client,session){
    if(client&&session?.user){
      try{
        const result=await client.from('meet_personal_rooms').select('*').eq('user_id',session.user.id).maybeSingle();
        if(!result.error&&result.data){
          const personalRoomId=digits(result.data.personal_room_id||'').slice(0,10);
          if(personalRoomId.length===10){
            const room={
              personalRoomId,
              personalLinkName:slug(result.data.personal_link_name||session.user.email?.split('@')[0]||'dominionstar-member'),
              passcode:digits(result.data.passcode||'').slice(0,6),
              waitingRoomEnabled:Boolean(result.data.waiting_room_enabled)
            };
            writeJson('ds_meet_personal_room_v2',room);
            writeJson('ds_meet_personal_room_v1',room);
            return room;
          }
        }
      }catch{}
    }
    return roomFromLocal();
  }

  function preferenceKey(userId){return `ds_meet_preferences:${userId||'anonymous'}`;}
  function identityPrefs(){return {usePersonalForInstant:true,defaultScheduleIdentity:'personal',...readJson('ds_meet_identity_preferences_v1',{})};}
  function mediaPrefs(userId){return readJson(preferenceKey(userId),{});}

  function ensureMediaSettingsSection(){
    if($('desktopMediaSettings'))return;
    const personalHeading=[...document.querySelectorAll('#settingsDialog .settings-section h3')].find(node=>/personal room/i.test(node.textContent||''));
    const personalSection=personalHeading?.closest('.settings-section');
    if(!personalSection)return;
    const section=document.createElement('section');
    section.className='settings-section';
    section.id='desktopMediaSettings';
    section.innerHTML=`<h3>Audio & Video</h3><small>These choices stay with your Meet account until you change them.</small>
      <label class="setting"><span><strong>Camera</strong><small>Preferred camera for pre-join and meetings.</small></span><select id="desktopCameraSelect"></select></label>
      <label class="setting"><span><strong>Microphone</strong><small>Preferred microphone for meetings.</small></span><select id="desktopMicrophoneSelect"></select></label>
      <label class="setting"><span><strong>Speaker</strong><small>Preferred meeting audio output when supported.</small></span><select id="desktopSpeakerSelect"></select></label>
      <label class="setting"><span><strong>Mirror my video</strong><small>Keep the same self-view orientation every meeting.</small></span><input id="desktopMirrorVideo" type="checkbox"></label>
      <label class="setting"><span><strong>Video quality</strong><small>Preferred camera quality.</small></span><select id="desktopVideoQuality"><option value="360">360p</option><option value="720">720p HD</option><option value="1080">1080p Full HD</option></select></label>
      <label class="setting"><span><strong>Background</strong><small>None, blur, or portrait stays selected until changed.</small></span><select id="desktopBackground"><option value="none">None</option><option value="blur">Blur</option><option value="portrait">Portrait</option></select></label>
      <label class="field"><span>Brightness</span><input id="desktopBrightness" type="range" min="70" max="130" step="1"><small><span id="desktopBrightnessValue">100</span>%</small></label>
      <label class="field"><span>Touch up appearance</span><input id="desktopAppearance" type="range" min="0" max="60" step="1"><small><span id="desktopAppearanceValue">0</span>%</small></label>`;
    personalSection.before(section);
    const style=document.createElement('style');
    style.textContent='#settingsDialog input[type="range"]{width:100%;accent-color:#d2a53a}#desktopMediaSettings .field{padding:2px 0}';
    document.head.append(style);
  }

  async function populateDevices(userId){
    const prefs=mediaPrefs(userId);
    let devices=[];
    try{devices=await navigator.mediaDevices?.enumerateDevices?.()||[]}catch{}
    const configs=[
      ['desktopCameraSelect','videoinput',prefs.cameraId||''],
      ['desktopMicrophoneSelect','audioinput',prefs.microphoneId||''],
      ['desktopSpeakerSelect','audiooutput',prefs.speakerId||'']
    ];
    for(const [id,kind,preferred] of configs){
      const select=$(id);if(!select)continue;
      const matches=devices.filter(device=>device.kind===kind);
      select.innerHTML='<option value="">System default</option>'+matches.map((device,index)=>`<option value="${String(device.deviceId||'').replace(/"/g,'&quot;')}">${deviceLabel(device,index).replace(/[<>]/g,'')}</option>`).join('');
      if(preferred&&[...select.options].some(option=>option.value===preferred))select.value=preferred;
    }
  }

  async function hydrateExtendedSettings(userId){
    ensureMediaSettingsSection();
    const prefs=mediaPrefs(userId);
    $('desktopMirrorVideo').checked=prefs.mirror!==false;
    $('desktopVideoQuality').value=['360','720','1080'].includes(String(prefs.quality||''))?String(prefs.quality):'720';
    $('desktopBackground').value=['none','blur','portrait'].includes(String(prefs.background||''))?String(prefs.background):'none';
    $('desktopBrightness').value=String(Number.isFinite(Number(prefs.brightness))?Number(prefs.brightness):100);
    $('desktopAppearance').value=String(Number.isFinite(Number(prefs.touchAppearance))?Number(prefs.touchAppearance):0);
    $('desktopBrightnessValue').textContent=$('desktopBrightness').value;
    $('desktopAppearanceValue').textContent=$('desktopAppearance').value;
    await populateDevices(userId);
  }

  function collectMediaPreferences(userId){
    const previous=mediaPrefs(userId);
    return {
      ...previous,
      joinMuted:$('defaultMic')?.value==='muted',
      joinCameraOff:$('defaultCamera')?.value==='off',
      mirror:Boolean($('desktopMirrorVideo')?.checked),
      quality:String($('desktopVideoQuality')?.value||previous.quality||'720'),
      background:String($('desktopBackground')?.value||previous.background||'none'),
      brightness:Number($('desktopBrightness')?.value||previous.brightness||100),
      touchAppearance:Number($('desktopAppearance')?.value||previous.touchAppearance||0),
      cameraId:String($('desktopCameraSelect')?.value||''),
      microphoneId:String($('desktopMicrophoneSelect')?.value||''),
      speakerId:String($('desktopSpeakerSelect')?.value||''),
      updatedAt:new Date().toISOString()
    };
  }

  async function persistMediaPreferences(client,session,prefs){
    const userId=session?.user?.id||'anonymous';
    writeJson(preferenceKey(userId),prefs);
    if(!client||!session?.user)return;
    try{
      await client.from('meet_user_preferences').upsert({
        user_id:session.user.id,
        join_muted:Boolean(prefs.joinMuted),
        join_camera_off:Boolean(prefs.joinCameraOff),
        mirror_video:prefs.mirror!==false,
        background_mode:String(prefs.background||'none'),
        brightness:Number(prefs.brightness||100),
        touch_appearance:Number(prefs.touchAppearance||0),
        video_quality:String(prefs.quality||'720'),
        camera_id:String(prefs.cameraId||''),
        microphone_id:String(prefs.microphoneId||''),
        speaker_id:String(prefs.speakerId||''),
        updated_at:prefs.updatedAt||new Date().toISOString()
      },{onConflict:'user_id'});
    }catch(error){console.warn('Desktop Meet preference sync deferred',error);}
  }

  async function startHostAction(action,client,session){
    const userId=session?.user?.id||'anonymous';
    const prefs=mediaPrefs(userId);
    const startWithVideo=Boolean($('startWithVideo')?.checked);
    const nextPrefs={...prefs,joinCameraOff:!startWithVideo,updatedAt:new Date().toISOString()};
    await persistMediaPreferences(client,session,nextPrefs);
    const identity={...identityPrefs(),usePersonalForInstant:Boolean($('usePersonalRoom')?.checked)};
    writeJson('ds_meet_identity_preferences_v1',identity);

    const params=new URLSearchParams({desktop:'1',action});
    if(identity.usePersonalForInstant!==false){
      const room=await authoritativeRoom(client,session);
      if(!room?.personalRoomId){
        setStatus('Your Personal Room is still syncing. Open Settings once, save it, then start the meeting again.');
        $('settingsDialog')?.showModal?.();
        return;
      }
      params.set('host','1');
      params.set('room',room.personalRoomId);
      if(room.personalLinkName)params.set('personal',room.personalLinkName);
      if(room.passcode)params.set('passcode',room.passcode);
      if(room.waitingRoomEnabled)params.set('waiting','1');
    }
    location.href=`/meet/?${params.toString()}`;
  }

  async function saveAllSettings(client,session){
    const button=$('saveSettings');
    if(button){button.disabled=true;button.textContent='Saving…';}
    setStatus('Saving…');
    try{
      const userId=session?.user?.id||'anonymous';
      const prefs=collectMediaPreferences(userId);
      await persistMediaPreferences(client,session,prefs);

      const identity={
        ...identityPrefs(),
        usePersonalForInstant:Boolean($('settingsUsePersonal')?.checked),
        defaultScheduleIdentity:$('defaultScheduleIdentity')?.value==='generated'?'generated':'personal'
      };
      writeJson('ds_meet_identity_preferences_v1',identity);
      if($('usePersonalRoom'))$('usePersonalRoom').checked=identity.usePersonalForInstant!==false;
      if($('startWithVideo'))$('startWithVideo').checked=prefs.joinCameraOff===false;

      const existing=await authoritativeRoom(client,session);
      const personalRoomId=digits(existing?.personalRoomId||'').slice(0,10);
      if(personalRoomId.length!==10)throw new Error('Your Personal Meeting ID is not available yet. Reopen Settings after account sync completes.');
      const passcode=$('requirePasscode')?.checked?digits($('personalPasscode')?.value||'').slice(0,6):'';
      if(passcode&&passcode.length<3)throw new Error('Passcode must contain 3–6 digits.');
      const nextRoom={
        personalRoomId,
        personalLinkName:slug($('personalLinkName')?.value||existing?.personalLinkName||session?.user?.email?.split('@')[0]||'dominionstar-member'),
        passcode,
        waitingRoomEnabled:Boolean($('waitingRoom')?.checked)
      };
      if(client&&session?.user){
        const result=await client.from('meet_personal_rooms').upsert({
          user_id:session.user.id,
          personal_room_id:nextRoom.personalRoomId,
          personal_link_name:nextRoom.personalLinkName,
          passcode:nextRoom.passcode,
          waiting_room_enabled:nextRoom.waitingRoomEnabled,
          updated_at:new Date().toISOString()
        },{onConflict:'user_id'});
        if(result?.error)throw result.error;
      }
      writeJson('ds_meet_personal_room_v2',nextRoom);
      writeJson('ds_meet_personal_room_v1',nextRoom);
      const formatted=nextRoom.personalRoomId.replace(/(\d{3})(\d{3})(\d{4})/,'$1 $2 $3');
      if($('personalIdentity'))$('personalIdentity').textContent=`Personal Room · ${formatted}`;
      if($('newMeetingPersonalId'))$('newMeetingPersonalId').textContent=`Personal Meeting ID ${formatted}`;
      setStatus('Settings saved.');
      setTimeout(()=>$('settingsDialog')?.close?.(),350);
    }catch(error){
      setStatus(error?.message||'Could not save settings.');
    }finally{
      if(button){button.disabled=false;button.textContent='Save Settings';}
    }
  }

  (async()=>{
    if(!await waitForHomeReady())return;
    const {client,session}=await accountContext();
    const userId=session?.user?.id||'anonymous';
    ensureMediaSettingsSection();
    await hydrateExtendedSettings(userId);

    const settingsNav=$('settingsNav');
    settingsNav?.addEventListener('click',()=>setTimeout(()=>hydrateExtendedSettings(userId),0));
    $('desktopBrightness')?.addEventListener('input',()=>{$('desktopBrightnessValue').textContent=$('desktopBrightness').value});
    $('desktopAppearance')?.addEventListener('input',()=>{$('desktopAppearanceValue').textContent=$('desktopAppearance').value});

    // Replace legacy handlers that reset background/appearance and rely on a
    // late Personal Room bootstrap. Host identity is now fixed before pre-join.
    if($('usePersonalRoom'))$('usePersonalRoom').onchange=()=>{
      const identity={...identityPrefs(),usePersonalForInstant:Boolean($('usePersonalRoom').checked)};
      writeJson('ds_meet_identity_preferences_v1',identity);
    };
    if($('startWithVideo'))$('startWithVideo').onchange=()=>{
      const prefs={...mediaPrefs(userId),joinCameraOff:!$('startWithVideo').checked,updatedAt:new Date().toISOString()};
      void persistMediaPreferences(client,session,prefs);
    };
    if($('newMeeting'))$('newMeeting').onclick=()=>void startHostAction('new',client,session);
    if($('shareScreen'))$('shareScreen').onclick=()=>void startHostAction('share',client,session);
    if($('saveSettings'))$('saveSettings').onclick=()=>void saveAllSettings(client,session);
  })().catch(error=>console.error('Desktop host stability authority failed',error));
})();
