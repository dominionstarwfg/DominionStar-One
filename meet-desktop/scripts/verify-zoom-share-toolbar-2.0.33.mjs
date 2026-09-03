import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const css=read('ui/presenter-toolbar.css');
const js=read('ui/presenter-toolbar.js');
const service=read('src/share-service.mjs');
const toolbarHtml=read('ui/presenter-toolbar.html');

const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=33))),'Zoom share-toolbar authority introduced in 2.0.33 must remain enforced for every later candidate.');

assert.ok(service.includes("new BrowserWindow({width:900,height:72,minWidth:720,minHeight:72,maxHeight:292"),'Presenter BrowserWindow must use compact Zoom-scale geometry.');
assert.ok(service.includes('positionNearMain(created,900,72)'),'Presenter toolbar must remain top-centered relative to the active meeting.');
assert.ok(service.includes('const nextHeight=open?286:72'),'Menu expansion must return to compact height when closed.');

assert.ok(css.includes('.toolbar{height:72px'),'Toolbar visual height must match the compact window height.');
assert.ok(css.includes('height:54px;min-width:58px'),'Control buttons must use compact Zoom-scale sizing.');
assert.ok(css.includes('.icon{width:18px;height:18px'),'Presenter icons must remain compact.');
assert.ok(css.includes('.toolbar.auto-hidden'),'Toolbar must provide a dedicated hidden state.');
assert.ok(css.includes('transform:translateY(-58px)'),'Hidden toolbar must retract toward the top edge while leaving a reveal affordance.');
assert.ok(css.includes('transition:transform .18s'),'Toolbar hide/reveal must animate smoothly.');
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'),'Toolbar motion must respect reduced-motion preference.');

assert.ok(js.includes('const AUTO_HIDE_MS=2400'),'Toolbar inactivity timeout must be explicit and bounded.');
assert.ok(js.includes("toolbar.classList.remove('auto-hidden')"),'Pointer activity must reveal the toolbar.');
assert.ok(js.includes("toolbar.classList.add('auto-hidden')"),'Inactivity must hide the toolbar.');
assert.ok(js.includes("window.addEventListener('pointermove'"),'Pointer movement must reveal controls.');
assert.ok(js.includes("window.addEventListener('pointerenter'"),'Pointer entry must reveal controls.');
assert.ok(js.includes("toolbar.classList.toggle('menu-open',Boolean(open))"),'Open menus must pin the toolbar visible.');
assert.ok(js.includes("toolbar.classList.add('menu-open');reactions=document.createElement('div')"),'Reaction menu must pin the toolbar visible.');
assert.ok(!js.includes('setInterval('),'Auto-hide must remain event/timer driven with no polling loop.');

for(const command of ['audio','video','participants','chat','pause','annotate','show-meeting','stop']){
  assert.ok(toolbarHtml.includes('data-command="'+command+'"'),`Working presenter command must remain present: ${command}`);
}

console.log('DOMINIONSTAR_ZOOM_SHARE_TOOLBAR_2_0_33_OK compact-900x72 controls-54px top-floating auto-hide pointer-reveal menu-pin reduced-motion commands-preserved');
