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

const presenterVideoSource=read('ui/mac-share-video.js');
assert(!presenterVideoSource.includes('getUserMedia'),'Floating presenter video must not acquire a second camera stream.');
assert(!presenterVideoSource.includes("stack.textContent=''"),'Floating presenter video must reconcile keyed tiles instead of destroying the stack.');
assert(presenterVideoSource.includes('bridge?.onVideoFrame?.(applyRemoteFrame)'),'Floating presenter video must subscribe to mirrored meeting frames.');
const preloadSource=read('src/preload.cjs');
assert(preloadSource.includes("onVideoFrame:callback=>listen('mac-share:video-frame',callback)"),'Presenter preload must expose receive-side video frame subscription.');
const shareIntegrationSource=read('ui/share-integration.js');
assert(shareIntegrationSource.includes("#participantVideoDock .remote-peer-tile,#remoteTileStrip .remote-peer-tile"),'Presenter frame pump must include the local/self dock tile and remote tiles.');

console.log('PASS runtime cleanup 2.0.52 single-order-authority single-search-authority no-legacy-bulk persistent-video-tiles single-camera annotation-authority');
