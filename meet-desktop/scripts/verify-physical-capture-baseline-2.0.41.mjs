import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap=fs.readFileSync(new URL('../src/bootstrap.mjs',import.meta.url),'utf8');
const share=fs.readFileSync(new URL('../src/share-service.mjs',import.meta.url),'utf8');

const must=(text,needle,message)=>assert.ok(text.includes(needle),message);

must(bootstrap,'Physical-Mac capture baseline guard.','Physical capture baseline guard is missing.');
must(bootstrap,"ipcMain.on('share:capture-started',()=>{",'Capture-start authority must arm the physical share guard.');
must(bootstrap,'physicalShareActive=true;','Capture-start authority must mark physical sharing active.');
must(bootstrap,'physicalShareStartupUntil=Date.now()+PHYSICAL_SHARE_STARTUP_MS;','Capture-start authority must retain the bounded startup stabilization window.');
must(bootstrap,"ipcMain.on('mac-share:capture-stopped',()=>{",'Capture-stop authority must clear the physical share guard.');
must(bootstrap,'physicalShareActive=false;physicalShareStartupUntil=0;','Capture-stop authority must clear active/startup guard state.');
must(bootstrap,'sharePickerVisible()','Pre-capture guard must detect the approved Share Screen chooser.');
must(bootstrap,'Number(value)<0.99','Capture-owning meeting window must not be faded during pre-capture/active share startup.');
must(bootstrap,'Boolean(ignore)','Capture-owning meeting window must not become click-through during pre-capture/active share startup.');
must(bootstrap,'sharePickerVisible()&&flag===false','Pre-capture source commit must not force the meeting out of full screen.');
must(bootstrap,'sharePickerVisible()&&Boolean(flag)','Pre-capture source commit must not force always-on-top geometry changes.');
must(bootstrap,'originalSetOpacity.call(main,0.02)','After the startup guard, the meeting must park at near-zero opacity without hiding the capture-owning renderer.');

// Keep the later functional fixes while guarding the proven start path.
must(share,'const directPromise=webContents.executeJavaScript','Acknowledged presenter-command transport must remain present.');
must(share,"new Promise(resolve=>setTimeout(()=>resolve({handled:false,reason:'direct-timeout'}),700))",'Presenter direct command timeout must remain bounded.');
must(share,'captureStartWatchdog=setTimeout','Capture start must retain bounded failure recovery.');
must(share,'protectMeetingChrome(main,true)','DominionStar meeting chrome must retain capture protection.');

console.log('DOMINIONSTAR_PHYSICAL_CAPTURE_BASELINE_2_0_41_OK proven-window-state bounded-startup-guard content-protection presenter-transport bounded-start');