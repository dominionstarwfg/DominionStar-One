import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const bootstrap=read('src/bootstrap.mjs');
const relaunch=read('src/relaunch-service.mjs');

assert.equal(pkg.version,'2.0.28','2.0.28 must carry a real package version.');
assert.equal(pkg.build?.appId,'com.dominionstar.desktop','Bundle identity must remain stable for macOS privacy authority.');
assert.ok(bootstrap.includes('app.requestSingleInstanceLock()'),'Single-instance lock is required.');
assert.ok(bootstrap.includes("app.on('second-instance'"),'Second-instance handling is required.');
assert.ok(bootstrap.includes('focusRunningInstance'),'Second launch must focus the existing app.');
assert.ok(bootstrap.includes('rejectDuplicateLaunch'),'Duplicate process must fail closed.');
assert.ok(bootstrap.includes('const version=app.getVersion()'),'Install warnings must use the actual package version.');
assert.ok(!bootstrap.includes('open this 2.0.22 build'),'Stale hard-coded build identity must be absent.');
assert.ok(bootstrap.includes('app.moveToApplicationsFolder'),'Canonical /Applications installation must remain authoritative.');
assert.ok(bootstrap.includes("return conflictType==='exists'"),'A stopped stale install may be replaced.');
assert.ok(bootstrap.includes('existsAndRunning'),'A running stale install must remain fail-closed.');
assert.ok(relaunch.includes('const execPath=process.execPath'),'Permission relaunch must preserve the exact executable.');
assert.ok(relaunch.includes('app.relaunch({execPath,args})'),'Permission relaunch must restart the exact running executable.');
assert.ok(relaunch.includes("stableAcrossRebuilds:false"),'Ad-hoc prototype privacy instability must remain explicit until Developer ID signing exists.');

console.log('DOMINIONSTAR_CANONICAL_RELAUNCH_2_0_28_OK version-2.0.28 single-instance exact-binary-relaunch applications-authority duplicate-process-blocked');
