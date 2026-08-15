import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packagePath=path.join(root,'package.json');
const lockPath=path.join(root,'package-lock.json');
const packageJson=JSON.parse(fs.readFileSync(packagePath,'utf8'));
const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));

const expected=String(packageJson.version||'');
if(!/^\d+\.\d+\.\d+$/.test(expected))throw new Error(`Invalid package version: ${expected}`);
if(!lock.packages?.[''])throw new Error('package-lock.json is missing the root package record');

const before={top:lock.version,root:lock.packages[''].version};
lock.version=expected;
lock.packages[''].version=expected;

if(before.top!==expected||before.root!==expected){
  fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');
  console.log(`Normalized package-lock release metadata ${before.top}/${before.root} -> ${expected}/${expected}.`);
}else{
  console.log(`Package-lock release metadata already matches ${expected}.`);
}
