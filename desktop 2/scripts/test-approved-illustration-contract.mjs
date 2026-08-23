import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const meetHtml = read('meet/index.html');
const presenter = read('desktop 2/src/presenter-toolbar.html');
const presenterJs = read('desktop 2/src/presenter-toolbar.js');
const dockPolish = read('assets/js/meet/dock-polish-2030.js');
const illustration = read('assets/js/meet/illustration-ui-parity.js');
const localRecording = read('assets/js/meet/local-recording.js');
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const macPkgBuilder = read('desktop 2/scripts/build-macos-pkg.sh');

const directPresenterOrder = ['audio','video','participants','chat','new-share','pause','layout','annotate','show-meeting','more','stop'];
let cursor = -1;
for (const command of directPresenterOrder) {
  const index = presenter.indexOf(`data-command="${command}"`);
  assert(index > cursor, `Approved screen-share toolbar must expose ${command} directly in the approved order.`);
  cursor = index;
}
assert(presenter.includes('<small>Share</small>'), 'Approved presenter toolbar must show Share directly.');
assert(presenter.includes('<small>Layout</small>'), 'Approved presenter toolbar must show Layout directly.');
assert(presenter.includes('<small>Show Meeting</small>'), 'Approved presenter toolbar must show Show Meeting directly.');
assert(!presenter.match(/presenterMoreMenu[\s\S]*data-command="layout"/), 'Layout must not be moved under More.');
assert(!presenter.match(/presenterMoreMenu[\s\S]*data-command="show-meeting"/), 'Show Meeting must not be moved under More.');
assert(presenterJs.includes('EXPANDED_WIDTH=930'), 'Presenter window must reserve the full approved control hierarchy.');

for (const id of ['participantsBtn','chatBtn','shareBtn','reactionBtn','moreBtn','leaveBtn']) {
  assert(meetHtml.includes(`id="${id}"`), `Normal meeting toolbar must retain ${id}.`);
}
assert(illustration.includes("label.textContent='Security'"), 'Host Tools must present as Security on the approved primary bar.');
assert(illustration.includes("label.textContent=isHost?'End':'Leave'"), 'Host must see End while attendee/co-host sees Leave.');
assert(illustration.includes("button.id='recordBtn'") && illustration.includes("toolbar.insertBefore(button,reaction||moreBtn||leaveBtn||null)"), 'Record must be inserted directly before Reactions on the approved normal meeting toolbar.');
assert(illustration.includes("label.textContent=recording?'Stop Recording':'Record'"), 'Record must visibly change to Stop Recording while active.');
assert(illustration.includes("indicator.innerHTML='<span class=\"recording-live-dot\"></span><span>Recording</span>'"), 'Active recording must show a persistent visible Recording indicator.');
assert(bootstrap.includes("local-recording.js?v=1-visible-desktop-recording") && bootstrap.includes("'local-recording'"), 'Certified desktop bootstrap must load the real recording module.');
assert(localRecording.includes('new MediaRecorder('), 'Record must use the MediaRecorder API rather than a decorative button.');
assert(localRecording.includes('canvas.captureStream(30)'), 'Record must capture the actual rendered meeting stage.');
assert(localRecording.includes('anchor.download=`DominionStar-Meet-${safeFileTime()}.webm`'), 'Stopping Record must save a DominionStar Meet recording file.');

assert(dockPolish.includes("POSITION_KEY='ds_meet_dock_geometry_v3'"), 'Participant dock geometry must persist across meetings.');
assert(dockPolish.includes('ds-dock-resize-handle'), 'Participant dock must expose a real resize handle.');
assert(dockPolish.includes('.tile-mic{display:grid!important'), 'Participant tile microphone state must remain visible.');
assert(dockPolish.includes('saveGeometry') && dockPolish.includes('restoreGeometry'), 'Participant dock must save and restore its position and size.');

assert(macPkgBuilder.includes('<key>BundleIsVersionChecked</key>\n    <false/>'), 'QA PKG must replace newer or equal prior DominionStar Meet builds instead of being rejected as a downgrade.');

console.log('Approved DominionStar illustration contract passed.');
