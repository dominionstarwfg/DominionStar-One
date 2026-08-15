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
  ipcRenderer:{
    send(){},
    invoke(channel){
      if(channel==='desktop:runtime-info'){
        return Promise.resolve({
          bridgeVersion:12,
          version:packageJson.version,
          appVersion:packageJson.version,
          buildVersion:packageJson.version,
          electronVersion:'43.3.0',
          platform:'darwin'
        });
      }
      return Promise.resolve();
    },
    on(){},
    removeListener(){}
  }
};
const context={
  require:name=>{assert.equal(name,'electron');return electron;},
  process:{platform:'darwin',versions:{electron:'43.3.0'}},
  Object,Promise,String,Boolean,Number
};
vm.runInNewContext(preload,context,{filename:'preload.cjs'});

assert.ok(exposed?.isDesktop,'Desktop bridge was not exposed');
assert.equal(exposed.version,'43.3.0','version must preserve the hosted runtime-version contract');
assert.equal(exposed.appVersion,packageJson.version,'appVersion must match package version');
assert.equal(exposed.buildVersion,packageJson.version,'buildVersion must match package version');
assert.equal(exposed.electronVersion,'43.3.0','electronVersion must identify the Electron runtime');
assert.equal(exposed.bridgeVersion,12,'Certified native bridge version must be 12');
assert.ok(Object.isFrozen(exposed),'Exposed desktop contract must be immutable');

const runtime=await exposed.getRuntimeInfo();
assert.equal(runtime.version,'43.3.0','runtime-info version must also preserve Electron/runtime semantics');
assert.equal(runtime.electronVersion,'43.3.0','runtime-info electronVersion must identify Electron');
assert.equal(runtime.appVersion,packageJson.version,'runtime-info appVersion must match package version');
assert.equal(runtime.buildVersion,packageJson.version,'runtime-info buildVersion must match package version');
assert.equal(runtime.bridgeVersion,12,'runtime-info bridgeVersion must remain certified');
assert.ok(Object.isFrozen(runtime),'Normalized runtime-info must be immutable');

const certified=exposed.isDesktop
  && exposed.version===exposed.electronVersion
  && exposed.appVersion===packageJson.version
  && exposed.buildVersion===packageJson.version
  && runtime.version===runtime.electronVersion
  && runtime.appVersion===packageJson.version
  && runtime.buildVersion===packageJson.version
  && runtime.bridgeVersion>=12;
assert.ok(certified,'Hosted desktop certification compatibility failed');
console.log('DominionStar desktop bridge certification test passed.');
