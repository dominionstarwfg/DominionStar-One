import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const url=rel=>new URL(`../${rel}`,import.meta.url);
const read=rel=>fs.readFileSync(url(rel),'utf8');
const syntax=rel=>execFileSync(process.execPath,['--check',fileURLToPath(url(rel))],{stdio:'pipe'});
const pkg=JSON.parse(read('package.json'));
const auth=read('ui/auth-password.js');
const refJs=read('ui/zoom-screenshot-reference-2.0.41.js');
const refCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const pickerHtml=read('ui/share-picker.html');
const pickerCss=read('ui/share-picker.css');
const pickerJs=read('ui/share-picker.js');
const shareService=read('src/share-service.mjs');
const shareController=read('ui/share-controller.js');
const bootstrap=read('src/bootstrap.mjs');
const preload=read('src/preload.cjs');
const presenterPreload=read('src/presenter-preload.cjs');
const macOverlay=read('src/mac-share-presenter-overlay.mjs');
const macToolbarHtml=read('ui/mac-presenter-toolbar.html');
const macToolbarCss=read('ui/mac-presenter-toolbar.css');
const macToolbarJs=read('ui/mac-presenter-toolbar.js');
const activeShareHome=read('ui/active-share-home-parity-2.0.41.js');

const has=(s,n,m)=>assert.ok(s.includes(n),m);
const lacks=(s,n,m)=>assert.ok(!s.includes(n),m);

assert.equal(pkg.version,'2.0.41','Zoom screenshot reference lock must run only on 2.0.41.');
has(auth,"zoom-screenshot-reference-2.0.41.css",'Screenshot reference CSS is not loaded.');
has(auth,"zoom-screenshot-reference-2.0.41.js",'Screenshot reference JS is not loaded.');
has(auth,'script.onload=loadScreenshotReference','Screenshot reference must load after runtime stability completes.');
has(auth,'if(window.DominionRuntimeStability)loadScreenshotReference()','Existing runtime stability must hand off to the screenshot reference authority.');
has(auth,'active-share-home-parity-2.0.41.js','Active-share Home awareness must load after the screenshot authority.');
has(auth,'script.onload=loadActiveShareHome','Active-share Home awareness must wait for the screenshot authority.');

// Home screenshot contract.
has(refCss,'grid-template-columns:82px minmax(0,1fr)','Home must use the narrow Zoom-style app rail.');
has(refCss,'grid-template-columns:minmax(520px,1fr) 330px','Home must use action area + right calendar panel.');
has(refCss,'#homeSection .action-icon','Home must use icon-first meeting actions rather than dashboard cards.');
has(refJs,'My Notes','Home must include a working local My Notes action.');
has(refJs,'ds-ref-search','Home must include the compact top search surface.');
has(activeShareHome,'Back to meeting','An active shared meeting must replace New Meeting with Back to meeting on Home.');
has(activeShareHome,"data-action=\"back-to-meeting\"",'Back to meeting must be a real command surface.');
has(activeShareHome,'desktop.macShare?.onShowMeeting','The native presenter Show meeting command must restore the existing meeting.');
has(activeShareHome,"node.disabled=true",'Join and Share Screen must not start competing flows while the active shared meeting is on Home.');

// Prejoin screenshot contract.
has(refCss,'width:548px!important','Prejoin must remain a compact Zoom-scale dialog.');
has(refJs,'Always show this preview when joining','Prejoin preference row is missing.');
has(refJs,"strong.textContent='Backgrounds'",'Prejoin Backgrounds label is not normalized.');

// Meeting toolbar contract.
for(const label of ['Audio','Video','Participants','Chat','React','Raise hand','Share','Host tools','More','End'])has(refJs,`'${label}'`,`Meeting toolbar is missing ${label}.`);
has(refCss,'height:56px!important','Meeting bottom toolbar must keep the compact Zoom-scale height.');
has(refCss,'grid-template-columns:minmax(142px,1fr) auto minmax(142px,1fr)','Meeting toolbar must preserve left/center/right zoning.');

