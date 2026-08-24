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
assert(screenLifecycle.includes("ipcMain.handle('desktop:screen-permission-status'"), 'Native desktop lifecycle must own macOS permission state.');
assert(screenLifecycle.includes('QA_PREVIEW_HOST'), 'QA preview must be trusted by the native screen-permission lifecycle.');

assert(nativeCapture.includes("authority: 'dominionstar-custom-picker'"), 'macOS must report the approved DominionStar source picker as primary.');
assert(nativeCapture.includes('enabled: false'), 'Apple system picker must not silently replace the approved source picker.');
assert(nativeCapture.includes('available: supportsNativeMacPicker()'), 'Native macOS picker availability may remain detectable as fallback capability.');
assert(desktopPreload.includes('systemSharePicker: nativeSystemPicker') && desktopPreload.includes('customSharePicker: !nativeSystemPicker'), 'Renderer must advertise exactly one active share-picker authority.');
assert(desktopMain.includes('function supportsMacSystemPicker() {\n  return false;\n}'), 'Main display-capture handler must keep native picker disabled by default.');
assert(desktopSharePicker.includes('data-filter="screen">Screens'), 'Approved source picker must expose a real Screens tab.');
assert(desktopSharePicker.includes('data-filter="window">Application windows'), 'Approved source picker must expose a real Application windows tab.');
assert(desktopSharePicker.includes('SOURCE_RETRY_DELAYS'), 'Source picker must retry real source enumeration instead of becoming unresponsive.');
assert(desktopSharePicker.includes('if(!dialog.open)dialog.showModal()'), 'Share click must open the branded picker immediately before source enumeration.');
assert(desktopSharePicker.includes("'Screen access is active'") && desktopSharePicker.includes('settingsButton.hidden=granted') && desktopSharePicker.includes('state?.requiresRestart'), 'Granted permission must be represented as active access, hide Settings, and distinguish the one-time restart case.');
assert(desktopSharePicker.includes('optimize:optimize.checked'), 'Desktop share picker must return the Optimize for video sharing decision.');
assert(desktopSharePicker.includes('role="switch" data-optimize'), 'Share options must use modern switch controls rather than checkbox-looking UI.');
assert(illustrationParity.includes("applicationTab.textContent='Applications'"), 'Illustration layer must use the approved Applications tab label.');
assert(illustrationParity.includes('ds-approved-source-picker'), 'Illustration layer must enforce the approved source-picker composition.');
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
assert(navigation.includes('Collaborate on this Deploy Preview') && navigation.includes('Log in to the Netlify Drawer'), 'Text-based Netlify cleanup must remain as fallback.');
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

console.log('Approved final-illustration share UI guardrails passed.');
