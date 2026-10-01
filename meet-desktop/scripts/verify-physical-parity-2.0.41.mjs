import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const shareService=read('src/share-service.mjs');
const sharePicker=read('ui/share-picker.js');
const sharePickerHtml=read('ui/share-picker.html');
const physicalRepair=read('ui/physical-mac-repair.js');
const parity=read('ui/meeting-parity.js');
const adaptive=read('ui/zoom-adaptive-parity.js');
const adaptiveCss=read('ui/zoom-adaptive-parity.css');
const approvedCss=read('ui/approved-reference-parity.css');
const auth=read('ui/auth-password.js');
const rejection=read('PHYSICAL_2_0_20_REJECTION.md');
const rejectionCss=read('ui/rejected-build-repair-2.0.40.css');

const requireText=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};
const rejectText=(source,needle,message)=>{if(source.includes(needle))throw new Error(message);};

if(String(pkg.version)!=='2.0.41')throw new Error(`2.0.41 physical-reference gate requires DominionStar Meet 2.0.41; found ${pkg.version}`);

// Custom chooser remains the capture authority. Deep capture/permission/pause
// behavior is certified separately by verify-share-authority-2.0.41.mjs.
requireText(shareService,"const systemPickerAvailable=platform==='darwin'&&macMajor>=15",'macOS picker capability diagnostics are missing.');
requireText(shareService,'const nativeSystemPicker=false','Rejected Apple system picker must remain disabled.');
requireText(shareService,'configureDisplayMediaHandler(false);','Custom DominionStar capture handler must initialize before Share.');
rejectText(shareService,"if(nativeSystemPicker&&status!=='granted')",'Unknown permission may not reopen the rejected Apple share overlay.');
requireText(rejectionCss,'#participantRoster .ds-participant-media{display:none!important}','Duplicate participant media renderer must remain hidden.');

// 2.0.41 approved Screens / Files / More chooser.
requireText(sharePicker,'const next=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]','Screens view does not merge real screens and application windows.');
requireText(sharePicker,'source.thumbnail','Share chooser does not render live previews.');
requireText(sharePicker,"kind:'screen'",'Share chooser does not enumerate screens.');
requireText(sharePicker,"kind:'window'",'Share chooser does not enumerate application windows.');
requireText(sharePicker,"const includeDominionStar=$('#includeMeetWindows').checked",'Meeting-window visibility is not controlled explicitly by the chooser.');
requireText(sharePicker,'const firstScreen=sources.find','Share chooser does not prefer a desktop like Zoom.');
requireText(sharePicker,"document.visibilityState!=='visible'",'Live source refresh does not suspend while the chooser is hidden.');
requireText(sharePicker,'sharing=true;stopRefreshTimer();shareButton.disabled=true','Preview enumeration does not stop before capture starts.');
requireText(sharePickerHtml,'data-tab="screens">Screens','Share chooser is missing the approved Screens tab.');
requireText(sharePickerHtml,'data-tab="files" aria-disabled="true"','Files must remain visible but truthfully disabled until certified.');
requireText(sharePickerHtml,'data-tab="advanced">More','Share chooser is missing the approved More tab.');
requireText(sharePickerHtml,'Presenter layout','Share chooser is missing Presenter layout.');
requireText(sharePickerHtml,'Content only','Presenter layout is missing Content only.');
requireText(sharePickerHtml,'As background','Presenter layout is missing As background.');
requireText(sharePickerHtml,'Over the shoulder','Presenter layout is missing Over the shoulder.');
requireText(sharePickerHtml,'Side by side','Presenter layout is missing Side by side.');
requireText(sharePickerHtml,'Share sound','Share chooser is missing Share sound.');
requireText(sharePickerHtml,'Optimize for video sharing','Share chooser is missing video optimization.');
requireText(sharePickerHtml,'Share DominionStar Meet windows','More is missing intentional meeting-window visibility control.');
requireText(sharePickerHtml,'Refresh automatically','More is missing bounded automatic preview refresh.');

