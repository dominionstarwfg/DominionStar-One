import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const bootstrap=read('src/bootstrap.mjs');
const html=read('ui/index.html');
const participantPanelStability=read('ui/participant-panel-stability.css');

assert.equal(pkg.main,'src/bootstrap.mjs','Packaged desktop must start through the canonical macOS install bootstrap.');
assert(bootstrap.includes("app.isInApplicationsFolder()"),'Bootstrap must detect whether the packaged Mac app is already installed in /Applications.');
assert(bootstrap.includes("app.moveToApplicationsFolder"),'Bootstrap must use Electron’s canonical /Applications move authority.');
assert(bootstrap.includes("conflictType=>conflictType==='exists'"),'A newer launched copy must be allowed to replace an older non-running /Applications copy.');
assert(bootstrap.includes("process.env.CI"),'CI package verification must not move the app out of the runner workspace.');
assert(bootstrap.includes("if(install.moved)return"),'A successful canonical move must stop the outside-Applications startup path and let Electron relaunch the installed copy.');
assert(html.includes('href="./participant-panel-stability.css"'),'Meeting shell must load the first-frame participant-panel stability guard.');
assert(participantPanelStability.includes('.room-side:not([style*="left:"])')&&participantPanelStability.includes('left:50%!important')&&participantPanelStability.includes('transform:translateX(-50%)'),'Participants panel must be centered before persisted JavaScript geometry is applied.');

console.log('DOMINIONSTAR_MAC_INSTALL_AUTHORITY_OK canonical-install first-frame-participant-center');
