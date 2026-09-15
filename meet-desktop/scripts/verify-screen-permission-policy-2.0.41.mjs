import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src/main.mjs'),'utf8');
const shareService=fs.readFileSync(path.join(root,'src/share-service.mjs'),'utf8');
const relaunchService=fs.readFileSync(path.join(root,'src/relaunch-service.mjs'),'utf8');
const executableOnly=source=>String(source||'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
const relaunchExecutable=executableOnly(relaunchService);

const failures=[];

const permissionMatch=main.match(/async function requestScreenPermission\(\)\{([\s\S]*?)\n\}/);
if(!permissionMatch)failures.push('requestScreenPermission() is missing');
else{
  const body=permissionMatch[1];
  if(/desktopCapturer\.getSources/.test(body))failures.push('requestScreenPermission itself must not enumerate capture sources');
  if(/activeScreenCaptureProbe/.test(body))failures.push('requestScreenPermission must not run a hidden capture probe');
  if(!/permissionStatus\('screen'\)/.test(body))failures.push('requestScreenPermission must retain macOS TCC status as advisory telemetry');
  if(!/ok:true/.test(body))failures.push('stale TCC status must not hard-block an explicit Share action');
  if(!/tcc-advisory/.test(body))failures.push('non-granted TCC state must be labeled advisory rather than authoritative');
  if(!/real desktop[\s\S]*source enumeration is the authoritative test/.test(body))failures.push('permission policy must document real source enumeration as authority');
}

if(/function activeScreenCaptureProbe/.test(main))failures.push('activeScreenCaptureProbe must remain removed from main process');
if(/screenPermissionProbeInFlight/.test(main))failures.push('screen permission probe state must remain removed');

const openPickerMatch=shareService.match(/ipcMain\.handle\('share:open-picker',[\s\S]*?return openPicker\(\);\n\s*\}\);/);
if(!openPickerMatch)failures.push('share:open-picker permission compatibility path is missing');
else{
  const body=openPickerMatch[0];
  if(!body.includes('ensureScreenPermission'))failures.push('share:open-picker must retain permission telemetry/recovery compatibility');
  if(!body.includes('return openPicker()'))failures.push('explicit Share must still proceed into the approved picker');
}

// Physical regression guard: never monkey-patch desktop source enumeration
// behind a potentially stale Screen Recording status result. Comments are
// deliberately stripped so explanatory text cannot create a false positive.
if(/\bdesktopCapturer\b/.test(relaunchExecutable))failures.push('relaunch service must not intercept desktop source enumeration');
if(/\bsystemPreferences\b/.test(relaunchExecutable)||/getMediaAccessStatus\s*\(\s*['"]screen['"]\s*\)/.test(relaunchExecutable))failures.push('relaunch service must not hard-gate enumeration on Screen Recording status');
if(/SCREEN_RECORDING_PERMISSION_REQUIRED/.test(relaunchExecutable))failures.push('main-process stale-TCC enumeration rejection must remain removed');
if(!/real desktop source enumeration is\n\/\/ the authority/.test(relaunchService))failures.push('real-source authority rationale must remain explicit');

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

console.log('SCREEN_PERMISSION_POLICY_2_0_41_OK tcc-advisory explicit-share-real-source-authority no-hidden-preflight no-stale-tcc-hard-gate runtime-codesign-team-identity');
