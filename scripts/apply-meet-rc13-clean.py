#!/usr/bin/env python3
"""Apply RC13 media/share/link hardening to the exact recovered production baseline.

This script intentionally uses exact one-occurrence replacements. If production
source changes underneath us, it fails instead of guessing or partially patching.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ENGINE = Path("assets/js/meeting-engine.js")
UI = Path("assets/js/meet-next/executive6.js")
HTML = Path("meet/index.html")
CONTRACT = Path("meet/release-contract.json")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one source match, found {count}")
    return source.replace(old, new, 1)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


engine = ENGINE.read_text(encoding="utf-8")
ui = UI.read_text(encoding="utf-8")
html = HTML.read_text(encoding="utf-8")

engine = replace_once(
    engine,
    """    screenStartPromise: null,\n    preShareVideoEnabled: true,\n""",
    """    screenStartPromise: null,\n    screenPaused: false,\n    screenFreezeTrack: null,\n    screenFreezeStream: null,\n    screenFreezeCanvas: null,\n    preShareVideoEnabled: true,\n""",
    "screen freeze state",
)
engine = replace_once(
    engine,
    """    lastCameraToggleAt: 0,\n    monitoredCameraTracks: new WeakSet(),\n""",
    """    lastCameraToggleAt: 0,\n    lastCameraReleaseAt: 0,\n    monitoredCameraTracks: new WeakSet(),\n""",
    "camera release state",
)
engine = replace_once(
    engine,
    """    const screenTrack = state.screenStream?.getVideoTracks?.()[0] || null;\n    const screenAudioTrack = state.screenStream?.getAudioTracks?.()[0] || null;\n    const desired = [\n      {kind:'audio', track:audioTrack, stream:state.localStream},\n      {kind:'camera', track:cameraTrack, stream:state.localStream},\n      {kind:'screen', track:screenTrack, stream:state.screenStream},\n      {kind:'screen-audio', track:screenAudioTrack, stream:state.screenStream}\n    ];\n""",
    """    const realScreenTrack = state.screenStream?.getVideoTracks?.()[0] || null;\n    const frozenScreenTrack = state.screenPaused && state.screenFreezeTrack?.readyState === 'live' ? state.screenFreezeTrack : null;\n    const screenTrack = frozenScreenTrack || realScreenTrack;\n    const screenTrackStream = frozenScreenTrack ? state.screenFreezeStream : state.screenStream;\n    const screenAudioTrack = state.screenStream?.getAudioTracks?.()[0] || null;\n    const desired = [\n      {kind:'audio', track:audioTrack, stream:state.localStream},\n      {kind:'camera', track:cameraTrack, stream:state.localStream},\n      {kind:'screen', track:screenTrack, stream:screenTrackStream},\n      {kind:'screen-audio', track:screenAudioTrack, stream:state.screenStream}\n    ];\n""",
    "frozen screen sender routing",
)
engine = replace_once(
    engine,
    """  const acquireCameraTrack = async () => {\n    const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});\n    const track=stream.getVideoTracks()[0]||null;\n    if(!track){stream.getTracks().forEach(item=>item.stop());throw new Error('No camera track was provided by the browser.');}\n    return track;\n  };\n\n  const recoverCameraTrack = async () => {\n    const current=state.localStream?.getVideoTracks?.()[0]||null;\n    if(current?.readyState==='live')return current;\n    const replacement=await acquireCameraTrack();\n""",
    """  const CAMERA_RELEASE_GRACE_MS=750;\n  const CAMERA_RETRY_DELAYS_MS=[0,320,760,1400];\n  const cameraSleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));\n  const isTransientCameraStartError=error=>{\n    const name=String(error?.name||'');\n    const message=String(error?.message||'').toLowerCase();\n    if(['NotAllowedError','SecurityError','OverconstrainedError','NotFoundError'].includes(name))return false;\n    return ['NotReadableError','AbortError','TrackStartError'].includes(name)\n      || /could not start video source|device.*busy|camera.*busy|track.*start|hardware.*busy/.test(message);\n  };\n  const cameraIntentCurrent=intentSeq=>intentSeq==null||(state.desiredVideo&&intentSeq===state.videoToggleSeq);\n  const supersededCameraError=()=>{\n    const error=new Error('Camera request superseded by a newer video choice.');\n    error.name='AbortError';\n    return error;\n  };\n  const waitForCameraRelease=async intentSeq=>{\n    const elapsed=Date.now()-Number(state.lastCameraReleaseAt||0);\n    if(elapsed<CAMERA_RELEASE_GRACE_MS){\n      await cameraSleep(CAMERA_RELEASE_GRACE_MS-elapsed);\n      if(!cameraIntentCurrent(intentSeq))throw supersededCameraError();\n    }\n  };\n\n  const acquireCameraTrack = async ({intentSeq=null}={}) => {\n    await waitForCameraRelease(intentSeq);\n    let lastError=null;\n    for(let attempt=0;attempt<CAMERA_RETRY_DELAYS_MS.length;attempt++){\n      if(!cameraIntentCurrent(intentSeq))throw supersededCameraError();\n      const delay=CAMERA_RETRY_DELAYS_MS[attempt];\n      if(delay){\n        await cameraSleep(delay);\n        if(!cameraIntentCurrent(intentSeq))throw supersededCameraError();\n      }\n      try{\n        const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});\n        const track=stream.getVideoTracks()[0]||null;\n        if(!track){\n          stream.getTracks().forEach(item=>item.stop());\n          throw new Error('No camera track was provided by the browser.');\n        }\n        return track;\n      }catch(error){\n        lastError=error;\n        if(!isTransientCameraStartError(error))throw error;\n      }\n    }\n    const error=new Error('Camera could not start after automatic recovery. Make sure no other app is using the camera, then try Start Video again.');\n    error.name=lastError?.name||'CameraUnavailableError';\n    error.cause=lastError;\n    throw error;\n  };\n\n  const recoverCameraTrack = async ({intentSeq=null}={}) => {\n    const current=state.localStream?.getVideoTracks?.()[0]||null;\n    if(current?.readyState==='live')return current;\n    const replacement=await acquireCameraTrack({intentSeq});\n""",
    "camera release/retry acquisition",
)
engine = replace_once(
    engine,
    """    if(track?.readyState!=='ended'){\n      try{track.stop();}catch(_){}\n    }\n    // Keep the negotiated camera sender but remove its media. This releases the\n""",
    """    if(track?.readyState!=='ended'){\n      try{track.stop();}catch(_){}\n    }\n    if(track)state.lastCameraReleaseAt=Date.now();\n    // Keep the negotiated camera sender but remove its media. This releases the\n""",
    "camera release timestamp",
)

