import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const engine = read('assets/js/meeting-engine.js');
const app = read('meet-desktop/ui/app.js');
const physical = read('meet-desktop/ui/zoom-physical-acceptance.js');
const participantControls = read('meet-desktop/ui/participant-controls.js');
const desktopWebrtc = read('meet-desktop/ui/webrtc-controller.js');
const parity = read('meet-desktop/ui/meeting-parity.js');
const runtime = read('meet-desktop/ui/runtime-stability.js');
const behavior = read('meet-desktop/ui/zoom-behavior.js');
const reference = read('meet-desktop/ui/zoom-screenshot-reference-2.0.41.js');
const participantReference = read('meet-desktop/ui/zoom-participants-reference-2.0.41.js');
const css = read('meet-desktop/ui/zoom-screenshot-reference-2.0.41.css');
const index = read('meet-desktop/ui/index.html');
const lifecycle = read('meet-desktop/ui/meeting-lifecycle-authority.js');
const notifications = read('meet-desktop/ui/meeting-notifications.js');
const browserUi = read('assets/js/meet-next/executive6.js');
const browserIndex = read('meet/index.html');
const buildPublic = read('scripts/build-public-netlify.sh');
const presenterToolbar = read('meet-desktop/ui/mac-presenter-toolbar.html');
const presenterToolbarCss = read('meet-desktop/ui/mac-presenter-toolbar.css');
const presenterOverlay = read('meet-desktop/src/mac-share-presenter-overlay.mjs');
const shareIntegration = read('meet-desktop/ui/share-integration.js');
const shareCss = read('meet-desktop/ui/share.css');
const meetingService = read('meet-desktop/src/meeting-service.mjs');
const preload = read('meet-desktop/src/preload.cjs');
const mainProcess = read('meet-desktop/src/main.mjs');
const hostToolsCss = read('meet-desktop/ui/host-tools-size-lock-2.0.41.css');
const meetingFeatures = read('meet-desktop/ui/meeting-features.js');
const waitingRoomMigration = read('meet-desktop/sql/20261008_runtime_waiting_room_control.sql');

assert(engine.includes('serializeIceCandidate'), 'Browser meeting engine does not serialize ICE candidates for V2 RPC.');
assert(engine.includes('candidate:serializeIceCandidate(candidate)'), 'Browser ICE candidate still crosses RPC as a raw RTCIceCandidate.');
assert(engine.includes('serializeSessionDescription(peer.localDescription)'), 'Browser SDP still crosses RPC as a raw RTCSessionDescription.');
assert(engine.includes("if(type==='chat')return ['meet-chat'"), 'Desktop-to-browser V2 chat is not translated into the browser meeting engine.');
assert(engine.includes("'host:mute':'mute'"), 'Desktop host mute control is not translated into browser moderation.');
assert(engine.includes("event==='meet-chat'||event==='meet-reaction'"), 'Browser-to-desktop chat/reaction does not fan out through V2.');
assert(engine.includes("if(type==='screen-state')return ['meet-screen-state'"), 'Desktop screen-share state is not translated into browser presentation state.');
assert(desktopWebrtc.includes("meeting.sendSignal(remoteId,'screen-state'"), 'Desktop WebRTC does not publish screen-share state to browser participants.');
assert(desktopWebrtc.includes('broadcastShareState(snapshot)'), 'Desktop share changes do not fan out presentation state to connected peers.');
assert(desktopWebrtc.includes('serializeDescription(record.pc.localDescription)'), 'Desktop SDP is not serialized before crossing the meeting transport boundary.');
assert(desktopWebrtc.includes('showRemoteCamera(id,stream)'), 'Desktop remote camera rendering path is missing.');
assert(desktopWebrtc.includes('showRemoteShare(id,stream)'), 'Desktop remote screen-share rendering path is missing.');
assert(engine.includes("if(type==='security-state')return ['meet-security-state'"), 'Desktop host security policy is not translated into the browser meeting engine.');
assert(engine.includes("event==='meet-security-state'")&&engine.includes("transport.sendSignal(id,'security-state',body)"), 'Browser host security policy is not propagated to desktop V2 participants.');
assert(desktopWebrtc.includes("signal.type==='security-state'"), 'Desktop participants do not receive synchronized browser/desktop host security state.');


