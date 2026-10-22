// Stable release identity for Electron builds. app.getName() can be different
// from the macOS bundle's display name early during startup.
import fs from 'node:fs';
import path from 'node:path';
export const QA_BUNDLE_ID='com.dominionstar.desktop.qa';
export const QA_APP_BASENAME='DominionStar Meet QA.app';
export function isIsolatedQaBuild({executablePath='',appPath=''}={}){
  // Prefer the immutable package identity when present in app.asar.
  try{
    const pkg=JSON.parse(fs.readFileSync(path.join(String(appPath||''),'package.json'),'utf8'));
    if(typeof pkg?.build?.appId==='string')return pkg.build.appId===QA_BUNDLE_ID;
  }catch{}
  // electron-builder may strip build config from the packaged package.json.
  // On macOS, the executable path reliably includes the .app bundle name.
  const executable=String(executablePath||'').replaceAll('\\','/');
  return /(?:^|\/)DominionStar Meet QA\.app\/Contents\/MacOS\/[^/]+$/.test(executable)
      || /(?:^|\/)DominionStar Meet QA\.exe$/i.test(executable);
}
