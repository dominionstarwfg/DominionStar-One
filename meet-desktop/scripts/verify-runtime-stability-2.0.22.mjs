import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const runtimeBootstrap=read('ui/runtime-bootstrap.js');
const runtime=read('ui/runtime-stability.js');
const css=read('ui/runtime-stability.css');
const motion=read('ui/runtime-motion.css');
const meetingCss=read('ui/meeting.css');
const meetingFeatures=read('ui/meeting-features.js');
const physical=read('ui/zoom-physical-acceptance.js');
const shareIntegration=read('ui/share-integration.js');
const reaction=read('ui/zoom-reaction-parity.js');
const bridge=read('ui/zoom-contract-bridge.js');
const app=read('ui/app.js');
const avSettings=read('ui/av-settings.js');
const avCss=read('ui/av-settings.css');
const preload=read('src/preload.cjs');
const shareService=read('src/share-service.mjs');
const pkg=JSON.parse(read('package.json'));

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=22))),'Runtime-stability standard applies to 2.0.22+.');

// Minimal startup: Runtime Stability owns desktop geometry; retired layout stacks stay unloaded.
assert.ok(runtimeBootstrap.includes("version:'2.0.54-minimal-runtime-bootstrap'"),'Minimal runtime bootstrap is required.');
assert.ok(runtimeBootstrap.includes("loadStyle('./runtime-stability.css'")&&runtimeBootstrap.includes("loadStyle('./runtime-motion.css'"),'Runtime stability and motion styles must load from runtime bootstrap.');
assert.ok(runtimeBootstrap.includes("loadScript('./runtime-stability.js'"),'Runtime Stability controller must load first.');
for(const retired of ['runtime-layout-fix.css','zoom-adaptive-parity.css','zoom-adaptive-parity.js','physical-mac-repair.css','physical-mac-repair.js','active-share-home-parity-2.0.41.js']){
  assert.ok(!runtimeBootstrap.includes(retired),`Retired runtime layer must stay unloaded: ${retired}`);
}

// Core controls and share routing remain single-owner/event-driven.
assert.ok(runtime.includes("#settingsDialog .modal-close,#settingsDialog button[value=\"cancel\"]"),'Settings close must have a single-click runtime authority.');
assert.ok(runtime.includes("DominionMeetingFeatures?.openReactions?.(reactions)"),'React must open through the final single-click authority.');
assert.ok(runtime.includes("DominionMeetingParity?.openSecurity?.(hostTools)"),'Host Tools must open through the final single-click authority.');
assert.ok(runtime.includes("DominionMeetingParity?.openMore?.(more)"),'More must open through the final single-click authority.');
assert.ok(!runtime.includes('setInterval('),'Final runtime must contain no periodic UI reconciliation timer.');
assert.ok(!runtime.includes("observer.observe(document.body"),'Final runtime must never observe the whole document.');

assert.ok(runtime.includes("event.stopImmediatePropagation();\n      setParticipants"),'Participants click must have one capture-phase authority.');
assert.ok(runtime.includes("event.stopImmediatePropagation();\n      setChat"),'Chat click must have one capture-phase authority.');
assert.ok(runtime.includes("if(show)closeChat(false)")&&runtime.includes("if(show)setParticipants(false)"),'Participants and Chat must close each other synchronously.');
assert.ok(runtime.includes("panel.dataset.dsRuntimeMode='floating'")&&!runtime.includes("panel.dataset.dsRuntimeMode='docked'"),'Participants/Chat must use one floating panel model.');
assert.ok(runtime.includes("installFloatingSurfaceDrag(panel)"),'Floating Participants/Chat must remain draggable.');
assert.ok(runtime.includes('function syncVideoDockGeometry()'),'Runtime must centralize participant-video dock geometry.');
assert.ok(runtime.includes("stage.style.setProperty('right','0px','important')"),'Floating panels must leave the stage full width.');

assert.ok(css.includes('width:var(--ds-runtime-vw,100vw)!important')&&css.includes('height:var(--ds-runtime-vh,100vh)!important'),'Meeting overlay must fill the real Electron viewport.');
assert.ok(css.includes('#meetingOverlay .stage{'),'Runtime stylesheet must own stage geometry.');
assert.ok(motion.includes('@keyframes dsRuntimePanelIn')&&motion.includes('@media(prefers-reduced-motion:reduce)'),'Runtime motion must remain short and accessibility-aware.');