// Participants / participant-wide controls are separate from Host tools.
has(refJs,'ds-ref-participants-footer','Participants footer is missing.');
has(refJs,'Ask all to unmute','Participants More popover is missing Ask all to unmute.');
has(refJs,'Mute all upon entry','Participants More popover is missing mute-on-entry.');
has(refJs,'Play join and leave sound','Participants More popover is missing join/leave sound.');
has(refJs,'Host tools for participants','Participants More popover is missing Host tools for participants.');
has(refJs,'data-clear disabled','Unimplemented participant feedback clearing must remain physically disabled.');
has(refCss,'#participantRoster .ds-participant-media{display:none!important','Rejected duplicate participant media renderer must stay hidden.');

// Host tools is its own right-side sheet.
has(refJs,'ds-ref-host-tools-panel','Host tools right panel is missing.');
has(refJs,'Lock meeting','Host tools is missing Lock meeting.');
has(refJs,'Enable waiting room','Host tools is missing waiting-room position.');
has(refJs,'data-waiting disabled','Waiting-room control must stay physically disabled until the live room-security RPC supports switching.');
has(refJs,'Dynamic waiting-room switching is not exposed by the current room-security RPC','Waiting-room disabled state must explain its authority limitation.');
has(refJs,'Hide profile pictures','Host tools is missing Hide profile pictures.');
has(refJs,'data-participants','Host tools is missing Participants navigation.');
has(refJs,'data-advanced','Host tools is missing Advanced navigation.');

// More is its own tool grid.
has(refJs,'ds-ref-meeting-more-grid','Meeting More grid is missing.');
for(const label of ['Record','Show captions','Breakout rooms','Polls/quizzes','Docs','Whiteboards','Apps','Meeting info','Transfer to room','Settings'])has(refJs,`'${label}'`,`Meeting More is missing ${label}.`);
for(const label of ['Breakout rooms','Polls/quizzes','Docs','Whiteboards','Apps','Transfer to room']){
  const marker=`addMoreItem(grid,'${label}'`;
  const start=refJs.indexOf(marker);assert.ok(start>=0,`Meeting More is missing ${label}.`);
  has(refJs.slice(start,start+420),'{disabled:true}',`${label} must remain physically disabled until its backend/product capability is certified.`);
}
has(refJs,'Drag to pin or remove from toolbar','Meeting More footer reference is missing.');

// Pre-share screenshot contract.
has(pickerHtml,'data-tab="screens">Screens','Pre-share must expose Screens.');
has(pickerHtml,'data-tab="files" aria-disabled="true" disabled tabindex="-1"','Pre-share Files reference position must be physically non-interactive.');
has(pickerHtml,'data-tab="advanced">More','Pre-share must expose More.');
has(pickerCss,'.tab[aria-disabled="true"]{opacity:.92;cursor:default;pointer-events:none}','Aria-disabled pre-share capabilities must reject pointer activation.');
has(pickerHtml,'Presenter layout','Pre-share right rail is missing Presenter layout.');
for(const label of ['Content only','As background','Over the shoulder','Side by side','Share sound','Optimize for video sharing','Share DominionStar Meet windows'])has(pickerHtml,label,`Pre-share is missing ${label}.`);
has(pickerJs,"sectionMarkup('Entire screen'",'Pre-share must group the entire desktop first.');
has(pickerJs,"sectionMarkup('Application windows'",'Pre-share must group application windows separately.');
has(pickerJs,"kind:'screen'",'Pre-share is not enumerating real screens.');
has(pickerJs,"kind:'window'",'Pre-share is not enumerating real application windows.');
has(pickerJs,'source.thumbnail','Pre-share must render real source previews.');
has(pickerCss,'.source-section.screen-section','Pre-share screen group styling is missing.');
has(pickerCss,'.presenter-layout','Pre-share presenter rail styling is missing.');
has(pickerCss,'.loading-state[hidden],.error-state[hidden]{display:none!important}','Hidden pre-share state overlays must remain physically non-rendering.');
lacks(pickerHtml,'Share This Window','Apple system overlay language must never be part of the DominionStar picker.');

// Capture ownership and bounded start remain hard requirements.
has(shareService,'const nativeSystemPicker=false','Apple system picker must remain disabled in the active DominionStar share path.');
has(shareController,"error.code='share_start_timeout'",'Share start must fail visibly when capture does not start.');
has(shareController,'},5000);','Share start must remain bounded to five seconds.');

