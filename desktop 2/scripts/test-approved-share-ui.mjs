import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url),'utf8').replace(/\r\n/g,'\n');
const exists = rel => fs.existsSync(new URL(`../../${rel}`, import.meta.url));
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const illustrationParity = read('assets/js/meet/illustration-ui-parity.js');
const dockPolish = read('assets/js/meet/dock-polish-2030.js');
const quickDeviceMenu = read('assets/js/meet/quick-device-menu-parity.js');
const shareOptimization = read('assets/js/meet/share-optimization-parity.js');
const desktopSharePicker = read('assets/js/meet/desktop-share-picker.js');
const meetingEngine = read('assets/js/meeting-engine.js');
const presenterToolbar = read('desktop 2/src/presenter-toolbar.html');
const presenterToolbarJs = read('desktop 2/src/presenter-toolbar.js');
const hostedPresenterParity = read('assets/js/meet/presenter-command-web-parity.js');
const nativePresenterParity = read('desktop 2/src/presenter-command-parity.mjs');
const desktopPreload = read('desktop 2/src/preload.cjs');
const desktopMain = read('desktop 2/src/main-v2.mjs');
const desktopBootstrap = read('desktop 2/src/bootstrap.mjs');
const sharePickerAuthority = read('desktop 2/src/share-picker-authority.mjs');
const nativeCapture = read('desktop 2/src/macos-native-capture-authority.mjs');
const screenLifecycle = read('desktop 2/src/screen-permission-lifecycle.mjs');
const presenterDock = read('desktop 2/src/presenter-dock.mjs');
const presenterDockHtml = read('desktop 2/src/presenter-dock.html');
const shareLifecycle = read('desktop 2/src/share-lifecycle.mjs');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const desktopSession = read('desktop 2/src/desktop-session.mjs');
const qaWorkflow = read('.github/workflows/desktop-pr-verify.yml');

const barStart=presenterToolbar.indexOf('<div class="bar"');
const menuStart=presenterToolbar.indexOf('<div id="presenterMoreMenu"');
assert(barStart>=0&&menuStart>barStart,'Presenter toolbar structure is missing.');
const directBar=presenterToolbar.slice(barStart,menuStart);
const moreMenu=presenterToolbar.slice(menuStart);
const indexOfDirectCommand = command => directBar.indexOf(`data-command="${command}"`);
const assertBefore = (a,b) => assert(indexOfDirectCommand(a)>=0&&indexOfDirectCommand(b)>=0&&indexOfDirectCommand(a)<indexOfDirectCommand(b),`${a} must appear before ${b}.`);

assert(!bootstrap.includes('screen-permission-ui-guard.js'));
assert(bootstrap.includes('quick-device-menu-parity.js'));
assert(bootstrap.includes('share-optimization-parity.js'));
assert(bootstrap.includes('presenter-command-web-parity.js'));
assert(screenLifecycle.includes("ipcMain.handle('desktop:screen-permission-status'"));
assert(screenLifecycle.includes('QA_PREVIEW_HOST'));

// One visible source-selection authority matching the approved illustration.
assert.equal(exists('desktop 2/src/macos-system-picker-session.mjs'),false,'competing system-picker session returned');
assert(desktopBootstrap.indexOf("await import('./share-picker-authority.mjs')")<desktopBootstrap.indexOf("await import('./main-v2.mjs')"),'Share-picker authority must install before main-v2.');
assert(sharePickerAuthority.includes('SOURCE_ENUMERATION_TIMEOUT_MS = 4500'),'Native source enumeration must be bounded.');
assert(sharePickerAuthority.includes('sourceEnumerationInFlight'),'Native source enumeration must be single-flight.');
assert(sharePickerAuthority.includes('Promise.race([sourceEnumerationInFlight, timeoutResult()])'),'A stalled source probe must return control instead of freezing the meeting.');
assert(sharePickerAuthority.includes('useSystemPicker: false'),'Apple native picker must not create a second visible selection surface.');
assert(nativeCapture.includes('export function supportsNativeMacPicker()'));
assert(nativeCapture.includes('return false;'),'Renderer capability must choose the DominionStar picker.');
assert(nativeCapture.includes("authority: 'dominionstar-custom-picker'"));
assert(desktopMain.includes('desktopSession.setDisplayMediaRequestHandler'));
assert.equal((desktopMain.match(/setDisplayMediaRequestHandler/g)||[]).length,1,'Desktop runtime must install exactly one display-media handler.');
assert(desktopPreload.includes('systemSharePicker: nativeSystemPicker')&&desktopPreload.includes('customSharePicker: !nativeSystemPicker'));
assert(meetingEngine.includes('const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)'));
assert(meetingEngine.includes('window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose'));

