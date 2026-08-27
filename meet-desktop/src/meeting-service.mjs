const normalizeRoomCode=value=>String(value||'').replace(/\D/g,'').slice(0,10);
const normalizePasscode=value=>String(value||'').replace(/\D/g,'').slice(0,10);
const normalizeName=value=>String(value||'').trim().slice(0,100);
const normalizeTitle=value=>String(value||'').trim().slice(0,120)||'DominionStar Meeting';
const hasRelay=servers=>(servers||[]).some(server=>{const urls=Array.isArray(server?.urls)?server.urls:[server?.urls];return urls.some(url=>/^turns?:/i.test(String(url||'')))&&Boolean(server?.username)&&Boolean(server?.credential);});

export function createMeetingService({auth}){
  if(!auth?.rpc||!auth?.invokeServerFunction)throw new Error('Meeting service requires authenticated RPC and server-function transport.');
  let current={roomId:'',participantId:'',joinToken:'',role:'',state:''};
  let turnCache={roomId:'',iceServers:[],expiresAtMs:0,provider:'',ttl:0};
  const remember=value=>{if(value?.roomId)current={roomId:String(value.roomId),participantId:String(value.participantId||current.participantId||''),joinToken:String(value.joinToken||current.joinToken||''),role:String(value.role||current.role||''),state:String(value.state||current.state||'')};return value;};
  const clear=()=>{current={roomId:'',participantId:'',joinToken:'',role:'',state:''};turnCache={roomId:'',iceServers:[],expiresAtMs:0,provider:'',ttl:0};};
  async function createRoom(input={}){const passcode=normalizePasscode(input.passcode);if(passcode.length<4)throw new Error('Passcode must be at least 4 digits.');return remember(await auth.rpc('meet_v2_create_room',{p_title:normalizeTitle(input.title),p_passcode:passcode,p_waiting_room_enabled:input.waitingRoomEnabled!==false,p_external_guests_allowed:input.externalGuestsAllowed!==false}));}
  async function requestJoin(input={}){const roomCode=normalizeRoomCode(input.roomCode);const passcode=normalizePasscode(input.passcode);const displayName=normalizeName(input.displayName);if(roomCode.length!==10)throw new Error('Meeting ID must contain 10 digits.');if(passcode.length<4)throw new Error('Enter the meeting passcode.');if(!displayName)throw new Error('Enter your display name.');return remember(await auth.rpc('meet_v2_request_join',{p_room_code:roomCode,p_passcode:passcode,p_display_name:displayName}));}
  const joinStatus=async(participantId,joinToken)=>remember(await auth.rpc('meet_v2_join_status',{p_participant_id:participantId,p_join_token:joinToken}));
  const markJoined=async(participantId,joinToken)=>remember(await auth.rpc('meet_v2_mark_joined',{p_participant_id:participantId,p_join_token:joinToken}));
  const leaveRoom=async(participantId,joinToken)=>{const result=await auth.rpc('meet_v2_leave_room',{p_participant_id:participantId,p_join_token:joinToken});clear();return result;};
  const hostQueue=roomId=>auth.rpc('meet_v2_host_queue',{p_room_id:roomId});
  const decide=(participantId,decision)=>auth.rpc('meet_v2_decide_participant',{p_participant_id:participantId,p_decision:decision});
  const snapshot=roomId=>auth.rpc('meet_v2_room_snapshot',{p_room_id:roomId});
  const setCohost=(participantId,enabled)=>auth.rpc('meet_v2_set_cohost',{p_participant_id:participantId,p_enabled:Boolean(enabled)});
  const removeParticipant=participantId=>auth.rpc('meet_v2_remove_participant',{p_participant_id:participantId});
  const endRoom=async roomId=>{const result=await auth.rpc('meet_v2_end_room',{p_room_id:roomId});clear();return result;};
  const context=()=>Object.freeze({...current});
  const sendSignal=(toParticipantId,type,payload={})=>{if(!current.participantId)throw new Error('meeting_context_missing');return auth.rpc('meet_v2_send_signal',{p_from_participant_id:current.participantId,p_to_participant_id:toParticipantId,p_signal_type:String(type||''),p_payload:payload||{}});};
  const pullSignals=(afterId=0,limit=100)=>{if(!current.participantId)throw new Error('meeting_context_missing');return auth.rpc('meet_v2_pull_signals',{p_participant_id:current.participantId,p_after_id:Number(afterId)||0,p_limit:Number(limit)||100});};
  const pruneSignals=roomId=>auth.rpc('meet_v2_prune_signals',{p_room_id:roomId});
  async function iceConfig({force=false,ttl=7200}={}){
    if(!current.roomId||current.state!=='joined')throw new Error('meeting_context_missing');
    const now=Date.now();
    if(!force&&turnCache.roomId===current.roomId&&turnCache.expiresAtMs-now>10*60*1000&&hasRelay(turnCache.iceServers))return Object.freeze({...turnCache,iceServers:turnCache.iceServers.map(server=>({...server,urls:Array.isArray(server.urls)?[...server.urls]:server.urls}))});
    const data=await auth.invokeServerFunction('meet-v2-turn-credentials',{roomId:current.roomId,ttl:Math.max(900,Math.min(Number(ttl)||7200,43200))});
    const servers=Array.isArray(data?.iceServers)?data.iceServers.filter(server=>server&&server.urls):[];
    if(!hasRelay(servers))throw new Error('turn_relay_unavailable');
    const expiresAtMs=Date.parse(String(data?.expiresAt||''));
    if(!Number.isFinite(expiresAtMs)||expiresAtMs<=now+5*60*1000)throw new Error('turn_credentials_expire_too_soon');
    turnCache={roomId:current.roomId,iceServers:servers,expiresAtMs,provider:String(data?.provider||'relay'),ttl:Number(data?.ttl)||0};
    return Object.freeze({...turnCache,iceServers:turnCache.iceServers.map(server=>({...server,urls:Array.isArray(server.urls)?[...server.urls]:server.urls}))});
  }
  return Object.freeze({createRoom,requestJoin,joinStatus,markJoined,leaveRoom,hostQueue,decide,snapshot,setCohost,removeParticipant,endRoom,context,sendSignal,pullSignals,pruneSignals,iceConfig});
}
