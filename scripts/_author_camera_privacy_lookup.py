from pathlib import Path
import hashlib, json


def must_replace(path, old, new, label):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'{label} marker missing in {path}')
    p.write_text(text.replace(old,new,1))

# Meeting engine: Video Off is a physical privacy boundary. Release every
# camera track that may exist, then reacquire with stable HD/30 constraints.
engine=Path('assets/js/meeting-engine.js')
text=engine.read_text()
old="""  const releaseCameraTrack = track => {\n    const base=state.localStream;\n    if(track&&base?.getVideoTracks?.().includes(track)){\n      try{base.removeTrack(track);}catch(_){}\n    }\n    if(track?.readyState!=='ended'){\n      try{track.stop();}catch(_){}\n    }\n    if(track)state.lastCameraReleaseAt=Date.now();\n    // Keep the negotiated camera sender but remove its media. This releases the\n    // physical camera immediately without destroying the peer connection or\n    // disturbing the independent presentation sender.\n    Promise.allSettled([...state.peers.values()].map(peer=>syncPeerTracks(peer))).catch(()=>{});\n  };\n"""
new="""  const releaseCameraTrack = track => {\n    const base=state.localStream;\n    const cameraTracks=[...(base?.getVideoTracks?.()||[])];\n    if(track && !cameraTracks.includes(track))cameraTracks.push(track);\n    let released=false;\n    cameraTracks.forEach(item=>{\n      if(base?.getVideoTracks?.().includes(item)){try{base.removeTrack(item);}catch(_){}}\n      if(item?.readyState!=='ended'){try{item.stop();released=true;}catch(_){}}\n    });\n    if(released||cameraTracks.length)state.lastCameraReleaseAt=Date.now();\n    // Keep the negotiated camera sender but remove its media. Video Off is a\n    // physical privacy boundary: no hidden/duplicate camera track may survive.\n    Promise.allSettled([...state.peers.values()].map(peer=>syncPeerTracks(peer))).catch(()=>{});\n  };\n"""
if old not in text: raise SystemExit('releaseCameraTrack marker missing')
text=text.replace(old,new,1)
old_gum="navigator.mediaDevices.getUserMedia({video:true,audio:false})"
if old_gum not in text: raise SystemExit('camera reacquire getUserMedia marker missing')
text=text.replace(old_gum,"navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:false})",1)
engine.write_text(text)

