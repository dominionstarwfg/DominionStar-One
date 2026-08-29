import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const auth=read('src/auth-service.mjs');
const service=read('src/meeting-service.mjs');
const ui=read('ui/app.js');
const personal=read('ui/personal-room.js');
const schedule=read('ui/schedule-controller.js');
const migration=read('sql/20260828_zoom_meeting_identity.sql');
const reusePatch=read('sql/20260828_zoom_meeting_identity_reuse_patch.sql');
const css=read('ui/meeting.css');

for(const rpc of ['meet_v2_create_room','meet_v2_get_personal_room','meet_v2_update_personal_room','meet_v2_start_personal_room','meet_v2_schedule_meeting','meet_v2_list_host_schedules','meet_v2_mark_schedule_started','meet_v2_cancel_schedule','meet_v2_request_join','meet_v2_join_status','meet_v2_mark_joined','meet_v2_leave_room','meet_v2_host_queue','meet_v2_decide_participant','meet_v2_room_snapshot','meet_v2_set_cohost','meet_v2_remove_participant','meet_v2_rename_participant','meet_v2_set_security','meet_v2_set_chat_policy','meet_v2_transfer_host_and_leave','meet_v2_end_room'])assert(service.includes(rpc),`Missing meeting RPC ${rpc}`);
assert(auth.includes('async function rpc(name,args={})'),'Supabase RPC transport must remain in the Electron main process.');
assert(!ui.includes('createClient(')&&!personal.includes('createClient(')&&!schedule.includes('createClient('),'Renderer must not own Supabase/database access.');

for(const channel of ['meeting:create','meeting:personal-room','meeting:update-personal-room','meeting:start-personal-room','meeting:schedule','meeting:list-schedules','meeting:start-schedule','meeting:cancel-schedule','meeting:request-join','meeting:join-status','meeting:mark-joined','meeting:leave','meeting:host-queue','meeting:decide','meeting:snapshot','meeting:set-cohost','meeting:remove-participant','meeting:rename-participant','meeting:set-security','meeting:set-chat-policy','meeting:transfer-host-and-leave','meeting:end'])assert(main.includes(channel),`Missing IPC owner ${channel}`);
for(const method of ['create:','personalRoom:','updatePersonalRoom:','startPersonalRoom:','schedule:','listSchedules:','startSchedule:','cancelSchedule:','requestJoin:','joinStatus:','markJoined:','leave:','hostQueue:','decide:','snapshot:','setCohost:','removeParticipant:','renameParticipant:','setSecurity:','setChatPolicy:','transferHostAndLeave:','end:'])assert(preload.includes(method),`Missing renderer bridge method ${method}`);

assert(service.includes("/^\\d{3,7}$/"),'DominionStar passcodes must be restricted to 3–7 numeric digits.');
assert(service.includes("/^\\d{10,11}$/"),'Join must accept 10-digit Personal IDs and 11-digit generated Meeting IDs.');
assert(!ui.includes('value="360"')&&!personal.includes('value="360"')&&!schedule.includes('value="360"'),'A QA/personal passcode must never be hard-coded into the product.');

assert(personal.includes('Use Personal Meeting ID')&&personal.includes('useForInstant'),'New Meeting must support the Personal Meeting ID preference.');
assert(personal.includes('Changing the passcode does not change the Personal Meeting ID.'),'Personal Room settings must state persistent-ID semantics.');
assert(schedule.includes('Generate Automatically')&&schedule.includes('Personal Meeting ID'),'Schedule must let the host choose generated identity or Personal Meeting ID.');
for(const repeat of ['Daily','Weekly','Monthly','Every weekday','Custom'])assert(schedule.includes(`>${repeat}<`),`Recurring meeting option missing ${repeat}.`);
assert(schedule.includes("mode==='personal'&&recurrence"),'Fixed recurring schedules must not silently reuse the Personal Meeting ID.');
assert(schedule.includes('meeting.startSchedule(item.scheduleId)'),'Recurring/scheduled Start must reopen the existing meeting identity rather than generate a replacement.');

