import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const exists = rel => fs.existsSync(new URL(`../${rel}`, import.meta.url));
const requireText = (source, text, message) => assert(source.includes(text), message);

const meetHtml = read('meet/index.html');
const homeHtml = read('meet-home/desktop.html');
const homeController = read('assets/js/meet/desktop-home-controller.js');
const memberLogin = read('assets/js/member-login.js');
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
const screenLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
const desktopMain = read('desktop 2/src/main-v2.mjs');
const desktopPreload = read('desktop 2/src/preload.cjs');
const desktopBootstrap = read('desktop 2/src/bootstrap.mjs');
const presenterHtml = read('desktop 2/src/presenter-toolbar.html');
const presenterJs = read('desktop 2/src/presenter-toolbar.js');
const shareLifecycle = read('desktop 2/src/share-lifecycle.mjs');
const twoClient = read('scripts/browser-two-client-meet-acceptance.mjs');

// Clean-foundation rule: there is exactly one Home owner and one display-media
// owner. These retired layers were directly implicated in physical-Mac regressions.
for (const retired of [
  'desktop 2/src/macos-system-picker-session.mjs',
  'desktop 2/src/desktop-home-injection.mjs',
  'assets/js/meet/desktop-home-compact-launch.js',
  'desktop 2/src/macos-screen-permission-guard.mjs',
  'assets/js/meet/desktop-share-permission-guard.js'
]) assert.equal(exists(retired), false, `Retired competing authority returned: ${retired}`);
requireText(desktopBootstrap, "await import('./screen-permission-lifecycle.mjs')", 'Desktop must load lightweight screen-permission lifecycle.');
requireText(desktopBootstrap, "await import('./main-v2.mjs')", 'main-v2 must remain the single Electron display-media owner.');
assert(!desktopBootstrap.includes('macos-system-picker-session.mjs'), 'Second macOS display-media authority must never return.');
assert(!desktopBootstrap.includes('desktop-home-injection.mjs'), 'Second Home authority must never return.');

// Home stays Zoom-simple: exactly New Meeting, Join, Schedule, Share Screen.
for (const id of ['newMeeting','joinMeeting','scheduleMeeting','shareScreen']) {
  requireText(homeHtml, `id="${id}"`, `Desktop Home action missing: ${id}`);
}
assert(!/id="(?:personalMeeting|personalRoom|startPersonal)"/i.test(homeHtml), 'Personal Room must not return as a Home action.');
requireText(homeHtml, 'id="settingsUsePersonal"', 'Personal Room instant-meeting choice must live in Settings.');
requireText(homeHtml, 'Use Personal Room for instant meetings', 'Settings must explain the Personal Room instant-meeting default.');
requireText(homeController, "$('newMeeting').onclick=()=>void launchNew({share:false})", 'New Meeting must have one launch path.');
requireText(homeController, "$('shareScreen').onclick=()=>void launchNew({share:true})", 'Home Share Screen must have one launch path.');

// Desktop authentication must finish back in the installed application rather
// than entering public DominionStar pages after successful Google sign-in.
requireText(memberLogin, "const DESKTOP_OAUTH_CALLBACK = 'dominionstar://auth/callback'", 'Desktop Google login must target the installed-app callback.');
requireText(memberLogin, 'redirectTo: DESKTOP_OAUTH_CALLBACK', 'Google OAuth must request the installed-app return URI.');
requireText(desktopMain, "url.hostname === 'auth' && url.pathname === '/callback'", 'Electron must consume the DominionStar auth callback.');
requireText(desktopMain, "new URL('/member-login/?desktop=1&oauth=complete', APP_ORIGIN)", 'Auth callback must return to desktop session completion, not the public homepage.');
requireText(memberLogin, 'supabase.auth.setSession({', 'Returned OAuth credentials must establish the persistent Electron session.');
requireText(memberLogin, "return '/meet-home/?desktop=1';", 'Desktop authentication must fail closed to Meet Home.');

