import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const memberLogin = read('assets/js/member-login.js');
const cameraCatalog = read('assets/js/meet/camera-device-stability.js');
const ui = read('assets/js/meet-next/executive6.js');
const hostPrejoin = read('assets/js/meet/hotfix-rc13-1-media-prejoin.js');
const operationBootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const picker = read('assets/js/meet/desktop-share-picker.js');
const engine = read('assets/js/meeting-engine.js');
const main = read('desktop 2/src/main-v2.mjs');
const bootstrap = read('desktop 2/src/bootstrap.mjs');
const preload = read('desktop 2/src/preload.cjs');
const desktopSession = read('desktop 2/src/desktop-session.mjs');
const nativeCapture = read('desktop 2/src/macos-native-capture-authority.mjs');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const screenLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
const screenGuard = read('desktop 2/src/macos-screen-permission-guard.mjs');

// Desktop authentication is a Meet flow, not an embedded copy of the public site.
assert(memberLogin.includes("provider: 'google'"), 'Desktop login must expose Google OAuth.');
assert(memberLogin.includes("redirectTo: 'dominionstar://auth/callback'"), 'Desktop Google OAuth must return through the DominionStar deep link.');
assert(memberLogin.includes("skipBrowserRedirect: true"), 'Desktop Google OAuth must use the system browser instead of embedding Google inside Electron.');
assert(memberLogin.includes("returned.get('access_token')"), 'Desktop OAuth callback must consume the returned access token.');
assert(memberLogin.includes("returned.get('refresh_token')"), 'Desktop OAuth callback must consume the returned refresh token.');
assert(memberLogin.includes('supabase.auth.setSession({'), 'Desktop OAuth callback must persist the browser-authenticated session inside Electron.');
assert(memberLogin.includes("returnLink.textContent = '← Back to DominionStar Meet'"), 'Desktop login must return to DominionStar Meet, not the public platform.');
assert(memberLogin.includes("return '/meet-home/?desktop=1'"), 'Desktop authentication must default back to Meet Home.');
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"), 'Native app must accept the DominionStar OAuth callback.');

// Desktop shell must never expose Netlify review infrastructure.
assert(bootstrap.indexOf("await import('./desktop-navigation-authority.mjs')") < bootstrap.indexOf("await import('./main-v2.mjs')"), 'Desktop navigation authority must load before main window startup.');
assert(navigation.includes("const INTERNAL_PATHS = new Set(['/meet', '/meet-home', '/meet-login', '/member-login'])"), 'Desktop internal route allowlist changed unexpectedly.');
assert(navigation.includes("void shell.openExternal(url.toString())"), 'Public DominionStar routes must open in the system browser instead of replacing the desktop app.');
assert(desktopSession.includes("target.searchParams.set('ntl-drawer-state', 'hidden')"), 'Every preview load must request Netlify Drawer hidden state.');
assert(navigation.includes("src.includes('app.netlify.com')") && navigation.includes("iframe.remove()"), 'Desktop navigation authority must remove cross-origin Netlify drawer frames.');
assert(preload.includes('installQaPreviewChromeBlocker') && preload.includes('iframe[src*="app.netlify.com"]'), 'Preload must independently suppress injected Netlify review frames.');
assert(navigation.includes('Collaborate on this Deploy Preview') && navigation.includes('Log in to the Netlify Drawer'), 'Visible-text cleanup must remain a fallback for Netlify variants.');

// Camera privacy and identity now use explicit single ownership. The passive
// catalog may enumerate/name devices, but cannot acquire/stop camera hardware.
assert(cameraCatalog.includes('enumerateDevices()'), 'Passive device catalog must enumerate attached hardware.');
assert(cameraCatalog.includes('cameraSelect') && cameraCatalog.includes('microphoneSelect') && cameraCatalog.includes('speakerSelect'), 'Passive catalog must hydrate camera, microphone and speaker selectors.');
assert(cameraCatalog.includes('knownLabels') && cameraCatalog.includes('looksOpaque'), 'Device catalog must cache real labels and reject opaque device IDs.');
assert(cameraCatalog.includes('replaceChildren(fragment)') && cameraCatalog.includes('sameOptions'), 'Device catalog must avoid selector churn when hardware did not change.');
assert(!cameraCatalog.includes('media.getUserMedia ='), 'Passive catalog must never wrap getUserMedia.');
assert(!cameraCatalog.includes('MutationObserver'), 'Passive catalog must not run DOM-wide feedback observers.');
assert(!cameraCatalog.includes('.stop()'), 'Passive catalog must never stop physical media tracks.');

