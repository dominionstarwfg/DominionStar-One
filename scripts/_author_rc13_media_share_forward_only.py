from pathlib import Path
import re, json, hashlib


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old,new,1)

# 1) Remote dock video must never depend on autoplaying audible media.
exec_path=Path('assets/js/meet-next/executive6.js')
exec_js=exec_path.read_text()
exec_js=replace_once(exec_js,
"    bindStableVideo(video,stream,{muted:false,mirror:true,play:false});",
"    // Dock video is a visual renderer only. Keep it muted so Chromium/Electron\n    // cannot block remote frames behind autoplay policy; meeting audio remains\n    // owned by the WebRTC stream/audio path.\n    bindStableVideo(video,stream,{muted:true,mirror:true,play:false});",
'remote dock muted playback')

# State bridge from hosted meeting -> native presenter toolbar.
state_anchor="""  const ids = ['prejoin','meeting','prejoinVideo','prejoinFallback','joinForm','joinStatus','displayName','displayNameField','accountIdentity','alwaysJoinMuted','alwaysJoinCameraOff','roomId','meetingPasscode','preMic','preCam','preSettings','roomLabel','connectionState','stageVideo','stageFallback','stageName','speakerNameplate','speakerName','selfTile','selfVideo','selfName','selfMicState','filmstrip','filmstripTrack','dockUp','dockDown','participantsPanel','participantCount','participantBadge','waitingSection','waitingCount','waitingRoom','participantList','participantSearch','chatPanel','chatRecipient','chatMessages','chatForm','chatInput','chatBadge','deviceMenu','toastLayer','reactionLayer','micBtn','micMenuBtn','camBtn','camMenuBtn','participantsBtn','chatBtn','shareBtn','reactionBtn','raiseHandBtn','transcribeBtn','hostToolsBtn','moreBtn','leaveBtn','settingsDialog','cameraSelect','microphoneSelect','speakerSelect','mirrorToggle','qualitySelect','backgroundSelect','brightnessRange','touchAppearanceRange','networkIndicator','speakerMicIndicator','profilePhotoInput','profilePhotoPreview','inviteBtn','inviteDialog','inviteMeetingLink','inviteMeetingId','invitePasscode','copyInviteBtn','copyLinkBtn','closeInviteBtn','muteAllBtn','participantMoreBtn','leaveDialog','leaveCopy','leaveOnlyBtn','endAllBtn','leaveCancelBtn','leaveClose','shareStatusBar','shareStatusText','shareViewerMoreBtn','sharePresenterControls','pauseShareBtn','newShareBtn','stopShareBtn'].reduce((o,k)=>(o[k]=$(k),o),{});\n"""
state_insert=state_anchor+"""
  const syncNativePresenterState=()=>{
    if(!window.dominionDesktop?.updatePresenterToolbarState)return;
    window.dominionDesktop.updatePresenterToolbarState({
      audio:Boolean(state.audio),
      video:Boolean(state.video),
      sharing:Boolean(state.sharingParticipantId==='self'||state.sharing),
      paused:Boolean(state.sharePaused),
      canEnd:Boolean(state.isHost),
      participantCount:Math.max(1,state.participants.size+1)
    });
  };
"""
exec_js=replace_once(exec_js,state_anchor,state_insert,'presenter state helper')

# Local media state drives button + native toolbar state.
exec_js=replace_once(exec_js,
"      if(!state.audio)setSpeakingVisual('self',false,0);",
"      if(!state.audio)setSpeakingVisual('self',false,0);\n      syncNativePresenterState();",
'local audio presenter state')
exec_js=replace_once(exec_js,
"      setButtonState(ids.camBtn,state.video,'video','video-off','Stop Video','Start Video');",
"      setButtonState(ids.camBtn,state.video,'video','video-off','Stop Video','Start Video');\n      syncNativePresenterState();",
'local video presenter state')

# Share lifecycle drives state and guarantees native window restoration.
exec_js=replace_once(exec_js,
"    ids.shareBtn.classList.add('active-share');",
"    ids.shareBtn.classList.add('active-share');\n    syncNativePresenterState();",
'share start presenter state')
exec_js=replace_once(exec_js,
"    endPresentationMode();\n  });\n  engine.on('screen-ended',()=>{",
"    endPresentationMode();\n    syncNativePresenterState();\n  });\n  engine.on('screen-ended',()=>{",
'remote screen state sync')
exec_js=replace_once(exec_js,
"    endPresentationMode();\n",
"    endPresentationMode();\n    state.sharePaused=false;\n    syncNativePresenterState();\n    window.dominionDesktop?.restoreMeetingWindow?.();\n",
'screen ended hard restore')
# The first replacement above targets the first endPresentationMode in the screen-ended block after our anchor search in current source.

