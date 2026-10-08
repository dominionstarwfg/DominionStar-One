import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../assets/js/meet-next/executive6.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/meet-next/executive6.css', import.meta.url), 'utf8');

assert(
  ui.includes('const visible = Math.max(1, Math.min(5, count));'),
  'Participant dock no longer caps the visible tile count at five.'
);
assert(
  ui.includes('const overflow = count > 5;'),
  'Participant dock no longer switches to internal overflow only after five visible tiles.'
);
assert(
  ui.includes("ids.filmstrip.style.setProperty('--dock-visible-count', String(visible));"),
  'Participant dock visible-count CSS contract is missing.'
);
assert(
  ui.includes("ids.filmstrip.classList.toggle('has-overflow', overflow);"),
  'Participant dock overflow class is no longer controlled by the five-tile threshold.'
);
assert(
  ui.includes("const total = state.participants.size + 1;"),
  'Participant count is no longer derived from the canonical roster plus self.'
);
assert(
  ui.includes("const visible=entries.filter") &&
  ui.includes("ids.participantList.dataset.renderSignature!==renderSignature") &&
  ui.includes("ids.participantList.innerHTML=visible.map"),
  'Participant panel must render from one canonical participant collection without repainting unchanged snapshots.'
);
assert(
  !/setInterval\s*\(\s*renderParticipants\b/.test(ui),
  'Participant roster has regressed to interval-driven repainting/blinking.'
);
assert(
  /\.participant-list[^\{]*\{[^}]*overflow\s*:\s*auto/i.test(css),
  'Participant list is not internally scrollable.'
);
assert(
  /\.filmstrip\.has-overflow\s+\.filmstrip-track\s*\{[^}]*overflow-y\s*:\s*auto/i.test(css),
  'Participant video dock does not gain internal vertical scrolling after five tiles.'
);
assert(
  /max-height\s*:\s*calc\(5\s*\*/i.test(css),
  'Participant video dock no longer sizes around a five-tile visible window.'
);

console.log('PASS five-client UI contract: canonical roster, no interval repaint loop, five visible tiles, and internal overflow scrolling.');
