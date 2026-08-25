import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../assets/js/meet/hotfix-rc13-1-media-prejoin.js',import.meta.url),'utf8');
const requireSource=(needle,message)=>assert(source.includes(needle),message);
const forbidSource=(needle,message)=>assert(!source.includes(needle),message);

requireSource("event.target.closest?.('#joinMeetingAction')",'Manual Join action does not enter the Zoom-style Meeting ID step.');
requireSource("joinHeading.textContent = 'Join a meeting'",'Manual Join does not present the Meeting ID step first.');
requireSource("joinHeading.textContent = 'Enter meeting passcode'",'Protected meetings do not transition to a dedicated passcode step.');
requireSource("fetch('/.netlify/functions/resolve-meeting-join'",'Manual Join does not verify the Meeting ID before continuing.');
requireSource('if (record.passcode_required) {','Manual Join does not conditionally request a passcode.');
requireSource('record.passcode_required && record.passcode_valid === false','Incorrect passcodes are not rejected on the passcode step.');
requireSource("response.status === 404 || record?.found === false",'Invalid Meeting IDs do not fail closed.');
requireSource("if (!manualJoin.active || isHostJoin()) return;",'Host and non-manual join paths are not isolated from the manual sequence.');
requireSource('manualJoin.bypassOnce = true','Verified manual joins cannot continue into the established prejoin/media flow.');
requireSource("window.__DS_MEET_MANUAL_JOIN_FLOW = 'zoom-id-then-passcode-v2-flow-only'",'Flow-only Zoom manual join contract marker is missing.');

// Credential verification is a flow concern only. Guest media must remain under
// Executive 6 / meeting-engine ownership, not this manual-join module.
forbidSource('__dsLocalDeviceRouting','Manual join flow reintroduced the legacy global media wrapper.');
const manualGate=source.indexOf("window.__DS_MEET_MANUAL_JOIN_FLOW = 'zoom-id-then-passcode-v2-flow-only'");
const hostHandoff=source.indexOf('Host prejoin owns its preview only until Start Meeting');
assert(manualGate>=0&&hostHandoff>0,'Manual join and host media handoff contracts are missing.');

console.log('PASS Zoom-style manual join: Meeting ID first, passcode second, guest media remains single-owner.');