# Pause/new/stop state should be authoritative and always recover UI.
exec_js=replace_once(exec_js,
"    state.sharePaused=await engine.pauseScreenShare(!state.sharePaused);\n    ids.pauseShareBtn.textContent=state.sharePaused?'Resume Share':'Pause Share';",
"    state.sharePaused=await engine.pauseScreenShare(!state.sharePaused);\n    ids.pauseShareBtn.textContent=state.sharePaused?'Resume Share':'Pause Share';\n    syncNativePresenterState();",
'pause state sync')
exec_js=replace_once(exec_js,
"  ids.stopShareBtn.onclick=()=>engine.stopScreenShare();",
"  ids.stopShareBtn.onclick=async()=>{\n    try{await engine.stopScreenShare();}\n    finally{state.sharePaused=false;endPresentationMode();syncNativePresenterState();window.dominionDesktop?.restoreMeetingWindow?.();}\n  };",
'stop share recovery')
exec_path.write_text(exec_js)

# 2) Force DominionStar's premium source chooser on macOS instead of the small OS picker.
main_path=Path('desktop 2/src/main-v2.mjs')
main=main_path.read_text()
main=re.sub(r"function supportsMacSystemPicker\(\) \{.*?\n\}","function supportsMacSystemPicker() {\n  // Product policy: DominionStar owns the share-selection UX on every desktop.\n  // The macOS system picker is intentionally disabled so users receive the\n  // same branded screen/window preview chooser and capture validation.\n  return false;\n}",main,count=1,flags=re.S)
if 'return false;\n}' not in main: raise SystemExit('failed to disable system picker')

# Relay authoritative presenter state and expose an explicit meeting restore command.
ipc_anchor="""ipcMain.on('desktop:presenter-command', (event, command = '') => {
  if (event.sender !== presenterWindow?.webContents) return;
  const allowed = new Set(['audio', 'video', 'participants', 'chat', 'reactions', 'pause', 'new-share', 'more', 'stop']);
  const safe = String(command || '');
  if (allowed.has(safe) && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:presenter-command', safe);
  }
});
"""
ipc_insert=ipc_anchor+"""
ipcMain.on('desktop:presenter-state', (event, next = {}) => {
  if (!isDesktopRoute(event.sender.getURL())) return;
  if (!presenterWindow || presenterWindow.isDestroyed()) return;
  presenterWindow.webContents.send('desktop:presenter-state', {
    audio: Boolean(next.audio),
    video: Boolean(next.video),
    sharing: Boolean(next.sharing),
    paused: Boolean(next.paused),
    canEnd: Boolean(next.canEnd),
    participantCount: Math.max(1, Number(next.participantCount) || 1)
  });
});

ipcMain.on('desktop:restore-meeting', (event) => {
  if (!isDesktopRoute(event.sender.getURL())) return;
  hidePresenterWindow({ restoreMeeting: true });
});
"""
main=replace_once(main,ipc_anchor,ipc_insert,'main presenter state relay')
main_path.write_text(main)

# 3) Hosted preload APIs for state + hard restore.
preload_path=Path('desktop 2/src/preload.cjs')
preload=preload_path.read_text()
preload=replace_once(preload,
"  hidePresenterToolbar: () => ipcRenderer.send('desktop:presenter-hide'),",
"  hidePresenterToolbar: () => ipcRenderer.send('desktop:presenter-hide'),\n  restoreMeetingWindow: () => ipcRenderer.send('desktop:restore-meeting'),\n  updatePresenterToolbarState: state => ipcRenderer.send('desktop:presenter-state', state && typeof state === 'object' ? state : {}),",
'preload presenter APIs')
preload_path.write_text(preload)

# Presenter preload receives state from main.
presenter_preload_path=Path('desktop 2/src/presenter-preload.cjs')
presenter_preload=presenter_preload_path.read_text()
presenter_preload=presenter_preload.replace("  resize:(width,height)=>ipcRenderer.send('desktop:presenter-resize',{width:Number(width),height:Number(height)})","  resize:(width,height)=>ipcRenderer.send('desktop:presenter-resize',{width:Number(width),height:Number(height)}),\n  onState:callback=>{\n    if(typeof callback!=='function')return()=>{};\n    const listener=(_event,state)=>callback(Object.freeze({...state}));\n    ipcRenderer.on('desktop:presenter-state',listener);\n    return()=>ipcRenderer.removeListener('desktop:presenter-state',listener);\n  }")
presenter_preload_path.write_text(presenter_preload)

