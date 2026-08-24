import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const meetHtml = read('meet/index.html');
const executive = read('assets/js/meet-next/executive6.js');
const illustration = read('assets/js/meet/illustration-ui-parity.js');
const shareView = read('assets/js/meet/share-view-controls.js');
const operationBootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const desktopPreload = read('desktop 2/src/preload.cjs');
const presenterHtml = read('desktop 2/src/presenter-toolbar.html');
const presenterJs = read('desktop 2/src/presenter-toolbar.js');
const desktopMain = read('desktop 2/src/main-v2.mjs');
const presenterParity = read('desktop 2/src/presenter-command-parity.mjs');

const matches = (source, re) => [...source.matchAll(re)];
const duplicates = values => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value, count]) => `${value} x${count}`);
};
const countText = (source, needle) => source.split(needle).length - 1;

// 1) DOM identity: duplicate IDs are the fastest route to controls binding to
// the wrong node. The source document must have exactly one owner for every ID.
const htmlIds = matches(meetHtml, /\bid="([^"]+)"/g).map(match => match[1]);
assert.deepEqual(duplicates(htmlIds), [], 'Meet HTML contains duplicate element IDs.');
for (const id of ['meetingToolbar','shareStatusBar','sharePresenterControls','deviceMenu','participantsPanel','chatPanel']) {
  assert.equal(htmlIds.filter(value => value === id).length, 1, `${id} must exist exactly once.`);
}

// 2) Normal toolbar: each base control has one DOM owner. Desktop parity may
// hide/relabel/reorder controls, but it must never clone a second copy.
const baseToolbarIds = [
  'micBtn','micMenuBtn','camBtn','camMenuBtn','participantsBtn','chatBtn','shareBtn','reactionBtn',
  'raiseHandBtn','transcribeBtn','meetingIntelligenceBtn','hostToolsBtn','moreBtn','leaveBtn'
];
for (const id of baseToolbarIds) {
  assert.equal(htmlIds.filter(value => value === id).length, 1, `Normal toolbar control ${id} must have exactly one source owner.`);
}
assert(illustration.includes("if(window.DominionIllustrationUiParity)return"), 'Desktop illustration parity must be single-install/idempotent.');
assert(illustration.includes("const primarySecondaryIds=['raiseHandBtn','transcribeBtn','meetingIntelligenceBtn']"), 'Secondary toolbar actions must have one explicit source list.');
assert(illustration.includes('#meetingToolbar .ds-illustration-secondary{display:none!important}'), 'Desktop secondary actions must not remain duplicated on the primary toolbar.');
assert(illustration.includes("let button=$('recordBtn')") && illustration.includes('if(!button){'), 'Record must reuse an existing control instead of cloning another one.');
assert.equal(countText(illustration, "button.id='recordBtn'"), 1, 'Record must have one creation site.');
assert(illustration.includes("toolbar.insertBefore(button,reaction||moreBtn||leaveBtn||null)"), 'Record must occupy one approved primary position before Reactions.');
assert(illustration.includes("if(toolbar&&record&&reaction&&record.nextElementSibling!==reaction)toolbar.insertBefore(record,reaction)"), 'Record order repair must move the same node, not clone it.');
assert(illustration.includes("label.textContent='Security'"), 'Desktop host authority must be represented by the single Security control.');
assert(illustration.includes("toolbar.insertBefore(hostToolsBtn,participants)"), 'Security must reuse Host Tools and move the same node before Participants.');
assert(illustration.includes("const exists=[...deviceMenu.querySelectorAll('button')].some"), 'More-menu secondary actions must check for an existing action before insertion.');
assert(illustration.includes('if(exists)return;'), 'More-menu duplicate guard is missing.');

// 3) Web presentation toolbar: local presenter and remote viewer actions are
// mutually exclusive so Share/New Share cannot appear as duplicate controls.
for (const id of ['shareMicBtn','shareCamBtn','shareParticipantsBtn','shareChatBtn','shareReactionBtn','shareTopBtn','pauseShareBtn','newShareBtn','shareMoreBtn','stopShareBtn']) {
  assert.equal(htmlIds.filter(value => value === id).length, 1, `Web share toolbar control ${id} must exist exactly once.`);
}
assert(meetHtml.includes('id="shareTopBtn" class="remote-share-only"'), 'Viewer Share action must remain remote-only.');
for (const id of ['pauseShareBtn','newShareBtn','stopShareBtn']) {
  assert(new RegExp(`id="${id}"[^>]*class="[^"]*local-share-only`).test(meetHtml), `${id} must remain local-presenter-only.`);
}
assert(executive.includes("querySelectorAll('.local-share-only').forEach(button=>button.hidden=state.sharingParticipantId!=='self')"), 'Local share actions must be hidden for viewers.');
assert(executive.includes("querySelectorAll('.remote-share-only').forEach(button=>button.hidden=state.sharingParticipantId==='self')"), 'Remote-only Share action must be hidden for the local presenter.');
assert(executive.includes("ids.sharePresenterControls.hidden = state.sharingParticipantId!=='self'"), 'Only the presenter may see the web presenter control strip.');

