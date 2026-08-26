import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../../${rel}`,import.meta.url),'utf8');
const exists=rel=>fs.existsSync(new URL(`../../${rel}`,import.meta.url));

const memberLogin=read('assets/js/member-login.js');
const oauthReturn=read('meet-auth-callback/index.html');
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
const nativeCapture=read('desktop 2/src/macos-native-capture-authority.mjs');
const home=read('meet-home/desktop.html');
const homeController=read('assets/js/meet/desktop-home-controller.js');

// Authentication architecture: browser OAuth returns through a dedicated HTTPS
// Meet bridge, then the custom protocol persists the session in Electron. The
// hosted Supabase project must separately allow-list that redirect URL; physical
// QA is the authority for that deployment configuration.
assert(memberLogin.includes("provider: 'google'"));
assert(memberLogin.includes("new URL('/meet-auth-callback/', window.location.origin)"));
assert(memberLogin.includes('redirectTo: desktopOAuthReturnUrl()'));
assert(!memberLogin.includes("redirectTo: 'dominionstar://auth/callback'"));
assert(oauthReturn.includes("new URL('dominionstar://auth/callback')"));
assert(oauthReturn.includes('window.location.assign(deepLink.toString())'));
assert(memberLogin.includes('supabase.auth.setSession({'));
assert(main.includes("url.hostname === 'auth' && url.pathname === '/callback'"));

// Desktop app owns Meet/auth routes. Home has one controller and exactly four
// primary actions. Personal Room lives in Settings instead of a Home tile/menu.
assert(bootstrap.indexOf("await import('./desktop-navigation-authority.mjs')")<bootstrap.indexOf("await import('./main-v2.mjs')"));
assert(navigation.includes("INTERNAL_PATHS=new Set(['/meet','/meet-home','/meet-login','/member-login'])"));
assert(navigation.includes('shell.openExternal(url.toString())'));
assert(home.includes('desktop-home-controller.js?v=2-settings-own-meeting-identity'));
assert(homeController.includes("version:'2.0.0-settings-own-meeting-identity'"));
assert(home.includes('id="settingsUsePersonal"'));
for(const id of ['newMeeting','joinMeeting','scheduleMeeting','shareScreen'])assert(home.includes(`id="${id}"`),`Home action missing: ${id}`);
for(const retiredId of ['personalIdentity','newMeetingMenuButton','usePersonalRoom','startWithVideo','newMeetingPersonalId'])assert(!home.includes(`id="${retiredId}"`),`retired Home control returned: ${retiredId}`);
assert.equal((home.match(/class="action(?: primary)?" id="/g)||[]).length,4);
assert.equal(exists('assets/js/meet/desktop-home-compact-launch.js'),false);
assert.equal(exists('desktop 2/src/desktop-home-injection.mjs'),false);
assert(!bootstrap.includes('desktop-home-injection.mjs'));
assert(!navigation.includes('resolveDesktopHostIdentity'));
assert(!navigation.includes('installDesktopSettingsAuthority'));

// Camera device catalog remains passive; media acquisition has bounded owners.
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

// Advanced meeting modules no longer all execute during startup.
assert(operationBootstrap.includes("version:'3.0.0-clean-lazy-runtime'"));
assert(operationBootstrap.includes('loadMediaEnhancements'));
assert(operationBootstrap.includes('loadPresentationTools'));
assert(!operationBootstrap.includes('meeting-identity-settings'));
assert(!operationBootstrap.includes('media-effect-safety'));

// Physical Mac Share Screen regression: one selected-source authority only.
// Opening System Settings must close the picker before focus leaves. No capture
// work may automatically resume when focus returns. A fresh process may probe
// real sources because macOS TCC status can lag behind actual granted access.
assert.equal(exists('assets/js/meet/desktop-share-permission-guard.js'),false);
assert.equal(exists('desktop 2/src/macos-screen-permission-guard.mjs'),false);
assert.equal(exists('desktop 2/src/macos-system-picker-session.mjs'),false);
assert(bootstrap.indexOf("await import('./screen-permission-lifecycle.mjs')")<bootstrap.indexOf("await import('./main-v2.mjs')"));
assert(!bootstrap.includes('macos-system-picker-session.mjs'));
assert(nativeCapture.includes('export function supportsNativeMacPicker() { return false; }'));
assert(nativeCapture.includes("authority: 'dominionstar-custom-picker'"));
assert(lifecycle.includes("systemPreferences.getMediaAccessStatus('screen')"));
assert(!lifecycle.includes('desktopCapturer')&&!lifecycle.includes('getSources('));
assert(lifecycle.includes('captureProbed:false'));
assert(lifecycle.includes('desktop:relaunch-for-permissions'));
assert(picker.includes('getScreenPermissionStatus'));
assert(picker.includes('const withTimeout='));
assert(picker.includes('const requestSources=()=>withTimeout'));
assert(picker.includes('if(!dialog.open)dialog.show()'));
assert(!picker.includes('dialog.showModal()'));
assert(picker.includes('PERMISSION_RESTART_KEY'));
assert(picker.includes('allowFreshProcessProbe'));
assert(picker.includes("if(dialog.open)dialog.close('cancel')"));
assert(!/addEventListener\(['"]focus['"]/.test(picker));
const permissionIndex=picker.indexOf('permissionState=await status()');
const sourceIndex=picker.indexOf('next=await requestSources()');
assert(permissionIndex>=0&&sourceIndex>=0&&permissionIndex<sourceIndex);
assert(picker.includes('Restart DominionStar Meet'));
assert(preload.includes('systemSharePicker: nativeSystemPicker'));
assert(preload.includes('customSharePicker: !nativeSystemPicker'));
assert(engine.includes('const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)'));
assert(engine.includes('window.DominionDesktopSharePicker?.choose'));
assert(main.includes("{ useSystemPicker: false }"));

console.log('REAL_MAC_PHYSICAL_SHARE_RECOVERY_CONTRACT_OK');
