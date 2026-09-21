import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const toolbar=read('ui/mac-presenter-toolbar.js');
const screenshotReference=read('ui/zoom-screenshot-reference-2.0.41.js');
const screenshotReferenceCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const integration=read('ui/share-integration.js');
const mirror=read('src/mac-share-video-mirror.mjs');
const featureReady=read('ui/meeting-feature-ready-2.0.41.js');
const participantsReference=read('ui/zoom-participants-reference-2.0.41.js');
const pkg=JSON.parse(read('package.json'));

new Function(toolbar);
new Function(integration);

assert.equal(pkg.version,'2.0.42','Active-share grouped repair must ship under a new version.');
assert(toolbar.includes("version:'2.0.42-strict-direct-native-ack-fallback'"),'Mac presenter toolbar must identify the strict direct-first plus acknowledged fallback authority.');
assert(toolbar.includes("result.direct===true||result.acknowledged===true||result.handled===true")&&!toolbar.includes("result.handled===true||result.ok===true"),'A generic ok:true must never count as proof that a presenter command executed.');
const sendBlock=toolbar.slice(toolbar.indexOf('const send=async command=>'),toolbar.indexOf("q('#layoutButton')"));
const directFirst=sendBlock.indexOf('try{return await sendRenderer(normalized);}');
const nativeFallback=sendBlock.indexOf('if(nativeBridge?.command)return sendNative(normalized);');
assert(directFirst>=0&&nativeFallback>directFirst,'Visible Mac presenter controls must preserve direct-first routing but fall back to acknowledged native delivery when execution is not proven.');

assert(integration.includes('async function openPickerWithPermission(){')&&integration.includes('const approved=window.DominionShareRuntimeAuthority2041;')&&integration.includes('if(approved?.open)return approved.open();'),'Presenter New Share must reopen the approved 2.0.41 runtime chooser.');
assert(integration.includes('desktop?.sharePicker?.cancel?.()'),'A completed Stop Share transition must close any stale legacy picker before the next meeting interaction.');
assert(integration.includes('window.DominionShareRuntimeAuthority2041?.close?.()'),'Stop Share must close the in-renderer approved chooser.');
assert(integration.includes('shareWasActive&&!active')&&integration.includes('window.DominionActiveShareHomeParity2041?.restoreMeeting?.()'),'The authoritative active-to-inactive transition must explicitly restore the active meeting surface.');

assert(mirror.includes('window.DominionMediaController||null')&&mirror.includes('controller?.stream?.()'),'Floating participant video must read the authoritative camera stream, not only one DOM video element.');
assert(mirror.includes("typeof ImageCapture==='function'")&&mirror.includes('new ImageCapture(track).grabFrame()'),'Camera mirror must retain a frame-capture fallback when no live DOM video surface is paintable.');
assert(mirror.includes("candidates.find(item=>item.id==='localMeetingVideo')||candidates[0]"),'Camera mirror must accept any live element bound to the authoritative camera track.');
assert(screenshotReference.includes('data-ds-ref-critical-meeting-geometry')&&screenshotReference.includes('grid-template-rows:47px minmax(0,1fr) 56px!important')&&screenshotReference.includes('max-height:56px!important'),'Final screenshot authority must synchronously hard-lock the packaged meeting toolbar to the 56px Zoom-reference geometry.');
assert(screenshotReference.includes('function claimFinalMeetingAuthority(){')&&screenshotReference.includes("overlay.classList.remove('ds-exec-lock')")&&screenshotReference.includes("qa('#meetingOverlay .ds-exec-icon,#meetingOverlay .ds-exec-label,#meetingOverlay .ds-exec-encrypted,#meetingOverlay .ds-exec-divider')"),'Final Zoom-reference sync must synchronously strip stale executive geometry before any packaged interaction measurement.');
assert(screenshotReferenceCss.includes('#meetingOverlay #participantRoster .person-row{min-height:52px!important')&&screenshotReferenceCss.includes('#meetingOverlay #participantRoster .person-copy strong{font-size:13px!important')&&screenshotReferenceCss.includes('.ds-participant-more{width:28px!important;height:28px!important;min-width:28px!important'),'The actually loaded final screenshot stylesheet must preserve readable Participants rows and ellipsis hit targets.');

new Function(featureReady);
assert(featureReady.includes('function finalReferenceReady(){return Boolean(window.DominionZoomScreenshotReference?.sync);}')&&featureReady.includes("o.classList.remove('ds-exec-lock')"),'Legacy 2.0.41 meeting chrome must yield its geometry class when the final Zoom-reference authority is available.');
assert(featureReady.includes("o.querySelectorAll('.ds-exec-icon,.ds-exec-label,.ds-exec-encrypted,.ds-exec-divider')")&&featureReady.includes("o.querySelectorAll('.ds-exec-control')"),'Final-reference handoff must remove stale executive toolbar decoration that can widen or shift controls.');
assert(featureReady.includes('window.DominionZoomScreenshotReference?.requestSync?.()'),'Legacy-to-final handoff must immediately reassert final Zoom-reference geometry after cleanup.');
assert(participantsReference.includes('min-height:52px!important;height:52px!important')&&participantsReference.includes('white-space:nowrap!important;font-size:13px!important;font-weight:600!important;color:#f3f3f4!important}')&&participantsReference.includes('width:28px!important;height:28px!important;min-width:28px!important'),'Final Participants reference must keep readable row, name, and ellipsis hit-target scale under packaged physical acceptance.');

console.log('DOMINIONSTAR_ACTIVE_SHARE_REPAIR_2_0_42_OK acknowledged-toolbar canonical-new-share clean-stop authoritative-camera-mirror stable-final-toolbar-handoff readable-participant-scale');