// Executive 6 / meeting engine own normal prejoin and in-meeting camera intent.
assert(ui.includes('const PREVIEW_CAMERA_RETRY_DELAYS_MS=[0,320,760,1400]'), 'Normal prejoin must retain bounded camera reacquisition.');
assert(ui.includes('const acquireUserMediaStable=async constraints=>'), 'Normal prejoin must use the stable acquisition path.');
assert(ui.includes("state.stream?.getVideoTracks?.().forEach(track=>{try{state.stream.removeTrack(track);}"), 'Video Off must remove the camera from the current preview stream.');
assert(ui.includes("track.readyState!=='ended')track.stop()"), 'Video Off must physically release camera hardware.');
assert(engine.includes('state.lastCameraReleaseAt=Date.now()'), 'Meeting engine must remember physical camera release before reacquisition.');
assert(engine.includes('recoverCameraTrack({intentSeq:seq})'), 'Meeting Video On must use bounded recovery tied to latest user intent.');

// Desktop host prejoin is scoped to its temporary checkpoint only and hands off
// once to the meeting engine without reintroducing a global media wrapper.
assert(hostPrejoin.includes('await ensureNativeMediaPermissions(constraints);'), 'Host prejoin must honor native macOS camera/mic permission state.');
assert(hostPrejoin.includes('stopTracks(hostPreviewStream);'), 'Host prejoin must release its temporary preview before meeting entry.');
assert(hostPrejoin.includes('await sleep(220);'), 'Host preview handoff must remain short and deterministic.');
assert(hostPrejoin.includes("await replaceHostTrack('audio',preferredDevice('microphone'));"), 'Mic On must acquire a missing microphone track on host prejoin.');
assert(!hostPrejoin.includes('navigator.mediaDevices.getUserMedia ='), 'Host prejoin must never wrap getUserMedia globally.');
assert(!hostPrejoin.includes('__dsLocalDeviceRouting'), 'Retired global media routing must not return.');
assert(operationBootstrap.includes('mediaIdle') && operationBootstrap.includes('requestIdleCallback'), 'Advanced camera/effect modules must wait for initial UI/media startup to settle.');
assert(!operationBootstrap.includes('microphone-device-identity.js'), 'A duplicate microphone selector owner must not return.');
assert(!operationBootstrap.includes('camera-reaction-polish.js'), 'Deleted camera/reaction selector bundle must not return.');

// One desktop screen-share authority: branded picker + a one-way native macOS
// permission lifecycle. Capture enumeration is forbidden until access is already
// granted in the process that is going to use it.
assert(bootstrap.includes("await import('./macos-native-capture-authority.mjs')"), 'Desktop bootstrap must retain capture capability reporting.');
assert(bootstrap.includes("await import('./macos-screen-permission-guard.mjs')"), 'Desktop bootstrap must install the macOS capture guard before runtime modules.');
assert(nativeCapture.includes("authority: 'dominionstar-custom-picker'"), 'macOS must report DominionStar as the primary capture authority.');
assert(nativeCapture.includes('enabled: false'), 'Apple system picker must be disabled as the primary user-facing picker.');
assert(preload.includes('systemSharePicker: nativeSystemPicker') && preload.includes('customSharePicker: !nativeSystemPicker'), 'Preload must expose one final capture authority.');
assert(engine.includes('window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose'), 'Meeting engine must route desktop sharing through the branded picker.');
assert(picker.includes('if(!dialog.open)dialog.showModal()'), 'Share click must open the branded picker immediately.');
assert(picker.includes("data-filter=\"screen\">Screens"), 'Source picker must have a real Screens tab.');
assert(picker.includes("data-filter=\"window\">Application windows"), 'Source picker must have a real Application windows tab.');
assert(picker.includes('SOURCE_RETRY_DELAYS'), 'Share source enumeration must retry instead of appearing dead.');
assert(screenGuard.includes("systemPreferences.getMediaAccessStatus('screen')"), 'Native guard must inspect macOS Screen Recording status before capture.');
assert(screenGuard.includes("permission !== 'granted'"), 'Native guard must block capture enumeration while permission is ungranted.');
assert(screenGuard.includes('DOMINIONSTAR_SCREEN_PERMISSION_REQUIRED'), 'Ungrantable capture must fail inside DominionStar instead of invoking another macOS prompt.');
assert(screenGuard.includes('DOMINIONSTAR_SCREEN_PERMISSION_RESTART_REQUIRED'), 'Returning from Screen Recording settings must require one clean app restart.');
assert(screenLifecycle.includes('QA_PREVIEW_HOST'), 'QA preview must receive the same native screen-permission state as production.');
assert(screenLifecycle.includes("if (raw !== 'granted') return blockedStatus(raw)"), 'Screen lifecycle must stop before capture probing while permission is ungranted.');
assert(screenLifecycle.includes("if (initialScreenPermission !== 'granted')"), 'A newly granted permission must require a fresh process before capture probing.');
assert(screenLifecycle.includes('desktopCapturer.getSources') && screenLifecycle.includes('probeCaptureReadiness'), 'A fresh granted process must confirm the actual Electron capture backend.');
assert(screenLifecycle.includes('sourceCount') && screenLifecycle.includes('previewCount'), 'Screen permission diagnostics must report real source and preview counts.');
assert(!operationBootstrap.includes('screen-permission-ui-guard.js'), 'Duplicate browser screen-permission authority must remain out of the active runtime.');

console.log('Real Mac OAuth/navigation/single-owner-media/one-way-screen-permission regression contract passed.');
