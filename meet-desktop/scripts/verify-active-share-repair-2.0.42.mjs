import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const toolbar=read('ui/mac-presenter-toolbar.js');
const integration=read('ui/share-integration.js');
const mirror=read('src/mac-share-video-mirror.mjs');
const pkg=JSON.parse(read('package.json'));

new Function(toolbar);
new Function(integration);

assert.equal(pkg.version,'2.0.42','Active-share grouped repair must ship under a new version.');
assert(toolbar.includes("version:'2.0.42-strict-direct-native-ack-fallback'"),'Mac presenter toolbar must identify the strict direct-first plus acknowledged fallback authority.');
assert(toolbar.includes("result.direct===true||result.acknowledged===true||result.handled===true")&&!toolbar.includes("result.handled===true||result.ok===true"),'A generic ok:true must never count as proof that a presenter command executed.');
const directFirst=toolbar.indexOf('try{return await sendRenderer(normalized);}');
const nativeFallback=toolbar.indexOf('if(nativeBridge?.command)return sendNative(normalized);');
assert(directFirst>=0&&nativeFallback>directFirst,'Visible Mac presenter controls must preserve direct-first routing but fall back to acknowledged native delivery when execution is not proven.');

assert(integration.includes('const approved=window.DominionShareRuntimeAuthority2041;')&&integration.includes('if(approved?.open)return approved.open();'),'Presenter New Share must reopen the approved 2.0.41 runtime chooser instead of the legacy picker.');
assert(integration.includes('desktop?.sharePicker?.cancel?.()'),'A completed Stop Share transition must close any stale legacy picker before the next meeting interaction.');
assert(integration.includes('window.DominionShareRuntimeAuthority2041?.close?.()'),'Stop Share must close the in-renderer approved chooser.');
assert(integration.includes('shareWasActive&&!active')&&integration.includes('window.DominionActiveShareHomeParity2041?.restoreMeeting?.()'),'The authoritative active-to-inactive transition must explicitly restore the active meeting surface.');

assert(mirror.includes('window.DominionMediaController||null')&&mirror.includes('controller?.stream?.()'),'Floating participant video must read the authoritative camera stream, not only one DOM video element.');
assert(mirror.includes("typeof ImageCapture==='function'")&&mirror.includes('new ImageCapture(track).grabFrame()'),'Camera mirror must retain a frame-capture fallback when no live DOM video surface is paintable.');
assert(mirror.includes("candidates.find(item=>item.id==='localMeetingVideo')||candidates[0]"),'Camera mirror must accept any live element bound to the authoritative camera track.');

console.log('DOMINIONSTAR_ACTIVE_SHARE_REPAIR_2_0_42_OK acknowledged-toolbar canonical-new-share clean-stop authoritative-camera-mirror');
