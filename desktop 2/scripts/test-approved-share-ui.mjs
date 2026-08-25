import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
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
const nativeCapture = read('desktop 2/src/macos-native-capture-authority.mjs');
const nativePickerSession = read('desktop 2/src/macos-system-picker-session.mjs');
const screenLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
const presenterDock = read('desktop 2/src/presenter-dock.mjs');
const presenterDockHtml = read('desktop 2/src/presenter-dock.html');
const shareLifecycle = read('desktop 2/src/share-lifecycle.mjs');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const desktopSession = read('desktop 2/src/desktop-session.mjs');
const qaWorkflow = read('.github/workflows/desktop-pr-verify.yml');

const indexOfCommand = command => presenterToolbar.indexOf(`data-command="${command}"`);
const assertBefore = (a, b) => assert(indexOfCommand(a) >= 0 && indexOfCommand(b) >= 0 && indexOfCommand(a) < indexOfCommand(b), `${a} must appear before ${b} in the approved presenter toolbar.`);

assert(!bootstrap.includes('screen-permission-ui-guard.js'), 'Certified desktop runtime must not load the duplicate screen-permission UI guard.');
assert(bootstrap.includes('quick-device-menu-parity.js'), 'Certified runtime must keep Zoom-class device menus.');
assert(bootstrap.includes('share-optimization-parity.js'), 'Certified runtime must keep screen-share optimization.');
assert(bootstrap.includes('presenter-command-web-parity.js'), 'Certified runtime must load presenter command routing.');
assert(screenLifecycle.includes("ipcMain.handle('desktop:screen-permission-status'"), 'Native desktop lifecycle must own macOS permission diagnostics.');
assert(screenLifecycle.includes('QA_PREVIEW_HOST'), 'QA preview must be trusted by the native screen-permission lifecycle.');

// Physical Mac QA is authoritative: macOS 15+ uses Electron's native system
// picker so desktopCapturer enumeration cannot freeze the meeting after a TCC
// permission transition. DominionStar's source picker remains the fallback.
assert(nativeCapture.includes('const nativePicker = supportsNativeMacPicker()'), 'macOS capture authority must resolve native picker availability.');
assert(nativeCapture.includes('enabled: nativePicker'), 'macOS 15+ must enable the native system picker.');
assert(nativeCapture.includes("nativePicker ? 'macos-system-picker' : 'dominionstar-custom-picker'"), 'macOS must expose system-picker authority with DominionStar fallback.');
assert(nativePickerSession.includes("session.fromPartition(DESKTOP_PARTITION)"), 'Native system picker must bind to the DominionStar persistent session.');
assert(nativePickerSession.includes('{ useSystemPicker: true }'), 'macOS 15+ display capture must opt into Electron native system-picker handling.');
assert(desktopPreload.includes('systemSharePicker: nativeSystemPicker') && desktopPreload.includes('customSharePicker: !nativeSystemPicker'), 'Renderer must advertise exactly one active share-picker authority.');
assert(desktopSharePicker.includes('data-filter="screen">Screens'), 'Fallback source picker must expose a real Screens tab.');
assert(desktopSharePicker.includes('data-filter="window">Application windows'), 'Fallback source picker must expose a real Application windows tab.');
assert(desktopSharePicker.includes('SOURCE_RETRY_DELAYS'), 'Fallback source picker must retry real source enumeration instead of becoming unresponsive.');
assert(desktopSharePicker.includes('const withTimeout='), 'Fallback source picker must bound native IPC waits.');
const pickerVisibleIndex=desktopSharePicker.indexOf('dialog.showModal()');
const runtimeProbeIndex=desktopSharePicker.indexOf('getRuntimeInfo?.()');
assert(pickerVisibleIndex >= 0 && runtimeProbeIndex >= 0 && pickerVisibleIndex < runtimeProbeIndex, 'Fallback picker must become visible before runtime probing can stall.');
assert(desktopSharePicker.includes("permissionTitle.textContent='Screen access is active'") && desktopSharePicker.includes('settingsButton.hidden=granted||restartRequired') && desktopSharePicker.includes('const granted=screen===\'granted\'||Boolean(state?.captureReady)') && desktopSharePicker.includes('const restartRequired=Boolean(state?.requiresRestart&&!state?.captureReady)'), 'Real capture access must hide Settings and prevent an unnecessary restart loop.');
assert(desktopSharePicker.includes("window.addEventListener('focus',recover,{once:true})") && desktopSharePicker.includes('if(current?.captureReady){void loadSources();return;}'), 'Returning from macOS Settings must prefer real capture recovery before requesting restart.');
assert(screenLifecycle.includes('desktopCapturer.getSources') && screenLifecycle.includes('CAPTURE_PROBE_TIMEOUT_MS') && screenLifecycle.includes('if(probe.captureReady)return'), 'Native permission diagnostics must use a bounded real-capture probe to override stale TCC text.');
assert(desktopSharePicker.includes('optimize:optimize.checked'), 'Desktop fallback share picker must return the Optimize for video sharing decision.');
assert(desktopSharePicker.includes('role="switch" data-optimize'), 'Share options must use modern switch controls rather than checkbox-looking UI.');
assert(illustrationParity.includes("applicationTab.textContent='Applications'"), 'Illustration layer must use the approved Applications tab label.');
assert(illustrationParity.includes('ds-approved-source-picker'), 'Illustration layer must preserve the approved source-picker composition where the fallback is used.');
assert(shareOptimization.includes("track.contentHint = optimizeForVideo ? 'motion' : 'detail'"), 'Share optimization must affect the real presentation track.');

