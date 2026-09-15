import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src/main.mjs'),'utf8');
const shareService=fs.readFileSync(path.join(root,'src/share-service.mjs'),'utf8');
const relaunchService=fs.readFileSync(path.join(root,'src/relaunch-service.mjs'),'utf8');

const failures=[];

const permissionMatch=main.match(/async function requestScreenPermission\(\)\{([\s\S]*?)\n\}/);
if(!permissionMatch)failures.push('requestScreenPermission() is missing');
else{
  const body=permissionMatch[1];
  if(/desktopCapturer\.getSources/.test(body))failures.push('requestScreenPermission must not enumerate capture sources');
  if(/activeScreenCaptureProbe/.test(body))failures.push('requestScreenPermission must not run an active capture probe');
  if(!/permissionStatus\('screen'\)/.test(body))failures.push('requestScreenPermission must inspect macOS TCC screen status');
  if(!/reportedStatus==='granted'/.test(body))failures.push('granted TCC state must bypass permission recovery');
  if(!/detectedBy:'tcc-status'/.test(body))failures.push('permission decision must be attributable to TCC status');
}

if(/function activeScreenCaptureProbe/.test(main))failures.push('activeScreenCaptureProbe must remain removed from main process');
if(/screenPermissionProbeInFlight/.test(main))failures.push('screen permission probe state must remain removed');

const openPickerMatch=shareService.match(/ipcMain\.handle\('share:open-picker',[\s\S]*?return openPicker\(\);\n\s*\}\);/);
if(!openPickerMatch)failures.push('share:open-picker permission gate is missing');
else{
  const body=openPickerMatch[0];
  const permissionIndex=body.indexOf('ensureScreenPermission');
  const pickerIndex=body.lastIndexOf('return openPicker()');
  if(permissionIndex<0||pickerIndex<0||permissionIndex>pickerIndex)failures.push('permission state must be checked before opening the source picker');
  if(!/permissionRequired:true/.test(body))failures.push('non-granted screen permission must block source enumeration');
}

// Physical regression guard: source enumeration itself must never be allowed to
// trigger the macOS Screen Recording prompt. The main-process desktopCapturer
// boundary must reject all enumeration until this exact app identity reports a
// granted TCC state.
if(!/desktopCapturer/.test(relaunchService)||!/systemPreferences/.test(relaunchService))failures.push('main-process TCC enumeration guard imports are missing');
if(!/getMediaAccessStatus\('screen'\)/.test(relaunchService))failures.push('enumeration guard must read macOS Screen Recording TCC state');
if(!/status!==['"]granted['"]/.test(relaunchService))failures.push('enumeration guard must reject every non-granted TCC state');
if(!/SCREEN_RECORDING_PERMISSION_REQUIRED/.test(relaunchService))failures.push('enumeration guard must expose a deterministic permission-required error');
const guardIndex=relaunchService.indexOf("getMediaAccessStatus('screen')");
const originalIndex=relaunchService.indexOf('return originalGetSources(options)');
if(guardIndex<0||originalIndex<0||guardIndex>originalIndex)failures.push('TCC status must be checked before real desktop source enumeration');

// Stable-signing guard: the app must report the identity macOS actually sees,
// rather than permanently claiming every build is ad-hoc. Physical QA can then
// distinguish a stable Apple Development/Developer ID build from disposable CI.
if(!relaunchService.includes("execFileAsync('/usr/bin/codesign',['-dvvv',signatureTarget()])"))failures.push('privacy identity must inspect the packaged app with codesign');
if(!relaunchService.includes("details.match(/^TeamIdentifier=(.+)$/m)"))failures.push('privacy identity must read the codesign TeamIdentifier');
if(!relaunchService.includes("/Signature=adhoc/i.test(details)"))failures.push('privacy identity must detect ad-hoc signatures explicitly');
if(!relaunchService.includes("signingMode:stable?'stable-apple':'adhoc'"))failures.push('privacy identity must distinguish stable Apple signing from ad-hoc signing');
if(!relaunchService.includes('stableAcrossRebuilds:stable'))failures.push('stable Apple signing must be reported as persistent across rebuilds');
if(!relaunchService.includes("screenPermissionPersistence:stable?'stable-code-identity':'not-certified'"))failures.push('screen permission persistence must follow the detected signing identity');

if(failures.length){
  console.error('SCREEN_PERMISSION_POLICY_2_0_41_FAILED');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log('SCREEN_PERMISSION_POLICY_2_0_41_OK passive-tcc-check no-preflight-capture-enumeration granted-bypasses-recovery hard-main-process-enumeration-guard runtime-codesign-team-identity');