// Physical Mac Share Screen: permission status cannot enumerate sources; picker
// is non-modal; opening System Settings terminates the current picker transaction;
// renderer retries cannot stack native source enumeration calls.
requireText(screenLifecycle, "systemPreferences.getMediaAccessStatus('screen')", 'macOS permission lifecycle must read TCC status.');
assert(!screenLifecycle.includes('desktopCapturer') && !screenLifecycle.includes('getSources('), 'Passive screen-permission status must never enumerate capture sources.');
requireText(screenLifecycle, 'captureProbed:false', 'Passive permission status must explicitly avoid a capture probe.');
requireText(desktopMain, 'function supportsMacSystemPicker() {\n  return false;', 'DominionStar custom picker must remain the single macOS picker authority.');
requireText(desktopMain, 'desktopSession.setDisplayMediaRequestHandler', 'Electron must retain one display-media handler.');
requireText(desktopSharePicker, 'data-filter="screen">Screens', 'Share picker must expose real screens.');
requireText(desktopSharePicker, 'data-filter="window">Application windows', 'Share picker must expose real application windows.');
requireText(desktopSharePicker, 'const withTimeout=', 'Share picker native waits must be bounded.');
requireText(desktopSharePicker, 'if(!dialog.open)dialog.show()', 'Share picker must remain non-modal and leave meeting controls alive.');
assert(!desktopSharePicker.includes('dialog.showModal()'), 'Share picker must not lock the meeting behind a modal backdrop.');
requireText(desktopSharePicker, 'markRestartNeeded();', 'Opening macOS Settings must mark a clean permission transition.');
requireText(desktopSharePicker, "if(dialog.open)dialog.close('cancel')", 'Picker must close before opening macOS Settings.');
assert(!desktopSharePicker.includes("window.addEventListener('focus'"), 'Returning from System Settings must not automatically restart capture.');
requireText(desktopPreload, 'let shareSourcesInFlight = null;', 'Desktop bridge must serialize native capture-source enumeration.');
requireText(desktopPreload, 'if (shareSourcesInFlight) return shareSourcesInFlight;', 'Share retries must reuse one native source request instead of stacking calls.');
requireText(desktopPreload, 'getShareSources: (options = {}) => getShareSourcesSingleFlight(options)', 'Renderer share-source bridge must use single-flight enumeration.');

// Camera/microphone and share continuity.
requireText(twoClient, 'microphone and camera intent synchronize to the other client', 'Microphone/camera synchronization is not exercised.');
requireText(meetingEngine, 'navigator.mediaDevices.getDisplayMedia(displayOptions)', 'Browser screen sharing must remain browser-native.');
requireText(shareView, 'media.__dsWebDisplayMediaBoundary = true', 'Browser display-media boundary is missing.');
requireText(twoClient, 'Share Screen traverses browser-native getDisplayMedia without desktop bootstrap leakage', 'Browser share path is not exercised.');

// Normal meeting toolbar and role boundaries.
for (const id of ['micBtn','camBtn','participantsBtn','chatBtn','shareBtn','reactionBtn','moreBtn','leaveBtn']) {
  requireText(meetHtml, `id="${id}"`, `Meeting control missing: ${id}`);
}
requireText(illustration, "label.textContent='Security'", 'Host Security control is missing.');
requireText(illustration, "label.textContent=isHost?'End':'Leave'", 'Host End versus attendee/co-host Leave behavior is missing.');
requireText(twoClient, "getByRole('button', { name: 'Make co-host', exact: true }).click()", 'Host-to-co-host promotion is not exercised.');
requireText(twoClient, "assert(await guest.locator('#endAllBtn').getAttribute('hidden') !== null", 'Co-host End Meeting for All restriction is not tested.');
requireText(twoClient, "assert(!/Make co-host|Make host/i.test(cohostMenuText)", 'Co-host host/co-host appointment restriction is not tested.');
requireText(hostCohostUi, 'enforceCohostWaitingRoomBoundary', 'Host-only Waiting Room enablement guard is missing.');

// Waiting room and participant continuity.
requireText(twoClient, 'waiting room is visible to guest and actionable by host', 'Waiting-room admission coverage is missing.');
requireText(twoClient, 'admission creates participant list and video dock on both clients', 'Admitted participant continuity is missing.');
requireText(illustration, "decline.textContent='View'", 'Waiting-room heads-up must use Admit/View behavior.');
requireText(illustration, 'enforceOnePersonDockRule', 'One-person meetings must not show an unnecessary participant strip.');

