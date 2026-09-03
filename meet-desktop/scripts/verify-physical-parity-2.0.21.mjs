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

// Native-first permission authority and Zoom-style chooser after capture is proven.
requireText(shareService,"const nativeSystemPicker=platform==='darwin'&&macMajor>=15",'Native picker capability is not gated to supported macOS.');
requireText(shareService,'function configureDisplayMediaHandler(useSystemPicker)','Dynamic native/custom display-media authority is missing.');
requireText(shareService,"if(nativeSystemPicker&&status!=='granted')",'Unknown/ungranted macOS must retain native authorization.');
requireText(shareService,'configureDisplayMediaHandler(false)','Granted/proven macOS cannot switch to the DominionStar chooser.');
requireText(shareIntegration,'const result=await bridge.openPicker(permission);','Renderer does not pass permission mode into picker authority.');
requireText(shareIntegration,"if(result?.nativeSystemPicker)return {mode:'native'}",'Native first-authorization path is missing.');
requireText(shareIntegration,"await share.start({name:'Shared content',options})",'Native Share path does not reach ShareController.');
rejectText(physicalRepair,'sharePicker?.listSources','Physical compatibility code still enumerates sources before real Share.');
rejectText(physicalRepair,'sourceProbe(','Physical compatibility code still probes sources before capture.');
requireText(physicalRepair,'return await integration.open();','Physical compatibility layer must delegate Share to the isolated integration.');
const openIndex=shareIntegration.indexOf('const result=await bridge.openPicker(permission);');
const diagnosticIndex=shareIntegration.indexOf('media?.requestScreen?.()');
if(openIndex<0||diagnosticIndex<0||diagnosticIndex<openIndex)throw new Error('Deep Screen Recording diagnostics run before real picker/capture failure.');

// Physical regression: capture start is fire-and-forget. ShareController must not
// wait for a main-process reply before publishing its active state.
requireText(preload,"captureStarted:state=>{ipcRenderer.send('share:capture-started',state||{});return true;}",'Capture start must be one-way across the preload bridge.');
rejectText(preload,"captureStarted:state=>invoke('share:capture-started'",'Capture start must not use request/response IPC.');
const captureStarted=shareService.slice(
  shareService.indexOf("ipcMain.on('share:capture-started'"),
  shareService.indexOf("ipcMain.handle('share:capture-state'")
);
requireText(captureStarted,"ipcMain.on('share:capture-started'",'Main process does not receive one-way capture start.');
requireText(captureStarted,'event.sender!==main.webContents','Capture start must be limited to the main meeting renderer.');
requireText(captureStarted,'keepMeetingRendererLive();','Capture start does not protect the renderer from throttling.');
rejectText(captureStarted,'scheduleToolbarForShare();','Capture start still schedules presenter BrowserWindow work.');
rejectText(captureStarted,'openToolbar(','Presenter BrowserWindow creation returned to capture start.');
rejectText(captureStarted,'hideMeetingWindowForShare()','Meeting hide returned to capture start.');
rejectText(captureStarted,'return {ok:','Capture start must have no response contract.');

requireText(shareService,'function scheduleToolbarForShare()','Deferred presenter toolbar scheduler is missing.');
const scheduler=shareService.slice(shareService.indexOf('function scheduleToolbarForShare()'),shareService.indexOf('const displayMediaHandler'));
requireText(scheduler,"if(platform==='darwin')",'macOS must use same-renderer presenter controls.');
requireText(scheduler,'toolbarReadyForShare=true','macOS same-renderer presenter controls must be marked ready without a second BrowserWindow.');
requireText(scheduler,'presenterCommitPending=false','macOS presenter commit must not wait on a second renderer.');
requireText(scheduler,'toolbarOpenTimer=setTimeout(async()=>','Non-macOS presenter toolbar must start on a later main-process turn after renderer commit.');
requireText(scheduler,'const ready=await openToolbar();','Non-macOS deferred scheduler does not create the real presenter toolbar.');
requireText(scheduler,'},75);','Non-macOS presenter toolbar scheduling must remain explicitly deferred after commit.');
requireText(scheduler,'toolbarReadyForShare=Boolean(ready)','Non-macOS toolbar readiness is not tracked independently.');
requireText(scheduler,"void sendPresenterCommand('stop',0)",'Non-macOS presenter toolbar failure must fail Share closed through presenter command authority.');
requireText(shareIntegration,"id='inlinePresenterToolbar'",'macOS presenter controls must exist in the share-owning renderer.');

