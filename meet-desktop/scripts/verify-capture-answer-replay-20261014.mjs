import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../ui/share-capture-worker.js',import.meta.url),'utf8');
let onAnswer,errors=[],setCalls=0,addCalls=0;
const pc={signalingState:'have-local-offer',remoteDescription:null,
 async setRemoteDescription(sdp){setCalls++;this.remoteDescription=sdp;this.signalingState='stable'},
 async addIceCandidate(){addCalls++}};
const bridge={onAnswer(fn){onAnswer=fn},onCandidate(){},onStart(){},onStop(){},error(e){errors.push(e)}};
const ctx={window:{dominionShareCapture:bridge},navigator:{},RTCPeerConnection:class{},console};
vm.runInNewContext(source,ctx);
// Probe the actual worker's closure through its answer listener after a synthetic offer.
// The worker does not expose its peer: test its answer state machine directly via source extraction.
const start=source.indexOf('async function acceptAnswer('),end=source.indexOf('async function acceptRemoteCandidate(',start);
assert.ok(start>=0&&end>start);
const scope=new Function('bridge','pc',`let peer=pc,generation=4;async function flushRemoteCandidates(){}; ${source.slice(start,end)};return acceptAnswer`);
const accept=scope(bridge,pc);
const answer={generation:4,sdp:{type:'answer',sdp:'v=0\\r\\nexample'}};
await accept(answer);await accept(answer);
assert.equal(setCalls,1,'exact replay must not call setRemoteDescription twice');
assert.equal(errors.length,0,'exact replay must not produce capture error');
await accept({...answer,generation:3});
assert.equal(setCalls,1,'stale generation must be ignored');
await accept({generation:4,sdp:{type:'answer',sdp:'different'}});
assert.equal(errors[0]?.error,'capture_answer_conflict','different stable answer must be flagged');
assert.equal(addCalls,0);
console.log('PASS isolated macOS capture SDP answer replay, generation fencing and conflict detection (simulation only)');