assert(migration.includes("public.meet_v2_unique_room_code(10)"),'Personal Room must use a stable 10-digit identity.');
assert(migration.includes("public.meet_v2_unique_room_code(11)"),'Generated instant/scheduled meetings must use 11-digit identities.');
assert(migration.includes("meeting_kind in ('instant','personal','scheduled','recurring')"),'Backend must distinguish meeting identity kinds.');
assert(migration.includes('use_for_instant boolean not null default true'),'Personal Room instant-meeting preference must be server-backed.');
assert(migration.includes("p_passcode,'') !~ '^[0-9]{3,7}$'"),'Backend must enforce the same 3–7 digit passcode policy.');
assert(migration.includes('active_host_id uuid references auth.users(id)'),'Backend must separate live active-host authority from persistent meeting ownership.');
assert(migration.includes('last_seen_at timestamptz'),'Participant lifecycle must persist heartbeat freshness.');
assert(migration.includes('meet_v2_one_active_member_per_room_idx'),'Signed-in members must be protected from duplicate active participant rows in one room.');
assert(migration.includes('pg_advisory_xact_lock(hashtext'),'Concurrent signed-in joins must serialize before active-participant reuse.');
assert(migration.includes('meet_v2_touch_presence')&&migration.includes("state in ('admitted','joined')"),'Backend must expose a token-bound participant presence heartbeat.');
assert(migration.includes("now()-interval '75 seconds'"),'Room snapshots must prune stale participant sessions after a reconnect grace period.');
assert(migration.includes("p.state='admitted' and coalesce(p.admitted_at,p.updated_at)>now()-interval '75 seconds'"),'Admitted-but-never-joined rows must not remain as ghost roster entries indefinitely.');
assert(!/\nas \$\n/.test(migration)&&!/\nend\n\$;\n/.test(migration),'Staged meeting migration must not contain malformed single-dollar PL/pgSQL delimiters.');
assert(migration.includes("state in ('waiting_host','waiting','admitted','declined','joined','left','removed')"),'Participant lifecycle must distinguish waiting for host from Waiting Room admission.');
assert(migration.includes("when v_room.status<>'live' then 'waiting_host'"),'Participants arriving before host start must enter waiting_host instead of the admission queue.');
assert(migration.includes("where room_id=v_room.id and state='waiting_host'"),'Starting the host session must move pre-host participants into Waiting Room or admitted state.');
assert(migration.includes("if v_participant.state='waiting_host' and v_room.status='live' then"),'Join-status polling must automatically advance a pre-host participant when the host starts.');
assert(migration.includes("'waitReason',case when v_participant.state='waiting_host' then 'host'"),'Join status must explicitly tell the desktop why a participant is waiting.');
assert(migration.includes('meet_v2_transfer_host_and_leave')&&migration.includes('set active_host_id=v_target.member_id'),'Backend must atomically transfer active host authority without transferring Personal Room or schedule ownership.');
assert(migration.includes("if v_target.member_id is null then raise exception 'signed_in_participant_required_for_host'"),'Host transfer must reject guests that cannot safely inherit authenticated host authority.');
assert(migration.includes("'memberId',p.member_id")&&migration.includes("'canHost',(p.member_id is not null and p.state='joined')"),'Room snapshots must identify signed-in and host-eligible participants.');
assert(migration.includes('coalesce(v_room.active_host_id,v_room.host_id)'),'Host/co-host authority functions must honor the active host while retaining owner fallback.');

assert(reusePatch.includes("v_room.status='ended' and not v_room.reusable"),'Ended one-time rooms must remain closed while reusable rooms remain eligible for another occurrence.');
assert(reusePatch.includes("if v_room.status='ended' and v_room.reusable then"),'Reusable Personal/recurring rooms must explicitly reopen their waiting state.');
assert(reusePatch.includes("set status='waiting'"),'A reusable room must accept arrivals before the host starts its next occurrence.');
assert(reusePatch.includes("when v_room.status<>'live' then 'waiting_host'")&&reusePatch.includes("'hostStarted',(v_room.status='live')"),'Reusable meeting join patch must preserve waiting-for-host semantics.');

