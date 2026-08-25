(()=>{
  'use strict';
  if(window.__DS_DESKTOP_SETTINGS_AUTHORITY)return;
  window.__DS_DESKTOP_SETTINGS_AUTHORITY='2.0.0';
  const route=String(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(route!=='/meet-home')return;

  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const digits=value=>String(value||'').replace(/\D/g,'');
  const slug=value=>String(value||'dominionstar-member').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-').slice(0,48)||'dominionstar-member';
  const readJson=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const formatId=value=>{const d=digits(value).slice(0,10);return d.length===10?d.replace(/(\d{3})(\d{3})(\d{4})/,'$1 $2 $3'):d};
  const identityKey='ds_meet_identity_preferences_v1';
  const roomKeys=['ds_meet_personal_room_v2','ds_meet_personal_room_v1'];

  async function waitForHome(){
    for(let i=0;i<100;i+=1){
      if($('settingsDialog')&&$('saveSettings')&&$('newMeeting')&&window.DSAuth?.init)return true;
      await sleep(80);
    }
    return false;
  }

  function mediaKey(userId){return `ds_meet_preferences:${userId||'anonymous'}`;}
  function mediaPrefs(userId){return readJson(mediaKey(userId),{});}
  function identityPrefs(){return {usePersonalForInstant:true,defaultScheduleIdentity:'personal',...readJson(identityKey,{})};}
  function localRoom(){
    for(const key of roomKeys){
      const value=readJson(key,null);
      const id=digits(value?.personalRoomId||value?.personal_room_id||'').slice(0,10);
      if(id.length===10)return {
        personalRoomId:id,
        personalLinkName:slug(value?.personalLinkName||value?.personal_link_name||'dominionstar-member'),
        passcode:digits(value?.passcode||'').slice(0,6),
        waitingRoomEnabled:Boolean(value?.waitingRoomEnabled??value?.waiting_room_enabled)
      };
    }
    return null;
  }
  function cacheRoom(room){if(!room?.personalRoomId)return;for(const key of roomKeys)writeJson(key,room);}
  async function remoteRoom(client,session){
    if(client&&session?.user){
      try{
        const result=await client.from('meet_personal_rooms').select('*').eq('user_id',session.user.id).maybeSingle();
        if(!result.error&&result.data){
          const id=digits(result.data.personal_room_id||'').slice(0,10);
          if(id.length===10){
            const room={personalRoomId:id,personalLinkName:slug(result.data.personal_link_name||session.user.email?.split('@')[0]||'dominionstar-member'),passcode:digits(result.data.passcode||'').slice(0,6),waitingRoomEnabled:Boolean(result.data.waiting_room_enabled)};
            cacheRoom(room);return room;
          }
        }
      }catch{}
    }
    return localRoom();
  }

  function ensureFullSettings(){
    if($('desktopFullMediaSettings'))return;
    const sections=[...document.querySelectorAll('#settingsDialog .settings-section')];
    const joining=sections.find(section=>/joining meetings/i.test(section.querySelector('h3')?.textContent||''));
    const newMeeting=sections.find(section=>/new meeting/i.test(section.querySelector('h3')?.textContent||''));
    const media=document.createElement('section');
    media.className='settings-section';media.id='desktopFullMediaSettings';
    media.innerHTML=`<h3>Audio & Video</h3><small>These choices are remembered until you change them.</small>
      <label class="setting"><span><strong>Camera</strong><small>Preferred camera for pre-join and meetings.</small></span><select id="desktopCameraSelect"><option value="">System default</option></select></label>
      <label class="setting"><span><strong>Microphone</strong><small>Preferred microphone for meetings.</small></span><select id="desktopMicrophoneSelect"><option value="">System default</option></select></label>
      <label class="setting"><span><strong>Speaker</strong><small>Preferred meeting audio output when supported.</small></span><select id="desktopSpeakerSelect"><option value="">System default</option></select></label>
      <label class="setting"><span><strong>Mirror my video</strong><small>Keep your preferred self-view orientation.</small></span><input id="desktopMirrorVideo" type="checkbox"></label>
      <label class="setting"><span><strong>Video quality</strong><small>Preferred camera resolution.</small></span><select id="desktopVideoQuality"><option value="360">360p</option><option value="720">720p HD</option><option value="1080">1080p Full HD</option></select></label>
      <label class="setting"><span><strong>Background</strong><small>None, blur, or portrait remains selected.</small></span><select id="desktopBackground"><option value="none">None</option><option value="blur">Blur</option><option value="portrait">Portrait</option></select></label>
      <label class="field"><span>Brightness</span><input id="desktopBrightness" type="range" min="75" max="135" step="1"><small><span id="desktopBrightnessValue">100</span>%</small></label>
      <label class="field"><span>Touch up appearance</span><input id="desktopAppearance" type="range" min="0" max="60" step="1"><small><span id="desktopAppearanceValue">0</span>%</small></label>`;
    (joining||newMeeting)?.after(media);

    const share=document.createElement('section');
    share.className='settings-section';share.id='desktopShareDefaults';
    share.innerHTML=`<h3>Screen Sharing</h3><small>Defaults for the desktop share picker.</small>
      <label class="setting"><span><strong>Share computer sound</strong><small>Include system audio when available.</small></span><input id="desktopShareSound" type="checkbox"></label>
      <label class="setting"><span><strong>Optimize for video sharing</strong><small>Use the video-sharing optimization by default.</small></span><input id="desktopShareOptimize" type="checkbox"></label>
      <label class="setting"><span><strong>Show DominionStar windows</strong><small>Off by default to prevent the endless mirror effect.</small></span><input id="desktopShareOwnWindows" type="checkbox"></label>`;
    media.after(share);

    const style=document.createElement('style');
    style.textContent='#settingsDialog input[type="range"]{width:100%;accent-color:#d2a53a}#desktopFullMediaSettings .field{padding:3px 0}';
    document.head.append(style);
    const subtitle=document.querySelector('#settingsDialog .dialog-head small');
    if(subtitle)subtitle.textContent='Audio, video, meeting defaults, sharing, and Personal Room.';
  }

  async function populateDevices(userId){
    let devices=[];try{devices=await navigator.mediaDevices?.enumerateDevices?.()||[]}catch{}
    const prefs=mediaPrefs(userId);
    const items=[['desktopCameraSelect','videoinput',prefs.cameraId],['desktopMicrophoneSelect','audioinput',prefs.microphoneId],['desktopSpeakerSelect','audiooutput',prefs.speakerId]];
    for(const [id,kind,preferred] of items){
      const select=$(id);if(!select)continue;
      const matches=devices.filter(device=>device.kind===kind);
      select.innerHTML='<option value="">System default</option>'+matches.map((device,index)=>`<option value="${String(device.deviceId||'').replace(/"/g,'&quot;')}">${String(device.label||`${kind==='videoinput'?'Camera':kind==='audioinput'?'Microphone':'Speaker'} ${index+1}`).replace(/[<>]/g,'')}</option>`).join('');
      if(preferred&&[...select.options].some(option=>option.value===preferred))select.value=preferred;
    }
  }

  async function persistMedia(client,session,prefs){
    writeJson(mediaKey(session?.user?.id||'anonymous'),prefs);
    if(!client||!session?.user)return;
    try{await client.from('meet_user_preferences').upsert({user_id:session.user.id,join_muted:Boolean(prefs.joinMuted),join_camera_off:Boolean(prefs.joinCameraOff),mirror_video:prefs.mirror!==false,background_mode:String(prefs.background||'none'),brightness:Number(prefs.brightness||100),touch_appearance:Number(prefs.touchAppearance||0),video_quality:String(prefs.quality||'720'),camera_id:String(prefs.cameraId||''),microphone_id:String(prefs.microphoneId||''),speaker_id:String(prefs.speakerId||''),updated_at:prefs.updatedAt||new Date().toISOString()},{onConflict:'user_id'});}catch(error){console.warn('Desktop Meet preference sync deferred',error);}
  }

  function readControls(userId){
    const previous=mediaPrefs(userId);
    return {...previous,
      joinMuted:$('defaultMic')?.value==='muted',joinCameraOff:$('defaultCamera')?.value==='off',
      mirror:Boolean($('desktopMirrorVideo')?.checked),quality:String($('desktopVideoQuality')?.value||previous.quality||'720'),
      background:String($('desktopBackground')?.value||previous.background||'none'),brightness:Number($('desktopBrightness')?.value||previous.brightness||100),touchAppearance:Number($('desktopAppearance')?.value||previous.touchAppearance||0),
      cameraId:String($('desktopCameraSelect')?.value||''),microphoneId:String($('desktopMicrophoneSelect')?.value||''),speakerId:String($('desktopSpeakerSelect')?.value||''),
      shareSound:Boolean($('desktopShareSound')?.checked),shareOptimize:Boolean($('desktopShareOptimize')?.checked),shareOwnWindows:Boolean($('desktopShareOwnWindows')?.checked),updatedAt:new Date().toISOString()};
  }

  async function hydrate(userId,room){
    ensureFullSettings();const prefs=mediaPrefs(userId);const identity=identityPrefs();
    if($('defaultMic'))$('defaultMic').value=prefs.joinMuted===false?'on':'muted';
    if($('defaultCamera'))$('defaultCamera').value=prefs.joinCameraOff===false?'on':'off';
    if($('settingsUsePersonal'))$('settingsUsePersonal').checked=identity.usePersonalForInstant!==false;
    if($('defaultScheduleIdentity'))$('defaultScheduleIdentity').value=identity.defaultScheduleIdentity==='generated'?'generated':'personal';
    $('desktopMirrorVideo').checked=prefs.mirror!==false;$('desktopVideoQuality').value=['360','720','1080'].includes(String(prefs.quality))?String(prefs.quality):'720';
    $('desktopBackground').value=['none','blur','portrait'].includes(String(prefs.background))?String(prefs.background):'none';
    $('desktopBrightness').value=String(Number.isFinite(Number(prefs.brightness))?Number(prefs.brightness):100);$('desktopAppearance').value=String(Number.isFinite(Number(prefs.touchAppearance))?Number(prefs.touchAppearance):0);
    $('desktopBrightnessValue').textContent=$('desktopBrightness').value;$('desktopAppearanceValue').textContent=$('desktopAppearance').value;
    $('desktopShareSound').checked=Boolean(prefs.shareSound);$('desktopShareOptimize').checked=Boolean(prefs.shareOptimize);$('desktopShareOwnWindows').checked=Boolean(prefs.shareOwnWindows);
    if(room){if($('personalLinkName'))$('personalLinkName').value=room.personalLinkName||'';if($('personalRoomId'))$('personalRoomId').value=formatId(room.personalRoomId);if($('requirePasscode'))$('requirePasscode').checked=Boolean(room.passcode);if($('personalPasscode'))$('personalPasscode').value=room.passcode||'';if($('passcodeField'))$('passcodeField').hidden=!room.passcode;if($('waitingRoom'))$('waitingRoom').checked=Boolean(room.waitingRoomEnabled);}
    await populateDevices(userId);
  }

  function launch(action,room,usePersonal){
    const params=new URLSearchParams({desktop:'1',action});
    if(usePersonal&&room?.personalRoomId){params.set('host','1');params.set('room',room.personalRoomId);if(room.personalLinkName)params.set('personal',room.personalLinkName);if(room.passcode)params.set('passcode',room.passcode);if(room.waitingRoomEnabled)params.set('waiting','1');}
    location.href=`/meet/?${params.toString()}`;
  }

  (async()=>{
    if(!await waitForHome())return;
    const client=await window.DSAuth?.init?.();const session=client?(await client.auth.getSession()).data.session:null;if(!session)return;
    const userId=session.user.id;let room=await remoteRoom(client,session);ensureFullSettings();
    await hydrate(userId,room);

    const openSettings=async()=>{room=await remoteRoom(client,session);await hydrate(userId,room);$('settingsStatus').textContent='';$('settingsDialog').showModal();};
    if($('settingsNav'))$('settingsNav').onclick=()=>void openSettings();
    $('desktopBrightness')?.addEventListener('input',()=>{$('desktopBrightnessValue').textContent=$('desktopBrightness').value});
    $('desktopAppearance')?.addEventListener('input',()=>{$('desktopAppearanceValue').textContent=$('desktopAppearance').value});

    if($('startWithVideo'))$('startWithVideo').checked=mediaPrefs(userId).joinCameraOff===false;
    if($('usePersonalRoom'))$('usePersonalRoom').checked=identityPrefs().usePersonalForInstant!==false;
    if($('startWithVideo'))$('startWithVideo').onchange=()=>{const prefs={...mediaPrefs(userId),joinCameraOff:!$('startWithVideo').checked,updatedAt:new Date().toISOString()};void persistMedia(client,session,prefs);};
    if($('usePersonalRoom'))$('usePersonalRoom').onchange=()=>writeJson(identityKey,{...identityPrefs(),usePersonalForInstant:Boolean($('usePersonalRoom').checked)});
    if($('newMeeting'))$('newMeeting').onclick=async()=>{room=await remoteRoom(client,session);const usePersonal=$('usePersonalRoom')?.checked!==false;writeJson(identityKey,{...identityPrefs(),usePersonalForInstant:usePersonal});launch('new',room,usePersonal);};
    if($('shareScreen'))$('shareScreen').onclick=async()=>{room=await remoteRoom(client,session);const usePersonal=$('usePersonalRoom')?.checked!==false;launch('share',room,usePersonal);};

    if($('saveSettings'))$('saveSettings').onclick=async()=>{
      const button=$('saveSettings'),status=$('settingsStatus');button.disabled=true;status.textContent='Saving…';
      try{
        const prefs=readControls(userId);await persistMedia(client,session,prefs);
        const identity={...identityPrefs(),usePersonalForInstant:Boolean($('settingsUsePersonal')?.checked),defaultScheduleIdentity:$('defaultScheduleIdentity')?.value==='generated'?'generated':'personal'};writeJson(identityKey,identity);
        if($('usePersonalRoom'))$('usePersonalRoom').checked=identity.usePersonalForInstant!==false;if($('startWithVideo'))$('startWithVideo').checked=prefs.joinCameraOff===false;
        const current=await remoteRoom(client,session);if(!current?.personalRoomId)throw new Error('Personal Meeting ID is not available. Close Settings and reopen it after account sync completes.');
        const passcode=$('requirePasscode')?.checked?digits($('personalPasscode')?.value||'').slice(0,6):'';if(passcode&&passcode.length<3)throw new Error('Passcode must contain 3–6 digits.');
        const next={personalRoomId:current.personalRoomId,personalLinkName:slug($('personalLinkName')?.value||current.personalLinkName||session.user.email?.split('@')[0]),passcode,waitingRoomEnabled:Boolean($('waitingRoom')?.checked)};
        const result=await client.from('meet_personal_rooms').upsert({user_id:userId,personal_room_id:next.personalRoomId,personal_link_name:next.personalLinkName,passcode:next.passcode,waiting_room_enabled:next.waitingRoomEnabled,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(result?.error)throw result.error;
        room=next;cacheRoom(room);if($('personalIdentity'))$('personalIdentity').textContent=`Personal Room · ${formatId(room.personalRoomId)}`;if($('newMeetingPersonalId'))$('newMeetingPersonalId').textContent=`Personal Meeting ID ${formatId(room.personalRoomId)}`;
        status.textContent='Settings saved.';setTimeout(()=>$('settingsDialog')?.close?.(),350);
      }catch(error){status.textContent=error?.message||'Could not save settings.';}finally{button.disabled=false;}
    };
  })().catch(error=>console.error('Desktop settings authority failed',error));
})();
