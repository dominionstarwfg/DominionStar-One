import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const pkg=JSON.parse(read('package.json'));
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const participants=read('ui/zoom-participants-reference-2.0.41.js');
const video=read('ui/mac-share-video.js');
const videoCss=read('ui/mac-share-video.css');
const presenter=read('src/mac-share-presenter-overlay.mjs');
const adaptive=read('ui/zoom-adaptive-parity.js');
const participantControls=read('ui/participant-controls.js');
const physicalAcceptance=read('ui/zoom-physical-acceptance.js');
const appSource=read('ui/app.js');
const meetingParity=read('ui/meeting-parity.js');
const shareController=read('ui/share-controller.js');
const presenterVideoSource=read('ui/mac-share-video.js');
const preloadSource=read('src/preload.cjs');
const shareIntegrationSource=read('ui/share-integration.js');
const diagnosticsSource=read('ui/physical-diagnostics.js');
const mainSource=read('src/main.mjs');
const indexSource=read('ui/index.html');

assert(pkg.version==='2.0.52','package version is not 2.0.52');

assert(!runtime.includes("search.hidden=count<7"),'Runtime stability still hides participant search below seven people.');
assert(!runtime.includes("search.className='zoom-participant-search'"),'Runtime stability still creates a second participant search authority.');
assert(runtime.includes('Participants search has one owner: DominionZoomParticipantsReference2041.'),'Single participant-search ownership marker is missing.');
assert(runtime.includes("if(title&&title.textContent!==titleText)title.textContent=titleText"),'Runtime participant title is not idempotent.');

assert(participants.includes("version:'2.0.52-idempotent-participants'"),'Idempotent participant authority version is missing.');
assert(participants.includes("if(head&&head.textContent!==titleText)head.textContent=titleText"),'Participant title still rewrites every sync.');
assert(participants.includes("if(row.hidden!==shouldHide)row.hidden=shouldHide"),'Participant search filtering still rewrites hidden state every sync.');
assert(participants.includes("rosterObserver.observe(roster,{subtree:true,childList:true,attributes:true,attributeFilter:['data-participant-role','data-participant-name','data-participant-self','class']}"),'Participant observer still watches its own search/filter hidden mutations.');
assert(!participants.includes("observer.observe(observedRoot,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden'"),'Broad self-observing participant MutationObserver is still active.');
assert(runtime.includes("const self=row.dataset.participantSelf==='1'||row.dataset.dsAdaptiveSelf==='1'||/\\byou\\b|\\bme\\b/.test(small)"),'Canonical participant priority must recognize explicit self state and You/me labels.');
assert(runtime.includes("row.querySelector('.ds-participant-media .ds-media-state.on,[data-participant-mic].on')"),'Canonical participant priority must detect live microphone state without selector ambiguity.');
assert(participants.includes('if(window.DominionRuntimeStability?.syncParticipantsSurface){window.DominionRuntimeStability.syncParticipantsSurface();return;}'),'Participant reference must delegate roster ordering to runtime stability.');
assert(adaptive.includes('if(window.DominionRuntimeStability?.syncParticipantsSurface)window.DominionRuntimeStability.syncParticipantsSurface();'),'Adaptive parity must delegate roster ordering to runtime stability.');
assert(participantControls.includes('if(desktopSurface){footer?.remove();return;}'),'Desktop participant controls must not recreate the legacy bulk-action strip.');
assert(physicalAcceptance.includes("row.dataset.participantSelf=self?'1':'0';row.dataset.dsAdaptiveSelf=self?'1':'0'"),'Participant normalization must persist self identity before hiding legacy subtitle text.');
assert(physicalAcceptance.includes("const existingMicOn=mic.classList.contains('on'),existingCameraOn=video.classList.contains('on');"),'Participant normalization must preserve last-known media state while transport status is unknown.');
assert(physicalAcceptance.includes("/\\byou\\b|\\bme\\b/.test(small)"),'Participant self detection must recognize You/me before subtitle normalization.');
assert(!appSource.includes("rows.sort((a,b)=>{\\n      const ar=a.dataset.participantRole"),'Snapshot renderer must not sort/move participant rows independently of runtime stability.');
assert(appSource.includes('for(const participant of list)ensureParticipantRow(roster,participant);'),'Snapshot renderer must preserve keyed participant rows without positional reinsertion.');
assert(physicalAcceptance.includes("participantObserver.observe(roster,{childList:true,subtree:false})"),'Participant decorator observer must not observe its own subtree mutations.');
assert(!physicalAcceptance.includes("wrap.innerHTML=`<span data-participant-mic"),'Participant decorator must not rebuild media HTML on every sync.');
assert(meetingParity.includes('syncLocalDockTile(false);syncDockTileActions();'),'Share-active video dock must synchronize the local camera tile before collecting visible tiles.');
assert(shareIntegrationSource.includes('else if(list.length===0){'),'Presenter participant state must not fabricate a duplicate self tile when real participant rows exist.');
assert(presenterVideoSource.includes('if(!out.some(item=>item.self)&&out.length===1){out[0].self=true'),'Presenter video must reuse the single real participant as self instead of adding a duplicate.');
assert(presenterVideoSource.includes('if(fallbackInitials)fallbackInitials.hidden=true;'),'Presenter avatar and initials must be mutually exclusive.');
assert(shareController.includes("const probe=document.createElement('video')"),'Native Mac Pause must be able to freeze the worker stream without a visible share preview.');
assert(diagnosticsSource.includes("version:'1.0.0-physical-recorder'"),'Physical behavior recorder is missing.');
assert(diagnosticsSource.includes("rosterObserver.observe(roster,{subtree:true,childList:true,attributes:true,characterData:true})"),'Diagnostic recorder must observe participant DOM mutations without mutating the roster.');
assert(diagnosticsSource.includes('mutationDelta')&&diagnosticsSource.includes('processMetrics:lastMetrics'),'Diagnostic recorder must capture mutation bursts and process metrics.');
assert(diagnosticsSource.includes("window.addEventListener('dominion:presenter-command-dispatch'"),'Diagnostic recorder must capture presenter command dispatches.');
assert(diagnosticsSource.includes('exportReport'),'Diagnostic recorder export API is missing.');
assert(preloadSource.includes("diagnostics:Object.freeze({")&&preloadSource.includes("system:()=>invoke('diagnostics:system-metrics')")&&preloadSource.includes("export:report=>invoke('diagnostics:export'"),'Preload diagnostic bridge is incomplete.');
assert(mainSource.includes("ipcMain.handle('diagnostics:system-metrics'")&&mainSource.includes("ipcMain.handle('diagnostics:export'"),'Native diagnostic metrics/export handlers are missing.');
assert(indexSource.includes('<script src="./physical-diagnostics.js"></script>'),'Physical diagnostic recorder is not loaded by the packaged renderer.');
assert(physicalAcceptance.includes("addCommand(menu,'Export diagnostic report'"),'Meeting More menu does not expose diagnostic export.');
assert(shareIntegrationSource.includes("'presenter-command-result'"),'Presenter command outcomes are not recorded in the diagnostic timeline.');

