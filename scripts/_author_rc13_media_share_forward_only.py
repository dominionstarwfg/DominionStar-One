from pathlib import Path
import re, json, hashlib

def one(text, old, new, label):
    if text.count(old)!=1: raise SystemExit(f'{label}: expected 1 occurrence, found {text.count(old)}')
    return text.replace(old,new,1)

def sub1(text, pattern, repl, label):
    out,n=re.subn(pattern,repl,text,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'{label}: expected 1 regex match, found {n}')
    return out

# Hosted Meet: remote video rendering + authoritative native presenter state + stop-share recovery.
p=Path('assets/js/meet-next/executive6.js'); s=p.read_text()
s=one(s,"    bindStableVideo(video,stream,{muted:false,mirror:true,play:false});","    // Remote dock video is visual-only; keep it muted so Chromium/Electron autoplay policy cannot suppress frames.\n    bindStableVideo(video,stream,{muted:true,mirror:true,play:false});",'remote dock autoplay')
ids_end="].reduce((o,k)=>(o[k]=$(k),o),{});"
pos=s.find(ids_end)
if pos<0: raise SystemExit('ids anchor missing')
pos+=len(ids_end)
helper="""

  const syncNativePresenterState=()=>{
    if(!window.dominionDesktop?.updatePresenterToolbarState)return;
    window.dominionDesktop.updatePresenterToolbarState({audio:Boolean(state.audio),video:Boolean(state.video),sharing:Boolean(state.sharingParticipantId==='self'||state.sharing),paused:Boolean(state.sharePaused),canEnd:Boolean(state.isHost),participantCount:Math.max(1,state.participants.size+1)});
  };
"""
s=s[:pos]+helper+s[pos:]
s=one(s,"    button.classList.toggle('is-off', !enabled);","    button.classList.toggle('is-off', !enabled);\n    if(button===ids.micBtn||button===ids.camBtn)queueMicrotask(syncNativePresenterState);",'toolbar media-state sync')
s=one(s,"    ids.shareBtn.classList.add('active-share');","    ids.shareBtn.classList.add('active-share');\n    syncNativePresenterState();",'share start sync')
s=one(s,"    state.sharePaused=await engine.pauseScreenShare(!state.sharePaused);\n    ids.pauseShareBtn.textContent=state.sharePaused?'Resume Share':'Pause Share';","    state.sharePaused=await engine.pauseScreenShare(!state.sharePaused);\n    ids.pauseShareBtn.textContent=state.sharePaused?'Resume Share':'Pause Share';\n    syncNativePresenterState();",'pause sync')
s=one(s,"  ids.stopShareBtn.onclick=()=>engine.stopScreenShare();","  ids.stopShareBtn.onclick=async()=>{try{await engine.stopScreenShare();}finally{state.sharePaused=false;endPresentationMode();syncNativePresenterState();window.dominionDesktop?.restoreMeetingWindow?.();}};",'stop share recovery')
s=sub1(s,r"engine\.on\('screen-ended',\(\)=>\{\n(.*?)\n\s*endPresentationMode\(\);",lambda m:"engine.on('screen-ended',()=>{\n"+m.group(1)+"\n    endPresentationMode();\n    state.sharePaused=false;\n    syncNativePresenterState();\n    window.dominionDesktop?.restoreMeetingWindow?.();",'screen ended hard restore')
p.write_text(s)

# Desktop main: always use DominionStar branded share chooser; relay state; hard restore.
p=Path('desktop 2/src/main-v2.mjs'); s=p.read_text()
s=sub1(s,r"function supportsMacSystemPicker\(\) \{.*?\n\}","function supportsMacSystemPicker() {\n  // DominionStar owns the desktop share-selection UX. Generic OS picker disabled.\n  return false;\n}",'disable generic mac picker')
anchor="""ipcMain.on('desktop:presenter-command', (event, command = '') => {
  if (event.sender !== presenterWindow?.webContents) return;
  const allowed = new Set(['audio', 'video', 'participants', 'chat', 'reactions', 'pause', 'new-share', 'more', 'stop']);
  const safe = String(command || '');
  if (allowed.has(safe) && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:presenter-command', safe);
  }
});
"""
insert=anchor+"""
ipcMain.on('desktop:presenter-state', (event, next = {}) => {
  if (!isDesktopRoute(event.sender.getURL()) || !presenterWindow || presenterWindow.isDestroyed()) return;
  presenterWindow.webContents.send('desktop:presenter-state', {audio:Boolean(next.audio),video:Boolean(next.video),sharing:Boolean(next.sharing),paused:Boolean(next.paused),canEnd:Boolean(next.canEnd),participantCount:Math.max(1,Number(next.participantCount)||1)});
});
ipcMain.on('desktop:restore-meeting', (event) => {
  if (!isDesktopRoute(event.sender.getURL())) return;
  hidePresenterWindow({ restoreMeeting: true });
});
"""
s=one(s,anchor,insert,'presenter relay'); p.write_text(s)

