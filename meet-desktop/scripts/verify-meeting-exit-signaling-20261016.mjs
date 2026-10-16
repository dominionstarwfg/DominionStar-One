// Isolated regression for meeting exit and stale WebRTC signaling teardown.
// No users, browser session, credentials, or server writes required.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../ui/app.js');
const rtc=read('../ui/webrtc-controller.js');
const returnHome=app.slice(app.indexOf('  async function returnHome(){'),app.indexOf('  async function bootAuth()'));
assert.ok(returnHome.startsWith('  async function returnHome(){'),'returnHome function missing');
const stopPolling=returnHome.indexOf('stopPolling();');
const meetingEnded=returnHome.indexOf("window.dispatchEvent(new CustomEvent('dominion:meeting-ended'))");
const awaitShare=returnHome.indexOf('await stopMeetingPresentation()');
const awaitNative=returnHome.indexOf('desktop?.app?.meetingEnded?.()');
assert.ok(stopPolling>=0&&meetingEnded>stopPolling&&awaitShare>meetingEnded&&awaitNative>meetingEnded,
  'Meeting-end event must occur once, before asynchronous presenter/native cleanup');
assert.equal((returnHome.match(/CustomEvent\('dominion:meeting-ended'\)/g)||[]).length,1,
  'Meeting-end notification must not be duplicated');
assert.match(rtc,/window\.addEventListener\('dominion:meeting-ended',\(\)=>\{void stop\(\);\}\)/,
  'WebRTC must stop immediately on the authoritative meeting end event');
const stop=rtc.slice(rtc.indexOf('  async function stop(){'),rtc.indexOf('  // Explicit QA snapshot:'));
assert.match(stop,/state\.running=false;state\.generation\+=1/,
  'WebRTC must invalidate running signaling generation before asynchronous peer cleanup');
assert.match(stop,/clearInterval\(state\.timers\[key\]\)/,
  'WebRTC must remove poll timers during teardown');
assert.match(rtc,/for\(const p of snapshot\?\.participants\|\|\[\]\)\{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*if\(!p\|\|typeof p!=='object'\)continue;/,
  'Null roster entries must not interrupt signaling reconciliation');
console.log('PASS early meeting-end event, synchronous signaling stop, null-roster guard (isolated source checks)');
