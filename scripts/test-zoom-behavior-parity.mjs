import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const meetHtml = read('meet/index.html');
const meetingEngine = read('assets/js/meeting-engine.js');
const desktopSharePicker = read('assets/js/meet/desktop-share-picker.js');
const shareView = read('assets/js/meet/share-view-controls.js');
const illustration = read('assets/js/meet/illustration-ui-parity.js');
const hostCohostUi = read('assets/js/meet/host-cohost-ui-parity.js');
const quickDevices = read('assets/js/meet/quick-device-menu-parity.js');
const dockPolish = read('assets/js/meet/dock-polish-2030.js');
const shareAnnotation = read('assets/js/meet/share-annotation.js');
const localRecording = read('assets/js/meet/local-recording.js');
const presenterHtml = read('desktop 2/src/presenter-toolbar.html');
const presenterJs = read('desktop 2/src/presenter-toolbar.js');
const shareLifecycle = read('desktop 2/src/share-lifecycle.mjs');
const twoClient = read('scripts/browser-two-client-meet-acceptance.mjs');

const requireText = (source, text, message) => assert(source.includes(text), message);

// DominionStar's parity target is Zoom-class behavior, not copied internals.
// These contracts reflect documented public Zoom behavior while preserving
// DominionStar branding and architecture.

// 1) Normal in-meeting controls retain the approved Zoom-familiar hierarchy.
for (const id of ['micBtn','camBtn','participantsBtn','chatBtn','shareBtn','reactionBtn','moreBtn','leaveBtn']) {
  requireText(meetHtml, `id="${id}"`, `Zoom parity: normal meeting control ${id} is missing.`);
}
requireText(illustration, "label.textContent='Security'", 'Zoom parity: host Security control is missing.');
requireText(illustration, "button.id='recordBtn'", 'Zoom parity: Record control is missing.');
requireText(illustration, "label.textContent=isHost?'End':'Leave'", 'Zoom parity: host End versus attendee/co-host Leave behavior is missing.');

// 2) Host/co-host authority follows Zoom's documented role boundary. Host alone
// appoints co-host/host, ends for all, and enables/disables Waiting Room. A
// co-host keeps participant moderation and can admit/remove people from an
// already-active Waiting Room.
requireText(twoClient, "getByRole('button', { name: 'Make co-host', exact: true }).click()", 'Zoom parity: host-to-co-host promotion is not exercised.');
requireText(twoClient, "assert(await guest.locator('#endAllBtn').getAttribute('hidden') !== null", 'Zoom parity: co-host End Meeting for All restriction is not tested.');
requireText(twoClient, "assert(!/Make co-host|Make host/i.test(cohostMenuText)", 'Zoom parity: co-host host/co-host appointment restriction is not tested.');
requireText(hostCohostUi, "role === 'cohost'", 'Zoom parity: co-host role detection is missing.');
requireText(hostCohostUi, 'enforceCohostWaitingRoomBoundary', 'Zoom parity: host-only Waiting Room enablement guard is missing.');
requireText(hostCohostUi, '/^(?:Enable Waiting Room|Waiting Room)$/i', 'Zoom parity: co-host Waiting Room toggle is not blocked.');
requireText(hostCohostUi, 'event.stopImmediatePropagation()', 'Zoom parity: co-host Waiting Room toggle must be blocked before legacy handlers execute.');

// 3) Waiting room remains actionable rather than decorative. The two-client
// browser path proves a guest is held and the host admits them into the room.
requireText(twoClient, 'waiting room is visible to guest and actionable by host', 'Zoom parity: waiting-room admission coverage is missing.');
requireText(twoClient, 'admission creates participant list and video dock on both clients', 'Zoom parity: admitted participant continuity is missing.');
requireText(illustration, "decline.textContent='View'", 'Zoom parity: waiting-room heads-up must use Admit/View behavior.');

// 4) Desktop sharing must present real screens/application windows and recover
// cleanly when macOS permission is already granted.
requireText(desktopSharePicker, 'data-filter="screen">Screens', 'Zoom parity: desktop share picker must expose Screens.');
requireText(desktopSharePicker, 'data-filter="window">Application windows', 'Zoom parity: desktop share picker must expose application windows.');
requireText(desktopSharePicker, 'Share sound', 'Zoom parity: desktop share picker must offer computer sound when supported.');
requireText(desktopSharePicker, 'Optimize for video sharing', 'Zoom parity: desktop share picker must offer motion optimization.');
requireText(desktopSharePicker, 'role="switch" data-optimize', 'Zoom parity: share options must use modern switches.');
requireText(desktopSharePicker, "permissionTitle.textContent=state?.requiresRestart?'Apply screen access':'Screen access is active'", 'Zoom parity: granted macOS screen permission must not loop back to Settings.');
requireText(desktopSharePicker, 'Use Retry. You do not need to change Privacy & Security again.', 'Zoom parity: granted screen permission must provide in-app retry recovery.');