# 4) Replace archaic presenter toolbar with future-facing vector UI.
toolbar=Path('desktop 2/src/presenter-toolbar.html')
toolbar.write_text('''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DominionStar Presenter Controls</title>
<style>
*{box-sizing:border-box}html,body{margin:0;background:transparent;color:#f8fafc;font:12px Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}.bar{height:72px;margin:4px;display:flex;align-items:stretch;border:1px solid rgba(137,198,255,.18);border-radius:20px;background:linear-gradient(135deg,rgba(7,13,24,.97),rgba(13,24,42,.94));box-shadow:0 22px 70px rgba(0,0,0,.52),inset 0 1px rgba(255,255,255,.06);backdrop-filter:blur(24px);-webkit-app-region:drag;user-select:none}.status{display:flex;align-items:center;gap:10px;padding:0 17px;border-right:1px solid rgba(255,255,255,.08);font-weight:760;white-space:nowrap}.status-copy small{display:block;margin-top:3px;color:#88a0b8;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.dot{width:8px;height:8px;border-radius:50%;background:#29e58c;box-shadow:0 0 0 4px rgba(41,229,140,.12),0 0 16px rgba(41,229,140,.55)}.controls{display:flex;flex:1;align-items:stretch}.control{position:relative;min-width:72px;padding:8px 10px;border:0;border-right:1px solid rgba(255,255,255,.055);background:transparent;color:#c9d5e4;cursor:pointer;-webkit-app-region:no-drag;transition:.16s ease}.control:hover{background:linear-gradient(180deg,rgba(70,139,255,.12),rgba(255,255,255,.03));color:#fff}.control svg{display:block;width:20px;height:20px;margin:0 auto 5px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.control small{font-size:9.5px;font-weight:700;white-space:nowrap}.control.is-off{color:#ff6577}.control.is-off:after{content:"";position:absolute;left:25px;top:17px;width:23px;height:2px;border-radius:2px;background:#ff3f58;transform:rotate(-42deg);box-shadow:0 0 9px rgba(255,63,88,.45)}.control.is-active{color:#73d7ff;background:rgba(50,164,255,.08)}.pause.is-active{color:#ffd166}.stop{margin:8px;border:1px solid rgba(255,100,115,.35);border-radius:12px;background:linear-gradient(135deg,#ef4055,#ba1f38);color:#fff;font-weight:850;box-shadow:0 9px 25px rgba(191,31,55,.27)}.stop:hover{background:linear-gradient(135deg,#ff5368,#cc2742)}.more-menu{position:fixed;right:86px;top:78px;width:240px;padding:8px;border:1px solid rgba(137,198,255,.16);border-radius:15px;background:rgba(9,16,28,.98);box-shadow:0 24px 65px #000b;-webkit-app-region:no-drag}.more-menu[hidden]{display:none}.more-menu button{display:block;width:100%;padding:11px 12px;border:0;border-radius:9px;background:transparent;color:#e8eef7;text-align:left;font-weight:650;cursor:pointer}.more-menu button:hover{background:#17263a}.more-menu .danger{color:#ff8795}body.collapsed .bar{width:300px;margin-left:auto;margin-right:auto;height:46px;border-radius:14px}body.collapsed .controls{display:none}body.collapsed .status{flex:1;justify-content:center;border:0;padding:0 12px}
</style></head><body>
<div class="bar"><div class="status"><span class="dot"></span><span class="status-copy">You are sharing<small data-status-detail>Presenter mode</small></span></div><div class="controls">
<button class="control" data-command="audio" data-state-control="audio" aria-label="Audio"><svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg><small>Audio</small></button>
<button class="control" data-command="video" data-state-control="video" aria-label="Video"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg><small>Video</small></button>
<button class="control" data-command="participants" aria-label="Participants"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg><small>Participants</small></button>
<button class="control" data-command="chat" aria-label="Chat"><svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg><small>Chat</small></button>
<button class="control" data-command="reactions" aria-label="Reactions"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg><small>React</small></button>
<button class="control pause" data-command="pause" data-state-control="pause" aria-label="Pause share"><svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg><small data-pause-label>Pause</small></button>
<button class="control" data-command="new-share" aria-label="New share"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M12 13V7M9 10l3-3 3 3"/></svg><small>New Share</small></button>
<button class="control" data-command="more" aria-label="More"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg><small>More</small></button>
<button class="control stop" data-command="stop"><small>Stop Share</small></button></div></div>
<div id="presenterMoreMenu" class="more-menu" hidden role="menu"><button type="button" data-command="participants">Participants</button><button type="button" data-command="chat">Chat</button><button type="button" data-command="reactions">Reactions</button><button type="button" data-command="new-share">New Share</button><button type="button" data-command="stop" class="danger">Stop Share</button></div>
<script src="presenter-toolbar.js"></script></body></html>''')

