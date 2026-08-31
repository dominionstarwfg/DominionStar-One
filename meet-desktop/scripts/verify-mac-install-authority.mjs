import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const bootstrap=read('src/bootstrap.mjs');
const relaunch=read('src/relaunch-service.mjs');
const html=read('ui/index.html');
const participantPanelStability=read('ui/participant-panel-stability.css');

assert.equal(pkg.main,'src/bootstrap.mjs','Packaged desktop must start through the canonical macOS install bootstrap.');
assert(bootstrap.includes("app.isInApplicationsFolder()"),'Bootstrap must detect whether the packaged Mac app is already installed in /Applications.');
assert(bootstrap.includes("app.moveToApplicationsFolder"),'Bootstrap must use Electron’s canonical /Applications move authority.');
assert(bootstrap.includes("conflictType=String(type||'')")&&bootstrap.includes("return conflictType==='exists'"),'A newer launched copy may replace a non-running stale copy while explicitly detecting an already-running installed copy.');
assert(bootstrap.includes("process.env.CI"),'CI package verification must not move the app out of the runner workspace.');
assert(bootstrap.includes("if(install.moved)return"),'A successful canonical move must stop the outside-Applications startup path and let Electron relaunch the installed copy.');
assert(bootstrap.includes("const needsCanonicalInstall=packagedMac()&&!app.isInApplicationsFolder()"),'Bootstrap must remember that an outside-Applications packaged launch requires canonicalization.');
assert(bootstrap.includes("if(needsCanonicalInstall){")&&bootstrap.includes("rejectNonCanonicalLaunch(install)"),'A failed canonical move must be rejected instead of launching the meeting runtime from the DMG or Downloads.');
assert(bootstrap.includes("existsAndRunning")&&bootstrap.includes("app.quit()"),'A running stale /Applications conflict must fail closed so two runnable DominionStar copies cannot coexist.');
assert(relaunch.includes('const execPath=process.execPath')&&relaunch.includes('const args=process.argv.slice(1)'),'Permission recovery relaunch must capture the exact running executable and arguments.');
assert(relaunch.includes('app.relaunch({execPath,args})'),'Permission recovery must relaunch the exact installed DominionStar executable.');
assert(html.includes('href="./participant-panel-stability.css"'),'Meeting shell must load the first-frame participant-panel stability guard.');
assert(participantPanelStability.includes('left:auto!important')&&participantPanelStability.includes('right:10px!important')&&participantPanelStability.includes('transform:none!important'),'Participants panel must begin on the Zoom-style right edge before runtime reconciliation.');
assert(!participantPanelStability.includes('left:50%!important')&&!participantPanelStability.includes('translateX(-50%)'),'Rejected centered Participants geometry must never return on the first frame.');

console.log('DOMINIONSTAR_MAC_INSTALL_AUTHORITY_OK canonical-install fail-closed-existsAndRunning exact-binary-relaunch first-frame-participant-right');