assert(ui.includes("newMeeting.id='newMeetingDialog'"),'New Meeting must open a real creation flow.');
assert(ui.includes('id="joinPasscode"'),'Join must request a passcode.');
assert(ui.includes("prejoin.id='prejoinOverlay'"),'New/Join flow must pass through a dedicated prejoin surface.');
assert(ui.includes("waiting.id='waitingOverlay'"),'Waiting Room surface is missing.');
assert(ui.includes("timers.waiting=setInterval(()=>void pollJoinStatus(),1000)"),'Waiting participant must poll for admission without blocking UI.');
assert(ui.includes("['waiting_host','waiting'].includes(response.state)"),'Join flow must route both pre-host and admission waits into the waiting surface instead of attempting to mark joined.');
assert(ui.includes("Waiting for the host to start this meeting")&&ui.includes("You are in the Waiting Room"),'Desktop must present distinct Zoom-style waiting-for-host and Waiting Room messages.');
assert(ui.includes("previousState=activeRoom.state")&&ui.includes("if(previousState!==state.state)renderWaitingState(state)"),'Waiting UI must transition automatically when the host starts without requiring the participant to retry.');
assert(ui.includes("timers.queue=setInterval(()=>void refreshQueue(),900)"),'Host/cohost waiting-room queue must update independently.');
assert(ui.includes('data-decision="admit"')&&ui.includes('data-decision="decline"'),'Host/cohost must have Admit and Decline controls.');
assert(ui.includes("activeRoom.role==='host'?'End':'Leave'"),'Host and participant exit semantics must differ.');
assert(!ui.includes('data-cohost=')&&!ui.includes('data-remove='),'Legacy inline participant authority buttons must not duplicate the Zoom-style More menu.');
assert(migration.includes('meet_v2_rename_participant')&&migration.includes("cohost_cannot_rename_host"),'Backend must support host/co-host rename while preventing a co-host from renaming the host.');
assert(migration.includes('meeting_locked boolean not null default false')&&migration.includes('mute_on_entry boolean not null default false'),'Meeting security state must be server-backed.');
assert(migration.includes("chat_policy text not null default 'everyone'")&&migration.includes("chat_policy in ('everyone','host_cohost','disabled')"),'Meeting chat policy must be server-backed with constrained policy values.');
assert(migration.includes('meet_v2_set_chat_policy')&&migration.includes("if coalesce(v_role,'') not in ('host','cohost')"),'Only host/co-host authority may change participant chat policy.');
assert(migration.includes("if v_room.chat_policy='disabled'")&&migration.includes("if v_room.chat_policy='host_cohost'"),'Signal backend must enforce meeting chat policy rather than trusting renderer recipient controls.');
assert(migration.includes("if v_room.meeting_locked then raise exception 'meeting_locked'"),'Locked meetings must reject new join requests in backend authority.');
assert(migration.includes('meet_v2_set_security')&&migration.includes("coalesce(v_role,'') not in ('host','cohost')"),'Only host/co-host authority may change Lock Meeting or Mute on Entry.');
assert(migration.includes("'muteOnEntry',v_room.mute_on_entry")&&ui.includes('response.muteOnEntry')&&ui.includes('state.muteOnEntry?false:Boolean(prefs.micOn)'),'Mute on Entry must travel from backend join state into the real local microphone state.');

assert(css.includes('.meeting-overlay')&&css.includes('.waiting-overlay')&&css.includes('.prejoin-overlay'),'Prejoin, meeting, and waiting-room surfaces must be dedicated desktop layers.');
assert(!ui.includes('getDisplayMedia')&&!service.includes('getDisplayMedia'),'Screen sharing must remain outside this lifecycle authority.');

console.log('DOMINIONSTAR_MEET_V2_LIFECYCLE_OK personal-id generated-id passcode-3-7 reusable-waiting recurring-identity schedule prejoin waiting admit cohost atomic-host-handoff leave end');
