import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const web = read('assets/js/meet/slide-control-parity.js');
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const preload = read('desktop 2/src/preload.cjs');
const native = read('desktop 2/src/slide-control-native.mjs');
const desktopBootstrap = read('desktop 2/src/bootstrap.mjs');
const presenterToolbar = read('desktop 2/src/presenter-toolbar.js');
const presenterParity = read('desktop 2/src/presenter-command-parity.mjs');
const hostedParity = read('assets/js/meet/presenter-command-web-parity.js');
const navigation = read('desktop 2/src/desktop-navigation-authority.mjs');
const qa = read('.github/workflows/desktop-pr-verify.yml');

assert(web.includes("name:'ECDH'") && web.includes("name:'AES-GCM'"),
  'Slide-control grants and commands must use ephemeral authenticated encryption.');
assert(web.includes("dominionstar-slide-${roomId()}") && web.includes("['hello','grant','revoke','command']"),
  'Slide control must use its dedicated realtime signaling surface.');
assert(web.includes("['previous','next'].includes(data?.command)"),
  'Remote slide-control payloads must be restricted to Previous and Next.');
assert(web.includes("powerpoint|keynote|google\\s*slides") && web.includes("source.kind==='screen'"),
  'Slide control must recognize supported presentation windows and whole-screen presentation mode.');
assert(web.includes('getSlideControlPermission') && web.includes('applySlideControlCommand'),
  'Hosted slide control must use the narrow native permission and navigation bridge.');
assert(web.includes('revokeAll') && web.includes('Stop Slide Control'),
  'Presenter must be able to revoke all delegated slide control immediately.');
assert(web.includes('engine.on(\'screen-ended\'') && web.includes("setSlideControlState?.({active:false})"),
  'Stopping screen share must disable native slide command execution.');

assert(native.includes("if (!['previous', 'next'].includes(safe)) return false;"),
  'Native slide-control IPC must reject every command except Previous and Next.');
assert(native.includes('isTrustedAccessibilityClient') && native.includes('desktop:slide-control-permission'),
  'macOS slide control must explicitly verify Accessibility permission.');
assert(native.includes("native.Key.Right") && native.includes("native.Key.Left"),
  'Native execution must map only to left/right slide navigation keys.');
assert(desktopBootstrap.includes("import('./slide-control-native.mjs')"),
  'Desktop bootstrap must load the native slide-control subsystem.');
assert(preload.includes('const BRIDGE_VERSION = 14') && preload.includes('getSlideControlPermission') && preload.includes('applySlideControlCommand'),
  'Desktop bridge 14 must expose only the dedicated slide-control bridge operations.');
assert(preload.includes("ipcRenderer.send('desktop:slide-control-state', { active: false })"),
  'Desktop endShare must disable slide-control execution natively.');
assert(presenterToolbar.includes("data-command='slide-control'") || presenterToolbar.includes("dataset.command='slide-control'"),
  'Native presenter toolbar must expose Slide Control.');
assert(presenterParity.includes("safe === 'slide-control'") && hostedParity.includes("safe === 'slide-control'"),
  'Slide Control must traverse native presenter toolbar to the hosted meeting UI.');
assert(bootstrap.includes('slide-control-parity.js') && bootstrap.includes('data-ds-slide-control-parity'),
  'Certified runtime must load delegated slide control.');

// Desktop QA no longer mutates native trust to a temporary Netlify hostname.
// It keeps the canonical DominionStar origin and serves the exact PR runtime
// from the packaged local desktop-runtime through the trusted HTTPS handler.
assert(navigation.includes("const PRODUCTION_HOSTS=new Set(['dominionstarld.com','www.dominionstarld.com'])") &&
       navigation.includes("function installLocalDesktopRuntime()") &&
       navigation.includes("desktopSession.protocol.handle('https'") &&
       qa.includes('DOMINIONSTAR_DESKTOP_LOCAL_RUNTIME_CERTIFIED') &&
       qa.includes('Runtime source: packaged local desktop-runtime served under https://dominionstarld.com') &&
       !qa.includes('DOMINIONSTAR_DESKTOP_NATIVE_TRUST_OK'),
  'The clean desktop QA path must preserve canonical native trust and certify packaged PR runtime ownership.');

console.log('Encrypted delegated slide-control guardrails passed with packaged local runtime trust.');
