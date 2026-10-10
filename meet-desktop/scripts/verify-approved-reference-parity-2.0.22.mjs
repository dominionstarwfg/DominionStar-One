import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),'utf8');
const pkg=JSON.parse(read('../package.json'));
const auth=read('../ui/auth-password.js');
const js=read('../ui/approved-reference-parity.js');
const css=read('../ui/approved-reference-parity.css');
const runtime=read('../ui/runtime-stability.js');
const runtimeCss=read('../ui/runtime-stability.css');
const notifications=read('../ui/meeting-notifications.js');
const notificationCss=read('../ui/meeting-notifications.css');
const standard=read('../RELEASE_STANDARD.md');
const adaptive=read('../ui/zoom-adaptive-parity.js');
const features=read('../ui/meeting-features.js');
const share=read('../src/share-service.mjs');
const controller=read('../ui/share-controller.js');
const physical=read('../ui/physical-mac-repair.js');
const rejectionCss=read('../ui/rejected-build-repair-2.0.40.css');
const production=read('../../.github/workflows/rebuild-mac-production.yml');
const qa=read('../../.github/workflows/rebuild-mac-qa-certify.yml');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=22))),'Approved illustration parity applies to 2.0.22 and every later DominionStar Meet candidate.');
assert.ok(pkg.scripts.verify.includes('verify-approved-reference-parity-2.0.22.mjs'),'Package verification must include the approved-reference source gate.');

assert.ok(auth.includes('./approved-reference-parity.css'),'Approved-reference stylesheet is not loaded.');
assert.ok(auth.includes('./approved-reference-parity.js'),'Approved-reference controller is not loaded.');
assert.ok(auth.indexOf('zoom-adaptive-parity.css')<auth.indexOf('approved-reference-parity.css'),'Approved-reference stylesheet must load after adaptive parity.');
assert.ok(auth.includes('script.onload=loadApprovedReference'),'Approved reference must load only after adaptive parity has initialized.');

const participantOrder="['roomMic','roomCamera','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomMore','roomExitButton']";
const hostOrder="['roomMic','roomCamera','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomHostTools','roomMore','roomExitButton']";
assert.ok(js.includes(`const TOOLBAR_ORDER=${participantOrder}`),'Participant toolbar must exclude Host Tools while preserving approved order.');
assert.ok(js.includes(`const HOST_TOOLBAR_ORDER=${hostOrder}`),'Host toolbar does not encode Audio → Video → Participants → Chat → React → Raise hand → Share → Host tools → More → End.');
for(const [id,order] of [['roomMic',10],['roomCamera',20],['roomParticipants',30],['roomChat',40],['roomReactions',50],['roomRaiseHand',60],['roomShare',70],['roomHostTools',80],['roomMore',90],['roomExitButton',100]]){
  assert.ok(css.includes(`#meetingOverlay #${id}{order:${order} !important;}`),`Final CSS visual order is missing for ${id}.`);
}
assert.ok(runtime.includes('function ensureToolbarZones()'),'Final runtime must own stable toolbar zoning.');
assert.ok(runtime.includes("footer.dataset.dsRuntimeToolbarZones='1'"),'Stable toolbar zoning must be explicitly committed before the meeting is considered settled.');
assert.ok(runtimeCss.includes('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important'),'Toolbar must keep independent Audio/Video, meeting-action, and End/Leave regions.');
assert.ok(runtimeCss.includes('>.ds-runtime-toolbar-left')&&runtimeCss.includes('>.ds-runtime-toolbar-center')&&runtimeCss.includes('>.ds-runtime-toolbar-right'),'All three stable toolbar regions must have final CSS authority.');
assert.ok(js.includes("function syncReactionLabel()"),'Final authority must stabilize the real React label.');
assert.ok(js.includes("setText(label,'React')"),'Reaction label must be the real text React, not decorative pseudo-content.');
assert.ok(css.includes('#meetingOverlay #roomReactions .ds-control-label{\n  font-size:12px !important;'),'Real React label must retain readable production typography.');
assert.ok(css.includes("content:none !important"),'Legacy pseudo-label workaround must stay disabled.');
assert.ok(features.includes("const button=q('#roomReactions'),dedicatedHand=q('#roomRaiseHand')"),'Meeting features must detect the dedicated Raise hand authority before decorating Reactions.');
assert.ok(features.includes("if(dedicatedHand){")&&features.includes("button.classList.remove('hand-raised')"),'Legacy hand-state decoration must stand down when the dedicated Raise hand control exists.');
const dedicatedBranch=features.slice(features.indexOf("if(dedicatedHand){"),features.indexOf("}else{",features.indexOf("if(dedicatedHand){")));
assert.ok(!dedicatedBranch.includes("label.textContent"),'Dedicated Raise hand mode must not let legacy meeting features rewrite the React label.');
assert.ok(js.includes("button.id='roomRaiseHand'"),'Dedicated Raise hand control is missing.');
assert.ok(js.includes('DominionMeetingFeatures?.toggleRaiseHand?.()'),'Dedicated Raise hand control is not wired to the real hand-state authority.');
assert.ok(js.includes("menu.querySelector('.reaction-hand-button')"),'Legacy meeting-reaction menu duplicate Raise hand cleanup is missing.');
assert.ok(css.includes('.meeting-reaction-menu .reaction-hand-button'),'CSS must suppress the legacy meeting-reaction duplicate hand action.');
assert.ok(runtimeCss.includes('.ds-reaction-tray>.ds-raise-hand{display:none!important}'),'Physical reaction tray must not reintroduce Raise Hand beside the dedicated toolbar control.');
assert.ok(runtimeCss.includes('.ds-reaction-tray>.ds-reaction-divider'),'Legacy reaction-tray divider must be suppressed with the duplicate hand section.');