// Meeting header and View behavior remain Zoom-familiar with DominionStar branding.
requireText(parity,"const logo=String(desktop.brand?.logoUrl||'')",'Meeting header is not driven by the packaged DominionStar logo.');
requireText(parity,'function ensureViewButton()','Meeting header is missing View.');
requireText(parity,"['speaker',sharing()?'Side-by-side: Speaker':'Speaker']",'View menu is missing Speaker.');
requireText(parity,"['gallery',sharing()?'Side-by-side: Gallery':'Gallery']",'View menu is missing Gallery.');
requireText(parity,"['multi',sharing()?'Side-by-side: Multi-speaker':'Multi-speaker']",'View menu is missing Multi-speaker.');

// Participant management remains readable/draggable; video filmstrip is separate.
requireText(adaptive,"search.hidden=count<=1",'One-person participant panel still exposes unnecessary search.');
requireText(adaptive,"waiting.hidden=!hasWaitingPeople()",'Empty Waiting Room is not suppressed.');
requireText(adaptive,"if(self)bucket=0",'Participant ordering does not keep self first.');
requireText(adaptive,"else if(role==='host')bucket=1",'Participant ordering does not prioritize host.');
requireText(adaptive,"else if(role==='cohost')bucket=2",'Participant ordering does not prioritize co-host.');
requireText(adaptive,"else if(raised)bucket=3",'Participant ordering does not prioritize raised hands.');
requireText(adaptive,"else if(micOn)bucket=4",'Participant ordering does not prioritize unmuted participants.');
requireText(adaptive,"head.addEventListener('mousedown',startParticipantPanelDrag,true)",'Participants panel lacks native mouse drag.');
requireText(adaptive,"document.addEventListener('mousemove',moveParticipantPanelDrag,true)",'Participants drag stops when the pointer leaves the header.');
requireText(adaptiveCss,'max-width:340px !important','Compact Participants geometry regressed.');

// Camera/video filmstrip defaults to the right and reflows only when narrow.
requireText(adaptive,"dock.dataset.dsAdaptiveWholePanelDrag='1'",'Video filmstrip whole-surface drag authority is missing.');
requireText(adaptive,"dock.dataset.dsAdaptiveVideoDrag='mouse-document'",'Video filmstrip does not declare native mouse/document drag authority.');
requireText(adaptive,"dock.addEventListener('mousedown',startVideoDockDrag,true)",'Video filmstrip is not draggable from a real mouse press.');
requireText(adaptive,"document.addEventListener('mousemove',moveVideoDockDrag,true)",'Video filmstrip drag stops when the mouse leaves the video tile.');
requireText(adaptive,"document.addEventListener('mouseup',endVideoDockDrag,true)",'Video filmstrip drag does not complete through document mouseup.');
requireText(physicalRepair,"participantCount<=1&&visibleTiles===0",'Physical Mac layer still suppresses a two-person Speaker-view filmstrip.');
requireText(physicalRepair,"dock.dataset.zoomThreshold=suppress?'empty-solo':'available'",'Corrected video-filmstrip threshold is missing.');
requireText(physicalRepair,"if(thresholdApplies&&visibleTiles>0&&dock.hidden)dock.hidden=false",'Two-person Speaker view cannot reveal the video filmstrip.');
requireText(approvedCss,'right:14px !important;','Video filmstrip does not default to the right edge.');
requireText(approvedCss,'grid-template-columns:176px !important;','Desktop video filmstrip is not vertical.');
requireText(approvedCss,'@media(max-width:680px)','Video filmstrip reflows to the top too early.');

// Compact prejoin and carried-forward reference lineage.
requireText(adaptiveCss,'max-width:560px !important','Prejoin is not bounded to compact desktop geometry.');
requireText(adaptiveCss,'grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important','Prejoin device row can clip.');
requireText(adaptive,'Always show this preview when joining','Persistent prejoin preview preference is missing.');
requireText(auth,"script.onload=loadAdaptiveParity",'Adaptive controller is not sequenced after physical Mac repair.');
requireText(auth,"adaptiveStyle.href='./zoom-adaptive-parity.css'",'Adaptive stylesheet is not loaded.');
requireText(rejection,'Status: **REJECTED**','2.0.20 physical rejection record is missing.');

console.log('DOMINIONSTAR_PHYSICAL_PARITY_2_0_41_OK custom-only-preshare screens-files-more presenter-layout no-apple-overlay real-brand view-modes adaptive-participants participant-native-mouse-drag two-person-right-filmstrip video-filmstrip-native-mouse-drag narrow-only-top-reflow compact-prejoin physical-rejection-recorded');
