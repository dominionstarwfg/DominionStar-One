import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g,'\n');
const exists = rel => fs.existsSync(new URL(`../${rel}`, import.meta.url));
const requireText = (source, text, message) => assert(source.includes(text), message);
const dynamicImportNeedle = file => `await ${'import'}('./${file}')`;

const meetHtml = read('meet/index.html');
const homeHtml = read('meet-home/desktop.html');
const browserHome = read('meet-home/index.html');
const homeController = read('assets/js/meet/desktop-home-controller.js');
const memberLogin = read('assets/js/member-login.js');
const executive = read('assets/js/meet-next/executive6.js');
const meetingEngine = read('assets/js/meeting-engine.js');
const desktopSharePicker = read('assets/js/meet/desktop-share-picker.js');
const shareView = read('assets/js/meet/share-view-controls.js');
const illustration = read('assets/js/meet/illustration-ui-parity.js');
const hostCohostUi = read('assets/js/meet/host-cohost-ui-parity.js');
const quickDevices = read('assets/js/meet/quick-device-menu-parity.js');
const dockLayout = read('assets/js/meet/dock-layout-v2.js');
const dockResize = read('assets/js/meet/dock-resize-quality.js');
const shareAnnotation = read('assets/js/meet/share-annotation.js');
const liveTranscription = read('assets/js/meet/live-transcription.js');
const localRecording = read('assets/js/meet/local-recording.js');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const screenLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
const desktopMain = read('desktop 2/src/main-v2.mjs');
const desktopPreload = read('desktop 2/src/preload.cjs');
const desktopBootstrap = read('desktop 2/src/bootstrap.mjs');
const nativeCapture = read('desktop 2/src/macos-native-capture-authority.mjs');
const presenterHtml = read('desktop 2/src/presenter-toolbar.html');
const presenterJs = read('desktop 2/src/presenter-toolbar.js');
const shareLifecycle = read('desktop 2/src/share-lifecycle.mjs');
const twoClient = read('scripts/browser-two-client-meet-acceptance.mjs');
const pkg = JSON.parse(read('desktop 2/package.json'));

for (const retired of [
  'desktop 2/src/macos-system-picker-session.mjs',
  'desktop 2/src/desktop-home-injection.mjs',
  'assets/js/meet/desktop-home-compact-launch.js',
  'desktop 2/src/desktop-home-settings-guard.mjs',
  'desktop 2/src/macos-screen-permission-guard.mjs',
  'assets/js/meet/desktop-share-permission-guard.js'
]) assert.equal(exists(retired), false, `Retired competing authority returned: ${retired}`);
requireText(desktopBootstrap, dynamicImportNeedle('screen-permission-lifecycle.mjs'), 'Desktop must load lightweight screen-permission lifecycle.');
requireText(desktopBootstrap, dynamicImportNeedle('main-v2.mjs'), 'main-v2 must remain the single Electron display-media owner.');
assert(!desktopBootstrap.includes('desktop-home-settings-guard.mjs'),'Settings must be owned directly by the Home controller.');

// One Zoom-simple desktop Home. Browser Home may exist for web users but must
// never be reachable or packaged as the installed app Home.
for (const id of ['newMeeting','joinMeeting','scheduleMeeting','shareScreen']) requireText(homeHtml, `id="${id}"`, `Desktop Home action missing: ${id}`);
assert(!/id="(?:personalMeeting|personalRoom|startPersonal)"/i.test(homeHtml), 'Personal Room must not return as a Home action.');
requireText(homeHtml, 'id="settingsUsePersonal"', 'Personal Room instant-meeting choice must live in Settings.');
requireText(homeController, "const IDENTITY_KEY='ds_meet_identity_preferences_v2'", 'Clean meeting-identity preference generation is missing.');
requireText(homeController, 'usePersonalForInstant:false', 'Fresh meeting IDs must be the default.');
requireText(homeController, "version:'3.0.0-single-home-generated-default'", 'Single Home controller version is missing.');
requireText(homeController, "if(!state.room?.personalRoomId){usePersonal=false", 'Missing Personal Room must fall back to a fresh Meeting ID.');
requireText(navigation, "const DESKTOP_HOME_ALIASES=new Set(['/meet-home','/meet-home/index.html','/meet-home/desktop.html'])", 'Desktop Home aliases must collapse to one surface.');
requireText(navigation, "if(DESKTOP_HOME_ALIASES.has(route))return 'meet-home/desktop.html'", 'Desktop must never serve browser Home for /meet-home.');
assert(browserHome.includes('Aurora Meeting Assistant'),'Browser Home fixture changed unexpectedly; desktop isolation test lost its target.');
const homeResource=(pkg.build?.extraResources||[]).find(entry=>entry?.from==='../meet-home');
assert.deepEqual(homeResource?.filter,['desktop.html'],'Desktop package must exclude meet-home/index.html.');

