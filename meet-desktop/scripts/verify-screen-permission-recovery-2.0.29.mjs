import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const main=read('src/main.mjs');
const relaunch=read('src/relaunch-service.mjs');
const shareUi=read('ui/share-integration.js');
const shareService=read('src/share-service.mjs');
const pkg=JSON.parse(read('package.json'));

const has=(source,needle,message)=>assert.ok(source.includes(needle),message);
const lacks=(source,needle,message)=>assert.ok(!source.includes(needle),message);

assert.equal(pkg.version,'2.0.29','2.0.29 permission recovery must carry the correct packaged version.');

// macOS TCC denial means the user still needs to grant access. It is not a
// restart condition. Restart is reserved for granted-but-current-process-stale.
has(main,"return {ok:false,status:reportedStatus,restartRequired:false,detectedBy:'tcc-status+capture-probe'",'Denied/restricted screen access must return to authorization instead of forcing Restart App.');
lacks(main,"restartRequired:reportedStatus!=='not-determined'",'Legacy denial-to-restart routing must not return.');
has(main,"if(reportedStatus==='granted')return {ok:true,status:'granted'",'Granted TCC status must remain authoritative.');
has(main,'const probe=await activeScreenCaptureProbe()','Bounded capture probing must remain available when TCC status lags.');

// An ad-hoc rebuild may receive a new TCC identity while renderer localStorage
// survives. Capture proof is therefore renderer-session scoped only.
has(shareUi,"try{localStorage.removeItem(SCREEN_CAPTURE_PROVEN_KEY);}catch{}",'Legacy persisted screen-capture proof must be cleared on renderer boot.');
has(shareUi,"sessionStorage.setItem(SCREEN_CAPTURE_PROVEN_KEY,'1')",'Successful capture proof must be scoped to sessionStorage.');
has(shareUi,"sessionStorage.getItem(SCREEN_CAPTURE_PROVEN_KEY)==='1'",'Permission fast path must read only the current renderer-session proof.');
lacks(shareUi,"localStorage.setItem(SCREEN_CAPTURE_PROVEN_KEY,'1')",'Screen-capture proof must not persist across app launches/rebuilds.');
lacks(shareUi,"localStorage.getItem(SCREEN_CAPTURE_PROVEN_KEY)==='1'",'Permission checks must not trust cross-build localStorage proof.');

// Permission UI must keep the two recovery states distinct.
has(shareUi,"if(status==='denied'||status==='restricted')copy.textContent='In Privacy & Security → Screen & System Audio Recording, enable DominionStar Meet. Return here when it is enabled.'",'Denied/restricted permission must direct the user to Privacy & Security.');
has(shareUi,"showScreenPermissionDialog(status,status==='granted'||Boolean(diagnostic?.restartRequired))",'Granted-but-failed capture must still expose the restart recovery path.');
has(shareUi,"await desktop?.app?.relaunch?.()",'Restart App must use the desktop relaunch authority.');

// Preserve the certified 2.0.28 exact-build relaunch and canonical source path.
has(relaunch,'const execPath=process.execPath','Relaunch must target the exact executable currently running.');
has(relaunch,'app.relaunch({execPath,args})','Relaunch must not delegate to another installed copy.');
has(relaunch,"signingMode:'adhoc'",'Prototype signing identity must remain truthfully reported as ad-hoc.');
has(relaunch,"screenPermissionPersistence:'not-certified'",'Ad-hoc Screen Recording persistence must not be falsely certified.');

// Keep macOS 15+ native picker authority and custom source picker behavior intact.
has(shareService,"const nativeSystemPicker=platform==='darwin'&&macMajor>=15",'macOS 15+ native system picker authority must remain intact.');
has(shareService,"configureDisplayMediaHandler(true);return {opened:false,nativeSystemPicker:true,status:'system-picker'}",'Unproven macOS 15+ permission must still enter the system picker path.');
has(shareService,"configureDisplayMediaHandler(false)",'Certified DominionStar custom source picker path must remain available after permission is proven.');

console.log('DOMINIONSTAR_SCREEN_PERMISSION_2_0_29_OK denial-settings-route session-scoped-capture-proof legacy-proof-cleared granted-stale-restart exact-executable-relaunch native-picker-preserved adhoc-persistence-not-certified');
