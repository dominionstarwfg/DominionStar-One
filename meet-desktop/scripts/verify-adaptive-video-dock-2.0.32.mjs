import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const runtime=read('ui/runtime-stability.js');
const approved=read('ui/approved-reference-parity.css');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=32))),'Adaptive video-dock authority introduced in 2.0.32 must remain enforced for every later candidate.');
assert.ok(runtime.includes('function syncVideoDockGeometry()'),'Final runtime must own dock geometry.');
assert.ok(runtime.includes('const compact=width<760'),'Compact threshold must be explicit and singular.');
assert.ok(runtime.includes("dock.dataset.dsRuntimeDockMode=userPositioned?'user':compact?'top':'right'"),'Dock must resolve to user/top/right.');
assert.ok(runtime.includes("dock.style.setProperty('right','14px','important')"),'Wide windows must put default dock on the right.');
assert.ok(runtime.includes("dock.style.setProperty('left','14px','important')")&&runtime.includes("dock.style.setProperty('right','14px','important')"),'Compact windows must span the top region.');
assert.ok(runtime.includes("body.style.setProperty('grid-auto-flow','column','important')"),'Compact dock must be horizontal.');
assert.ok(runtime.includes("body.style.setProperty('grid-auto-flow','row','important')"),'Wide dock must be vertical.');
assert.ok(runtime.includes('const currentLeft=parseFloat(dock.style.left)')&&runtime.includes('const currentTop=parseFloat(dock.style.top)'),'User position must be read before resize clamping.');
assert.ok(runtime.includes('clamp(Number.isFinite(currentLeft)?currentLeft'),'Dragged dock must be clamped after resize.');
assert.ok(runtime.includes("window.addEventListener('resize',schedule,{passive:true})"),'Resize must remain event-driven.');
assert.ok(!runtime.includes('setInterval('),'Dock reflow must not add polling.');
assert.ok(runtime.includes('syncParticipantsSurface();layoutSideSurface();installVideoDockDrag();syncVideoDockGeometry();'),'Dock geometry must commit in the same final runtime pass.');
assert.ok(approved.includes('right:14px !important;'),'Approved reference must retain the wide right-filmstrip visual baseline.');

console.log('DOMINIONSTAR_ADAPTIVE_VIDEO_DOCK_2_0_32_OK wide-right compact-top restore-right user-clamp event-driven no-polling');
