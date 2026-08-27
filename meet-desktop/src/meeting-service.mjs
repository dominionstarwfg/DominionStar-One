const normalizeRoomCode=value=>String(value||'').replace(/\D/g,'').slice(0,10);
const normalizePasscode=value=>String(value||'').replace(/\D/g,'').slice(0,10);
const normalizeName=value=>String(value||'').trim().slice(0,100);
const normalizeTitle=value=>String(value||'').trim().slice(0,120)||'DominionStar Meeting';

export function createMeetingService({auth}){
  if(!auth?.rpc)throw new Error('Meeting service requires authenticated RPC transport.');
  async function createRoom(input={}){const passcode=normalizePasscode(input.passcode);if(passcode.length<4)throw new Error('Passcode must be at least 4 digits.');return auth.rpc('meet_v2_create_room',{p_title:normalizeTitle(input.title),p_passcode:passcode,p_waiting_room_enabled:input.waitingRoomEnabled!==false,p_external_guests_allowed:input.externalGuestsAllowed!==false});}
  async function requestJoin(input={}){const roomCode=normalizeRoomCode(input.roomCode);const passcode=normalizePasscode(input.passcode);const displayName=normalizeName(input.displayName);if(roomCode.length!==10)throw new Error('Meeting ID must contain 10 digits.');if(passcode.length<4)throw new Error('Enter the meeting passcode.');if(!displayName)throw new Error('Enter your display name.');return auth.rpc('meet_v2_request_join',{p_room_code:roomCode,p_passcode:passcode,p_display_name:displayName});}
  const joinStatus=(participantId,joinToken)=>auth.rpc('meet_v2_join_status',{p_participant_id:participantId,p_join_token:joinToken});
  const markJoined=(participantId,joinToken)=>auth.rpc('meet_v2_mark_joined',{p_participant_id:participantId,p_join_token:joinToken});
  const leaveRoom=(participantId,joinToken)=>auth.rpc('meet_v2_leave_room',{p_participant_id:participantId,p_join_token:joinToken});
  const hostQueue=roomId=>auth.rpc('meet_v2_host_queue',{p_room_id:roomId});
  const decide=(participantId,decision)=>auth.rpc('meet_v2_decide_participant',{p_participant_id:participantId,p_decision:decision});
  const snapshot=roomId=>auth.rpc('meet_v2_room_snapshot',{p_room_id:roomId});
  const setCohost=(participantId,enabled)=>auth.rpc('meet_v2_set_cohost',{p_participant_id:participantId,p_enabled:Boolean(enabled)});
  const removeParticipant=participantId=>auth.rpc('meet_v2_remove_participant',{p_participant_id:participantId});
  const endRoom=roomId=>auth.rpc('meet_v2_end_room',{p_room_id:roomId});
  return Object.freeze({createRoom,requestJoin,joinStatus,markJoined,leaveRoom,hostQueue,decide,snapshot,setCohost,removeParticipant,endRoom});
}