# Executive prejoin: whichever layer acquires first publishes one shared promise;
# the other adopts the same stream instead of opening the camera twice.
executive=Path('assets/js/meet-next/executive6.js')
text=executive.read_text()
old="""  async function ensurePreview() {\n    try {\n      const stream = (!state.video&&!state.audio)\n        ? new MediaStream()\n        : await acquireUserMediaStable({video:state.video?{width:{ideal:1280},height:{ideal:720}}:false,audio:state.audio});\n      setStream(stream);\n      await loadDevices();\n    } catch (error) {\n      toast(error.message || 'Camera and microphone unavailable');\n    }\n  }\n"""
new="""  async function ensurePreview() {\n    try {\n      const existing=ids.prejoinVideo?.srcObject;\n      if(existing?.getTracks?.().some(track=>track.readyState==='live')){setStream(existing);await loadDevices();return existing;}\n      if(window.__DS_PREJOIN_MEDIA_PROMISE){\n        const shared=await window.__DS_PREJOIN_MEDIA_PROMISE.catch(()=>null);\n        if(shared){setStream(shared);await loadDevices();return shared;}\n      }\n      const acquisition=(!state.video&&!state.audio)\n        ? Promise.resolve(new MediaStream())\n        : acquireUserMediaStable({video:state.video?{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}:false,audio:state.audio});\n      window.__DS_PREJOIN_MEDIA_PROMISE=acquisition;\n      try{\n        const stream=await acquisition;\n        setStream(stream);\n        await loadDevices();\n        return stream;\n      }finally{if(window.__DS_PREJOIN_MEDIA_PROMISE===acquisition)window.__DS_PREJOIN_MEDIA_PROMISE=null;}\n    } catch (error) {\n      toast(error.message || 'Camera and microphone unavailable');\n      return null;\n    }\n  }\n"""
if old not in text: raise SystemExit('ensurePreview marker missing')
text=text.replace(old,new,1)
old="""  async function loadDevices() {\n    const devices = await navigator.mediaDevices.enumerateDevices();\n    const fill = (select, kind) => {\n      const current = select.value;\n      select.innerHTML = '';\n      devices.filter(d => d.kind === kind).forEach((device,index) => {\n        const option = document.createElement('option');\n        option.value = device.deviceId;\n        option.textContent = device.label || `${kind} ${index + 1}`;\n        select.append(option);\n      });\n      if (current) select.value = current;\n    };\n    fill(ids.cameraSelect,'videoinput');\n    fill(ids.microphoneSelect,'audioinput');\n    fill(ids.speakerSelect,'audiooutput');\n  }\n"""
new="""  async function loadDevices() {\n    const devices = await navigator.mediaDevices.enumerateDevices();\n    const preferred={\n      videoinput:localStorage.getItem('ds_meet_camera_id')||state.preferences.cameraId||'',\n      audioinput:localStorage.getItem('ds_meet_microphone_id')||state.preferences.microphoneId||'',\n      audiooutput:localStorage.getItem('ds_meet_speaker_id')||state.preferences.speakerId||''\n    };\n    const fallback={videoinput:'Camera',audioinput:'Microphone',audiooutput:'Speaker'};\n    const fill = (select, kind) => {\n      if(!select)return;\n      const current=select.value||preferred[kind]||'';\n      const matching=devices.filter(d=>d.kind===kind);\n      select.innerHTML='';\n      matching.forEach((device,index)=>{\n        const option=document.createElement('option');\n        option.value=device.deviceId;\n        option.textContent=String(device.label||'').trim()||`${fallback[kind]} ${index+1}`;\n        select.append(option);\n      });\n      if(current&&matching.some(device=>device.deviceId===current))select.value=current;\n    };\n    fill(ids.cameraSelect,'videoinput');\n    fill(ids.microphoneSelect,'audioinput');\n    fill(ids.speakerSelect,'audiooutput');\n  }\n  navigator.mediaDevices?.addEventListener?.('devicechange',()=>loadDevices().catch(()=>{}));\n"""
if old not in text: raise SystemExit('loadDevices marker missing')
text=text.replace(old,new,1)
old="""    await engine.startMedia({existingStream:merged,video:state.video,audio:state.audio});\n    old.getTracks().filter(t=>t.kind===kind).forEach(t=>t.stop());\n  }\n"""
new="""    await engine.startMedia({existingStream:merged,video:state.video,audio:state.audio});\n    old.getTracks().filter(t=>t.kind===kind).forEach(t=>t.stop());\n    await loadDevices().catch(()=>{});\n  }\n"""
if old not in text: raise SystemExit('replaceMedia marker missing')
text=text.replace(old,new,1)
executive.write_text(text)

