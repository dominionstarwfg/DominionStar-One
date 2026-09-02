import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const shareService=read('src/share-service.mjs');
const shareController=read('ui/share-controller.js');
const shareIntegration=read('ui/share-integration.js');
const preload=read('src/preload.cjs');
const sharePicker=read('ui/share-picker.js');
const sharePickerHtml=read('ui/share-picker.html');
const physicalRepair=read('ui/physical-mac-repair.js');
const parity=read('ui/meeting-parity.js');
const adaptive=read('ui/zoom-adaptive-parity.js');
const adaptiveCss=read('ui/zoom-adaptive-parity.css');
const approvedCss=read('ui/approved-reference-parity.css');
const auth=read('ui/auth-password.js');
const rejection=read('PHYSICAL_2_0_20_REJECTION.md');

const requireText=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};
const rejectText=(source,needle,message)=>{if(source.includes(needle))throw new Error(message);};

const [major,minor,patch]=String(pkg.version||'').split('.').map(Number);
if(!(major===2&&minor===0&&Number.isInteger(patch)&&patch>=21))throw new Error(`Carried-forward physical-reference gate requires DominionStar Meet 2.0.21 or later in the 2.0.x line; found ${pkg.version}`);

// Screen share: first-time permission remains native-safe; granted sessions use
// the app-owned Zoom-style chooser. Presenter hiding is integration-owned only
// after the capture promise and real shared-stage layout have completed.
requireText(shareService,"const nativeSystemPicker=platform==='darwin'&&macMajor>=15",'Native picker capability is not gated to supported macOS.');
requireText(shareService,'function configureDisplayMediaHandler(useSystemPicker)','Dynamic native/custom display-media authority is missing.');
requireText(shareService,'configureDisplayMediaHandler(nativeSystemPicker)','Display-media authority does not initialize native-safe.');
requireText(shareService,"if(nativeSystemPicker&&status!=='granted')",'Un-granted macOS does not retain native authorization.');
requireText(shareService,'configureDisplayMediaHandler(false)','Granted macOS does not switch to the Zoom-style DominionStar chooser.');
requireText(shareIntegration,'const result=await bridge.openPicker(permission);','Renderer does not pass permission state into picker authority.');
requireText(shareIntegration,"if(result?.nativeSystemPicker)return {mode:'native'}",'Renderer does not recognize native first-time picker mode.');
requireText(shareIntegration,"await share.start({name:'Shared content',options})",'Native share path does not call getDisplayMedia through ShareController.');
requireText(shareService,'function hideMeetingWindowForShare()','Presenter state cannot hide the normal meeting window.');
requireText(shareService,'main.hide()','Meeting window cannot enter hidden presenter state.');
requireText(shareService,'async function openToolbar()','Presenter toolbar load must be awaitable.');
requireText(shareService,"await created.loadFile(path.join(uiDir,'presenter-toolbar.html'))",'Presenter toolbar must load before the meeting can hide.');
requireText(shareService,'const toolbarReady=await openToolbar();','Capture start does not wait for presenter-toolbar readiness.');
requireText(shareService,'awaitingPresenterCommit:Boolean(toolbarReady)','Capture start must return before integration commits presenter mode.');
rejectText(shareController,'rendererCommitted:true','Capture controller still owns presenter visibility commit.');
requireText(shareIntegration,'function commitPresenterMode()','Share integration does not own safe presenter commit.');
requireText(shareIntegration,'bridge?.presenterCommitted?.(','Share integration cannot send presenter-ready state.');
requireText(preload,"ipcRenderer.send('share:presenter-committed'",'Presenter commit is not a one-way IPC signal.');
requireText(shareService,"ipcMain.on('share:presenter-committed'",'Main process does not receive the one-way presenter commit.');
requireText(shareService,'toolbarReadyForShare','Presenter commit is not gated on toolbar readiness.');
requireText(shareService,'setImmediate(()=>','Presenter meeting hide is not deferred beyond the commit signal.');
requireText(shareService,'keepMeetingRendererLive();','Meeting renderer is not kept live during presenter focus/occlusion.');
requireText(shareService,"setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true",'Presenter toolbar is not protected across macOS Spaces/full-screen apps.');
requireText(shareService,'setBackgroundThrottling?.(false)','Hidden/background meeting renderer can still throttle the live share.');
requireText(shareService,'acceptFirstMouse:true','Presenter toolbar cannot accept the first macOS click reliably.');
rejectText(shareService,"type:platform==='darwin'?'panel':undefined",'Presenter toolbar still uses the unsupported macOS nonactivating panel type.');
requireText(shareService,"if(normalized==='stop'&&shareActive)",'Stop Share does not retain main-process retry protection.');
requireText(physicalRepair,'return await integration.open();','Physical Mac layer still owns capture instead of delegating to Share integration.');
rejectText(physicalRepair,'sharePicker?.listSources','Physical Mac Share click still enumerates desktop sources before share authority chooses a path.');
rejectText(physicalRepair,'sourceProbe(','Physical Mac Share click still contains a source-probe permission gate.');
const openIndex=shareIntegration.indexOf('const result=await bridge.openPicker(permission);');
const diagnosticIndex=shareIntegration.indexOf('media?.requestScreen?.()');
if(openIndex<0||diagnosticIndex<0||diagnosticIndex<openIndex)throw new Error('Deep Screen Recording diagnostics run before real picker/capture failure.');