assert(desktopWebrtc.includes('function armInitialHandshake(record)'), 'Desktop peer can remain stuck in Connecting without an initial-handshake watchdog.');
assert(desktopWebrtc.includes("function isInitiator(remoteId){return String(state.context?.participantId||'')<String(remoteId||'');}"), 'Desktop/browser offerer ordering can diverge and leave both peers waiting.');
assert(engine.includes('armInitialPeerHandshake'), 'Browser peer can remain stuck in Connecting without an initial-handshake watchdog.');
assert(!engine.includes("if(members.length)emit('presence'"), 'Browser V2 snapshot still suppresses the empty presence update and can leave a ghost participant.');
assert(desktopWebrtc.includes('screenTrackId:active?String(screenTrack?.id'), 'Desktop screen-state does not publish screen track identity to browser viewers.');
assert(desktopWebrtc.includes('screenStreamId:active?String(stream?.id'), 'Desktop screen-state does not publish screen stream identity to browser viewers.');
assert(desktopWebrtc.includes("screenMid:active&&lanes[2]?.mid!=null"), 'Desktop screen-state does not publish the negotiated screen m-line.');
assert(desktopWebrtc.includes('remoteVideoCandidates:new Map()')&&desktopWebrtc.includes('function announcedScreenCandidate(record)')&&desktopWebrtc.includes('function bindRemoteScreenCandidate(record,candidate)'), 'Desktop receiver cannot reclassify a video track when screen metadata arrives after ontrack.');
assert(desktopWebrtc.includes('shareRecord.remoteShareTrackId=String(payload.screenTrackId')&&desktopWebrtc.includes('shareRecord.remoteShareStreamId=String(payload.screenStreamId')&&desktopWebrtc.includes('shareRecord.remoteShareMid=payload.screenMid'), 'Desktop receiver does not retain announced screen track/stream/MID identity.');

assert(browserUi.includes('ids.participantList.dataset.renderSignature!==renderSignature'), 'Browser participant roster still repaints on every snapshot and can blink/reorder.');
assert(browserUi.includes("const validTiles=new Set(['self',...state.participants.keys()])"), 'Browser video dock does not prune ghost tiles before deciding visibility.');
assert(!browserIndex.includes('<h1>Meetings</h1>')&&!browserIndex.includes('Start, join, or schedule in one place.'), 'Competing standalone Meet home launcher is still visible in the browser room client.');
assert(!browserIndex.includes('id="meetDashboard" class="meet-dashboard"'), 'Browser /meet/ still publishes a second Meet home instead of a room-only client.');
assert(buildPublic.includes('test ! -e "$DIST/meet-home"'), 'Public deploy does not explicitly forbid the retired meet-home surface.');
assert(browserIndex.includes('data-browser-panel-control="close"')&&browserIndex.includes('data-browser-panel-control="minimize"')&&browserIndex.includes('data-browser-panel-control="restore"'), 'Browser participant panel lacks horizontal close/minimize/restore controls.');
assert(reference.includes('ds-participant-count-badge'), 'Desktop Participants toolbar control does not expose a live count badge.');
assert(css.includes('.ds-participant-count-badge'), 'Desktop participant count badge has no visual authority.');
assert(participantReference.includes('ds-traffic-close')&&participantReference.includes('ds-traffic-minimize')&&participantReference.includes('ds-traffic-restore'), 'Desktop participant traffic-light controls are incomplete.');
assert(presenterToolbar.includes('data-command="polls"')&&presenterToolbar.includes('data-command="whiteboard"')&&presenterToolbar.includes('data-command="apps"'), 'Presenter More menu is missing meeting tools.');
assert(shareIntegration.includes("if(command==='polls')")&&shareIntegration.includes("if(command==='whiteboard')")&&shareIntegration.includes("if(command==='apps')"), 'Presenter meeting tools are not routed into the live meeting.');
assert(shareIntegration.includes('desktop?.share?.captureStopped?.()'), 'Stopped sharing does not explicitly tear down native presenter/perimeter chrome.');
assert(presenterOverlay.includes('if(shareActive)positionVideo({preservePosition:priorDisplay===nextDisplay});'), 'Native presenter video panel can retain stretched blank geometry instead of following participant count.');
assert(shareCss.includes('body.ds-native-mac-presenter-share #remoteTileStrip')&&shareCss.includes('body.ds-native-mac-presenter-share #participantVideoDock'), 'Native sharing can expose a second renderer participant-video surface alongside the presenter panel.');
assert(shareIntegration.includes('The participant video dock is the single visible camera authority')&&shareIntegration.includes('if(cameraTile.srcObject)cameraTile.srcObject=null;')&&shareIntegration.includes('cameraTile.hidden=true;'), 'Remote-share viewing can still expose a detached local camera tile outside the participant video dock.');
assert(runtime.includes("dock.style.setProperty('height',`${smartHeight}px`,'important')")&&runtime.includes("dock.style.removeProperty('height')"), 'Participant video dock can retain a stale oversized height instead of fitting visible tiles.');
assert(presenterOverlay.includes('const seen=new Set();')&&presenterOverlay.includes('return seen.size;'), 'Native presenter video sizing still trusts duplicate/stale participant rows.');


