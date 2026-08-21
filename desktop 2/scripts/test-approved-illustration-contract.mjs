import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const meetHtml = read('meet/index.html');
const presenter = read('desktop 2/src/presenter-toolbar.html');
const presenterJs = read('desktop 2/src/presenter-toolbar.js');
const dockPolish = read('assets/js/meet/dock-polish-2030.js');
const illustration = read('assets/js/meet/illustration-ui-parity.js');

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

assert(dockPolish.includes("POSITION_KEY='ds_meet_dock_geometry_v3'"), 'Participant dock geometry must persist across meetings.');
assert(dockPolish.includes('ds-dock-resize-handle'), 'Participant dock must expose a real resize handle.');
assert(dockPolish.includes('.tile-mic{display:grid!important'), 'Participant tile microphone state must remain visible.');
assert(dockPolish.includes('saveGeometry') && dockPolish.includes('restoreGeometry'), 'Participant dock must save and restore its position and size.');

console.log('Approved DominionStar illustration contract passed.');
