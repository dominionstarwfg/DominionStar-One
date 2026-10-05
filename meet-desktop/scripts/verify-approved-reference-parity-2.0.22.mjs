import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),'utf8');
const pkg=JSON.parse(read('../package.json'));
const bootstrap=read('../ui/runtime-bootstrap.js');
const js=read('../ui/approved-reference-parity.js');
const runtime=read('../ui/runtime-stability.js');
const runtimeCss=read('../ui/runtime-stability.css');
const referenceCss=read('../ui/zoom-screenshot-reference-2.0.41.css');
const features=read('../ui/meeting-features.js');
const share=read('../src/share-service.mjs');
const controller=read('../ui/share-controller.js');
const macOverlay=read('../src/mac-share-presenter-overlay.mjs');
const production=read('../../.github/workflows/rebuild-mac-production.yml');
const qa=read('../../.github/workflows/rebuild-mac-qa-certify.yml');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=22))),'Approved reference parity applies to 2.0.22+.');
assert.ok(pkg.scripts.verify.includes('verify-approved-reference-parity-2.0.22.mjs'),'Package verification must include the approved-reference source gate.');

// Approved reference is a helper under the minimal runtime bootstrap, not a visual authority chain.
assert.ok(bootstrap.includes("loadScript('./approved-reference-parity.js'"),'Approved-reference behavior helper must load from runtime bootstrap.');
for(const retired of ['zoom-adaptive-parity.js','zoom-adaptive-parity.css','physical-mac-repair.js','rejected-build-repair-2.0.40.css']){
  assert.ok(!bootstrap.includes(retired),`Approved reference must not depend on retired layer: ${retired}`);
}

const participantOrder="['roomMic','roomCamera','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomMore','roomExitButton']";
const hostOrder="['roomMic','roomCamera','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare','roomHostTools','roomMore','roomExitButton']";
assert.ok(js.includes(`const TOOLBAR_ORDER=${participantOrder}`),'Participant toolbar approved order is missing.');
assert.ok(js.includes(`const HOST_TOOLBAR_ORDER=${hostOrder}`),'Host toolbar approved order is missing.');
assert.ok(runtime.includes('function ensureToolbarZones()'),'Canonical runtime must own stable toolbar zoning.');
assert.ok(runtime.includes("footer.dataset.dsRuntimeToolbarZones='1'"),'Toolbar zoning must be committed explicitly.');
assert.ok(runtimeCss.includes('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important'),'Toolbar must keep independent left/center/right regions.');
assert.ok(runtimeCss.includes('>.ds-runtime-toolbar-left')&&runtimeCss.includes('>.ds-runtime-toolbar-center')&&runtimeCss.includes('>.ds-runtime-toolbar-right'),'All three toolbar regions need canonical CSS authority.');

// Reaction label and dedicated Raise Hand remain single-owner.
assert.ok(js.includes('function syncReactionLabel()')&&js.includes("setText(label,'React')"),'Approved reference must stabilize the real React label.');
assert.ok(js.includes("button.id='roomRaiseHand'")&&js.includes('DominionMeetingFeatures?.toggleRaiseHand?.()'),'Dedicated Raise Hand control must use the real hand-state authority.');
assert.ok(features.includes("const button=q('#roomReactions'),dedicatedHand=q('#roomRaiseHand')"),'Meeting features must detect dedicated Raise Hand.');
assert.ok(features.includes("if(dedicatedHand){")&&features.includes("button.classList.remove('hand-raised')"),'Legacy reaction hand decoration must stand down.');
assert.ok(runtimeCss.includes('.ds-reaction-tray>.ds-raise-hand{display:none!important}'),'Reaction tray must not reintroduce duplicate Raise Hand.');

