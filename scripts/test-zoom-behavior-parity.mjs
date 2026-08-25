import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const meetHtml = read('meet/index.html');
const executive = read('assets/js/meet-next/executive6.js');
const meetingEngine = read('assets/js/meeting-engine.js');
const desktopSharePicker = read('assets/js/meet/desktop-share-picker.js');
const shareView = read('assets/js/meet/share-view-controls.js');
const illustration = read('assets/js/meet/illustration-ui-parity.js');
const hostCohostUi = read('assets/js/meet/host-cohost-ui-parity.js');
const quickDevices = read('assets/js/meet/quick-device-menu-parity.js');
const dockPolish = read('assets/js/meet/dock-polish-2030.js');
const shareAnnotation = read('assets/js/meet/share-annotation.js');
const liveTranscription = read('assets/js/meet/live-transcription.js');
const localRecording = read('assets/js/meet/local-recording.js');
const nativeCapture = read('desktop 2/src/macos-native-capture-authority.mjs');
const nativePickerSession = read('desktop 2/src/macos-system-picker-session.mjs');
const screenLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
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

// 4) Physical-Mac sharing follows a permission-first native path. Permission
// status is deliberately lightweight and must never enumerate capture sources.
// The fallback picker appears immediately and remains non-modal, so a slow OS
// transition cannot lock the rest of the meeting. Source enumeration begins
// only after macOS reports Screen Recording access as granted.
requireText(nativeCapture, 'const nativePicker = supportsNativeMacPicker()', 'Zoom parity: macOS native picker capability must be resolved.');
requireText(nativeCapture, 'enabled: nativePicker', 'Zoom parity: macOS 15+ native screen picker must be enabled.');
requireText(nativeCapture, "nativePicker ? 'macos-system-picker' : 'dominionstar-custom-picker'", 'Zoom parity: macOS must retain a DominionStar fallback when system picker is unavailable.');
requireText(nativePickerSession, '{ useSystemPicker: true }', 'Zoom parity: Electron must delegate macOS 15+ source selection to the system picker.');
requireText(meetingEngine, 'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)', 'Zoom parity: meeting engine must consume native picker capability.');
requireText(meetingEngine, 'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose', 'Zoom parity: custom picker must be skipped when native system selection is active.');
requireText(desktopSharePicker, 'data-filter="screen">Screens', 'Zoom parity: fallback desktop share picker must expose Screens.');
requireText(desktopSharePicker, 'data-filter="window">Application windows', 'Zoom parity: fallback desktop share picker must expose application windows.');
requireText(desktopSharePicker, 'Share sound', 'Zoom parity: fallback desktop share picker must offer computer sound when supported.');
requireText(desktopSharePicker, 'Optimize for video sharing', 'Zoom parity: fallback desktop share picker must offer motion optimization.');
requireText(desktopSharePicker, 'role="switch" data-optimize', 'Zoom parity: share options must use modern switches.');
requireText(desktopSharePicker, 'const withTimeout=', 'Zoom parity: fallback native IPC must never wait indefinitely.');
requireText(desktopSharePicker, 'const requestSources=()=>withTimeout', 'Zoom parity: fallback source enumeration must be bounded.');
const visibleIndex=desktopSharePicker.indexOf('dialog.show()');
const runtimeIndex=desktopSharePicker.indexOf('getRuntimeInfo?.()');
assert(visibleIndex>=0&&runtimeIndex>=0&&visibleIndex<runtimeIndex,'Zoom parity: fallback picker must become visible immediately and remain non-modal.');
const permissionGateIndex=desktopSharePicker.indexOf("if(screen!=='granted'||permissionState?.requiresRestart)");
const sourceRequestIndex=desktopSharePicker.indexOf('next=await requestSources()');
assert(permissionGateIndex>=0&&sourceRequestIndex>=0&&permissionGateIndex<sourceRequestIndex,'Zoom parity: macOS permission must be checked before any source enumeration.');
requireText(desktopSharePicker, "if(sources.length){settingsVisited=false;permission.hidden=true;list.hidden=false", 'Zoom parity: real share sources must bypass permission-label recovery.');
requireText(desktopSharePicker, "const granted=screen==='granted'", 'Zoom parity: fallback picker must use the lightweight macOS permission state.');
requireText(desktopSharePicker, 'settingsButton.hidden=granted||restartRequired;', 'Zoom parity: Screen Recording Settings must disappear after active access is proven.');
requireText(desktopSharePicker, "if(screen==='granted'&&!current?.requiresRestart){void loadSources();return;}", 'Zoom parity: returning from Settings must proceed directly when macOS already exposes granted access.');
requireText(screenLifecycle, 'permission status must never enumerate desktop capture sources', 'Zoom parity: screen-permission status must remain free of desktopCapturer calls.');
assert(!screenLifecycle.includes('desktopCapturer.getSources'), 'Zoom parity: permission status may not probe desktop capture sources.');
requireText(screenLifecycle, "captureReady:granted", 'Zoom parity: granted macOS access must be represented without a blocking capture probe.');
requireText(desktopSharePicker, 'You do not need to reopen Privacy & Security again.', 'Zoom parity: the one-time restart path must explicitly prevent a Settings loop.');

