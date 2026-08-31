import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),'utf8');
const pkg=JSON.parse(read('../package.json'));
const auth=read('../ui/auth-password.js');
const js=read('../ui/approved-reference-parity.js');
const css=read('../ui/approved-reference-parity.css');
const runtime=read('../ui/runtime-stability.js');
const runtimeCss=read('../ui/runtime-stability.css');
const adaptive=read('../ui/zoom-adaptive-parity.js');
const features=read('../ui/meeting-features.js');
const share=read('../src/share-service.mjs');
const physical=read('../ui/physical-mac-repair.js');
const production=read('../../.github/workflows/rebuild-mac-production.yml');
const qa=read('../../.github/workflows/rebuild-mac-qa-certify.yml');

assert.equal(pkg.version,'2.0.22','Approved illustration parity candidate must be version 2.0.22.');
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

// Reconciliation must be observer-safe. This gate exists because observing the
// same class/ARIA attributes that sync() writes starved the packaged renderer.
assert.ok(js.includes('let syncQueued=false'),'Approved reference controller must coalesce repeated sync requests.');
assert.ok(js.includes('function requestSync()'),'Approved reference controller is missing its coalesced scheduler.');
assert.ok(js.includes('if(syncQueued)return;'),'Approved reference scheduler must reject duplicate queued frames.');
assert.ok(js.includes("attributeFilter:['hidden']"),'Observer must be limited to meeting visibility rather than self-written class/ARIA state.');
assert.ok(!js.includes("attributeFilter:['hidden','class','aria-pressed']"),'Self-triggering class/aria observer must never return.');
assert.ok(js.includes('timer=setInterval(requestSync,1200)'),'Fallback reconciliation must be bounded and coalesced.');
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
assert.ok(css.includes('.participant-video-dock-head{\n  display:none !important;'),'Video filmstrip must not expose a grip/title-bar drag affordance.');
assert.ok(css.includes('.remote-peer-tile.active-speaker'),'Video filmstrip must visually mark the active speaker.');
assert.ok(css.includes('.dock-grip{\n  display:none !important;'),'Grip affordance must stay removed.');

assert.ok(js.includes("aria-label','Encrypted media transport'"),'Header must expose a truthful encrypted-transport status.');
assert.ok(js.includes("<span>Encrypted</span>"),'Header encrypted status is missing.');
assert.ok(!js.includes('End-to-end encrypted</span>'),'UI must not falsely claim end-to-end encryption before E2EE exists.');

assert.ok(share.includes("const nativeSystemPicker=platform==='darwin'&&macMajor>=15"),'Native macOS picker authority must remain enabled on macOS 15+.');
assert.ok(share.includes('{useSystemPicker:nativeSystemPicker}'),'Display-media handler must retain the native macOS picker.');
const openVerifiedShare=physical.slice(physical.indexOf('async function openVerifiedShare'),physical.indexOf('function syncPersonalChoice'));
assert.ok(openVerifiedShare.includes('DominionShareIntegration'),'Physical Share must delegate to the real native-first integration.');
assert.ok(!openVerifiedShare.includes('listSources'),'Physical Share must not pre-enumerate sources before the native picker.');

for(const workflow of [production,qa]){
  assert.ok(workflow.includes('verify-approved-reference-parity-2.0.22.mjs'),'Workflow is missing the approved-reference source gate.');
  assert.ok(workflow.includes('verify-packaged-approved-reference-2.0.22.mjs'),'Workflow is missing the packaged approved-reference gate.');
}
assert.ok(production.indexOf('Verify packaged approved 3D reference parity')<production.indexOf('Create installable DMG, archive, and checksums'),'Production DMG creation must remain behind approved-reference parity.');
assert.ok(qa.indexOf('Verify packaged approved 3D reference parity')<qa.indexOf('Create clean QA archive'),'QA archive creation must remain behind approved-reference parity.');

console.log('DOMINIONSTAR_APPROVED_REFERENCE_PARITY_2_0_22_OK real-brand truthful-encryption role-aware-toolbar visual-toolbar-order stable-toolbar-zones single-owner-react-label dedicated-raise-hand reaction-only-tray observer-safe idempotent-sync clean-chat race-safe-direct-messages floating-filmstrip active-speaker no-grip native-share-preserved release-gated');
