import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const toolbar=read('ui/mac-presenter-toolbar.js');
const integration=read('ui/share-integration.js');
const mirror=read('src/mac-share-video-mirror.mjs');
const pkg=JSON.parse(read('package.json'));

new Function(toolbar);
new Function(integration);

assert(['2.0.41','2.0.42'].includes(pkg.version),'Active-share grouped repair gate must run on the 2.0.41 CI carrier or 2.0.42 release branch.');
assert(toolbar.includes("version:'2.0.42-native-ack-first-controls'"),'Mac presenter toolbar must identify the acknowledged native-first command authority.');
assert(toolbar.includes("result.direct===true||result.acknowledged===true||result.handled===true")&&!toolbar.includes("result.handled===true||result.ok===true"),'A generic ok:true must never count as proof that a presenter command executed.');
const nativeFirst=toolbar.indexOf('try{return await sendNative(normalized);}');
const rendererFallback=toolbar.indexOf('if(rendererBridge?.command)return await sendRenderer(normalized);');
assert(nativeFirst>=0&&rendererFallback>nativeFirst,'Visible Mac presenter controls must use the acknowledged native delivery queue before renderer fallback.');

assert(integration.includes('const approved=window.DominionShareRuntimeAuthority2041;')&&integration.includes('if(approved?.open)return approved.open();'),'Presenter New Share must reopen the approved 2.0.41 runtime chooser instead of the legacy picker.');
assert(integration.includes('await desktop?.sharePicker?.cancel?.()'),'Stop Share must close any stale legacy picker before restoring the meeting.');
assert(integration.includes('window.DominionShareRuntimeAuthority2041?.close?.()'),'Stop Share must close the in-renderer approved chooser.');
assert(integration.includes('window.DominionActiveShareHomeParity2041?.restoreMeeting?.()'),'Stop Share must explicitly restore the active meeting surface.');

assert(mirror.includes('window.DominionMediaController||null')&&mirror.includes('controller?.stream?.()'),'Floating participant video must read the authoritative camera stream, not only one DOM video element.');
assert(mirror.includes("typeof ImageCapture==='function'")&&mirror.includes('new ImageCapture(track).grabFrame()'),'Camera mirror must retain a frame-capture fallback when no live DOM video surface is paintable.');
assert(mirror.includes("candidates.find(item=>item.id==='localMeetingVideo')||candidates[0]"),'Camera mirror must accept any live element bound to the authoritative camera track.');

console.log('DOMINIONSTAR_ACTIVE_SHARE_REPAIR_2_0_42_OK acknowledged-toolbar canonical-new-share clean-stop authoritative-camera-mirror');
