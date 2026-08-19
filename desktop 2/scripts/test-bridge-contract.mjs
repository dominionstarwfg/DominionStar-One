import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const preload=fs.readFileSync(path.join(root,'src/preload.cjs'),'utf8');
const exposed={};
const sent=[];
const invoked=[];
const electron={
  contextBridge:{exposeInMainWorld:(name,value)=>{exposed[name]=value;}},
  ipcRenderer:{
    send(channel,...args){sent.push([channel,...args]);},
    invoke(channel,...args){
      invoked.push([channel,...args]);
      if(channel==='desktop:media-permissions') return Promise.resolve({ok:true,platform:'darwin',camera:'not-determined',microphone:'granted'});
      if(channel==='desktop:screen-permission-status') return Promise.resolve({ok:true,platform:'darwin',screen:'granted',requiresRestart:false});
      if(channel==='desktop:relaunch-for-permissions') return Promise.resolve(true);
      if(channel==='desktop:request-media-permissions'){
        assert.deepEqual(Array.from(args[0]||[]),['camera']);
        return Promise.resolve({ok:true,platform:'darwin',camera:'granted',microphone:'granted'});
      }
      if(channel==='desktop:remote-control-prompt') return Promise.resolve({accepted:true});
      if(channel==='desktop:remote-control-error') return Promise.resolve(true);
      if(channel==='desktop:runtime-info'){
        return Promise.resolve({
          bridgeVersion:13,
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
  location:{origin:'https://dominionstarld.com'},
  addEventListener(_name, callback){ callback(); },
  dispatchEvent(){}
};
class CustomEventMock {
  constructor(type, options={}){this.type=type;this.detail=options.detail;}
}
const fetchMock=async (url,options={})=>{
  assert.equal(url,'https://dominionstarld.com/meet/release-contract.json');
  assert.equal(options.cache,'no-store');
  assert.equal(options.credentials,'same-origin');
  assert.equal(options.redirect,'error');
  return {
    ok:true,
    async json(){return {releaseId:'live-compatible-release',desktopBridge:13};}
  };
};
const context={
  require:name=>{assert.equal(name,'electron');return electron;},
  process:{platform:'darwin',versions:{electron:'43.3.0'}},
  window:windowMock,
  CustomEvent:CustomEventMock,
  fetch:fetchMock,
  URL,
  Set,
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
assert.equal(desktop.bridgeVersion,13,'Certified native bridge version must remain 13 for this additive QA repair');
assert.ok(Object.isFrozen(desktop),'Exposed desktop contract must be immutable');
assert.equal(typeof desktop.getMediaPermissions,'function','Native media permission status API must be exposed');
assert.equal(typeof desktop.requestMediaPermissions,'function','Native media permission request API must be exposed');
assert.equal(typeof desktop.getScreenPermissionStatus,'function','Native screen permission status API must be exposed');
assert.equal(typeof desktop.relaunchForPermissions,'function','Native permission relaunch API must be exposed');
assert.equal(typeof desktop.updatePresenterDock,'function','Native presenter participant dock update API must be exposed');
assert.equal(typeof desktop.showRemoteControlPrompt,'function','Native remote-control approval prompt must be exposed');
assert.equal(typeof desktop.onRemoteControlDecision,'function','Remote-control approval decision subscription must be exposed');
assert.equal(typeof desktop.showRemoteControlError,'function','Native remote-control error dialog must be exposed');
const permissionStatus=await desktop.getMediaPermissions();
assert.equal(permissionStatus.camera,'not-determined');
const permissionRequest=await desktop.requestMediaPermissions(['camera']);
assert.equal(permissionRequest.camera,'granted');
const screenPermission=await desktop.getScreenPermissionStatus();
assert.equal(screenPermission.screen,'granted','Screen permission must be independently queryable from macOS');
assert.equal(await desktop.relaunchForPermissions(),true,'Permission relaunch request must reach the native shell');
assert.ok(invoked.some(([channel])=>channel==='desktop:screen-permission-status'),'Screen permission status must use dedicated native IPC');
assert.ok(invoked.some(([channel])=>channel==='desktop:relaunch-for-permissions'),'Permission relaunch must use dedicated native IPC');
desktop.updatePresenterDock({tiles:[{id:'p1',name:'Participant'}]});
assert.equal(sent.at(-1)?.[0],'desktop:presenter-dock-update','Presenter dock updates must use the dedicated native IPC channel');
assert.equal(sent.at(-1)?.[1]?.tiles?.[0]?.id,'p1','Presenter dock payload must be forwarded to the native shell');
let remoteDecision=null;
const offDecision=desktop.onRemoteControlDecision(value=>{remoteDecision=value;});
const promptResult=await desktop.showRemoteControlPrompt({displayName:'Test Presenter',requestId:'req-1'});
assert.equal(promptResult.accepted,true,'Remote-control prompt result must return to the renderer');
assert.equal(remoteDecision,true,'Remote-control decision listener must receive native approval');
offDecision();
await desktop.showRemoteControlError('Accessibility permission required');
assert.ok(invoked.some(([channel])=>channel==='desktop:remote-control-prompt'),'Remote-control approval must use native IPC');
assert.ok(invoked.some(([channel])=>channel==='desktop:remote-control-error'),'Remote-control error feedback must use native IPC');

assert.ok(guardian,'Native Guardian certification was not exposed');
assert.equal(guardian.mode,'native-authoritative');
assert.equal(guardian.version,packageJson.version);
assert.equal(guardian.certified,true);
assert.equal(guardian.blocking,false);
assert.equal(guardian.blocked,false);
assert.equal(guardian.bridgeVersion,13);
assert.ok(Object.isFrozen(guardian),'Native Guardian certification must be immutable');

const runtime=await desktop.getRuntimeInfo();
assert.equal(runtime.version,packageJson.version,'runtime-info version must identify the DominionStar desktop release');
assert.equal(runtime.appVersion,packageJson.version,'runtime-info appVersion must match package version');
assert.equal(runtime.buildVersion,packageJson.version,'runtime-info buildVersion must match package version');
assert.equal(runtime.electronVersion,'43.3.0','runtime-info electronVersion must identify Electron separately');
assert.equal(runtime.bridgeVersion,13,'runtime-info bridgeVersion must remain certified');
assert.equal(runtime.meetReleaseId,'live-compatible-release','runtime-info must satisfy the current hosted Meet release ID when bridge-compatible');
assert.equal(runtime.meetReleaseCompatible,true,'runtime-info must report hosted release compatibility');
assert.equal(runtime.requiredDesktopBridge,13,'runtime-info must expose the live minimum bridge for diagnosis');
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
  && runtime.meetReleaseId==='live-compatible-release'
  && runtime.meetReleaseCompatible===true
  && runtime.bridgeVersion>=runtime.requiredDesktopBridge;
assert.ok(certified,'Hosted desktop certification compatibility failed');
console.log('DominionStar desktop bridge + live release compatibility test passed.');
