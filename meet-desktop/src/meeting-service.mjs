const normalizeRoomCode=value=>String(value||'').replace(/\D/g,'');
const normalizePasscode=value=>String(value||'').replace(/\D/g,'');
const normalizeName=value=>String(value||'').trim().slice(0,100);
const normalizeTitle=value=>String(value||'').trim().slice(0,120)||'DominionStar Meeting';
const validPasscode=value=>/^\d{3,7}$/.test(String(value||''));
const validRoomCode=value=>/^\d{10,11}$/.test(String(value||''));
const hasRelay=servers=>(servers||[]).some(server=>{const urls=Array.isArray(server?.urls)?server.urls:[server?.urls];return urls.some(url=>/^turns?:/i.test(String(url||'')))&&Boolean(server?.username)&&Boolean(server?.credential);});
const QA_DIRECT_ICE=Object.freeze([{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]);

export function createMeetingService({auth,allowDirectQa=false}){
  if(!auth?.rpc||!auth?.invokeServerFunction)throw new Error('Meeting service requires authenticated RPC and server-function transport.');
  let current={roomId:'',roomCode:'',passcode:'',title:'',participantId:'',joinToken:'',role:'',state:'',meetingKind:'',reusable:false,scheduleId:''};
  let turnCache={roomId:'',iceServers:[],expiresAtMs:0,provider:'',ttl:0,qaDirectOnly:false};
  const cloneIce=value=>Object.freeze({...value,iceServers:value.iceServers.map(server=>({...server,urls:Array.isArray(server.urls)?[...server.urls]:server.urls}))});
  const remember=value=>{
    if(value?.roomId)current={
      roomId:String(value.roomId),
      roomCode:String(value.roomCode||current.roomCode||''),
      passcode:String(value.passcode||current.passcode||''),
      title:String(value.title||current.title||''),
      participantId:String(value.participantId||current.participantId||''),
      joinToken:String(value.joinToken||current.joinToken||''),
      role:String(value.role||current.role||''),
      state:String(value.state||current.state||''),
      meetingKind:String(value.meetingKind||current.meetingKind||''),
      reusable:Boolean(value.reusable??current.reusable),
      scheduleId:String(value.scheduleId||current.scheduleId||'')
    };
    return value;
  };
  const clear=()=>{
    current={roomId:'',roomCode:'',passcode:'',title:'',participantId:'',joinToken:'',role:'',state:'',meetingKind:'',reusable:false,scheduleId:''};
    turnCache={roomId:'',iceServers:[],expiresAtMs:0,provider:'',ttl:0,qaDirectOnly:false};
  };
  const assertPasscode=passcode=>{if(!validPasscode(passcode))throw new Error('Passcode must contain 3 to 7 digits.');};

  async function createRoom(input={}){
    const passcode=normalizePasscode(input.passcode);
    assertPasscode(passcode);
    const title=normalizeTitle(input.title);
    const result=await auth.rpc('meet_v2_create_room',{
      p_title:title,
      p_passcode:passcode,
      p_waiting_room_enabled:input.waitingRoomEnabled!==false,
      p_external_guests_allowed:input.externalGuestsAllowed!==false
    });
    return remember({...result,title,passcode,roomCode:String(result?.roomCode||''),meetingKind:String(result?.meetingKind||'instant')});
  }

  async function personalRoom(){
    const result=await auth.rpc('meet_v2_get_personal_room',{});
    return {...result,roomCode:String(result?.roomCode||''),passcode:String(result?.passcode||''),meetingKind:'personal',reusable:true};
  }

  async function updatePersonalRoom(input={}){
    const passcode=normalizePasscode(input.passcode);
    assertPasscode(passcode);
    const result=await auth.rpc('meet_v2_update_personal_room',{
      p_passcode:passcode,
      p_use_for_instant:input.useForInstant!==false,
      p_waiting_room_enabled:input.waitingRoomEnabled!==false,
      p_external_guests_allowed:input.externalGuestsAllowed!==false
    });
    return {...result,roomCode:String(result?.roomCode||''),passcode:String(result?.passcode||passcode),meetingKind:'personal',reusable:true};
  }

  async function startPersonalRoom(){
    return remember({...await auth.rpc('meet_v2_start_personal_room',{}),meetingKind:'personal',reusable:true});
  }

  async function startHostRoom(roomId){
    return remember(await auth.rpc('meet_v2_start_host_room',{p_room_id:roomId}));
  }

  async function scheduleRoom(input={}){
    const title=normalizeTitle(input.title);
    const usePersonalRoom=Boolean(input.usePersonalRoom);
    const passcode=usePersonalRoom?'':normalizePasscode(input.passcode);
    if(!usePersonalRoom)assertPasscode(passcode);
    const startsAt=new Date(input.scheduledStart||input.startsAt||'');
    if(!Number.isFinite(startsAt.getTime()))throw new Error('Choose a valid meeting date and time.');
    const duration=Math.max(15,Math.min(480,Number(input.durationMinutes)||60));
    const recurrence=input.recurrence&&typeof input.recurrence==='object'?input.recurrence:null;
    const result=await auth.rpc('meet_v2_schedule_meeting',{
      p_title:title,
      p_passcode:passcode||null,
      p_scheduled_start:startsAt.toISOString(),
      p_duration_minutes:duration,
      p_recurrence:recurrence,
      p_waiting_room_enabled:input.waitingRoomEnabled!==false,
      p_external_guests_allowed:input.externalGuestsAllowed!==false,
      p_use_personal_room:usePersonalRoom
    });
    return {...result,roomCode:String(result?.roomCode||''),passcode:String(result?.passcode||''),title};
  }

  const listSchedules=()=>auth.rpc('meet_v2_list_host_schedules',{});
  const cancelSchedule=scheduleId=>auth.rpc('meet_v2_cancel_schedule',{p_schedule_id:scheduleId});
  const startSchedule=async scheduleId=>remember(await auth.rpc('meet_v2_mark_schedule_started',{p_schedule_id:scheduleId}));

  async function updateRoomPasscode(roomId,value){
    const passcode=normalizePasscode(value);
    assertPasscode(passcode);
    const result=await auth.rpc('meet_v2_update_room_passcode',{p_room_id:roomId,p_passcode:passcode});
    if(current.roomId===String(roomId))current.passcode=passcode;
    return result;
  }

  async function requestJoin(input={}){
    const roomCode=normalizeRoomCode(input.roomCode);
    const passcode=normalizePasscode(input.passcode);
    const displayName=normalizeName(input.displayName);
    if(!validRoomCode(roomCode))throw new Error('Meeting ID must contain 10 or 11 digits.');
    assertPasscode(passcode);
    if(!displayName)throw new Error('Enter your display name.');
    const result=await auth.rpc('meet_v2_request_join',{
      p_room_code:roomCode,
      p_passcode:passcode,
      p_display_name:displayName
    });
    return remember({...result,roomCode,passcode,title:String(result?.title||'DominionStar Meeting')});
  }

  const joinStatus=async(participantId,joinToken)=>remember(await auth.rpc('meet_v2_join_status',{p_participant_id:participantId,p_join_token:joinToken}));
  const markJoined=async(participantId,joinToken)=>remember(await auth.rpc('meet_v2_mark_joined',{p_participant_id:participantId,p_join_token:joinToken}));
  const leaveRoom=async(participantId,joinToken)=>{const result=await auth.rpc('meet_v2_leave_room',{p_participant_id:participantId,p_join_token:joinToken});clear();return result;};
  const hostQueue=roomId=>auth.rpc('meet_v2_host_queue',{p_room_id:roomId});
  const decide=(participantId,decision)=>auth.rpc('meet_v2_decide_participant',{p_participant_id:participantId,p_decision:decision});
  const snapshot=roomId=>auth.rpc('meet_v2_room_snapshot',{p_room_id:roomId});
  const touchPresence=(participantId,joinToken)=>auth.rpc('meet_v2_touch_presence',{p_participant_id:participantId,p_join_token:joinToken});
  const setCohost=(participantId,enabled)=>auth.rpc('meet_v2_set_cohost',{p_participant_id:participantId,p_enabled:Boolean(enabled)});
  const removeParticipant=participantId=>auth.rpc('meet_v2_remove_participant',{p_participant_id:participantId});
  const renameParticipant=(participantId,displayName)=>auth.rpc('meet_v2_rename_participant',{p_participant_id:participantId,p_display_name:normalizeName(displayName)});
  const setRecordingPermission=(participantId,enabled)=>auth.rpc('meet_v2_set_recording_permission',{p_participant_id:participantId,p_enabled:Boolean(enabled)});
  const setRecordingState=(participantId,active,paused=false)=>auth.rpc('meet_v2_set_recording_state',{p_participant_id:participantId,p_active:Boolean(active),p_paused:Boolean(paused)});
  const setSecurity=(roomId,{locked=false,muteOnEntry=false}={})=>auth.rpc('meet_v2_set_security',{p_room_id:roomId,p_locked:Boolean(locked),p_mute_on_entry:Boolean(muteOnEntry)});
  const setChatPolicy=(roomId,policy='everyone')=>auth.rpc('meet_v2_set_chat_policy',{p_room_id:roomId,p_policy:String(policy||'everyone')});
  const setCaptionState=(roomId,{mode='off',captionerParticipantId=null,transcriptEnabled=false}={})=>auth.rpc('meet_v2_set_caption_state',{p_room_id:roomId,p_mode:String(mode||'off'),p_captioner_participant_id:captionerParticipantId||null,p_transcript_enabled:Boolean(transcriptEnabled)});
  const publishCaption=(participantId,text,speakerName)=>auth.rpc('meet_v2_publish_caption',{p_participant_id:participantId,p_text:String(text||'').trim(),p_speaker_name:normalizeName(speakerName)||'Captioner'});
  const transcript=roomId=>auth.rpc('meet_v2_get_transcript',{p_room_id:roomId});
  const transferHostAndLeave=async participantId=>{const result=await auth.rpc('meet_v2_transfer_host_and_leave',{p_target_participant_id:participantId});clear();return result;};
  const endRoom=async roomId=>{const result=await auth.rpc('meet_v2_end_room',{p_room_id:roomId});clear();return result;};
  const context=()=>Object.freeze({...current});

  const sendSignal=(toParticipantId,type,payload={})=>{
    if(!current.participantId)throw new Error('meeting_context_missing');
    return auth.rpc('meet_v2_send_signal',{
      p_from_participant_id:current.participantId,
      p_to_participant_id:toParticipantId,
      p_signal_type:String(type||''),
      p_payload:payload||{}
    });
  };

  const pullSignals=(afterId=0,limit=100)=>{
    if(!current.participantId)throw new Error('meeting_context_missing');
    return auth.rpc('meet_v2_pull_signals',{
      p_participant_id:current.participantId,
      p_after_id:Number(afterId)||0,
      p_limit:Number(limit)||100
    });
  };

  const pruneSignals=roomId=>auth.rpc('meet_v2_prune_signals',{p_room_id:roomId});

  const directQaConfig=now=>{
    turnCache={
      roomId:current.roomId,
      iceServers:QA_DIRECT_ICE.map(server=>({...server,urls:[...server.urls]})),
      expiresAtMs:now+30*60*1000,
      provider:'direct-qa',
      ttl:1800,
      qaDirectOnly:true
    };
    return cloneIce(turnCache);
  };

  async function iceConfig({force=false,ttl=7200}={}){
    if(!current.roomId||current.state!=='joined')throw new Error('meeting_context_missing');
    const now=Date.now();
    const cachedReady=hasRelay(turnCache.iceServers)||turnCache.qaDirectOnly===true;
    if(!force&&turnCache.roomId===current.roomId&&turnCache.expiresAtMs-now>10*60*1000&&cachedReady)return cloneIce(turnCache);
    try{
      const data=await auth.invokeServerFunction('meet-v2-turn-credentials',{
        roomId:current.roomId,
        ttl:Math.max(900,Math.min(Number(ttl)||7200,43200))
      });
      const servers=Array.isArray(data?.iceServers)?data.iceServers.filter(server=>server&&server.urls):[];
      if(!hasRelay(servers))throw new Error('turn_relay_unavailable');
      const expiresAtMs=Date.parse(String(data?.expiresAt||''));
      if(!Number.isFinite(expiresAtMs)||expiresAtMs<=now+5*60*1000)throw new Error('turn_credentials_expire_too_soon');
      turnCache={
        roomId:current.roomId,
        iceServers:servers,
        expiresAtMs,
        provider:String(data?.provider||'relay'),
        ttl:Number(data?.ttl)||0,
        qaDirectOnly:false
      };
      return cloneIce(turnCache);
    }catch(error){
      if(!allowDirectQa)throw error;
      return directQaConfig(now);
    }
  }

  return Object.freeze({
    createRoom,
    personalRoom,
    updatePersonalRoom,
    startPersonalRoom,
    startHostRoom,
    scheduleRoom,
    listSchedules,
    cancelSchedule,
    startSchedule,
    updateRoomPasscode,
    requestJoin,
    joinStatus,
    markJoined,
    leaveRoom,
    hostQueue,
    decide,
    snapshot,
    touchPresence,
    setCohost,
    removeParticipant,
    renameParticipant,
    setRecordingPermission,
    setRecordingState,
    setSecurity,
    setChatPolicy,
    setCaptionState,
    publishCaption,
    transcript,
    transferHostAndLeave,
    endRoom,
    context,
    sendSignal,
    pullSignals,
    pruneSignals,
    iceConfig
  });
}
