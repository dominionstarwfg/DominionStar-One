from pathlib import Path
import hashlib, json, textwrap


def replace_once(path, old, new):
    p=Path(path)
    text=p.read_text()
    if old not in text:
        raise SystemExit(f'marker missing in {path}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

# 1) Resolver: database/schema outage becomes an explicit live-verification
# handoff, never an opaque 500 and never a passcode bypass.
resolver=Path('netlify/functions/resolve-meeting-join.mjs')
text=resolver.read_text()
text=text.replace(
"  if(!SUPABASE_URL||!SUPABASE_KEY)return reply(503,{error:'Meeting lookup is temporarily unavailable.'});",
"  if(!SUPABASE_URL||!SUPABASE_KEY)return reply(503,{found:null,live_verification:true,error:'Live meeting verification required.'});",
1)
text=text.replace(
"  if(live.error||scheduled.error||personal.error)return reply(500,{error:'Meeting lookup failed.'});\n  const canonical=scheduled.data||personal.data;\n  if(!live.data&&!canonical)return reply(404,{found:false,error:'Meeting not found.'});",
"  if(live.error||scheduled.error||personal.error)return reply(503,{found:null,live_verification:true,error:'Live meeting verification required.'});\n  const canonical=scheduled.data||personal.data;\n  if(!live.data&&!canonical)return reply(404,{found:false,live_verification:true,error:'Waiting for live host verification.'});",
1)
resolver.write_text(text)

# 2) Engine: bind a SHA-256 proof to room + passcode + one-time join token.
engine=Path('assets/js/meeting-engine.js')
text=engine.read_text()
text=text.replace(
"    joinToken: '',\n    isHost: false,",
"    joinToken: '',\n    roomPasscode: '',\n    joinPasscodeProof: '',\n    isHost: false,",
1)
text=text.replace(
"  const createRoomId = () => String(Math.floor(100000 + Math.random() * 900000));\n",
"  const createRoomId = () => String(Math.floor(100000 + Math.random() * 900000));\n  const normalizeMeetingPasscode=value=>String(value||'').replace(/\\D/g,'').slice(0,10);\n  const createPasscodeProof=async(roomId,passcode,joinToken)=>{\n    const normalized=normalizeMeetingPasscode(passcode);\n    if(!normalized)return '';\n    if(!globalThis.crypto?.subtle||typeof TextEncoder==='undefined')throw new Error('Secure meeting passcode verification is unavailable in this browser.');\n    const material=new TextEncoder().encode(`${sanitizeRoomId(roomId)}:${normalized}:${String(joinToken||'')}`);\n    const digest=await globalThis.crypto.subtle.digest('SHA-256',material);\n    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');\n  };\n",
1)
text=text.replace(
"      state.joinToken=randomId('join');\n      await send('meet-join-request',{joinToken:state.joinToken}).catch(()=>{});",
"      state.joinToken=randomId('join');\n      state.joinPasscodeProof=await createPasscodeProof(state.roomId,state.roomPasscode,state.joinToken);\n      await send('meet-join-request',{joinToken:state.joinToken,passcodeProof:state.joinPasscodeProof}).catch(()=>{});",
1)
text=text.replace(
"      await send('meet-join-request',{joinToken:state.joinToken,retry:true}).catch(()=>{});",
"      await send('meet-join-request',{joinToken:state.joinToken,passcodeProof:state.joinPasscodeProof,retry:true}).catch(()=>{});",
1)
old_join="""    if (event === 'meet-join-request') {
      if (['host','cohost'].includes(state.role)){
        const firstRequest=!state.waitingRequestsSeen.has(payload.from);
        state.waitingRequestsSeen.add(payload.from);
        if(firstRequest)emit('join-request', payload);
      }
      return;
    }
"""
new_join="""    if (event === 'meet-join-request') {
      if (['host','cohost'].includes(state.role)){
        const expectedProof=await createPasscodeProof(state.roomId,state.roomPasscode,payload.joinToken||'');
        if(expectedProof && payload.passcodeProof!==expectedProof){
          await send('meet-denied',{to:payload.from,joinToken:payload.joinToken||'',reason:'incorrect-passcode'}).catch(()=>{});
          emit('join-rejected',{...payload,reason:'incorrect-passcode'});
          return;
        }
        const firstRequest=!state.waitingRequestsSeen.has(payload.from);
        state.waitingRequestsSeen.add(payload.from);
        if(firstRequest)emit('join-request', payload);
      }
      return;
    }
"""
if old_join not in text: raise SystemExit('join request handler marker missing')
text=text.replace(old_join,new_join,1)
text=text.replace(
"  const init = async ({roomId, displayName, isHost=false, hostUserId='', contractLevel='TA', avatarUrl='', waitingRoomEnabled=false}={}) => {",
"  const init = async ({roomId, displayName, isHost=false, hostUserId='', contractLevel='TA', avatarUrl='', waitingRoomEnabled=false, passcode=''}={}) => {",
1)
text=text.replace(
"    state.joinToken=randomId('join');\n    state.admitted = state.isHost;",
"    state.joinToken=randomId('join');\n    state.roomPasscode=normalizeMeetingPasscode(passcode);\n    state.joinPasscodeProof=await createPasscodeProof(state.roomId,state.roomPasscode,state.joinToken);\n    state.admitted = state.isHost;",
1)
text=text.replace(
"              if (!state.isHost) await send('meet-join-request',{joinToken:state.joinToken});",
"              if (!state.isHost) await send('meet-join-request',{joinToken:state.joinToken,passcodeProof:state.joinPasscodeProof});",
1)
engine.write_text(text)

# 3) UI: use live realtime verification only when resolver explicitly says it is
# required. Database-found meetings keep their existing pre-validation path.
ui=Path('assets/js/meet-next/executive6.js')
text=ui.read_text()
old="""          if(resolved.ok&&record?.found){
            roomRecord={room_id:normalizedRoom,owner_id:record.owner_id,waiting_room_enabled:Boolean(record.waiting_room_enabled),active:Boolean(record.active),passcodeRequired:Boolean(record.passcode_required),passcodeValid:Boolean(record.passcode_valid)};
            lookupCompleted=true;
          }
          if(!resolved.ok)throw new Error(record?.error||record?.message||'Meeting ID could not be verified. Check the number and try again.');
        } catch(error) { throw error; }
"""
new="""          if(resolved.ok&&record?.found){
            roomRecord={room_id:normalizedRoom,owner_id:record.owner_id,waiting_room_enabled:Boolean(record.waiting_room_enabled),active:Boolean(record.active),passcodeRequired:Boolean(record.passcode_required),passcodeValid:Boolean(record.passcode_valid)};
            lookupCompleted=true;
          } else if(record?.live_verification===true && (resolved.status===404||resolved.status===503)) {
            roomRecord={room_id:normalizedRoom,owner_id:'',waiting_room_enabled:Boolean(state.waitingRoomEnabled),active:true,liveVerification:true};
            lookupCompleted=true;
          } else if(!resolved.ok) {
            throw new Error(record?.error||record?.message||'Meeting ID could not be verified. Check the number and try again.');
          }
        } catch(error) { throw error; }
"""
if old not in text: raise SystemExit('resolve authority marker missing')
text=text.replace(old,new,1)
text=text.replace(
"engine.init({roomId:room,displayName:name,isHost:state.isHost,hostUserId:authority.roomRecord?.owner_id||'',role:state.role,session,contractLevel:state.profile?.contractLevel||'',avatarUrl:state.profile?.avatarUrl||'',waitingRoomEnabled:state.waitingRoomEnabled})",
"engine.init({roomId:room,displayName:name,isHost:state.isHost,hostUserId:authority.roomRecord?.owner_id||'',role:state.role,session,contractLevel:state.profile?.contractLevel||'',avatarUrl:state.profile?.avatarUrl||'',waitingRoomEnabled:state.waitingRoomEnabled,passcode:state.passcode})",
1)
# Give live-discovery users truthful status while host-side proof is pending.
text=text.replace(
"      setJoinStatus('Meeting verified. Connecting securely…','success');",
"      setJoinStatus(authority.roomRecord?.liveVerification?'Connecting for live host verification…':'Meeting verified. Connecting securely…','success');",
1)
# Handle host-side passcode rejection by cleanly returning to prejoin.
marker="""  engine.on('join-request',payload=>{
"""
handler="""  engine.on('denied',async payload=>{
    const incorrect=payload?.reason==='incorrect-passcode';
    try{await engine.leave();}catch(_){}
    stopMeetingTimer();
    ids.meeting.hidden=true;
    ids.prejoin.hidden=false;
    document.body.classList.remove('meeting-active');
    document.body.classList.add('prejoin-active');
    state.phase='prejoin';
    const message=incorrect?'Incorrect meeting passcode.':'The host declined this join request.';
    setJoinStatus(message,'error');
    toast(message,{type:'error',force:true});
    if(incorrect)ids.meetingPasscode?.focus();
  });

"""
if marker not in text: raise SystemExit('engine join-request UI marker missing')
text=text.replace(marker,handler+marker,1)
ui.write_text(text)

# 4) Cache-bust the two changed hosted controllers.
replace_once('meet/index.html','meeting-engine.js?v=94-rc13-3-camera-privacy','meeting-engine.js?v=95-rc13-4-live-passcode-proof')
replace_once('meet/index.html','executive6.js?v=81-rc13-3-single-preview-owner','executive6.js?v=82-rc13-4-live-room-lookup')

# 5) Dedicated regression: live fallback is explicit and passcode remains
# host-validated without broadcasting plaintext credentials.
Path('scripts/test-live-meet-lookup-proof.mjs').write_text(textwrap.dedent(r'''
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const engine=fs.readFileSync('assets/js/meeting-engine.js','utf8');
const ui=fs.readFileSync('assets/js/meet-next/executive6.js','utf8');
const resolver=fs.readFileSync('netlify/functions/resolve-meeting-join.mjs','utf8');
const html=fs.readFileSync('meet/index.html','utf8');
const contract=JSON.parse(fs.readFileSync('meet/release-contract.json','utf8'));

assert.match(resolver,/live_verification:true/,'Resolver must explicitly hand unavailable DB lookup to live verification');
assert.match(resolver,/reply\(503,\{found:null,live_verification:true/,'Resolver DB failure must not remain an opaque HTTP 500');
assert.match(ui,/record\?\.live_verification===true/,'Guest UI must recognize only explicit live-verification fallback');
assert.match(ui,/liveVerification:true/,'Guest authority must mark live verification');
assert.match(ui,/passcode:state\.passcode/,'UI must give the engine the locally supplied passcode for host-side proof');
assert.match(engine,/crypto\.subtle\.digest\('SHA-256'/,'Meeting passcode proof must use SHA-256');
assert.match(engine,/sanitizeRoomId\(roomId\).*normalized.*joinToken/s,'Passcode proof must bind room, passcode and one-time join token');
assert.match(engine,/passcodeProof:state\.joinPasscodeProof/,'Waiting guest must send passcode proof with join request');
assert.match(engine,/payload\.passcodeProof!==expectedProof/,'Host must reject a mismatched proof');
assert.match(engine,/reason:'incorrect-passcode'/,'Incorrect passcode must produce a targeted denial');
assert.ok(!/send\('meet-join-request',\{[^}]*passcode:/.test(engine),'Plaintext passcode must never be broadcast in join request');
assert.match(html,/meeting-engine\.js\?v=95-rc13-4-live-passcode-proof/,'Engine cache-bust missing');
assert.match(html,/executive6\.js\?v=82-rc13-4-live-room-lookup/,'UI cache-bust missing');
for(const path of ['assets/js/meeting-engine.js','assets/js/meet-next/executive6.js','meet/index.html','netlify/functions/resolve-meeting-join.mjs']){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  assert.equal(contract.files[path],actual,`Release contract mismatch for ${path}`);
}
console.log('LIVE_MEETING_LOOKUP_REALTIME_PASSCODE_PROOF_OK');
''').lstrip())

# 6) Keep existing production regression aligned with cache identity.
prod=Path('scripts/test-production-meet-rc13.mjs')
p=prod.read_text()
p=p.replace('meeting-engine.js?v=94-rc13-3-camera-privacy','meeting-engine.js?v=95-rc13-4-live-passcode-proof')
p=p.replace('executive6.js?v=81-rc13-3-single-preview-owner','executive6.js?v=82-rc13-4-live-room-lookup')
prod.write_text(p)

# 7) Pin exact bytes in release contract without changing certified release ID.
contract_path=Path('meet/release-contract.json')
contract=json.loads(contract_path.read_text())
for path in ['assets/js/meeting-engine.js','assets/js/meet-next/executive6.js','meet/index.html','netlify/functions/resolve-meeting-join.mjs']:
    contract['files'][path]=hashlib.sha256(Path(path).read_bytes()).hexdigest()
contract_path.write_text(json.dumps(contract,indent=2)+'\n')
