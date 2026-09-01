import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const auth=read('ui/auth-password.js');
const runtime=read('ui/runtime-stability.js');
const css=read('ui/runtime-stability.css');
const layoutFix=read('ui/runtime-layout-fix.css');
const motion=read('ui/runtime-motion.css');
const meetingCss=read('ui/meeting.css');
const meetingFeatures=read('ui/meeting-features.js');
const physical=read('ui/zoom-physical-acceptance.js');
const physicalMac=read('ui/physical-mac-repair.js');
const shareIntegration=read('ui/share-integration.js');
const reaction=read('ui/zoom-reaction-parity.js');
const bridge=read('ui/zoom-contract-bridge.js');
const app=read('ui/app.js');
const avSettings=read('ui/av-settings.js');
const avCss=read('ui/av-settings.css');
const preload=read('src/preload.cjs');
const shareService=read('src/share-service.mjs');
const pkg=JSON.parse(read('package.json'));

assert.equal(pkg.version,'2.0.22');
assert.ok(app.includes('id="prejoinBackgrounds"')&&app.includes('Backgrounds & Effects'),'Prejoin must expose Backgrounds & Effects like Zoom.');
assert.ok(!app.includes('id="mirrorPreview"')&&!app.includes('Mirror my video</span></label>'),'Prejoin must not expose the rejected Mirror checkbox.');
assert.ok(avSettings.includes("input.setAttribute('role','switch')")&&avSettings.includes("slider.className='av-switch'"),'Video Settings boolean preferences must render as slider switches rather than visible checkboxes.');
assert.ok(avCss.includes('.av-toggle-row input:checked + .av-switch')&&avCss.includes('background:#2d8cff'),'Video Settings switches must use a visible active state.');
assert.ok(runtime.includes("#settingsDialog .modal-close,#settingsDialog button[value=\"cancel\"]"),'Settings close must have a single-click final runtime authority.');
assert.ok(preload.includes("probeAccess:()=>invoke('share:probe-access')"),'Preload may retain the narrow post-failure screen-capture diagnostic probe.');
assert.ok(shareService.includes("ipcMain.handle('share:probe-access'")&&shareService.includes("!source.thumbnail?.isEmpty?.()"),'Share authority must retain bounded capability diagnostics for explicit recovery.');
assert.ok(!shareIntegration.includes('bridge?.probeAccess?.()'),'Initial Share must never run the screen-source diagnostic probe before native capture.');
assert.ok(!shareIntegration.includes('async function screenPermissionStatus()'),'Initial Share must never poll TCC status before native capture.');
assert.ok(shareIntegration.includes("const permission=replace||share.snapshot().active?'granted':'unknown';"),'Only an already-active capture may select the compact replacement chooser.');
assert.ok(runtime.includes("DominionMeetingFeatures?.openReactions?.(reactions)"),'React must open through the final single-click authority.');
assert.ok(!physical.includes("reactionMenu.className='ds-reaction-tray'")&&!physical.includes('openReactionTray('),'Retired physical compatibility must not create a second reaction chooser.');
assert.ok(!physical.includes("button.onclick=event=>{event.preventDefault();event.stopPropagation();openReactionTray(button);"),'Retired physical compatibility must not overwrite the final React click authority.');
assert.ok(runtime.includes("DominionMeetingParity?.openSecurity?.(hostTools)"),'Host Tools must open through the final single-click authority.');
assert.ok(runtime.includes("DominionMeetingParity?.openMore?.(more)"),'More must open through the final single-click authority.');

assert.ok(auth.includes('./runtime-stability.css'),'Runtime-stability stylesheet must be loaded.');
assert.ok(auth.includes('./runtime-layout-fix.css'),'Final runtime layout correction must be loaded.');
assert.ok(auth.includes('./runtime-motion.css'),'Low-cost runtime motion authority must be loaded.');
assert.ok(auth.includes('./runtime-stability.js'),'Runtime-stability controller must be loaded.');
assert.ok(auth.indexOf('approved-reference-parity.css')<auth.indexOf('runtime-stability.css'),'Runtime stability must load after approved reference parity.');
assert.ok(auth.indexOf('runtime-stability.css')<auth.indexOf('runtime-layout-fix.css'),'Legacy-grid removal must load after the main runtime stylesheet.');
assert.ok(auth.indexOf('runtime-layout-fix.css')<auth.indexOf('runtime-motion.css'),'Motion authority must load after final layout geometry.');
assert.ok(auth.includes('script.onload=loadRuntimeStability'),'Runtime stability must load after approved-reference parity.');

