import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const toolbar=read('ui/presenter-toolbar.js');
const parity=read('ui/presenter-command-parity-2.0.27.js');
const auth=read('ui/auth-password.js');
const shareService=read('src/share-service.mjs');
const shareController=read('ui/share-controller.js');
const shareIntegration=read('ui/share-integration.js');

assert.match(toolbar,/\['chat','participants','annotate','stop'\]/,'Presenter toolbar must explicitly isolate the commands that previously reopened/resized the meeting window.');
for(const command of ['chat','participants','annotate','stop']){
  assert.ok(toolbar.includes(`toolbar:\${command}`)||toolbar.includes('`toolbar:${command}`')||toolbar.includes('`toolbar:${command}`'.replace('${command}',command))||toolbar.includes('`toolbar:${command}`'),`Toolbar routing must cover ${command}.`);
}
assert.ok(toolbar.includes("routedCommand('stop')"),'Stop Share must use the safe routed command.');
assert.ok(toolbar.includes('routedCommand(command)'),'Presenter buttons must use one routed command authority.');

assert.ok(auth.includes("script.src='./presenter-command-parity-2.0.27.js'"),'Desktop runtime must load the 2.0.27 presenter parity layer.');
assert.ok(parity.includes("const TOOLBAR_PREFIX='toolbar:'"),'Renderer must normalize presenter toolbar aliases.');
assert.ok(parity.includes('window.__DominionPresenterDispatch=wrapped'),'Renderer dispatcher must be wrapped without replacing the certified media controllers.');
assert.ok(parity.includes('full-window meeting takeover'),'2.0.27 must explicitly guard against the reported companion takeover regression.');
assert.ok(parity.includes('body[data-ds-share-companion="chat"]'),'Chat share mode must have a floating-panel override.');
assert.ok(parity.includes('body[data-ds-share-companion="participants"]'),'Participants share mode must have a floating-panel override.');
assert.ok(parity.includes('position:absolute!important'),'Share companion panels must float over the share stage rather than replace it.');

// Preserve the certified 2.0.26 capture/media authority. This feature is a
// command-routing correction, not another screen-capture rewrite.
assert.ok(shareService.includes("else if(['participants','chat','annotate'].includes(normalized)&&shareActive)"),'Expected legacy exact-command mutation boundary changed unexpectedly.');
assert.ok(shareController.includes('navigator.mediaDevices.getDisplayMedia'),'Certified display capture authority must remain intact.');
assert.ok(shareIntegration.includes("if(command==='pause'){await share.togglePause(sharedVideo)"),'Certified Pause/Resume authority must remain intact.');
assert.ok(shareIntegration.includes("if(command==='stop'){clearCompanion();await share.stop();applyLayout()"),'Certified Stop Share authority must remain intact.');
assert.ok(shareIntegration.includes("if(command==='audio'){await media.setMicrophone"),'Certified microphone authority must remain intact.');
assert.ok(shareIntegration.includes("if(command==='video'){await media.setCamera"),'Certified camera authority must remain intact.');
assert.ok(shareIntegration.includes("if(command==='new-share'){await openPickerWithPermission()"),'Certified New Share authority must remain intact.');

console.log('DOMINIONSTAR_PRESENTER_COMMAND_PARITY_2_0_27_OK routed-chat routed-participants routed-annotate routed-stop floating-share-panels capture-authority-preserved');