assert(!physical.includes("wrap.className='ds-participant-media'"), 'Physical participant renderer recreates the rejected duplicate media strip.');
assert(physical.includes("row.querySelector('.participant-media-state')"), 'Physical participant renderer is not reusing the canonical media strip.');

assert(app.includes("const activePeople=people.filter(p=>['admitted','joined'].includes"), 'Participant presence still counts waiting-room records as joined participants.');
assert(app.includes('DominionMeetingLifecycleAuthority?.openExit?.()'), 'Primary End/Leave button can bypass the canonical confirmation authority.');

const lifecycleIndex=index.indexOf('./meeting-lifecycle-authority.js');
const behaviorIndex=index.indexOf('./zoom-behavior.js');
assert(lifecycleIndex>=0 && behaviorIndex>=0 && lifecycleIndex<behaviorIndex, 'Lifecycle authority must load before legacy meeting behavior.');
assert(behavior.includes('if(window.DominionMeetingLifecycleAuthority)return;'), 'Legacy host exit interception can still compete with canonical lifecycle authority.');

assert(lifecycle.includes("End Meeting for All"), 'Canonical exit dialog lost End Meeting for All.');
assert(lifecycle.includes("Leave Meeting"), 'Canonical exit dialog lost Leave Meeting.');
assert(lifecycle.includes("openInvite"), 'Canonical lifecycle authority lost persistent Invite.');
assert(lifecycle.includes("Copy Invitation"), 'Invite dialog does not expose invitation copy.');
assert(lifecycle.includes("showModal()"), 'Invite/exit authority no longer uses a persistent modal surface.');
assert(notifications.includes("window.addEventListener('dominion:participant-presence',onPresence)"), 'Join/leave notification event binding is missing.');
assert(notifications.includes("play('join')"), 'Participant join sound is missing.');
assert(notifications.includes("play('leave')"), 'Participant leave sound is missing.');
assert(reference.includes('DominionMeetingLifecycleAuthority') && reference.includes('openInvite'), 'Reference participant footer Invite does not route to persistent lifecycle authority.');
assert(!reference.includes('Dynamic waiting-room switching is not exposed by the current room-security RPC'), 'Obsolete disabled Waiting Room shell is still present in the reference Host Tools path.');
assert(reference.includes('DominionMeetingParity?.openSecurity?.'), 'Reference Host Tools does not delegate to the functional synchronized controller.');
assert(physical.includes('parity()?.openSecurity?.'), 'Physical Host Tools authority still owns a separate limited menu.');
assert(parity.includes('Enable Waiting Room')&&parity.includes('Share Screen')&&parity.includes('Rename Themselves')&&parity.includes('Unmute Themselves')&&parity.includes('Start Video')&&parity.includes('Mute on Entry')&&parity.includes('Suspend Participant Activities'), 'Desktop Host Tools is missing required Waiting Room or participant-permission controls.');
assert(parity.includes('window.DominionMeetingSecurity=Object.freeze')&&parity.includes('SECURITY_DEFAULTS=Object.freeze'), 'Desktop security policy has no single synchronized authority.');
assert(hostToolsCss.includes('width:360px!important')&&hostToolsCss.includes('min-height:42px!important')&&hostToolsCss.includes('font-size:14px!important'), 'Host Tools regressed to squeezed geometry instead of the approved readable scale.');
assert(parity.includes("['roomMic','roomCamera','roomParticipants','roomChat','roomReactions','roomRaiseHand','roomShare'")&&parity.includes("'roomHostTools'")&&parity.includes("'roomMore','roomExitButton'"), 'Desktop host/participant toolbar order does not match the approved reference.');
assert(participantControls.includes("data-ds-canonical-participant-footer"), 'Loaded participant controls do not own a stable canonical footer.');
assert(participantControls.includes("DominionMeetingLifecycleAuthority?.openInvite?.()"), 'Loaded participant footer Invite does not route to persistent lifecycle authority.');
assert(meetingService.includes("meet_v2_set_waiting_room")&&meetingService.includes('setWaitingRoom'), 'Desktop meeting service cannot toggle Waiting Room at runtime.');
assert(preload.includes("setWaitingRoom:(roomId,enabled)")&&mainProcess.includes("meeting:set-waiting-room"), 'Waiting Room runtime control is not exposed through the narrow desktop IPC bridge.');
assert(waitingRoomMigration.includes('create or replace function public.meet_v2_set_waiting_room')&&waitingRoomMigration.includes("state='admitted'")&&waitingRoomMigration.includes("state='waiting'"), 'Waiting Room migration does not safely admit existing waiting participants when the host disables the gate.');
assert(browserUi.includes("state.client.rpc('meet_v2_set_waiting_room'")&&browserUi.includes("state.client.rpc('meet_v2_set_security'"), 'Browser host security does not persist into the same V2 room backend used by desktop clients.');
assert(app.includes("DominionMeetingSecurity?.allows?.('unmute')")&&app.includes("DominionMeetingSecurity?.allows?.('video')"), 'Desktop participant microphone/video controls can bypass host permissions.');
assert(shareIntegration.includes("DominionMeetingSecurity?.allows?.('share')"), 'Desktop participant screen sharing can bypass host permissions.');
assert(meetingFeatures.includes("DominionMeetingSecurity?.allows?.('chat')"), 'Desktop participant chat can bypass host permissions.');
assert(participantControls.includes("DominionMeetingSecurity?.allows?.('rename')"), 'Desktop participant self-rename can bypass host permissions.');
assert(parity.includes("add('Audio Settings…'")&&parity.includes("add('Video Settings…'")&&reference.includes("'Audio settings'")&&reference.includes("'Video settings'"), 'Audio/Video settings are not reachable from every active meeting authority.');

