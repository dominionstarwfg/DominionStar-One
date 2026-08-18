import fs from 'node:fs';

const source = fs.readFileSync('assets/js/meet/share-view-controls.js', 'utf8');
const meet = fs.readFileSync('meet/index.html', 'utf8');
const contract = JSON.parse(fs.readFileSync('meet/release-contract.json', 'utf8'));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(meet.includes('/assets/js/meet/share-view-controls.js?v=1-operation-2030'), 'Meet must load the Operation 2030 share viewer controls');
assert(contract.files?.['assets/js/meet/share-view-controls.js'], 'Release contract must protect share-view-controls.js');
assert(source.includes("controls.append(makeAction(`Fit to window (${fitPercent()}%)`"), 'Fit-to-window viewer action is missing');
assert(source.includes('[50, 100, 150, 200, 300]'), 'Zoom percentage ladder is missing');
assert(source.includes("percent === 100 ? ' (Original size)'"), '100% Original size label is missing');
assert(source.includes('requestFullscreen'), 'Enter fullscreen behavior is missing');
assert(source.includes('exitFullscreen'), 'Exit fullscreen behavior is missing');
assert(source.includes("filmstrip.hidden = !filmstrip.hidden"), 'Hide/show participant video panel behavior is missing');
assert(source.includes('const originalOpen = button.onclick'), 'Viewer controls must extend the existing trusted share menu');
assert(source.includes('originalOpen.call(button, event)'), 'Existing share-menu authority path must execute before viewer enhancements');
assert(!source.includes('engine.spotlight'), 'Viewer controls must not fake share spotlight using participant-video spotlight semantics');
assert(!source.includes('Annotate'), 'Viewer controls must not expose a dead Annotate command before synchronized annotation exists');
assert(source.includes('window.DominionShareViewerControls = Object.freeze'), 'Stable viewer-controls diagnostic surface is missing');

console.log('DOMINIONSTAR_SHARE_VIEW_CONTROLS_GUARDRAIL_OK');