# RC13 prejoin layer: participate in the same shared acquisition and remove the
# competing in-meeting Start Video restart routine entirely.
hotfix=Path('assets/js/meet/hotfix-rc13-1-media-prejoin.js')
text=hotfix.read_text()
old="""    if (preview.srcObject?.getVideoTracks?.().some(track => track.readyState === 'live')) return;\n    stopHotfixPreview({all:true});\n    const cameraOff = Boolean($('alwaysJoinCameraOff')?.checked);\n    const muted = Boolean($('alwaysJoinMuted')?.checked);\n    try {\n      const stream = await navigator.mediaDevices.getUserMedia({\n        video: cameraOff ? false : {width:{ideal:1280},height:{ideal:720}},\n        audio: muted ? false : {echoCancellation:true,noiseSuppression:true,autoGainControl:true}\n      });\n      hotfixPreviewStream = stream;\n      hotfixPreviewOwned = true;\n"""
new="""    if (preview.srcObject?.getTracks?.().some(track => track.readyState === 'live')) {\n      hotfixPreviewStream=preview.srcObject;hotfixPreviewOwned=false;\n      setPreviewVisualState({videoOn:preview.srcObject.getVideoTracks?.().some(t=>t.readyState==='live'),audioOn:preview.srcObject.getAudioTracks?.().some(t=>t.readyState==='live'&&t.enabled)});\n      return preview.srcObject;\n    }\n    stopHotfixPreview({all:true});\n    const cameraOff = Boolean($('alwaysJoinCameraOff')?.checked);\n    const muted = Boolean($('alwaysJoinMuted')?.checked);\n    try {\n      if(window.__DS_PREJOIN_MEDIA_PROMISE){\n        const shared=await window.__DS_PREJOIN_MEDIA_PROMISE.catch(()=>null);\n        if(shared){hotfixPreviewStream=shared;hotfixPreviewOwned=false;preview.srcObject=shared;setPreviewVisualState({videoOn:shared.getVideoTracks?.().some(t=>t.readyState==='live'),audioOn:shared.getAudioTracks?.().some(t=>t.readyState==='live'&&t.enabled)});return shared;}\n      }\n      const acquisition=navigator.mediaDevices.getUserMedia({\n        video: cameraOff ? false : {width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},\n        audio: muted ? false : {echoCancellation:true,noiseSuppression:true,autoGainControl:true}\n      });\n      window.__DS_PREJOIN_MEDIA_PROMISE=acquisition;\n      const stream = await acquisition.finally(()=>{if(window.__DS_PREJOIN_MEDIA_PROMISE===acquisition)window.__DS_PREJOIN_MEDIA_PROMISE=null;});\n      hotfixPreviewStream = stream;\n      hotfixPreviewOwned = true;\n"""
if old not in text: raise SystemExit('hotfix preview marker missing')
text=text.replace(old,new,1)
start=text.find("  $('camBtn')?.addEventListener('click', async event => {")
end=text.find("\n\n  patchLocalDevicePreferenceBoundary()",start)
if start<0 or end<0: raise SystemExit('hotfix camBtn ownership block missing')
text=text[:start]+"  // In-meeting camera lifecycle is owned exclusively by DominionStarMeetingEngine.\n"+text[end:]
text=text.replace("window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'rc13.2-native-permissions-personal-room'","window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'rc13.3-camera-privacy-single-owner'",1)
hotfix.write_text(text)

# Meeting lookup: private server key wins; otherwise use the deployed public
# Supabase configuration under RLS instead of a configuration dead-end.
resolver=Path('netlify/functions/resolve-meeting-join.mjs')
text=resolver.read_text()
old="""  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;\n  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return reply(500,{error:'Meeting lookup is not configured.'});\n"""
new="""  const SUPABASE_URL=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||process.env.PUBLIC_SUPABASE_URL||'https://ckmurvhjumzlhsegncba.supabase.co';\n  const SUPABASE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY||'sb_publishable_zAzk_tobvWHOWR22bmzMMw_uqHnCVxb';\n  if(!SUPABASE_URL||!SUPABASE_KEY)return reply(503,{error:'Meeting lookup is temporarily unavailable.'});\n"""
if old not in text: raise SystemExit('resolver env marker missing')
text=text.replace(old,new,1)
if 'createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY' not in text: raise SystemExit('resolver client marker missing')
text=text.replace('createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY','createClient(SUPABASE_URL,SUPABASE_KEY',1)
resolver.write_text(text)

# Cache-bust hosted bytes while keeping the RC13.1 release ID/bridge stable so
# the already-certified desktop v1.2.2 remains compatible.
meet=Path('meet/index.html'); html=meet.read_text()
for old,new in [
 ('meeting-engine.js?v=93-rc13-1-camera-handoff','meeting-engine.js?v=94-rc13-3-camera-privacy'),
 ('executive6.js?v=80-rc13-1-prejoin-handoff','executive6.js?v=81-rc13-3-single-preview-owner'),
 ('hotfix-rc13-1-media-prejoin.js?v=3-native-permission-personal','hotfix-rc13-1-media-prejoin.js?v=4-camera-privacy-reacquire')]:
    if old not in html: raise SystemExit(f'meet cache marker missing: {old}')
    html=html.replace(old,new,1)
meet.write_text(html)