rejectText(shareController,'rendererCommitted:true','ShareController must not own presenter visibility.');
requireText(shareIntegration,'function commitPresenterMode()','Share integration does not own safe presenter commit.');
requireText(shareIntegration,'markCaptureProven();applyLayout();','Share stage must mount before presenter commit.');
requireText(shareIntegration,'commitPresenterMode();','Initial Share does not explicitly commit presenter mode.');
requireText(shareIntegration,"const sameRendererPresenter=String(environment?.platform||'')==='darwin'",'macOS same-renderer presenter detection is missing.');
requireText(shareIntegration,"if(!sameRendererPresenter)bridge?.presenterCommitted?.(",'macOS presenter commit must remain in the share-owning renderer.');
requireText(preload,"ipcRenderer.send('share:presenter-committed'",'Non-macOS presenter commit bridge must remain one-way IPC.');
const presenterCommitted=shareService.slice(
  shareService.indexOf("ipcMain.on('share:presenter-committed'"),
  shareService.indexOf("ipcMain.handle('share:capture-stopped'")
);
requireText(presenterCommitted,'presenterCommitPending=true','Presenter commit must unlock presenter chrome only after renderer completion.');
requireText(presenterCommitted,'if(!toolbarReadyForShare){scheduleToolbarForShare();return;}','Presenter toolbar creation must originate from renderer presenter commit.');
requireText(presenterCommitted,'setImmediate(()=>','Meeting hide is not deferred after toolbar readiness.');
requireText(shareService,'keepMeetingRendererLive()','Hidden/background renderer protection is missing.');
requireText(shareService,'acceptFirstMouse:true','Presenter toolbar cannot accept the first macOS click.');
requireText(shareService,"setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true",'Presenter toolbar is not protected across Spaces/full-screen apps.');
rejectText(shareService,"type:platform==='darwin'?'panel':undefined",'Unsupported macOS nonactivating panel type returned.');
requireText(shareService,"if(normalized==='stop'&&shareActive)",'Stop Share retry protection is missing.');

// Zoom-familiar working-only share chooser.
requireText(sharePicker,'const next=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]','Screens view does not merge real screens and application windows.');
requireText(sharePicker,'source.thumbnail','Share chooser does not render live previews.');
requireText(sharePicker,"kind:'screen'",'Share chooser does not enumerate screens.');
requireText(sharePicker,"kind:'window'",'Share chooser does not enumerate application windows.');
requireText(sharePicker,"const includeDominionStar=$('#includeMeetWindows').checked",'Meeting-window visibility is not controlled explicitly by the chooser.');
requireText(sharePicker,'const firstScreen=sources.find','Share chooser does not prefer a desktop like Zoom.');
requireText(sharePicker,"document.visibilityState!=='visible'",'Live source refresh does not suspend while the chooser is hidden.');
requireText(sharePicker,'sharing=true;stopRefreshTimer();shareButton.disabled=true','Preview enumeration does not stop before capture starts.');
requireText(sharePickerHtml,'data-tab="screens">Screens','Share chooser is missing Screens.');
requireText(sharePickerHtml,'data-tab="advanced">Advanced','Share chooser is missing Advanced.');
rejectText(sharePickerHtml,'data-tab="files"','Share chooser exposes unsupported Files/cloud controls.');
requireText(sharePickerHtml,'Share sound','Share chooser is missing Share sound.');
requireText(sharePickerHtml,'Optimize for video sharing','Share chooser is missing video optimization.');
requireText(sharePickerHtml,'Include DominionStar Meet windows','Advanced meeting-window visibility control is missing.');

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

// Camera-off video filmstrip defaults to the right, including two-person calls.
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

console.log(`DOMINIONSTAR_PHYSICAL_PARITY_2_0_21_OK carried-forward-on=${pkg.version} permission-aware-native-fallback zoom-screens-advanced-working-only one-way-capture-start toolbar-after-renderer-commit integration-owned-one-way-presenter-commit renderer-live-before-toolbar toolbar-fail-closed direct-stop-share real-brand view-modes adaptive-participants participant-native-mouse-drag two-person-right-filmstrip video-filmstrip-native-mouse-drag narrow-only-top-reflow compact-prejoin physical-rejection-recorded`);
