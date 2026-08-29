import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../../${rel}`,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const exists=rel=>fs.existsSync(new URL(`../../${rel}`,import.meta.url));
const dynamicImportNeedle=file=>`await ${'import'}('./${file}')`;

const memberLogin=read('assets/js/member-login.js');
const publicHome=read('index.html');
const desktopOAuthReturn=read('assets/js/desktop-oauth-return.js');
const cameraCatalog=read('assets/js/meet/camera-device-stability.js');
const ui=read('assets/js/meet-next/executive6.js');
const hostPrejoin=read('assets/js/meet/hotfix-rc13-1-media-prejoin.js');
const operationBootstrap=read('assets/js/meet/operation-2030-bootstrap.js');
const picker=read('assets/js/meet/desktop-share-picker.js');
const engine=read('assets/js/meeting-engine.js');
const main=read('desktop 2/src/main-v2.mjs');
const bootstrap=read('desktop 2/src/bootstrap.mjs');
const preload=read('desktop 2/src/preload.cjs');
const navigation=read('desktop 2/src/desktop-navigation-authority.mjs');
const lifecycle=read('desktop 2/src/screen-permission-lifecycle.mjs');
const sharePickerAuthority=read('desktop 2/src/share-picker-authority.mjs');
const nativeCapture=read('desktop 2/src/macos-native-capture-authority.mjs');
const home=read('meet-home/desktop.html');
const browserHome=read('meet-home/index.html');
const homeController=read('assets/js/meet/desktop-home-controller.js');
const pkg=JSON.parse(read('desktop 2/package.json'));

assert(memberLogin.includes("provider: 'google'"));
assert(memberLogin.includes('const DESKTOP_OAUTH_BROWSER_RETURN = `${window.location.origin}/`;'));
assert(memberLogin.includes('redirectTo: DESKTOP_OAUTH_BROWSER_RETURN'));
assert(memberLogin.includes('skipBrowserRedirect: true'));
assert(memberLogin.includes('window.dominionDesktop?.openExternal?.(data.url)'));
assert(memberLogin.includes("return '/meet-home/?desktop=1';"));
assert(publicHome.includes('<script src="/assets/js/desktop-oauth-return.js"></script>'));
assert(desktopOAuthReturn.includes('dominionstar://auth/callback'));
assert(desktopOAuthReturn.includes("params.get('access_token')"));
assert(desktopOAuthReturn.includes("params.get('refresh_token')"));
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"));

assert(bootstrap.indexOf(dynamicImportNeedle('share-picker-authority.mjs'))<bootstrap.indexOf(dynamicImportNeedle('main-v2.mjs')));
assert(bootstrap.indexOf(dynamicImportNeedle('screen-permission-lifecycle.mjs'))<bootstrap.indexOf(dynamicImportNeedle('main-v2.mjs')));
assert(bootstrap.indexOf(dynamicImportNeedle('desktop-navigation-authority.mjs'))<bootstrap.indexOf(dynamicImportNeedle('main-v2.mjs')));
assert(navigation.includes("INTERNAL_PATHS=new Set(['/meet','/meet-home','/meet-login','/member-login'])"));
assert(navigation.includes("DESKTOP_HOME_ALIASES=new Set(['/meet-home','/meet-home/index.html','/meet-home/desktop.html'])"));
assert(navigation.includes("if(DESKTOP_HOME_ALIASES.has(route))return 'meet-home/desktop.html'"));
assert(home.includes('desktop-home-controller.js'));
assert(homeController.includes("version:'3.0.0-single-home-generated-default'"));
assert(homeController.includes("const IDENTITY_KEY='ds_meet_identity_preferences_v2'"));
assert(homeController.includes('usePersonalForInstant:false'));
assert(homeController.includes("if(!state.room?.personalRoomId){usePersonal=false"));
assert(home.includes('id="settingsUsePersonal"'));
for(const id of ['newMeeting','joinMeeting','scheduleMeeting','shareScreen'])assert(home.includes(`id="${id}"`),`Home action missing: ${id}`);
assert.equal((home.match(/class="action(?: primary)?" id="/g)||[]).length,4);
assert.equal(exists('assets/js/meet/desktop-home-compact-launch.js'),false);
assert.equal(exists('desktop 2/src/desktop-home-injection.mjs'),false);
assert.equal(exists('desktop 2/src/desktop-home-settings-guard.mjs'),false);
assert(browserHome.includes('Aurora Meeting Assistant'));
const homeResource=(pkg.build?.extraResources||[]).find(entry=>entry?.from==='../meet-home');
assert.deepEqual(homeResource?.filter,['desktop.html']);

assert(cameraCatalog.includes('enumerateDevices()'));
assert(cameraCatalog.includes('cameraSelect')&&cameraCatalog.includes('microphoneSelect')&&cameraCatalog.includes('speakerSelect'));
assert(!cameraCatalog.includes('media.getUserMedia ='));
assert(!cameraCatalog.includes('MutationObserver'));
assert(!cameraCatalog.includes('.stop()'));
assert(ui.includes('const PREVIEW_CAMERA_RETRY_DELAYS_MS=[0,320,760,1400]'));
assert(ui.includes('const acquireUserMediaStable=async constraints=>'));
assert(engine.includes('state.lastCameraReleaseAt=Date.now()'));
assert(engine.includes('recoverCameraTrack({intentSeq:seq})'));
assert(hostPrejoin.includes('await ensureNativeMediaPermissions(constraints);'));
assert(hostPrejoin.includes('stopTracks(hostPreviewStream);'));
assert(hostPrejoin.includes('await sleep(220);'));
assert(!hostPrejoin.includes('navigator.mediaDevices.getUserMedia ='));

assert(operationBootstrap.includes("version:'3.1.0-single-dock-layout-authority'"));
assert(operationBootstrap.includes('/assets/js/meet/dock-resize-quality.js?v=1-single-layout-authority'));
assert(!operationBootstrap.includes('/assets/js/meet/dock-polish-2030.js'));
assert(operationBootstrap.includes('loadMediaEnhancements'));
assert(operationBootstrap.includes('loadPresentationTools'));
assert(!operationBootstrap.includes('meeting-identity-settings'));
assert(!operationBootstrap.includes('media-effect-safety'));

const macPrivacy=pkg.build?.mac?.extendInfo||{};
assert.ok(macPrivacy.NSScreenCaptureUsageDescription,'macOS package must declare NSScreenCaptureUsageDescription');
assert.ok(macPrivacy.NSAudioCaptureUsageDescription,'macOS package must declare NSAudioCaptureUsageDescription');
assert.equal(Object.prototype.hasOwnProperty.call(macPrivacy,'NSScreenCaptureDescription'),false,'obsolete NSScreenCaptureDescription key must not return');

// Physical Mac sharing must match the approved Screens / Applications illustration
// without letting native enumeration pile up or lock the meeting process.
assert.equal(exists('assets/js/meet/desktop-share-permission-guard.js'),false);
assert.equal(exists('desktop 2/src/macos-screen-permission-guard.mjs'),false);
assert.equal(exists('desktop 2/src/macos-system-picker-session.mjs'),false);
assert(!bootstrap.includes('macos-system-picker-session.mjs'));
assert(nativeCapture.includes('export function supportsNativeMacPicker()'));
assert(/supportsNativeMacPicker\(\)\s*\{\s*return false;\s*\}/.test(nativeCapture));
assert(nativeCapture.includes("authority: 'dominionstar-custom-picker'"));
assert(sharePickerAuthority.includes('SOURCE_ENUMERATION_TIMEOUT_MS = 4500'));
assert(sharePickerAuthority.includes('sourceEnumerationInFlight'));
assert(sharePickerAuthority.includes('Promise.race([sourceEnumerationInFlight, timeoutResult()])'));
assert(sharePickerAuthority.includes('useSystemPicker: false'));
assert(main.includes('desktopSession.setDisplayMediaRequestHandler'));
assert.equal((main.match(/setDisplayMediaRequestHandler/g)||[]).length,1);
assert(preload.includes('systemSharePicker: nativeSystemPicker'));
assert(preload.includes('customSharePicker: !nativeSystemPicker'));
assert(engine.includes('const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)'));
assert(engine.includes('window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose'));

assert(lifecycle.includes("systemPreferences.getMediaAccessStatus('screen')"));
assert(!lifecycle.includes('desktopCapturer')&&!lifecycle.includes('getSources('));
assert(lifecycle.includes('captureProbed:false'));
assert(picker.includes('getScreenPermissionStatus'));
assert(picker.includes('const withTimeout='));
assert(picker.includes('if(!dialog.open)dialog.show()'));
assert(!picker.includes('dialog.showModal()'));
assert(!/addEventListener\(['"]focus['"]/.test(picker));
assert(preload.includes('let shareSourcesInFlight = null;'));
assert(preload.includes('if (shareSourcesInFlight) return shareSourcesInFlight;'));

console.log('REAL_MAC_RECOVERY_CONTRACT_OK single-home trusted-browser-oauth-relay approved-custom-picker privacy-keys bounded-enumeration single-handler single-dock-runtime');