// 5) Browser sharing stays browser-native while desktop sharing stays native-app
// controlled. The web client intentionally carries a lighter capability set.
requireText(meetingEngine, 'navigator.mediaDevices.getDisplayMedia(displayOptions)', 'Zoom parity: browser screen sharing must use getDisplayMedia.');
requireText(shareView, 'media.__dsWebDisplayMediaBoundary = true', 'Zoom parity: browser display-media boundary is missing.');
assert(!shareView.includes("bootstrap.src = '/assets/js/meet/operation-2030-bootstrap.js"), 'Zoom parity: browser runtime must not leak desktop bootstrap ownership.');
assert(!shareView.includes('meeting-identity-bridge.js'), 'Zoom parity: retired browser identity bridge must not return.');
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

// 11) Active-speaker behavior, Pin and Spotlight remain distinct. A local pin is
// a local view choice; Spotlight is synchronized for everyone and overrides the
// active-speaker election until removed.
requireText(executive, 'function electActiveSpeaker(force=false,preferredId=\'\')', 'Zoom parity: active-speaker election is missing.');
requireText(executive, 'if(state.spotlightParticipantId)', 'Zoom parity: Spotlight does not override active-speaker election.');
requireText(executive, "add('Pin my video'", 'Zoom parity: local video Pin is missing.');
requireText(executive, "'Spotlight for everyone'", 'Zoom parity: host/co-host Spotlight for everyone is missing.');
requireText(executive, "engine.on('spotlight'", 'Zoom parity: synchronized Spotlight reception is missing.');

// 12) Entry cues and remembered join preferences match desktop-meeting behavior.
requireText(executive, "preferences:{joinMuted:false,joinCameraOff:false", 'Zoom parity: remembered join mic/camera preferences are missing.');
requireText(meetHtml, 'id="alwaysJoinMuted"', 'Zoom parity: always-join-muted preference control is missing.');
requireText(meetHtml, 'id="alwaysJoinCameraOff"', 'Zoom parity: always-join-camera-off preference control is missing.');
requireText(executive, "playTone('join')", 'Zoom parity: participant join chime is missing.');

// 13) Scheduling supports one-time and recurring meetings with stable meeting
// credentials and explicit waiting-room/passcode choices.
requireText(meetHtml, 'id="scheduleMeetingAction"', 'Zoom parity: Schedule meeting entry point is missing.');
requireText(meetHtml, 'id="recurringMeetingAction"', 'Zoom parity: Recurring meeting entry point is missing.');
requireText(executive, "$('scheduleRecurring')?.addEventListener('change'", 'Zoom parity: recurring schedule controls are not wired.');
requireText(executive, "const recurring=$('scheduleRecurring').checked", 'Zoom parity: schedule submission does not persist recurring state.');
requireText(executive, "frequency:recurring?$('scheduleFrequency').value:null", 'Zoom parity: recurring frequency is missing.');
requireText(executive, 'link:buildMeetingJoinLink(pendingCredentials.id,{passcode,waiting:waitingRoom})', 'Zoom parity: scheduled meeting link does not carry its meeting security choices.');

// 14) Live captions/transcription are meeting-aware and language-selectable.
for (const language of ["{code:'en', label:'English'}","{code:'fr', label:'French'}","{code:'es', label:'Spanish'}","{code:'zh', label:'Mandarin Chinese'}"]) {
  requireText(liveTranscription, language, `Zoom parity: live-caption language option is missing: ${language}`);
}
requireText(liveTranscription, 'window.SpeechRecognition || window.webkitSpeechRecognition', 'Zoom parity: browser speech-recognition path is missing.');
requireText(liveTranscription, "engine.transcript?.({text,final:true", 'Zoom parity: finalized captions are not sent into meeting transcription.');
requireText(liveTranscription, "stopButton.hidden=!(state.roomActive && snap.isHost)", 'Zoom parity: stop-captions-for-everyone must remain host-only.');

console.log('DOMINIONSTAR_ZOOM_BEHAVIOR_PARITY_OK host-cohost waiting-room native-mac-share pause annotation dock devices chat record speaker spotlight scheduling captions browser-desktop');