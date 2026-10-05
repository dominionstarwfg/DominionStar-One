import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const shareService=read('src/share-service.mjs');
const shareController=read('ui/share-controller.js');
const shareIntegration=read('ui/share-integration.js');
const preload=read('src/preload.cjs');
const sharePicker=read('ui/share-picker.js');
const sharePickerHtml=read('ui/share-picker.html');
const parity=read('ui/meeting-parity.js');
const runtime=read('ui/runtime-stability.js');
const approvedCss=read('ui/approved-reference-parity.css');
const prejoinCss=read('ui/executive-prejoin-2.0.41.css');
const macOverlay=read('src/mac-share-presenter-overlay.mjs');
const runtimeBootstrap=read('ui/runtime-bootstrap.js');

const requireText=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};
const rejectText=(source,needle,message)=>{if(source.includes(needle))throw new Error(message);};

const [major,minor,patch]=String(pkg.version||'').split('.').map(Number);
if(!(major===2&&minor===0&&Number.isInteger(patch)&&patch>=21))throw new Error(`Physical parity requires DominionStar Meet 2.0.21+; found ${pkg.version}`);

// Custom DominionStar chooser remains the active capture path.
requireText(shareService,"const systemPickerAvailable=platform==='darwin'&&macMajor>=15",'macOS picker capability diagnostics are missing.');
requireText(shareService,'const nativeSystemPicker=false','Rejected Apple system picker must remain disabled.');
requireText(shareService,'configureDisplayMediaHandler(false);','Custom capture handler must initialize before Share.');
requireText(shareIntegration,'const result=await bridge.openPicker(permission);','Renderer must use the app-owned picker.');
requireText(shareController,"error.code='share_start_timeout'",'Share start must fail visibly instead of loading forever.');
requireText(shareController,'capturePromise.then(lateStream=>stopTracks(lateStream))','Late capture completion must be stopped and discarded.');

// Capture start remains one-way.
requireText(preload,"captureStarted:state=>{ipcRenderer.send('share:capture-started',state||{});return true;}",'Capture start must be one-way across preload.');
rejectText(preload,"captureStarted:state=>invoke('share:capture-started'",'Capture start must not use request/response IPC.');
requireText(shareIntegration,"id='inlinePresenterToolbar'",'macOS presenter controls must exist in the share-owning renderer.');

// Share chooser exposes only supported, truthful options.
requireText(sharePicker,'const next=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]','Screens view must merge real screens and application windows.');
requireText(sharePicker,'source.thumbnail','Share chooser must render live previews.');
requireText(sharePicker,"kind:'screen'",'Share chooser must enumerate screens.');
requireText(sharePicker,"kind:'window'",'Share chooser must enumerate application windows.');
requireText(sharePicker,'sharing=true;stopRefreshTimer();shareButton.disabled=true','Preview enumeration must stop before capture starts.');
requireText(sharePickerHtml,'data-tab="screens">Screens','Share chooser is missing the Screens tab.');
requireText(sharePickerHtml,'data-tab="files" aria-disabled="true"','Files must remain truthfully disabled until certified.');
requireText(sharePickerHtml,'data-tab="advanced">More','Share chooser is missing More.');
for(const label of ['Content only','As background','Over the shoulder','Side by side','Share sound','Optimize for video sharing','Share DominionStar Meet windows','Refresh automatically'])requireText(sharePickerHtml,label,`Share chooser missing ${label}.`);

// Meeting header and View behavior remain functional.
requireText(parity,"const logo=String(desktop.brand?.logoUrl||'')",'Meeting header must use packaged DominionStar branding.');
requireText(parity,'function ensureViewButton()','Meeting header is missing View.');
requireText(parity,"['speaker',sharing()?'Side-by-side: Speaker':'Speaker']",'View menu is missing Speaker.');
requireText(parity,"['gallery',sharing()?'Side-by-side: Gallery':'Gallery']",'View menu is missing Gallery.');
requireText(parity,"['multi',sharing()?'Side-by-side: Multi-speaker':'Multi-speaker']",'View menu is missing Multi-speaker.');

// Canonical runtime owns draggable participants/chat/video-dock behavior.
requireText(runtime,"panel.dataset.dsRuntimeMode='floating'",'Participants/Chat must remain floating.');
requireText(runtime,'installFloatingSurfaceDrag(panel)','Participants/Chat must remain draggable.');
requireText(runtime,'function syncVideoDockGeometry()','Video dock geometry must be runtime-owned.');
requireText(runtime,"dock.dataset.dsRuntimeDockMode=userPositioned?'user':compact?'top':'right'",'Video dock mode must resolve deterministically.');
requireText(runtime,"dock.style.setProperty('right','14px','important')",'Desktop video dock must default to the right edge.');
requireText(runtime,"body.style.setProperty('grid-auto-flow','column','important')",'Compact video dock must reflow horizontally.');
requireText(macOverlay,"function shouldShowVideoWindow(){return videoLayout!=='hide'&&presenterParticipantCount()>=2;}",'Native sharing filmstrip must start at two participants.');
requireText(approvedCss,'right:14px !important;','Approved reference must preserve right-edge filmstrip geometry.');

// Compact prejoin remains bounded and readable.
requireText(prejoinCss,'max-width','Prejoin stylesheet must bound desktop geometry.');
requireText(prejoinCss,'grid-template-columns','Prejoin device controls must remain structured.');

// Retired physical/adaptive authorities stay out of startup.
for(const retired of ['physical-mac-repair.js','zoom-adaptive-parity.js','active-share-home-parity-2.0.41.js','rejected-build-repair-2.0.40.css']){
  rejectText(runtimeBootstrap,retired,`Retired physical parity layer returned to startup: ${retired}`);
}

console.log(`DOMINIONSTAR_PHYSICAL_PARITY_2_0_54_OK carried-forward-on=${pkg.version} custom-preshare bounded-share-start one-way-capture presenter-controls real-brand view-modes runtime-draggable-panels two-person-native-filmstrip right-default-video-dock compact-prejoin no-retired-authorities`);
