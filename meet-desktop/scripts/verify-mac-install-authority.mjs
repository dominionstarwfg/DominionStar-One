import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const bootstrap=read('src/bootstrap.mjs');
const relaunch=read('src/relaunch-service.mjs');
const html=read('ui/index.html');
const participantPanelStability=read('ui/participant-panel-stability.css');

assert.equal(pkg.main,'src/bootstrap.mjs','Packaged desktop must start through the canonical macOS install bootstrap.');
const [versionMajor,versionMinor,versionPatch]=String(pkg.version||'').split('.').map(Number);
assert.ok(Number.isInteger(versionMajor)&&Number.isInteger(versionMinor)&&Number.isInteger(versionPatch),'Desktop package version must be semantic x.y.z.');
assert.ok(versionMajor>2||(versionMajor===2&&(versionMinor>0||(versionMinor===0&&versionPatch>=28))),'Canonical relaunch package identity introduced in 2.0.28 must remain enforced for every later candidate.');
assert(bootstrap.includes('app.requestSingleInstanceLock()'),'Bootstrap must acquire Electron single-instance authority before starting the meeting runtime.');
assert(bootstrap.includes("app.on('second-instance'")&&bootstrap.includes('focusRunningInstance'),'A second launch must focus the already-running DominionStar Meet instead of creating competing presenter windows.');
assert(bootstrap.includes('rejectDuplicateLaunch'),'A duplicate process must fail closed with explicit operator guidance.');
assert(bootstrap.includes("app.isInApplicationsFolder()"),'Bootstrap must detect whether the packaged Mac app is already installed in /Applications.');
assert(bootstrap.includes("app.moveToApplicationsFolder"),'Bootstrap must use Electron’s canonical /Applications move authority.');
assert(bootstrap.includes("const CANONICAL_MAC_APP='/Applications/DominionStar Meet.app'"),'Screen Recording identity must be anchored to one exact canonical application path.');
assert(bootstrap.includes("path.resolve(path.dirname(process.execPath),'../..')")&&bootstrap.includes('currentMacBundlePath'),'Bootstrap must derive the exact running .app bundle path from the executable, not trust Finder display state.');
assert(bootstrap.includes("currentBundlePath===CANONICAL_MAC_APP")&&bootstrap.includes("conflictType:'duplicateName'"),'A renamed /Applications duplicate such as DominionStar Meet 2.app must fail closed before meeting/media initialization.');
assert(bootstrap.includes("remove renamed duplicates such as “DominionStar Meet 2.app”"),'Operator guidance must explicitly explain how to clear a duplicate Mac privacy identity.');
assert(bootstrap.includes("conflictType=String(type||'')")&&bootstrap.includes("return conflictType==='exists'"),'A newer launched copy may replace a non-running stale copy while explicitly detecting an already-running installed copy.');
assert(bootstrap.includes("process.env.CI"),'CI package verification must not move the app out of the runner workspace.');
assert(bootstrap.includes("if(install.moved)return"),'A successful canonical move must stop the outside-Applications startup path and let Electron relaunch the installed copy.');
assert(bootstrap.includes("const needsCanonicalInstall=packagedMac()&&!isCanonicalMacInstall()"),'Bootstrap must reject every packaged Mac launch whose exact .app path is not canonical, including renamed copies already inside Applications.');
assert(bootstrap.includes("if(needsCanonicalInstall){")&&bootstrap.includes("rejectNonCanonicalLaunch(install)"),'A failed or duplicate canonical install must be rejected instead of launching the meeting runtime from the wrong privacy identity.');
assert(bootstrap.includes("existsAndRunning")&&bootstrap.includes("app.quit()"),'A running stale /Applications conflict must fail closed so two runnable DominionStar copies cannot coexist.');
assert(bootstrap.includes('const version=app.getVersion()')&&!bootstrap.includes('open this 2.0.22 build'),'Installer/relaunch guidance must use the actual packaged build identity, never a stale hard-coded version.');
assert(relaunch.includes('const execPath=process.execPath')&&relaunch.includes('const args=process.argv.slice(1)'),'Permission recovery relaunch must capture the exact running executable and arguments.');
assert(relaunch.includes('app.relaunch({execPath,args})'),'Permission recovery must relaunch the exact installed DominionStar executable.');
assert(html.includes('href="./participant-panel-stability.css"'),'Meeting shell must load the first-frame participant-panel stability guard.');
assert(participantPanelStability.includes('left:auto!important')&&participantPanelStability.includes('right:10px!important')&&participantPanelStability.includes('transform:none!important'),'Participants panel must begin on the Zoom-style right edge before runtime reconciliation.');
assert(!participantPanelStability.includes('left:50%!important')&&!participantPanelStability.includes('translateX(-50%)'),'Rejected centered Participants geometry must never return on the first frame.');

console.log('DOMINIONSTAR_MAC_INSTALL_AUTHORITY_OK canonical-install exact-app-path duplicate-name-rejected single-instance dynamic-version fail-closed-existsAndRunning exact-binary-relaunch first-frame-participant-right');
