import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const preload=fs.readFileSync(path.join(root,'src/preload.cjs'),'utf8');
let exposed;
const electron={
  contextBridge:{exposeInMainWorld:(name,value)=>{assert.equal(name,'dominionDesktop');exposed=value;}},
  ipcRenderer:{send(){},invoke(){return Promise.resolve();},on(){},removeListener(){}}
};
const context={
  require:name=>{assert.equal(name,'electron');return electron;},
  process:{platform:'darwin',versions:{electron:'43.3.0'}},
  Object,Promise,String,Boolean
};
vm.runInNewContext(preload,context,{filename:'preload.cjs'});

assert.ok(exposed?.isDesktop,'Desktop bridge was not exposed');
assert.equal(exposed.version,packageJson.version,'version must identify the DominionStar app');
assert.equal(exposed.appVersion,packageJson.version,'appVersion must match package version');
assert.equal(exposed.buildVersion,packageJson.version,'buildVersion must match package version');
assert.equal(exposed.electronVersion,'43.3.0','Electron runtime must remain a separate field');
assert.equal(exposed.bridgeVersion,12,'Certified native bridge version must be 12');
assert.ok(Object.isFrozen(exposed),'Exposed desktop contract must be immutable');

const certified=exposed.isDesktop
  && exposed.version===packageJson.version
  && exposed.appVersion===packageJson.version
  && exposed.buildVersion===packageJson.version
  && exposed.bridgeVersion>=12;
assert.ok(certified,'Hosted desktop certification compatibility failed');
console.log('DominionStar desktop bridge certification test passed.');
