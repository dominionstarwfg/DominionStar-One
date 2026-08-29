import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const exists = rel => fs.existsSync(new URL(`../../${rel}`, import.meta.url));
const meetHtml = read('meet/index.html');
const presenter = read('desktop 2/src/presenter-toolbar.html');
const presenterJs = read('desktop 2/src/presenter-toolbar.js');
const dockLayout = read('assets/js/meet/dock-layout-v2.js');
const dockResize = read('assets/js/meet/dock-resize-quality.js');
const illustration = read('assets/js/meet/illustration-ui-parity.js');
const localRecording = read('assets/js/meet/local-recording.js');
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const macPkgBuilder = read('desktop 2/scripts/build-macos-pkg.sh');

const barStart=presenter.indexOf('<div class="bar"');
const menuStart=presenter.indexOf('<div id="presenterMoreMenu"');
assert(barStart>=0&&menuStart>barStart,'Approved presenter toolbar/menu structure is missing.');
const directBar=presenter.slice(barStart,menuStart);
const moreMenu=presenter.slice(menuStart);

// Approved illustration: one compact Zoom-class presenter toolbar. Keep only
// frequent controls directly visible; secondary presentation tools live in More.
const directPresenterOrder = ['audio','video','pause','participants','chat','more','stop'];
let cursor = -1;
for (const command of directPresenterOrder) {
  const index = directBar.indexOf(`data-command="${command}"`);
  assert(index > cursor, `Approved compact presenter toolbar must expose ${command} directly in the approved order.`);
  cursor = index;
}
for(const command of ['new-share','annotate','layout','show-meeting']){
  assert(!directBar.includes(`data-command="${command}"`),`${command} must not lengthen the primary presenter toolbar.`);
  assert(moreMenu.includes(`data-command="${command}"`),`${command} must remain available under More.`);
}
assert(!presenter.includes('class="share-rail"'),'Approved illustration requires one toolbar, not a second share rail.');
assert(directBar.includes('class="share-live"')&&directBar.includes('You are sharing'),'Primary toolbar must retain one compact sharing indicator.');
assert(directBar.includes('class="share-stop"')&&directBar.includes('Stop Share'),'Stop Share must remain directly visible and red.');
assert(presenterJs.includes('EXPANDED_WIDTH=610'), 'Presenter window must match the approved compact control hierarchy.');
assert(presenterJs.includes('COLLAPSED_WIDTH=230'), 'Auto-hidden presenter state must remain compact.');
assert(presenterJs.includes("label.textContent=sharePaused?'Resume':'Pause'"), 'Pause must visibly become Resume.');

for (const id of ['participantsBtn','chatBtn','shareBtn','reactionBtn','moreBtn','leaveBtn']) {
  assert(meetHtml.includes(`id="${id}"`), `Normal meeting toolbar must retain ${id}.`);
}
assert(illustration.includes("label.textContent='Security'"), 'Host Tools must present as Security on the approved primary bar.');
assert(illustration.includes("label.textContent=isHost?'End':'Leave'"), 'Host must see End while attendee/co-host sees Leave.');
assert(illustration.includes("button.id='recordBtn'") && illustration.includes("toolbar.insertBefore(button,reaction||moreBtn||leaveBtn||null)"), 'Record must be inserted directly before Reactions on the approved normal meeting toolbar.');
assert(illustration.includes("label.textContent=recording?'Stop Recording':'Record'"), 'Record must visibly change to Stop Recording while active.');
assert(illustration.includes("indicator.innerHTML='<span class=\"recording-live-dot\"></span><span>Recording</span>'"), 'Active recording must show a persistent visible Recording indicator.');
assert(bootstrap.includes("const loadRecording=()=>recording||(recording=load('/assets/js/meet/local-recording.js?v=2-on-demand','data-ds-local-recording'))"), 'Certified desktop bootstrap must retain exactly one on-demand loader for the real recording module.');
assert(bootstrap.includes("event.target.closest?.('#recordBtn,[data-record-action]')") && bootstrap.includes('void loadRecording()'), 'Pressing Record must preload the real recording module through the single cleaned bootstrap.');
assert((bootstrap.match(/local-recording\.js/g)||[]).length===1, 'Recording module must have exactly one bootstrap ownership path.');
assert(localRecording.includes('new MediaRecorder('), 'Record must use the MediaRecorder API rather than a decorative button.');
assert(localRecording.includes('canvas.captureStream(30)'), 'Record must capture the actual rendered meeting stage.');
assert(localRecording.includes('anchor.download=`DominionStar-Meet-${safeFileTime()}.webm`'), 'Stopping Record must save a DominionStar Meet recording file.');

// Participant dock responsibilities are split deliberately: dock-layout-v2 owns
// drag/position/orientation; dock-resize-quality owns only persistent size and
// video presentation. No second geometry controller may exist.
assert(dockLayout.includes("dock.dataset.positionOwner='dock-layout-v2'"), 'Participant dock must expose one position/orientation owner.');
assert(dockLayout.includes('const setOrientation=orientation=>'), 'Participant dock orientation must remain under dock-layout-v2.');
assert(dockLayout.includes("dock.addEventListener('pointermove'"), 'Participant dock must remain draggable.');
assert(dockResize.includes("const SIZE_KEY = 'ds_meet_dock_size_v1'"), 'Participant dock size must persist without owning position.');
assert(dockResize.includes("resizeHandle.className = 'ds-dock-resize-handle'"), 'Participant dock must expose a real resize handle.');
assert(dockResize.includes('.remote-tile .tile-mic{'), 'Participant tile microphone state must remain visible.');
assert(dockResize.includes('saveSize') && dockResize.includes('restoreSize'), 'Participant dock must save and restore its user-selected size.');
assert(!dockResize.includes('POSITION_KEY')&&!dockResize.includes('--ds-dock-left')&&!dockResize.includes('--ds-dock-top'), 'Resize authority must never fight dock position.');
assert.equal(exists('assets/js/meet/dock-polish-2030.js'), false, 'Retired conflicting dock-polish authority must stay deleted.');

assert(/<key>BundleIsVersionChecked<\/key>\s*<false\/>/.test(macPkgBuilder), 'QA PKG must replace newer or equal prior DominionStar Meet builds instead of being rejected as a downgrade.');

console.log('Approved DominionStar illustration contract passed: compact presenter hierarchy, one sharing indicator, secondary tools under More, single dock authority.');
