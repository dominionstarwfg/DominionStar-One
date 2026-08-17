from pathlib import Path
import hashlib, json, re


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {text.count(old)}')
    return text.replace(old, new, 1)

engine_path=Path('assets/js/meeting-engine.js')
engine=engine_path.read_text()
engine=replace_once(engine,"    client: null,\n    session: null,","    client: null,\n    realtimeClient: null,\n    session: null,",'state realtime client')
anchor="""  const createPasscodeProof=async(roomId,passcode,joinToken)=>{\n    const normalized=normalizeMeetingPasscode(passcode);\n    if(!normalized)return '';\n    if(!globalThis.crypto?.subtle||typeof TextEncoder==='undefined')throw new Error('Secure meeting passcode verification is unavailable in this browser.');\n    const material=new TextEncoder().encode(`${sanitizeRoomId(roomId)}:${normalized}:${String(joinToken||'')}`);\n    const digest=await globalThis.crypto.subtle.digest('SHA-256',material);\n    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');\n  };\n"""
insert=anchor+"""
  // Meeting transport is deliberately isolated from the persistent signed-in
  // account client.  Desktop agents keep their authenticated Supabase session
  // for account/database work, while every room/control channel uses the same
  // clean public realtime context as browser guests.  This prevents auth-token
  // refresh or desktop session state from partitioning waiting-room signaling.
  const createMeetingRealtimeClient = accountClient => {
    const cfg=window.DOMINIONSTAR_SUPABASE||{};
    if(!window.supabase?.createClient||!cfg.url||!cfg.anonKey)return accountClient;
    try{
      return window.supabase.createClient(cfg.url,cfg.anonKey,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });
    }catch(_){return accountClient;}
  };
  const meetingRealtimeClient = () => state.realtimeClient || state.client;
"""
engine=replace_once(engine,anchor,insert,'realtime helper')
engine=engine.replace("if (!state.client || !token) return null;\n    const name=`dominionstar-meet-control-", "if (!meetingRealtimeClient() || !token) return null;\n    const name=`dominionstar-meet-control-",1)
engine=engine.replace("const channel=state.client.channel(name,{config:{broadcast:{self:false,ack:true}}});", "const channel=meetingRealtimeClient().channel(name,{config:{broadcast:{self:false,ack:true}}});",1)
engine=engine.replace("if(!state.client||!token)return false;\n    const name=`dominionstar-meet-control-", "if(!meetingRealtimeClient()||!token)return false;\n    const name=`dominionstar-meet-control-",1)
engine=engine.replace("const channel=state.client.channel(name,{config:{broadcast:{self:false,ack:true}}});", "const channel=meetingRealtimeClient().channel(name,{config:{broadcast:{self:false,ack:true}}});",1)
engine=engine.replace("setTimeout(()=>state.client?.removeChannel?.(channel),800);", "setTimeout(()=>meetingRealtimeClient()?.removeChannel?.(channel),800);",1)
engine=replace_once(engine,"    state.client = client;\n    state.session = session;","    state.client = client;\n    state.realtimeClient = createMeetingRealtimeClient(client);\n    state.session = session;",'init realtime client')
engine=replace_once(engine,"    state.channel = client.channel(`dominionstar-meet-${state.roomId}`, {config:{broadcast:{self:false,ack:true},presence:{key:state.participantId}}});","    state.channel = meetingRealtimeClient().channel(`dominionstar-meet-${state.roomId}`, {config:{broadcast:{self:false,ack:true},presence:{key:state.participantId}}});",'room transport')
engine=replace_once(engine,"    if (state.channel) await within(state.client.removeChannel(state.channel),900);\n    state.channel = null;","    if (state.channel) await within(meetingRealtimeClient().removeChannel(state.channel),900);\n    state.channel = null;",'room cleanup')
engine_path.write_text(engine)

# Cache-bust the hosted engine and update the permanent assertion that protects it.
html_path=Path('meet/index.html')
html=html_path.read_text()
m=re.search(r'meeting-engine\.js\?v=([^\"\']+)',html)
if not m: raise SystemExit('meeting engine cache key not found')
old=m.group(1); new='96-rc13-4-desktop-realtime-isolation'
html=html.replace(f'meeting-engine.js?v={old}',f'meeting-engine.js?v={new}',1)
html_path.write_text(html)

prod_path=Path('scripts/test-production-meet-rc13.mjs')
prod=prod_path.read_text()
if f'meeting-engine.js?v={old}' in prod:
    prod=prod.replace(f'meeting-engine.js?v={old}',f'meeting-engine.js?v={new}')
prod_path.write_text(prod)

# Dedicated regression: account auth and room realtime must never share ownership again.
test=Path('scripts/test-meet-realtime-transport-isolation.mjs')
test.write_text("""import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nconst source=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');\nconst html=fs.readFileSync(new URL('../meet/index.html',import.meta.url),'utf8');\nassert(source.includes('realtimeClient: null'),'Meeting engine has no isolated realtime client state.');\nassert(source.includes('const createMeetingRealtimeClient = accountClient =>'),'Meeting engine has no realtime isolation factory.');\nassert(source.includes('persistSession:false,autoRefreshToken:false,detectSessionInUrl:false'),'Meeting transport can inherit persistent account auth.');\nassert(source.includes('state.realtimeClient = createMeetingRealtimeClient(client);'),'Meeting init does not isolate realtime from DSAuth.');\nassert(source.includes('state.channel = meetingRealtimeClient().channel(`dominionstar-meet-${state.roomId}`'),'Primary room channel still uses account client directly.');\nassert(source.includes('const channel=meetingRealtimeClient().channel(name'),'Direct moderation channel still uses account client directly.');\nassert(!source.includes('state.channel = client.channel(`dominionstar-meet-${state.roomId}`'),'Authenticated account client still owns primary room transport.');\nassert(html.includes('meeting-engine.js?v=96-rc13-4-desktop-realtime-isolation'),'Hosted Meet did not cache-bust isolated realtime engine.');\nconsole.log('MEET_REALTIME_TRANSPORT_ISOLATION_OK');\n""")

# Run the regression permanently in Meet Runtime verification.
wf_path=Path('.github/workflows/meet-runtime-verify.yml')
wf=wf_path.read_text()
needle="""      - name: Waiting room authority and lifecycle\n        run: node scripts/test-waiting-room-surgical.mjs\n\n"""
addition=needle+"""      - name: Desktop/browser realtime transport isolation\n        run: node scripts/test-meet-realtime-transport-isolation.mjs\n\n"""
wf=replace_once(wf,needle,addition,'runtime workflow step')
wf_path.write_text(wf)

# Pin changed protected hashes without changing the certified release ID.
contract_path=Path('meet/release-contract.json')
contract=json.loads(contract_path.read_text())
for rel in ['assets/js/meeting-engine.js','meet/index.html']:
    contract['files'][rel]=hashlib.sha256(Path(rel).read_bytes()).hexdigest()
contract_path.write_text(json.dumps(contract,indent=2)+"\n")

# Release contract itself is intentionally not self-hashed.
print('AUTHORED_DESKTOP_REALTIME_ISOLATION')