// Reconciliation must remain observer-safe.
assert.ok(js.includes('let syncQueued=false'),'Approved reference controller must coalesce repeated sync requests.');
assert.ok(js.includes('function requestSync()'),'Approved reference controller is missing its coalesced scheduler.');
assert.ok(js.includes('if(syncQueued)return;'),'Approved reference scheduler must reject duplicate queued frames.');
assert.ok(js.includes("attributeFilter:['hidden']"),'Observer must be limited to meeting visibility rather than self-written class/ARIA state.');
assert.ok(!js.includes("attributeFilter:['hidden','class','aria-pressed']"),'Self-triggering class/aria observer must never return.');
assert.ok(js.includes("timer=setInterval(()=>{if(!document.hidden&&meetingOpen())requestSync();},6000)"),'Fallback reconciliation must remain slow, bounded, coalesced, meeting-scoped, and suspended while the document is hidden.');
assert.ok(js.includes("setClass(button,'hand-raised',raised)"),'Raise-hand state updates must be idempotent.');
assert.ok(js.includes("setAttr(button,'aria-pressed',raised)"),'Raise-hand ARIA updates must be idempotent.');
assert.ok(!js.includes('footer.append(control)'),'Approved toolbar authority must not reorder DOM nodes.');

assert.ok(js.includes("setAttr(recipientRow,'aria-hidden','true')"),'Legacy To: row is not removed from visible Chat chrome.');
assert.ok(css.includes('#meetingOverlay #meetingChatPanel .meeting-chat-recipient'),'Legacy To: row is not hidden by final CSS authority.');
assert.ok(js.includes('ds-approved-chat-target-menu'),'Direct-message target selection must remain functional without the duplicated To: row.');
assert.ok(js.includes("setText(newChat,'＋ New chat')"),'Approved Chat navigation must expose New chat.');
assert.ok(js.includes("setText(everyone,'Everyone')"),'Approved Chat navigation must expose Everyone.');
assert.ok(js.includes('stopImmediatePropagation();openChatTargetMenu(newChat)'),'New chat must be owned by the final capture-phase authority so adaptive handlers cannot overwrite it.');

assert.ok(adaptive.includes("dock.dataset.dsAdaptiveWholePanelDrag='1'"),'Video panel must retain whole-surface drag authority.');
assert.ok(js.includes("setData(dock,'approvedFilmstrip','1')"),'Approved floating video filmstrip authority is missing.');
assert.ok(css.includes('.participant-video-dock-head{\n  height:34px !important;')&&css.includes('.participant-video-dock-modes')&&css.includes('[data-panel-mode="strip"]'),'Video filmstrip must expose the compact layout-control bar required for speaker/strip/gallery/hide behavior.');
assert.ok(css.includes('.remote-peer-tile.active-speaker'),'Video filmstrip must visually mark the active speaker.');
assert.ok(css.includes('.dock-grip{\n  display:none !important;'),'Grip affordance must stay removed.');
assert.ok(/DOMINIONSTAR MEET — REFINED LIKE ZOOM \(FINAL\)/i.test(standard),'Release standard must name the single approved meeting illustration.');
assert.ok(/Do not substitute an older concept, alternate mockup, generated variation, or memory/i.test(standard),'Release standard must forbid alternate visual references.');

