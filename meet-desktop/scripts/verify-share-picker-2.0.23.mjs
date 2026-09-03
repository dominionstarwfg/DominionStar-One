import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const html=read('ui/share-picker.html');
const css=read('ui/share-picker.css');
const js=read('ui/share-picker.js');

const has=(source,needle,message)=>assert.ok(source.includes(needle),message);
const lacks=(source,needle,message)=>assert.ok(!source.includes(needle),message);

has(html,'id="pickerLogo"','Share picker must carry DominionStar branding.');
has(html,'<h1>Share Screen</h1>','Share picker must have a clear Share Screen title.');
has(html,'data-tab="basic">Basic','Basic tab is missing.');
has(html,'data-tab="advanced">Advanced','Advanced tab is missing.');
has(html,'data-tab="files">Files','Files tab is missing.');
has(html,'id="screensSection"','Basic must separate Screens from Windows.');
has(html,'id="screenGrid"','Screens grid is missing.');
has(html,'id="windowsSection"','Windows section is missing.');
has(html,'id="windowGrid"','Windows grid is missing.');
has(html,'id="selectionSummary"','Selected-source summary is missing.');
has(html,'Share sound','Share sound option is missing.');
has(html,'Optimize for sharing video','Single video optimization option is missing.');
assert.equal((html.match(/Optimize for sharing video/g)||[]).length,1,'Only one visible video optimization label is allowed.');
has(html,'id="optimizeSharingVideo" type="checkbox" hidden','Legacy optimization preference compatibility must stay hidden.');
lacks(html,'Whiteboard','Disabled Whiteboard placeholder must not contaminate the Basic source grid.');
lacks(html,'iPhone/iPad','Disabled device placeholder must not contaminate the Basic source grid.');

has(css,'.source-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))','Desktop picker must keep four-column source density.');
has(css,'.thumb{position:relative;aspect-ratio:16/9','Source previews must use a stable 16:9 frame.');
has(css,'.source-card.selected{border-color:var(--blue)','Selected source must have a strong blue outline.');
has(css,'.selection-summary.ready .selection-dot{background:var(--success)','Ready selection must have an explicit status cue.');
has(css,'.tab.active{border-bottom-color:var(--blue)','Active share tab must retain a Zoom-familiar underline.');

has(js,"kind:'screen'",'Picker must enumerate screens independently.');
has(js,"kind:'window'",'Picker must enumerate application windows independently.');
has(js,'basicSources=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]','Picker must merge the two source families only after independent enumeration.');
has(js,'const firstScreen=basicSources.find','Picker must prefer a screen by default.');
has(js,'source.thumbnail','Picker must render real native preview thumbnails.');
has(js,'function paintSelection()','Picker must update selection without rebuilding source cards.');
const selectSource=js.slice(js.indexOf('function selectSource'),js.indexOf('function bindSelectable'));
lacks(selectSource,'renderBasic()','Selecting a source must not rebuild the DOM and break double-click.');
has(selectSource,'paintSelection();','Selecting a source must repaint state in place.');
has(js,"card.addEventListener('dblclick'",'Double-click-to-share is missing.');
has(js,"if(event.key==='Enter'||event.key===' ')",'Keyboard source activation is missing.');
has(js,"event.key==='ArrowRight'",'Arrow-key source navigation is missing.');
has(js,"event.key==='Escape'",'Escape-to-cancel is missing.');
has(js,"shareButton.textContent='Sharing…'",'Share must provide immediate click feedback.');
has(js,'bridge?.choose?.(selectedId',{required:true}?.required===true?'Picker must use the preload source-selection authority.':'');
lacks(js,'.getDisplayMedia(','Picker must never acquire display media directly.');

console.log('DOMINIONSTAR_SHARE_PICKER_2_0_23_OK branded-header basic-advanced-files separated-screens-windows real-previews stable-selection double-click keyboard-share share-sound single-video-optimization no-basic-placeholders single-owner-capture');