// Approved Screens / Applications chooser remains non-modal and bounded.
assert(desktopPreload.includes('let shareSourcesInFlight = null;'));
assert(desktopPreload.includes('if (shareSourcesInFlight) return shareSourcesInFlight;'));
assert(desktopSharePicker.includes('data-filter="screen">Screens'));
assert(desktopSharePicker.includes('data-filter=\"window\">Applications'));
assert(desktopSharePicker.includes('<span>Share system audio</span>'));
assert(desktopSharePicker.includes('<span>Optimize for video sharing</span>'));
assert(desktopSharePicker.includes('class=\"ds-share-switch-row\" hidden><span>Share DominionStar windows</span>'));
assert(desktopSharePicker.includes('background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border-color:#60a5fa'));
assert(desktopSharePicker.includes('const withTimeout='));
assert(desktopSharePicker.includes('const requestSources=()=>withTimeout'));
assert(desktopSharePicker.includes('if(!dialog.open)dialog.show()'));
assert(!desktopSharePicker.includes('dialog.showModal()'));
assert(desktopSharePicker.includes('#desktopSharePicker::backdrop{background:transparent}'));
assert(desktopSharePicker.includes('PERMISSION_RESTART_KEY'));
assert(desktopSharePicker.includes('allowFreshProcessProbe'));
assert(desktopSharePicker.includes("if(dialog.open)dialog.close('cancel')"));
assert(!/addEventListener\(['"]focus['"]/.test(desktopSharePicker));
assert(screenLifecycle.includes("systemPreferences.getMediaAccessStatus('screen')"));
assert(!screenLifecycle.includes('desktopCapturer')&&!screenLifecycle.includes('getSources('));
assert(screenLifecycle.includes('captureProbed:false'));
assert(desktopSharePicker.includes('optimize:Boolean(optimize.checked)'));
assert(desktopSharePicker.includes('role="switch" data-optimize'));
assert(shareOptimization.includes("track.contentHint = optimizeForVideo ? 'motion' : 'detail'"));

for(const required of ['speakerSelect','Mirror my video','Blur background','Portrait background','qualitySelect','Touch Up Appearance','Audio & Video Settings…'])assert(quickDeviceMenu.includes(required),`missing device control: ${required}`);
assert(quickDeviceMenu.includes('ds-quick-switch'));

// Approved compact presenter hierarchy: frequent actions direct, secondary tools under More.
const approvedPresenterOrder=['audio','video','pause','participants','chat','more','stop'];
for(const command of approvedPresenterOrder)assert(indexOfDirectCommand(command)>=0,`missing direct presenter command ${command}`);
for(let i=0;i<approvedPresenterOrder.length-1;i+=1)assertBefore(approvedPresenterOrder[i],approvedPresenterOrder[i+1]);
for(const command of ['new-share','annotate','layout','show-meeting']){
  assert(!directBar.includes(`data-command="${command}"`),`${command} must not lengthen the primary sharing toolbar.`);
  assert(moreMenu.includes(`data-command="${command}"`),`${command} must remain available under More.`);
}
assert(presenterToolbar.includes('<svg'));
assert(!presenterToolbar.includes('class="share-rail"'),'There must be one toolbar, not a second share rail.');
assert(directBar.includes('class="share-live"')&&directBar.includes('You are sharing'));
assert(directBar.includes('class="share-stop"')&&directBar.includes('Stop Share'));
assert(presenterToolbarJs.includes('EXPANDED_WIDTH=610'));
assert(presenterToolbarJs.includes('EXPANDED_HEIGHT=66'));
assert(presenterToolbarJs.includes("label.textContent=sharePaused?'Resume':'Pause'"));
assert(presenterToolbarJs.includes("button.dataset.command='slide-control'"));

for(const [command,id] of [['audio','micBtn'],['video','camBtn'],['participants','participantsBtn'],['chat','chatBtn'],['pause','pauseShareBtn'],['new-share','newShareBtn'],['stop','stopShareBtn']])assert(hostedPresenterParity.includes(`safe === '${command}'`)&&hostedPresenterParity.includes(`click('${id}')`),`${command} routing missing`);
assert(hostedPresenterParity.includes("safe === 'annotate'")&&hostedPresenterParity.includes('DominionShareAnnotation'));

assert(illustrationParity.includes('#shareStatusBar.ds-native-presenter-active{display:none!important}'));
assert(illustrationParity.includes("document.body.classList.contains('local-presentation-active')"));
assert(illustrationParity.includes('window.dominionDesktop.showPresenterToolbar?.()'));
assert(shareLifecycle.includes('keepMeetingOffSharedDesktop'));
assert(shareLifecycle.includes("String(command || '') === 'show-meeting'"));
assert(!shareLifecycle.includes('win.hide()'));
assert(!shareLifecycle.includes('setImmediate(keepMeetingOffSharedDesktop)'));

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

assert(desktopPreload.includes('installDesktopMeetRuntimeLayers'));
assert(desktopPreload.includes('installQaPreviewChromeBlocker'));
assert(desktopSession.includes("target.searchParams.set('ntl-drawer-state', 'hidden')"));
assert(navigation.includes("iframe.getAttribute('src')")&&navigation.includes("src.includes('app.netlify.com')"));
assert(!navigation.includes('Collaborate on this Deploy Preview'));
assert(desktopMain.includes('const DESKTOP_BRIDGE_VERSION = 14;'));
assert(nativePresenterParity.includes("safe === 'layout'")&&nativePresenterParity.includes('cycleLayout()'));
assert(nativePresenterParity.includes("safe === 'show-meeting'")&&nativePresenterParity.includes('showMeeting()'));
assert(qaWorkflow.includes('DOMINIONSTAR_DESKTOP_NATIVE_TRUST_OK'));

console.log('Approved DominionStar share UI passed: compact one-toolbar presenter hierarchy, custom Screens/Applications picker, bounded native enumeration.');