# Hosted desktop bridge.
p=Path('desktop 2/src/preload.cjs'); s=p.read_text()
s=one(s,"  hidePresenterToolbar: () => ipcRenderer.send('desktop:presenter-hide'),","  hidePresenterToolbar: () => ipcRenderer.send('desktop:presenter-hide'),\n  restoreMeetingWindow: () => ipcRenderer.send('desktop:restore-meeting'),\n  updatePresenterToolbarState: state => ipcRenderer.send('desktop:presenter-state', state && typeof state === 'object' ? state : {}),",'desktop presenter APIs'); p.write_text(s)

# Native presenter bridge receives authoritative state.
p=Path('desktop 2/src/presenter-preload.cjs'); s=p.read_text()
s=one(s,"  resize:(width,height)=>ipcRenderer.send('desktop:presenter-resize',{width:Number(width),height:Number(height)})","  resize:(width,height)=>ipcRenderer.send('desktop:presenter-resize',{width:Number(width),height:Number(height)}),\n  onState:callback=>{if(typeof callback!=='function')return()=>{};const listener=(_event,state)=>callback(Object.freeze({...state}));ipcRenderer.on('desktop:presenter-state',listener);return()=>ipcRenderer.removeListener('desktop:presenter-state',listener);}",'presenter state API'); p.write_text(s)