assert.ok(css.includes('scrollbar-width:none !important')&&css.includes('.participant-video-dock-body::-webkit-scrollbar'),'Approved participant strip must scroll without a visible scrollbar.');
assert.ok(css.includes('.remote-peer-tile:hover .participant-video-hover-actions')&&css.includes('opacity:0 !important')&&css.includes('pointer-events:none !important'),'Participant-tile actions must remain hover/focus-only.');
assert.ok(runtime.includes("const visibleRows=Math.min(5,count);")&&runtime.includes("body.style.setProperty('overflow-y',count>5?'auto':'hidden','important');"),'Approved participant strip must show up to five rows and scroll internally after five.');
assert.ok(runtime.includes("dock.dataset.dsRuntimeDockMode=userPositioned?'user':'right'")&&runtime.includes("dock.dataset.anchor='right';dock.dataset.orientation='vertical'"),'Approved participant strip must default to the right-side vertical position.');
assert.ok(!runtimeCss.includes('/* 2.0.48 participant-window single-owner contract.'),'Retired 360px Participants-window contract must not coexist with the approved 318px reference.');
assert.ok(runtimeCss.includes('/* 2.0.49 participant reference lock: compact Mac floating window. */')&&runtimeCss.includes('width:min(318px,calc(100% - 24px))!important'),'Approved Participants width must have a single 318px runtime contract.');
assert.ok(!css.includes('@media(max-width:680px){\n  #meetingOverlay #participantVideoDock'),'Approved reference must not automatically move the default participant strip to the top on narrow windows.');

assert.ok(runtime.includes("const SURFACE_GEOMETRY_KEY='ds_meet_floating_surface_geometry_v1'"),'Floating meeting windows must persist user geometry.');
assert.ok(runtime.includes('function writeSurfaceGeometry(panel)')&&runtime.includes('function restoreSurfaceGeometry(panel,bodyWidth,bodyHeight)')&&runtime.includes('function clearSurfaceGeometry(panel)'),'Floating meeting windows must save, restore, and reset geometry.');
assert.ok(runtime.includes("const directions=['n','s','e','w','ne','nw','se','sw']"),'Floating meeting windows must resize from edges and corners.');
assert.ok(runtime.includes('installFloatingSurfaceResize(panel);'),'Final runtime must install floating-window resize authority.');
assert.ok(runtimeCss.includes('.ds-runtime-resize-handle'),'Floating-window resize handles must ship in final CSS.');
assert.ok(runtimeCss.includes('[data-ds-resize="ne"]')&&runtimeCss.includes('[data-ds-resize="sw"]'),'Edge/corner resize cursors must be present.');

assert.ok(runtime.includes('function installMeetingTopBarAutoHide()'),'Approved top bar must have one idle-hide authority.');
assert.ok(runtime.includes("overlay.dataset.dsRuntimeTopbarHidden='1'")&&runtime.includes("overlay.dataset.dsRuntimeTopbarHidden='0'"),'Approved top bar must expose deterministic hidden/visible states.');
assert.ok(runtimeCss.includes('#meetingOverlay[data-ds-runtime-topbar-hidden="1"] .meeting-head')&&runtimeCss.includes('opacity:0!important')&&runtimeCss.includes('translateY(-8px)'),'Approved top bar must fade/slide away when idle.');
assert.ok(runtimeCss.includes('#meetingOverlay[data-ds-runtime-topbar-hidden="0"] .meeting-head')&&runtimeCss.includes('opacity:1!important'),'Approved top bar must return on pointer activity.');

assert.ok(notifications.includes("toast('Waiting Room',body)")&&notifications.includes("play('waiting')"),'Approved Waiting Room alert must remain visible and audible.');
assert.ok(runtime.includes("if(search)search.hidden=false;"),'Approved Participants search must remain visible at every roster size instead of blinking by count.');
assert.ok(runtime.includes('placeholder="Search participants"'),'Approved Participants search must retain the visible Search participants label.');
assert.ok(runtimeCss.includes('.zoom-participant-search input'),'Participants search styling must remain owned by the final meeting runtime.');
assert.ok(notificationCss.includes('left:50%')&&notificationCss.includes('transform:translateX(-50%)')&&notificationCss.includes('right:auto'),'Approved meeting notification must be top-centered rather than right-edge anchored.');
assert.ok(runtimeCss.includes('#meetingEventToast.meeting-event-toast')&&runtimeCss.includes('left:50%!important')&&runtimeCss.includes('translateX(-50%)!important'),'Final runtime CSS must lock the top-center waiting-room alert geometry.');