// Google OAuth runs in the normal browser and returns directly to the installed
// app through the registered dominionstar:// callback. The callback must be in
// Supabase Auth > URL Configuration > Additional Redirect URLs.
requireText(memberLogin, "const DESKTOP_OAUTH_CALLBACK = 'dominionstar://auth/callback';", 'Desktop Google login must use the registered app protocol.');
requireText(memberLogin, 'redirectTo: DESKTOP_OAUTH_CALLBACK', 'Google OAuth must request the direct desktop callback URI.');
requireText(memberLogin, 'skipBrowserRedirect: true', 'Desktop OAuth must keep browser navigation outside the installed renderer.');
requireText(memberLogin, 'window.dominionDesktop?.openExternal?.(data.url)', 'Google OAuth must authenticate in the normal browser.');
assert(!memberLogin.includes('window.location.assign(data.url)'), 'Google OAuth must not strand the installed app inside the browser flow.');
requireText(desktopMain, "url.hostname === 'auth' && url.pathname === '/callback'", 'Desktop must consume the auth callback deep link.');
requireText(desktopMain, "app.setAsDefaultProtocolClient('dominionstar'", 'Desktop must register the DominionStar protocol with the OS.');
assert.equal(pkg.build?.protocols?.[0]?.schemes?.[0],'dominionstar','Desktop package must declare the DominionStar protocol.');
requireText(memberLogin, "return '/meet-home/?desktop=1';", 'Desktop authentication must fail closed to Meet Home.');

// One display-media handler. The approved DominionStar picker is the visible
// source-selection surface; macOS remains the underlying capture authority.
requireText(screenLifecycle, "systemPreferences.getMediaAccessStatus('screen')", 'macOS permission lifecycle must read TCC status.');
assert(!screenLifecycle.includes('desktopCapturer') && !screenLifecycle.includes('getSources('), 'Passive permission status must never enumerate capture sources.');
requireText(desktopMain, 'function supportsMacSystemPicker()', 'macOS native-picker capability check is missing.');
requireText(desktopMain, 'return false;', 'Apple system picker must not replace the approved DominionStar picker.');
requireText(desktopMain, 'desktopSession.setDisplayMediaRequestHandler', 'Electron display-media handler is missing.');
requireText(desktopMain, '{ useSystemPicker: supportsMacSystemPicker() }', 'The single Electron handler must preserve one capture authority.');
assert.equal((desktopMain.match(/setDisplayMediaRequestHandler/g)||[]).length,1,'Desktop must have exactly one display-media handler.');
requireText(nativeCapture, 'export function supportsNativeMacPicker()', 'Renderer capability reporting for native Mac picker is missing.');
requireText(nativeCapture, "authority: nativePicker ? 'macos-system-picker' : 'dominionstar-custom-picker'", 'Native capture authority reporting is inconsistent.');
requireText(meetingEngine, 'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)', 'Meeting engine must choose the native Mac path from runtime capability.');
requireText(meetingEngine, 'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose', 'Approved DominionStar picker must own desktop source selection when the system picker is disabled.');

// Approved DominionStar picker remains non-modal and single-flight.
requireText(desktopSharePicker, 'if(!dialog.open)dialog.show()', 'Approved picker must remain non-modal.');
assert(!desktopSharePicker.includes('dialog.showModal()'), 'Approved picker must not lock the meeting.');
assert(!desktopSharePicker.includes("window.addEventListener('focus'"), 'Returning from System Settings must not automatically restart fallback capture.');
requireText(desktopPreload, 'let shareSourcesInFlight = null;', 'Desktop bridge must serialize fallback source enumeration.');
requireText(desktopPreload, 'if (shareSourcesInFlight) return shareSourcesInFlight;', 'Fallback retries must reuse one native source request.');

requireText(twoClient, 'microphone and camera intent synchronize to the other client', 'Microphone/camera synchronization is not exercised.');
requireText(meetingEngine, 'navigator.mediaDevices.getDisplayMedia(displayOptions)', 'Screen sharing must use standards getDisplayMedia.');
requireText(shareView, 'media.__dsWebDisplayMediaBoundary = true', 'Browser display-media boundary is missing.');