// Snapshot DOM and feature rendering must be stable/idempotent.
assert.ok(runtime.includes("Object.defineProperty(node,'innerHTML'"),'Snapshot DOM guard must intercept repeated roster/queue replacement.');
assert.ok(runtime.includes('if(next===lastRaw)return'),'Identical snapshot markup must be ignored.');
assert.ok(runtime.includes("guardSnapshotHtml(q('#participantRoster'))")&&runtime.includes("guardSnapshotHtml(q('#waitingQueue'))"),'Roster and Waiting Room must be protected from unchanged rebuilds.');
assert.ok(!meetingFeatures.includes('setInterval('),'Meeting Features must remain event-driven.');
assert.ok(meetingFeatures.includes("window.addEventListener('dominion:meeting-ended',resetMeetingFeatureState)"),'Meeting feature state must clear on meeting end.');

// Physical Acceptance remains a helper only; reactions stay canonical.
assert.ok(physical.includes("version:'2.0.53-manual-desktop-acceptance'"),'Physical Acceptance must remain manual on desktop.');
assert.ok(!physical.includes("reactionMenu.className='ds-reaction-tray'")&&!physical.includes('openReactionTray('),'Physical helper must not create a second reaction chooser.');
assert.ok(reaction.includes("observer.observe(layer,{childList:true})")&&!reaction.includes('observer.observe(document.documentElement'),'Reaction observer must stay narrow.');
assert.ok(reaction.includes('const MAX_ACTIVE=72'),'Reaction rendering must remain bounded.');

// Share entry must remain permission-aware without pre-enumeration.
assert.ok(preload.includes("probeAccess:()=>invoke('share:probe-access')"),'Preload may retain the post-failure screen-capture probe.');
assert.ok(!shareIntegration.includes('bridge?.probeAccess?.()'),'Share entry must never enumerate sources before chooser authority.');
assert.ok(shareIntegration.includes("const SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'"),'Successful capture proof must persist.');
assert.ok(shareIntegration.includes('async function grantedScreenPermission()'),'Granted-screen permission helper is missing.');
assert.ok(shareService.includes('function showCompanionWindow'),'Presenter companions must use dedicated windows.');
assert.ok(shareService.includes("showMeetingWindow({focus:false});void sendPresenterCommand('stop',0)"),'Stop Share must retain renderer wake/retry authority.');

// AV controls remain real and readable.
assert.ok(app.includes('id="prejoinBackgrounds"')&&app.includes('Backgrounds & Effects'),'Prejoin must expose Backgrounds & Effects.');
assert.ok(avSettings.includes("input.setAttribute('role','switch')")&&avSettings.includes("slider.className='av-switch'"),'Video Settings booleans must render as switches.');
assert.ok(avCss.includes('.av-toggle-row input:checked + .av-switch'),'Video Settings switches must have a visible active state.');

assert.ok(!bridge.includes('Element.prototype.append=function')&&!bridge.includes('Node.prototype.appendChild=function'),'Contract bridge must not monkey-patch DOM append primitives.');
assert.ok(bridge.includes("observer.observe(document.body,{childList:true})")&&!bridge.includes("observer.observe(document.body,{childList:true,subtree:true})"),'Contract bridge may observe only direct transient body children.');
assert.ok(app.includes('timers.snapshot=setInterval'),'Snapshot transport timer must remain available for live meeting state.');