# Existing test identities/cache assertions follow the new hosted bytes.
for path in ['scripts/test-production-meet-rc13.mjs','scripts/test-desktop-prejoin-bootstrap.mjs','scripts/test-personal-room-native-prejoin.mjs']:
    p=Path(path); t=p.read_text()
    t=t.replace("window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'rc13.2-native-permissions-personal-room'","window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'rc13.3-camera-privacy-single-owner'")
    t=t.replace('meeting-engine.js?v=93-rc13-1-camera-handoff','meeting-engine.js?v=94-rc13-3-camera-privacy')
    t=t.replace('executive6.js?v=80-rc13-1-prejoin-handoff','executive6.js?v=81-rc13-3-single-preview-owner')
    t=t.replace('hotfix-rc13-1-media-prejoin.js?v=3-native-permission-personal','hotfix-rc13-1-media-prejoin.js?v=4-camera-privacy-reacquire')
    p.write_text(t)

Path('scripts/test-camera-privacy-lookup-hardening.mjs').write_text(r'''import fs from 'node:fs';
import assert from 'node:assert/strict';
const engine=fs.readFileSync('assets/js/meeting-engine.js','utf8');
const executive=fs.readFileSync('assets/js/meet-next/executive6.js','utf8');
const hotfix=fs.readFileSync('assets/js/meet/hotfix-rc13-1-media-prejoin.js','utf8');
const resolver=fs.readFileSync('netlify/functions/resolve-meeting-join.mjs','utf8');
const html=fs.readFileSync('meet/index.html','utf8');
assert(engine.includes("const cameraTracks=[...(base?.getVideoTracks?.()||[])]"),'Video Off must enumerate every local camera track.');
assert(engine.includes('item.stop();released=true'),'Video Off must physically stop every live camera track.');
assert(engine.includes('width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}'),'Camera reacquisition must preserve HD/30 constraints.');
assert(executive.includes('window.__DS_PREJOIN_MEDIA_PROMISE'),'Executive prejoin must participate in one shared camera acquisition.');
assert(hotfix.includes('window.__DS_PREJOIN_MEDIA_PROMISE'),'RC13 prejoin must participate in one shared camera acquisition.');
assert(!hotfix.includes("const localSurfaces = [$('prejoinVideo'), $('selfVideo')]"),'Hotfix must not stop meeting-owned video surfaces before reacquisition.');
assert(!hotfix.includes('Camera could not start after releasing the previous preview stream.'),'Obsolete double-release error path must be removed.');
assert(executive.includes("navigator.mediaDevices?.addEventListener?.('devicechange'"),'Device lists must refresh when cameras/mics change.');
assert(executive.includes("String(device.label||'').trim()"),'Device menus must preserve browser-provided hardware labels.');
assert(resolver.includes('process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY'),'Lookup must prefer private server credentials.');
assert(resolver.includes("'https://ckmurvhjumzlhsegncba.supabase.co'"),'Lookup must fall back to the deployed public Supabase URL.');
assert(resolver.includes("'sb_publishable_zAzk_tobvWHOWR22bmzMMw_uqHnCVxb'"),'Lookup must fall back to the deployed publishable key under RLS.');
assert(!resolver.includes("error:'Meeting lookup is not configured.'"),'Lookup-not-configured dead end must be eliminated.');
assert(html.includes('meeting-engine.js?v=94-rc13-3-camera-privacy'),'Engine cache bust missing.');
assert(html.includes('executive6.js?v=81-rc13-3-single-preview-owner'),'Executive cache bust missing.');
assert(html.includes('hotfix-rc13-1-media-prejoin.js?v=4-camera-privacy-reacquire'),'Hotfix cache bust missing.');
console.log('Camera privacy, clean reacquisition, device labels, and meeting lookup hardening passed.');
''')

contract_path=Path('meet/release-contract.json'); c=json.loads(contract_path.read_text())
for path in ['assets/js/meeting-engine.js','assets/js/meet-next/executive6.js','assets/js/meet/hotfix-rc13-1-media-prejoin.js','meet/index.html','netlify/functions/resolve-meeting-join.mjs']:
    if path not in c.get('files',{}): raise SystemExit(f'contract missing protected {path}')
    c['files'][path]=hashlib.sha256(Path(path).read_bytes()).hexdigest()
contract_path.write_text(json.dumps(c,indent=2)+'\n')
