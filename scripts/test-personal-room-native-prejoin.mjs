import fs from 'node:fs';
import crypto from 'node:crypto';

const home = fs.readFileSync('meet-home/index.html', 'utf8');
const meet = fs.readFileSync('meet/index.html', 'utf8');
const hotfix = fs.readFileSync('assets/js/meet/hotfix-rc13-1-media-prejoin.js', 'utf8');
const personal = fs.readFileSync('assets/js/meet-next/personal-room.js', 'utf8');
const preload = fs.readFileSync('desktop 2/src/preload.cjs', 'utf8');
const main = fs.readFileSync('desktop 2/src/main-v2.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('meet/release-contract.json', 'utf8'));

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(home.includes('data-action="personal"'), 'Desktop Meet Home must expose Personal Room');
assert(home.includes('Your permanent meeting room'), 'Personal Room must be clearly identified as permanent');
assert(hotfix.includes("bootstrapAction === 'personal'"), 'Desktop Personal Room bootstrap is missing');
assert(hotfix.includes('window.DominionStarEnterHostPrejoin'), 'Shared host prejoin hook is missing');
assert(hotfix.includes('getMediaPermissions'), 'Hosted prejoin does not query native media permission state');
assert(hotfix.includes('requestMediaPermissions'), 'Hosted prejoin does not request native macOS permission');
assert(hotfix.includes('await ensureNativeMediaPermissions(next)'), 'Every wrapped getUserMedia request must cross native permission gate');
assert(personal.includes('window.DominionStarEnterHostPrejoin'), 'Personal Room Start must route through shared prejoin');
assert(preload.includes('getMediaPermissions: () =>'), 'Desktop bridge media permission status API missing');
assert(preload.includes('requestMediaPermissions:'), 'Desktop bridge media permission request API missing');
assert(preload.includes('const BRIDGE_VERSION = 14'), 'Desktop bridge 14 must preserve native media permissions while adding delegated Slide Control');
assert(Number(contract.desktopBridge) === 14, 'Release contract must require desktop bridge 14');
assert(main.includes("systemPreferences.askForMediaAccess(kind)"), 'macOS native permission request is missing');
assert(meet.includes('personal-room.js?v=2-native-prejoin'), 'Personal Room cache-bust missing');
assert(meet.includes('hotfix-rc13-1-media-prejoin.js?v=4-camera-privacy-reacquire'), 'Native prejoin cache-bust missing');

for (const path of ['meet-home/index.html','meet/index.html','assets/js/meet-next/personal-room.js','assets/js/meet/hotfix-rc13-1-media-prejoin.js']) {
  assert(contract.files?.[path], `Release contract is missing ${path}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  assert(contract.files[path] === actual, `Release contract hash mismatch for ${path}`);
}
console.log('Personal Room + native desktop prejoin regression passed on bridge 14.');
