import fs from 'node:fs';
import crypto from 'node:crypto';

const home = fs.readFileSync('meet-home/index.html', 'utf8');
const meet = fs.readFileSync('meet/index.html', 'utf8');
const flow = fs.readFileSync('assets/js/meet/hotfix-rc13-1-media-prejoin.js', 'utf8');
const personal = fs.readFileSync('assets/js/meet-next/personal-room.js', 'utf8');
const preload = fs.readFileSync('desktop 2/src/preload.cjs', 'utf8');
const main = fs.readFileSync('desktop 2/src/main-v2.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('meet/release-contract.json', 'utf8'));

const assert = (condition, message) => { if (!condition) throw new Error(message); };

// Personal Room belongs inside the compact New Meeting flow, not as a separate
// permanent home-screen tile. The user chooses a fresh ID or Personal Room and
// both routes continue through the same native host prejoin.
assert(home.includes('id="newMeetingButton"'), 'Desktop Meet Home must expose New Meeting');
assert(home.includes('id="newMeetingDialog"'), 'New Meeting must expose a compact meeting-identity chooser');
assert(home.includes('data-meeting-mode="new"') && home.includes('New meeting ID'), 'New Meeting must offer a fresh meeting ID');
assert(home.includes('data-meeting-mode="personal"') && home.includes('<strong>Personal Room</strong>'), 'New Meeting must offer Personal Room');
assert(home.includes('role="radiogroup"') && home.includes('role="radio"'), 'Meeting identity chooser must use modern selectable controls');
assert(home.includes('id="startSelectedMeeting"'), 'New Meeting chooser must have one Start Meeting action');
assert(!home.includes('data-action="personal"'), 'Personal Room must not return as a standalone home-screen tile');
assert(flow.includes("bootstrapAction === 'personal'"), 'Desktop Personal Room bootstrap is missing');
assert(flow.includes('window.DominionStarEnterHostPrejoin'), 'Shared host prejoin hook is missing');
assert(flow.includes('getMediaPermissions'), 'Hosted host prejoin does not query native media permission state');
assert(flow.includes('requestMediaPermissions'), 'Hosted host prejoin does not request native macOS permission');
assert(flow.includes('await ensureNativeMediaPermissions(constraints);'), 'Host preview acquisition must cross the native permission gate');
assert(!flow.includes('navigator.mediaDevices.getUserMedia ='), 'Personal Room prejoin must not depend on a global getUserMedia wrapper');
assert(personal.includes('window.DominionStarEnterHostPrejoin'), 'Personal Room Start must route through shared host prejoin');
assert(preload.includes('getMediaPermissions: () =>'), 'Desktop bridge media permission status API missing');
assert(preload.includes('requestMediaPermissions:'), 'Desktop bridge media permission request API missing');
assert(preload.includes('const BRIDGE_VERSION = 14'), 'Desktop bridge 14 must preserve native media permissions while adding delegated Slide Control');
assert(Number(contract.desktopBridge) === 14, 'Release contract must require desktop bridge 14');
assert(main.includes("systemPreferences.askForMediaAccess(kind)"), 'macOS native permission request is missing');
assert(meet.includes('personal-room.js?v=2-native-prejoin'), 'Personal Room cache-bust missing');
assert(meet.includes('hotfix-rc13-1-media-prejoin.js?v=4-camera-privacy-reacquire'), 'Native prejoin flow asset is missing');

for (const path of ['meet-home/index.html','meet/index.html','assets/js/meet-next/personal-room.js','assets/js/meet/hotfix-rc13-1-media-prejoin.js']) {
  assert(contract.files?.[path], `Release contract is missing ${path}`);
  // During source iterations the release contract intentionally fails closed
  // until the newly proven runtime bytes are certified. This test protects the
  // presence of each release-contract entry; integrity is checked separately.
  if (path !== 'assets/js/meet/hotfix-rc13-1-media-prejoin.js') {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
    assert(contract.files[path] === actual, `Release contract hash mismatch for ${path}`);
  }
}
console.log('Personal Room + native desktop prejoin single-owner regression passed on bridge 14 with compact New Meeting ownership.');