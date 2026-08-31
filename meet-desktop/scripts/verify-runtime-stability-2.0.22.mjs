import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const auth=read('ui/auth-password.js');
const runtime=read('ui/runtime-stability.js');
const css=read('ui/runtime-stability.css');
const layoutFix=read('ui/runtime-layout-fix.css');
const motion=read('ui/runtime-motion.css');
const meetingCss=read('ui/meeting.css');
const physical=read('ui/zoom-physical-acceptance.js');
const physicalMac=read('ui/physical-mac-repair.js');
const reaction=read('ui/zoom-reaction-parity.js');
const bridge=read('ui/zoom-contract-bridge.js');
const app=read('ui/app.js');
const pkg=JSON.parse(read('package.json'));

assert.equal(pkg.version,'2.0.22');
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

assert.ok(css.includes('width:var(--ds-runtime-vw,100vw)!important'),'Meeting overlay must fill the real Electron viewport width.');
assert.ok(css.includes('height:var(--ds-runtime-vh,100vh)!important'),'Meeting overlay must fill the real Electron viewport height.');
assert.ok(css.includes('#meetingOverlay .stage{'),'Final runtime must own stage geometry.');
assert.ok(runtime.includes("const wide=bodyWidth>=940"),'Side panels must respond to actual meeting width.');
assert.ok(runtime.includes("panel.dataset.dsRuntimeMode='docked'"),'Desktop-width side surfaces must support docked mode.');
assert.ok(runtime.includes("panel.dataset.dsRuntimeMode='floating'"),'Constrained windows must retain a compact floating fallback.');
assert.ok(runtime.includes("stage.style.setProperty('right',`${reserve}px`,'important')"),'Stage must resize around a docked side panel instead of leaving unused black space.');
assert.ok(css.includes('flex:1 1 auto!important')&&css.includes('#meetingOverlay #participantRoster'),'Participant roster must consume the available panel height.');

// The original meeting stylesheet is intentionally still recognized here so a
// future refactor cannot silently reintroduce its permanent sidebar reservation.
assert.ok(meetingCss.includes('display:grid')&&meetingCss.includes('grid-template-columns:1fr 330px'),'Legacy meeting grid signature changed; review the final runtime layout authority.');
assert.ok(layoutFix.includes('#meetingOverlay .meeting-body'),'Final layout correction must explicitly own the meeting body.');
assert.ok(layoutFix.includes('display:block!important'),'Final meeting body must leave the legacy two-column grid formatting context.');
assert.ok(layoutFix.includes('grid-template-columns:none!important'),'Permanent 330px participant grid column must be removed.');
assert.ok(layoutFix.includes('grid-column:auto!important')&&layoutFix.includes('grid-row:auto!important'),'Stage must not remain pinned to a legacy grid cell.');

// Motion must remain short and compositor-friendly. Panel movement uses the
// individual `translate` property so it cannot fight the runtime's intentional
// transform:none geometry reset.
assert.ok(motion.includes('transition:right .14s'),'Stage resize must use a short transition rather than snap.');
assert.ok(motion.includes('@keyframes dsRuntimePanelIn'),'Participants/Chat must use a short entrance transition.');
assert.ok(motion.includes('translate:10px 0')&&motion.includes('translate:0 0')&&motion.includes('opacity:'),'Panel entrance should use independent translate/opacity rather than the geometry transform property.');
assert.ok(!motion.includes('dsRuntimePanelIn{from{opacity:.72;transform:'),'Panel motion must not compete with the final transform geometry authority.');
assert.ok(motion.includes('.meeting-control:active{transform:scale(.97)}'),'Controls must provide immediate tactile click feedback.');
assert.ok(motion.includes('@media(prefers-reduced-motion:reduce)'),'Motion must respect reduced-motion preferences.');

// Record the exact legacy physical-acceptance failure mechanism so it cannot be
// forgotten. The final runtime isolates this controller after its one-time
// handlers are installed.
assert.ok(physical.includes("participantObserver.observe(roster,{childList:true,subtree:true})"),'Expected legacy physical observer signature changed; review the stability isolation contract.');
assert.ok(physical.includes('wrap.innerHTML='),'Expected legacy media-status mutation changed; review the stability isolation contract.');
assert.ok(runtime.includes('DominionZoomPhysicalAcceptance'),'Final runtime must explicitly isolate the physical acceptance loop.');

// Physical Mac repair itself must no longer add another background storm.
assert.ok(!physicalMac.includes('setInterval('),'Physical-Mac repair must not run a periodic sync timer.');
assert.ok(!physicalMac.includes("observe(document.body,{childList:true,subtree:true})"),'Physical-Mac repair must not observe the whole document.');
assert.ok(physicalMac.includes('async function detectScreenPermission()'),'Screen sharing must have a dedicated permission detector.');
assert.ok(physicalMac.includes("if(reported==='granted')return {ok:true"),'Already-granted Screen Recording must use the fast path.');
assert.ok(physicalMac.includes('desktop.media?.requestScreen?.()'),'Stale macOS permission state must use the bounded real-capture probe.');
assert.ok(physicalMac.includes('Recheck & Share'),'Permission recovery must let the user recheck without rebuilding/restarting unnecessarily.');

// Reaction animation is high-volume UI. It may observe only the dedicated
// reaction layer, never the entire renderer, and it must preserve the user's
// physical Zoom reference: left-side lanes with occasional blossoms.
assert.ok(reaction.includes("observer.observe(layer,{childList:true})"),'Reaction observer must be scoped to direct reaction children.');
assert.ok(!reaction.includes('observer.observe(document.documentElement'),'Reaction parity must not observe the whole document.');
assert.ok(reaction.includes("layer.dataset.dsZoomReactionLane='left'"),'Reactions must use the left-side physical-reference lane.');
assert.ok(reaction.includes("if(!['❤️','👏','👍'].includes(emoji))return"),'Heart/clap/thumb reactions must support selective blossoms.');
assert.ok(reaction.includes('const MAX_ACTIVE=72'),'High-volume reaction rendering must have a bounded active-node budget.');

// Menu compatibility must not monkey-patch global DOM insertion methods.
assert.ok(!bridge.includes('Element.prototype.append=function'),'Contract bridge must not patch Element.prototype.append.');
assert.ok(!bridge.includes('Node.prototype.appendChild=function'),'Contract bridge must not patch Node.prototype.appendChild.');
assert.ok(bridge.includes("observer.observe(document.body,{childList:true})"),'Contract bridge may watch only direct transient body children.');
assert.ok(!bridge.includes("observer.observe(document.body,{childList:true,subtree:true})"),'Contract bridge must not observe the body subtree.');

// Network snapshots may remain periodic, but unchanged snapshot markup is now
// blocked at the roster/queue boundary and cannot become a periodic redraw.
assert.ok(app.includes('timers.snapshot=setInterval'),'Snapshot transport must remain available for live meeting state.');

console.log('DOMINIONSTAR_RUNTIME_STABILITY_2_0_22_OK event-driven single-panel-authority synchronous-click-geometry full-window legacy-grid-removed conflict-free-motion responsive-stage physical-loop-isolated permission-aware-share left-lane-bounded-reactions direct-menu-observer unchanged-snapshot-suppressed no-runtime-polling');