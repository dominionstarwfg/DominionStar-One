// Canonical navigation guard: Agent Dashboard -> Workspace -> Meet.
// Removing the redundant Agent Dashboard shortcut must not delete Workspace
// collaboration routes or the dedicated browser meeting application.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../..',import.meta.url);
const load=p=>fs.readFileSync(new URL(p,root),'utf8');
const dashboard=load('/member-dashboard/index.html');
const workspace=load('/workspace/index.html');
const meeting=load('/meet-desktop/ui/index.html');
const workspaceJs=load('/workspace/workspace.js');
assert.match(dashboard,/href="\/workspace\/"[^>]*>/,'Agent Dashboard must lead to Workspace');
assert.doesNotMatch(dashboard,/href="\/meet\/"/,'No redundant direct Meet link on Agent Dashboard');
assert.doesNotMatch(dashboard,/class="dashboard-meet-link"/,'No legacy duplicate Meet navigation');
assert.match(workspace,/href="\/meet\/"[^>]*>/,'Workspace must retain canonical Meet entry');
for(const action of ['new','join','schedule','share','personal']){
  assert.ok(workspace.includes(`/meet/?action=${action}`),`Workspace lost Meet action: ${action}`);
}
for(const path of ['/workspace/drive/','/workspace/chat/','/workspace/calendar/','/workspace/tasks/','/workspace/contacts/','/workspace/aurora/']){
  assert.ok(workspaceJs.includes(path),`Workspace lost collaboration route: ${path}`);
}
assert.match(meeting,/DominionStar Meet/,'Dedicated browser meeting interface must remain');
console.log('PASS canonical Agent Dashboard -> Workspace -> Meet navigation (static source verification)');
