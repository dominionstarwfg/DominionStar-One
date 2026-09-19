// CI carrier synchronization marker: validates the current grouped active-share repair without changing product behavior.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const toolbar=read('ui/mac-presenter-toolbar.js');
const screenshotReference=read('ui/zoom-screenshot-reference-2.0.41.js');
const integration=read('ui/share-integration.js');
const mirror=read('src/mac-share-video-mirror.mjs');
const pkg=JSON.parse(read('package.json'));

new Function(toolbar);
new Function(integration);

assert(['2.0.41','2.0.42'].includes(pkg.version),'Active-share grouped repair gate must run on the 2.0.41 CI carrier or 2.0.42 release branch.');
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

console.log('DOMINIONSTAR_ACTIVE_SHARE_REPAIR_2_0_42_OK acknowledged-toolbar canonical-new-share clean-stop authoritative-camera-mirror');
