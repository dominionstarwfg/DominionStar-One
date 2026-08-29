import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const media=read('ui/media-controller.js');
const diag=read('ui/diagnostics.js');
const css=read('ui/diagnostics.css');

assert(media.includes("link.href='./diagnostics.css'"),'Diagnostics stylesheet must load from the shared desktop UI.');
assert(media.includes("script.src='./diagnostics.js'"),'Diagnostics module must load from the shared desktop UI.');
for(const source of ['desktop.auth?.getState','desktop.meeting?.context','DominionMediaController?.snapshot','DominionShareController?.snapshot','DominionWebRTCController?.snapshot'])assert(diag.includes(source),`Diagnostics missing source ${source}`);
assert(diag.includes('/token|credential|secret|authorization/i'),'Diagnostics must redact secret-like fields before display/copy.');
assert(diag.includes('navigator.clipboard.writeText'),'Physical QA must support one-click diagnostics copy.');
assert(diag.includes("q('#transportStatus')"),'Diagnostics must capture the live direct/TURN transport badge.');
assert(diag.includes('meetingOpen')&&diag.includes('waitingOpen')&&diag.includes('prejoinOpen'),'Diagnostics must identify the visible lifecycle surface.');
assert(css.includes('.meet-diagnostics-panel')&&css.includes('.meet-diagnostics-button'),'Diagnostics panel styling is missing.');
console.log('DOMINIONSTAR_PHYSICAL_QA_DIAGNOSTICS_OK redacted-report lifecycle media share transport copyable');