// Approved-reference reconciliation is manual/event-driven on desktop.
assert.ok(js.includes("version:'2.0.53-manual-desktop-reference'"),'Approved reference must remain the manual desktop helper.');
assert.ok(js.includes("const backgroundEnabled=!Boolean(window.dominionDesktop);")&&js.includes('if(backgroundEnabled){'),'Desktop approved reference must not run autonomous reconciliation.');
assert.ok(js.includes('let syncQueued=false')&&js.includes('function requestSync()')&&js.includes('if(syncQueued)return;'),'Reference sync must remain coalesced.');
assert.ok(!js.includes('footer.append(control)'),'Approved reference must not reorder canonical toolbar DOM nodes.');

// Clean Chat navigation and direct-message target selection.
assert.ok(js.includes("setAttr(recipientRow,'aria-hidden','true')"),'Legacy To row must be removed from visible Chat chrome.');
assert.ok(js.includes('ds-approved-chat-target-menu'),'Direct-message target selection must remain functional.');
assert.ok(js.includes("setText(newChat,'＋ New chat')")&&js.includes("setText(everyone,'Everyone')"),'Approved Chat navigation must expose New chat and Everyone.');
assert.ok(js.includes('stopImmediatePropagation();openChatTargetMenu(newChat)'),'New chat must be owned by the final capture-phase authority.');

// Filmstrip reference remains a helper marker; final visual scale comes from the final reference stylesheet/runtime.
assert.ok(js.includes("setData(dock,'approvedFilmstrip','1')"),'Approved floating video filmstrip marker is missing.');
assert.ok(runtime.includes("dock.dataset.dsRuntimeDockMode=userPositioned?'user':compact?'top':'right'")&&runtime.includes("dock.style.setProperty('right','14px','important')"),'Canonical runtime must preserve the right-side participant video filmstrip on normal desktop geometry.');
assert.ok(macOverlay.includes("function shouldShowVideoWindow(){return videoLayout!=='hide'&&presenterParticipantCount()>=2;}"),'Native presenter filmstrip must remain hidden for solo meetings and start at two participants.');

// Truthful security language only.
assert.ok(js.includes("aria-label','Encrypted media transport'")&&js.includes("<span>Encrypted</span>"),'Header must expose truthful encrypted transport status.');
assert.ok(!js.includes('End-to-end encrypted</span>'),'UI must not claim E2EE before it exists.');

// Screen share remains app-owned and bounded.
assert.ok(share.includes("const systemPickerAvailable=platform==='darwin'&&macMajor>=15"),'macOS system-picker capability must remain diagnostic only.');
assert.ok(share.includes('const nativeSystemPicker=false'),'Apple system picker must remain disabled in the active share path.');
assert.ok(share.includes('configureDisplayMediaHandler(false);'),'App-owned source chooser must initialize the custom display-media handler.');
assert.ok(!share.includes("if(nativeSystemPicker&&status!=='granted')"),'No permission state may replace the approved chooser with the Apple overlay.');
assert.ok(controller.includes("error.code='share_start_timeout'")&&controller.includes('},5000);'),'Share transaction must fail visibly within five seconds.');

for(const workflow of [production,qa]){
  assert.ok(workflow.includes('verify-approved-reference-parity-2.0.22.mjs'),'Workflow is missing the approved-reference source gate.');
  assert.ok(workflow.includes('verify-packaged-approved-reference-2.0.22.mjs'),'Workflow is missing the packaged approved-reference gate.');
}
assert.ok(production.indexOf('Verify packaged approved 3D reference parity')<production.indexOf('Create installable DMG, archive, and checksums'),'Production DMG creation must remain behind approved-reference parity.');
assert.ok(qa.indexOf('Verify packaged approved 3D reference parity')<qa.indexOf('Create clean QA archive'),'QA archive creation must remain behind approved-reference parity.');

console.log('DOMINIONSTAR_APPROVED_REFERENCE_PARITY_2_0_54_OK minimal-bootstrap role-aware-toolbar stable-zones single-owner-react dedicated-raise-hand manual-desktop-reference clean-chat floating-filmstrip truthful-encryption app-owned-share bounded-share release-gated');