for (const id of ['micBtn','camBtn','participantsBtn','chatBtn','shareBtn','reactionBtn','moreBtn','leaveBtn']) requireText(meetHtml, `id="${id}"`, `Meeting control missing: ${id}`);
requireText(illustration, "label.textContent='Security'", 'Host Security control is missing.');
requireText(illustration, "label.textContent=isHost?'End':'Leave'", 'Host End versus attendee/co-host Leave behavior is missing.');
requireText(twoClient, "getByRole('button', { name: 'Make co-host', exact: true }).click()", 'Host-to-co-host promotion is not exercised.');
requireText(hostCohostUi, 'enforceCohostWaitingRoomBoundary', 'Host-only Waiting Room enablement guard is missing.');
requireText(twoClient, 'waiting room is visible to guest and actionable by host', 'Waiting-room admission coverage is missing.');
requireText(twoClient, 'admission creates participant list and video dock on both clients', 'Admitted participant continuity is missing.');
requireText(illustration, 'enforceOnePersonDockRule', 'One-person meetings must not show an unnecessary participant strip.');

for (const command of ['audio','video','participants','chat','new-share','pause','layout','annotate','show-meeting','more','stop']) requireText(presenterHtml, `data-command="${command}"`, `Presenter command missing: ${command}`);
requireText(presenterHtml, '-webkit-app-region:drag', 'Presenter toolbar must be movable.');
requireText(presenterJs, "label.textContent=sharePaused?'Resume':'Pause'", 'Pause Share must visibly become Resume.');
requireText(illustration, '#shareStatusBar.ds-native-presenter-active{display:none!important}', 'Desktop must not show duplicate presenter toolbars.');
requireText(shareLifecycle, 'keepMeetingOffSharedDesktop', 'Presentation lifecycle compatibility export is missing.');
assert(!shareLifecycle.includes('win.hide()'), 'Presentation must keep DominionStar Meet visible instead of hiding it.');
requireText(twoClient, 'share, private Pause Share presentation continuity, resume and stop', 'Pause/Resume/Stop continuity is not tested.');
requireText(dockLayout, "dock.dataset.positionOwner='dock-layout-v2'", 'Participant dock must expose one position/orientation authority.');
requireText(dockLayout, 'const setOrientation=orientation=>', 'Participant dock orientation authority is missing.');
requireText(dockResize, "position: 'dock-layout-v2'", 'Resize layer must defer dock position to dock-layout-v2.');
requireText(dockResize, "orientation: 'dock-layout-v2'", 'Resize layer must defer dock orientation to dock-layout-v2.');
requireText(dockResize, "resize: 'dock-resize-quality'", 'Participant dock resize authority is missing.');
assert(!dockResize.includes('POSITION_KEY')&&!dockResize.includes('--ds-dock-left')&&!dockResize.includes('--ds-dock-top'),'Resize layer must never own dock geometry position.');
for (const marker of ['speakerSelect','Mirror my video','Blur background','Portrait background','qualitySelect','Touch Up Appearance','Audio & Video Settings…']) requireText(quickDevices, marker, `Device/settings control missing: ${marker}`);
requireText(twoClient, 'public and private meeting chat routes correctly', 'Public/private meeting chat is not tested.');
requireText(twoClient, 'one-click invitation carries room and passcode', 'Invitation credentials are not tested.');
requireText(localRecording, 'new MediaRecorder(', 'Record must be functional, not decorative.');
requireText(executive, "function electActiveSpeaker(force=false,preferredId='')", 'Active-speaker election is missing.');
requireText(executive, "'Spotlight for everyone'", 'Host/co-host Spotlight is missing.');
requireText(meetHtml, 'id="alwaysJoinMuted"', 'Always-join-muted preference is missing.');
requireText(meetHtml, 'id="alwaysJoinCameraOff"', 'Always-join-camera-off preference is missing.');
requireText(executive, "playTone('join')", 'Participant join chime is missing.');
requireText(meetHtml, 'id="scheduleMeetingAction"', 'Schedule meeting entry point is missing.');
requireText(meetHtml, 'id="recurringMeetingAction"', 'Recurring meeting entry point is missing.');
requireText(shareAnnotation, "addTool('Laser','laser')", 'Shared-screen laser pointer is missing.');
for (const language of ["{code:'en', label:'English'}","{code:'fr', label:'French'}","{code:'es', label:'Spanish'}","{code:'zh', label:'Mandarin Chinese'}"]) requireText(liveTranscription, language, `Live-caption language option is missing: ${language}`);

console.log('DOMINIONSTAR_ZOOM_BEHAVIOR_PARITY_OK single-home direct-desktop-oauth native-mac-picker fallback-serialized camera-mic waiting-room host-cohost single-dock-authority pause-share chat scheduling captions');
