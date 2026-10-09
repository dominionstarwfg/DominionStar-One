import assert from 'node:assert/strict';
import {createMeetingService} from '../src/meeting-service.mjs';

const room={roomId:'qa-room-lifecycle',roomCode:'73000000001',passcode:'731',title:'DominionStar Lifecycle QA',status:'live',waitingRoomEnabled:true,locked:false,muteOnEntry:false,activeHostParticipantId:'p-host'};
const participants=new Map();
const actorParticipant={host:'p-host',guest:'p-guest',observer:'p-observer'};
const tokenFor=id=>`token-${id}`;
const publicParticipant=p=>({participantId:p.participantId,displayName:p.displayName,role:p.role,state:p.state,memberId:p.memberId||null,recordingAllowed:false});
const activeSnapshotParticipants=()=>[...participants.values()].filter(p=>['admitted','joined'].includes(p.state)).map(publicParticipant);

function requireHost(actor){const p=participants.get(actorParticipant[actor]);if(p?.role!=='host')throw new Error('host_authority_required');}
function requireHostOrCohost(actor){const p=participants.get(actorParticipant[actor]);if(!['host','cohost'].includes(p?.role))throw new Error('host_or_cohost_required');}
function participantByArgs(args){const id=String(args.p_participant_id||args.p_target_participant_id||'');const p=participants.get(id);if(!p)throw new Error('participant_not_found');return p;}

function makeAuth(actor){
  return {
    async rpc(name,args={}){
      switch(name){
        case 'meet_v2_create_room': {
          if(actor!=='host')throw new Error('host_required');
          const host={participantId:'p-host',displayName:'QA Host',role:'host',state:'joined',joinToken:tokenFor('p-host'),memberId:'member-host'};
          participants.set(host.participantId,host);
          room.activeHostParticipantId=host.participantId;room.status='live';room.waitingRoomEnabled=Boolean(args.p_waiting_room_enabled);room.passcode=String(args.p_passcode);room.title=String(args.p_title);
          return {...room,participantId:host.participantId,joinToken:host.joinToken,role:'host',state:'joined',meetingKind:'instant',reusable:false};
        }
        case 'meet_v2_request_join': {
          if(String(args.p_room_code)!==room.roomCode)throw new Error('meeting_not_found');
          if(String(args.p_passcode)!==room.passcode)throw new Error('invalid_passcode');
          const id=actorParticipant[actor];if(!id||actor==='host')throw new Error('invalid_join_actor');
          const p={participantId:id,displayName:String(args.p_display_name),role:'participant',state:room.waitingRoomEnabled?'waiting':'admitted',joinToken:tokenFor(id),memberId:actor==='guest'?'member-guest':null};
          participants.set(id,p);
          return {...room,participantId:id,joinToken:p.joinToken,role:p.role,state:p.state,waitReason:p.state==='waiting'?'admission':''};
        }
        case 'meet_v2_join_status': {
          const p=participantByArgs(args);if(String(args.p_join_token)!==p.joinToken)throw new Error('invalid_join_token');
          return {...room,...publicParticipant(p),joinToken:p.joinToken,waitReason:p.state==='waiting'?'admission':''};
        }
        case 'meet_v2_mark_joined': {
          const p=participantByArgs(args);if(String(args.p_join_token)!==p.joinToken)throw new Error('invalid_join_token');if(p.state!=='admitted')throw new Error('participant_not_admitted');
          p.state='joined';return {...room,...publicParticipant(p),joinToken:p.joinToken};
        }
        case 'meet_v2_host_queue':
          requireHostOrCohost(actor);return {waiting:[...participants.values()].filter(p=>p.state==='waiting').map(publicParticipant)};
        case 'meet_v2_decide_participant': {
          requireHostOrCohost(actor);const p=participantByArgs(args);if(p.state!=='waiting')throw new Error('participant_not_waiting');
          p.state=String(args.p_decision)==='admit'?'admitted':'declined';return {ok:true,participantId:p.participantId,state:p.state};
        }
        case 'meet_v2_room_snapshot':
          return {...room,participants:activeSnapshotParticipants()};
        case 'meet_v2_touch_presence':
          return {ok:true};
        case 'meet_v2_set_cohost': {
          requireHost(actor);const p=participantByArgs(args);if(p.state!=='joined')throw new Error('participant_not_joined');
          p.role=Boolean(args.p_enabled)?'cohost':'participant';return {ok:true,participantId:p.participantId,role:p.role};
        }
        case 'meet_v2_rename_participant': {
          requireHostOrCohost(actor);const p=participantByArgs(args);p.displayName=String(args.p_display_name||'').trim();
          return {ok:true,participantId:p.participantId,displayName:p.displayName};
        }
        case 'meet_v2_set_security':
          requireHostOrCohost(actor);room.locked=Boolean(args.p_locked);room.muteOnEntry=Boolean(args.p_mute_on_entry);
          return {roomId:room.roomId,meetingLocked:room.locked,muteOnEntry:room.muteOnEntry};
        case 'meet_v2_set_waiting_room': {
          requireHostOrCohost(actor);room.waitingRoomEnabled=Boolean(args.p_enabled);let admittedCount=0;
          if(!room.waitingRoomEnabled)for(const p of participants.values())if(p.state==='waiting'){p.state='admitted';admittedCount+=1;}
          return {roomId:room.roomId,waitingRoomEnabled:room.waitingRoomEnabled,admittedFromWaiting:admittedCount};
        }
        case 'meet_v2_leave_room': {
          const p=participantByArgs(args);if(String(args.p_join_token)!==p.joinToken)throw new Error('invalid_join_token');p.state='left';return {participantId:p.participantId,state:'left'};
        }
        case 'meet_v2_transfer_host_and_leave': {
          requireHost(actor);const source=participants.get(actorParticipant[actor]),target=participantByArgs(args);if(target.state!=='joined')throw new Error('target_not_joined');
          source.state='left';source.role='participant';target.role='host';room.activeHostParticipantId=target.participantId;
          return {ok:true,roomId:room.roomId,newHostParticipantId:target.participantId};
        }
        case 'meet_v2_end_room':
          requireHost(actor);room.status='ended';for(const p of participants.values())if(['waiting','admitted','joined'].includes(p.state))p.state='left';return {roomId:room.roomId,status:'ended'};
        default: throw new Error(`Unexpected RPC ${name}`);
      }
    },
    async invokeServerFunction(){throw new Error('TURN is not part of lifecycle communication acceptance.');}
  };
}

