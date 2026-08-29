import assert from 'node:assert/strict';
import {createMeetingService} from '../src/meeting-service.mjs';

const calls=[];
const personal={
  roomId:'room-personal',
  roomCode:'1234567890',
  passcode:'360',
  title:'Personal Meeting Room',
  waitingRoomEnabled:true,
  externalGuestsAllowed:true,
  useForInstant:true
};
let generatedCounter=0;
const schedules=new Map();

const hostSession=(room,extra={})=>({
  roomId:room.roomId,
  roomCode:room.roomCode,
  passcode:room.passcode,
  title:room.title,
  participantId:`host-${room.roomId}`,
  joinToken:`token-${room.roomId}`,
  role:'host',
  state:'joined',
  meetingKind:extra.meetingKind||room.meetingKind||'instant',
  reusable:Boolean(extra.reusable??room.reusable),
  scheduleId:extra.scheduleId||''
});

const auth={
  async rpc(name,args={}){
    calls.push({name,args:structuredClone(args)});
    switch(name){
      case 'meet_v2_get_personal_room':
        return {...personal,meetingKind:'personal',reusable:true};
      case 'meet_v2_update_personal_room':
        personal.passcode=args.p_passcode;
        personal.useForInstant=Boolean(args.p_use_for_instant);
        personal.waitingRoomEnabled=Boolean(args.p_waiting_room_enabled);
        personal.externalGuestsAllowed=Boolean(args.p_external_guests_allowed);
        return {...personal,meetingKind:'personal',reusable:true};
      case 'meet_v2_start_personal_room':
        return hostSession(personal,{meetingKind:'personal',reusable:true});
      case 'meet_v2_create_room': {
        generatedCounter+=1;
        const room={
          roomId:`room-generated-${generatedCounter}`,
          roomCode:String(90000000000+generatedCounter),
          passcode:args.p_passcode,
          title:args.p_title,
          meetingKind:'instant',
          reusable:false
        };
        return hostSession(room,{meetingKind:'instant',reusable:false});
      }
      case 'meet_v2_schedule_meeting': {
        const scheduleId=`schedule-${schedules.size+1}`;
        const usePersonal=Boolean(args.p_use_personal_room);
        const room=usePersonal
          ? personal
          : {
              roomId:`room-${scheduleId}`,
              roomCode:String(91000000000+schedules.size+1),
              passcode:args.p_passcode,
              title:args.p_title,
              meetingKind:args.p_recurrence?'recurring':'scheduled',
              reusable:Boolean(args.p_recurrence)
            };
        const item={
          scheduleId,
          roomId:room.roomId,
          roomCode:room.roomCode,
          passcode:usePersonal?personal.passcode:room.passcode,
          title:args.p_title,
          recurrence:args.p_recurrence,
          usePersonalRoom:usePersonal,
          meetingKind:usePersonal?'personal':(args.p_recurrence?'recurring':'scheduled'),
          reusable:usePersonal||Boolean(args.p_recurrence)
        };
        schedules.set(scheduleId,item);
        return {...item};
      }
      case 'meet_v2_mark_schedule_started': {
        const item=schedules.get(args.p_schedule_id);
        if(!item)throw new Error('schedule_not_found');
        const room={
          roomId:item.roomId,
          roomCode:item.roomCode,
          passcode:item.passcode,
          title:item.title,
          meetingKind:item.meetingKind,
          reusable:item.reusable
        };
        return hostSession(room,{meetingKind:item.meetingKind,reusable:item.reusable,scheduleId:item.scheduleId});
      }
      case 'meet_v2_update_room_passcode': {
        for(const item of schedules.values())if(item.roomId===args.p_room_id)item.passcode=args.p_passcode;
        return {roomId:args.p_room_id,passcode:args.p_passcode};
      }
      case 'meet_v2_request_join':
        return {
          roomId:`joined-${args.p_room_code}`,
          roomCode:args.p_room_code,
          title:'Join target',
          participantId:`participant-${args.p_room_code}`,
          joinToken:`join-${args.p_room_code}`,
          role:'participant',
          state:'waiting'
        };
      case 'meet_v2_end_room':
        return {roomId:args.p_room_id,status:'ended'};
      case 'meet_v2_leave_room':
        return {state:'left'};
      case 'meet_v2_join_status':
        return {roomId:'joined-room',participantId:args.p_participant_id,state:'waiting'};
      case 'meet_v2_mark_joined':
        return {roomId:'joined-room',participantId:args.p_participant_id,state:'joined'};
      case 'meet_v2_host_queue': return [];
      case 'meet_v2_decide_participant': return {ok:true};
      case 'meet_v2_room_snapshot': return {roomId:args.p_room_id,participants:[]};
      case 'meet_v2_set_cohost': return {ok:true};
      case 'meet_v2_remove_participant': return {ok:true};
      case 'meet_v2_list_host_schedules': return [...schedules.values()];
      case 'meet_v2_cancel_schedule': schedules.delete(args.p_schedule_id); return {ok:true};
      case 'meet_v2_send_signal': return {ok:true};
      case 'meet_v2_pull_signals': return [];
      case 'meet_v2_prune_signals': return {ok:true};
      default: throw new Error(`Unexpected RPC ${name}`);
    }
  },
  async invokeServerFunction(){
    throw new Error('TURN should not be touched by meeting identity runtime tests.');
  }
};

