(()=>{
  'use strict';
  if(window.dominionDesktop)return;

  const SUPABASE_URL='https://ckmurvhjumzlhsegncba.supabase.co';
  const SUPABASE_KEY='sb_publishable_zAzk_tobvWHOWR22bmzMMw_uqHnCVxb';
  const authListeners=new Set();
  let clientPromise=null,authSubscription=null;
  let current={roomId:'',roomCode:'',passcode:'',title:'',participantId:'',joinToken:'',role:'',state:'',meetingKind:'',reusable:false,scheduleId:''};
  let turnCache={roomId:'',iceServers:[],expiresAtMs:0,provider:'',ttl:0,qaDirectOnly:false};
  const normalizeDigits=value=>String(value||'').replace(/\D/g,'');
  const normalizeName=value=>String(value||'').trim().slice(0,100);
  const normalizeTitle=value=>String(value||'').trim().slice(0,120)||'DominionStar Meeting';
  const directIce=Object.freeze([{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]);
  const hasRelay=servers=>(servers||[]).some(server=>{
    const urls=Array.isArray(server?.urls)?server.urls:[server?.urls];
    return urls.some(url=>/^turns?:/i.test(String(url||'')))&&Boolean(server?.username)&&Boolean(server?.credential);
  });
  const remember=value=>{
    if(value?.roomId)current={...current,...value,roomId:String(value.roomId),roomCode:String(value.roomCode||current.roomCode||''),passcode:String(value.passcode||current.passcode||''),participantId:String(value.participantId||current.participantId||''),joinToken:String(value.joinToken||current.joinToken||''),role:String(value.role||current.role||''),state:String(value.state||current.state||'')};
    return value;
  };
  const clearContext=()=>{current={roomId:'',roomCode:'',passcode:'',title:'',participantId:'',joinToken:'',role:'',state:'',meetingKind:'',reusable:false,scheduleId:''};turnCache={roomId:'',iceServers:[],expiresAtMs:0,provider:'',ttl:0,qaDirectOnly:false};};

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(node=>node.src===new URL(src,location.href).href);
      if(existing){if(window.supabase?.createClient)return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const script=document.createElement('script');script.src=src;script.async=true;script.onload=resolve;script.onerror=reject;document.head.append(script);
    });
  }
  async function client(){
    if(clientPromise)return clientPromise;
    clientPromise=(async()=>{
      if(!window.supabase?.createClient)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
      if(!window.supabase?.createClient)throw new Error('browser_meeting_client_unavailable');
      const instance=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      if(!authSubscription){
        const {data}=instance.auth.onAuthStateChange(()=>setTimeout(()=>void emitAuth(instance),0));
        authSubscription=data?.subscription||null;
      }
      return instance;
    })();
    return clientPromise;
  }
  async function profileSummary(instance,user){
    if(!user)return null;
    let profile=null;
    try{
      const result=await instance.from('member_profiles').select('full_name,preferred_name,email,rank,agent_code,is_founder,avatar_path').eq('id',user.id).maybeSingle();
      if(!result.error)profile=result.data||null;
    }catch{}
    let avatarUrl=String(user.user_metadata?.avatar_url||user.user_metadata?.picture||'');
    if(profile?.avatar_path){
      try{const signed=await instance.storage.from('member-avatars').createSignedUrl(profile.avatar_path,3600);if(!signed.error&&signed.data?.signedUrl)avatarUrl=signed.data.signedUrl;}catch{}
    }
    return {id:String(user.id||''),email:String(profile?.email||user.email||''),name:String(profile?.preferred_name||profile?.full_name||user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split('@')[0]||'DominionStar Member'),avatarUrl,rank:String(profile?.rank||''),agentCode:String(profile?.agent_code||''),isFounder:Boolean(profile?.is_founder),memberProfile:Boolean(profile)};
  }
  async function authState(){
    const instance=await client(),sessionResult=await instance.auth.getSession(),session=sessionResult.data?.session;
    if(!session)return {ready:true,signedIn:false,user:null};
    return {ready:true,signedIn:true,user:await profileSummary(instance,session.user)};
  }
  async function emitAuth(instance=null){
    const resolved=instance||await client();
    const result=await resolved.auth.getSession(),session=result.data?.session;
    const state=session?{ready:true,signedIn:true,user:await profileSummary(resolved,session.user)}:{ready:true,signedIn:false,user:null};
    for(const fn of authListeners){try{fn(state);}catch{}}
    return state;
  }
  async function rpc(name,args={}){
    const instance=await client(),result=await instance.rpc(name,args);
    if(result.error)throw new Error(result.error.message||name);
    return result.data;
  }
  async function invokeFunction(name,body={}){
    const instance=await client(),result=await instance.functions.invoke(name,{body});
    if(result.error)throw new Error(result.error.message||name);
    if(result.data?.error)throw new Error(String(result.data.error));
    return result.data;
  }
  async function enrich(roomId,payload,key){
    const list=Array.isArray(payload?.[key])?payload[key]:null;if(!list)return payload;
    const memberIds=[...new Set(list.map(item=>item?.memberId).filter(Boolean))];if(!memberIds.length)return payload;
    try{
      const instance=await client(),profiles=await instance.from('member_profiles').select('id,avatar_path').in('id',memberIds);
      if(profiles.error)return payload;
      const urls=new Map();
      await Promise.all((profiles.data||[]).map(async row=>{if(!row.avatar_path)return;const signed=await instance.storage.from('member-avatars').createSignedUrl(row.avatar_path,3600);if(!signed.error&&signed.data?.signedUrl)urls.set(String(row.id),signed.data.signedUrl);}));
      return {...payload,[key]:list.map(item=>({...item,avatarUrl:urls.get(String(item.memberId||''))||item.avatarUrl||''}))};
    }catch{return payload;}
  }

  const meeting=Object.freeze({
    create:async input=>remember({...await rpc('meet_v2_create_room',{p_title:normalizeTitle(input?.title),p_passcode:normalizeDigits(input?.passcode),p_waiting_room_enabled:input?.waitingRoomEnabled!==false,p_external_guests_allowed:input?.externalGuestsAllowed!==false}),title:normalizeTitle(input?.title),passcode:normalizeDigits(input?.passcode)}),
    personalRoom:()=>rpc('meet_v2_get_personal_room',{}),
    updatePersonalRoom:input=>rpc('meet_v2_update_personal_room',{p_passcode:normalizeDigits(input?.passcode),p_use_for_instant:input?.useForInstant!==false,p_waiting_room_enabled:input?.waitingRoomEnabled!==false,p_external_guests_allowed:input?.externalGuestsAllowed!==false}),
    startPersonalRoom:async()=>remember(await rpc('meet_v2_start_personal_room',{})),
    startHostRoom:async roomId=>remember(await rpc('meet_v2_start_host_room',{p_room_id:roomId})),
    schedule:input=>rpc('meet_v2_schedule_meeting',{p_title:normalizeTitle(input?.title),p_passcode:input?.usePersonalRoom?null:normalizeDigits(input?.passcode),p_scheduled_start:new Date(input?.scheduledStart||input?.startsAt).toISOString(),p_duration_minutes:Math.max(15,Math.min(480,Number(input?.durationMinutes)||60)),p_recurrence:input?.recurrence||null,p_waiting_room_enabled:input?.waitingRoomEnabled!==false,p_external_guests_allowed:input?.externalGuestsAllowed!==false,p_use_personal_room:Boolean(input?.usePersonalRoom)}),
    listSchedules:()=>rpc('meet_v2_list_host_schedules',{}),
    cancelSchedule:scheduleId=>rpc('meet_v2_cancel_schedule',{p_schedule_id:scheduleId}),
    startSchedule:async scheduleId=>remember(await rpc('meet_v2_mark_schedule_started',{p_schedule_id:scheduleId})),
    updateRoomPasscode:(roomId,passcode)=>rpc('meet_v2_update_room_passcode',{p_room_id:roomId,p_passcode:normalizeDigits(passcode)}),
    requestJoin:async input=>remember({...await rpc('meet_v2_request_join',{p_room_code:normalizeDigits(input?.roomCode),p_passcode:normalizeDigits(input?.passcode),p_display_name:normalizeName(input?.displayName)}),roomCode:normalizeDigits(input?.roomCode),passcode:normalizeDigits(input?.passcode)}),
    joinStatus:async(participantId,joinToken)=>remember(await rpc('meet_v2_join_status',{p_participant_id:participantId,p_join_token:joinToken})),
    markJoined:async(participantId,joinToken)=>remember(await rpc('meet_v2_mark_joined',{p_participant_id:participantId,p_join_token:joinToken})),
    leave:async(participantId,joinToken)=>{const result=await rpc('meet_v2_leave_room',{p_participant_id:participantId,p_join_token:joinToken});clearContext();return result;},
    hostQueue:async roomId=>enrich(roomId,await rpc('meet_v2_host_queue',{p_room_id:roomId}),'waiting'),
    decide:(participantId,decision)=>rpc('meet_v2_decide_participant',{p_participant_id:participantId,p_decision:decision}),
    snapshot:async roomId=>enrich(roomId,await rpc('meet_v2_room_snapshot',{p_room_id:roomId}),'participants'),
    touchPresence:(participantId,joinToken)=>rpc('meet_v2_touch_presence',{p_participant_id:participantId,p_join_token:joinToken}),
    setCohost:(participantId,enabled)=>rpc('meet_v2_set_cohost',{p_participant_id:participantId,p_enabled:Boolean(enabled)}),
    transferHost:participantId=>rpc('meet_v2_transfer_host',{p_target_participant_id:participantId}),
    removeParticipant:participantId=>rpc('meet_v2_remove_participant',{p_participant_id:participantId}),
    renameParticipant:(participantId,displayName)=>rpc('meet_v2_rename_participant',{p_participant_id:participantId,p_display_name:normalizeName(displayName)}),
    setRecordingPermission:(participantId,enabled)=>rpc('meet_v2_set_recording_permission',{p_participant_id:participantId,p_enabled:Boolean(enabled)}),
    setRecordingState:(participantId,active,paused=false)=>rpc('meet_v2_set_recording_state',{p_participant_id:participantId,p_active:Boolean(active),p_paused:Boolean(paused)}),
    setSecurity:(roomId,options={})=>rpc('meet_v2_set_security',{p_room_id:roomId,p_locked:Boolean(options.locked),p_mute_on_entry:Boolean(options.muteOnEntry)}),
    setWaitingRoom:(roomId,enabled)=>rpc('meet_v2_set_waiting_room',{p_room_id:roomId,p_enabled:Boolean(enabled)}),
    setChatPolicy:(roomId,policy='everyone')=>rpc('meet_v2_set_chat_policy',{p_room_id:roomId,p_policy:String(policy||'everyone')}),
    setCaptionState:(roomId,options={})=>rpc('meet_v2_set_caption_state',{p_room_id:roomId,p_mode:String(options.mode||'off'),p_captioner_participant_id:options.captionerParticipantId||null,p_transcript_enabled:Boolean(options.transcriptEnabled)}),
    publishCaption:(participantId,text,speakerName)=>rpc('meet_v2_publish_caption',{p_participant_id:participantId,p_text:String(text||'').trim(),p_speaker_name:normalizeName(speakerName)||'Captioner'}),
    transcript:roomId=>rpc('meet_v2_get_transcript',{p_room_id:roomId}),
    transferHostAndLeave:async participantId=>{const result=await rpc('meet_v2_transfer_host_and_leave',{p_target_participant_id:participantId});clearContext();return result;},
    end:async roomId=>{const result=await rpc('meet_v2_end_room',{p_room_id:roomId});clearContext();return result;},
    context:async()=>Object.freeze({...current}),
    sendSignal:(toParticipantId,type,payload={})=>rpc('meet_v2_send_signal',{p_from_participant_id:current.participantId,p_to_participant_id:toParticipantId,p_signal_type:String(type||''),p_payload:payload||{}}),
    pullSignals:(afterId=0,limit=100)=>rpc('meet_v2_pull_signals',{p_participant_id:current.participantId,p_after_id:Number(afterId)||0,p_limit:Number(limit)||100}),
    pruneSignals:roomId=>rpc('meet_v2_prune_signals',{p_room_id:roomId}),
    iceConfig:async(force=false,ttl=7200)=>{
      const now=Date.now();if(!current.roomId||current.state!=='joined')throw new Error('meeting_context_missing');
      if(!force&&turnCache.roomId===current.roomId&&turnCache.expiresAtMs>now+5*60*1000)return {...turnCache,iceServers:turnCache.iceServers.map(server=>({...server}))};
      try{
        const data=await invokeFunction('meet-v2-turn-credentials',{roomId:current.roomId,ttl:Math.max(900,Math.min(Number(ttl)||7200,43200))});
        const servers=Array.isArray(data?.iceServers)?data.iceServers.filter(server=>server&&server.urls):[];
        const expiresAtMs=Date.parse(String(data?.expiresAt||''));
        if(!hasRelay(servers)||!Number.isFinite(expiresAtMs))throw new Error('turn_relay_unavailable');
        turnCache={roomId:current.roomId,iceServers:servers,expiresAtMs,provider:String(data?.provider||'relay'),ttl:Number(data?.ttl)||0,qaDirectOnly:false};
      }catch{
        turnCache={roomId:current.roomId,iceServers:directIce.map(server=>({...server,urls:[...server.urls]})),expiresAtMs:now+30*60*1000,provider:'direct-fallback',ttl:1800,qaDirectOnly:true};
      }
      return {...turnCache,iceServers:turnCache.iceServers.map(server=>({...server}))};
    }
  });

  function joinUrlFromLocation(){
    const params=new URLSearchParams(location.search),meetingId=params.get('meetingId')||params.get('mid')||'',passcode=params.get('passcode')||params.get('pwd')||'';
    return /^\d{10,11}$/.test(normalizeDigits(meetingId))&&/^\d{3,7}$/.test(normalizeDigits(passcode))?`dominionstar-meet://join?meetingId=${normalizeDigits(meetingId)}&passcode=${normalizeDigits(passcode)}`:'';
  }

  window.dominionDesktop=Object.freeze({
    isDesktop:true,
    isBrowserMeet:true,
    platform:navigator.platform||'web',
    environment:async()=>({surface:'browser-meet',platform:'web',packaged:false,installedInApplications:false}),
    app:Object.freeze({meetingEnded:async()=>({ok:true})}),
    power:Object.freeze({onChanged:()=>()=>{}}),
    joinLinks:Object.freeze({consume:async()=>joinUrlFromLocation(),onOpen:()=>()=>{}}),
    auth:Object.freeze({
      getState:authState,
      startGoogle:async()=>{const instance=await client();const redirectTo=new URL('/meet/',location.origin).href;const result=await instance.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(result.error)throw result.error;return {ok:true};},
      signInPassword:async(email,password)=>{const instance=await client(),result=await instance.auth.signInWithPassword({email:String(email||'').trim().toLowerCase(),password:String(password||'')});if(result.error)throw result.error;return emitAuth(instance);},
      updateAvatar:async()=>{throw new Error('Update your profile picture from the DominionStar agent dashboard.');},
      signOut:async()=>{const instance=await client();await instance.auth.signOut();return {ok:true};},
      onChanged:callback=>{if(typeof callback!=='function')return()=>{};authListeners.add(callback);return()=>authListeners.delete(callback);},
      onError:()=>()=>{}
    }),
    notifications:Object.freeze({showMeeting:async()=>({ok:true}),setWaitingCount:async()=>({ok:true})}),
    meeting
  });
})();