assert.ok(runtime.includes("event.stopImmediatePropagation();\n      setParticipants"),'Participants click must have a single capture-phase authority.');
assert.ok(runtime.includes("event.stopImmediatePropagation();\n      setChat"),'Chat click must have a single capture-phase authority.');
assert.ok(runtime.includes("if(show)closeChat(false)"),'Opening Participants must close Chat synchronously.');
assert.ok(runtime.includes("if(show)setParticipants(false)"),'Opening Chat must close Participants synchronously.');
const participantSetter=runtime.slice(runtime.indexOf('function setParticipants'),runtime.indexOf('function closeChat'));
const chatSetter=runtime.slice(runtime.indexOf('function setChat'),runtime.indexOf('function layoutSideSurface'));
assert.ok(participantSetter.includes('layoutSideSurface();'),'Participants visibility and responsive geometry must commit in the same click transaction.');
assert.ok(chatSetter.includes('layoutSideSurface();'),'Chat visibility and responsive geometry must commit in the same click transaction.');
assert.ok(!participantSetter.includes('schedule();'),'Participants click must not wait for requestAnimationFrame to acquire final geometry.');
assert.ok(!chatSetter.includes('schedule();'),'Chat click must not wait for requestAnimationFrame to acquire final geometry.');
assert.ok(runtime.includes("for(const name of ['DominionZoomAdaptiveParity','DominionZoomProductionPolish','DominionApprovedReferenceParity','DominionZoomBehavior','DominionZoomPhysicalAcceptance'])"),'All known periodic layout authorities must be retired by the final runtime.');
assert.ok(runtime.includes('primePhysicalControls()'),'Physical controls must be primed once without restoring their background loop.');
assert.ok(runtime.includes('primeLegacyStructure()'),'Legacy structural polish must be primed once rather than on every snapshot.');
assert.ok(runtime.includes('if(legacyPrimed||!meetingOpen())return'),'Legacy structural passes must be one-shot per meeting.');
assert.ok(runtime.includes("controller.dispose?.()"),'Physical acceptance observer/timer must be disconnected after priming.');
assert.ok(runtime.includes("meetingObserver.observe(overlay,{attributes:true,attributeFilter:['hidden']})"),'Final runtime observer must be narrowly scoped to meeting visibility.');
assert.ok(!runtime.includes('setInterval('),'Final runtime must be event-driven and contain no periodic reconciliation timer.');
assert.ok(!runtime.includes("observer.observe(document.body"),'Final runtime must never observe the whole document.');

assert.ok(runtime.includes("Object.defineProperty(node,'innerHTML'"),'Snapshot DOM guard must intercept repeated roster/queue replacement.');
assert.ok(runtime.includes('if(next===lastRaw)return'),'Identical snapshot markup must be ignored rather than rebuilt.');
assert.ok(runtime.includes("guardSnapshotHtml(q('#participantRoster'))"),'Participant roster must be protected from unchanged snapshot rebuilds.');
assert.ok(runtime.includes("guardSnapshotHtml(q('#waitingQueue'))"),'Waiting queue must be protected from unchanged snapshot rebuilds.');
assert.ok(runtime.includes("const dirty=roster.dataset.dsRuntimeSnapshotDirty==='1'||roster.dataset.dsRuntimeDecorated!=='1'"),'Participant media decoration must run only when roster markup changed.');

