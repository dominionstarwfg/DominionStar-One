import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createShareSourceAuthority } from '../src/share-source-authority.mjs';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const service=read('src/share-service.mjs');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const picker=read('ui/share-picker.js');
const pickerHtml=read('ui/share-picker.html');
const pickerCss=read('ui/share-picker.css');
const mediaController=read('ui/media-controller.js');
const controller=read('ui/share-controller.js');
const integration=read('ui/share-integration.js');
const toolbar=read('ui/presenter-toolbar.html');
const toolbarJs=read('ui/presenter-toolbar.js');
const toolbarCss=read('ui/presenter-toolbar.css');
const shareCss=read('ui/share.css');
const annotation=read('ui/share-annotation.js');
const media=read('ui/media-controller.js');

let enumerateCount=0;
let releaseFirst;
const firstEnumeration=new Promise(resolve=>{releaseFirst=resolve;});
const authority=createShareSourceAuthority({timeoutMs:20,enumerateSources:async()=>{enumerateCount+=1;if(enumerateCount===1)return firstEnumeration;return [{id:'screen:second'}];}});
const [first,second]=await Promise.all([authority.list(),authority.list()]);
assert.equal(enumerateCount,1,'Overlapping source requests must share one native enumeration.');
assert.equal(first.timedOut,true);assert.equal(second.timedOut,true);
assert.equal(authority.busy(),true,'Timed-out discovery must not spawn another native request while the first is pending.');
releaseFirst([{id:'screen:first'}]);await firstEnumeration;await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(authority.busy(),false);
const recovered=await authority.list();assert.equal(enumerateCount,2);assert.equal(recovered.ok,true);assert.equal(authority.get('screen:second')?.id,'screen:second');

let familyCall=0;
const familyAuthority=createShareSourceAuthority({timeoutMs:100,enumerateSources:async options=>{familyCall+=1;return String(options?.kind||'screen')==='window'?[{id:'window:one'}]:[{id:'screen:one'}];}});
await Promise.all([familyAuthority.list({kind:'screen'}),familyAuthority.list({kind:'window'})]);
assert.equal(familyCall,2,'Basic must enumerate one screen family and one window family without overlap.');
assert.equal(familyAuthority.get('screen:one')?.id,'screen:one','Screen source must remain selectable after window enumeration finishes.');
assert.equal(familyAuthority.get('window:one')?.id,'window:one','Window source must remain selectable alongside screen sources.');

// macOS may read the lightweight TCC status to recognize an already-granted
// installation. It must not enumerate desktop sources merely to decide which
// chooser to show. Unknown/ungranted sessions still let native getDisplayMedia
// own first authorization; an explicitly granted/proven Mac gets DominionStar's
// Zoom-style chooser immediately.
assert(main.includes("systemPreferences.getMediaAccessStatus(kind)"),'macOS TCC status authority is missing.');
assert(main.includes("permissionStatus('screen')"),'Screen Recording status must remain independently inspectable.');
assert(main.includes('function activeScreenCaptureProbe()')&&main.includes('screenPermissionProbeInFlight'),'Explicit post-failure recovery probe must remain single-flight.');
assert(main.includes('capture-probe-timeout')&&main.includes('2200'),'Explicit recovery probing must remain bounded.');
assert(main.includes("media:request-screen"),'Renderer must retain narrow post-failure diagnostics.');

assert.equal((service.match(/setDisplayMediaRequestHandler/g)||[]).length,1,'Exactly one Electron display-media handler call site may own capture.');
assert(service.includes("const nativeSystemPicker=platform==='darwin'&&macMajor>=15"),'macOS native-picker capability detection is mandatory.');
assert(service.includes('function configureDisplayMediaHandler(useSystemPicker)'),'Share service must explicitly switch native-vs-DominionStar selection authority.');
assert(service.includes("configureDisplayMediaHandler(nativeSystemPicker)"),'macOS must begin native-safe before permission state is known.');
assert(service.includes("if(nativeSystemPicker&&status!=='granted')"),'Unknown/ungranted macOS sessions must retain native authorization/selection.');
assert(service.includes("configureDisplayMediaHandler(true)")&&service.includes("nativeSystemPicker:true,status:'system-picker'"),'Native fallback path is missing.');
assert(service.includes("configureDisplayMediaHandler(false)"),'Granted/proven sessions must be able to switch to DominionStar source selection.');
assert(preload.includes("openPicker:permission=>invoke('share:open-picker',{permission:String(permission||'unknown')})"),'Narrow picker-mode state must cross the preload bridge.');