// The granted-permission chooser must match Zoom's physical share flow: Basic,
// Advanced and Files tabs, with actual desktops and application windows together
// in Basic, plus the familiar bottom share options.
requireText(sharePicker,'basicSources=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]','Basic does not merge real screens and application windows.');
requireText(sharePicker,'source.thumbnail','Share chooser does not render live source previews.');
requireText(sharePicker,"kind:'screen'",'Share chooser does not enumerate real desktop sources.');
requireText(sharePicker,"kind:'window'",'Share chooser does not enumerate real application windows.');
requireText(sharePicker,'includeDominionStar:false','Share chooser does not keep DominionStar windows excluded by default.');
requireText(sharePicker,'const firstScreen=basicSources.find','Share chooser does not prefer a desktop as Zoom does.');
requireText(sharePickerHtml,'data-tab="basic">Basic','Share chooser is missing Basic.');
requireText(sharePickerHtml,'data-tab="advanced">Advanced','Share chooser is missing Advanced.');
requireText(sharePickerHtml,'data-tab="files">Files','Share chooser is missing Files.');
requireText(sharePickerHtml,'Share sound','Share chooser is missing Share sound.');
requireText(sharePickerHtml,'Optimize for video clip','Share chooser is missing Optimize for video clip.');
requireText(sharePickerHtml,'Optimize for sharing video','Share chooser is missing Optimize for sharing video.');
rejectText(sharePickerHtml,'Show DominionStar windows','Normal presenter flow still exposes a recursive meeting-window option.');

// Approved visual reference: real brand and Zoom-style View control are release requirements.
requireText(parity,"const logo=String(desktop.brand?.logoUrl||'')",'Meeting header is not driven by the real packaged DominionStar logo resource.');
requireText(parity,"wrap.innerHTML=`<img src=\"${logo}\" alt=\"DominionStar\"><strong>DominionStar Meet</strong>`",'DominionStar meeting brand is not mounted in the meeting header.');
requireText(parity,'function ensureViewButton()','Meeting header is missing the Zoom-style View control.');
requireText(parity,"['speaker',sharing()?'Side-by-side: Speaker':'Speaker']",'View menu is missing Speaker view.');
requireText(parity,"['gallery',sharing()?'Side-by-side: Gallery':'Gallery']",'View menu is missing Gallery view.');
requireText(parity,"['multi',sharing()?'Side-by-side: Multi-speaker':'Multi-speaker']",'View menu is missing Multi-speaker view.');

// Participants: small-roster density, adaptive search, documented Zoom ordering,
// readable title hierarchy, and a final-authority native mouse drag.
requireText(adaptive,"search.hidden=count<=1",'One-person participant panel still exposes unnecessary search.');
requireText(adaptive,"waiting.hidden=!hasWaitingPeople()",'Empty Waiting Room is not suppressed.');
requireText(adaptive,"if(self)bucket=0",'Participant ordering does not keep the local user first.');
requireText(adaptive,"else if(role==='host')bucket=1",'Participant ordering does not prioritize host.');
requireText(adaptive,"else if(role==='cohost')bucket=2",'Participant ordering does not prioritize co-hosts.');
requireText(adaptive,"else if(raised)bucket=3",'Participant ordering does not prioritize raised hands.');
requireText(adaptive,"else if(micOn)bucket=4",'Participant ordering does not prioritize unmuted participants above muted participants.');
requireText(adaptive,"if(count<=6)centerParticipantPanel(side,count)",'Small participant rosters do not default to the compact floating physical-reference layout.');
requireText(adaptive,"head.dataset.dsAdaptiveParticipantDrag='mouse-document'",'Floating Participants does not declare native mouse drag authority.');
requireText(adaptive,"head.addEventListener('pointerdown',blockLegacyParticipantPointerDown,true)",'Floating Participants does not block the competing legacy pointer drag.');
requireText(adaptive,"head.addEventListener('mousedown',startParticipantPanelDrag,true)",'Floating Participants does not start from native mouse input.');
requireText(adaptive,"document.addEventListener('mousemove',moveParticipantPanelDrag,true)",'Floating Participants stops tracking when the mouse leaves the title bar.');
requireText(adaptive,"document.addEventListener('mouseup',endParticipantPanelDrag,true)",'Floating Participants does not end native mouse drag cleanly.');
requireText(adaptive,"side.style.setProperty('left',`${left}px`,'important')",'Floating Participants drag does not override competing legacy geometry.');
requireText(adaptive,"side.style.setProperty('top',`${top}px`,'important')",'Floating Participants drag does not override competing legacy vertical geometry.');
requireText(adaptiveCss,'max-width:340px !important','One-person participant panel is not bounded to compact Zoom-scale geometry.');
requireText(adaptiveCss,'#meetingOverlay .room-side-head strong{\n  font-size:15px !important;','Participants heading is below the approved Zoom-scale readability.');