assert.ok(!meetingFeatures.includes('setInterval('),'Meeting Features must not run a permanent UI polling timer.');
assert.ok(meetingFeatures.includes("version:'1.4.0-zoom-chat-shell'")&&meetingFeatures.includes("runtimeVersion:'2.0.22-event-driven'"),'Meeting Features must preserve API compatibility while exposing the event-driven runtime revision.');
assert.ok(meetingFeatures.includes("window.addEventListener('dominion:meeting-signal',handleSignal)"),'Meeting Features must respond to meeting signals.');
assert.ok(meetingFeatures.includes("window.addEventListener('dominion:meeting-snapshot'"),'Meeting Features must respond to network state changes.');
assert.ok(meetingFeatures.includes("window.addEventListener('dominion:participant-presence',scheduleFeatureDecorations)"),'Participant feature badges must refresh from presence changes.');
assert.ok(meetingFeatures.includes("window.addEventListener('dominion:meeting-ended',resetMeetingFeatureState)"),'Meeting feature state must be explicitly cleared on meeting end.');
assert.ok(meetingFeatures.includes('if(featureFrame)return;featureFrame=requestAnimationFrame(decorateFeatureState)'),'Feature rendering events must coalesce to a single frame.');

assert.ok(css.includes('width:var(--ds-runtime-vw,100vw)!important'),'Meeting overlay must fill the real Electron viewport width.');
assert.ok(css.includes('height:var(--ds-runtime-vh,100vh)!important'),'Meeting overlay must fill the real Electron viewport height.');
assert.ok(css.includes('#meetingOverlay .stage{'),'Final runtime must own stage geometry.');
assert.ok(!runtime.includes("const wide=bodyWidth>=940"),'Participants/Chat must not switch to a forced desktop dock at an arbitrary breakpoint.');
assert.ok(!runtime.includes("panel.dataset.dsRuntimeMode='docked'"),'Participants/Chat must not reserve the right edge used by the participant video dock.');
assert.ok(runtime.includes("panel.dataset.dsRuntimeMode='floating'"),'Participants/Chat must use one floating panel model at every meeting width.');
assert.ok(runtime.includes("installFloatingSurfaceDrag(panel)"),'Floating Participants/Chat must be draggable from their title surface.');
assert.ok(runtime.includes("stage.style.setProperty('right','0px','important')"),'Floating panels must leave the meeting stage at full width.');
assert.ok(css.includes('flex:1 1 auto!important')&&css.includes('#meetingOverlay #participantRoster'),'Participant roster must consume the available panel height.');

assert.ok(meetingCss.includes('display:grid')&&meetingCss.includes('grid-template-columns:1fr 330px'),'Legacy meeting grid signature changed; review the final runtime layout authority.');
assert.ok(layoutFix.includes('#meetingOverlay .meeting-body'),'Final layout correction must explicitly own the meeting body.');
assert.ok(layoutFix.includes('display:block!important'),'Final meeting body must leave the legacy two-column grid formatting context.');
assert.ok(layoutFix.includes('grid-template-columns:none!important'),'Permanent 330px participant grid column must be removed.');
assert.ok(layoutFix.includes('grid-column:auto!important')&&layoutFix.includes('grid-row:auto!important'),'Stage must not remain pinned to a legacy grid cell.');

assert.ok(motion.includes('transition:right .14s'),'Stage resize must use a short transition rather than snap.');
assert.ok(motion.includes('@keyframes dsRuntimePanelIn'),'Participants/Chat must use a short entrance transition.');
assert.ok(motion.includes('translate:10px 0')&&motion.includes('translate:0 0')&&motion.includes('opacity:'),'Panel entrance should use independent translate/opacity rather than the geometry transform property.');
assert.ok(!motion.includes('dsRuntimePanelIn{from{opacity:.72;transform:'),'Panel motion must not compete with the final transform geometry authority.');
assert.ok(motion.includes('.meeting-control:active{transform:scale(.97)}'),'Controls must provide immediate tactile click feedback.');
assert.ok(motion.includes('@media(prefers-reduced-motion:reduce)'),'Motion must respect reduced-motion preferences.');