# Future-facing vector presenter toolbar.
Path('desktop 2/src/presenter-toolbar.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DominionStar Presenter Controls</title><style>
*{box-sizing:border-box}html,body{margin:0;background:transparent;color:#f8fafc;font:12px Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}.bar{height:72px;margin:4px;display:flex;align-items:stretch;border:1px solid #89c6ff2e;border-radius:20px;background:linear-gradient(135deg,#070d18f8,#0d182af2);box-shadow:0 22px 70px #0008,inset 0 1px #ffffff0f;backdrop-filter:blur(24px);-webkit-app-region:drag;user-select:none}.status{display:flex;align-items:center;gap:10px;padding:0 17px;border-right:1px solid #ffffff14;font-weight:760;white-space:nowrap}.status small{display:block;margin-top:3px;color:#88a0b8;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.dot{width:8px;height:8px;border-radius:50%;background:#29e58c;box-shadow:0 0 0 4px #29e58c1f,0 0 16px #29e58c8c}.controls{display:flex;flex:1}.control{position:relative;min-width:72px;padding:8px 10px;border:0;border-right:1px solid #ffffff0e;background:transparent;color:#c9d5e4;cursor:pointer;-webkit-app-region:no-drag;transition:.16s}.control:hover{background:linear-gradient(180deg,#468bff1f,#ffffff08);color:#fff}.control svg{display:block;width:20px;height:20px;margin:0 auto 5px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.control small{font-size:9.5px;font-weight:700}.control.is-off{color:#ff6577}.control.is-off:after{content:"";position:absolute;left:25px;top:17px;width:23px;height:2px;border-radius:2px;background:#ff3f58;transform:rotate(-42deg);box-shadow:0 0 9px #ff3f5873}.pause.is-active{color:#ffd166;background:#ffd16612}.stop{margin:8px;border:1px solid #ff647359;border-radius:12px;background:linear-gradient(135deg,#ef4055,#ba1f38);color:#fff;font-weight:850;box-shadow:0 9px 25px #bf1f3745}.more-menu{position:fixed;right:86px;top:78px;width:240px;padding:8px;border:1px solid #89c6ff29;border-radius:15px;background:#09101cfa;box-shadow:0 24px 65px #000b;-webkit-app-region:no-drag}.more-menu[hidden]{display:none}.more-menu button{display:block;width:100%;padding:11px 12px;border:0;border-radius:9px;background:transparent;color:#e8eef7;text-align:left;font-weight:650}.more-menu button:hover{background:#17263a}.danger{color:#ff8795!important}body.collapsed .bar{width:300px;margin-left:auto;margin-right:auto;height:46px;border-radius:14px}body.collapsed .controls{display:none}body.collapsed .status{flex:1;justify-content:center;border:0}
</style></head><body><div class="bar"><div class="status"><span class="dot"></span><span>You are sharing<small data-status-detail>Presenter mode</small></span></div><div class="controls">
<button class="control" data-command="audio" data-state-control="audio"><svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg><small>Audio</small></button><button class="control" data-command="video" data-state-control="video"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg><small>Video</small></button><button class="control" data-command="participants"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg><small>Participants</small></button><button class="control" data-command="chat"><svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg><small>Chat</small></button><button class="control" data-command="reactions"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg><small>React</small></button><button class="control pause" data-command="pause" data-state-control="pause"><svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg><small data-pause-label>Pause</small></button><button class="control" data-command="new-share"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M12 13V7M9 10l3-3 3 3"/></svg><small>New Share</small></button><button class="control" data-command="more"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg><small>More</small></button><button class="control stop" data-command="stop"><small>Stop Share</small></button></div></div><div id="presenterMoreMenu" class="more-menu" hidden><button data-command="participants">Participants</button><button data-command="chat">Chat</button><button data-command="reactions">Reactions</button><button data-command="new-share">New Share</button><button data-command="stop" class="danger">Stop Share</button></div><script src="presenter-toolbar.js"></script></body></html>''')

Path('desktop 2/src/presenter-toolbar.js').write_text('''const menu=document.getElementById('presenterMoreMenu'),more=document.querySelector('[data-command="more"]');let timer=0,state={audio:true,video:true,sharing:true,paused:false,participantCount:1};const apply=n=>{state={...state,...(n||{})};document.querySelector('[data-state-control="audio"]')?.classList.toggle('is-off',!state.audio);document.querySelector('[data-state-control="video"]')?.classList.toggle('is-off',!state.video);document.querySelector('[data-state-control="pause"]')?.classList.toggle('is-active',!!state.paused);const p=document.querySelector('[data-pause-label]');if(p)p.textContent=state.paused?'Resume':'Pause';const d=document.querySelector('[data-status-detail]');if(d)d.textContent=`${Math.max(1,Number(state.participantCount)||1)} participant${Number(state.participantCount)===1?'':'s'} · ${state.paused?'Share paused':'Live'}`};window.presenterBridge.onState?.(apply);const collapse=()=>{clearTimeout(timer);timer=setTimeout(()=>{menu.hidden=true;document.body.classList.add('collapsed');window.presenterBridge.resize?.(300,54)},3000)},expand=()=>{clearTimeout(timer);document.body.classList.remove('collapsed');window.presenterBridge.resize?.(980,menu.hidden?80:340)};document.addEventListener('pointerenter',expand);document.addEventListener('pointermove',collapse);document.addEventListener('pointerleave',collapse);document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',e=>{const c=b.dataset.command;if(c==='more'){e.stopPropagation();menu.hidden=!menu.hidden;window.presenterBridge.resize?.(980,menu.hidden?80:340);return}menu.hidden=true;window.presenterBridge.command(c);collapse()}));document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==more)menu.hidden=true});apply(state);collapse();''')

# Regression contract.
Path('scripts/test-media-share-forward-only.mjs').write_text("""import assert from 'node:assert/strict';import fs from 'node:fs';const e=fs.readFileSync('assets/js/meet-next/executive6.js','utf8'),m=fs.readFileSync('desktop 2/src/main-v2.mjs','utf8'),p=fs.readFileSync('desktop 2/src/preload.cjs','utf8'),pp=fs.readFileSync('desktop 2/src/presenter-preload.cjs','utf8'),h=fs.readFileSync('desktop 2/src/presenter-toolbar.html','utf8'),j=fs.readFileSync('desktop 2/src/presenter-toolbar.js','utf8');assert(e.includes('bindStableVideo(video,stream,{muted:true,mirror:true,play:false})');assert(e.includes('updatePresenterToolbarState'));assert(e.includes('restoreMeetingWindow'));assert(/function supportsMacSystemPicker\(\) \{[\s\S]*?return false;/.test(m));assert(m.includes('desktop:presenter-state'));assert(p.includes('updatePresenterToolbarState')&&p.includes('restoreMeetingWindow'));assert(pp.includes('onState'));assert(!/[🎙♙☺]/u.test(h));assert(h.includes('<svg')&&h.includes('is-off'));assert(j.includes("classList.toggle('is-off',!state.video)"));assert(j.includes("classList.toggle('is-off',!state.audio)"));console.log('MEDIA_SHARE_FORWARD_ONLY_OK');""")

# Protected hosted hash.
cpath=Path('meet/release-contract.json'); c=json.loads(cpath.read_text()); c['files']['assets/js/meet-next/executive6.js']=hashlib.sha256(Path('assets/js/meet-next/executive6.js').read_bytes()).hexdigest(); cpath.write_text(json.dumps(c,indent=2)+'\n')
print('AUTHORED_RC13_MEDIA_SHARE_FORWARD_ONLY')
