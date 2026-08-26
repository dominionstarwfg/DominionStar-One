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
const presenterPreload = read('desktop 2/src/presenter-preload.cjs');
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

// 4) Native desktop presenter toolbar: each command has exactly one UI owner.
// The approved compact direct bar keeps frequent controls visible and moves
// secondary presentation actions under More so the toolbar stays Zoom-class.
const presenterCommands = matches(presenterHtml, /data-command="([^"]+)"/g).map(match => match[1]);
assert.deepEqual(duplicates(presenterCommands), [], 'Native presenter toolbar contains duplicate data-command owners.');
const barStart = presenterHtml.indexOf('<div class="bar"');
const menuStart = presenterHtml.indexOf('<div id="presenterMoreMenu"');
assert(barStart >= 0 && menuStart > barStart, 'Native presenter toolbar/menu structure is missing.');
const directBar = presenterHtml.slice(barStart, menuStart);
const moreMenu = presenterHtml.slice(menuStart);
const directOrder = ['audio','video','pause','participants','chat','more','stop'];
let cursor = -1;
for (const command of directOrder) {
  const index = directBar.indexOf(`data-command="${command}"`);
  assert(index > cursor, `Native presenter command ${command} is missing or out of approved compact order.`);
  cursor = index;
}
for (const command of ['reactions','new-share','annotate','layout','show-meeting']) {
  assert(!directBar.includes(`data-command="${command}"`), `${command} must not duplicate or lengthen the direct native presenter bar.`);
  assert(moreMenu.includes(`data-command="${command}"`), `${command} must have one owner under native presenter More.`);
}
assert.equal(presenterCommands.filter(command => command === 'reactions').length, 1, 'Reactions must have one native presenter owner.');
assert(!presenterHtml.includes('class="share-rail"'), 'Native presenter must expose one compact toolbar, not a second share rail.');
assert(presenterHtml.includes('class="share-live"') && presenterHtml.includes('You are sharing'), 'Native presenter must retain one sharing indicator.');
assert(presenterHtml.includes('class="share-stop"') && presenterHtml.includes('Stop Share'), 'Stop Share must remain directly visible.');
assert(presenterJs.includes('EXPANDED_WIDTH=610'), 'Native presenter toolbar width must remain compact.');
assert(presenterJs.includes("if(menu&&!menu.querySelector('[data-command=\"slide-control\"]'))"), 'Slide Control dynamic insertion must be idempotent.');
assert(presenterJs.includes("document.querySelectorAll('[data-command]').forEach"), 'Native presenter command binding must attach once to the final command set.');

// 5) Desktop vs web visual authority: native presentation hides the hosted
// share toolbar; browser mode never loads the desktop Operation 2030 bootstrap.
assert(illustration.includes('#shareStatusBar.ds-native-presenter-active{display:none!important}'), 'Desktop hosted share toolbar must be hidden while native presenter controls own the share session.');
assert(illustration.includes("shareStatusBar.classList.toggle('ds-native-presenter-active',localDesktop)"), 'Desktop/native share toolbar ownership toggle is missing.');
assert(shareView.includes("const isDesktop = Boolean(window.dominionDesktop?.isDesktop)"), 'Web share controls must distinguish browser from desktop.');
assert(!shareView.includes("bootstrap.src = '/assets/js/meet/operation-2030-bootstrap.js"), 'Web share controls must not bootstrap the desktop runtime.');
assert(!shareView.includes('meeting-identity-bridge.js'), 'Retired browser identity bridge must not be injected by share-view controls.');

