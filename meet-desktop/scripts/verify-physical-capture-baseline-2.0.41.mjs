import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap=fs.readFileSync(new URL('../src/bootstrap.mjs',import.meta.url),'utf8');
const share=fs.readFileSync(new URL('../src/share-service.mjs',import.meta.url),'utf8');

const must=(text,needle,message)=>assert.ok(text.includes(needle),message);

must(bootstrap,'Physical-Mac capture baseline guard.','Physical capture baseline guard is missing.');
must(bootstrap,"ipcMain.on('share:capture-started',()=>{physicalShareActive=true;});",'Capture-start authority must arm the physical share guard.');
must(bootstrap,"ipcMain.on('mac-share:capture-stopped',()=>{physicalShareActive=false;});",'Capture-stop authority must clear the physical share guard.');
must(bootstrap,'sharePickerVisible()','Pre-capture guard must detect the approved Share Screen chooser.');
must(bootstrap,'Number(value)<0.99','Capture-owning meeting window must not be faded during pre-capture/active share.');
must(bootstrap,'Boolean(ignore)','Capture-owning meeting window must not become click-through during pre-capture/active share.');
must(bootstrap,'sharePickerVisible()&&flag===false','Pre-capture source commit must not force the meeting out of full screen.');
must(bootstrap,'sharePickerVisible()&&Boolean(flag)','Pre-capture source commit must not force always-on-top geometry changes.');

// Keep the later functional fixes while guarding the proven start path.
must(share,'const directPromise=webContents.executeJavaScript','Acknowledged presenter-command transport must remain present.');
must(share,"new Promise(resolve=>setTimeout(()=>resolve({handled:false,reason:'direct-timeout'}),700))",'Presenter direct command timeout must remain bounded.');
must(share,'captureStartWatchdog=setTimeout','Capture start must retain bounded failure recovery.');
must(share,'protectMeetingChrome(main,true)','DominionStar meeting chrome must retain capture protection.');

console.log('DOMINIONSTAR_PHYSICAL_CAPTURE_BASELINE_2_0_41_OK proven-window-state content-protection presenter-transport bounded-start');
