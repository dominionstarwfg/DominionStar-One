import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const vertical = read('assets/js/meet/annotation-vertical-ui.js');
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const permission = read('assets/js/meet/screen-permission-ui-guard.js');
const hdDock = read('assets/js/meet/native-dock-quality.js');

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

console.log('Approved professional share UI guardrails passed.');