assert.ok(js.includes("aria-label','Encrypted media transport'"),'Header must expose a truthful encrypted-transport status.');
assert.ok(js.includes("<span>Encrypted</span>"),'Header encrypted status is missing.');
assert.ok(!js.includes('End-to-end encrypted</span>'),'UI must not falsely claim end-to-end encryption before E2EE exists.');

// 2.0.40 approved-share authority: the user's rejected screenshot establishes
// that the Apple system overlay is not an acceptable pre-share surface. Keep
// capability/TCC diagnostics, but route every active share through the approved
// app-owned chooser and bound capture start.
assert.ok(share.includes("const systemPickerAvailable=platform==='darwin'&&macMajor>=15"),'macOS system-picker capability must remain detectable for diagnostics.');
assert.ok(share.includes('const nativeSystemPicker=false'),'Approved reference requires Apple system picker to remain disabled in the active share path.');
assert.ok(share.includes('function configureDisplayMediaHandler(useSystemPicker)'),'Display-media handler authority is missing.');
assert.ok(share.includes('configureDisplayMediaHandler(false);'),'Approved app-owned source chooser must initialize the custom display-media handler.');
assert.ok(!share.includes("if(nativeSystemPicker&&status!=='granted')"),'No screen-permission state may replace the approved chooser with the rejected Apple overlay.');
assert.ok(share.includes("share:list-sources',async(_event,options={})=>{configureDisplayMediaHandler(false);pendingSelection=null"),'Approved chooser must clear stale source selection before enumeration.');
assert.ok(share.includes("share:select-source',(_event,{sourceId,options={}}={})=>{configureDisplayMediaHandler(false)"),'Approved source selection must force custom capture before getDisplayMedia.');
assert.ok(controller.includes("error.code='share_start_timeout'")&&controller.includes('},5000);'),'Approved share transaction must fail visibly within five seconds instead of loading forever.');
assert.ok(rejectionCss.includes('#participantRoster .ds-participant-media{display:none!important}'),'Approved participant panel must suppress the duplicate legacy media renderer proven by the rejected screenshot.');
const openVerifiedShare=physical.slice(physical.indexOf('async function openVerifiedShare'),physical.indexOf('function syncPersonalChoice'));
assert.ok(openVerifiedShare.includes('DominionShareIntegration'),'Physical Share must delegate to the real permission-aware integration.');
assert.ok(!openVerifiedShare.includes('listSources'),'Physical compatibility code must not pre-enumerate sources before the Share integration owns selection.');

for(const workflow of [production,qa]){
  assert.ok(workflow.includes('verify-approved-reference-parity-2.0.22.mjs'),'Workflow is missing the approved-reference source gate.');
  assert.ok(workflow.includes('verify-packaged-approved-reference-2.0.22.mjs'),'Workflow is missing the packaged approved-reference gate.');
}
assert.ok(production.indexOf('Verify packaged approved 3D reference parity')<production.indexOf('Create installable DMG, archive, and checksums'),'Production DMG creation must remain behind approved-reference parity.');
assert.ok(qa.indexOf('Verify packaged approved 3D reference parity')<qa.indexOf('Create clean QA archive'),'QA archive creation must remain behind approved-reference parity.');

console.log('DOMINIONSTAR_APPROVED_REFERENCE_PARITY_2_0_22_OK real-brand truthful-encryption role-aware-toolbar visual-toolbar-order stable-toolbar-zones single-owner-react-label dedicated-raise-hand reaction-only-tray observer-safe idempotent-sync clean-chat race-safe-direct-messages single-approved-ref single-318-participants-contract right-filmstrip no-auto-top-reflow five-visible hidden-scrollbar hover-controls floating-window-memory edge-corner-resize topbar-idle-fade waiting-room-alert top-center-alert stable-participant-search floating-filmstrip active-speaker no-grip custom-only-preshare no-apple-overlay bounded-share-start duplicate-participant-media-suppressed release-gated');
