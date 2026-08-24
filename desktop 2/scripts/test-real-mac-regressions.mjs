import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const memberLogin = read('assets/js/member-login.js');
const camera = read('assets/js/meet/camera-device-stability.js');
const picker = read('assets/js/meet/desktop-share-picker.js');
const engine = read('assets/js/meeting-engine.js');
const main = read('desktop 2/src/main-v2.mjs');
const bootstrap = read('desktop 2/src/bootstrap.mjs');
const preload = read('desktop 2/src/preload.cjs');
const desktopSession = read('desktop 2/src/desktop-session.mjs');
const nativeCapture = read('desktop 2/src/macos-native-capture-authority.mjs');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const screenLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');

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

// Camera Off is a physical privacy invariant, not a CSS state.
assert(camera.includes('const prejoinCameraPreferenceOff'), 'Camera layer must know when prejoin Video Off is selected.');
assert(camera.includes('const enforcePrejoinCameraPrivacy'), 'Camera layer must actively enforce Video Off.');
assert(camera.includes("if (track.readyState !== 'ended') track.stop()"), 'Video Off must physically stop a live camera track.');
assert(camera.includes('if (requested.video && prejoinCameraPreferenceOff()) stopVideoTracks(stream)'), 'Background/prejoin media requests must not resurrect the camera while Video Off is selected.');
assert(camera.includes('unwrapPhysicalTrack'), 'Processed camera effects must retain the physical source as authority.');
assert(camera.includes('knownLabels'), 'Camera layer must cache resolved hardware labels.');
assert(camera.includes('looksOpaqueLabel'), 'Camera settings must reject opaque device IDs as user-facing labels.');
assert(camera.includes('activeCameraDeviceId:'), 'Camera diagnostics must expose the active deviceId.');

// One desktop screen-share authority: branded picker + native permission lifecycle.
assert(bootstrap.includes("await import('./macos-native-capture-authority.mjs')"), 'Desktop bootstrap must retain capture capability reporting.');
assert(nativeCapture.includes("authority: 'dominionstar-custom-picker'"), 'macOS must report DominionStar as the primary capture authority.');
assert(nativeCapture.includes('enabled: false'), 'Apple system picker must be disabled as the primary user-facing picker.');
assert(preload.includes('systemSharePicker: nativeSystemPicker') && preload.includes('customSharePicker: !nativeSystemPicker'), 'Preload must expose one final capture authority.');
assert(engine.includes('window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose'), 'Meeting engine must route desktop sharing through the branded picker.');
assert(picker.includes('if(!dialog.open)dialog.showModal()'), 'Share click must open the branded picker immediately.');
assert(picker.includes("data-filter=\"screen\">Screens"), 'Source picker must have a real Screens tab.');
assert(picker.includes("data-filter=\"window\">Application windows"), 'Source picker must have a real Application windows tab.');
assert(picker.includes('SOURCE_RETRY_DELAYS'), 'Share source enumeration must retry instead of appearing dead.');
assert(screenLifecycle.includes('QA_PREVIEW_HOST'), 'QA preview must receive the same native screen-permission state as production.');
assert(!read('assets/js/meet/operation-2030-bootstrap.js').includes('screen-permission-ui-guard.js'), 'Duplicate browser screen-permission authority must remain out of the active runtime.');

console.log('Real Mac OAuth/navigation/camera-privacy/share-picker regression contract passed.');