// 4) Native desktop presenter toolbar: every command has one UI owner. More
// owns Reactions/Slide Control; Layout/Annotate/Show Meeting stay direct.
const presenterCommands = matches(presenterHtml, /data-command="([^"]+)"/g).map(match => match[1]);
assert.deepEqual(duplicates(presenterCommands), [], 'Native presenter toolbar contains duplicate data-command owners.');
const directOrder = ['audio','video','participants','chat','new-share','pause','layout','annotate','show-meeting','more','stop'];
let cursor = -1;
for (const command of directOrder) {
  const index = presenterHtml.indexOf(`data-command="${command}"`);
  assert(index > cursor, `Native presenter command ${command} is missing or out of approved order.`);
  cursor = index;
}
assert.equal(presenterCommands.filter(command => command === 'reactions').length, 1, 'Reactions must have one native presenter owner.');
assert(presenterHtml.indexOf('id="presenterMoreMenu"') < presenterHtml.indexOf('data-command="reactions"'), 'Reactions must live under native presenter More.');
assert(!presenterHtml.match(/<div class="controls">[\s\S]*?data-command="reactions"[\s\S]*?<\/div>\s*<\/div>/), 'Reactions must not be duplicated on the direct native presenter bar.');
assert(presenterJs.includes("if(menu&&!menu.querySelector('[data-command=\"slide-control\"]'))"), 'Slide Control dynamic insertion must be idempotent.');
assert(presenterJs.includes("document.querySelectorAll('[data-command]').forEach"), 'Native presenter command binding must attach once to the final command set.');

// 5) Desktop vs web visual authority: native presentation hides the hosted
// share toolbar; browser mode never loads the desktop Operation 2030 bootstrap.
assert(illustration.includes('#shareStatusBar.ds-native-presenter-active{display:none!important}'), 'Desktop hosted share toolbar must be hidden while native presenter controls own the share session.');
assert(illustration.includes("shareStatusBar.classList.toggle('ds-native-presenter-active',localDesktop)"), 'Desktop/native share toolbar ownership toggle is missing.');
assert(shareView.includes("const isDesktop = Boolean(window.dominionDesktop?.isDesktop)"), 'Web share controls must distinguish browser from desktop.');
assert(!shareView.includes("bootstrap.src = '/assets/js/meet/operation-2030-bootstrap.js"), 'Web share controls must not bootstrap the desktop runtime.');

// 6) Script/module duplication: preload and Operation 2030 both use marker
// guards. Every Operation 2030 load marker must be unique.
assert(operationBootstrap.includes('if (window.DominionOperation2030Bootstrap) return;'), 'Operation 2030 must be single-install.');
assert(operationBootstrap.includes('if (loaded.has(marker)) return loaded.get(marker);'), 'Operation 2030 must reuse in-flight module loads.');
assert(operationBootstrap.includes('document.querySelector(`script[${marker}]`)'), 'Operation 2030 must reuse already-present module scripts.');
const bootstrapMarkers = matches(operationBootstrap, /load\([^\n]*?'(data-ds-[^']+)'/g).map(match => match[1]);
assert(bootstrapMarkers.length >= 20, 'Operation 2030 marker audit did not see the expected module set.');
assert.deepEqual(duplicates(bootstrapMarkers), [], 'Operation 2030 contains duplicate module markers.');
assert(desktopPreload.includes('const existing = document.querySelector(`script[${marker}]`)'), 'Desktop preload must reuse existing injected scripts.');
assert.equal(countText(desktopPreload, "'/assets/js/meet/operation-2030-bootstrap.js?v=13-clean-desktop-runtime'"), 1, 'Desktop preload must have one Operation 2030 injection site.');
assert.equal(countText(desktopPreload, "'/assets/js/meet/illustration-ui-parity.js?v=1-final-ui-blueprint'"), 1, 'Desktop preload must have one illustration parity injection site.');

// 7) IPC duplicate-fire protection: two listeners intentionally share the
// presenter channel, but they must own disjoint command sets. An overlap would
// execute one toolbar click twice and is therefore a release blocker.
const presenterRouterNeedle = "ipcMain.on('desktop:presenter-command'";
assert(desktopMain.includes(presenterRouterNeedle), 'Main presenter command router is missing.');
assert(presenterParity.includes(presenterRouterNeedle), 'Parity presenter command router is missing.');
const presenterRouterStart = desktopMain.indexOf(presenterRouterNeedle);
const presenterRouterSource = desktopMain.slice(presenterRouterStart, presenterRouterStart + 1800);
const mainAllowedMatch = presenterRouterSource.match(/const allowed = new Set\(\[([^\]]+)\]\);/);
assert(mainAllowedMatch, 'Unable to audit main presenter command allowlist.');
const mainCommands = matches(mainAllowedMatch[1], /'([^']+)'/g).map(match => match[1]);
const parityCommands = ['show-meeting','layout','annotate','slide-control'];
const overlap = mainCommands.filter(command => parityCommands.includes(command));
assert.deepEqual(overlap, [], `Presenter IPC command ownership overlaps and may double-fire: ${overlap.join(', ')}`);
const nativeCommands = new Set([...presenterCommands, 'slide-control']);
for (const command of nativeCommands) {
  if (command === 'more') continue; // More is consumed locally by presenter-toolbar.js.
  assert(mainCommands.includes(command) || parityCommands.includes(command), `Native presenter command ${command} has no command owner.`);
}

console.log(`DOMINIONSTAR_TOOLBAR_DUPLICATE_AUDIT_OK ids=${htmlIds.length} presenterCommands=${presenterCommands.length} bootstrapMarkers=${bootstrapMarkers.length}`);
