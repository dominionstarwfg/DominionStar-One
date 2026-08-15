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
assert.equal(exposed.version,packageJson.version,'version must identify the DominionStar desktop release');
assert.equal(exposed.appVersion,packageJson.version,'appVersion must match package version');
assert.equal(exposed.buildVersion,packageJson.version,'buildVersion must match package version');
assert.equal(exposed.electronVersion,'43.3.0','electronVersion must identify the Electron runtime separately');
assert.equal(exposed.bridgeVersion,12,'Certified native bridge version must be 12');
assert.ok(Object.isFrozen(exposed),'Exposed desktop contract must be immutable');

const runtime=await exposed.getRuntimeInfo();
assert.equal(runtime.version,packageJson.version,'runtime-info version must identify the DominionStar desktop release');
assert.equal(runtime.appVersion,packageJson.version,'runtime-info appVersion must match package version');
assert.equal(runtime.buildVersion,packageJson.version,'runtime-info buildVersion must match package version');
assert.equal(runtime.electronVersion,'43.3.0','runtime-info electronVersion must identify Electron separately');
assert.equal(runtime.bridgeVersion,12,'runtime-info bridgeVersion must remain certified');
assert.ok(Object.isFrozen(runtime),'Normalized runtime-info must be immutable');

const certified=exposed.isDesktop
  && exposed.version===packageJson.version
  && exposed.appVersion===packageJson.version
  && exposed.buildVersion===packageJson.version
  && runtime.version===packageJson.version
  && runtime.appVersion===packageJson.version
  && runtime.buildVersion===packageJson.version
  && runtime.bridgeVersion>=12;
assert.ok(certified,'Hosted desktop certification compatibility failed');
console.log('DominionStar desktop bridge certification test passed.');
