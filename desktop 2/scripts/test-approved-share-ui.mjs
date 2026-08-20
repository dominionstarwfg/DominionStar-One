import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const vertical = read('assets/js/meet/annotation-vertical-ui.js');
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const permission = read('assets/js/meet/screen-permission-ui-guard.js');
const hdDock = read('assets/js/meet/native-dock-quality.js');
const presenterToolbar = read('desktop 2/src/presenter-toolbar.html');
const presenterToolbarJs = read('desktop 2/src/presenter-toolbar.js');
const nativePresenterParity = read('desktop 2/src/presenter-command-parity.mjs');
const hostedPresenterParity = read('assets/js/meet/presenter-command-web-parity.js');
const desktopBootstrap = read('desktop 2/src/bootstrap.mjs');
const presenterDock = read('desktop 2/src/presenter-dock.mjs');
const presenterDockHtml = read('desktop 2/src/presenter-dock.html');

assert(vertical.includes('ds-vertical-annotation-rail'), 'Approved annotation UI must use the vertical left-side rail.');
assert(vertical.includes('left:18px!important') && vertical.includes('top:50%!important') && vertical.includes('flex-direction:column!important'),
  'Annotation rail must remain vertically positioned on the left side of the shared stage.');
assert(vertical.includes("Pen:") && vertical.includes("Highlighter:") && vertical.includes("Laser:") && vertical.includes("Undo:") && vertical.includes("Clear:") && vertical.includes("Done:"),
  'Vertical annotation rail must keep the complete professional icon toolset.');
assert(bootstrap.includes('annotation-vertical-ui.js') && bootstrap.includes('data-ds-annotation-vertical-ui'),
  'Certified bootstrap must load the approved vertical annotation UI after the annotation engine.');
assert(bootstrap.indexOf('share-annotation.js') < bootstrap.indexOf('annotation-vertical-ui.js'),
  'Vertical annotation presentation must decorate the proven annotation engine rather than replace it.');
assert(bootstrap.includes('screen-permission-ui-guard.js'),
  'Certified share runtime must retain the permission-state loop guard.');
assert(bootstrap.includes('native-dock-quality.js'),
  'Certified share runtime must retain the HD participant dock quality layer.');
assert(permission.includes('Capture initialization failed') && permission.includes('Retry Capture'),
  'Granted permission with missing sources must be treated as capture initialization failure, not another permission prompt.');
assert(hdDock.includes('720') && hdDock.includes('.90'),
  'Native participant dock must retain the approved high-resolution/high-quality frame handoff.');

for (const command of ['new-share','pause','layout','annotate','show-meeting','stop']) {
  assert(presenterToolbar.includes(`data-command="${command}"`), `Presenter toolbar must expose working ${command} control.`);
}
assert(presenterToolbar.includes('<svg'), 'Presenter controls must remain vector/icon based.');
assert(presenterToolbarJs.includes('EXPANDED_WIDTH=930'), 'Presenter toolbar must reserve enough space for the complete professional control set.');
assert(desktopBootstrap.includes('presenter-command-parity.mjs'), 'Desktop bootstrap must load presenter command parity.');
assert(nativePresenterParity.includes("safe === 'show-meeting'") && nativePresenterParity.includes("safe === 'layout'") && nativePresenterParity.includes("safe === 'annotate'"),
  'Native presenter parity must implement Show Meeting, Layout, and Annotate.');
assert(nativePresenterParity.includes("screen.on('display-metrics-changed', reflowForDisplayChange)") &&
       nativePresenterParity.includes("screen.on('display-added', reflowForDisplayChange)") &&
       nativePresenterParity.includes("screen.on('display-removed', reflowForDisplayChange)"),
  'Presenter dock must reflow when the active display/work area changes.');
assert(nativePresenterParity.includes('applyLayout(layoutMode, { animate: false })'),
  'Display-driven dock reflow must preserve the active layout mode rather than resetting to a fixed size.');
assert(nativePresenterParity.includes('if (!app.isReady()) return false;') &&
       nativePresenterParity.includes('app.whenReady().then(installDisplayListeners)'),
  'Presenter display listeners and screen access must be deferred until Electron app readiness.');
assert(hostedPresenterParity.includes("safe === 'new-share'") && hostedPresenterParity.includes("click('newShareBtn')"),
  'New Share must reach the real hosted meeting control instead of being decorative.');
assert(hostedPresenterParity.includes("safe === 'annotate'") && hostedPresenterParity.includes('DominionShareAnnotation'),
  'Presenter Annotate must open the real synchronized annotation engine.');
assert(bootstrap.includes('presenter-command-web-parity.js'), 'Certified hosted runtime must load presenter command parity.');
assert(presenterDock.includes('zoomClassDockSize') && presenterDock.includes('area.width*0.18') && presenterDock.includes('area.height*0.74'),
  'Default presenter participant dock must retain the approved Zoom-class footprint.');
assert(presenterDockHtml.includes('data-layout="stack"') && presenterDockHtml.includes('data-layout="speaker"') && presenterDockHtml.includes('data-layout="grid"'),
  'Presenter Layout must provide real stack, speaker, and grid modes.');

console.log('Approved professional share UI guardrails passed.');
