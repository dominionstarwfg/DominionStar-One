import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const html=read('ui/share-picker.html');
const css=read('ui/share-picker.css');
const js=read('ui/share-picker.js');
const shareIntegration=read('ui/share-integration.js');
const shareController=read('ui/share-controller.js');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=31))),'Zoom pre-share authority introduced in 2.0.31 must remain enforced for every later candidate.');
assert.ok(html.includes('data-tab="screens">Basic</button>'),'Primary Zoom-familiar share tab must be labeled Basic.');
assert.ok(html.includes('data-tab="advanced">Advanced</button>'),'Advanced tab must remain available.');
assert.ok(html.indexOf('data-tab="screens">Basic</button>')<html.indexOf('data-tab="advanced">Advanced</button>'),'Basic must precede Advanced.');
assert.ok(html.includes('Select a window or an application that you want to share'),'Share modal must use clear desktop source-selection language.');
assert.ok(html.includes('<div class="options-title">Share options</div>'),'Right rail must expose Share options.');
assert.ok(html.indexOf('<div class="share-options">')<html.indexOf('<div class="preview-heading">'),'Share options must appear before the selected-source preview.');
assert.ok(html.includes('<strong>Share sound</strong>'),'Working Share sound option must remain visible.');
assert.ok(html.includes('<strong>Optimize for video sharing</strong>'),'Working Optimize for video sharing option must remain visible.');
assert.ok(html.includes('id="combinedGrid"'),'Real screen/window source grid must remain authoritative.');
assert.ok(html.includes('id="shareButton"'),'Share action must remain explicit.');
assert.ok(html.includes('id="cancelBottom"'),'Cancel action must remain explicit.');
assert.ok(!html.includes('data-tab="files"'),'Dead Files/cloud tab must not return.');
assert.ok(!html.includes('Whiteboard'),'Unsupported mock Whiteboard source must not be presented.');
assert.ok(!html.includes('Computer Audio Only'),'Unsupported mock audio-only source must not be presented.');
assert.ok(css.includes('2.0.31 Zoom-familiar pre-share hierarchy'),'2.0.31 visual hierarchy authority must be present.');
assert.ok(css.includes('.share-options{order:0'),'Share options must own the top of the right rail.');
assert.ok(css.includes('.preview-heading{order:1'),'Selected-source preview must follow Share options.');
assert.ok(js.includes("bridge?.choose?.(selectedId,{optimizeVideo,shareAudio})"),'Share button must still send the real selected source and options.');
assert.ok(!js.includes('getDisplayMedia'),'Picker renderer must not capture media directly.');
assert.ok(shareController.includes('navigator.mediaDevices.getDisplayMedia'),'Certified capture controller must remain authoritative.');
assert.ok(shareIntegration.includes('window.DominionShareController'),'Meeting/share integration must remain the activation path.');

console.log('DOMINIONSTAR_ZOOM_PRESHARE_2_0_31_OK basic advanced source-grid share-options preview share-button no-dead-sources capture-authority-preserved');
