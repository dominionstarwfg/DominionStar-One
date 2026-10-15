import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/share-controller.js',import.meta.url),'utf8');
const between=(start,end)=>{
  const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Missing presenter cleanup boundary');
  return src.slice(a,b);
};
const helper=between('  function rollbackFailedPresenterStart(stream){','  async function start({name=');
function run(nativeMacCapture){
  const calls=[],stream={getTracks:()=>[{stop(){calls.push('track.stop')}}]};
  let macWorkerActive=true;
  const state={liveStream:stream,sourceName:'Shared',options:{optimizeVideo:true},paused:true};
  const rollback=new Function('state','stopTracks','disposeMacCaptureClient','nativeMacCapture',
    'getWorkerActive','setWorkerActive',
    // Rebind the local worker flag to a test-visible setter, while executing
    // the actual production rollback body unchanged otherwise.
    helper.replace('macWorkerActive=false;','setWorkerActive(false);')+';return rollbackFailedPresenterStart;')(
      state,s=>{for(const t of s.getTracks())t.stop()},({stopWorker})=>{
        calls.push('worker.dispose:'+stopWorker);
        if(state.liveStream)for(const t of state.liveStream.getTracks())t.stop();
        state.liveStream=null;
      },nativeMacCapture,()=>macWorkerActive,value=>{macWorkerActive=value}
    );
  rollback(stream);
  assert.equal(state.liveStream,null,'failed presenter must not retain screen stream');
  assert.equal(state.sourceName,'');
  assert.equal(state.paused,false);
  assert.deepEqual(state.options,{});
  if(nativeMacCapture){
    assert.equal(macWorkerActive,false);
    assert.deepEqual(calls,['worker.dispose:true','track.stop'],
      'worker plus local media must be released on startup error');
  }else{
    assert.deepEqual(calls,['track.stop']);
  }
}
run(true);
run(false);
const startBlock=between('  async function start({name=', '  async function replaceSource(');
assert.equal(startBlock.split('rollbackFailedPresenterStart(stream);').length-1,2,
  'both rejected presenter acknowledgement and thrown handshake must rollback the worker');
assert.ok(startBlock.includes('finally{'), 'busy flag must be reset in finally');
console.log('PASS presenter toolbar rejection releases Mac capture worker, local screen tracks and restart state (mock only)');