// 5) Browser sharing stays browser-native while desktop sharing stays native-app
// controlled. The web client intentionally carries a lighter capability set.
requireText(meetingEngine, 'navigator.mediaDevices.getDisplayMedia(displayOptions)', 'Zoom parity: browser screen sharing must use getDisplayMedia.');
requireText(shareView, 'media.__dsWebDisplayMediaBoundary = true', 'Zoom parity: browser display-media boundary is missing.');
assert(!shareView.includes("bootstrap.src = '/assets/js/meet/operation-2030-bootstrap.js"), 'Zoom parity: browser runtime must not leak desktop bootstrap ownership.');
requireText(twoClient, 'Share Screen traverses browser-native getDisplayMedia without desktop bootstrap leakage', 'Zoom parity: browser Share Screen is not exercised end-to-end.');

// 6) Presenter mode behaves like a desktop meeting application: controls move
// into a floating, draggable strip with New Share, Pause/Resume and Stop Share.
for (const command of ['audio','video','participants','chat','new-share','pause','layout','annotate','show-meeting','more','stop']) {
  requireText(presenterHtml, `data-command="${command}"`, `Zoom parity: presenter command ${command} is missing.`);
}
requireText(presenterHtml, '-webkit-app-region:drag', 'Zoom parity: presenter toolbar must be movable.');
requireText(presenterJs, "label.textContent=sharePaused?'Resume':'Pause'", 'Zoom parity: Pause Share must visibly become Resume.');
requireText(presenterJs, 'scheduleCollapse()', 'Zoom parity: presenter controls must support compact auto-collapse behavior.');
requireText(illustration, '#shareStatusBar.ds-native-presenter-active{display:none!important}', 'Zoom parity: desktop must not show duplicate hosted and native presenter toolbars.');
requireText(shareLifecycle, 'keepMeetingOffSharedDesktop', 'Zoom parity: meeting window must stay off the presented desktop unless explicitly shown.');
requireText(twoClient, 'share, private Pause Share presentation continuity, resume and stop', 'Zoom parity: Pause/Resume/Stop presentation continuity is not tested.');

// 7) Annotation is a synchronized meeting feature, not a local decoration.
requireText(shareAnnotation, "channel.on('broadcast',{event:'meet-annotation'},({payload})=>handleRemote(payload))", 'Zoom parity: annotation does not consume remote meeting annotation events.');
requireText(shareAnnotation, "state.channel.send({type:'broadcast',event:'meet-annotation'", 'Zoom parity: annotation does not publish to the meeting channel.');
requireText(shareAnnotation, "if (type === 'clear-all')", 'Zoom parity: synchronized Clear All is missing.');
requireText(shareAnnotation, "publish({type:'clear-all'})", 'Zoom parity: privileged Clear All is not broadcast.');
requireText(shareAnnotation, "addTool('Laser','laser')", 'Zoom parity: shared-screen laser pointer is missing.');

// 8) Participant dock and window responsiveness behave like a desktop client,
// not a scrollable webpage.
requireText(dockPolish, "POSITION_KEY='ds_meet_dock_geometry_v3'", 'Zoom parity: participant dock geometry persistence is missing.');
requireText(dockPolish, 'ds-dock-resize-handle', 'Zoom parity: participant dock must be resizable.');
requireText(illustration, 'enforceOnePersonDockRule', 'Zoom parity: one-person meetings must not show an unnecessary participant strip.');
requireText(twoClient, 'desktop resize keeps meeting fixed and participant dock inside the viewport', 'Zoom parity: responsive desktop layout is not tested.');

// 9) Device menus expose real meeting-grade audio/video selection and settings.
for (const marker of ['speakerSelect','Mirror my video','Blur background','Portrait background','qualitySelect','Touch Up Appearance','Audio & Video Settings…']) {
  requireText(quickDevices, marker, `Zoom parity: device/settings control missing: ${marker}`);
}
requireText(twoClient, 'microphone and camera intent synchronize to the other client', 'Zoom parity: microphone/camera synchronization is not tested.');

// 10) Meeting chat, invitation and local recording remain functional features.
requireText(twoClient, 'public and private meeting chat routes correctly', 'Zoom parity: public/private meeting chat is not tested.');
requireText(twoClient, 'one-click invitation carries room and passcode', 'Zoom parity: invitation credentials are not tested.');
requireText(localRecording, 'new MediaRecorder(', 'Zoom parity: Record must be functional, not decorative.');
requireText(localRecording, 'canvas.captureStream(30)', 'Zoom parity: local recording must capture the rendered meeting stage.');

console.log('DOMINIONSTAR_ZOOM_BEHAVIOR_PARITY_OK host-cohost waiting-room share pause annotation dock devices chat record browser-desktop');