/* PACKAGED_RUNTIME_MAIN_WINDOW_RPC_LOCK */
const packagedRuntime=read('scripts/verify-packaged-runtime-stability-2.0.22.mjs');
const mainSource=read('src/main.mjs');
assert.ok(
  mainSource.includes('function installQaInteractionBridge(){')&&
  mainSource.includes("async function qaEvaluateInMainWorld(win,expression)")&&
  mainSource.includes("win.webContents.debugger")&&
  mainSource.includes("Runtime.evaluate")&&
  mainSource.includes("win.webContents.sendInputEvent")&&
  mainSource.includes("DOMINIONSTAR_QA_RPC")&&
  mainSource.includes("app.isPackaged||!qaFixtureRequested")&&
  packagedRuntime.includes("DOMINIONSTAR_QA_INTERACTION_FIXTURES:'1'")&&
  packagedRuntime.includes("rpc('evaluate'")&&
  packagedRuntime.includes("rpc('input'")&&
  !packagedRuntime.includes('--remote-debugging-port='),
  'Packaged runtime stability must exercise the real packaged mainWindow through a QA-only Electron bridge using the window-owned debugger for evaluation and sendInputEvent for physical pointer input, without any remote-debugging port.'
);
assert.ok(mainSource.includes("[DOMINIONSTAR_RENDERER_GONE]")&&packagedRuntime.includes('DOMINIONSTAR_RENDERER_GONE'),'A real renderer crash must remain fail-closed during QA RPC automation.');
/* PACKAGED_QA_READY_STATE_AUTHORITY_LOCK */
assert.ok(
  mainSource.includes("const qaInteractionFixtures=app.isPackaged&&qaFixtureRequested;")&&
  mainSource.includes("const value=await qaEvaluateInMainWorld(win,String(request.expression||''));")&&
  !mainSource.includes("if(win.webContents.isLoadingMainFrame())throw new Error('main_window_loading');")&&
  mainSource.includes("if(!qaRendererDomReady)throw new Error('renderer_not_dom_ready');")&&
  mainSource.includes("allowDirectQa:app.getVersion().includes('-')"),
  'Explicit packaged QA mode must wait for Electron dom-ready before renderer evaluation, while the production meeting service keeps direct-QA fallback restricted to prerelease builds.'
);
/* PACKAGED_QA_DOM_READY_HANDSHAKE_LOCK */
assert.ok(
  mainSource.includes('let qaRendererDomReady=false;')&&
  mainSource.includes("mainWindow.webContents.once('dom-ready',()=>{qaRendererDomReady=true;});")&&
  mainSource.includes("if(!qaRendererDomReady)throw new Error('renderer_not_dom_ready');")&&
  mainSource.includes('domReady:qaRendererDomReady')&&
  packagedRuntime.includes('async function waitForMainRenderer(timeout=15000)')&&
  packagedRuntime.includes("lastState?.domReady&&/\\/index\\.html(?:[?#]|$)/i.test")&&
  packagedRuntime.includes("document.readyState==='interactive'||document.readyState==='complete'"),
  'Packaged QA must establish main-process DOM readiness before renderer evaluation so executeJavaScript cannot deadlock during the initial file load.'
);
/* PACKAGED_QA_INTERNAL_DEBUGGER_AND_REQUEST_TRACE_LOCK */
assert.ok(
  mainSource.includes('function installQaRequestTrace(win)')&&
  mainSource.includes('qaPendingRequests.set')&&
  mainSource.includes('pendingRequests=[...qaPendingRequests.values()]')&&
  mainSource.includes("dbg.attach('1.3')")&&
  mainSource.includes("dbg.sendCommand('Runtime.evaluate'")&&
  packagedRuntime.includes('Packaged index.html never completed its normal load lifecycle.'),
  'QA must diagnose any unfinished packaged page load while evaluating the real renderer through the window-owned Electron debugger.'
);
/* STARTUP_MUTATION_OBSERVER_STARVATION_LOCK */
const personalRoomSource=read('ui/personal-room.js');
const scheduleSource=read('ui/schedule-controller.js');
assert.ok(
  personalRoomSource.includes('let homeRefreshTimer=0,homeRefreshRunning=false,homeRefreshPending=false;')&&
  personalRoomSource.includes('const observer=new MutationObserver(()=>scheduleHomeRefresh(32))')&&
  !personalRoomSource.includes('MutationObserver(()=>queueMicrotask(requestHomeRefresh))')&&
  scheduleSource.includes("refreshPromise:null")&&
  scheduleSource.includes('const scheduleObservedRefresh=()=>')&&
  scheduleSource.includes('const observer=new MutationObserver(scheduleObservedRefresh)'),
  'Startup DOM observers must be bounded and coalesced so Personal Room and Schedule cannot create a MutationObserver/microtask starvation loop during packaged renderer boot.'
);
/* AV_CARET_MUTATION_OBSERVER_STARVATION_LOCK */
assert.ok(
  avSettings.includes("version:'1.1.0-full-hd-local-effects'")&&
  avSettings.includes('let quickMenuSyncTimer=0;')&&
  avSettings.includes('const scheduleQuickMenuInstall=()=>')&&
  avSettings.includes('const observer=new MutationObserver(scheduleQuickMenuInstall)')&&
  avSettings.includes("caret.replaceChildren(span);")&&
  !avSettings.includes("const observer=new MutationObserver(()=>installMeetingQuickMenus(media))")&&
  !avSettings.includes("caret.innerHTML='<span aria-hidden=\"true\">⌃</span>'"),
  'Audio/Video quick-menu observation must be bounded and idempotent so caret rendering cannot create a self-feeding MutationObserver loop that starves the packaged renderer.'
);
console.log('DOMINIONSTAR_RUNTIME_STABILITY_2_0_22_OK event-driven-features single-panel-authority synchronous-click-geometry full-window legacy-grid-removed conflict-free-motion responsive-stage physical-loop-isolated single-owner-share permission-aware-share granted-custom-chooser native-unproven-fallback share-companions left-lane-bounded-reactions direct-menu-observer unchanged-snapshot-suppressed no-runtime-polling');