// Zoom-style chooser: Basic presents screens + application windows in one grid,
// desktop is selected by default, and Advanced / Files remain first-class tabs.
assert(service.includes("types:[kind]"),'Source authority must enumerate only the selected source class.');
assert(service.includes("thumbnailSize:{width:320,height:180}"),'Source previews must remain bounded.');
assert(service.includes("fetchWindowIcons:false"),'Source discovery must not request unnecessary application icons.');
assert(service.includes("!/DominionStar Meet/i.test"),'DominionStar windows must be filtered from normal source selection.');
assert(picker.includes("includeDominionStar:false"),'User-facing chooser must keep DominionStar windows excluded.');
assert(picker.includes("kind:'screen'")&&picker.includes("kind:'window'")&&picker.includes('Promise.all(['),'Basic must fetch real desktops and real application windows together.');
assert(picker.includes('basicSources=[...(screenResult?.sources||[]),...(windowResult?.sources||[])]'),'Basic must merge the discovered desktop and window sources.');
assert(picker.includes("const firstScreen=basicSources.find(source=>source.kind==='screen')")&&picker.includes("selectedId=String(firstScreen?.id"),'Zoom-style Basic must preselect the first desktop when available.');
assert(picker.includes('source.thumbnail'),'Chooser must render live source previews.');
assert(pickerHtml.includes('data-tab="basic">Basic')&&pickerHtml.includes('data-tab="advanced">Advanced')&&pickerHtml.includes('data-tab="files">Files'),'Chooser must expose Basic, Advanced, and Files tabs.');
assert(pickerHtml.includes('Share sound')&&pickerHtml.includes('Optimize for video clip')&&pickerHtml.includes('Optimize for sharing video'),'Chooser must expose the screenshot-approved bottom share options.');
assert(!pickerHtml.includes('Show DominionStar windows'),'Normal presenter flow must not expose an easy recursion toggle.');
assert(pickerCss.includes('grid-template-columns:repeat(4,minmax(0,1fr))'),'Desktop chooser must use the approved Zoom-density four-column source grid.');
assert(pickerCss.includes('.tab.active{border-bottom-color:var(--blue)'),'Active share tab must use a Zoom-style blue underline.');
assert(pickerCss.includes('.primary{min-width:80px;background:var(--blue)'),'Share action must remain a clear blue bottom-right primary button.');
assert(!picker.includes('showModal')&&!pickerHtml.includes('<dialog'),'Share chooser must remain a separate desktop window, not an in-meeting blocking modal.');

// Initial Share is permission-aware, never source-probe-driven. Explicitly
// granted/proven installs skip Apple's full-screen chooser; unknown permission
// stays native-first so macOS can authorize safely.
assert(mediaController.includes("script.src='./share-integration.js'"),'Media controller must own one Share integration bootstrap path.');
assert(!integration.includes('bridge?.probeAccess?.()'),'Share entry must not enumerate desktop sources as a permission probe.');
assert(integration.includes("const SCREEN_CAPTURE_PROVEN_KEY='ds_screen_capture_proven_v2'"),'Successful screen-capture proof must persist across renderer relaunches.');
assert(integration.includes('async function grantedScreenPermission()'),'Granted-screen authority helper is missing.');
assert(integration.includes("desktop?.media?.permissions?.()"),'Share entry must be able to read lightweight macOS permission status.');
assert(integration.includes("String(permissions?.screen||'').toLowerCase()==='granted'"),'Only explicit granted Screen Recording status may bypass native authorization.');
assert(integration.includes('const proven=replace||share.snapshot().active||await grantedScreenPermission();'),'Share entry must combine active/proven capture with explicit granted macOS status.');
assert(integration.includes("const permission=proven?'granted':'unknown';"),'Unproven permission must stay unknown and granted/proven permission must select DominionStar chooser.');
assert(integration.includes('const result=await bridge.openPicker(permission);'),'Share entry must pass only the resolved permission mode into selection authority.');
assert(integration.includes("if(result?.nativeSystemPicker)return {mode:'native'}"),'Renderer must retain native authorization fallback.');
assert(integration.includes('markCaptureProven();applyLayout();'),'Successful capture must persist proof before continuing.');
assert(integration.includes('queueMicrotask(()=>{void beginShare()'),'Share command must not depend on requestAnimationFrame.');
assert(!integration.includes('requestAnimationFrame(()=>setTimeout'),'Functional Share start must not be paint-frame gated.');
const pickerCall=integration.indexOf('const result=await bridge.openPicker(permission);');
const deepDiagnostic=integration.indexOf('desktop?.media?.requestScreen?.()');
assert.ok(pickerCall>=0&&deepDiagnostic>pickerCall,'Deep TCC diagnostics must occur only after real picker/capture failure.');
assert(integration.includes('showScreenPermissionDialog')&&integration.includes('Open Settings'),'Denied Screen Recording must provide compact System Settings recovery.');
assert(!integration.includes('data-permission-reset'),'Primary Share recovery must not offer destructive TCC reset as a normal action.');
assert(shareCss.includes('top:68px')&&shareCss.includes('width:min(430px'),'Permission recovery must remain compact instead of covering the meeting.');

