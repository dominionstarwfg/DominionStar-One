import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const engine=fs.readFileSync('assets/js/meeting-engine.js','utf8');
const ui=fs.readFileSync('assets/js/meet-next/executive6.js','utf8');
const resolver=fs.readFileSync('netlify/functions/resolve-meeting-join.mjs','utf8');
const html=fs.readFileSync('meet/index.html','utf8');
const contract=JSON.parse(fs.readFileSync('meet/release-contract.json','utf8'));

assert.match(resolver,/live_verification:true/,'Resolver must explicitly hand unavailable DB lookup to live verification');
assert.match(resolver,/reply\(503,\{found:null,live_verification:true/,'Resolver DB failure must not remain an opaque HTTP 500');
assert.match(ui,/record\?\.live_verification===true/,'Guest UI must recognize only explicit live-verification fallback');
assert.match(ui,/liveVerification:true/,'Guest authority must mark live verification');
assert.match(ui,/passcode:state\.passcode/,'UI must give the engine the locally supplied passcode for host-side proof');
assert.match(engine,/crypto\.subtle\.digest\('SHA-256'/,'Meeting passcode proof must use SHA-256');
assert.match(engine,/sanitizeRoomId\(roomId\).*normalized.*joinToken/s,'Passcode proof must bind room, passcode and one-time join token');
assert.match(engine,/passcodeProof:state\.joinPasscodeProof/,'Waiting guest must send passcode proof with join request');
assert.match(engine,/payload\.passcodeProof!==expectedProof/,'Host must reject a mismatched proof');
assert.match(engine,/reason:'incorrect-passcode'/,'Incorrect passcode must produce a targeted denial');
assert.ok(!/send\('meet-join-request',\{[^}]*passcode:/.test(engine),'Plaintext passcode must never be broadcast in join request');
assert.match(html,/meeting-engine\.js\?v=95-rc13-4-live-passcode-proof/,'Engine cache-bust missing');
assert.match(html,/executive6\.js\?v=82-rc13-4-live-room-lookup/,'UI cache-bust missing');
for(const path of ['assets/js/meeting-engine.js','assets/js/meet-next/executive6.js','meet/index.html','netlify/functions/resolve-meeting-join.mjs']){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  assert.equal(contract.files[path],actual,`Release contract mismatch for ${path}`);
}
console.log('LIVE_MEETING_LOOKUP_REALTIME_PASSCODE_PROOF_OK');