// 6) Script/module duplication: one Operation 2030 object owns advanced desktop
// modules. Core startup is bounded; heavy feature groups stay lazy and every
// script marker must remain unique regardless of source formatting.
assert(/if\s*\(\s*window\.DominionOperation2030Bootstrap\s*\)\s*return/.test(operationBootstrap), 'Operation 2030 must be single-install.');
assert(/if\s*\(\s*loaded\.has\(marker\)\s*\)\s*return\s+loaded\.get\(marker\)/.test(operationBootstrap), 'Operation 2030 must reuse in-flight module loads.');
assert(operationBootstrap.includes('document.querySelector(`script[${marker}]`)'), 'Operation 2030 must reuse already-present module scripts.');
assert(operationBootstrap.includes("version:'3.0.0-clean-lazy-runtime'"), 'Operation 2030 must use the cleaned lazy runtime.');
assert.equal((operationBootstrap.match(/const core=\[/g)||[]).length,1,'Operation 2030 must expose one bounded core startup group.');
assert(operationBootstrap.includes('loadMediaEnhancements')&&operationBootstrap.includes('loadPresentationTools'),'Advanced media and presentation tools must remain lazy.');
assert(!operationBootstrap.includes('meeting-identity-settings')&&!operationBootstrap.includes('meeting-identity-bridge')&&!operationBootstrap.includes('media-effect-safety'),'Retired identity/effect override modules must not return.');
const bootstrapMarkers = matches(operationBootstrap, /load\([^\n]*?'(data-ds-[^']+)'/g).map(match => match[1]);
assert(bootstrapMarkers.length >= 18, 'Operation 2030 marker audit did not see the cleaned module set.');
assert.deepEqual(duplicates(bootstrapMarkers), [], 'Operation 2030 contains duplicate module markers.');
assert(desktopPreload.includes('const existing = document.querySelector(`script[${marker}]`)'), 'Desktop preload must reuse existing injected scripts.');
assert.equal(countText(desktopPreload, "'/assets/js/meet/operation-2030-bootstrap.js?v=13-clean-desktop-runtime'"), 1, 'Desktop preload must have one Operation 2030 injection site.');
assert.equal(countText(desktopPreload, "'/assets/js/meet/illustration-ui-parity.js?v=1-final-ui-blueprint'"), 1, 'Desktop preload must have one illustration parity injection site.');

// 7) IPC duplicate-fire protection: core presenter actions and specialist
// parity actions must enter native code through separate channels. This avoids
// duplicate listener ownership entirely rather than merely keeping allowlists
// disjoint on one shared channel.
const coreChannel = 'desktop:presenter-command';
const parityChannel = 'desktop:presenter-parity-command';
assert(desktopMain.includes(`ipcMain.on('${coreChannel}'`), 'Main core presenter command router is missing.');
assert(!desktopMain.includes(`ipcMain.on('${parityChannel}'`), 'Main core module must not own the parity presenter channel.');
assert(presenterParity.includes(`ipcMain.on('${parityChannel}'`), 'Dedicated parity presenter command router is missing.');
assert(!presenterParity.includes(`ipcMain.on('${coreChannel}'`), 'Parity module must not register a second core presenter command listener.');
assert(presenterPreload.includes("const parityCommands=new Set(['layout','annotate','show-meeting','slide-control'])"), 'Presenter preload must declare the dedicated parity command set.');
assert(presenterPreload.includes("parityCommands.has(command)?'desktop:presenter-parity-command':'desktop:presenter-command'"), 'Presenter preload must route parity and core controls onto separate IPC channels.');

const presenterRouterStart = desktopMain.indexOf(`ipcMain.on('${coreChannel}'`);
const presenterRouterSource = desktopMain.slice(presenterRouterStart, presenterRouterStart + 1800);
const mainAllowedMatch = presenterRouterSource.match(/const allowed = new Set\(\[([^\]]+)\]\);/);
assert(mainAllowedMatch, 'Unable to audit main presenter command allowlist.');
const mainCommands = matches(mainAllowedMatch[1], /'([^']+)'/g).map(match => match[1]);
const parityCommands = ['show-meeting','layout','annotate','slide-control'];
const overlap = mainCommands.filter(command => parityCommands.includes(command));
assert.deepEqual(overlap, [], `Presenter command ownership overlaps across core/parity channels: ${overlap.join(', ')}`);
const nativeCommands = new Set([...presenterCommands, 'slide-control']);
for (const command of nativeCommands) {
  if (command === 'more') continue;
  assert(mainCommands.includes(command) || parityCommands.includes(command), `Native presenter command ${command} has no command owner.`);
}

console.log(`DOMINIONSTAR_TOOLBAR_DUPLICATE_AUDIT_OK ids=${htmlIds.length} presenterCommands=${presenterCommands.length} bootstrapMarkers=${bootstrapMarkers.length} ipcChannels=2-separated compactPresenter=true`);
