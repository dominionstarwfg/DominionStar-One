import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),'utf8');
const pkg=JSON.parse(read('../package.json'));
const auth=read('../ui/auth-password.js');
const js=read('../ui/approved-reference-parity.js');
const css=read('../ui/approved-reference-parity.css');
const adaptive=read('../ui/zoom-adaptive-parity.js');
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

const expectedOrder="['roomMic','roomCamera','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomHostTools','roomMore','roomExitButton']";
assert.ok(js.includes(expectedOrder),'Toolbar does not encode the approved Audio → Video → Participants → Chat → React → Raise hand → Share → Host tools → More → End order.');
for(const [id,order] of [['roomMic',10],['roomCamera',20],['roomParticipants',30],['roomChat',40],['roomReactions',50],['roomRaiseHand',60],['roomShare',70],['roomHostTools',80],['roomMore',90],['roomExitButton',100]]){
  assert.ok(css.includes(`#meetingOverlay #${id}{order:${order} !important;}`),`Final CSS visual order is missing for ${id}.`);
}
assert.ok(css.includes("content:'React' !important"),'Reaction label must remain visually fixed to React.');
assert.ok(js.includes("button.id='roomRaiseHand'"),'Dedicated Raise hand control is missing.');
assert.ok(js.includes('DominionMeetingFeatures?.toggleRaiseHand?.()'),'Dedicated Raise hand control is not wired to the real hand-state authority.');
assert.ok(js.includes("menu.querySelector('.reaction-hand-button')"),'Reaction tray duplicate Raise hand cleanup is missing.');
assert.ok(css.includes('.meeting-reaction-menu .reaction-hand-button'),'CSS must suppress the legacy duplicate hand action.');

assert.ok(js.includes("recipientRow.setAttribute('aria-hidden','true')"),'Legacy To: row is not removed from visible Chat chrome.');
assert.ok(css.includes('#meetingOverlay #meetingChatPanel .meeting-chat-recipient'),'Legacy To: row is not hidden by final CSS authority.');
assert.ok(js.includes('ds-approved-chat-target-menu'),'Direct-message target selection must remain functional without the duplicated To: row.');
assert.ok(js.includes("newChat.textContent='＋ New chat'"),'Approved Chat navigation must expose New chat.');
assert.ok(js.includes("everyone.textContent='Everyone'"),'Approved Chat navigation must expose Everyone.');
assert.ok(js.includes("stopImmediatePropagation();openChatTargetMenu(newChat)"),'New chat must be owned by the final capture-phase authority so adaptive handlers cannot overwrite it.');

assert.ok(adaptive.includes("dock.dataset.dsAdaptiveWholePanelDrag='1'"),'Video panel must retain whole-surface drag authority.');
assert.ok(js.includes("dock.dataset.approvedFilmstrip='1'"),'Approved floating video filmstrip authority is missing.');
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

console.log('DOMINIONSTAR_APPROVED_REFERENCE_PARITY_2_0_22_OK real-brand truthful-encryption view-existing visual-toolbar-order react-stable dedicated-raise-hand clean-chat race-safe-direct-messages floating-filmstrip active-speaker no-grip native-share-preserved release-gated');