// Capture/paused/annotation behavior remains single-owner and transactional.
assert((controller.match(/getDisplayMedia/g)||[]).length>=2,'Display capture authority must remain isolated in ShareController.');
const directDisplayCall=/\.getDisplayMedia\s*\(/;
assert(!directDisplayCall.test(integration)&&!directDisplayCall.test(preload)&&!directDisplayCall.test(picker),'Integration/preload/picker must never acquire display media directly.');
assert(controller.includes("context.drawImage(videoElement,0,0,width,height)"),'Pause must freeze the exact last shared frame.');
assert(controller.includes('canvas.captureStream(1)'),'Pause must create a frozen stream, not black video.');
assert(controller.includes('const baseOutputStream=()=>state.paused&&state.frozenStream?state.frozenStream:state.liveStream'),'Paused/live output switching must remain deterministic.');
assert(controller.includes("audioTrack.contentHint='music'"),'Shared computer audio must retain presentation quality intent.');
assert(annotation.includes('setAnnotationCanvas')&&annotation.includes('drawLaser')&&annotation.includes('clearLaser(650)'),'Annotation/laser must remain attached to the single share controller.');
assert(controller.includes('stopTracks(state.liveStream)'),'Stop Share must release the live capture track.');
assert(controller.includes("presenter?.toolbarReady===false"),'A successful capture must fail closed if presenter controls are unavailable.');
assert(controller.includes("Presenter controls could not start. Screen sharing was cancelled safely."),'Toolbar-start failure must surface a clear safe-cancel error.');
assert(controller.includes("try{await bridge?.captureStopped?.();}catch{}"),'Toolbar-start failure must unwind native presenter state before returning control to the meeting.');
assert(controller.includes('rendererCommitted:true')&&controller.includes('setTimeout(()=>'),'Share start must defer meeting-hide authority until after the renderer promise can commit.');
assert(controller.includes('async function replaceSource')&&controller.includes('const previousLive=state.liveStream'),'New Share must remain transactional.');
assert(integration.includes("async function openPickerWithPermission(){clearCompanion();return beginShare({replace:share.snapshot().active});}")&&integration.includes("if(command==='new-share'){await openPickerWithPermission();return;}"),'Presenter New Share must clear companion UI and route through the same permission-aware transactional chooser.');

// Zoom presenter-state contract: normal presentation hides the full meeting, but
// Chat/Participants/Annotate open purpose-built companion surfaces rather than
// resurrecting the entire meeting chrome. Stop Share retains a recovery retry.
assert(service.includes('function hideMeetingWindowForShare()'),'Share service must have a dedicated hide-meeting presenter state.');
assert(service.includes('main.hide()'),'The normal meeting window must be hidden during normal presentation state.');
assert(service.includes('function showCompanionWindow(kind=\'chat\')'),'Sharing must have dedicated companion-window authority.');
assert(service.includes("['participants','chat','annotate'].includes(normalized)&&shareActive"),'Presenter companion commands must be handled explicitly during an active share.');
assert(service.includes('showCompanionWindow(normalized)'),'Chat/Participants/Annotation must open companion geometry instead of the full meeting.');
assert(shareCss.includes('data-ds-share-companion="chat"')&&shareCss.includes('data-ds-share-companion="participants"')&&shareCss.includes('data-ds-share-companion="annotate"'),'Share companion CSS modes are incomplete.');
assert(integration.includes("setCompanion('participants')")&&integration.includes("setCompanion('chat')")&&integration.includes("setCompanion(active?'annotate':'')"),'Renderer must identify each active share companion.');
assert(service.includes('async function openToolbar()'),'Presenter toolbar creation must be awaitable.');
assert(service.includes("await created.loadFile(path.join(uiDir,'presenter-toolbar.html'))"),'Presenter toolbar must finish loading before it can own the presentation.');
const captureStarted=service.slice(service.indexOf("ipcMain.handle('share:capture-started'"),service.indexOf("ipcMain.handle('share:capture-state'"));
assert(captureStarted.includes('const toolbarReady=await openToolbar();'),'Capture start must await presenter-toolbar readiness.');
assert(!captureStarted.includes('hideMeetingWindowForShare()'),'Capture start must return to the renderer before the meeting is hidden.');
assert(captureStarted.includes('meetingHidden:false')&&captureStarted.includes('awaitingRendererCommit:Boolean(toolbarReady)'),'Capture start must explicitly remain visible while awaiting renderer commit.');
const captureState=service.slice(service.indexOf("ipcMain.handle('share:capture-state'"),service.indexOf("ipcMain.handle('share:capture-stopped'"));
assert(captureState.includes('rendererCommitted=state?.rendererCommitted===true'),'Capture state must recognize the renderer-commit phase.');
assert(captureState.includes('if(shareActive&&rendererCommitted)')&&captureState.includes('hideMeetingWindowForShare()'),'Meeting hide must occur only after the renderer commits the active share.');
assert(service.includes("main.webContents?.setBackgroundThrottling?.(false)"),'Hidden meeting renderer must not throttle the active share.');
assert(service.includes("setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true"),'Presenter toolbar must remain available across macOS Spaces/full-screen apps.');
assert(service.includes("setAlwaysOnTop(true,'floating')"),'Presenter toolbar must stay above shared applications.');
assert(service.includes('backgroundThrottling:false'),'Presenter toolbar must remain responsive while the meeting window is hidden.');
assert(service.includes('acceptFirstMouse:true'),'Presenter toolbar must accept its first macOS click without requiring a focus-only click.');
assert(!service.includes("type:platform==='darwin'?'panel':undefined"),'Presenter toolbar must not use the unsupported macOS nonactivating panel window type.');
assert(service.includes("if(normalized==='stop'&&shareActive)")&&service.includes("showMeetingWindow({focus:false});sendMain('share:presenter-command','stop')"),'Stop Share must have a wake-and-retry fallback if the hidden renderer delays acknowledgement.');
assert(toolbar.includes('data-command="stop"')&&toolbar.includes('Stop Share'),'Floating presenter toolbar must expose Stop Share directly.');
assert(toolbarCss.includes('min-width:104px')&&toolbarCss.includes('background:#d83d4c'),'Stop Share must be visually dominant and large enough to click reliably.');
assert(toolbarJs.includes("if(command==='stop')")&&toolbarJs.includes("label.textContent='Stopping…'"),'Stop Share click must immediately enter a visible stopping state.');
assert(service.includes("maxHeight:310")&&service.includes("transparent:true,backgroundColor:'#00000000'"),'Presenter toolbar window must have a bounded transparent expansion surface for popovers.');
assert(service.includes("ipcMain.handle('share:presenter-menu-state'")&&service.includes("const nextHeight=open?300:82"),'Presenter popovers must expand and collapse the toolbar window explicitly.');
assert(preload.includes("setMenuOpen:open=>invoke('share:presenter-menu-state'"),'Presenter menu sizing must cross only the narrow preload bridge.');
assert(toolbarJs.includes("setMenuExpanded(!more.hidden)")&&toolbarJs.includes("window.addEventListener('blur'"),'Presenter More/Reactions menus must expand on open and collapse on blur.');
assert(toolbarCss.includes(".more-menu{position:absolute;right:0;top:66px;bottom:auto;"),'Presenter More menu must render below the toolbar inside expanded window bounds.');
assert(toolbarCss.includes(".presenter-reaction-menu{position:absolute;right:190px;top:0;bottom:auto;"),'Presenter reaction menu must remain inside the expanded presenter window.');
assert(!toolbarJs.includes("command='smart-new-share'"),'Presenter New Share must not be rewritten to an unhandled command.');
assert(service.includes("if(lastToolbarState.meetingVisible)hideMeetingWindowForShare()"),'Show/Hide meeting must remain explicit presenter control, not default visibility.');

assert(media.includes("script.src='./share-integration.js'"),'Desktop/web bundle must retain the same isolated Share integration.');
assert(!integration.includes('showModal'),'Meeting share integration must never create a blocking modal.');
console.log('DOMINIONSTAR_SHARE_AUTHORITY_OK permission-aware-initial-share granted-custom-chooser native-unproven-fallback no-source-probe persistent-capture-proof zoom-basic-advanced-files real-desktop-and-window-grid multi-family-source-cache default-desktop-selection dominionstar-window-exclusion nonblocking-share-start toolbar-before-hide two-phase-renderer-commit hidden-meeting-default share-companions persistent-presenter-toolbar direct-stop-share transactional-new-share pause-freeze annotation-single-owner');