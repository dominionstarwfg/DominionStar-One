import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const auth=read('ui/auth-password.js');
const runtime=read('ui/runtime-stability.js');
const css=read('ui/runtime-stability.css');
const physical=read('ui/zoom-physical-acceptance.js');
const app=read('ui/app.js');
const pkg=JSON.parse(read('package.json'));

assert.equal(pkg.version,'2.0.22');
assert.ok(auth.includes('./runtime-stability.css'),'Runtime-stability stylesheet must be loaded.');
assert.ok(auth.includes('./runtime-stability.js'),'Runtime-stability controller must be loaded.');
assert.ok(auth.indexOf('approved-reference-parity.css')<auth.indexOf('runtime-stability.css'),'Runtime stability must be the final visual authority.');
assert.ok(auth.includes('script.onload=loadRuntimeStability'),'Runtime stability must load after approved-reference parity.');

assert.ok(runtime.includes("event.stopImmediatePropagation();\n      setParticipants"),'Participants click must have a single capture-phase authority.');
assert.ok(runtime.includes("event.stopImmediatePropagation();\n      setChat"),'Chat click must have a single capture-phase authority.');
assert.ok(runtime.includes("if(show)closeChat(false)"),'Opening Participants must close Chat synchronously.');
assert.ok(runtime.includes("if(show)setParticipants(false)"),'Opening Chat must close Participants synchronously.');
assert.ok(runtime.includes("for(const name of ['DominionZoomAdaptiveParity','DominionZoomProductionPolish','DominionApprovedReferenceParity','DominionZoomBehavior','DominionZoomPhysicalAcceptance'])"),'All known periodic layout authorities must be retired by the final runtime.');
assert.ok(runtime.includes('primePhysicalControls()'),'Physical controls must be primed once without restoring their background loop.');
assert.ok(runtime.includes("controller.dispose?.()"),'Physical acceptance observer/timer must be disconnected after priming.');
assert.ok(runtime.includes("meetingObserver.observe(overlay,{attributes:true,attributeFilter:['hidden']})"),'Final runtime observer must be narrowly scoped to meeting visibility.');
assert.ok(!runtime.includes('setInterval('),'Final runtime must be event-driven and contain no periodic reconciliation timer.');
assert.ok(!runtime.includes("observer.observe(document.body"),'Final runtime must never observe the whole document.');

assert.ok(runtime.includes("Object.defineProperty(node,'innerHTML'"),'Snapshot DOM guard must intercept repeated roster/queue replacement.');
assert.ok(runtime.includes('if(next===lastRaw)return'),'Identical snapshot markup must be ignored rather than rebuilt.');
assert.ok(runtime.includes("guardSnapshotHtml(q('#participantRoster'))"),'Participant roster must be protected from unchanged snapshot rebuilds.');
assert.ok(runtime.includes("guardSnapshotHtml(q('#waitingQueue'))"),'Waiting queue must be protected from unchanged snapshot rebuilds.');

assert.ok(css.includes('width:var(--ds-runtime-vw,100vw)!important'),'Meeting overlay must fill the real Electron viewport width.');
assert.ok(css.includes('height:var(--ds-runtime-vh,100vh)!important'),'Meeting overlay must fill the real Electron viewport height.');
assert.ok(css.includes('#meetingOverlay .stage{'),'Final runtime must own stage geometry.');
assert.ok(runtime.includes("const wide=bodyWidth>=940"),'Side panels must respond to actual meeting width.');
assert.ok(runtime.includes("panel.dataset.dsRuntimeMode='docked'"),'Desktop-width side surfaces must support docked mode.');
assert.ok(runtime.includes("panel.dataset.dsRuntimeMode='floating'"),'Constrained windows must retain a compact floating fallback.');
assert.ok(runtime.includes("stage.style.setProperty('right',`${reserve}px`,'important')"),'Stage must resize around a docked side panel instead of leaving unused black space.');
assert.ok(css.includes('flex:1 1 auto!important')&&css.includes('#meetingOverlay #participantRoster'),'Participant roster must consume the available panel height.');

// Record the exact physical failure mechanism so it cannot be forgotten: the
// old physical acceptance observer watches the roster subtree and its media
// decorator rewrites markup inside that subtree. The final runtime must retire
// that controller before live interaction. This gate intentionally recognizes
// the legacy implementation while requiring its isolation.
assert.ok(physical.includes("participantObserver.observe(roster,{childList:true,subtree:true})"),'Expected legacy physical observer signature changed; review the stability isolation contract.');
assert.ok(physical.includes('wrap.innerHTML='),'Expected legacy media-status mutation changed; review the stability isolation contract.');
assert.ok(runtime.includes('DominionZoomPhysicalAcceptance'),'Final runtime must explicitly isolate the physical acceptance loop.');

// Network snapshots may remain periodic, but unchanged snapshot markup is now
// blocked at the roster/queue boundary and cannot become a periodic redraw.
assert.ok(app.includes('timers.snapshot=setInterval'),'Snapshot transport must remain available for live meeting state.');

console.log('DOMINIONSTAR_RUNTIME_STABILITY_2_0_22_OK event-driven single-panel-authority full-window responsive-stage physical-loop-isolated unchanged-snapshot-suppressed no-runtime-polling');