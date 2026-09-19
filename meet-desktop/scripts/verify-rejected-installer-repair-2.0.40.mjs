import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const service=read('src/share-service.mjs');
const controller=read('ui/share-controller.js');
const app=read('ui/app.js');
const physical=read('ui/zoom-physical-acceptance.js');
const repair=read('ui/rejected-build-repair-2.0.40.css');
const auth=read('ui/auth-password.js');

const version=String(pkg.version||'').split('.').map(Number);
const [versionMajor,versionMinor,versionPatch]=version;
const atLeast=(major,minor,patch)=>versionMajor>major||(versionMajor===major&&(versionMinor>minor||(versionMinor===minor&&versionPatch>=patch)));
assert.ok(version.length===3&&version.every(Number.isInteger),'Desktop package version must be semantic x.y.z.');
assert.ok(atLeast(2,0,40),'Rejected installer repair authority introduced in 2.0.40 must remain enforced for every later candidate.');

// Screenshot #1: duplicated mic/video controls are a release blocker.
assert.ok(app.includes('participant-media-state')&&app.includes('data-participant-mic')&&app.includes('data-participant-video'),'Canonical participant media state must remain present.');
assert.ok(physical.includes('ds-participant-media'),'Legacy decorator must be explicitly accounted for by the repair.');
assert.ok(repair.includes('#participantRoster .ds-participant-media{display:none!important}'),'Legacy duplicate participant media renderer must be physically non-rendering.');
assert.ok(repair.includes('grid-template-columns:34px minmax(0,1fr) auto auto'),'Participant row must keep one Zoom-like avatar/name/media/actions geometry.');
assert.ok(repair.includes('[data-participant-self="1"] .person-copy small{display:none!important}'),'Self row must not repeat a redundant You role line.');

// Screenshots #3/#4: Apple system picker must never replace the approved chooser.
assert.ok(service.includes('const nativeSystemPicker=false'),'macOS native system picker must be disabled in the active share path.');
assert.ok(service.includes('configureDisplayMediaHandler(false);'),'Custom display-media handler must be active before capture.');
assert.ok(service.includes("ipcMain.handle('share:list-sources',async(_event,options={})=>{configureDisplayMediaHandler(false);pendingSelection=null;"),'Opening source list must force the approved custom handler and clear stale selection.');
assert.ok(service.includes("ipcMain.handle('share:select-source',(_event,{sourceId,options={}}={})=>{configureDisplayMediaHandler(false);"),'Selecting a source must force the approved custom handler before getDisplayMedia.');
assert.ok(!service.includes("if(nativeSystemPicker&&status!=='granted')"),'No permission state may fall back into the rejected Apple picker.');

// Screenshot #4: selected share may not load forever.
assert.ok(controller.includes('let displayRequestGeneration=0'),'Share acquisition must be cancellable.');
assert.ok(controller.includes("error.code='share_start_timeout'"),'Share acquisition must expose a timeout failure instead of infinite loading.');
assert.ok(controller.includes('},5000);'),'Share start must be bounded to five seconds.');
assert.ok(controller.includes('void capturePromise.then(lateStream=>stopTracks(lateStream)).catch(()=>{})'),'A late capture completion after timeout must be stopped and discarded.');

// Approved pre-share surface must be loaded after the legacy physical style.
assert.ok(auth.indexOf('zoom-physical-acceptance.css')>=0&&auth.indexOf('rejected-build-repair-2.0.40.css')>auth.indexOf('zoom-physical-acceptance.css'),'2.0.40 rejection repair stylesheet must load after the prior physical layer.');
assert.ok(repair.includes("content:'Share Screen'"),'Approved chooser must have a clear Share Screen title.');
assert.ok(repair.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'Approved chooser must present large visual source thumbnails.');
assert.ok(repair.includes('.ds-share-picker-card>footer>button.primary'),'Approved chooser must keep one primary Share action.');

console.log('DOMINIONSTAR_REJECTED_INSTALLER_REPAIR_2_0_40_OK carried-forward-on='+pkg.version+' one-participant-media-set custom-only-preshare no-apple-overlay bounded-five-second-share-start zoom-like-source-grid');
