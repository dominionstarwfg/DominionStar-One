import assert from 'node:assert/strict';
import { CaptureSession } from '../src/capture-session.mjs';

let time=1_000;
const session=new CaptureSession({selectionTtlMs:500,now:()=>time});

assert.equal(session.select(7,{sourceId:'screen:1:0',kind:'screen',displayId:'44',audio:true}),true);
const first=session.consume(7);
assert.equal(first.sourceId,'screen:1:0');
assert.equal(session.consume(7),null,'a source selection must be single-use');
assert.equal(session.lastFailure,'selection-missing');

session.select(7,{sourceId:'window:2:0',kind:'window',sourceName:'Slides'});
time+=501;
assert.equal(session.consume(7),null,'stale source selections must be rejected');
assert.equal(session.lastFailure,'selection-expired');

for(let cycle=0;cycle<25;cycle+=1){
  time+=1;
  assert.equal(session.select(7,{sourceId:`screen:${cycle}:0`,kind:'screen',displayId:'44'}),true);
  const selection=session.consume(7);
  session.activate({id:selection.sourceId,display_id:'44'},selection);
  assert.deepEqual(session.active,{sourceId:`screen:${cycle}:0`,displayId:'44',kind:'screen'});
  session.end();
  assert.deepEqual(session.active,{sourceId:'',displayId:'',kind:''});
}

assert.equal(session.select(0,{sourceId:'screen:1:0',kind:'screen'}),false);
assert.equal(session.select(7,{sourceId:'camera:1',kind:'screen'}),false);
console.log('Desktop capture session lifecycle passed (25 repeated shares).');