// Chat: right dock on wide windows, floating overlay on constrained windows.
requireText(adaptive,'const wide=body.clientWidth>=1120','Chat does not have a deterministic adaptive-width breakpoint.');
requireText(adaptive,"panel.dataset.dsAdaptiveMode=wide?'docked':'floating'",'Chat does not switch between docked and floating modes.');
requireText(adaptive,"stage.style.setProperty('margin-right','356px','important')",'Wide docked chat does not reserve stage space.');
requireText(adaptive,'ds-chat-privacy','Chat privacy affordance is missing.');
requireText(adaptiveCss,'min-width:290px !important;\n  max-width:360px !important;','Chat is not hard-bounded to the approved compact width.');
requireText(adaptiveCss,'#meetingOverlay.ds-chat-docked #meetingChatPanel{\n  width:340px !important;','Wide Chat does not use the approved compact dock width.');

// Prejoin: compact preview-dominant geometry and no clipped third device column.
requireText(adaptiveCss,'max-width:560px !important','Prejoin is not bounded to compact desktop width.');
requireText(adaptiveCss,'grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important','Prejoin device row is not constrained to two non-clipping columns.');
requireText(adaptive,"label.hidden=title==='speaker'",'Prejoin still exposes the third speaker selector that clipped in the physical screenshot.');
requireText(adaptive,'Always show this preview when joining','Zoom-style persistent preview preference is missing.');

// Floating participant video tiles remain whole-surface draggable with an ordinary cursor.
requireText(adaptiveCss,'#participantVideoDock,\n#participantVideoDock .participant-video-dock-head{\n  cursor:default !important;','Floating video panel does not retain the normal arrow cursor.');
requireText(adaptiveCss,'#participantVideoDock .dock-grip{display:none !important;}','Legacy video-panel grip affordance is still visible.');
requireText(adaptive,"dock.dataset.dsAdaptiveWholePanelDrag='1'",'Floating video panel does not declare whole-panel drag authority.');
requireText(adaptive,"dock.addEventListener('pointerdown',startVideoDockDrag,true)",'Floating video panel is not draggable from the whole non-control surface.');
requireText(adaptive,"event.target.closest?.('button,.participant-video-resize,a,input,select,textarea')",'Whole-panel video drag does not protect interactive controls.');
requireText(physicalRepair,"participantCount<=1&&visibleTiles===0",'Physical Mac layer still suppresses a two-person Speaker-view video filmstrip.');
requireText(physicalRepair,"dock.dataset.zoomThreshold=suppress?'empty-solo':'available'",'Video panel no longer exposes the corrected empty-solo/available policy.');
requireText(physicalRepair,"if(thresholdApplies&&visibleTiles>0&&dock.hidden)dock.hidden=false",'Two-person Speaker view cannot reveal an available video filmstrip.');
requireText(approvedCss,'right:14px !important;','Approved video filmstrip does not retain the right-side desktop default.');
requireText(approvedCss,'grid-template-columns:176px !important;','Approved right-side filmstrip is not vertical.');
requireText(approvedCss,'@media(max-width:680px)','Video filmstrip moves to compact top geometry too early.');

requireText(auth,"script.onload=loadAdaptiveParity",'Adaptive 2.0.21 controller is not sequenced after physical Mac repair.');
requireText(auth,"adaptiveStyle.href='./zoom-adaptive-parity.css'",'Adaptive 2.0.21 stylesheet is not loaded.');
requireText(rejection,'Status: **REJECTED**','2.0.20 physical rejection is not recorded.');

console.log(`DOMINIONSTAR_PHYSICAL_PARITY_2_0_21_OK carried-forward-on=${pkg.version} permission-aware-native-fallback zoom-basic-advanced-files real-screen-window-grid toolbar-before-hide integration-owned-one-way-presenter-commit renderer-live-before-toolbar hidden-meeting-presenter-state direct-stop-share real-source-chooser no-preflight real-brand view-modes compact-prejoin adaptive-participants participant-native-mouse-drag readable-participants zoom-sort compact-chat adaptive-chat whole-video-panel-drag floating-video-no-grip two-person-right-filmstrip physical-rejection-recorded`);