assert(runtime.includes("document.createElement('span');traffic.className='ds-panel-traffic'"),'Runtime traffic controls must use a dedicated non-title element.');
assert(participants.includes('<span class="ds-panel-traffic"')&&participants.includes("document.createElement('span');traffic.className='ds-panel-traffic'"),'Participant reference traffic controls must be structurally isolated from title div styling.');
assert(runtimeCss.includes('flex-direction:row!important;'),'Traffic-light horizontal row lock is missing from runtime CSS.');
assert(participants.includes('.ds-panel-traffic{left:10px!important;top:0!important;height:38px!important;display:flex!important;flex-direction:row!important'),'Approved participant traffic-light row lock is missing.');

assert(video.includes("const changed=next!==videoLayout"),'Share video layout does not suppress unchanged layout updates.');
assert(!video.includes("lastSignature='';renderParticipants(true);\n  }\n  q('#videoViewSpeaker')"),'Share video layout still forces a full tile rebuild.');
assert(video.includes("const layoutChanged=setLayoutActive(videoLayout);if(layoutChanged)lastSignature=''"),'Share video state does not gate rerendering by actual layout change.');
assert(video.includes("stack.classList.toggle('is-scrollable',list.length>5)"),'Video panel does not defer internal scrolling until more than five tiles.');
assert(videoCss.includes('.video-stack.is-scrollable{overflow-y:auto'), 'Video panel scroll mode is missing.');
assert(videoCss.includes('overflow-y:hidden;overflow-x:hidden;scrollbar-width:none'), 'Video panel exposes a scrollbar before it is needed.');

assert(presenter.includes('let nativeAnnotationOpen=false;'),'Native annotation authority flag is missing.');
assert(presenter.includes('if(nativeAnnotationOpen){'),'Presenter state does not protect native annotation from renderer heartbeats.');
assert(presenter.includes("delete incoming.companion;delete incoming.companionOpen;"),'Renderer heartbeat can still overwrite native annotation companion state.');
assert(presenter.includes("nativeAnnotationOpen=true;shareState={...shareState,meetingVisible:false,companion:'annotate'"),'Native annotation open state is not authoritative.');

assert(!presenterVideoSource.includes('getUserMedia'),'Floating presenter video must not acquire a second camera stream.');
assert(!presenterVideoSource.includes("stack.textContent=''"),'Floating presenter video must reconcile keyed tiles instead of destroying the stack.');
assert(presenterVideoSource.includes('bridge?.onVideoFrame?.(applyRemoteFrame)'),'Floating presenter video must subscribe to mirrored meeting frames.');
assert(preloadSource.includes("onVideoFrame:callback=>listen('mac-share:video-frame',callback)"),'Presenter preload must expose receive-side video frame subscription.');
assert(shareIntegrationSource.includes("#participantVideoDock .remote-peer-tile,#remoteTileStrip .remote-peer-tile"),'Presenter frame pump must include the local/self dock tile and remote tiles.');

console.log('PASS runtime cleanup 2.0.52 single-order-authority no-roster-render-loop no-duplicate-self live-share-camera native-pause in-app-physical-recorder presenter-command-outcomes single-search-authority no-legacy-bulk persistent-video-tiles single-camera annotation-authority');