const service=createMeetingService({auth,allowDirectQa:true});

// Personal Room identity must remain stable and its passcode must be host-editable.
const firstPersonal=await service.personalRoom();
const secondPersonal=await service.personalRoom();
assert.equal(firstPersonal.roomCode,'1234567890');
assert.equal(secondPersonal.roomCode,firstPersonal.roomCode,'Personal Meeting ID must stay stable.');
assert.equal(firstPersonal.passcode,'360');

const updatedPersonal=await service.updatePersonalRoom({passcode:'731',useForInstant:true,waitingRoomEnabled:true,externalGuestsAllowed:true});
assert.equal(updatedPersonal.roomCode,'1234567890','Changing Personal Room settings must not change its Meeting ID.');
assert.equal(updatedPersonal.passcode,'731');

const firstStart=await service.startPersonalRoom();
assert.equal(firstStart.roomCode,'1234567890');
assert.equal(service.context().meetingKind,'personal');
assert.equal(service.context().reusable,true);
await service.endRoom(firstStart.roomId);
const secondStart=await service.startPersonalRoom();
assert.equal(secondStart.roomCode,firstStart.roomCode,'Ending a Personal Room occurrence must not destroy its identity.');

// Generated instant meetings are intentionally separate identities.
const generatedOne=await service.createRoom({title:'Instant A',passcode:'4321'});
const generatedTwo=await service.createRoom({title:'Instant B',passcode:'7654321'});
assert.notEqual(generatedOne.roomCode,generatedTwo.roomCode,'Generate Automatically must produce a separate Meeting ID.');
assert.equal(generatedOne.roomCode.length,11);
assert.equal(generatedTwo.roomCode.length,11);

// Fixed recurring series must reuse one room identity across starts.
const recurring=await service.scheduleRoom({
  title:'Weekly Leadership',
  passcode:'2468',
  scheduledStart:'2026-09-04T01:00:00-05:00',
  durationMinutes:60,
  recurrence:{type:'weekly',interval:1},
  waitingRoomEnabled:true,
  externalGuestsAllowed:true,
  usePersonalRoom:false
});
assert.equal(recurring.meetingKind,'recurring');
assert.equal(recurring.reusable,true);
const recurringStartOne=await service.startSchedule(recurring.scheduleId);
await service.endRoom(recurringStartOne.roomId);
const recurringStartTwo=await service.startSchedule(recurring.scheduleId);
assert.equal(recurringStartTwo.roomCode,recurringStartOne.roomCode,'Recurring occurrences must reuse the same Meeting ID.');

// Scheduling with the Personal Meeting ID must keep the Personal Room identity.
const personalSchedule=await service.scheduleRoom({
  title:'Personal-room appointment',
  scheduledStart:'2026-09-05T01:00:00-05:00',
  durationMinutes:30,
  recurrence:null,
  waitingRoomEnabled:true,
  externalGuestsAllowed:true,
  usePersonalRoom:true
});
assert.equal(personalSchedule.roomCode,'1234567890');
assert.equal(personalSchedule.passcode,'731');

// Passcodes: exactly 3–7 digits. Overlong inputs must be rejected, never truncated.
await assert.rejects(()=>service.updatePersonalRoom({passcode:'12'}),/3 to 7 digits/);
await assert.rejects(()=>service.updatePersonalRoom({passcode:'12345678'}),/3 to 7 digits/);
await assert.rejects(()=>service.createRoom({title:'Bad',passcode:'12345678'}),/3 to 7 digits/);
await service.createRoom({title:'Three digits',passcode:'123'});
await service.createRoom({title:'Seven digits',passcode:'1234567'});

// Meeting IDs: only 10 or 11 digits. Too-short/too-long IDs must be rejected, never truncated.
await assert.rejects(()=>service.requestJoin({roomCode:'123456789',passcode:'731',displayName:'QA'}),/10 or 11 digits/);
await assert.rejects(()=>service.requestJoin({roomCode:'123456789012',passcode:'731',displayName:'QA'}),/10 or 11 digits/);
const joinPersonal=await service.requestJoin({roomCode:'123 456 7890',passcode:'731',displayName:'QA'});
assert.equal(joinPersonal.roomCode,'1234567890');
const joinGenerated=await service.requestJoin({roomCode:'91000000001',passcode:'2468',displayName:'QA'});
assert.equal(joinGenerated.roomCode,'91000000001');

// Prove the service sent the complete, untruncated values to RPC after validation.
const personalUpdateCall=calls.findLast(call=>call.name==='meet_v2_update_personal_room');
assert.equal(personalUpdateCall.args.p_passcode,'731');
assert(!calls.some(call=>call.args?.p_passcode==='12345678'),'Invalid 8-digit passcodes must never reach the database RPC layer.');
assert(!calls.some(call=>call.args?.p_room_code==='123456789012'),'Invalid 12-digit Meeting IDs must never reach the database RPC layer.');

console.log('DOMINIONSTAR_MEETING_IDENTITY_RUNTIME_OK stable-personal-room editable-3-to-7-passcode generated-11-digit recurring-reuse personal-schedule exact-input-validation');
