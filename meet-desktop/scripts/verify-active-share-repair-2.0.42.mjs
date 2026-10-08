import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const toolbar=read('ui/mac-presenter-toolbar.js');
const screenshotReference=read('ui/zoom-screenshot-reference-2.0.41.js');
const screenshotReferenceCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const integration=read('ui/share-integration.js');
const macVideo=read('ui/mac-share-video.js');
const featureReady=read('ui/meeting-feature-ready-2.0.41.js');
const participantsReference=read('ui/zoom-participants-reference-2.0.41.js');
const pkg=JSON.parse(read('package.json'));

new Function(toolbar);
new Function(integration);
new Function(macVideo);

assert.ok(['2.0.46','2.0.47','2.0.48','2.0.49','2.0.50','2.0.51','2.0.52'].includes(pkg.version),'Active-share grouped repair must remain present across the current 2.0.46+ production repair line.');
assert(toolbar.includes("version:'2.0.45-stateful-share-chrome'"),'Mac presenter toolbar must identify the current stateful share-chrome authority.');
assert(toolbar.includes("result.ok!==false")&&toolbar.includes("result.ok===true||result.direct===true||result.acknowledged===true||result.handled===true"),'Presenter commands must require positive execution evidence and reject negative acknowledgements before a click is treated as successful.');
const sendBlock=toolbar.slice(toolbar.indexOf('const send=async command=>'),toolbar.indexOf("q('#moreButton')"));
const nativeFirst=sendBlock.indexOf('if(nativeBridge?.command)return await sendNative(normalized);');
const rendererFallback=sendBlock.indexOf('if(rendererBridge?.command)return await sendRenderer(normalized);');
assert(nativeFirst>=0&&rendererFallback>nativeFirst,'Visible Mac presenter controls must preserve acknowledged native-first routing with bounded renderer fallback.');

assert(integration.includes('async function openPickerWithPermission(){')&&integration.includes('const approved=window.DominionShareRuntimeAuthority2041;')&&integration.includes('if(approved?.open)return approved.open();'),'Presenter New Share must reopen the approved 2.0.41 runtime chooser.');
assert(integration.includes('desktop?.sharePicker?.cancel?.()'),'A completed Stop Share transition must close any stale legacy picker before the next meeting interaction.');
assert(integration.includes('window.DominionShareRuntimeAuthority2041?.close?.()'),'Stop Share must close the in-renderer approved chooser.');
assert(integration.includes('shareWasActive&&!active')&&integration.includes('window.DominionActiveShareHomeParity2041?.restoreMeeting?.()'),'The authoritative active-to-inactive transition must explicitly restore the active meeting surface.');

assert(!macVideo.includes('getUserMedia')&&macVideo.includes('bridge?.onVideoFrame?.(applyRemoteFrame)')&&!macVideo.includes("stack.textContent=''"),'Floating share video must mirror the meeting renderer and preserve keyed tiles without acquiring a second camera.');
assert(macVideo.includes("videoLayout='strip'")&&macVideo.includes("data-video-primary")&&macVideo.includes("data-video-more")&&macVideo.includes("single-slash"),'Floating share video must implement the approved compact participant strip with direct mute, ellipsis actions, and one muted slash.');
assert(integration.includes('const presenterParticipants=()=>')&&integration.includes("#participantVideoDock .remote-peer-tile:not(.local-video-dock-tile),#remoteTileStrip .remote-peer-tile")&&integration.includes("const localTrack=media.stream()?.getVideoTracks?.().find(track=>track.readyState==='live'&&track.enabled!==false)||null")&&integration.includes("localImageCapture=new ImageCapture(localTrack)")&&integration.includes("macPresenter.videoFrame({participantId:selfId,dataUrl,at:Date.now()})")&&integration.includes('macPresenter.videoFrame({participantId:id,dataUrl,at:Date.now()})'),'Native share video must mirror the already-owned local camera track plus remote meeting tiles without opening a second camera.');
assert(integration.includes('frameCanvas.width=192;frameCanvas.height=108')&&integration.includes("frameCanvas.toDataURL('image/jpeg',.58)")&&!integration.includes("getUserMedia"),'Presenter video mirroring must stay bounded and use only already-owned meeting media.');
assert(screenshotReference.includes('data-ds-ref-critical-meeting-geometry')&&screenshotReference.includes('grid-template-rows:47px minmax(0,1fr) 56px!important')&&screenshotReference.includes('max-height:56px!important'),'Final screenshot authority must synchronously hard-lock the packaged meeting toolbar to the 56px Zoom-reference geometry.');
assert(screenshotReference.includes('function claimFinalMeetingAuthority(){')&&screenshotReference.includes("overlay.classList.remove('ds-exec-lock')")&&screenshotReference.includes("qa('#meetingOverlay .ds-exec-icon,#meetingOverlay .ds-exec-label,#meetingOverlay .ds-exec-encrypted,#meetingOverlay .ds-exec-divider')"),'Final Zoom-reference sync must synchronously strip stale executive geometry before any packaged interaction measurement.');
assert(screenshotReferenceCss.includes('#meetingOverlay #participantRoster .person-row{min-height:42px!important;height:42px!important')&&screenshotReferenceCss.includes('#meetingOverlay #participantRoster .person-badge{width:30px!important;height:30px!important')&&screenshotReferenceCss.includes('#meetingOverlay #participantRoster .person-copy strong{font-size:13px!important')&&screenshotReferenceCss.includes('.ds-participant-more{width:28px!important;height:28px!important;min-width:28px!important'),'The loaded final screenshot stylesheet must preserve compact readable Participants rows, avatars, names, and ellipsis hit targets.');

new Function(featureReady);
assert(featureReady.includes('function finalReferenceReady(){return Boolean(window.DominionZoomScreenshotReference?.sync);}')&&featureReady.includes("o.classList.remove('ds-exec-lock')"),'Legacy 2.0.41 meeting chrome must yield its geometry class when the final Zoom-reference authority is available.');
assert(featureReady.includes("o.querySelectorAll('.ds-exec-icon,.ds-exec-label,.ds-exec-encrypted,.ds-exec-divider')")&&featureReady.includes("o.querySelectorAll('.ds-exec-control')"),'Final-reference handoff must remove stale executive toolbar decoration that can widen or shift controls.');
assert(featureReady.includes('window.DominionZoomScreenshotReference?.requestSync?.()'),'Legacy-to-final handoff must immediately reassert final Zoom-reference geometry after cleanup.');
assert(participantsReference.includes('min-height:42px!important;height:42px!important')&&participantsReference.includes('white-space:nowrap!important;font-size:12px!important;font-weight:600!important;color:#f3f3f4!important}')&&participantsReference.includes('width:28px!important;height:28px!important;min-width:28px!important'),'Final Participants reference must keep the approved compact row, readable name, and ellipsis hit-target scale under packaged physical acceptance.');

console.log('DOMINIONSTAR_ACTIVE_SHARE_REPAIR_2_0_52_OK acknowledged-toolbar canonical-new-share clean-stop approved-participant-strip single-camera-local-remote-mirror persistent-tiles direct-mute ellipsis single-slash stable-final-toolbar-handoff readable-participant-scale');