# This exact call is in toggleVideo; the earlier automatic track-ended recovery
# must retain its no-intent form.
toggle_start = engine.index("  const toggleVideo = enabled =>")
toggle_call = engine.index("try{track=await recoverCameraTrack();}", toggle_start)
engine = engine[:toggle_call] + engine[toggle_call:].replace(
    "try{track=await recoverCameraTrack();}",
    "try{track=await recoverCameraTrack({intentSeq:seq});}",
    1,
)

engine = replace_once(
    engine,
    """      const stream=state.screenStream;\n      state.screenStream = null;\n      state.screenRemoteControlCapable=false;\n      state.screenPaused=false;\n      stream.getTracks().forEach(track=>{ track.onended=null; if(track.readyState!=='ended')track.stop(); });\n""",
    """      const stream=state.screenStream;\n      const freezeTrack=state.screenFreezeTrack;\n      const freezeStream=state.screenFreezeStream;\n      state.screenStream = null;\n      state.screenRemoteControlCapable=false;\n      state.screenPaused=false;\n      state.screenFreezeTrack=null;\n      state.screenFreezeStream=null;\n      state.screenFreezeCanvas=null;\n      freezeStream?.getTracks?.().forEach(track=>{if(track.readyState!=='ended')track.stop();});\n      if(freezeTrack&&freezeTrack.readyState!=='ended')freezeTrack.stop();\n      stream.getTracks().forEach(track=>{ track.onended=null; if(track.readyState!=='ended')track.stop(); });\n""",
    "screen freeze stop cleanup",
)
engine = replace_once(
    engine,
    """  const pauseScreenShare = async paused => {\n    if (!state.screenStream) return false;\n    state.screenPaused=Boolean(paused);\n    state.screenStream.getVideoTracks().forEach(track=>track.enabled=!state.screenPaused);\n    await send('meet-screen-state',{active:true,paused:state.screenPaused});\n    emit('screen-paused',{paused:state.screenPaused});\n    return state.screenPaused;\n  };\n""",
    """  const createFrozenScreenTrack=async()=>{\n    const sourceTrack=state.screenStream?.getVideoTracks?.()[0]||null;\n    if(!sourceTrack||sourceTrack.readyState!=='live')throw new Error('The shared screen is no longer available.');\n    if(typeof document==='undefined')throw new Error('Pause Share requires a visual renderer.');\n    const settings=sourceTrack.getSettings?.()||{};\n    const width=Math.max(2,Number(settings.width)||1280);\n    const height=Math.max(2,Number(settings.height)||720);\n    const video=document.createElement('video');\n    video.muted=true;\n    video.playsInline=true;\n    video.autoplay=true;\n    video.srcObject=new MediaStream([sourceTrack]);\n    try{\n      await Promise.race([\n        new Promise(resolve=>{\n          if(video.readyState>=2)return resolve();\n          video.addEventListener('loadeddata',resolve,{once:true});\n        }),\n        new Promise((_,reject)=>setTimeout(()=>reject(new Error('Could not freeze the current shared frame.')),1200))\n      ]);\n      await video.play?.().catch?.(()=>{});\n      await new Promise(resolve=>(globalThis.requestAnimationFrame||setTimeout)(resolve,0));\n      const canvas=document.createElement('canvas');\n      canvas.width=width;\n      canvas.height=height;\n      const context=canvas.getContext('2d',{alpha:false});\n      if(!context||typeof canvas.captureStream!=='function')throw new Error('Pause Share is not supported by this system.');\n      context.drawImage(video,0,0,width,height);\n      const freezeStream=canvas.captureStream(1);\n      const freezeTrack=freezeStream.getVideoTracks()[0]||null;\n      if(!freezeTrack)throw new Error('Pause Share could not create a frozen presentation frame.');\n      freezeTrack.contentHint='detail';\n      state.screenFreezeCanvas=canvas;\n      return {track:freezeTrack,stream:freezeStream};\n    }finally{\n      video.pause?.();\n      video.srcObject=null;\n    }\n  };\n\n  const clearFrozenScreenTrack=()=>{\n    const track=state.screenFreezeTrack;\n    const stream=state.screenFreezeStream;\n    state.screenFreezeTrack=null;\n    state.screenFreezeStream=null;\n    state.screenFreezeCanvas=null;\n    stream?.getTracks?.().forEach(item=>{if(item.readyState!=='ended')item.stop();});\n    if(track&&track.readyState!=='ended')track.stop();\n  };\n\n  const pauseScreenShare = async paused => {\n    if (!state.screenStream) return false;\n    const target=Boolean(paused);\n    if(target===state.screenPaused)return state.screenPaused;\n    if(target){\n      const frozen=await createFrozenScreenTrack();\n      state.screenFreezeTrack=frozen.track;\n      state.screenFreezeStream=frozen.stream;\n      state.screenPaused=true;\n      // Replace only the outgoing presentation sender. The real capture remains\n      // alive, so participants see the exact last frame instead of black video.\n      await Promise.allSettled([...state.peers.values()].map(peer=>syncPeerTracks(peer)));\n      emit('screen-paused',{paused:true,privateFreeze:true});\n      return true;\n    }\n    state.screenPaused=false;\n    await Promise.allSettled([...state.peers.values()].map(peer=>syncPeerTracks(peer)));\n    clearFrozenScreenTrack();\n    emit('screen-paused',{paused:false,privateFreeze:true});\n    return false;\n  };\n""",
    "freeze-frame Pause Share",
)