assert(parity.includes("const GEOMETRY_KEY='ds_zoom_video_dock_geometry_v3';")&&parity.includes("localStorage.removeItem('ds_zoom_video_dock_geometry_v2')")&&parity.includes("const PANEL_KEY='ds_zoom_participant_panel_geometry_v2';"), 'Old saved video-dock geometry can still override the approved smart right-dock default.');
assert(runtime.includes("const centeredLeft=Math.max(12,(bodyWidth-width)/2);")&&runtime.includes("if(panel===participants){"), 'Participants still default to the right-side video-dock lane instead of the middle meeting area.');
assert(participantReference.includes('font-size:14px!important'), 'Participant names remain undersized in the late participant reference authority.');
assert(presenterToolbarCss.includes('width:236px'), 'Presenter More menu remains squeezed below the toolbar.');
assert(parity.includes('function dedupeVideoDockTiles()'), 'Participant video dock has no duplicate-participant guard.');
assert(parity.includes('dedupeVideoDockTiles();const mode=readView()'), 'Participant video dock does not dedupe before layout.');

assert(css.includes('width:392px!important'), 'Physical participant panel regressed to the squeezed width.');
assert(css.includes('.participant-media-icon:not(.off)::after'), 'Participant media icon has no explicit live-state slash suppression.');
assert(css.includes('.participant-media-icon.off::after'), 'Participant media icon lost the single muted slash authority.');

console.log('PASS physical two-device regressions: stalled-handshake recovery, deterministic desktop-browser share identity, stable roster, smart video dock sizing, one share-video authority, functional Waiting Room/Host Tools, synchronized participant permissions, AV settings parity, guarded exit, persistent invite, and sounds.');
