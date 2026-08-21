import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const receiver = read('assets/js/meet/receiver-side-layout-parity.js');
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');

for (const token of [
  "'standard'","'speaker'","'gallery'","'dynamic'","'multi-speaker'",
  'ds-share-splitter','role','separator','KEY_RATIO','setPointerCapture','pointermove',
  'ds-receiver-side-by-side','@media(max-width:820px)','apply(\'standard\')'
]) {
  assert(receiver.includes(token), `Receiver share-layout contract missing ${token}.`);
}
assert(receiver.includes("localStorage.setItem(KEY_RATIO") && receiver.includes("localStorage.getItem(KEY_RATIO)"),
  'Receiver split ratio must persist across meetings.');
assert(receiver.includes("Side-by-side: Speaker") && receiver.includes("Side-by-side: Gallery") &&
       receiver.includes("Side-by-side: Dynamic gallery") && receiver.includes("Side-by-side: Multi-speaker"),
  'Receiver Shared Screen menu must expose Zoom-class side-by-side layout choices.');
assert(receiver.includes("clickDockView('speaker')") && receiver.includes("clickDockView('grid')") && receiver.includes("clickDockView('stack')"),
  'Receiver layouts must drive the real participant dock modes rather than decorative menu state.');
assert(receiver.includes("[data-ds-receiver-layout='dynamic'] #filmstripTrack .remote-tile.speaking") &&
       receiver.includes("[data-ds-receiver-layout='multi-speaker'] #filmstripTrack .remote-tile.speaking") &&
       receiver.includes('grid-column:span 2') && receiver.includes('order:-1'),
  'Dynamic Gallery and Multi-speaker must react to real speaking-state tiles rather than static labels.');
assert(bootstrap.includes('receiver-side-layout-parity.js') && bootstrap.includes('data-ds-receiver-side-layout'),
  'Certified runtime must load receiver side-by-side layout parity.');

console.log('Receiver side-by-side sharing parity guardrails passed.');