const host=createMeetingService({auth:makeAuth('host'),allowDirectQa:true});
const guest=createMeetingService({auth:makeAuth('guest'),allowDirectQa:true});
const observer=createMeetingService({auth:makeAuth('observer'),allowDirectQa:true});

const hostStart=await host.createRoom({title:room.title,passcode:room.passcode,waitingRoomEnabled:true,externalGuestsAllowed:true});
assert.equal(hostStart.state,'joined');assert.equal(host.context().role,'host');

const join=await guest.requestJoin({roomCode:room.roomCode,passcode:room.passcode,displayName:'QA Guest'});
assert.equal(join.state,'waiting','Guest must enter the Waiting Room while admission is enabled.');
const queue=await host.hostQueue(room.roomId);
assert.equal(queue.waiting.length,1,'Host must see the guest in the Waiting Room queue.');assert.equal(queue.waiting[0].participantId,'p-guest');

await host.decide('p-guest','admit');
assert.equal((await guest.joinStatus('p-guest',tokenFor('p-guest'))).state,'admitted','Guest must observe host admission through join-status polling.');
assert.equal((await guest.markJoined('p-guest',tokenFor('p-guest'))).state,'joined','Admitted guest must transition to joined.');

let snapshot=await host.snapshot(room.roomId);
assert.ok(snapshot.participants.some(p=>p.participantId==='p-guest'&&p.state==='joined'),'Joined guest must appear in the shared room snapshot.');

await host.setCohost('p-guest',true);await host.renameParticipant('p-guest','QA Co-host Renamed');
snapshot=await host.snapshot(room.roomId);
const promoted=snapshot.participants.find(p=>p.participantId==='p-guest');
assert.equal(promoted?.role,'cohost','Co-host promotion must be visible in the room snapshot.');
assert.equal(promoted?.displayName,'QA Co-host Renamed','Rename must be visible in the room snapshot.');

const observerJoin=await observer.requestJoin({roomCode:room.roomCode,passcode:room.passcode,displayName:'QA Observer'});
assert.equal(observerJoin.state,'waiting');
const security=await host.setSecurity(room.roomId,{locked:false,muteOnEntry:true,waitingRoomEnabled:false});
assert.equal(security.waitingRoomEnabled,false,'Runtime Waiting Room toggle must update through the production service.');
assert.equal(security.admittedCount,1,'Disabling Waiting Room must admit people already waiting.');
assert.equal((await observer.joinStatus('p-observer',tokenFor('p-observer'))).state,'admitted');
await observer.markJoined('p-observer',tokenFor('p-observer'));
assert.ok((await host.snapshot(room.roomId)).participants.some(p=>p.participantId==='p-observer'),'Newly admitted participant must join the shared roster.');

await observer.leaveRoom('p-observer',tokenFor('p-observer'));
assert.ok(!(await host.snapshot(room.roomId)).participants.some(p=>p.participantId==='p-observer'),'Leaving participant must disappear from the active room snapshot.');

await host.transferHostAndLeave('p-guest');
assert.equal(host.context().roomId,'','Outgoing host context must clear after atomic host transfer.');
snapshot=await guest.snapshot(room.roomId);
assert.equal(snapshot.participants.find(p=>p.participantId==='p-guest')?.role,'host','Transferred participant must become active host.');
assert.ok(!snapshot.participants.some(p=>p.participantId==='p-host'),'Outgoing host must leave the active roster during transfer.');

const ended=await guest.endRoom(room.roomId);
assert.equal(ended.status,'ended','New host must be able to end the meeting for everyone.');
assert.equal(room.status,'ended');assert.equal(guest.context().roomId,'','Ending the room must clear the new host context.');

console.log('DOMINIONSTAR_MEETING_LIFECYCLE_COMMUNICATION_2_0_52_OK waiting-room host-queue admit auto-status joined-roster cohost rename runtime-waiting-toggle admit-waiters participant-leave host-transfer end-for-all');
