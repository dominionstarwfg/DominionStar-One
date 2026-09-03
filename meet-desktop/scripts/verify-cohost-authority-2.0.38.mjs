import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const controls=read('ui/participant-controls.js');
const app=read('ui/app.js');
const service=read('src/meeting-service.mjs');
const sql=read('sql/20260828_zoom_meeting_identity.sql');

assert.equal(pkg.version,'2.0.38','Co-host authority candidate must report 2.0.38.');

assert.ok(controls.includes("const canManage=()=>['host','cohost'].includes(localRole())"),'Host/co-host participant management authority must remain available.');
for(const action of ["add('Mute'","add('Ask to Unmute'","add('Stop Video'","add('Ask to Start Video'","add('Rename'"]){
  assert.ok(controls.includes(action),`Co-host participant action must remain present: ${action}`);
}
assert.ok(controls.includes("if(localRole()==='host'&&role!=='cohost')add('Make Co-host'"),'Only host may appoint a co-host in the renderer.');
assert.ok(controls.includes("if(localRole()==='host'&&role==='cohost')add('Remove Co-host'"),'Only host may revoke co-host in the renderer.');
assert.ok(controls.includes("if(localRole()==='host'||role!=='cohost')add('Remove'"),'Co-host must not be offered Remove against another co-host.');

assert.ok(app.includes("if(['host','cohost'].includes(activeRoom.role)){void refreshQueue()"),'Co-host must retain waiting-room queue authority.');
assert.ok(app.includes('data-decision="admit"')&&app.includes('data-decision="decline"'),'Co-host waiting-room Admit/Decline controls must remain present.');

assert.ok(sql.includes("if coalesce(v_room.active_host_id,v_room.host_id) <> v_actor then raise exception 'host_authority_required'; end if;"),'Make/Remove Co-host backend must remain active-host-only.');
assert.ok(sql.includes("if v_actor_role='cohost' and v_target.role='cohost' then raise exception 'cohost_cannot_remove_cohost'; end if;"),'Backend must block a co-host from removing another co-host.');
assert.ok(sql.includes("if v_target.role='host' then raise exception 'host_cannot_be_removed'; end if;"),'No participant manager may remove the host.');
assert.ok(sql.includes("if coalesce(v_room.active_host_id,v_room.host_id)<>v_actor then raise exception 'host_authority_required'; end if;"),'Host transfer must remain active-host-only.');
assert.ok(sql.includes("where id=p_room_id and coalesce(active_host_id,host_id)=v_user"),'End Meeting must remain active-host-only.');

assert.ok(service.includes("const setCohost=(participantId,enabled)=>auth.rpc('meet_v2_set_cohost'"),'Co-host role mutation must remain backend-owned.');
assert.ok(service.includes("const transferHostAndLeave=async participantId=>{const result=await auth.rpc('meet_v2_transfer_host_and_leave'"),'Host transfer must remain backend-owned.');
assert.ok(service.includes("const endRoom=async roomId=>{const result=await auth.rpc('meet_v2_end_room'"),'End Meeting must remain backend-owned.');

console.log('DOMINIONSTAR_COHOST_AUTHORITY_2_0_38_OK waiting-room participant-controls host-only-cohost-mutation host-only-transfer-end cohost-cannot-remove-cohost');
