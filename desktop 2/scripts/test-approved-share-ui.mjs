import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const exists = rel => fs.existsSync(new URL(`../../${rel}`, import.meta.url));
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const illustrationParity = read('assets/js/meet/illustration-ui-parity.js');
const dockPolish = read('assets/js/meet/dock-polish-2030.js');
const quickDeviceMenu = read('assets/js/meet/quick-device-menu-parity.js');
const shareOptimization = read('assets/js/meet/share-optimization-parity.js');
const desktopSharePicker = read('assets/js/meet/desktop-share-picker.js');
const presenterToolbar = read('desktop 2/src/presenter-toolbar.html');
const presenterToolbarJs = read('desktop 2/src/presenter-toolbar.js');
const hostedPresenterParity = read('assets/js/meet/presenter-command-web-parity.js');
const nativePresenterParity = read('desktop 2/src/presenter-command-parity.mjs');
const desktopPreload = read('desktop 2/src/preload.cjs');
const desktopMain = read('desktop 2/src/main-v2.mjs');
const desktopBootstrap = read('desktop 2/src/bootstrap.mjs');
const nativeCapture = read('desktop 2/src/macos-native-capture-authority.mjs');
const screenLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
const presenterDock = read('desktop 2/src/presenter-dock.mjs');
const presenterDockHtml = read('desktop 2/src/presenter-dock.html');
const shareLifecycle = read('desktop 2/src/share-lifecycle.mjs');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const desktopSession = read('desktop 2/src/desktop-session.mjs');
const qaWorkflow = read('.github/workflows/desktop-pr-verify.yml');

const indexOfCommand = command => presenterToolbar.indexOf(`data-command="${command}"`);
const assertBefore = (a,b) => assert(indexOfCommand(a)>=0&&indexOfCommand(b)>=0&&indexOfCommand(a)<indexOfCommand(b),`${a} must appear before ${b}.`);

// Runtime ownership and advanced features remain deliberate.
assert(!bootstrap.includes('screen-permission-ui-guard.js'));
assert(bootstrap.includes('quick-device-menu-parity.js'));
assert(bootstrap.includes('share-optimization-parity.js'));
assert(bootstrap.includes('presenter-command-web-parity.js'));
assert(screenLifecycle.includes("ipcMain.handle('desktop:screen-permission-status'"));
assert(screenLifecycle.includes('QA_PREVIEW_HOST'));

