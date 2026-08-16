import assert from 'node:assert/strict';
import fs from 'node:fs';

const dock=fs.readFileSync(new URL('../assets/js/meet/dock-layout-v2.js',import.meta.url),'utf8');
const meet=fs.readFileSync(new URL('../meet/index.html',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');

const requireMarker=(source,marker,label)=>assert.ok(source.includes(marker),`${label} missing: ${marker}`);

// RC13 is now implemented in the owning subsystems instead of a late monkey-patch
// wrapper in dock-layout-v2.js. Verify the production architecture directly.
for(const marker of [
  'const CAMERA_RELEASE_GRACE_MS=750',
  'const CAMERA_RETRY_DELAYS_MS=[0,320,760,1400]',
  'isTransientCameraStartError',
  'NotReadableError',
  'state.lastCameraReleaseAt=Date.now()',
  'recoverCameraTrack({intentSeq:seq})',
  'createFrozenScreenTrack',
  'const frozenScreenTrack = state.screenPaused',
  'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)',
  'state.screenStartPromise=operation',
  'const admit = async participantId =>',
  'const deny = async participantId =>',
  'resyncPresence',
  'recoverPeers'
]) requireMarker(engine,marker,'RC13 meeting-engine contract');

for(const marker of [
  'const buildMeetingJoinLink=',
  "query.get('room') || query.get('meeting')",
  "url.searchParams.set('passcode',code)",
  'const recentToasts=new Map()',
  'while(ids.toastLayer.children.length>3)',
  'const PREVIEW_CAMERA_RELEASE_GRACE_MS=750',
  'acquireUserMediaStable'
]) requireMarker(ui,marker,'RC13 meeting UI contract');

for(const marker of [
  "dock.addEventListener('pointerdown'",
  'Math.hypot(dx,dy)<4',
  'setOrientation',
  "addEventListener('resize'",
  'requestAnimationFrame(reconcile)'
]) requireMarker(dock,marker,'Participant dock interaction contract');

assert.match(meet,/assets\/js\/meeting-engine\.js\?v=92-rc13-media-stability/,'RC13 meeting engine cache key must load in Meet');
assert.match(meet,/assets\/js\/meet-next\/executive6\.js\?v=79-rc13-media-share-link-stability/,'RC13 UI cache key must load in Meet');
assert.match(meet,/assets\/js\/meet\/dock-layout-v2\.js/,'Participant dock runtime must load in Meet');
assert.ok(meet.indexOf('meeting-engine.js')<meet.indexOf('dock-layout-v2.js'),'Dock behavior must load after the meeting engine.');

// Zoom-like privacy: Pause Share freezes the outgoing presentation frame without
// broadcasting a public paused state or disabling the real capture track.
assert.ok(!engine.includes("send('meet-screen-state',{active:true,paused:state.screenPaused})"),'Pause Share must not announce presenter privacy state to participants.');
assert.ok(!engine.includes("state.screenStream.getVideoTracks().forEach(track=>track.enabled=!state.screenPaused)"),'Pause Share must not black/stall the real display track.');

// Security boundary: preserve the exact working authority model already used by
// the recovered production engine. A remote participant's claimed role alone is
// never enough; role-change handling is gated by the previously verified host
// role, and waiting-room admission remains token-targeted.
requireMarker(engine,"const requirePrivileged=action=>{if(!['host','cohost'].includes(state.role))",'Host/co-host authorization boundary');
requireMarker(engine,"const requireHost=action=>{if(!state.isHost)",'Host-only authorization boundary');
requireMarker(engine,"const senderHost=senderRole==='host'",'Verified remote host boundary');
requireMarker(engine,"if (event === 'meet-role-change' && senderHost && payload.targetParticipantId)",'Inbound host-role authorization boundary');
requireMarker(engine,'validJoinToken','Waiting-room targeted admission token boundary');

console.log('DominionStar Meet RC13 clean architecture quality contract passed.');
