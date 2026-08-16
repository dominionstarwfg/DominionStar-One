import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const preload=fs.readFileSync(path.join(root,'src/preload.cjs'),'utf8');
const exposed={};
const electron={
  contextBridge:{exposeInMainWorld:(name,value)=>{exposed[name]=value;}},
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
const windowMock={
  addEventListener(_name, callback){ callback(); },
  dispatchEvent(){}
};
class CustomEventMock {
  constructor(type, options={}){this.type=type;this.detail=options.detail;}
}
const context={
  require:name=>{assert.equal(name,'electron');return electron;},
  process:{platform:'darwin',versions:{electron:'43.3.0'}},
  window:windowMock,
  CustomEvent:CustomEventMock,
  Object,Promise,String,Boolean,Number
};
vm.runInNewContext(preload,context,{filename:'preload.cjs'});

const desktop=exposed.dominionDesktop;
const guardian=exposed.DominionGuardianCertification;
assert.ok(desktop?.isDesktop,'Desktop bridge was not exposed');
assert.equal(desktop.version,packageJson.version,'version must identify the DominionStar desktop release');
assert.equal(desktop.appVersion,packageJson.version,'appVersion must match package version');
assert.equal(desktop.buildVersion,packageJson.version,'buildVersion must match package version');
assert.equal(desktop.electronVersion,'43.3.0','electronVersion must identify the Electron runtime separately');
assert.equal(desktop.bridgeVersion,12,'Certified native bridge version must be 12');
assert.ok(Object.isFrozen(desktop),'Exposed desktop contract must be immutable');

assert.ok(guardian,'Native Guardian certification was not exposed');
assert.equal(guardian.mode,'native-authoritative');
assert.equal(guardian.version,packageJson.version);
assert.equal(guardian.certified,true);
assert.equal(guardian.blocking,false);
assert.equal(guardian.blocked,false);
assert.equal(guardian.bridgeVersion,12);
assert.ok(Object.isFrozen(guardian),'Native Guardian certification must be immutable');

const runtime=await desktop.getRuntimeInfo();
assert.equal(runtime.version,packageJson.version,'runtime-info version must identify the DominionStar desktop release');
assert.equal(runtime.appVersion,packageJson.version,'runtime-info appVersion must match package version');
assert.equal(runtime.buildVersion,packageJson.version,'runtime-info buildVersion must match package version');
assert.equal(runtime.electronVersion,'43.3.0','runtime-info electronVersion must identify Electron separately');
assert.equal(runtime.bridgeVersion,12,'runtime-info bridgeVersion must remain certified');
assert.ok(Object.isFrozen(runtime),'Normalized runtime-info must be immutable');

const certified=desktop.isDesktop
  && desktop.version===packageJson.version
  && desktop.appVersion===packageJson.version
  && desktop.buildVersion===packageJson.version
  && guardian.certified===true
  && guardian.blocking===false
  && runtime.version===packageJson.version
  && runtime.appVersion===packageJson.version
  && runtime.buildVersion===packageJson.version
  && runtime.bridgeVersion>=12;
assert.ok(certified,'Hosted desktop certification compatibility failed');
console.log('DominionStar desktop bridge + native Guardian certification test passed.');
