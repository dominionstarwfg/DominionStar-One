import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const html=read('ui/share-picker.html');
const css=read('ui/share-picker.css');
const js=read('ui/share-picker.js');
const shareIntegration=read('ui/share-integration.js');
const shareController=read('ui/share-controller.js');

const version=String(pkg.version||'').split('.').map(Number);
const [versionMajor,versionMinor,versionPatch]=version;
const atLeast=(major,minor,patch)=>versionMajor>major||(versionMajor===major&&(versionMinor>minor||(versionMinor===minor&&versionPatch>=patch)));
assert.ok(version.length===3&&version.every(Number.isInteger),'Desktop package version must be semantic x.y.z.');
assert.ok(atLeast(2,0,31),'Zoom pre-share authority introduced in 2.0.31 must remain enforced for every later candidate.');

if(atLeast(2,0,41)){
  // 2.0.41 supersedes the old Basic / Advanced presentation with the supplied
  // Zoom reference: Screens / Files / More plus Presenter layout. Preserve the
  // original 2.0.31 requirement that the picker owns selection only and capture
  // remains in the certified share controller.
  assert.ok(html.includes('data-tab="screens">Screens'),'2.0.41+ primary share tab must be labeled Screens.');
  assert.ok(html.includes('data-tab="files"'),'2.0.41+ reference must retain the Files position.');
  assert.ok(html.includes('data-tab="advanced">More'),'2.0.41+ advanced share position must be labeled More.');
  assert.ok(html.indexOf('data-tab="screens">Screens')<html.indexOf('data-tab="files"')&&html.indexOf('data-tab="files"')<html.indexOf('data-tab="advanced">More'),'Screens, Files, More must remain in the approved order.');
  assert.ok(html.includes('Presenter layout'),'2.0.41+ right rail must expose Presenter layout.');
  for(const label of ['Content only','As background','Over the shoulder','Side by side','Share sound','Optimize for video sharing','Share DominionStar Meet windows']){
    assert.ok(html.includes(label),`2.0.41+ pre-share is missing ${label}.`);
  }
  assert.ok(html.includes('id="combinedGrid"'),'Real screen/window source grid must remain authoritative.');
  assert.ok(html.includes('id="shareButton"'),'Share action must remain explicit.');
  assert.ok(js.includes("sectionMarkup('Entire screen'"),'2.0.41+ pre-share must group the entire desktop first.');
  assert.ok(js.includes("sectionMarkup('Application windows'"),'2.0.41+ pre-share must group application windows separately.');
  assert.ok(js.includes("kind:'screen'")&&js.includes("kind:'window'"),'2.0.41+ pre-share must enumerate real screens and application windows.');
  assert.ok(js.includes('source.thumbnail'),'2.0.41+ pre-share must render real source previews.');
  assert.ok(css.includes('.source-section.screen-section'),'2.0.41+ screen group styling is missing.');
  assert.ok(css.includes('.presenter-layout'),'2.0.41+ Presenter layout styling is missing.');
  assert.ok(!html.includes('Share This Window'),'Apple system overlay language must never be part of the DominionStar picker.');
}else{
  // Preserve the original 2.0.31 contract on candidates that predate the
  // screenshot-reference supersession.
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
  assert.ok(!html.includes('data-tab="files"'),'Dead Files/cloud tab must not return before the 2.0.41 supersession.');
  assert.ok(!html.includes('Whiteboard'),'Unsupported mock Whiteboard source must not be presented.');
  assert.ok(!html.includes('Computer Audio Only'),'Unsupported mock audio-only source must not be presented.');
  assert.ok(css.includes('2.0.31 Zoom-familiar pre-share hierarchy'),'2.0.31 visual hierarchy authority must be present.');
  assert.ok(css.includes('.share-options{order:0'),'Share options must own the top of the right rail.');
  assert.ok(css.includes('.preview-heading{order:1'),'Selected-source preview must follow Share options.');
}

assert.ok(js.includes("bridge?.choose?.(selectedId,{optimizeVideo,shareAudio})"),'Share button must still send the real selected source and options.');
assert.ok(!js.includes('getDisplayMedia'),'Picker renderer must not capture media directly.');
assert.ok(shareController.includes('navigator.mediaDevices.getDisplayMedia'),'Certified capture controller must remain authoritative.');
assert.ok(shareIntegration.includes('window.DominionShareController'),'Meeting/share integration must remain the activation path.');

console.log(atLeast(2,0,41)
  ? 'DOMINIONSTAR_ZOOM_PRESHARE_2_0_31_OK carried-forward-on='+pkg.version+' screens files more presenter-layout real-source-grid capture-authority-preserved'
  : 'DOMINIONSTAR_ZOOM_PRESHARE_2_0_31_OK basic advanced source-grid share-options preview share-button no-dead-sources capture-authority-preserved');