// Physical Mac: exactly one display-media authority. The system-picker session
// override is retired because it could leave getDisplayMedia pending while macOS
// Settings owned focus. main-v2 keeps the selected-source handler everywhere.
assert.equal(exists('desktop 2/src/macos-system-picker-session.mjs'),false,'competing system-picker session returned');
assert(!desktopBootstrap.includes('macos-system-picker-session.mjs'));
assert(nativeCapture.includes('export function supportsNativeMacPicker() { return false; }'));
assert(nativeCapture.includes("authority: 'dominionstar-custom-picker'"));
assert(/function\s+supportsMacSystemPicker\s*\(\s*\)\s*\{\s*return\s+false\s*;/.test(desktopMain));
assert(desktopMain.includes('desktopSession.setDisplayMediaRequestHandler'));
assert(desktopPreload.includes('systemSharePicker: nativeSystemPicker')&&desktopPreload.includes('customSharePicker: !nativeSystemPicker'));
assert(desktopPreload.includes('let shareSourcesInFlight = null;'));
assert(desktopPreload.includes('if (shareSourcesInFlight) return shareSourcesInFlight;'));

// The branded source picker remains non-modal and bounded. System Settings is a
// terminal action for the current attempt: picker closes first, no focus handler
// auto-runs capture, and the next fresh process may probe real sources even when
// TCC status has not caught up yet.
assert(desktopSharePicker.includes('data-filter="screen">Screens'));
assert(desktopSharePicker.includes('data-filter="window">Application windows'));
assert(desktopSharePicker.includes('const withTimeout='));
assert(desktopSharePicker.includes('const requestSources=()=>withTimeout'));
assert(desktopSharePicker.includes('if(!dialog.open)dialog.show()'));
assert(!desktopSharePicker.includes('dialog.showModal()'));
assert(desktopSharePicker.includes('#desktopSharePicker::backdrop{background:transparent}'));
assert(desktopSharePicker.includes('PERMISSION_RESTART_KEY'));
assert(desktopSharePicker.includes('allowFreshProcessProbe'));
assert(desktopSharePicker.includes("if(dialog.open)dialog.close('cancel')"));
assert(!/addEventListener\(['"]focus['"]/.test(desktopSharePicker));
const permissionIndex=desktopSharePicker.indexOf('permissionState=await status()');
const sourceIndex=desktopSharePicker.indexOf('next=await requestSources()');
assert(permissionIndex>=0&&sourceIndex>=0&&permissionIndex<sourceIndex);
assert(screenLifecycle.includes("systemPreferences.getMediaAccessStatus('screen')"));
assert(!screenLifecycle.includes('desktopCapturer')&&!screenLifecycle.includes('getSources('));
assert(screenLifecycle.includes('captureProbed:false'));
assert(desktopSharePicker.includes('optimize:Boolean(optimize.checked)'));
assert(desktopSharePicker.includes('role="switch" data-optimize'));
assert(shareOptimization.includes("track.contentHint = optimizeForVideo ? 'motion' : 'detail'"));

// Device menus retain meeting-grade controls and modern switch treatment.
for(const required of ['speakerSelect','Mirror my video','Blur background','Portrait background','qualitySelect','Touch Up Appearance','Audio & Video Settings…'])assert(quickDeviceMenu.includes(required),`missing device control: ${required}`);
assert(quickDeviceMenu.includes('ds-quick-switch'));

// Presenter toolbar keeps the approved Zoom-familiar hierarchy.
const approvedPresenterOrder=['audio','video','participants','chat','new-share','pause','layout','annotate','show-meeting','more','stop'];
for(const command of approvedPresenterOrder)assert(indexOfCommand(command)>=0,`missing presenter command ${command}`);
for(let i=0;i<approvedPresenterOrder.length-1;i+=1)assertBefore(approvedPresenterOrder[i],approvedPresenterOrder[i+1]);
assert(presenterToolbar.includes('<svg'));
assert(presenterToolbar.includes('class="share-rail"'));
assert(presenterToolbar.includes('You are screen sharing'));
assert(presenterToolbar.includes('class="share-stop"')&&presenterToolbar.includes('Stop Share'));
assert(presenterToolbarJs.includes('EXPANDED_WIDTH=930'));
assert(presenterToolbarJs.includes('EXPANDED_HEIGHT=96'));
assert(presenterToolbarJs.includes("label.textContent=sharePaused?'Resume':'Pause'"));
assert(presenterToolbarJs.includes("button.dataset.command='slide-control'"));

for(const [command,id] of [['audio','micBtn'],['video','camBtn'],['participants','participantsBtn'],['chat','chatBtn'],['pause','pauseShareBtn'],['new-share','newShareBtn'],['stop','stopShareBtn']])assert(hostedPresenterParity.includes(`safe === '${command}'`)&&hostedPresenterParity.includes(`click('${id}')`),`${command} routing missing`);
assert(hostedPresenterParity.includes("safe === 'annotate'")&&hostedPresenterParity.includes('DominionShareAnnotation'));

// Native presenter ownership prevents duplicate in-window share controls.
assert(illustrationParity.includes('#shareStatusBar.ds-native-presenter-active{display:none!important}'));
assert(illustrationParity.includes("document.body.classList.contains('local-presentation-active')"));
assert(illustrationParity.includes('window.dominionDesktop.showPresenterToolbar?.()'));
assert(shareLifecycle.includes('keepMeetingOffSharedDesktop'));
assert(shareLifecycle.includes("String(command || '') === 'show-meeting'"));
assert(shareLifecycle.includes('setImmediate(keepMeetingOffSharedDesktop)'));

// Normal meeting/dock behavior remains approved.
assert(illustrationParity.includes("label.textContent='Security'"));
assert(illustrationParity.includes("label.textContent=isHost?'End':'Leave'"));
assert(illustrationParity.includes("decline.textContent='View'"));
assert(illustrationParity.includes('enforceOnePersonDockRule'));
assert(illustrationParity.includes('#participantsPanel,#chatPanel{resize:both'));
assert(dockPolish.includes("const POSITION_KEY='ds_meet_dock_geometry_v3'"));
assert(dockPolish.includes('saveGeometry')&&dockPolish.includes('restoreGeometry'));
assert(dockPolish.includes("resizeHandle.className='ds-dock-resize-handle'"));
assert(presenterDock.includes('zoomClassDockSize'));
assert(presenterDockHtml.includes('data-layout="stack"')&&presenterDockHtml.includes('data-layout="speaker"')&&presenterDockHtml.includes('data-layout="grid"'));

// Desktop runtime/trust remains fail-closed.
assert(desktopPreload.includes('installDesktopMeetRuntimeLayers'));
assert(desktopPreload.includes('installQaPreviewChromeBlocker'));
assert(desktopSession.includes("target.searchParams.set('ntl-drawer-state', 'hidden')"));
assert(navigation.includes("iframe.getAttribute('src')")&&navigation.includes("src.includes('app.netlify.com')"));
assert(!navigation.includes('Collaborate on this Deploy Preview'));
assert(desktopMain.includes('const DESKTOP_BRIDGE_VERSION = 14;'));
assert(nativePresenterParity.includes("safe === 'layout'")&&nativePresenterParity.includes('cycleLayout()'));
assert(nativePresenterParity.includes("safe === 'show-meeting'")&&nativePresenterParity.includes('showMeeting()'));
assert(qaWorkflow.includes('DOMINIONSTAR_DESKTOP_NATIVE_TRUST_OK'));

console.log('Approved physical-Mac single-authority share UI and final-illustration guardrails passed.');