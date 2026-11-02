import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('assets/css/dominionstar-cinematic-os.css');
const journeyJs=read('assets/js/agent-journey.js');
const journeyHtml=read('agent-journey/index.html');
const learningHtml=read('agent-learning/index.html');
const appointmentsHtml=read('appointments/index.html');
const recognitionHtml=read('recognition/index.html');

test('ordinary people and progress actions use workflow blue rather than premium gold',()=>{
  for(const html of [journeyHtml,learningHtml,appointmentsHtml,recognitionHtml]){
    assert.doesNotMatch(html,/class="btn btn-gold"/);
  }
  assert.match(journeyHtml,/class="btn dsx-action-primary"/);
  assert.match(learningHtml,/class="btn dsx-action-primary"/);
  assert.match(appointmentsHtml,/class="btn dsx-action-primary"/);
  assert.match(recognitionHtml,/class="btn dsx-action-primary"/);
  assert.match(css,/\.dsx-action-primary\{[\s\S]*#2583f7[\s\S]*#126be2/);
});

test('Journey exposes pending current and completed semantic states',()=>{
  assert.doesNotThrow(()=>new vm.Script(journeyJs));
  assert.match(journeyJs,/next\?\.id===item\.id\?' current':' pending'/);
  assert.match(css,/\.agent-journey-item\.current\{[\s\S]*var\(--dsx-warning\)/);
  assert.match(css,/\.agent-journey-item\.completed\{[\s\S]*var\(--dsx-success\)/);
  assert.match(css,/\.agent-journey-track span\{[\s\S]*#1877f2[\s\S]*#35d07f/);
});

test('Team Member and appointment states use operational colors',()=>{
  assert.match(css,/\.member-directory-avatar>span\.online\{[\s\S]*var\(--dsx-success\)/);
  assert.match(css,/\.member-directory-actions \.connect-member\{[\s\S]*#2583f7/);
  assert.match(css,/\.appointment-status\.pending\{[\s\S]*rgba\(242,201,76,.11\)/);
  assert.match(css,/\.appointment-status\.confirmed,[\s\S]*rgba\(53,208,127,.11\)/);
  assert.match(css,/\.appointment-status\.rescheduled\{[\s\S]*rgba\(24,119,242,.11\)/);
  assert.match(css,/\.appointment-status\.cancelled\{[\s\S]*rgba\(255,77,90,.11\)/);
  assert.match(css,/\.cancel-appointment\{[\s\S]*#ff8992/);
});

test('Learning categories and Recognition use color with meaning',()=>{
  assert.match(css,/#training \.agent-learning-icon\{[\s\S]*rgba\(24,119,242,.11\)/);
  assert.match(css,/#mentorship \.agent-learning-icon\{[\s\S]*rgba\(45,156,219,.10\)/);
  assert.match(css,/#leadership \.agent-learning-icon\{[\s\S]*rgba\(240,193,91,.10\)/);
  assert.match(css,/#financial-development \.agent-learning-icon\{[\s\S]*rgba\(53,208,127,.10\)/);
  assert.match(css,/\.recognition-mark\{[\s\S]*rgba\(240,193,91,.12\)/);
  assert.match(css,/\.recognition-post\{[\s\S]*var\(--dsx-gold\)/);
});
