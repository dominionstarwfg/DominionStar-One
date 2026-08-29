import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..','..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

const meet=read('meet/index.html');
const bootstrap=read('assets/js/meet/operation-2030-bootstrap.js');
const dockLayout=read('assets/js/meet/dock-layout-v2.js');
const dockResize=read('assets/js/meet/dock-resize-quality.js');
const memberAuth=read('assets/js/member-auth.js');
const homeParity=read('assets/js/meet/desktop-home-approved-parity.js');
const homeHtml=read('meet-home/desktop.html');

assert(meet.includes('/assets/js/meet/dock-layout-v2.js'), 'meet page must load the single dock position/orientation authority');
assert(dockLayout.includes("dock.dataset.positionOwner='dock-layout-v2'"));
assert(dockLayout.includes('const setOrientation=orientation=>'));
assert(dockLayout.includes("dock.addEventListener('pointermove'"));

assert(bootstrap.includes('/assets/js/meet/dock-resize-quality.js?v=1-single-layout-authority'));
assert(!bootstrap.includes('/assets/js/meet/dock-polish-2030.js'), 'desktop preload must not load a second dock drag/orientation authority');
assert(dockResize.includes("position: 'dock-layout-v2'"));
assert(dockResize.includes("orientation: 'dock-layout-v2'"));
assert(dockResize.includes("resize: 'dock-resize-quality'"));
assert(!dockResize.includes('POSITION_KEY'));
assert(!dockResize.includes('--ds-dock-left'));
assert(!dockResize.includes('--ds-dock-top'));
assert(!dockResize.includes('setOrientation'));
assert(!dockResize.includes("querySelector('.dock-grip')"));
assert(!dockResize.includes("document.addEventListener('pointerdown'"));

assert(homeHtml.includes('DominionStar Meet is ready'), 'source fixture changed; update parity test intentionally');
assert(memberAuth.includes('/assets/js/meet/desktop-home-approved-parity.js?v=1-approved-home'));
assert(homeParity.includes("document.querySelector('.status-line')?.remove()"));
assert(homeParity.includes("route !== '/meet-home' || !window.dominionDesktop?.isDesktop"));

console.log('DOMINIONSTAR_DESKTOP_AUTHORITY_REGRESSIONS_OK single dock authority and approved desktop home');
