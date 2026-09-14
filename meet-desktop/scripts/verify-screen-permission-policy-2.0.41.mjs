import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src/main.mjs'),'utf8');
const shareService=fs.readFileSync(path.join(root,'src/share-service.mjs'),'utf8');

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

if(failures.length){
  console.error('SCREEN_PERMISSION_POLICY_2_0_41_FAILED');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log('SCREEN_PERMISSION_POLICY_2_0_41_OK passive-tcc-check no-preflight-capture-enumeration granted-bypasses-recovery');