ui = replace_once(
    ui,
    "window.__DS_MEET_BUILD='RC12.26-Join-and-Waiting-Room-Recovery';",
    "window.__DS_MEET_BUILD='RC13.0-Media-Share-Link-Stability';",
    "UI build marker",
)
ui = replace_once(
    ui,
    """  const toast = (message,options={}) => {\n    if(!message)return;\n    if(!options.force && ROUTINE_TOAST_PATTERNS.some(pattern=>pattern.test(String(message))))return;\n    const node=document.createElement('div');\n    node.className=`toast${options.type?` toast-${options.type}`:''}`;\n    node.textContent=message;\n    ids.toastLayer.append(node);\n    setTimeout(()=>node.remove(),options.duration||2800);\n  };\n""",
    """  let previewLastCameraReleaseAt=0;\n  const PREVIEW_CAMERA_RELEASE_GRACE_MS=750;\n  const PREVIEW_CAMERA_RETRY_DELAYS_MS=[0,320,760,1400];\n  const uiSleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));\n  const isTransientCameraStartError=error=>{\n    const name=String(error?.name||'');\n    const message=String(error?.message||'').toLowerCase();\n    if(['NotAllowedError','SecurityError','OverconstrainedError','NotFoundError'].includes(name))return false;\n    return ['NotReadableError','AbortError','TrackStartError'].includes(name)\n      || /could not start video source|device.*busy|camera.*busy|track.*start|hardware.*busy/.test(message);\n  };\n  const markPreviewCameraReleased=()=>{previewLastCameraReleaseAt=Date.now();};\n  const acquireUserMediaStable=async constraints=>{\n    const wantsVideo=Boolean(constraints?.video);\n    if(!wantsVideo)return navigator.mediaDevices.getUserMedia(constraints);\n    const elapsed=Date.now()-previewLastCameraReleaseAt;\n    if(elapsed<PREVIEW_CAMERA_RELEASE_GRACE_MS)await uiSleep(PREVIEW_CAMERA_RELEASE_GRACE_MS-elapsed);\n    let lastError=null;\n    for(let attempt=0;attempt<PREVIEW_CAMERA_RETRY_DELAYS_MS.length;attempt++){\n      if(PREVIEW_CAMERA_RETRY_DELAYS_MS[attempt])await uiSleep(PREVIEW_CAMERA_RETRY_DELAYS_MS[attempt]);\n      try{return await navigator.mediaDevices.getUserMedia(constraints);}\n      catch(error){lastError=error;if(!isTransientCameraStartError(error))throw error;}\n    }\n    const error=new Error('Camera could not start after automatic recovery. Make sure no other app is using the camera, then try Start Video again.');\n    error.name=lastError?.name||'CameraUnavailableError';\n    error.cause=lastError;\n    throw error;\n  };\n\n  const recentToasts=new Map();\n  const normalizeToastMessage=message=>/could not start video source/i.test(String(message||''))\n    ? 'Camera is recovering. If it remains off, make sure no other app is using the camera and try Start Video once.'\n    : String(message||'');\n  const toast = (message,options={}) => {\n    message=normalizeToastMessage(message);\n    if(!message)return;\n    if(!options.force && ROUTINE_TOAST_PATTERNS.some(pattern=>pattern.test(String(message))))return;\n    const now=Date.now();\n    const last=recentToasts.get(message)||0;\n    if(now-last<2600)return;\n    recentToasts.set(message,now);\n    const node=document.createElement('div');\n    node.className=`toast${options.type?` toast-${options.type}`:''}`;\n    node.textContent=message;\n    ids.toastLayer.append(node);\n    while(ids.toastLayer.children.length>3)ids.toastLayer.firstElementChild?.remove();\n    setTimeout(()=>node.remove(),options.duration||2800);\n    for(const [text,seenAt] of recentToasts){if(now-seenAt>8000)recentToasts.delete(text);}\n  };\n\n  const buildMeetingJoinLink=(room,{passcode=state.passcode,waiting=state.waitingRoomEnabled}={})=>{\n    const digits=String(room||'').replace(/\\D/g,'').slice(0,24);\n    const url=new URL('/meet/',location.origin);\n    url.searchParams.set('action','join');\n    if(digits)url.searchParams.set('room',digits);\n    const code=String(passcode||'').replace(/\\D/g,'').slice(0,10);\n    if(code)url.searchParams.set('passcode',code);\n    if(waiting)url.searchParams.set('waiting','1');\n    return url.toString();\n  };\n""",
    "prejoin camera + toast + canonical link helpers",
)
ui = replace_once(
    ui,
    """        : await navigator.mediaDevices.getUserMedia({video:state.video?{width:{ideal:1280},height:{ideal:720}}:false,audio:state.audio});\n""",
    """        : await acquireUserMediaStable({video:state.video?{width:{ideal:1280},height:{ideal:720}}:false,audio:state.audio});\n""",
    "preview stable acquisition",
)
ui = replace_once(
    ui,
    """    const fresh = await navigator.mediaDevices.getUserMedia(constraints);\n""",
    """    const fresh = kind === 'video' ? await acquireUserMediaStable(constraints) : await navigator.mediaDevices.getUserMedia(constraints);\n""",
    "device replacement camera stability",
)
ui = replace_once(
    ui,
    """        state.stream?.getVideoTracks?.().forEach(track=>{try{state.stream.removeTrack(track);}catch(_){};if(track.readyState!=='ended')track.stop();});\n      }else if(!hasLiveVideo(state.stream)){\n        const fresh=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});\n""",
    """        state.stream?.getVideoTracks?.().forEach(track=>{try{state.stream.removeTrack(track);}catch(_){};if(track.readyState!=='ended')track.stop();});\n        markPreviewCameraReleased();\n      }else if(!hasLiveVideo(state.stream)){\n        const fresh=await acquireUserMediaStable({video:{width:{ideal:1280},height:{ideal:720}},audio:false});\n""",
    "prejoin Video Off/On recovery",
)
ui = replace_once(
    ui,
    """      state.inviteLink = `${location.origin}/meet/?action=join&room=${encodeURIComponent(room)}`;\n""",
    """      state.inviteLink = buildMeetingJoinLink(room,{passcode:state.passcode,waiting:state.waitingRoomEnabled});\n""",
    "active meeting invite link",
)
ui = replace_once(
    ui,
    """    const link=state.inviteLink||`${location.origin}/meet/?action=join&room=${encodeURIComponent(room)}`;\n""",
    """    const link=state.inviteLink||buildMeetingJoinLink(room,{passcode:state.passcode,waiting:state.waitingRoomEnabled});\n""",
    "invite dialog canonical link",
)
ui = replace_once(
    ui,
    """  ids.roomId.value = formatMeetingId(query.get('room') || '');\n  if(ids.meetingPasscode)ids.meetingPasscode.value='';\n""",
    """  ids.roomId.value = formatMeetingId(query.get('room') || query.get('meeting') || '');\n  if(ids.meetingPasscode)ids.meetingPasscode.value=String(query.get('passcode')||'').replace(/\\D/g,'').slice(0,10);\n""",
    "incoming canonical room/passcode link",
)
ui = replace_once(
    ui,
    """    const enteringMeeting=Boolean(query.get('room'))||['new','join','share','personal'].includes(action)||query.get('new')==='1';\n""",
    """    const enteringMeeting=Boolean(query.get('room')||query.get('meeting'))||['new','join','share','personal'].includes(action)||query.get('new')==='1';\n""",
    "legacy meeting link preview routing",
)
ui = replace_once(
    ui,
    """    const item={topic:$('scheduleTopic').value.trim(),date:$('scheduleDate').value,time:$('scheduleTime').value,duration:Number($('scheduleDuration').value),recurring,frequency:recurring?$('scheduleFrequency').value:null,ends:recurring?$('scheduleEnds').value:null,endValue:recurring&&$('scheduleEnds').value!=='never'?$('scheduleEndValue').value:null,waitingRoom:$('scheduleWaitingRoom').checked,id:pendingCredentials.id,passcode,link:`${location.origin}/meet/?action=join&room=${pendingCredentials.id}`};\n""",
    """    const waitingRoom=$('scheduleWaitingRoom').checked;\n    const item={topic:$('scheduleTopic').value.trim(),date:$('scheduleDate').value,time:$('scheduleTime').value,duration:Number($('scheduleDuration').value),recurring,frequency:recurring?$('scheduleFrequency').value:null,ends:recurring?$('scheduleEnds').value:null,endValue:recurring&&$('scheduleEnds').value!=='never'?$('scheduleEndValue').value:null,waitingRoom,id:pendingCredentials.id,passcode,link:buildMeetingJoinLink(pendingCredentials.id,{passcode,waiting:waitingRoom})};\n""",
    "scheduled meeting canonical link",
)

html = replace_once(
    html,
    "/assets/js/meeting-engine.js?v=91-rc12-26-durable-admission",
    "/assets/js/meeting-engine.js?v=92-rc13-media-stability",
    "meeting-engine cache key",
)
html = replace_once(
    html,
    "/assets/js/meet-next/executive6.js?v=78-rc12-26-join-recovery",
    "/assets/js/meet-next/executive6.js?v=79-rc13-media-share-link-stability",
    "executive cache key",
)

ENGINE.write_text(engine, encoding="utf-8")
UI.write_text(ui, encoding="utf-8")
HTML.write_text(html, encoding="utf-8")

contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
contract["releaseId"] = "2026.08.16-rc13.0-media-share-link-stability"
for path in (ENGINE, UI, HTML):
    rel = path.as_posix()
    if rel not in contract.get("files", {}):
        raise SystemExit(f"release contract does not track changed production file: {rel}")
    contract["files"][rel] = digest(path)
CONTRACT.write_text(json.dumps(contract, indent=2) + "\n", encoding="utf-8")

print("RC13 clean hardening applied")
print("releaseId", contract["releaseId"])
print("engine", digest(ENGINE))
print("ui", digest(UI))
print("html", digest(HTML))