for (const required of ['speakerSelect','Mirror my video','Blur background','Portrait background','qualitySelect','Touch Up Appearance','Audio & Video Settings…']) {
  assert(quickDeviceMenu.includes(required), `Quick device controls must retain ${required}.`);
}
assert(!quickDeviceMenu.includes("${checked?'✓ ':''}"), 'Quick video controls must not regress to checkmark-style toggles.');
assert(quickDeviceMenu.includes('ds-quick-switch'), 'Quick video controls must use modern sliding switch treatment.');

const approvedPresenterOrder = ['audio','video','participants','chat','new-share','pause','layout','annotate','show-meeting','more','stop'];
for (const command of approvedPresenterOrder) assert(indexOfCommand(command) >= 0, `Approved presenter toolbar must visibly expose ${command}.`);
for (let i = 0; i < approvedPresenterOrder.length - 1; i += 1) assertBefore(approvedPresenterOrder[i], approvedPresenterOrder[i + 1]);
assert(presenterToolbar.includes('<svg'), 'Presenter controls must remain vector/icon based.');
assert(presenterToolbar.includes('class="share-rail"'), 'Approved presenter toolbar must include the separate green sharing rail.');
assert(presenterToolbar.includes('You are screen sharing'), 'Sharing rail must use the approved status copy.');
assert(presenterToolbar.includes('class="share-stop"') && presenterToolbar.includes('Stop Share'), 'Stop Share must live on the sharing rail.');
assert(presenterToolbar.indexOf('>Reactions</button>') > presenterToolbar.indexOf('id="presenterMoreMenu"'), 'Reactions must remain under More instead of displacing approved visible controls.');
assert(presenterToolbarJs.includes('EXPANDED_WIDTH=930'), 'Presenter toolbar must reserve the approved full-width hierarchy.');
assert(presenterToolbarJs.includes('EXPANDED_HEIGHT=96'), 'Presenter window must reserve both the control row and green sharing rail.');
assert(presenterToolbarJs.includes("label.textContent=sharePaused?'Resume':'Pause'"), 'Pause must visibly become Resume while sharing is frozen.');
assert(presenterToolbarJs.includes("button.dataset.command='slide-control'"), 'Slide Control must remain available under More without replacing approved visible controls.');

for (const [command, id] of [['audio','micBtn'],['video','camBtn'],['participants','participantsBtn'],['chat','chatBtn'],['pause','pauseShareBtn'],['new-share','newShareBtn'],['stop','stopShareBtn']]) {
  assert(hostedPresenterParity.includes(`safe === '${command}'`) && hostedPresenterParity.includes(`click('${id}')`), `Presenter ${command} must route to the real hosted ${id} control.`);
}
assert(hostedPresenterParity.includes("safe === 'annotate'") && hostedPresenterParity.includes('DominionShareAnnotation'), 'Presenter Annotate must open the real synchronized annotation engine.');

assert(illustrationParity.includes('#shareStatusBar.ds-native-presenter-active{display:none!important}'), 'Local desktop share must hide the obsolete in-window presenter strip.');
assert(illustrationParity.includes("document.body.classList.contains('local-presentation-active')"), 'Illustration parity must detect local presentation mode.');
assert(illustrationParity.includes('window.dominionDesktop.showPresenterToolbar?.()'), 'Local presentation must keep the native presenter toolbar authoritative.');
assert(shareLifecycle.includes('keepMeetingOffSharedDesktop'), 'Share lifecycle must keep the full meeting window off the presented desktop.');
assert(shareLifecycle.includes("String(command || '') === 'show-meeting'"), 'Only explicit Show Meeting may override the hidden meeting window during sharing.');
assert(shareLifecycle.includes('setImmediate(keepMeetingOffSharedDesktop)'), 'macOS activation must not resurrect the meeting window over shared content.');