// Main-renderer active-share reference remains the fallback/cross-platform path.
has(refJs,"overlay.classList.add('ds-ref-presenter-visible')",'Presenter toolbar reveal authority is missing.');
has(refJs,"overlay.classList.remove('ds-ref-presenter-visible'),1650",'Presenter toolbar idle auto-hide is missing.');
has(refJs,"'Layout'",'Presenter toolbar is missing Layout.');
has(refJs,"'Show meeting'",'Presenter toolbar is missing Show meeting.');
has(refJs,'Stop share','Presenter green strip is missing Stop share.');
has(refCss,'opacity:0!important;pointer-events:none!important','Presenter toolbar must be hidden while idle.');
has(refCss,'.ds-ref-presenter-visible #inlinePresenterToolbar','Presenter toolbar must become interactive only when revealed.');

// Physical macOS presenter path. The chrome is prepared when source
// enumeration starts, which is safely before getDisplayMedia capture but after
// the main renderer is authoritative. This avoids a hidden file:// window
// competing with the meeting renderer at app launch.
has(bootstrap,"await import('./main.mjs')",'Main window must initialize before native presenter preparation authority.');
has(bootstrap,"await import('./mac-share-presenter-overlay.mjs')",'macOS presenter overlay authority is not initialized.');
has(macOverlay,'show:false','Native presenter windows must remain hidden while being prepared.');
has(macOverlay,"ipcMain.handle('mac-share:prepare'",'macOS presenter chrome needs an explicit pre-capture preparation gate.');
has(preload,"const prepareMacPresenter=()=>process.platform==='darwin'?invoke('mac-share:prepare')",'The preload must expose bounded macOS presenter preparation.');
has(preload,'listSources:async options=>{await prepareMacPresenter();','Presenter chrome must be prepared before source enumeration/capture.');
has(preload,'openPicker:async permission=>{await prepareMacPresenter();','Legacy/custom picker entry must also prepare presenter chrome before capture.');
lacks(macOverlay,'\n  void prepare();','Presenter chrome must not auto-create a hidden file:// target at app launch.');
has(macOverlay,"ipcMain.on('share:capture-started'",'Native presenter overlay must activate from the real capture-started event.');
has(macOverlay,"ipcMain.on('mac-share:capture-stopped'",'Native presenter overlay must close from the real capture-stopped event.');
has(macOverlay,'setContentProtection(true)','Presenter chrome must be protected from recursive screen capture.');
has(macOverlay,'border:4px solid #2ed573','Entire-display sharing must have a local green sharing boundary.');
has(macOverlay,"includes('/ui/index.html')",'Native presenter commands must resolve the canonical meeting renderer rather than auxiliary windows.');
has(macOverlay,'presenter_command_ack_timeout','Native presenter commands must fail if the meeting renderer does not acknowledge delivery.');
has(macOverlay,"const presenterPreloadPath=path.join(here,'presenter-preload.cjs')",'Floating presenter surfaces must use the isolated presenter preload.');
has(macOverlay,'preload:presenterPreloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false','App-owned presenter renderers must use the isolated non-sandboxed preload path that avoids the Electron sandbox startup race.');
has(presenterPreload,"const {contextBridge,ipcRenderer}=require('electron')",'Isolated presenter preload is missing its Electron bridge.');
has(presenterPreload,'macShare:Object.freeze','Isolated presenter preload must expose the acknowledged native command bridge.');
lacks(presenterPreload,'meeting:Object.freeze','Auxiliary presenter preload must not expose the full meeting API.');
has(preload,"ipcRenderer.send('mac-share:state'",'Live share/media state must reach the macOS presenter overlay.');
has(preload,"ipcRenderer.send('mac-share:capture-stopped'",'The macOS presenter overlay must receive authoritative Stop Share state.');
has(preload,"ipcRenderer.send('share:presenter-delivery-ack'",'The meeting renderer preload must acknowledge native presenter command delivery.');
has(preload,'macShare:Object.freeze','The native presenter control bridge is missing.');
for(const label of ['Audio','Video','Participants','Chat','Share','Pause','Layout','Annotate','Show meeting','More'])has(macToolbarHtml,`>${label}<`,`Native presenter toolbar is missing ${label}.`);
has(macToolbarHtml,'id="stopShare"','Native presenter toolbar is missing the Stop Share control.');
has(macToolbarHtml,'id="stopShareLabel">Stop Share<','Native presenter toolbar is missing the Stop Share label.');
has(macToolbarHtml,'class="stop-share-icon"','Native Stop Share must use a real vector icon rather than a text symbol.');
has(macToolbarHtml,'<svg viewBox="0 0 16 16">','Native Stop Share vector icon is missing.');
lacks(macToolbarHtml,'■ Stop','Native presenter toolbar must not use a text-square Stop Share icon.');
has(macToolbarHtml,'DominionStar','Native presenter toolbar must retain DominionStar branding.');
has(macToolbarCss,'.share-strip','Native presenter toolbar must retain a dedicated live-sharing strip.');
has(macToolbarCss,'background:#27c96b','Native presenter toolbar must include the green live-sharing strip.');
has(macToolbarCss,'.toolbar.auto-hidden','Native presenter toolbar must auto-hide its controls without hiding sharing state.');
has(macToolbarCss,'.stop-share-icon svg','Native Stop Share vector icon styling is missing.');
has(macToolbarJs,'const nativeBridge=desktop.macShare||null','Native presenter toolbar must retain the acknowledged macOS command bridge.');
has(macToolbarJs,'const rendererBridge=desktop.presenter||null','Native presenter toolbar must retain the renderer fallback bridge.');
has(macToolbarJs,'result=await nativeBridge.command(normalized)','Native presenter toolbar must use acknowledged Mac delivery.');
has(macToolbarJs,'result=await rendererBridge.command(command)','Native presenter toolbar must retain confirmed renderer fallback delivery.');
has(macToolbarJs,"result.direct===true||result.acknowledged===true||result.handled===true",'Presenter controls must require execution evidence, not a generic ok response.');
lacks(macToolbarJs,"result.handled===true||result.ok===true",'A generic ok:true must not count as presenter command execution proof.');
const nativeFirst=macToolbarJs.indexOf('try{return await sendNative(normalized);}');
const rendererFallback=macToolbarJs.indexOf('if(rendererBridge?.command)return await sendRenderer(normalized);');
assert.ok(nativeFirst>=0&&rendererFallback>nativeFirst,'Native presenter toolbar must route live controls through acknowledged native delivery first, with confirmed renderer fallback only.');
has(macToolbarJs,"transport:nativeBridge?.command?'macShare-ack-first'",'Native presenter toolbar must expose acknowledged-native-first transport authority for packaged QA.');
has(macToolbarJs,"const label=q('#stopShareLabel')",'Stop Share state feedback must preserve the vector icon.');
lacks(macToolbarJs,"textContent='■",'Stop Share runtime state must not reintroduce a text-square icon.');
has(macToolbarJs,"state?.paused",'Native presenter toolbar must reflect real Pause/Resume state.');
has(macToolbarJs,"state?.micOn",'Native presenter toolbar must reflect real microphone state.');
has(macToolbarJs,"state?.cameraOn",'Native presenter toolbar must reflect real camera state.');

for(const rel of ['src/mac-share-presenter-overlay.mjs','src/presenter-preload.cjs','ui/mac-presenter-toolbar.js','ui/active-share-home-parity-2.0.41.js'])syntax(rel);

// Privacy rule.
for(const source of [refJs,refCss,pickerHtml,pickerJs,pickerCss,macOverlay,presenterPreload,macToolbarHtml,macToolbarCss,macToolbarJs,activeShareHome]){
  lacks(source,'Screenshot 2026-09-03','User screenshots must never be embedded in app source.');
  lacks(source,'private-user-images.githubusercontent.com','User image uploads must never be linked into the product.');
}

console.log('DOMINIONSTAR_ZOOM_SCREENSHOT_REFERENCE_2_0_41_OK home active-meeting-home prejoin meeting-toolbar participants participant-more host-tools meeting-more truthful-disabled-capabilities zoom-preshare bounded-share mouse-reveal-presenter mac-share-time-presenter green-share-boundary acknowledged-mac-presenter-routing isolated-presenter-preload vector-stop-share privacy');
