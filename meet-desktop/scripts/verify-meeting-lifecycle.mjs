import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const auth=read('src/auth-service.mjs');
const service=read('src/meeting-service.mjs');
const ui=read('ui/app.js');
const css=read('ui/meeting.css');

for(const rpc of ['meet_v2_create_room','meet_v2_request_join','meet_v2_join_status','meet_v2_mark_joined','meet_v2_leave_room','meet_v2_host_queue','meet_v2_decide_participant','meet_v2_room_snapshot','meet_v2_end_room'])assert(service.includes(rpc),`Missing meeting RPC ${rpc}`);
assert(auth.includes('async function rpc(name,args={})'),'Supabase RPC transport must remain in the Electron main process.');
assert(!ui.includes('createClient(')&&!ui.includes('.from('),'Renderer must not own Supabase/database access.');
for(const channel of ['meeting:create','meeting:request-join','meeting:join-status','meeting:mark-joined','meeting:leave','meeting:host-queue','meeting:decide','meeting:snapshot','meeting:end'])assert(main.includes(channel),`Missing IPC owner ${channel}`);
for(const method of ['create:','requestJoin:','joinStatus:','markJoined:','leave:','hostQueue:','decide:','snapshot:','end:'])assert(preload.includes(method),`Missing renderer bridge method ${method}`);
assert(ui.includes("newDialog.id='newMeetingDialog'"),'New Meeting must open a real creation flow.');
assert(ui.includes("id=\"joinPasscode\""),'Join must request a passcode.');
assert(ui.includes("id='waitingOverlay'"),'Waiting Room surface is missing.');
assert(ui.includes("setInterval(()=>void pollJoinStatus(),1200)"),'Waiting participant must poll for admission without blocking UI.');
assert(ui.includes("setInterval(()=>void refreshQueue(),1100)"),'Host waiting-room queue must update independently.');
assert(ui.includes("data-decision=\"admit\"")&&ui.includes("data-decision=\"decline\""),'Host must have Admit and Decline controls.');
assert(ui.includes("activeRoom.role==='host'?'End':'Leave'"),'Host and participant exit semantics must differ.');
assert(css.includes('.meeting-overlay')&&css.includes('.waiting-overlay'),'Meeting and waiting-room surfaces must be dedicated desktop layers.');
assert(!ui.includes('getDisplayMedia')&&!service.includes('getDisplayMedia'),'Screen sharing must remain outside this lifecycle foundation.');
console.log('DOMINIONSTAR_MEET_V2_LIFECYCLE_OK create join waiting admit decline roster leave end isolated-no-share');