// Presenter/share controls must remain Zoom-familiar and application-like.
for (const command of ['audio','video','participants','chat','new-share','pause','layout','annotate','show-meeting','more','stop']) {
  requireText(presenterHtml, `data-command="${command}"`, `Presenter command missing: ${command}`);
}
requireText(presenterHtml, '-webkit-app-region:drag', 'Presenter toolbar must be movable.');
requireText(presenterJs, "label.textContent=sharePaused?'Resume':'Pause'", 'Pause Share must visibly become Resume.');
requireText(presenterJs, 'scheduleCollapse()', 'Presenter controls must support compact auto-collapse behavior.');
requireText(illustration, '#shareStatusBar.ds-native-presenter-active{display:none!important}', 'Desktop must not show duplicate presenter toolbars.');
requireText(shareLifecycle, 'keepMeetingOffSharedDesktop', 'Meeting window must stay off the presented desktop unless explicitly shown.');
requireText(twoClient, 'share, private Pause Share presentation continuity, resume and stop', 'Pause/Resume/Stop continuity is not tested.');

// Participant dock must behave like desktop chrome, not page layout.
requireText(dockPolish, "POSITION_KEY='ds_meet_dock_geometry_v3'", 'Participant dock geometry persistence is missing.');
requireText(dockPolish, 'ds-dock-resize-handle', 'Participant dock must be resizable.');
requireText(twoClient, 'desktop resize keeps meeting fixed and participant dock inside the viewport', 'Responsive desktop layout is not tested.');

// Real device menus/settings.
for (const marker of ['speakerSelect','Mirror my video','Blur background','Portrait background','qualitySelect','Touch Up Appearance','Audio & Video Settings…']) {
  requireText(quickDevices, marker, `Device/settings control missing: ${marker}`);
}

// Chat, invitation, recording, active speaker, pin/spotlight.
requireText(twoClient, 'public and private meeting chat routes correctly', 'Public/private meeting chat is not tested.');
requireText(twoClient, 'one-click invitation carries room and passcode', 'Invitation credentials are not tested.');
requireText(localRecording, 'new MediaRecorder(', 'Record must be functional, not decorative.');
requireText(executive, "function electActiveSpeaker(force=false,preferredId='')", 'Active-speaker election is missing.');
requireText(executive, "add('Pin my video'", 'Local video Pin is missing.');
requireText(executive, "'Spotlight for everyone'", 'Host/co-host Spotlight is missing.');

// Entry cues/preferences and scheduling.
requireText(meetHtml, 'id="alwaysJoinMuted"', 'Always-join-muted preference is missing.');
requireText(meetHtml, 'id="alwaysJoinCameraOff"', 'Always-join-camera-off preference is missing.');
requireText(executive, "playTone('join')", 'Participant join chime is missing.');
requireText(meetHtml, 'id="scheduleMeetingAction"', 'Schedule meeting entry point is missing.');
requireText(meetHtml, 'id="recurringMeetingAction"', 'Recurring meeting entry point is missing.');
requireText(executive, "const recurring=$('scheduleRecurring').checked", 'Recurring schedule submission is missing.');

// Annotation/laser and live transcription.
requireText(shareAnnotation, "channel.on('broadcast',{event:'meet-annotation'},({payload})=>handleRemote(payload))", 'Synchronized annotation reception is missing.');
requireText(shareAnnotation, "addTool('Laser','laser')", 'Shared-screen laser pointer is missing.');
for (const language of ["{code:'en', label:'English'}","{code:'fr', label:'French'}","{code:'es', label:'Spanish'}","{code:'zh', label:'Mandarin Chinese'}"]) {
  requireText(liveTranscription, language, `Live-caption language option is missing: ${language}`);
}
requireText(liveTranscription, 'window.SpeechRecognition || window.webkitSpeechRecognition', 'Speech-recognition path is missing.');
requireText(liveTranscription, "stopButton.hidden=!(state.roomActive && snap.isHost)", 'Stop captions for everyone must remain host-only.');

console.log('DOMINIONSTAR_ZOOM_BEHAVIOR_PARITY_OK clean-home direct-auth single-capture no-freeze camera-mic waiting-room host-cohost dock pause-share chat scheduling captions');
