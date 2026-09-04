import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const html=read('ui/share-picker.html');
const css=read('ui/share-picker.css');
const js=read('ui/share-picker.js');
const shareController=read('ui/share-controller.js');
const shareIntegration=read('ui/share-integration.js');
const shareService=read('src/share-service.mjs');

const has=(source,needle,message)=>assert.ok(source.includes(needle),message);
const lacks=(source,needle,message)=>assert.ok(!source.includes(needle),message);
const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
const atLeast=(major,minor,patch)=>versionMajor>major||(versionMajor===major&&(versionMinor>minor||(versionMinor===minor&&versionPatch>=patch)));

has(html,'data-tab="screens"','Share picker must expose a Screens tab.');
has(html,'data-tab="advanced"','Share picker must expose a functional Advanced/More tab.');
if(atLeast(2,0,41)){
  has(html,'data-tab="files"','2.0.41+ screenshot-reference picker must retain the Files position.');
  has(html,'aria-disabled="true"','Uncertified Files capability must remain visibly disabled rather than pretending to work.');
}else{
  lacks(html,'data-tab="files"','Dead Files tab must not remain before the 2.0.41 screenshot-reference supersession.');
}
lacks(js,"specialCard({id:'advanced:portion'",'Disabled mock Advanced share modes must be removed.');
lacks(js,"specialCard({id:'files:drive'",'Disabled cloud-source mock cards must be removed.');

has(html,'id="combinedGrid"','Unified screen/window gallery is missing.');
has(html,'id="selectionPreview"','Selected-source preview is missing.');
has(html,'id="sourceSearch"','Window search is missing.');
has(html,'data-filter="screen"','Desktop filter is missing.');
has(html,'data-filter="window"','Window filter is missing.');
has(html,'id="refreshSources"','Manual preview refresh is missing.');
has(html,'id="autoRefresh"','Automatic preview refresh control is missing.');
has(js,'setInterval(()=>{','Preview refresh scheduler is missing.');
has(js,'},2500);','Preview refresh cadence must remain bounded.');
has(js,'if(refreshInFlight||sharing)return;','Preview discovery must be single-flight and must stop during share start.');
has(js,"document.visibilityState!=='visible'",'Background picker refresh must skip when the chooser is not visible.');
has(js,'else stopRefreshTimer()','Preview timer must stop when the chooser is hidden.');
has(js,'sharing=true;stopRefreshTimer();shareButton.disabled=true','Share start must stop preview enumeration before capture begins.');

has(js,"bridge?.listSources?.({includeDominionStar,kind:'screen'})",'Screen source discovery is not wired.');
has(js,"bridge?.listSources?.({includeDominionStar,kind:'window'})",'Window source discovery is not wired.');
has(js,"$('#includeMeetWindows').addEventListener('change'",'Meeting-window visibility toggle is not wired.');
has(js,"$('#autoRefresh').addEventListener('change'",'Auto-refresh toggle is not wired.');
has(js,"$('#sourceSearch')?.addEventListener('input',renderSources)",'Source search is not live.');
has(js,"$$('.filter').forEach(button=>button.addEventListener('click'",'Source filters are not wired.');
has(js,"card.addEventListener('dblclick'",'Double-click quick share is missing.');
has(js,"event.key==='ArrowRight'",'Keyboard source navigation is missing.');
has(js,"bridge?.choose?.(selectedId,{optimizeVideo,shareAudio})",'Share action must pass the certified source and working share options.');
has(js,"bridge?.cancel?.()",'Cancel must close the chooser through the native bridge.');
has(js,"selectedId=String(remembered?.id||firstScreen?.id||sources[0]?.id||'')",'Refresh must preserve the selected source when possible.');

has(html,'id="shareAudio"','Share sound option is missing.');
has(html,'id="optimizeVideo"','Optimize-for-video option is missing.');
has(js,"writePref('ds_pref_share_audio',shareAudio)",'Share sound preference must persist.');
has(js,"writePref('ds_pref_share_optimize',optimizeVideo)",'Video optimization preference must persist.');
has(css,'.source-card.selected','Selected source needs a strong desktop-style visual state.');
has(css,'.selection-preview-frame','Large selected-source preview styling is missing.');
has(css,'.loading-state[hidden],.error-state[hidden]{display:none!important}','Hidden loading/error overlays must be physically non-rendering once a valid share source is available.');

lacks(js,'getDisplayMedia','Share picker must not capture media directly.');
lacks(js,'desktopCapturer','Share picker renderer must not own Electron capture authority.');
has(shareService,'setDisplayMediaRequestHandler','Native capture authority must remain in the certified main-process share service.');
has(shareController,'navigator.mediaDevices.getDisplayMedia','Certified renderer capture start remains in share-controller.');
has(shareIntegration,'window.DominionShareController','Certified meeting/share integration remains the activation path.');

console.log('DOMINIONSTAR_SHARE_PICKER_2_0_25_OK carried-forward-on='+pkg.version+' zoom-current-screens advanced-more real-previews source-search filters manual-refresh bounded-auto-refresh selection-preserved explicit-share-options hidden-state-authority keyboard-doubleclick no-dead-cards capture-authority-untouched');
