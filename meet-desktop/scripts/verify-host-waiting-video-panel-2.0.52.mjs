import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const pkg=JSON.parse(read('package.json'));
const parity=read('ui/meeting-parity.js');
const parityCss=read('ui/meeting-parity.css');
const hostTools=read('ui/zoom-screenshot-reference-2.0.41.js');
const service=read('src/meeting-service.mjs');
const av=read('ui/av-settings.js');
const app=read('ui/app.js');
const webrtc=read('ui/webrtc-controller.js');

assert(pkg.version==='2.0.52','package version is not 2.0.52');

assert(parityCss.includes('Keep five tiles')&&parityCss.includes('width:176px!important')&&parityCss.includes('height:99px!important'),'approved vertical video tile geometry is missing');
assert(parityCss.includes('max-height:515px!important')&&parityCss.includes('overflow-y:auto!important'),'video panel no longer owns five-tile internal scrolling');
assert(parity.includes('Math.min(shareTiles.length,5)')&&parity.includes('Math.min(count,5)')&&parity.includes('for(let i=1;i<=5;i++)'),'video panel runtime count is not capped to five');
assert(!parity.includes('Math.min(shareTiles.length,9)')&&!parity.includes('Math.min(count,9)'),'legacy nine-tile runtime count remains');

assert(service.includes("meet_v2_set_waiting_room"),'desktop service does not call the waiting-room RPC');
assert(hostTools.includes("waitingRoomEnabled:snap.waitingRoomEnabled!==false"),'Host Tools does not read live waiting-room state');
assert(hostTools.includes("data-waiting ${state.waitingRoomEnabled?'checked':''}"),'Host Tools waiting-room toggle is not live');
assert(!hostTools.includes('data-waiting disabled title="Dynamic waiting-room switching'),'disabled waiting-room placeholder remains');
assert(hostTools.includes("setSecurityPatch({waitingRoomEnabled:wanted})"),'Host Tools waiting-room toggle has no backend action');
assert(parity.includes("desktop.meeting.hostQueue(ctx.roomId)")&&parity.includes('data-host-admit-all'),'Host Tools lacks waiting queue access/admit-all path');
assert(app.includes("waiting.id='waitingOverlay'")&&app.includes("You are in the Waiting Room. The host or co-host can admit you when ready."),'participant Waiting Room screen is missing');
assert(app.includes("timers.waiting=setInterval(()=>void pollJoinStatus(),1000)"),'participant Waiting Room does not poll admission state');
assert(app.includes("if(state.state==='admitted')")&&app.includes("await meeting.markJoined(activeRoom.participantId,activeRoom.joinToken)"),'participant does not automatically advance after admission');
assert(app.includes("pendingMediaPreferences||{}")&&app.includes("cameraOn:prefs.cameraOn!==false")&&app.includes("micOn:state.muteOnEntry?false:Boolean(prefs.micOn)"),'participant media preferences are not restored after Waiting Room admission');

assert(av.includes('async function openAudioSettings(media)'),'audio settings implementation missing');
assert(av.includes('async function openVideoSettings(media)'),'video settings implementation missing');
assert(av.includes('testMicrophone')&&av.includes('testSpeaker'),'audio device tests missing');
assert(av.includes('settingsVideoPreview'),'camera preview missing');
assert(av.includes("if(title==='Audio')row.onclick")&&av.includes("else if(title==='Video')row.onclick"),'Audio/Video settings rows are not bound');
assert(av.includes("for(const [button,kind] of [[mic,'audio'],[camera,'video']])"),'meeting A/V quick menus are not bound for participants');

assert(parity.includes("'host:view-layout'")&&parity.includes("window.addEventListener('dominion:host-view-layout'"),'host-to-participant layout parity signal is incomplete');

assert(
  parity.includes("const APPROVED_LAYOUT_MIGRATION_KEY='ds_meet_approved_layout_2_0_52_physical_v1'") &&
  parity.includes("'ds_meet_floating_surface_geometry_v1'") &&
  parity.includes("localStorage.setItem('ds_meet_view_mode','speaker')") &&
  parity.includes("localStorage.setItem('ds_meet_video_panel_mode_v2','strip')") &&
  parity.includes("localStorage.setItem('ds_meet_video_panel_visible_v2','1')"),
  '2.0.52 must migrate rejected persisted meeting geometry/modes back to the approved speaker + right-strip baseline once'
);
assert(
  parity.includes("window.addEventListener('dominion:remote-media-state',()=>{syncDockTileActions();syncVideoDock();},true)") &&
  parity.includes("window.addEventListener('dominion:remote-share-state',()=>{syncShareLayout();syncVideoDock();},true)") &&
  parity.includes("window.addEventListener('dominion:webrtc-participants-reconciled',scheduleParityRefresh,true)"),
  'live remote participant, camera, and share changes must immediately resync the approved stage/video dock'
);
assert(
  webrtc.includes("participantSignature:''") &&
  webrtc.includes("window.dispatchEvent(new CustomEvent('dominion:webrtc-participants-reconciled'") &&
  webrtc.includes("state.participantSignature=''"),
  'WebRTC participant reconciliation must emit only on remote participant-set changes and reset on meeting end'
);
{
  const showStart=webrtc.indexOf('function showRemoteShare');
  const hideStart=webrtc.indexOf('function hideRemoteShare');
  const showBlock=webrtc.slice(showStart,hideStart);
  const hideBlock=webrtc.slice(hideStart,webrtc.indexOf('async function routeAudioElement',hideStart));
  assert(
    showBlock.indexOf("document.body.classList.add('remote-share-active')")>=0 &&
    showBlock.indexOf("document.body.classList.add('remote-share-active')")<showBlock.indexOf("emitRemoteShareState(id,true)"),
    'remote share activation must commit before the layout notification'
  );
  assert(
    hideBlock.indexOf("document.body.classList.remove('remote-share-active')")>=0 &&
    hideBlock.indexOf("document.body.classList.remove('remote-share-active')")<hideBlock.indexOf("emitRemoteShareState(id,false)"),
    'remote share deactivation must commit before the layout notification'
  );
}

console.log('PASS Meet 2.0.52 host waiting-room + five-tile video panel + participant A/V parity');