assert(illustrationParity.includes("label.textContent='Security'"), 'Normal meeting toolbar must use the approved Security label.');
assert(illustrationParity.includes("label.textContent=isHost?'End':'Leave'"), 'Host must see End while attendees/co-hosts retain Leave behavior.');
assert(illustrationParity.includes("decline.textContent='View'"), 'Waiting-room heads-up must use Admit/View instead of destructive Decline.');
assert(illustrationParity.includes('enforceOnePersonDockRule'), 'One-person meetings must not show a participant strip.');
assert(illustrationParity.includes('#participantsPanel,#chatPanel{resize:both'), 'Participants and Chat panels must remain resizable.');
assert(dockPolish.includes("const POSITION_KEY='ds_meet_dock_geometry_v3'"), 'Participant dock geometry must have a stable persistence key.');
assert(dockPolish.includes('localStorage.setItem(POSITION_KEY') && dockPolish.includes('localStorage.getItem(POSITION_KEY)'), 'Participant dock geometry must actually save and restore.');
assert(dockPolish.includes('saveGeometry') && dockPolish.includes('restoreGeometry'), 'Participant dock must expose real geometry save/restore behavior.');
assert(dockPolish.includes("resizeHandle.className='ds-dock-resize-handle'"), 'Participant dock must have a professional resize handle.');
assert(dockPolish.includes('.remote-tile .tile-mic{display:grid!important'), 'Muted microphone status must remain visible on participant tiles.');

assert(desktopPreload.includes('installDesktopMeetRuntimeLayers'), 'Desktop Meet must explicitly load its advanced meeting runtime.');
assert(desktopPreload.includes('installQaPreviewChromeBlocker'), 'Desktop preload must install a renderer-level Netlify review-chrome blocker.');
assert(desktopPreload.includes('iframe[src*="app.netlify.com"]'), 'Renderer-level blocker must target cross-origin Netlify review frames, not only body text.');
assert(desktopSession.includes("target.searchParams.set('ntl-drawer-state', 'hidden')"), 'Every Netlify preview navigation must request the official hidden Drawer state.');
assert(navigation.includes("iframe.getAttribute('src')") && navigation.includes("src.includes('app.netlify.com')"), 'Native navigation authority must remove injected Netlify review frames.');
assert(!navigation.includes('Collaborate on this Deploy Preview') && !navigation.includes('Log in to the Netlify Drawer'), 'Native preview cleanup must not depend on brittle Netlify UI copy.');
assert(desktopPreload.includes('/assets/js/meet/operation-2030-bootstrap.js?v=13-clean-desktop-runtime'), 'Desktop advanced runtime must come from the certified bootstrap.');
assert(desktopPreload.includes('/assets/js/meet/illustration-ui-parity.js?v=1-final-ui-blueprint'), 'Final illustration parity must load after the advanced runtime.');
assert(desktopMain.includes('const DESKTOP_BRIDGE_VERSION = 14;'), 'Native desktop bridge must remain at certified bridge 14.');
assert(desktopMain.includes("'audio', 'video', 'participants', 'chat', 'reactions', 'pause', 'new-share', 'more', 'stop'"), 'Core presenter commands must remain forwarded through the main desktop bridge.');
assert(nativePresenterParity.includes("safe === 'layout'") && nativePresenterParity.includes('cycleLayout()'), 'Layout must be handled by the dedicated native presenter layer.');
assert(nativePresenterParity.includes("safe === 'show-meeting'") && nativePresenterParity.includes('showMeeting()'), 'Show Meeting must be handled by the dedicated native presenter layer.');
assert(nativePresenterParity.includes("safe === 'annotate'") && nativePresenterParity.includes("meetingWindow()?.webContents?.send?.('desktop:presenter-command', safe)"), 'Annotate must traverse the native presenter layer to the hosted meeting.');
assert(presenterDock.includes('zoomClassDockSize'), 'Presenter participant dock must retain Zoom-class sizing logic.');
assert(presenterDockHtml.includes('data-layout="stack"') && presenterDockHtml.includes('data-layout="speaker"') && presenterDockHtml.includes('data-layout="grid"'), 'Presenter Layout must provide stack, speaker, and grid modes.');
assert(qaWorkflow.includes('DOMINIONSTAR_DESKTOP_NATIVE_TRUST_OK'), 'QA must still prove native trust rebinding before packaging.');

console.log('Approved physical-Mac share UI and final-illustration guardrails passed.');