assert.ok(physical.includes("participantObserver.observe(roster,{childList:true,subtree:true})"),'Expected legacy physical observer signature changed; review the stability isolation contract.');
assert.ok(physical.includes('wrap.innerHTML='),'Expected legacy media-status mutation changed; review the stability isolation contract.');
assert.ok(runtime.includes('DominionZoomPhysicalAcceptance'),'Final runtime must explicitly isolate the physical acceptance loop.');

// Share Screen has one click owner. The physical compatibility layer may expose
// a callable recovery helper, but it must not capture/cancel #roomShare. Initial
// Share is always native-first; diagnostics are post-failure only.
assert.ok(!physicalMac.includes('setInterval('),'Physical-Mac repair must not run a periodic sync timer.');
assert.ok(!physicalMac.includes("observe(document.body,{childList:true,subtree:true})"),'Physical-Mac repair must not observe the whole document.');
assert.ok(physicalMac.includes('async function detectScreenPermission()'),'Physical diagnostics must retain a non-enumerating Screen Recording helper for explicit recovery.');
assert.ok(physicalMac.includes('nativeDecisionRequired:true'),'not-determined/unknown status must defer to the real native capture request.');
assert.ok(!physicalMac.includes('desktop.media?.requestScreen?.()'),'Physical Share compatibility code must never probe desktop sources before the native picker.');
const shareClickBlock=physicalMac.slice(physicalMac.indexOf('function onDocumentClick'),physicalMac.indexOf("document.addEventListener('submit'"));
assert.ok(!shareClickBlock.includes('#roomShare'),'Physical-Mac repair must not intercept the Share Screen button.');
assert.ok(!shareIntegration.includes('async function screenPermissionStatus()'),'The isolated Share integration must not poll TCC before initial capture.');
assert.ok(!shareIntegration.includes('bridge?.probeAccess?.()'),'The isolated Share integration must not enumerate sources before initial capture.');
assert.ok(shareIntegration.includes("const permission=replace||share.snapshot().active?'granted':'unknown';"),'Initial Share must enter with unknown state and process-proven New Share may use granted mode.');
assert.ok(shareIntegration.includes('const entry=await resolveShareEntry(permission)'),'Initial Share must continue directly through the real picker/capture flow.');
assert.ok(shareIntegration.includes('const diagnostic=await desktop?.media?.requestScreen?.()'),'Deep Screen Recording diagnostics must run only in the real capture-failure recovery path.');

assert.ok(reaction.includes("observer.observe(layer,{childList:true})"),'Reaction observer must be scoped to direct reaction children.');
assert.ok(!reaction.includes('observer.observe(document.documentElement'),'Reaction parity must not observe the whole document.');
assert.ok(reaction.includes("layer.dataset.dsZoomReactionLane='left'"),'Reactions must use the left-side physical-reference lane.');
assert.ok(reaction.includes("if(!['❤️','👏','👍'].includes(emoji))return"),'Heart/clap/thumb reactions must support selective blossoms.');
assert.ok(reaction.includes('const MAX_ACTIVE=72'),'High-volume reaction rendering must have a bounded active-node budget.');

assert.ok(!bridge.includes('Element.prototype.append=function'),'Contract bridge must not patch Element.prototype.append.');
assert.ok(!bridge.includes('Node.prototype.appendChild=function'),'Contract bridge must not patch Node.prototype.appendChild.');
assert.ok(bridge.includes("observer.observe(document.body,{childList:true})"),'Contract bridge may watch only direct transient body children.');
assert.ok(!bridge.includes("observer.observe(document.body,{childList:true,subtree:true})"),'Contract bridge must not observe the body subtree.');

assert.ok(app.includes('timers.snapshot=setInterval'),'Snapshot transport must remain available for live meeting state.');

console.log('DOMINIONSTAR_RUNTIME_STABILITY_2_0_22_OK event-driven-features single-panel-authority synchronous-click-geometry full-window legacy-grid-removed conflict-free-motion responsive-stage physical-loop-isolated single-owner-native-share native-first-no-preflight left-lane-bounded-reactions direct-menu-observer unchanged-snapshot-suppressed no-runtime-polling');
