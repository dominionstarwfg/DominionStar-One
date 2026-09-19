import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const toolbar=read('ui/mac-presenter-toolbar.js');
const preload=read('src/preload.cjs');
const presenterPreload=read('src/presenter-preload.cjs');
const overlay=read('src/mac-share-presenter-overlay.mjs');
const shareService=read('src/share-service.mjs');
const integration=read('ui/share-integration.js');
const videoMirror=read('src/mac-share-video-mirror.mjs');
const videoDock=read('ui/mac-share-video.js');

new Function(toolbar);
new Function(integration);
new Function(videoDock);

assert(toolbar.includes("version:'2.0.42-acknowledged-native-first-controls'"),'Presenter toolbar must identify the 2.0.42 acknowledged transport.');
assert(toolbar.includes("transport:nativeBridge?.command?'macShare-ack-first'"),'Physical Mac presenter controls must prefer the acknowledged native queue.');
assert(toolbar.includes("result.direct===true||result.acknowledged===true||result.handled===true"),'Toolbar success must require execution evidence.');
assert(!toolbar.includes("result.direct===true||result.acknowledged===true||result.handled===true||result.ok===true"),'A bare ok:true must never be treated as presenter command execution.');

assert(preload.includes("share:presenter-delivery-ack")&&preload.includes("presenterDeliveryTasks.has(deliveryId)"),'Meeting preload must acknowledge and de-duplicate delivered presenter commands.');
assert(presenterPreload.includes("mac-share:presenter-command")&&presenterPreload.includes("share:presenter-command"),'Floating presenter preload must expose both acknowledged native and bounded renderer transports.');
assert(overlay.includes("deliverPresenterCommand(main,command,reuseDeliveryId=0)"),'Mac overlay must support retrying one logical command with one delivery id.');
assert(overlay.includes("const deliveryId=++presenterDeliverySeq")&&overlay.includes("deliverPresenterCommand(main,command,deliveryId)"),'Presenter retry must reuse its delivery id so a delayed first attempt cannot double-toggle.');
assert(overlay.includes("showMeeting();")&&overlay.includes("normalized==='stop'&&shareActive"),'Failed Stop Share acknowledgement must restore the meeting instead of stranding the user.');

assert(shareService.includes("const executed=Boolean(delivery?.direct)"),'Legacy presenter route must distinguish actual direct execution from mere IPC delivery.');
assert(shareService.includes("presenter_command_not_acknowledged"),'Legacy presenter route must report unacknowledged execution instead of returning cosmetic success.');

assert(integration.includes('function restoreMeetingAfterShareStop()'),'Stop Share must have explicit meeting-surface recovery.');
assert(integration.includes("q('#prejoinOverlay')?.setAttribute('hidden','')")&&integration.includes("q('#appShell')?.setAttribute('hidden','')"),'Stop Share recovery must suppress prejoin/home fallback surfaces.');
assert(integration.includes("window.dispatchEvent(new CustomEvent('dominion:share-stopped'"),'Stop Share recovery must publish a deterministic state transition.');
assert(integration.includes("if(command==='stop'){clearCompanion();await share.stop();applyLayout();restoreMeetingAfterShareStop();"),'Floating Stop Share must terminate capture and restore the meeting in one command path.');

assert(videoMirror.includes("window.DominionMediaController||null")&&videoMirror.includes("media?.stream?.()||null"),'Floating presenter video must read the camera stream from the authoritative media controller.');
assert(videoMirror.includes("new ImageCapture(track).grabFrame()"),'Presenter video mirror must sample the live camera track directly when available.');
assert(videoMirror.includes("video.srcObject=stream")&&videoMirror.includes("temporary?'media-stream-fallback':'local-video'"),'Presenter video mirror must fall back to a temporary video bound to the same owned stream, not acquire a second camera.');
assert(!videoMirror.includes("navigator.mediaDevices.getUserMedia"),'Presenter video mirror must never acquire a second camera track.');
assert(videoDock.includes("const showLive=Boolean(cameraOn&&lastFrame)"),'Floating video dock must fall back instead of displaying an empty live surface.');

console.log('DOMINIONSTAR_SHARE_CONTROLS_RECOVERY_2_0_42_OK acknowledged-controls idempotent-retry truthful-legacy-fallback stop-restores-meeting authoritative-camera-mirror no-second-camera');
