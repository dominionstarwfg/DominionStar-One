import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('legacy Workspace routes hand off to authoritative Agent OS destinations',()=>{
  const expected={
    'workspace/index.html':'/member-dashboard/',
    'workspace/chat/index.html':'/direct-messages/',
    'workspace/calendar/index.html':'/appointments/',
    'workspace/contacts/index.html':'/member-directory/',
    'workspace/aurora/index.html':'/member-dashboard/?open=aurora'
  };
  for(const [path,target] of Object.entries(expected)){
    const source=read(path);
    assert.ok(source.includes(target),path+' missing authoritative target');
    assert.match(source,/location\.replace/);
  }
});

test('Drive and Tasks no longer present non-persistent prototype actions as real features',()=>{
  const drive=read('workspace/drive/index.html');
  const tasks=read('workspace/tasks/index.html');
  for(const source of [drive,tasks]){
    assert.match(source,/dominionstar-auth-os-v2\.css/);
    assert.match(source,/agent-tool-gate\.js/);
    assert.match(source,/dominionstar-agent-nav-shell\.js/);
    assert.match(source,/Not enabled yet/);
    assert.doesNotMatch(source,/workspace\/module-shell\.js/);
  }
  assert.match(drive,/did not persist folders or uploaded files/);
  assert.match(tasks,/browser-only task rows/);
});

test('retired prototype scripts are not loaded by active Workspace entry routes',()=>{
  for(const path of [
    'workspace/index.html','workspace/chat/index.html','workspace/calendar/index.html',
    'workspace/contacts/index.html','workspace/aurora/index.html',
    'workspace/drive/index.html','workspace/tasks/index.html'
  ]){
    const source=read(path);
    assert.doesNotMatch(source,/workspace\/workspace\.js|workspace\/chat\/chat\.js|workspace\/drive\/drive\.js|workspace\/module-shell\.js/);
  }
});

test('dashboard search keeps Training inside Agent OS and legacy Aurora link opens real panel',()=>{
  const os=read('assets/js/dominionstar-os.js');
  assert.match(os,/\['Training','\/agent-learning\/#training'/);
  assert.match(os,/launchParams\.get\('open'\)==='aurora'/);
  assert.match(os,/showPanel\(aiPanel,null\)/);
});

test('shared authenticated shell recognizes Drive and Tasks status pages',()=>{
  const shell=read('assets/js/dominionstar-agent-nav-shell.js');
  assert.match(shell,/#agentDriveApp/);
  assert.match(shell,/#agentTasksApp/);
  assert.ok(shell.includes("'/workspace/drive':'Drive'"));
  assert.ok(shell.includes("'/workspace/tasks':'Tasks'"));
});