# Toolbar JS: receive authoritative media/share state and reflect it.
toolbar_js=Path('desktop 2/src/presenter-toolbar.js')
toolbar_js.write_text('''const menu=document.getElementById('presenterMoreMenu');
const more=document.querySelector('[data-command="more"]');let collapseTimer=0;const expandedHeight=menu?340:80;
let meetingState={audio:true,video:true,sharing:true,paused:false,participantCount:1};
const applyState=next=>{meetingState={...meetingState,...(next||{})};const audio=document.querySelector('[data-state-control="audio"]');const video=document.querySelector('[data-state-control="video"]');const pause=document.querySelector('[data-state-control="pause"]');audio?.classList.toggle('is-off',!meetingState.audio);video?.classList.toggle('is-off',!meetingState.video);pause?.classList.toggle('is-active',Boolean(meetingState.paused));const label=document.querySelector('[data-pause-label]');if(label)label.textContent=meetingState.paused?'Resume':'Pause';const detail=document.querySelector('[data-status-detail]');if(detail)detail.textContent=`${Math.max(1,Number(meetingState.participantCount)||1)} participant${Number(meetingState.participantCount)===1?'':'s'} · ${meetingState.paused?'Share paused':'Live'}`;};
window.presenterBridge.onState?.(applyState);
const scheduleCollapse=()=>{clearTimeout(collapseTimer);collapseTimer=setTimeout(()=>{menu.hidden=true;document.body.classList.add('collapsed');window.presenterBridge.resize?.(300,54)},3000)};
const expand=()=>{clearTimeout(collapseTimer);document.body.classList.remove('collapsed');window.presenterBridge.resize?.(980,menu.hidden?80:expandedHeight)};
document.addEventListener('pointerenter',expand);document.addEventListener('pointermove',scheduleCollapse);document.addEventListener('pointerleave',scheduleCollapse);
document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',event=>{const command=button.dataset.command;if(command==='more'){event.stopPropagation();menu.hidden=!menu.hidden;window.presenterBridge.resize?.(980,menu.hidden?80:expandedHeight);return;}menu.hidden=true;window.presenterBridge.resize?.(980,80);window.presenterBridge.command(command);scheduleCollapse()}));
document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&event.target!==more){menu.hidden=true;window.presenterBridge.resize?.(980,80)}});applyState(meetingState);scheduleCollapse();''')

# 5) Permanent regression assertions.
test=Path('scripts/test-media-share-forward-only.mjs')
test.write_text("""import assert from 'node:assert/strict';import fs from 'node:fs';
const exec=fs.readFileSync('assets/js/meet-next/executive6.js','utf8');const main=fs.readFileSync('desktop 2/src/main-v2.mjs','utf8');const preload=fs.readFileSync('desktop 2/src/preload.cjs','utf8');const ppre=fs.readFileSync('desktop 2/src/presenter-preload.cjs','utf8');const toolbar=fs.readFileSync('desktop 2/src/presenter-toolbar.html','utf8');const toolbarJs=fs.readFileSync('desktop 2/src/presenter-toolbar.js','utf8');
assert(exec.includes('bindStableVideo(video,stream,{muted:true,mirror:true,play:false})'),'remote dock video is not autoplay-safe');assert(exec.includes('updatePresenterToolbarState'),'hosted Meet does not publish presenter state');assert(exec.includes('restoreMeetingWindow'),'stop share has no hard meeting restore');assert(main.includes('function supportsMacSystemPicker()')&&/function supportsMacSystemPicker\(\) \{[\s\S]*?return false;/.test(main),'macOS generic picker still enabled');assert(main.includes("desktop:presenter-state"),'main does not relay presenter state');assert(preload.includes('updatePresenterToolbarState')&&preload.includes('restoreMeetingWindow'),'desktop bridge state/restore APIs missing');assert(ppre.includes('onState'),'presenter cannot receive state');assert(!/[🎙♙☺]/u.test(toolbar),'legacy glyph icons remain in presenter toolbar');assert(toolbar.includes('<svg')&&toolbar.includes('is-off'),'presenter toolbar is not vector/state styled');assert(toolbarJs.includes("classList.toggle('is-off',!meetingState.video)"),'camera-off state is not reflected');assert(toolbarJs.includes("classList.toggle('is-off',!meetingState.audio)"),'mic-off state is not reflected');console.log('MEDIA_SHARE_FORWARD_ONLY_OK');
""")

# Update release-protected hosted hashes. Desktop binary files are validated by desktop CI, not hosted release hashes.
contract_path=Path('meet/release-contract.json');contract=json.loads(contract_path.read_text())
for rel in ['assets/js/meet-next/executive6.js']:
    contract['files'][rel]=hashlib.sha256(Path(rel).read_bytes()).hexdigest()
contract_path.write_text(json.dumps(contract,indent=2)+'\n')
print('AUTHORED_RC13_MEDIA_SHARE_FORWARD_ONLY')
